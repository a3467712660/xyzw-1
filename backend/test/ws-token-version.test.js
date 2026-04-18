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
import { registerWs } from "../src/app/registerWs.js";
import { env } from "../src/config/env.js";

const createServer = async () => {
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

  const baseUrl = `http://127.0.0.1:${address.port}`;
  const wsUrl = `ws://127.0.0.1:${address.port}/ws`;

  return {
    baseUrl,
    wsUrl,
    close: async () => {
      await new Promise((resolve) => wss.close(() => resolve()));
      await new Promise((resolve) => server.close(() => resolve()));
    },
  };
};

const seedUser = ({ userId, username, password, tokenVersion }) => {
  const passwordMeta = createPassword(password);
  const ts = nowIso();
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

const connectWs = (url, token) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    ws.once("message", (raw) => {
      const payload = JSON.parse(String(raw || "{}"));
      if (payload?.type !== "connected") {
        reject(new Error("unexpected ws payload"));
        return;
      }
      resolve(ws);
    });
    ws.once("error", reject);
  });

const waitWsClose = (ws) =>
  new Promise((resolve) => {
    ws.once("close", (code, reasonBuffer) => {
      resolve({
        code,
        reason: String(reasonBuffer || ""),
      });
    });
  });

const connectAndWaitClose = (url, token) =>
  new Promise((resolve) => {
    const ws = new WebSocket(url, {
      headers: { authorization: `Bearer ${token}` },
    });
    ws.once("close", (code, reasonBuffer) => {
      resolve({
        code,
        reason: String(reasonBuffer || ""),
      });
    });
  });

const connectExpectUnexpectedResponse = ({ url, token, origin, headers = {} }) =>
  new Promise((resolve, reject) => {
    const nextHeaders = { ...headers };
    if (token) {
      nextHeaders.authorization = `Bearer ${token}`;
    }
    const options = {
      headers: nextHeaders,
      ...(origin ? { origin } : {}),
    };
    const ws = new WebSocket(url, options);

    ws.once("unexpected-response", async (_req, res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: Number(res.statusCode || 0),
          body: String(body || ""),
        });
      });
    });
    ws.once("error", reject);
    ws.once("open", () => reject(new Error("websocket should be rejected by origin policy")));
  });

const connectExpectConnected = ({ url, token, origin, headers = {} }) =>
  new Promise((resolve, reject) => {
    const nextHeaders = { ...headers };
    if (token) {
      nextHeaders.authorization = `Bearer ${token}`;
    }
    const options = {
      headers: nextHeaders,
      ...(origin ? { origin } : {}),
    };
    const ws = new WebSocket(url, options);
    ws.once("message", (raw) => {
      try {
        const payload = JSON.parse(String(raw || "{}"));
        if (payload?.type !== "connected") {
          reject(new Error("unexpected ws payload"));
          return;
        }
        ws.close();
        resolve(payload);
      } catch (error) {
        reject(error);
      }
    });
    ws.once("error", reject);
    ws.once("unexpected-response", (_req, res) => {
      reject(new Error(`unexpected response: ${String(res?.statusCode || "")}`));
    });
  });

const toCookieHeader = (entries = []) =>
  entries
    .map((entry) => String(entry || "").split(";")[0])
    .filter(Boolean)
    .join("; ");

test("logout-all revokes tokenVersion for both HTTP and WS", async (t) => {
  await initDatabase();

  const userId = `ws_logout_all_user_${Date.now()}`;
  const username = `ws_logout_all_${Date.now()}`;
  seedUser({
    userId,
    username,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });

  const token = signJwt({ sub: userId, username, ver: 0 }, 300);
  const runtime = await createServer();
  t.after(async () => {
    await runtime.close();
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const ws = await connectWs(runtime.wsUrl, token);
  const wsClosePromise = waitWsClose(ws);

  const response = await fetch(`${runtime.baseUrl}/api/v1/auth/logout-all`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json();
  assert.equal(response.status, 200);
  assert.equal(payload?.success, true);

  const closed = await wsClosePromise;
  assert.equal(closed.code, 1008);
  assert.equal(closed.reason, "Session revoked");

  const reconnect = await connectAndWaitClose(runtime.wsUrl, token);
  assert.equal(reconnect.code, 1008);
  assert.equal(reconnect.reason, "Token revoked");

  const profileResponse = await fetch(`${runtime.baseUrl}/api/v1/auth/user`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  });
  const profilePayload = await profileResponse.json();
  assert.equal(profileResponse.status, 401);
  assert.equal(profilePayload?.success, false);
  assert.equal(profilePayload?.error?.code, "AUTH_TOKEN_REVOKED");
});

test("ws rejects non-whitelisted Origin during handshake", async (t) => {
  await initDatabase();

  const userId = `ws_origin_guard_user_${Date.now()}`;
  const username = `ws_origin_guard_${Date.now()}`;
  seedUser({
    userId,
    username,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });

  const token = signJwt({ sub: userId, username, ver: 0 }, 300);

  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);

  const server = http.createServer(app);
  registerWs(server, new Set(["https://allowed.example.com"]));
  await new Promise((resolve, reject) => {
    const next = server.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }

  const result = await connectExpectUnexpectedResponse({
    url: `ws://127.0.0.1:${address.port}/ws`,
    token,
    origin: "https://evil.example.com",
  });

  assert.equal(result.statusCode, 403);
  assert.match(result.body, /WS origin not allowed/);
});

test("ws accepts 127.0.0.1 when whitelist contains localhost with same port", async (t) => {
  await initDatabase();

  const userId = `ws_origin_loopback_user_${Date.now()}`;
  const username = `ws_origin_loopback_${Date.now()}`;
  seedUser({
    userId,
    username,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });

  const token = signJwt({ sub: userId, username, ver: 0 }, 300);

  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);

  const server = http.createServer(app);
  registerWs(server, new Set(["http://localhost:3000"]));
  await new Promise((resolve, reject) => {
    const next = server.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }

  await connectExpectConnected({
    url: `ws://127.0.0.1:${address.port}/ws`,
    token,
    origin: "http://127.0.0.1:3000",
  });
});

test("ws accepts non-browser client without Origin when access cookie is present", async (t) => {
  await initDatabase();

  const userId = `ws_cookie_no_origin_user_${Date.now()}`;
  const username = `ws_cookie_no_origin_${Date.now()}`;
  const password = "Test1234!Aa";
  seedUser({
    userId,
    username,
    password,
    tokenVersion: 0,
  });

  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);

  const server = http.createServer(app);
  registerWs(server, new Set(["https://allowed.example.com"]));
  await new Promise((resolve, reject) => {
    const next = server.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
    run(`DELETE FROM refresh_tokens WHERE user_id = $userId`, { $userId: userId });
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }

  const loginResponse = await fetch(`http://127.0.0.1:${address.port}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(loginResponse.status, 200);

  const cookieHeader = toCookieHeader(loginResponse.headers.getSetCookie());
  assert.match(cookieHeader, new RegExp(`${env.accessCookieName}=`));

  const payload = await connectExpectConnected({
    url: `ws://127.0.0.1:${address.port}/ws`,
    headers: {
      cookie: cookieHeader,
    },
  });

  assert.equal(payload?.type, "connected");
});

test("ws rejects non-browser client without Origin when only Authorization bearer is present", async (t) => {
  await initDatabase();

  const userId = `ws_bearer_no_origin_user_${Date.now()}`;
  const username = `ws_bearer_no_origin_${Date.now()}`;
  seedUser({
    userId,
    username,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });

  const token = signJwt({ sub: userId, username, ver: 0 }, 300);

  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);

  const server = http.createServer(app);
  registerWs(server, new Set(["https://allowed.example.com"]));
  await new Promise((resolve, reject) => {
    const next = server.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(() => resolve()));
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }

  const result = await connectExpectUnexpectedResponse({
    url: `ws://127.0.0.1:${address.port}/ws`,
    token,
  });

  assert.equal(result.statusCode, 403);
  assert.match(result.body, /WS origin not allowed|WS authentication requires access cookie/i);
});

test("ws enforces global connection limit", async (t) => {
  await initDatabase();
  const prevGlobal = env.wsMaxGlobalConnections;
  const prevPerIp = env.wsMaxConnectionsPerIp;
  const prevPerUser = env.wsMaxConnectionsPerUser;
  env.wsMaxGlobalConnections = 1;
  env.wsMaxConnectionsPerIp = 10;
  env.wsMaxConnectionsPerUser = 10;
  t.after(() => {
    env.wsMaxGlobalConnections = prevGlobal;
    env.wsMaxConnectionsPerIp = prevPerIp;
    env.wsMaxConnectionsPerUser = prevPerUser;
  });

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userIdA = `ws_limit_global_a_${suffix}`;
  const userIdB = `ws_limit_global_b_${suffix}`;
  seedUser({
    userId: userIdA,
    username: `ws_limit_global_a_${suffix}`,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });
  seedUser({
    userId: userIdB,
    username: `ws_limit_global_b_${suffix}`,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });

  const tokenA = signJwt({ sub: userIdA, username: `ws_limit_global_a_${suffix}`, ver: 0 }, 300);
  const tokenB = signJwt({ sub: userIdB, username: `ws_limit_global_b_${suffix}`, ver: 0 }, 300);

  const runtime = await createServer();
  let openWs = null;
  t.after(async () => {
    if (openWs?.readyState === openWs.OPEN) {
      const closePromise = waitWsClose(openWs);
      openWs.close();
      await closePromise;
    }
    await runtime.close();
    run(`DELETE FROM users WHERE id IN ($idA, $idB)`, { $idA: userIdA, $idB: userIdB });
  });

  openWs = await connectWs(runtime.wsUrl, tokenA);

  const rejected = await connectAndWaitClose(runtime.wsUrl, tokenB);
  assert.equal(rejected.code, 1013);
  assert.equal(rejected.reason, "Connection limit exceeded");
});

test("ws enforces per-IP connection limit", async (t) => {
  await initDatabase();
  const prevGlobal = env.wsMaxGlobalConnections;
  const prevPerIp = env.wsMaxConnectionsPerIp;
  const prevPerUser = env.wsMaxConnectionsPerUser;
  env.wsMaxGlobalConnections = 10;
  env.wsMaxConnectionsPerIp = 1;
  env.wsMaxConnectionsPerUser = 10;
  t.after(() => {
    env.wsMaxGlobalConnections = prevGlobal;
    env.wsMaxConnectionsPerIp = prevPerIp;
    env.wsMaxConnectionsPerUser = prevPerUser;
  });

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userIdA = `ws_limit_ip_a_${suffix}`;
  const userIdB = `ws_limit_ip_b_${suffix}`;
  seedUser({
    userId: userIdA,
    username: `ws_limit_ip_a_${suffix}`,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });
  seedUser({
    userId: userIdB,
    username: `ws_limit_ip_b_${suffix}`,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });

  const tokenA = signJwt({ sub: userIdA, username: `ws_limit_ip_a_${suffix}`, ver: 0 }, 300);
  const tokenB = signJwt({ sub: userIdB, username: `ws_limit_ip_b_${suffix}`, ver: 0 }, 300);

  const runtime = await createServer();
  let openWs = null;
  t.after(async () => {
    if (openWs?.readyState === openWs.OPEN) {
      const closePromise = waitWsClose(openWs);
      openWs.close();
      await closePromise;
    }
    await runtime.close();
    run(`DELETE FROM users WHERE id IN ($idA, $idB)`, { $idA: userIdA, $idB: userIdB });
  });

  openWs = await connectWs(runtime.wsUrl, tokenA);

  const rejected = await connectAndWaitClose(runtime.wsUrl, tokenB);
  assert.equal(rejected.code, 1013);
  assert.equal(rejected.reason, "Connection limit exceeded");
});

test("ws enforces per-user connection limit", async (t) => {
  await initDatabase();
  const prevGlobal = env.wsMaxGlobalConnections;
  const prevPerIp = env.wsMaxConnectionsPerIp;
  const prevPerUser = env.wsMaxConnectionsPerUser;
  env.wsMaxGlobalConnections = 10;
  env.wsMaxConnectionsPerIp = 10;
  env.wsMaxConnectionsPerUser = 1;
  t.after(() => {
    env.wsMaxGlobalConnections = prevGlobal;
    env.wsMaxConnectionsPerIp = prevPerIp;
    env.wsMaxConnectionsPerUser = prevPerUser;
  });

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `ws_limit_user_${suffix}`;
  const username = `ws_limit_user_${suffix}`;
  seedUser({
    userId,
    username,
    password: "Test1234!Aa",
    tokenVersion: 0,
  });

  const token = signJwt({ sub: userId, username, ver: 0 }, 300);
  const runtime = await createServer();
  let openWs = null;
  t.after(async () => {
    if (openWs?.readyState === openWs.OPEN) {
      const closePromise = waitWsClose(openWs);
      openWs.close();
      await closePromise;
    }
    await runtime.close();
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  openWs = await connectWs(runtime.wsUrl, token);

  const rejected = await connectAndWaitClose(runtime.wsUrl, token);
  assert.equal(rejected.code, 1013);
  assert.equal(rejected.reason, "Connection limit exceeded");
});
