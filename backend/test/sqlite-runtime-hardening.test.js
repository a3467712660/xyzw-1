import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { env } from "../src/config/env.js";
import { backup } from "../src/db/client.js";
import { closeDatabase, getDb, initDatabase } from "../src/db/database.js";

const originalEnv = {
  dbPath: env.dbPath,
  binStoragePath: env.binStoragePath,
  appDbBackupEnabled: env.appDbBackupEnabled,
  nodeEnv: env.nodeEnv,
};

const setRuntimeEnv = ({ dbPath, binStoragePath, appDbBackupEnabled, nodeEnv }) => {
  env.dbPath = dbPath;
  env.binStoragePath = binStoragePath;
  env.appDbBackupEnabled = appDbBackupEnabled;
  env.nodeEnv = nodeEnv;
};

const restoreRuntimeEnv = () => {
  closeDatabase();
  env.dbPath = originalEnv.dbPath;
  env.binStoragePath = originalEnv.binStoragePath;
  env.appDbBackupEnabled = originalEnv.appDbBackupEnabled;
  env.nodeEnv = originalEnv.nodeEnv;
};

test.afterEach(() => {
  restoreRuntimeEnv();
});

test("initDatabase enables WAL, NORMAL synchronous, and busy_timeout=5000", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xyzw-sqlite-runtime-"));
  const dbPath = path.join(tempRoot, "runtime.sqlite.bin");
  const binStoragePath = path.join(tempRoot, "bin-storage");

  t.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  setRuntimeEnv({
    dbPath,
    binStoragePath,
    appDbBackupEnabled: true,
    nodeEnv: "test",
  });

  await initDatabase();
  const db = getDb();

  assert.equal(String(db.pragma("journal_mode", { simple: true })).toLowerCase(), "wal");
  assert.equal(db.pragma("synchronous", { simple: true }), 1);
  assert.equal(db.pragma("busy_timeout", { simple: true }), 5000);
});

test("production sqlite runtime rejects overly permissive runtime paths on posix", { skip: process.platform === "win32" }, async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xyzw-sqlite-prod-mode-"));
  const dbDir = path.join(tempRoot, "db");
  const dbPath = path.join(dbDir, "runtime.sqlite.bin");
  const binStoragePath = path.join(tempRoot, "bin-storage");

  fs.mkdirSync(dbDir, { recursive: true, mode: 0o755 });
  fs.mkdirSync(binStoragePath, { recursive: true, mode: 0o755 });

  t.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  setRuntimeEnv({
    dbPath,
    binStoragePath,
    appDbBackupEnabled: true,
    nodeEnv: "production",
  });

  assert.throws(
    () => initDatabase(),
    /chmod 700|权限过宽|owner-only/i,
  );
});

test("non-production sqlite runtime auto-tightens runtime path permissions on posix", { skip: process.platform === "win32" }, async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xyzw-sqlite-dev-mode-"));
  const dbDir = path.join(tempRoot, "db");
  const dbPath = path.join(dbDir, "runtime.sqlite.bin");
  const binStoragePath = path.join(tempRoot, "bin-storage");

  fs.mkdirSync(dbDir, { recursive: true, mode: 0o755 });
  fs.mkdirSync(binStoragePath, { recursive: true, mode: 0o755 });

  t.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  setRuntimeEnv({
    dbPath,
    binStoragePath,
    appDbBackupEnabled: true,
    nodeEnv: "development",
  });

  await initDatabase();

  assert.equal(fs.statSync(dbDir).mode & 0o777, 0o700);
  assert.equal(fs.statSync(binStoragePath).mode & 0o777, 0o700);
  assert.equal(fs.statSync(path.join(dbDir, "backups")).mode & 0o777, 0o700);
  assert.equal(fs.statSync(dbPath).mode & 0o777, 0o600);
});

test("backup writes owner-only backup files and directories on posix", { skip: process.platform === "win32" }, async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xyzw-sqlite-backup-"));
  const dbPath = path.join(tempRoot, "runtime.sqlite.bin");
  const binStoragePath = path.join(tempRoot, "bin-storage");

  t.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  setRuntimeEnv({
    dbPath,
    binStoragePath,
    appDbBackupEnabled: true,
    nodeEnv: "test",
  });

  await initDatabase();
  const backupPath = backup("manual");

  assert.ok(backupPath);
  assert.equal(fs.statSync(path.dirname(backupPath)).mode & 0o777, 0o700);
  assert.equal(fs.statSync(backupPath).mode & 0o777, 0o600);
});

test("sqlite runtime security helper skips mode enforcement on windows", async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xyzw-sqlite-win-"));
  const dbPath = path.join(tempRoot, "runtime.sqlite.bin");
  const binStoragePath = path.join(tempRoot, "bin-storage");

  fs.mkdirSync(path.dirname(dbPath), { recursive: true, mode: 0o755 });
  fs.mkdirSync(binStoragePath, { recursive: true, mode: 0o755 });

  t.after(() => {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });

  const { ensureSqliteRuntimePathsSecure } = await import("../src/db/runtimeSecurity.js");

  assert.doesNotThrow(() =>
    ensureSqliteRuntimePathsSecure({
      dbPath,
      binStoragePath,
      appDbBackupEnabled: true,
      nodeEnv: "production",
      platform: "win32",
    }));
});

test("db client facade re-exports the sqlite adapter contract", async () => {
  const client = await import("../src/db/client.js");
  const sqliteAdapter = await import("../src/db/sqliteAdapter.js");

  assert.equal(client.query, sqliteAdapter.query);
  assert.equal(client.run, sqliteAdapter.run);
  assert.equal(client.transaction, sqliteAdapter.transaction);
  assert.equal(client.backup, sqliteAdapter.backup);
  assert.equal(client.scheduleDailyBackup, sqliteAdapter.scheduleDailyBackup);
});
