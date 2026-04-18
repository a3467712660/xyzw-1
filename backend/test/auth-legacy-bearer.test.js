import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import http from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import { initDatabase } from "../src/db/database.js";
import { run } from "../src/db/client.js";
import authRoutes from "../src/routes/auth.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
import { nowIso } from "../src/db/sql.js";
import { attachWsHub } from "../src/services/wsHub.js";
import { env } from "../src/config/env.js";

const createRuntime = async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server, path: "/ws" });
  attachWsHub(wss);

  await new Promise((resolve, reject) => {
    const next = server.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    wsUrl: `ws://127.0.0.1:${address.port}/ws`,
    close: async () => {
      await new Promise((resolve) => wss.close(() => resolve()));
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
};

const toCookieHeader = (setCookieValues = []) =>
  setCookieValues
    .map((line) => String(line || "").split(";")[0])
    .filter(Boolean)
    .join("; ");

const seedUser = ({ userId, username, password, tokenVersion = 0 }) => {
  const passwordMeta = createPassword(password);
  const ts = nowIso();

  run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
  run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  run(`DELETE FROM users WHERE username = $username`, { $username: username });

  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, $tokenVersion, $createdAt, $updatedAt
    )`,
    {
      $id: userId,
      $username: username,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $tokenVersion: tokenVersion,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
};

const connectWsWithHeaders = ({ url, headers = {} }) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.once("message", (raw) => {
      const payload = JSON.parse(String(raw || "{}"));
      if (payload?.type !== "connected") {
        reject(new Error("unexpected ws payload"));
        return;
      }
      resolve({ ws, payload });
    });
    ws.once("error", reject);
  });

const connectWsAndWaitForOpen = ({ url, headers = {} }) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    ws.once("open", () => resolve(ws));
    ws.once("error", reject);
  });

const waitForWsClose = (ws) =>
  new Promise((resolve) => {
    ws.once("close", (code, reasonBuffer) => {
      resolve({
        code,
        reason: String(reasonBuffer || ""),
      });
    });
  });

test("cookie-only login session can access protected auth route without Authorization header", async (t) => {
  await initDatabase();

  const userId = `cookie_only_user_${Date.now()}`;
  const username = `cookie_only_${Date.now()}`;
  const password = "Test1234!Aa";
  seedUser({ userId, username, password });

  const runtime = await createRuntime();
  t.after(async () => {
    await runtime.close();
    run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const loginResponse = await fetch(`${runtime.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(loginResponse.status, 200);

  const cookieHeader = toCookieHeader(loginResponse.headers.getSetCookie());
  assert.ok(cookieHeader.includes(`${env.accessCookieName}=`));

  const profileResponse = await fetch(`${runtime.baseUrl}/api/v1/auth/me`, {
    headers: {
      cookie: cookieHeader,
    },
  });
  assert.equal(profileResponse.status, 200);
  const payload = await profileResponse.json();
  assert.equal(payload?.success, true);
  assert.equal(payload?.data?.id, userId);
});

test("legacy bearer is rejected when ALLOW_BEARER_AUTH_LEGACY is disabled and warning does not leak token", { concurrency: false }, async (t) => {
  await initDatabase();

  const originalAllowLegacy = env.allowBearerAuthLegacy;
  env.allowBearerAuthLegacy = false;

  const userId = `bearer_disabled_user_${Date.now()}`;
  const username = `bearer_disabled_${Date.now()}`;
  seedUser({
    userId,
    username,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });
  const token = signJwt({ sub: userId, username, ver: 0 }, 300);
  const originalWarn = console.warn;
  const warnCalls = [];
  console.warn = (...args) => {
    warnCalls.push(args.map((item) => String(item || "")));
  };

  const runtime = await createRuntime();
  t.after(async () => {
    env.allowBearerAuthLegacy = originalAllowLegacy;
    console.warn = originalWarn;
    await runtime.close();
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const response = await fetch(`${runtime.baseUrl}/api/v1/auth/me`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 401);
  const payload = await response.json();
  assert.equal(payload?.success, false);
  assert.equal(payload?.error?.code, "AUTH_INVALID_TOKEN");

  const warnText = warnCalls.flat().join("\n");
  assert.match(warnText, /legacy bearer/i);
  assert.doesNotMatch(warnText, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("legacy bearer is allowed with warning and warning does not leak token", { concurrency: false }, async (t) => {
  await initDatabase();

  const originalAllowLegacy = env.allowBearerAuthLegacy;
  env.allowBearerAuthLegacy = true;

  const userId = `bearer_allowed_user_${Date.now()}`;
  const username = `bearer_allowed_${Date.now()}`;
  seedUser({
    userId,
    username,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });
  const token = signJwt({ sub: userId, username, ver: 0 }, 300);
  const originalWarn = console.warn;
  const warnCalls = [];
  console.warn = (...args) => {
    warnCalls.push(args.map((item) => String(item || "")));
  };

  const runtime = await createRuntime();
  t.after(async () => {
    env.allowBearerAuthLegacy = originalAllowLegacy;
    console.warn = originalWarn;
    await runtime.close();
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const response = await fetch(`${runtime.baseUrl}/api/v1/auth/me`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload?.success, true);
  assert.equal(payload?.data?.id, userId);

  const warnText = warnCalls.flat().join("\n");
  assert.match(warnText, /legacy bearer/i);
  assert.match(warnText, /allowed/i);
  assert.doesNotMatch(warnText, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("ws handshake can authenticate with cookie only", async (t) => {
  await initDatabase();

  const userId = `ws_cookie_user_${Date.now()}`;
  const username = `ws_cookie_${Date.now()}`;
  const password = "Test1234!Aa";
  seedUser({ userId, username, password });

  const runtime = await createRuntime();
  t.after(async () => {
    await runtime.close();
    run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const loginResponse = await fetch(`${runtime.baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(loginResponse.status, 200);

  const cookieHeader = toCookieHeader(loginResponse.headers.getSetCookie());
  const { ws } = await connectWsWithHeaders({
    url: runtime.wsUrl,
    headers: {
      cookie: cookieHeader,
    },
  });
  ws.close();
});

test("ws legacy auth frame is rejected when ALLOW_BEARER_AUTH_LEGACY is disabled", { concurrency: false }, async (t) => {
  await initDatabase();

  const originalAllowLegacy = env.allowBearerAuthLegacy;
  env.allowBearerAuthLegacy = false;

  const userId = `ws_legacy_frame_user_${Date.now()}`;
  const username = `ws_legacy_frame_${Date.now()}`;
  seedUser({
    userId,
    username,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });
  const token = signJwt({ sub: userId, username, ver: 0 }, 300);

  const runtime = await createRuntime();
  t.after(async () => {
    env.allowBearerAuthLegacy = originalAllowLegacy;
    await runtime.close();
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const ws = await connectWsAndWaitForOpen({ url: runtime.wsUrl });
  const closePromise = waitForWsClose(ws);
  ws.send(JSON.stringify({
    type: "auth",
    token,
  }));

  const closed = await closePromise;
  assert.equal(closed.code, 1008);
  assert.equal(closed.reason, "Invalid token");
});
