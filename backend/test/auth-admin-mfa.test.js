import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import authRoutes from "../src/routes/auth.js";
import { initDatabase } from "../src/db/database.js";
import { nowIso } from "../src/db/sql.js";
import { query, run } from "../src/db/client.js";
import { createPassword } from "../src/lib/crypto.js";
import { env } from "../src/config/env.js";
import { encryptMfaSecret, generateTotpCode } from "../src/services/mfaService.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createAppServer = async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);

  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const fetchActiveRefreshTokenRows = (userId) =>
  query(
    `SELECT id, created_at as createdAt, expires_at as expiresAt
     FROM refresh_tokens
     WHERE user_id = $userId AND revoked_at IS NULL
     ORDER BY created_at DESC`,
    { $userId: userId },
  );

test("admin login requires MFA challenge and verify succeeds with valid TOTP", async (t) => {
  await initDatabase();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `mfa_admin_${suffix}`;
  const username = `mfa_admin_${suffix}`;
  const password = "Admin1234!Aa";
  const ts = nowIso();
  const passwordMeta = createPassword(password);
  const secret = "JBSWY3DPEHPK3PXP";

  run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: userId });
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });

  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, is_admin,
      mfa_enabled, mfa_totp_secret_enc, mfa_recovery_codes_hash, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, 1,
      1, $mfaTotpSecretEnc, $mfaRecoveryCodesHash, $createdAt, $updatedAt
    )`,
    {
      $id: userId,
      $username: username,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $mfaTotpSecretEnc: encryptMfaSecret(secret),
      $mfaRecoveryCodesHash: "[]",
      $createdAt: ts,
      $updatedAt: ts,
    },
  );

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: userId });
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const baseUrl = makeBaseUrl(server);
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(loginResponse.status, 200);
  const loginPayload = await loginResponse.json();
  assert.equal(loginPayload?.success, true);
  assert.equal(loginPayload?.data?.mfaRequired, true);
  assert.ok(loginPayload?.data?.mfaChallengeToken, "expected mfa challenge token");

  const loginCookies = loginResponse.headers.getSetCookie();
  const hasRefreshCookie = loginCookies.some((line) => line.startsWith(`${env.refreshCookieName}=`));
  const hasAccessCookie = loginCookies.some((line) => line.startsWith(`${env.accessCookieName}=`));
  assert.equal(hasRefreshCookie, false);
  assert.equal(hasAccessCookie, false);

  const badVerify = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mfaChallengeToken: loginPayload.data.mfaChallengeToken,
      totpCode: "000000",
    }),
  });
  assert.equal(badVerify.status, 401);

  const totpCode = generateTotpCode({ secret });
  const verifyResponse = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mfaChallengeToken: loginPayload.data.mfaChallengeToken,
      totpCode,
    }),
  });
  assert.equal(verifyResponse.status, 200);
  const verifyPayload = await verifyResponse.json();
  assert.equal(verifyPayload?.success, true);
  assert.equal(verifyPayload?.data?.user?.id, userId);

  const verifyCookies = verifyResponse.headers.getSetCookie();
  const verifyHasRefreshCookie = verifyCookies.some((line) => line.startsWith(`${env.refreshCookieName}=`));
  const verifyHasAccessCookie = verifyCookies.some((line) => line.startsWith(`${env.accessCookieName}=`));
  assert.equal(verifyHasRefreshCookie, true);
  assert.equal(verifyHasAccessCookie, true);
});

test("admin MFA login should apply long refresh ttl when rememberMe=true", async (t) => {
  await initDatabase();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `mfa_admin_remember_${suffix}`;
  const username = `mfa_admin_remember_${suffix}`;
  const password = "Admin1234!Aa";
  const ts = nowIso();
  const passwordMeta = createPassword(password);
  const secret = "JBSWY3DPEHPK3PXP";

  run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: userId });
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });

  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, is_admin,
      mfa_enabled, mfa_totp_secret_enc, mfa_recovery_codes_hash, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, 1,
      1, $mfaTotpSecretEnc, $mfaRecoveryCodesHash, $createdAt, $updatedAt
    )`,
    {
      $id: userId,
      $username: username,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $mfaTotpSecretEnc: encryptMfaSecret(secret),
      $mfaRecoveryCodesHash: "[]",
      $createdAt: ts,
      $updatedAt: ts,
    },
  );

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: userId });
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const baseUrl = makeBaseUrl(server);
  const loginResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ username, password, rememberMe: true }),
  });
  assert.equal(loginResponse.status, 200);
  const loginPayload = await loginResponse.json();
  assert.equal(loginPayload?.success, true);
  assert.equal(loginPayload?.data?.mfaRequired, true);
  assert.ok(loginPayload?.data?.mfaChallengeToken, "expected mfa challenge token");

  const totpCode = generateTotpCode({ secret });
  const verifyResponse = await fetch(`${baseUrl}/api/v1/auth/mfa/verify`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      mfaChallengeToken: loginPayload.data.mfaChallengeToken,
      totpCode,
    }),
  });
  assert.equal(verifyResponse.status, 200);

  const rows = fetchActiveRefreshTokenRows(userId);
  assert.equal(rows.length, 1, "expected one active refresh token");
  const ttlMs = new Date(rows[0].expiresAt).getTime() - new Date(rows[0].createdAt).getTime();
  const expectedLongMs = env.refreshTokenLongTtlDays * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(ttlMs - expectedLongMs) <= 60 * 1000, "mfa login with rememberMe should use long ttl");
});
