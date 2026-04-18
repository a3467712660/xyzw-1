import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import * as dns from "node:dns";
import express from "express";
import { initDatabase } from "../src/db/database.js";
import { run } from "../src/db/client.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
import { nowIso } from "../src/db/sql.js";
import { env } from "../src/config/env.js";
import { inviteCodeRepository } from "../src/repositories/inviteCodeRepository.js";
import tokenImportProxyRoutes from "../src/routes/tokenImportProxy.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createServer = async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", tokenImportProxyRoutes);

  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const requestLocal = ({ url, method, headers = {}, body = "" }) => {
  const target = new URL(url);
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: `${target.pathname}${target.search}`,
        method,
        headers,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            body: Buffer.concat(chunks).toString("utf8"),
          });
        });
      },
    );
    req.on("error", reject);
    if (body) {
      req.write(body);
    }
    req.end();
  });
};

const createUser = ({ id, username, password }) => {
  const ts = nowIso();
  const meta = createPassword(password);
  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, $createdAt, $updatedAt
    )`,
    {
      $id: id,
      $username: username,
      $salt: meta.salt,
      $hash: meta.hash,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
};

const authHeaders = ({ userId, username }) => {
  const token = signJwt({ sub: userId, username, ver: 0 }, 10 * 60);
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
};

test("POST /token-import/proxy allows public JSON upstream on allowlisted host", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `proxy_user_${suffix}`;
  const username = `proxy_user_${suffix}`;
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });
  createUser({ id: userId, username, password: "ProxyUser123!Aa" });

  const originalTrustedHosts = env.trustedImportApiHosts;
  env.trustedImportApiHosts = ["api.example.com"];
  t.after(() => {
    env.trustedImportApiHosts = originalTrustedHosts;
  });

  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response('{"ok":true}', {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  t.after(() => {
    global.fetch = originalFetch;
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/token-import/proxy`,
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({
      url: "https://api.example.com/import.json",
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
});

test("POST /token-import/proxy blocks rebinding when resolved addresses mix public and loopback IPs and keeps logs redacted", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `proxy_block_user_${suffix}`;
  const username = `proxy_block_user_${suffix}`;
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });
  createUser({ id: userId, username, password: "ProxyBlock123!Aa" });

  const originalTrustedHosts = env.trustedImportApiHosts;
  env.trustedImportApiHosts = ["api.example.com"];
  t.after(() => {
    env.trustedImportApiHosts = originalTrustedHosts;
  });

  let fetchCalls = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    fetchCalls += 1;
    return new Response("unexpected");
  };
  t.after(() => {
    global.fetch = originalFetch;
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
    { address: "127.0.0.1", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const warnCalls = [];
  const originalWarn = console.warn;
  console.warn = (...args) => {
    warnCalls.push(args.map((item) => String(item || "")).join(" "));
  };
  t.after(() => {
    console.warn = originalWarn;
  });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/token-import/proxy`,
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({
      url: "https://api.example.com/import.json?token=secret-token-123&foo=bar",
    }),
  });

  assert.equal(response.status, 403);
  const payload = JSON.parse(response.body);
  assert.equal(payload?.error?.code, "TOKEN_IMPORT_PROXY_PRIVATE_IP_BLOCKED");
  assert.equal(fetchCalls, 0);

  const warnText = warnCalls.join("\n");
  assert.equal(warnText.includes("secret-token-123"), false);
  assert.equal(
    warnText.includes("https://api.example.com/import.json?token=secret-token-123"),
    false,
  );
});

test("POST /token-import/proxy blocks redirects to non-allowlisted hosts", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `proxy_redirect_user_${suffix}`;
  const username = `proxy_redirect_user_${suffix}`;
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });
  createUser({ id: userId, username, password: "ProxyRedirect123!Aa" });

  const originalTrustedHosts = env.trustedImportApiHosts;
  env.trustedImportApiHosts = ["api.example.com"];
  t.after(() => {
    env.trustedImportApiHosts = originalTrustedHosts;
  });

  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response("", {
      status: 302,
      headers: {
        location: "https://evil.example.com/next",
      },
    });
  t.after(() => {
    global.fetch = originalFetch;
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/token-import/proxy`,
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({
      url: "https://api.example.com/import.json",
    }),
  });

  assert.equal(response.status, 502);
  const payload = JSON.parse(response.body);
  assert.equal(payload?.error?.code, "TOKEN_IMPORT_PROXY_REDIRECT_BLOCKED");
});

test("POST /token-import/proxy rejects non-json upstream content type", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `proxy_type_user_${suffix}`;
  const username = `proxy_type_user_${suffix}`;
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });
  createUser({ id: userId, username, password: "ProxyType123!Aa" });

  const originalTrustedHosts = env.trustedImportApiHosts;
  env.trustedImportApiHosts = ["api.example.com"];
  t.after(() => {
    env.trustedImportApiHosts = originalTrustedHosts;
  });

  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response("<html>not json</html>", {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
    });
  t.after(() => {
    global.fetch = originalFetch;
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/token-import/proxy`,
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({
      url: "https://api.example.com/import.json",
    }),
  });

  assert.equal(response.status, 502);
  const payload = JSON.parse(response.body);
  assert.equal(payload?.error?.code, "TOKEN_IMPORT_PROXY_CONTENT_TYPE_NOT_ALLOWED");
});

test("POST /token-import/proxy rejects oversized upstream responses", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `proxy_size_user_${suffix}`;
  const username = `proxy_size_user_${suffix}`;
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });
  createUser({ id: userId, username, password: "ProxySize123!Aa" });

  const originalTrustedHosts = env.trustedImportApiHosts;
  env.trustedImportApiHosts = ["api.example.com"];
  t.after(() => {
    env.trustedImportApiHosts = originalTrustedHosts;
  });

  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(`"${"x".repeat(1024 * 1024 + 8)}"`, {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  t.after(() => {
    global.fetch = originalFetch;
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/token-import/proxy`,
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({
      url: "https://api.example.com/import.json",
    }),
  });

  assert.equal(response.status, 502);
  const payload = JSON.parse(response.body);
  assert.equal(payload?.error?.code, "TOKEN_IMPORT_PROXY_RESPONSE_TOO_LARGE");
});
