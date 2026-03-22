import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { initDatabase } from "../src/db/database.js";
import { query, run } from "../src/db/client.js";
import authRoutes from "../src/routes/auth.js";
import { createPassword } from "../src/lib/crypto.js";
import { nowIso } from "../src/db/sql.js";
import { env } from "../src/config/env.js";

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

test("POST /auth/login should issue refresh cookie and persist refresh token record", async (t) => {
  await initDatabase();

  const username = `cookie_user_${Date.now()}`;
  const password = "Test1234!Aa";
  const userId = `test_user_${Date.now()}`;
  const ts = nowIso();
  const passwordMeta = createPassword(password);

  run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
  run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  run(`DELETE FROM users WHERE username = $username`, { $username: username });

  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, $createdAt, $updatedAt
    )`,
    {
      $id: userId,
      $username: username,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
    run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  });

  const response = await fetch(`${makeBaseUrl(server)}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "user-agent": "node-test",
    },
    body: JSON.stringify({ username, password }),
  });

  assert.equal(response.status, 200);

  const setCookieValues = response.headers.getSetCookie();
  assert.ok(setCookieValues.length > 0, "expected Set-Cookie header");
  const refreshCookie = setCookieValues.find((line) => line.startsWith(`${env.refreshCookieName}=`));
  assert.ok(refreshCookie, `expected ${env.refreshCookieName} cookie`);
  assert.ok(refreshCookie.includes("HttpOnly"), "refresh cookie should be HttpOnly");
  assert.ok(refreshCookie.includes(`Path=${env.refreshCookiePath}`), "refresh cookie path should match env");
  if (env.refreshCookieDomain) {
    assert.ok(refreshCookie.includes(`Domain=${env.refreshCookieDomain}`), "refresh cookie domain should match env");
  }
  const accessCookie = setCookieValues.find((line) => line.startsWith(`${env.accessCookieName}=`));
  assert.ok(accessCookie, `expected ${env.accessCookieName} cookie`);
  assert.ok(accessCookie.includes("HttpOnly"), "access cookie should be HttpOnly");
  assert.ok(accessCookie.includes(`Path=${env.accessCookiePath}`), "access cookie path should match env");
  if (env.accessCookieDomain) {
    assert.ok(accessCookie.includes(`Domain=${env.accessCookieDomain}`), "access cookie domain should match env");
  }

  const payload = await response.json();
  assert.equal(payload?.success, true);
  if (env.accessTokenExposeInBody) {
    assert.ok(payload?.data?.token, "access token should exist when ACCESS_TOKEN_EXPOSE_IN_BODY=true");
  } else {
    assert.equal(payload?.data?.token, undefined, "access token should not be exposed in body by default");
  }

  const rows = query(
    `SELECT id FROM refresh_tokens WHERE user_id = $userId AND revoked_at IS NULL`,
    { $userId: userId },
  );
  assert.equal(rows.length, 1, "refresh token record should be persisted");
});

test("POST /auth/login should set Secure cookie flags for HTTPS-forwarded requests", async (t) => {
  await initDatabase();

  const username = `cookie_https_user_${Date.now()}`;
  const password = "Test1234!Aa";
  const userId = `test_https_user_${Date.now()}`;
  const ts = nowIso();
  const passwordMeta = createPassword(password);

  run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
  run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  run(`DELETE FROM users WHERE username = $username`, { $username: username });

  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, $createdAt, $updatedAt
    )`,
    {
      $id: userId,
      $username: username,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
    run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  });

  const response = await fetch(`${makeBaseUrl(server)}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-proto": "https",
      "user-agent": "node-test",
    },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(response.status, 200);

  const setCookieValues = response.headers.getSetCookie();
  const refreshCookie = setCookieValues.find((line) => line.startsWith(`${env.refreshCookieName}=`));
  const accessCookie = setCookieValues.find((line) => line.startsWith(`${env.accessCookieName}=`));
  assert.ok(refreshCookie, `expected ${env.refreshCookieName} cookie`);
  assert.ok(accessCookie, `expected ${env.accessCookieName} cookie`);
  assert.ok(refreshCookie.includes("Secure"), "refresh cookie should be Secure for https forwarded requests");
  assert.ok(accessCookie.includes("Secure"), "access cookie should be Secure for https forwarded requests");
});

test("POST /auth/login should apply short/long refresh ttl based on rememberMe", async (t) => {
  await initDatabase();

  const username = `cookie_ttl_user_${Date.now()}`;
  const password = "Test1234!Aa";
  const userId = `test_ttl_user_${Date.now()}`;
  const ts = nowIso();
  const passwordMeta = createPassword(password);

  run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
  run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  run(`DELETE FROM users WHERE username = $username`, { $username: username });

  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, $createdAt, $updatedAt
    )`,
    {
      $id: userId,
      $username: username,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
    run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  });

  const baseUrl = makeBaseUrl(server);
  const shortLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, rememberMe: false }),
  });
  assert.equal(shortLogin.status, 200);
  const shortRows = fetchActiveRefreshTokenRows(userId);
  assert.equal(shortRows.length, 1);

  const shortTtlMs = new Date(shortRows[0].expiresAt).getTime() - new Date(shortRows[0].createdAt).getTime();
  const expectedShortMs = env.refreshTokenShortTtlDays * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(shortTtlMs - expectedShortMs) <= 60 * 1000, "short ttl should match env config");

  run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });

  const longLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password, rememberMe: true }),
  });
  assert.equal(longLogin.status, 200);
  const longRows = fetchActiveRefreshTokenRows(userId);
  assert.equal(longRows.length, 1);

  const longTtlMs = new Date(longRows[0].expiresAt).getTime() - new Date(longRows[0].createdAt).getTime();
  const expectedLongMs = env.refreshTokenLongTtlDays * 24 * 60 * 60 * 1000;
  assert.ok(Math.abs(longTtlMs - expectedLongMs) <= 60 * 1000, "long ttl should match env config");
});
