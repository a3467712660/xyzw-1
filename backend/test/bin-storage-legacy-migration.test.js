import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { env } from "../src/config/env.js";
import { encryptBuffer } from "../src/lib/crypto.js";
import {
  countBinFilesForUser,
  listBinFiles,
  readBinFile,
} from "../src/services/binStorageService.js";

const safeSegment = (value, fallback) => {
  const cleaned = String(value || "")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || fallback;
};

const canonicalDirFor = (user) => {
  const username = safeSegment(user.username, "user");
  const userId = safeSegment(user.id, "unknown");
  return path.join(env.binStoragePath, `${username}_${userId}`);
};

const ensureClean = (paths) => {
  paths.forEach((target) => {
    fs.rmSync(target, { recursive: true, force: true });
  });
};

const writeEncryptedBin = (dir, tokenId, text) => {
  fs.mkdirSync(dir, { recursive: true });
  const payload = encryptBuffer(Buffer.from(text));
  fs.writeFileSync(path.join(dir, `${tokenId}.bin.enc`), payload, { mode: 0o600 });
};

const writePlainBin = (dir, tokenId, text) => {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${tokenId}.bin`), Buffer.from(text), { mode: 0o600 });
};

test("bin storage: migrates legacy userId directory into canonical directory", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = { id: `uid_${suffix}`, username: "alice" };
  const canonicalDir = canonicalDirFor(user);
  const legacyDir = path.join(env.binStoragePath, safeSegment(user.id, "unknown"));

  ensureClean([canonicalDir, legacyDir]);
  writeEncryptedBin(legacyDir, "token_migrate", "legacy-data");

  const buffer = readBinFile({ user, tokenId: "token_migrate" });
  assert.equal(buffer?.toString("utf8"), "legacy-data");
  assert.equal(fs.existsSync(path.join(canonicalDir, "token_migrate.bin.enc")), true);
  assert.equal(fs.existsSync(path.join(legacyDir, "token_migrate.bin.enc")), false);

  ensureClean([canonicalDir, legacyDir]);
});

test("bin storage: does not scan *_userId directory suffix anymore", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = { id: `uid_${suffix}`, username: "alice" };
  const canonicalDir = canonicalDirFor(user);
  const suspiciousDir = path.join(env.binStoragePath, `evil_${safeSegment(user.id, "unknown")}`);

  ensureClean([canonicalDir, suspiciousDir]);
  writeEncryptedBin(suspiciousDir, "token_scan", "should-not-be-read");

  const files = listBinFiles({ user });
  const buffer = readBinFile({ user, tokenId: "token_scan" });

  assert.equal(files.length, 0);
  assert.equal(buffer, null);
  assert.equal(fs.existsSync(path.join(canonicalDir, "token_scan.bin.enc")), false);

  ensureClean([canonicalDir, suspiciousDir]);
});

test("bin storage: migrates legacy plain .bin file into canonical encrypted file", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = { id: `uid_${suffix}`, username: "alice" };
  const canonicalDir = canonicalDirFor(user);
  const legacyDir = path.join(env.binStoragePath, safeSegment(user.id, "unknown"));

  ensureClean([canonicalDir, legacyDir]);
  writePlainBin(legacyDir, "token_plain_legacy", "plain-legacy-data");

  const buffer = readBinFile({ user, tokenId: "token_plain_legacy" });
  assert.equal(buffer?.toString("utf8"), "plain-legacy-data");
  assert.equal(fs.existsSync(path.join(canonicalDir, "token_plain_legacy.bin.enc")), true);
  assert.equal(fs.existsSync(path.join(legacyDir, "token_plain_legacy.bin")), false);

  ensureClean([canonicalDir, legacyDir]);
});

test("bin storage: migrates canonical plain .bin file into encrypted file", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = { id: `uid_${suffix}`, username: "alice" };
  const canonicalDir = canonicalDirFor(user);

  ensureClean([canonicalDir]);
  writePlainBin(canonicalDir, "token_plain_canonical", "plain-canonical-data");

  const files = listBinFiles({ user });
  const buffer = readBinFile({ user, tokenId: "token_plain_canonical" });

  assert.equal(buffer?.toString("utf8"), "plain-canonical-data");
  assert.equal(files.some((item) => item.tokenId === "token_plain_canonical"), true);
  assert.equal(fs.existsSync(path.join(canonicalDir, "token_plain_canonical.bin")), false);
  assert.equal(fs.existsSync(path.join(canonicalDir, "token_plain_canonical.bin.enc")), true);

  ensureClean([canonicalDir]);
});

test("bin storage: count triggers migration and counts canonical files only", () => {
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = { id: `uid_${suffix}`, username: "alice" };
  const canonicalDir = canonicalDirFor(user);
  const legacyDir = path.join(env.binStoragePath, safeSegment(user.id, "unknown"));

  ensureClean([canonicalDir, legacyDir]);
  writeEncryptedBin(legacyDir, "token_count_1", "count-1");
  writeEncryptedBin(legacyDir, "token_count_2", "count-2");

  const count = countBinFilesForUser({ user });

  assert.equal(count, 2);
  assert.equal(fs.existsSync(path.join(canonicalDir, "token_count_1.bin.enc")), true);
  assert.equal(fs.existsSync(path.join(canonicalDir, "token_count_2.bin.enc")), true);

  ensureClean([canonicalDir, legacyDir]);
});
