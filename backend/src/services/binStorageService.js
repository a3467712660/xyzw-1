import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { env } from "../config/env.js";
import { decryptBuffer, encryptBuffer } from "../lib/crypto.js";
import { userRepository } from "../repositories/userRepository.js";

const MAX_TOKEN_ID_LENGTH = 128;
const SAFE_LEGACY_SEGMENT_PATTERN = /^[a-zA-Z0-9_-]+$/;
const BIN_ENCRYPTED_SUFFIX = ".bin.enc";
const BIN_PLAIN_SUFFIX = ".bin";
export const BIN_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const BIN_UPLOAD_MIN_BYTES = 8;

const migrationPromises = new Map();
const migrationCleanState = new Map();

const pathExists = async (targetPath) => {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
};

const ensureDir = async (dirPath) => {
  await fs.mkdir(dirPath, { recursive: true });
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

const migrationStateKey = (user) =>
  `${safeSegment(user?.id, "unknown")}:${safeSegment(user?.username, "user")}`;

const canonicalUserDir = (user) => path.join(env.binStoragePath, userFolderName(user));

const asLegacySafeSegment = (value) => {
  const raw = String(value || "").trim();
  if (!raw || !SAFE_LEGACY_SEGMENT_PATTERN.test(raw)) {
    return null;
  }
  return raw;
};

const collectLegacyUserDirCandidates = (user) => {
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

  return [...dirs].filter((dir) => dir !== canonicalDir);
};

const collectExistingLegacyUserDirs = async (user) => {
  const candidates = collectLegacyUserDirCandidates(user);
  const settled = await Promise.all(
    candidates.map(async (dir) => ({
      dir,
      exists: await pathExists(dir),
    })),
  );
  return settled.filter((item) => item.exists).map((item) => item.dir);
};

const moveFileToCanonical = async (sourcePath, targetPath) => {
  try {
    await fs.rename(sourcePath, targetPath);
  } catch (error) {
    if (error?.code !== "EXDEV") {
      throw error;
    }
    await fs.copyFile(sourcePath, targetPath);
    await fs.rm(sourcePath, { force: true });
  }
};

const migrateLegacyUserBinDirsUnsafe = async (user) => {
  const stateKey = migrationStateKey(user);
  const legacyDirs = await collectExistingLegacyUserDirs(user);
  const canonicalDir = canonicalUserDir(user);
  const hasCanonicalDir = await pathExists(canonicalDir);
  if (migrationCleanState.get(stateKey) && legacyDirs.length === 0) {
    return;
  }
  if (legacyDirs.length === 0 && !hasCanonicalDir) {
    migrationCleanState.set(stateKey, true);
    return;
  }

  await ensureDir(canonicalDir);
  const scanDirs = [canonicalDir, ...legacyDirs];

  for (const scanDir of scanDirs) {
    if (!(await pathExists(scanDir))) continue;

    const entries = await fs.readdir(scanDir, { withFileTypes: true });
    for (const entry of entries.filter((candidate) => candidate.isFile())) {
      const parsed = parseTokenIdFromFileName(entry.name);
      if (!parsed) continue;

      const sourcePath = path.join(scanDir, entry.name);
      const targetPath = path.join(canonicalDir, `${parsed.tokenId}${BIN_ENCRYPTED_SUFFIX}`);
      const sourceStats = await fs.stat(sourcePath);
      const targetExists = await pathExists(targetPath);
      const targetStats = targetExists ? await fs.stat(targetPath) : null;
      const targetUpdatedAt = targetStats?.mtimeMs || 0;

      if (parsed.encrypted) {
        if (sourcePath === targetPath) {
          continue;
        }
        if (!targetExists) {
          await moveFileToCanonical(sourcePath, targetPath);
          continue;
        }

        if (sourceStats.mtimeMs > targetUpdatedAt) {
          await fs.rm(targetPath, { force: true });
          await moveFileToCanonical(sourcePath, targetPath);
        } else {
          await fs.rm(sourcePath, { force: true });
        }
        continue;
      }

      if (sourceStats.mtimeMs >= targetUpdatedAt) {
        const plainBuffer = await fs.readFile(sourcePath);
        const encryptedPayload = encryptBuffer(plainBuffer);
        await fs.writeFile(targetPath, encryptedPayload, { mode: 0o600 });
      }
      await fs.rm(sourcePath, { force: true });
    }
  }

  for (const legacyDir of legacyDirs) {
    if (!(await pathExists(legacyDir))) continue;
    const remaining = await fs.readdir(legacyDir, { withFileTypes: true });
    if (remaining.length === 0) {
      await fs.rm(legacyDir, { recursive: true, force: true });
    }
  }

  migrationCleanState.set(
    stateKey,
    (await collectExistingLegacyUserDirs(user)).length === 0,
  );
};

const ensureLegacyMigration = async (user) => {
  const stateKey = migrationStateKey(user);
  if (migrationPromises.has(stateKey)) {
    return migrationPromises.get(stateKey);
  }
  const promise = migrateLegacyUserBinDirsUnsafe(user).finally(() => {
    migrationPromises.delete(stateKey);
  });
  migrationPromises.set(stateKey, promise);
  return promise;
};

const resolveCanonicalBinFilePath = async (user, tokenId) => {
  assertTokenId(tokenId);
  await ensureLegacyMigration(user);
  return path.join(canonicalUserDir(user), `${tokenId}${BIN_ENCRYPTED_SUFFIX}`);
};

const binFilePath = async (user, tokenId) => {
  assertTokenId(tokenId);
  const dir = canonicalUserDir(user);
  await ensureDir(dir);
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

export const saveBinFile = async ({ user, tokenId, buffer }) => {
  const validationError = validateBinBuffer(buffer);
  if (validationError) {
    throw new Error(validationError);
  }

  const canonicalPath = await resolveCanonicalBinFilePath(user, tokenId);
  const exists = await pathExists(canonicalPath);
  if (!exists) {
    const currentCount = await countBinFilesForUser({ user });
    const bindLimit = readTokenBindLimit(user);
    if (currentCount >= bindLimit) {
      throw new Error(`最多只能绑定 ${bindLimit} 个Token`);
    }
  }

  const filePath = await binFilePath(user, tokenId);
  const payload = encryptBuffer(buffer);
  await fs.writeFile(filePath, payload, { mode: 0o600 });

  return {
    tokenId,
    path: filePath,
    size: buffer.length,
    checksum: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
};

export const readBinFile = async ({ user, tokenId }) => {
  const filePath = await resolveCanonicalBinFilePath(user, tokenId);
  if (!filePath || !(await pathExists(filePath))) {
    return null;
  }

  const encrypted = await fs.readFile(filePath);
  return decryptBuffer(encrypted);
};

export const deleteBinFile = async ({ user, tokenId }) => {
  assertTokenId(tokenId);
  const filePath = await resolveCanonicalBinFilePath(user, tokenId);
  if (!(await pathExists(filePath))) {
    return false;
  }
  await fs.rm(filePath, { force: true });
  return true;
};

export const listBinFiles = async ({ user }) => {
  await ensureLegacyMigration(user);
  const dir = canonicalUserDir(user);
  if (!(await pathExists(dir))) {
    return [];
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  const items = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(BIN_ENCRYPTED_SUFFIX))
      .map(async (entry) => {
        const filePath = path.join(dir, entry.name);
        const stats = await fs.stat(filePath);
        const tokenId = entry.name.replace(/\.bin\.enc$/, "");
        return {
          tokenId,
          fileName: entry.name,
          size: stats.size,
          createdAt: stats.birthtime.toISOString(),
          updatedAt: stats.mtime.toISOString(),
        };
      }),
  );

  return items.sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );
};

export const countBinFilesForUser = async ({ user }) => {
  await ensureLegacyMigration(user);
  const dir = canonicalUserDir(user);
  if (!(await pathExists(dir))) {
    return 0;
  }

  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(BIN_ENCRYPTED_SUFFIX))
    .length;
};

export const clearUserBinCache = async ({ user }) => {
  await ensureLegacyMigration(user);
  const dir = canonicalUserDir(user);
  if (!(await pathExists(dir))) {
    return { removedFiles: 0, removedDirs: 0 };
  }

  let removedFiles = 0;
  let removedDirs = 0;

  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries.filter(
    (candidate) => candidate.isFile() && candidate.name.endsWith(BIN_ENCRYPTED_SUFFIX),
  )) {
    await fs.rm(path.join(dir, entry.name), { force: true });
    removedFiles += 1;
  }

  const remaining = await fs.readdir(dir, { withFileTypes: true });
  if (remaining.length === 0) {
    await fs.rm(dir, { recursive: true, force: true });
    removedDirs += 1;
  }

  return { removedFiles, removedDirs };
};

export const cleanupExpiredTrialUserCaches = async () => {
  const thresholdAt = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const users = userRepository.listExpiredTrialUsers(thresholdAt);

  let clearedUsers = 0;
  let removedFiles = 0;
  let removedDirs = 0;

  for (const user of users) {
    const result = await clearUserBinCache({ user });
    if (result.removedFiles > 0 || result.removedDirs > 0) {
      clearedUsers += 1;
      removedFiles += result.removedFiles;
      removedDirs += result.removedDirs;
    }
  }

  return {
    scannedUsers: users.length,
    clearedUsers,
    removedFiles,
    removedDirs,
  };
};
