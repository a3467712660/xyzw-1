import fs from "node:fs";
import path from "node:path";
import process from "node:process";

export const SQLITE_OWNER_ONLY_FILE_MODE = 0o600;
export const SQLITE_OWNER_ONLY_DIR_MODE = 0o700;

const warnedMessages = new Set();

const isWindowsPlatform = (platform = process.platform) => platform === "win32";

const toModeString = (mode) => mode.toString(8).padStart(3, "0");

const warnOnce = (consoleRef, key, message) => {
  if (warnedMessages.has(key)) {
    return;
  }
  warnedMessages.add(key);
  consoleRef.warn(message);
};

const ensureDirExists = (targetPath, { fsModule = fs, mode = SQLITE_OWNER_ONLY_DIR_MODE } = {}) => {
  if (!fsModule.existsSync(targetPath)) {
    fsModule.mkdirSync(targetPath, { recursive: true, mode });
  }
};

const getMode = (targetPath, { fsModule = fs } = {}) => fsModule.statSync(targetPath).mode & 0o777;

const isTooPermissive = (mode) => (mode & 0o077) !== 0;

const ensureOwnerOnlyPath = ({
  targetPath,
  label,
  expectedMode,
  createMissing = false,
  nodeEnv,
  platform = process.platform,
  fsModule = fs,
  consoleRef = console,
  type = "path",
}) => {
  if (createMissing && type === "dir") {
    ensureDirExists(targetPath, { fsModule, mode: expectedMode });
  }

  if (!fsModule.existsSync(targetPath) || isWindowsPlatform(platform)) {
    return;
  }

  const currentMode = getMode(targetPath, { fsModule });
  if (!isTooPermissive(currentMode)) {
    if (currentMode !== expectedMode && nodeEnv !== "production") {
      fsModule.chmodSync(targetPath, expectedMode);
      warnOnce(
        consoleRef,
        `${label}:${targetPath}:normalized`,
        `[startup-check] normalized ${label} permission to ${toModeString(expectedMode)}: ${targetPath}`,
      );
    }
    return;
  }

  const chmodHint = `chmod ${toModeString(expectedMode)} ${targetPath}`;
  if (nodeEnv === "production") {
    throw new Error(
      `${label} 权限过宽 (${toModeString(currentMode)})：${targetPath}，请执行 ${chmodHint}`,
    );
  }

  fsModule.chmodSync(targetPath, expectedMode);
  warnOnce(
    consoleRef,
    `${label}:${targetPath}:tightened`,
    `[startup-check] auto-tightened ${label} permission from ${toModeString(currentMode)} to ${toModeString(expectedMode)}: ${targetPath}`,
  );
};

export const getSqliteBackupDir = (dbPath) =>
  path.resolve(path.dirname(path.resolve(dbPath)), "backups");

export const ensureSqliteRuntimePathsSecure = ({
  dbPath,
  binStoragePath,
  appDbBackupEnabled,
  nodeEnv,
  platform = process.platform,
  fsModule = fs,
  consoleRef = console,
}) => {
  const resolvedDbPath = path.resolve(dbPath);
  const resolvedBinStoragePath = path.resolve(binStoragePath);
  const dbDir = path.dirname(resolvedDbPath);
  const backupDir = getSqliteBackupDir(resolvedDbPath);

  ensureOwnerOnlyPath({
    targetPath: dbDir,
    label: "DB_PATH 目录",
    expectedMode: SQLITE_OWNER_ONLY_DIR_MODE,
    createMissing: true,
    nodeEnv,
    platform,
    fsModule,
    consoleRef,
    type: "dir",
  });

  ensureOwnerOnlyPath({
    targetPath: resolvedBinStoragePath,
    label: "BIN_STORAGE_PATH 目录",
    expectedMode: SQLITE_OWNER_ONLY_DIR_MODE,
    createMissing: true,
    nodeEnv,
    platform,
    fsModule,
    consoleRef,
    type: "dir",
  });

  if (appDbBackupEnabled) {
    ensureOwnerOnlyPath({
      targetPath: backupDir,
      label: "SQLite 备份目录",
      expectedMode: SQLITE_OWNER_ONLY_DIR_MODE,
      createMissing: true,
      nodeEnv,
      platform,
      fsModule,
      consoleRef,
      type: "dir",
    });
  }

  ensureOwnerOnlyPath({
    targetPath: resolvedDbPath,
    label: "SQLite 数据库文件",
    expectedMode: SQLITE_OWNER_ONLY_FILE_MODE,
    createMissing: false,
    nodeEnv,
    platform,
    fsModule,
    consoleRef,
    type: "file",
  });

  return {
    dbPath: resolvedDbPath,
    dbDir,
    binStoragePath: resolvedBinStoragePath,
    backupDir,
  };
};

export const ensureSqliteFileSecure = ({
  targetPath,
  label,
  nodeEnv,
  platform = process.platform,
  fsModule = fs,
  consoleRef = console,
}) =>
  ensureOwnerOnlyPath({
    targetPath,
    label,
    expectedMode: SQLITE_OWNER_ONLY_FILE_MODE,
    createMissing: false,
    nodeEnv,
    platform,
    fsModule,
    consoleRef,
    type: "file",
  });
