import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import express from "express";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDatabase } from "../src/db/database.js";
import { query, run } from "../src/db/client.js";
import authRoutes from "../src/routes/auth.js";
import adminRoutes from "../src/routes/admin.js";
import { createUserRoutes } from "../src/app/userRoutes.js";
import {
  createPassword,
  signJwt,
  verifyPassword,
} from "../src/lib/crypto.js";
import { nowIso } from "../src/db/sql.js";
import { env } from "../src/config/env.js";
import { inviteCodeRepository } from "../src/repositories/inviteCodeRepository.js";
import { userRepository } from "../src/repositories/userRepository.js";
import {
  createMfaSetupPayload,
  encryptMfaSecret,
  generateTotpCode,
} from "../src/services/mfaService.js";

const thisFile = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(thisFile), "..");

const LEGACY_SCRYPT_VERSION = "scrypt-v1";
const LEGACY_SCRYPT_N = 1 << 14;
const LEGACY_SCRYPT_R = 8;
const LEGACY_SCRYPT_P = 1;
const LEGACY_SCRYPT_KEYLEN = 64;

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createServer = async (mountPath, router) => {
  const app = express();
  app.use(express.json());
  app.use(mountPath, router);

  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const insertUser = ({
  id,
  username,
  passwordSalt,
  passwordHash,
  isAdmin = false,
}) => {
  const ts = nowIso();
  run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: id });
  run(`DELETE FROM password_reset_codes WHERE user_id = $id`, { $id: id });
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: id,
    $username: username,
  });
  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, is_admin, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, $isAdmin, $createdAt, $updatedAt
    )`,
    {
      $id: id,
      $username: username,
      $salt: passwordSalt,
      $hash: passwordHash,
      $isAdmin: isAdmin ? 1 : 0,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
};

const insertInviteCode = ({
  id,
  code,
  createdBy,
}) => {
  run(`DELETE FROM invite_codes WHERE id = $id OR code = $code`, {
    $id: id,
    $code: code,
  });
  inviteCodeRepository.create({
    id,
    code,
    createdBy,
    createdAt: nowIso(),
  });
};

const authHeaders = ({ userId, username }) => {
  return {
    authorization: `Bearer ${signJwt({ sub: userId, username, ver: 0 }, 10 * 60)}`,
    "content-type": "application/json",
  };
};

const getStoredPasswordRow = (id) =>
  query(
    `SELECT password_salt as passwordSalt, password_hash as passwordHash
     FROM users WHERE id = $id`,
    { $id: id },
  )[0] || null;

const createLegacySha256Password = (plainPassword) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .createHash("sha256")
    .update(`${salt}:${plainPassword}`)
    .digest("hex");
  return { salt, hash };
};

const createLegacyScryptPassword = (plainPassword) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(
    plainPassword,
    salt,
    LEGACY_SCRYPT_KEYLEN,
    {
      N: LEGACY_SCRYPT_N,
      r: LEGACY_SCRYPT_R,
      p: LEGACY_SCRYPT_P,
      maxmem: 128 * 1024 * 1024,
    },
  );
  return {
    salt,
    hash: [
      LEGACY_SCRYPT_VERSION,
      LEGACY_SCRYPT_N,
      LEGACY_SCRYPT_R,
      LEGACY_SCRYPT_P,
      LEGACY_SCRYPT_KEYLEN,
      derived.toString("hex"),
    ].join("$"),
  };
};

const fetchAdminConfirmToken = async ({ baseUrl, adminUser }) => {
  const response = await fetch(`${baseUrl}/api/v1/admin/confirm-password`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({
      totpCode: generateTotpCode({ secret: adminUser.mfaSecret }),
    }),
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  return String(payload?.data?.token || "");
};

const enableAdminMfa = ({ userId, username }) => {
  const setup = createMfaSetupPayload({ username });
  run(
    `UPDATE users
     SET mfa_enabled = 1,
         mfa_totp_secret_enc = $secretEnc,
         mfa_recovery_codes_hash = $recoveryHash,
         updated_at = $updatedAt
     WHERE id = $id`,
    {
      $id: userId,
      $secretEnc: encryptMfaSecret(setup.secret),
      $recoveryHash: JSON.stringify(setup.recoveryCodeHashes),
      $updatedAt: nowIso(),
    },
  );
  return setup.secret;
};

test("createPassword uses argon2id-v1 and verifyPassword accepts the generated hash", () => {
  const meta = createPassword("Argon1234!Aa");

  assert.match(meta.hash, /^argon2id-v1\$/);
  assert.ok(verifyPassword("Argon1234!Aa", meta.salt, meta.hash));
});

test("POST /auth/login upgrades legacy sha256 password hash to argon2id-v1", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = {
    id: `legacy_sha_user_${suffix}`,
    username: `legacy_sha_${suffix}`,
    password: "Legacy1234!Aa",
  };
  const legacyPassword = createLegacySha256Password(user.password);
  insertUser({
    id: user.id,
    username: user.username,
    passwordSalt: legacyPassword.salt,
    passwordHash: legacyPassword.hash,
  });

  const server = await createServer("/api/v1/auth", authRoutes);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: user.id });
    run(`DELETE FROM users WHERE id = $id`, { $id: user.id });
  });

  const response = await fetch(`${makeBaseUrl(server)}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: user.username,
      password: user.password,
    }),
  });
  assert.equal(response.status, 200);

  const stored = getStoredPasswordRow(user.id);
  assert.match(String(stored?.passwordHash || ""), /^argon2id-v1\$/);
  assert.ok(verifyPassword(user.password, stored.passwordSalt, stored.passwordHash));
});

test("POST /auth/login upgrades legacy scrypt-v1 password hash to argon2id-v1", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = {
    id: `legacy_scrypt_user_${suffix}`,
    username: `legacy_scrypt_${suffix}`,
    password: "LegacyScrypt1234!Aa",
  };
  const legacyPassword = createLegacyScryptPassword(user.password);
  insertUser({
    id: user.id,
    username: user.username,
    passwordSalt: legacyPassword.salt,
    passwordHash: legacyPassword.hash,
  });

  const server = await createServer("/api/v1/auth", authRoutes);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: user.id });
    run(`DELETE FROM users WHERE id = $id`, { $id: user.id });
  });

  const response = await fetch(`${makeBaseUrl(server)}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: user.username,
      password: user.password,
    }),
  });
  assert.equal(response.status, 200);

  const stored = getStoredPasswordRow(user.id);
  assert.match(String(stored?.passwordHash || ""), /^argon2id-v1\$/);
  assert.ok(verifyPassword(user.password, stored.passwordSalt, stored.passwordHash));
});

test("POST /auth/register writes argon2id-v1 password hashes for new users", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const creator = {
    id: `invite_creator_${suffix}`,
    username: `invite_creator_${suffix}`,
    password: "Creator1234!Aa",
  };
  const creatorMeta = createPassword(creator.password);
  insertUser({
    id: creator.id,
    username: creator.username,
    passwordSalt: creatorMeta.salt,
    passwordHash: creatorMeta.hash,
    isAdmin: true,
  });
  const inviteCode = `INV${suffix.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toUpperCase()}`;
  insertInviteCode({
    id: `invite_code_${suffix}`,
    code: inviteCode,
    createdBy: creator.id,
  });

  const server = await createServer("/api/v1/auth", authRoutes);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM invite_codes WHERE created_by = $creatorId`, {
      $creatorId: creator.id,
    });
    run(`DELETE FROM users WHERE username IN ($creatorUsername, $newUsername)`, {
      $creatorUsername: creator.username,
      $newUsername: `register_user_${suffix}`,
    });
  });

  const response = await fetch(`${makeBaseUrl(server)}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: `register_user_${suffix}`,
      password: "Register1234!Aa",
      inviteCode,
    }),
  });
  assert.equal(response.status, 200);

  const userRow = query(
    `SELECT id, password_hash as passwordHash
     FROM users WHERE username = $username`,
    { $username: `register_user_${suffix}` },
  )[0];
  assert.ok(userRow, "expected registered user");
  assert.match(String(userRow.passwordHash || ""), /^argon2id-v1\$/);
});

test("POST /auth/password-reset writes argon2id-v1 password hashes", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = {
    id: `reset_user_${suffix}`,
    username: `reset_user_${suffix}`,
    password: "ResetOld1234!Aa",
  };
  const currentMeta = createPassword(user.password);
  insertUser({
    id: user.id,
    username: user.username,
    passwordSalt: currentMeta.salt,
    passwordHash: currentMeta.hash,
  });
  userRepository.createPasswordResetCode({
    id: `reset_code_${suffix}`,
    userId: user.id,
    code: "RSTT1234",
    createdBy: user.id,
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    createdAt: nowIso(),
  });

  const server = await createServer("/api/v1/auth", authRoutes);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM password_reset_codes WHERE user_id = $id`, { $id: user.id });
    run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: user.id });
    run(`DELETE FROM users WHERE id = $id`, { $id: user.id });
  });

  const response = await fetch(`${makeBaseUrl(server)}/api/v1/auth/password-reset`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      identity: user.username,
      shortCode: "RSTT1234",
      newPassword: "ResetNew1234!Aa",
    }),
  });
  assert.equal(response.status, 200);

  const stored = getStoredPasswordRow(user.id);
  assert.match(String(stored?.passwordHash || ""), /^argon2id-v1\$/);
  assert.ok(verifyPassword("ResetNew1234!Aa", stored.passwordSalt, stored.passwordHash));
});

test("PUT /user/password writes argon2id-v1 password hashes", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const user = {
    id: `user_pwd_${suffix}`,
    username: `user_pwd_${suffix}`,
    currentPassword: "UserCurrent1234!Aa",
    nextPassword: "UserNext1234!Aa",
  };
  const currentMeta = createPassword(user.currentPassword);
  insertUser({
    id: user.id,
    username: user.username,
    passwordSalt: currentMeta.salt,
    passwordHash: currentMeta.hash,
  });

  const server = await createServer("/api/v1/user", createUserRoutes());
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: user.id });
    run(`DELETE FROM users WHERE id = $id`, { $id: user.id });
  });

  const response = await fetch(`${makeBaseUrl(server)}/api/v1/user/password`, {
    method: "PUT",
    headers: authHeaders({ userId: user.id, username: user.username }),
    body: JSON.stringify({
      currentPassword: user.currentPassword,
      newPassword: user.nextPassword,
    }),
  });
  assert.equal(response.status, 200);

  const stored = getStoredPasswordRow(user.id);
  assert.match(String(stored?.passwordHash || ""), /^argon2id-v1\$/);
  assert.ok(verifyPassword(user.nextPassword, stored.passwordSalt, stored.passwordHash));
});

test("PATCH /admin/users/:id/password writes argon2id-v1 password hashes", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = {
    id: `admin_pwd_${suffix}`,
    username: `admin_pwd_${suffix}`,
    password: "AdminCurrent1234!Aa",
  };
  const targetUser = {
    id: `admin_target_${suffix}`,
    username: `admin_target_${suffix}`,
    password: "TargetCurrent1234!Aa",
  };
  const adminMeta = createPassword(adminUser.password);
  const targetMeta = createPassword(targetUser.password);
  insertUser({
    id: adminUser.id,
    username: adminUser.username,
    passwordSalt: adminMeta.salt,
    passwordHash: adminMeta.hash,
    isAdmin: true,
  });
  adminUser.mfaSecret = enableAdminMfa({
    userId: adminUser.id,
    username: adminUser.username,
  });
  insertUser({
    id: targetUser.id,
    username: targetUser.username,
    passwordSalt: targetMeta.salt,
    passwordHash: targetMeta.hash,
  });

  const server = await createServer("/api/v1/admin", adminRoutes);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM refresh_tokens WHERE user_id IN ($adminId, $targetId)`, {
      $adminId: adminUser.id,
      $targetId: targetUser.id,
    });
    run(`DELETE FROM users WHERE id IN ($adminId, $targetId)`, {
      $adminId: adminUser.id,
      $targetId: targetUser.id,
    });
  });

  const baseUrl = makeBaseUrl(server);
  const confirmToken = await fetchAdminConfirmToken({
    baseUrl,
    adminUser,
  });

  const response = await fetch(`${baseUrl}/api/v1/admin/users/${targetUser.id}/password`, {
    method: "PATCH",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": confirmToken,
    },
    body: JSON.stringify({
      password: "AdminReset1234!Aa",
    }),
  });
  assert.equal(response.status, 200);

  const stored = getStoredPasswordRow(targetUser.id);
  assert.match(String(stored?.passwordHash || ""), /^argon2id-v1\$/);
  assert.ok(verifyPassword("AdminReset1234!Aa", stored.passwordSalt, stored.passwordHash));
});

test("init-admin script writes argon2id-v1 password hashes", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const username = `init_admin_${suffix}`;
  const email = `${username}@example.com`;

  t.after(() => {
    run(`DELETE FROM users WHERE username = $username`, { $username: username });
  });

  const result = spawnSync("node", ["src/scripts/initAdmin.js"], {
    cwd: backendRoot,
    env: {
      ...process.env,
      ADMIN_USERNAME: username,
      ADMIN_EMAIL: email,
      ADMIN_PASSWORD: "InitAdmin1234!Aa",
      DB_PATH: env.dbPath,
      BIN_STORAGE_PATH: env.binStoragePath,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  const userRow = query(
    `SELECT password_hash as passwordHash
     FROM users WHERE username = $username`,
    { $username: username },
  )[0];
  assert.ok(userRow, "expected admin user created by init-admin script");
  assert.match(String(userRow.passwordHash || ""), /^argon2id-v1\$/);
});
