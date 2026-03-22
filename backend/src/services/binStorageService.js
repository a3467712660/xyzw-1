import fs from "fs";
import path from "path";
import crypto from "crypto";
import { env } from "../config/env.js";
import { decryptBuffer, encryptBuffer } from "../lib/crypto.js";
import { userRepository } from "../repositories/userRepository.js";

const MAX_TOKEN_ID_LENGTH = 128;
const SAFE_LEGACY_SEGMENT_PATTERN = /^[a-zA-Z0-9_-]+$/;
const BIN_ENCRYPTED_SUFFIX = ".bin.enc";
const BIN_PLAIN_SUFFIX = ".bin";
export const BIN_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const BIN_UPLOAD_MIN_BYTES = 8;

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

const safeSegment = (value, fallback) => {
  const cleaned = String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
};

const assertTokenId = (tokenId) => {
  if (
    !tokenId ||
    typeof tokenId !== "string" ||
    tokenId.length > MAX_TOKEN_ID_LENGTH ||
    !/^[a-zA-Z0-9_-]+$/.test(tokenId)
  ) {
    throw new Error("无效的 BIN 标识");
  }
};

const normalizeTokenId = (tokenId) => {
  if (
    !tokenId
    || typeof tokenId !== "string"
    || tokenId.length > MAX_TOKEN_ID_LENGTH
    || !/^[a-zA-Z0-9_-]+$/.test(tokenId)
  ) {
    return null;
  }
  return tokenId;
};

const parseTokenIdFromFileName = (fileName) => {
  if (fileName.endsWith(BIN_ENCRYPTED_SUFFIX)) {
    const tokenId = fileName.slice(0, -BIN_ENCRYPTED_SUFFIX.length);
    const normalized = normalizeTokenId(tokenId);
    if (!normalized) return null;
    return { tokenId: normalized, encrypted: true };
  }

  if (fileName.endsWith(BIN_PLAIN_SUFFIX)) {
    const tokenId = fileName.slice(0, -BIN_PLAIN_SUFFIX.length);
    const normalized = normalizeTokenId(tokenId);
    if (!normalized) return null;
    return { tokenId: normalized, encrypted: false };
  }

  return null;
};

const userFolderName = (user) => {
  const username = safeSegment(user.username, "user");
  const userId = safeSegment(user.id, "unknown");
  return `${username}_${userId}`;
};

const canonicalUserDir = (user) => path.join(env.binStoragePath, userFolderName(user));

const asLegacySafeSegment = (value) => {
  const raw = String(value || "").trim();
  if (!raw || !SAFE_LEGACY_SEGMENT_PATTERN.test(raw)) {
    return null;
  }
  return raw;
};

const collectLegacyUserDirs = (user) => {
  const usernameRawSafe = asLegacySafeSegment(user?.username);
  const usernameSafe = safeSegment(user?.username, "user");
  const userIdSafe = safeSegment(user?.id, "unknown");
  const canonicalDir = canonicalUserDir(user);

  const dirs = new Set([
    path.join(env.binStoragePath, userIdSafe),
    path.join(env.binStoragePath, usernameSafe),
  ]);

  if (usernameRawSafe) {
    dirs.add(path.join(env.binStoragePath, usernameRawSafe));
  }

  return [...dirs].filter((dir) => dir !== canonicalDir && fs.existsSync(dir));
};

const moveFileToCanonical = (sourcePath, targetPath) => {
  try {
    fs.renameSync(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== "EXDEV") {
      throw error;
    }
    fs.copyFileSync(sourcePath, targetPath);
    fs.rmSync(sourcePath, { force: true });
  }
};

const migrateLegacyUserBinDirs = (user) => {
  const legacyDirs = collectLegacyUserDirs(user);
  const canonicalDir = canonicalUserDir(user);
  const hasCanonicalDir = fs.existsSync(canonicalDir);
  if (legacyDirs.length === 0 && !hasCanonicalDir) {
    return;
  }

  ensureDir(canonicalDir);
  const scanDirs = [canonicalDir, ...legacyDirs];

  scanDirs.forEach((scanDir) => {
    if (!fs.existsSync(scanDir)) return;

    const entries = fs.readdirSync(scanDir, { withFileTypes: true });
    entries
      .filter((entry) => entry.isFile())
      .forEach((entry) => {
        const parsed = parseTokenIdFromFileName(entry.name);
        if (!parsed) return;

        const sourcePath = path.join(scanDir, entry.name);
        const targetPath = path.join(canonicalDir, `${parsed.tokenId}${BIN_ENCRYPTED_SUFFIX}`);
        const sourceUpdatedAt = fs.statSync(sourcePath).mtimeMs;
        const targetExists = fs.existsSync(targetPath);
        const targetUpdatedAt = targetExists ? fs.statSync(targetPath).mtimeMs : 0;

        if (parsed.encrypted) {
          if (sourcePath === targetPath) {
            return;
          }
          if (!targetExists) {
            moveFileToCanonical(sourcePath, targetPath);
            return;
          }

          if (sourceUpdatedAt > targetUpdatedAt) {
            fs.rmSync(targetPath, { force: true });
            moveFileToCanonical(sourcePath, targetPath);
          } else {
            fs.rmSync(sourcePath, { force: true });
          }
          return;
        }

        if (sourceUpdatedAt >= targetUpdatedAt) {
          const plainBuffer = fs.readFileSync(sourcePath);
          const encryptedPayload = encryptBuffer(plainBuffer);
          fs.writeFileSync(targetPath, encryptedPayload, { mode: 0o600 });
        }
        fs.rmSync(sourcePath, { force: true });
      });
  });

  legacyDirs.forEach((legacyDir) => {
    if (!fs.existsSync(legacyDir)) return;
    const remaining = fs.readdirSync(legacyDir, { withFileTypes: true });
    if (remaining.length === 0) {
      fs.rmSync(legacyDir, { recursive: true, force: true });
    }
  });
};

const resolveCanonicalBinFilePath = (user, tokenId) => {
  assertTokenId(tokenId);
  return path.join(canonicalUserDir(user), `${tokenId}${BIN_ENCRYPTED_SUFFIX}`);
};

const binFilePath = (user, tokenId) => {
  assertTokenId(tokenId);
  const dir = canonicalUserDir(user);
  ensureDir(dir);
  return path.join(dir, `${tokenId}${BIN_ENCRYPTED_SUFFIX}`);
};

const readTokenBindLimit = (user) =>
  Math.max(1, Math.min(999, Number(user?.tokenBindLimit) || 999));

const isAllZeroBuffer = (buffer) => {
  for (let i = 0; i < buffer.length; i += 1) {
    if (buffer[i] !== 0) {
      return false;
    }
  }
  return true;
};

export const validateBinBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    return "BIN 数据不能为空";
  }
  if (buffer.length < BIN_UPLOAD_MIN_BYTES) {
    return `BIN 文件过小，至少需要 ${BIN_UPLOAD_MIN_BYTES} 字节`;
  }
  if (buffer.length > BIN_UPLOAD_MAX_BYTES) {
    return `BIN 文件过大，最大允许 ${BIN_UPLOAD_MAX_BYTES} 字节`;
  }
  if (isAllZeroBuffer(buffer)) {
    return "BIN 格式校验失败";
  }
  return "";
};

export const saveBinFile = ({ user, tokenId, buffer }) => {
  const validationError = validateBinBuffer(buffer);
  if (validationError) {
    throw new Error(validationError);
  }

  migrateLegacyUserBinDirs(user);
  const canonicalPath = resolveCanonicalBinFilePath(user, tokenId);
  const exists = fs.existsSync(canonicalPath);
  if (!exists) {
    const currentCount = countBinFilesForUser({ user });
    const bindLimit = readTokenBindLimit(user);
    if (currentCount >= bindLimit) {
      throw new Error(`最多只能绑定 ${bindLimit} 个Token`);
    }
  }

  const filePath = binFilePath(user, tokenId);
  const payload = encryptBuffer(buffer);
  fs.writeFileSync(filePath, payload, { mode: 0o600 });

  return {
    tokenId,
    path: filePath,
    size: buffer.length,
    checksum: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
};

export const readBinFile = ({ user, tokenId }) => {
  migrateLegacyUserBinDirs(user);
  const filePath = resolveCanonicalBinFilePath(user, tokenId);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  const encrypted = fs.readFileSync(filePath);
  return decryptBuffer(encrypted);
};

export const deleteBinFile = ({ user, tokenId }) => {
  assertTokenId(tokenId);
  migrateLegacyUserBinDirs(user);
  const filePath = resolveCanonicalBinFilePath(user, tokenId);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  fs.rmSync(filePath, { force: true });
  return true;
};

export const listBinFiles = ({ user }) => {
  migrateLegacyUserBinDirs(user);
  const dir = canonicalUserDir(user);
  if (!fs.existsSync(dir)) {
    return [];
  }

  const items = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(BIN_ENCRYPTED_SUFFIX))
    .map((entry) => {
      const filePath = path.join(dir, entry.name);
      const stats = fs.statSync(filePath);
      const tokenId = entry.name.replace(/\.bin\.enc$/, "");
      return {
        tokenId,
        fileName: entry.name,
        size: stats.size,
        createdAt: stats.birthtime.toISOString(),
        updatedAt: stats.mtime.toISOString(),
      };
    });

  return items.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
};

export const countBinFilesForUser = ({ user }) => {
  migrateLegacyUserBinDirs(user);
  const dir = canonicalUserDir(user);
  if (!fs.existsSync(dir)) {
    return 0;
  }

  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(BIN_ENCRYPTED_SUFFIX))
    .length;
};

export const clearUserBinCache = ({ user }) => {
  migrateLegacyUserBinDirs(user);
  const dir = canonicalUserDir(user);
  if (!fs.existsSync(dir)) {
    return { removedFiles: 0, removedDirs: 0 };
  }

  let removedFiles = 0;
  let removedDirs = 0;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(BIN_ENCRYPTED_SUFFIX))
    .forEach((entry) => {
      fs.rmSync(path.join(dir, entry.name), { force: true });
      removedFiles += 1;
    });

  const remaining = fs.readdirSync(dir, { withFileTypes: true });
  if (remaining.length === 0) {
    fs.rmSync(dir, { recursive: true, force: true });
    removedDirs += 1;
  }

  return { removedFiles, removedDirs };
};

export const cleanupExpiredTrialUserCaches = () => {
  const thresholdAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const users = userRepository.listExpiredTrialUsers(thresholdAt);

  let clearedUsers = 0;
  let removedFiles = 0;
  let removedDirs = 0;

  users.forEach((user) => {
    const result = clearUserBinCache({ user });
    if (result.removedFiles > 0 || result.removedDirs > 0) {
      clearedUsers += 1;
      removedFiles += result.removedFiles;
      removedDirs += result.removedDirs;
    }
  });

  return {
    scannedUsers: users.length,
    clearedUsers,
    removedFiles,
    removedDirs,
  };
};
