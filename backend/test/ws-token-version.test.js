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

const connectExpectUnexpectedResponse = ({ url, token, origin }) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { authorization: `Bearer ${token}` },
      origin,
    });

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

const connectExpectConnected = ({ url, token, origin }) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(url, {
      headers: { authorization: `Bearer ${token}` },
      origin,
    });
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
