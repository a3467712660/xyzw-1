import assert from "node:assert/strict";
import * as dns from "node:dns";
import http from "node:http";
import test from "node:test";
import { createApp } from "../src/app/createApp.js";
import { query, run } from "../src/db/client.js";
import { initDatabase } from "../src/db/database.js";
import { env } from "../src/config/env.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
import { nowIso } from "../src/db/sql.js";
import {
  callLookup,
  mockHttpsRequest,
} from "./proxy-safety-test-helpers.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createServer = async () => {
  const { app } = createApp();
  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
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

test("POST /wechat-proxy/hortor-login rejects requests without allowed Origin/Referer", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  let upstreamCalls = 0;
  mockHttpsRequest(t, async () => {
    upstreamCalls += 1;
    return {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
      body: "ok",
      connectedAddress: "93.184.216.34",
    };
  });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/hortor-login`,
    method: "POST",
    headers: {
      "content-type": "text/plain; charset=utf-8",
    },
    body: "payload",
  });

  assert.equal(response.status, 403);
  assert.equal(upstreamCalls, 0);
});

test("POST /wechat-proxy/hortor-login forwards header deviceUniqueId to upstream", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  let upstreamUrl = "";
  let upstreamMethod = "";
  let upstreamBody = "";
  mockHttpsRequest(t, async ({ options, url, bodyBuffer }) => {
    upstreamUrl = url.toString();
    upstreamMethod = String(options.method || "");
    upstreamBody = bodyBuffer.toString("utf8");
    assert.equal(options.servername, "comb-platform.hortorgames.com");

    const pinned = await callLookup(options.lookup, options.hostname, {
      family: 4,
    });
    assert.deepEqual(pinned, {
      address: "93.184.216.34",
      family: 4,
    });

    return {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      body: '{"meta":{"errCode":0},"data":{"combUser":{"id":"u1"}}}',
      connectedAddress: "93.184.216.34",
    };
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url:
      `${makeBaseUrl(server)}/api/v1/wechat-proxy/hortor-login` +
      "?gameId=xyzwapp" +
      "&timestamp=1700000000000&version=android-4.2.1-cn-release" +
      "&cryptVersion=1.1.0&gameTp=app&system=android" +
      "&packageName=com.hortorgames.xyzw",
    method: "POST",
    headers: {
      origin: env.corsOrigins[0],
      referer: `${env.corsOrigins[0]}/login`,
      "content-type": "text/plain; charset=utf-8",
      "x-xyzw-device-unique-id": "DID-test_123",
    },
    body: "encoded-payload",
  });

  assert.equal(response.status, 200);
  assert.equal(upstreamMethod, "POST");
  assert.equal(upstreamBody, "encoded-payload");

  const target = new URL(upstreamUrl);
  assert.equal(
    target.toString().includes("deviceUniqueId=DID-test_123"),
    true,
  );
  assert.equal(target.searchParams.get("deviceUniqueId"), "DID-test_123");
  assert.equal(target.searchParams.get("gameId"), "xyzwapp");
  assert.equal(target.searchParams.get("packageName"), "com.hortorgames.xyzw");
});

test("POST /wechat-proxy/hortor-login rejects query deviceUniqueId before upstream", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  let upstreamCalls = 0;
  mockHttpsRequest(t, async () => {
    upstreamCalls += 1;
    return {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
      body: "ok",
      connectedAddress: "93.184.216.34",
    };
  });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/hortor-login?gameId=xyzwapp&deviceUniqueId=abc`,
    method: "POST",
    headers: {
      origin: env.corsOrigins[0],
      referer: `${env.corsOrigins[0]}/login`,
      "content-type": "text/plain; charset=utf-8",
      "x-xyzw-device-unique-id": "DID-test_123",
    },
    body: "payload",
  });

  assert.equal(response.status, 400);
  assert.equal(upstreamCalls, 0);
  assert.equal(response.body.includes("deviceUniqueId"), true);
});

test("POST /wechat-proxy/hortor-login can enforce guest-only mode", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `wechat_proxy_user_${suffix}`;
  const username = `wechat_proxy_user_${suffix}`;
  const password = "WechatProxy123!Aa";
  createUser({ id: userId, username, password });

  const prevGuestOnly = env.wechatProxyHortorLoginGuestOnly;
  env.wechatProxyHortorLoginGuestOnly = true;
  t.after(() => {
    env.wechatProxyHortorLoginGuestOnly = prevGuestOnly;
  });

  let upstreamCalls = 0;
  mockHttpsRequest(t, async () => {
    upstreamCalls += 1;
    return {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
      body: "ok",
      connectedAddress: "93.184.216.34",
    };
  });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const token = signJwt({ sub: userId, username, ver: 0 }, 10 * 60);
  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/hortor-login`,
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      origin: env.corsOrigins[0],
      referer: `${env.corsOrigins[0]}/login`,
      "content-type": "text/plain; charset=utf-8",
    },
    body: "payload",
  });

  assert.equal(response.status, 403);
  assert.equal(upstreamCalls, 0);
});

test("POST /wechat-proxy/qrstatus forwards body uuid to upstream", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  let upstreamUrl = "";
  mockHttpsRequest(t, async ({ options, url }) => {
    upstreamUrl = url.toString();

    const pinned = await callLookup(options.lookup, options.hostname, {
      family: 4,
    });
    assert.deepEqual(pinned, {
      address: "93.184.216.34",
      family: 4,
    });

    return {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
      body: "ok",
      connectedAddress: "93.184.216.34",
    };
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrstatus`,
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ uuid: "wx_uuid_123" }),
  });

  assert.equal(response.status, 200);
  const target = new URL(upstreamUrl);
  assert.equal(target.searchParams.get("uuid"), "wx_uuid_123");
  assert.equal(target.searchParams.get("f"), "url");
  assert.equal(Boolean(target.searchParams.get("_")), true);
});

test("POST /wechat-proxy/qrstatus allows WeChat script status responses", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
    },
    body: "window.wx_errcode=404;",
    connectedAddress: "93.184.216.34",
  }));

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrstatus`,
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ uuid: "wx_uuid_123" }),
  });

  assert.equal(response.status, 200);
  assert.match(response.body, /window\.wx_errcode=404/);
});

test("POST /wechat-proxy/qrstatus treats upstream long-poll timeout as pending scan", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  const originalTimeoutMs = env.wechatProxyTimeoutMs;
  env.wechatProxyTimeoutMs = 40;
  t.after(() => {
    env.wechatProxyTimeoutMs = originalTimeoutMs;
  });

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "application/javascript; charset=utf-8",
    },
    connectedAddress: "93.184.216.34",
    streamBody: (response) => {
      response.write("window.wx_errcode=");
    },
  }));

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrstatus`,
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ uuid: "wx_uuid_123" }),
  });

  assert.equal(response.status, 200);
  assert.match(response.body, /window\.wx_errcode=404/);
});

test("POST /wechat-proxy/qrstatus rejects query uuid before upstream", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  let upstreamCalls = 0;
  mockHttpsRequest(t, async () => {
    upstreamCalls += 1;
    return {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
      body: "ok",
      connectedAddress: "93.184.216.34",
    };
  });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrstatus?uuid=wx_uuid_123`,
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ uuid: "wx_uuid_123" }),
  });

  assert.equal(response.status, 400);
  assert.equal(upstreamCalls, 0);
});

test("GET /wechat-proxy/qrconnect is rate limited", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    body: "<html><body>ok</body></html>",
    connectedAddress: "93.184.216.34",
  }));

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const baseUrl = makeBaseUrl(server);
  let status = 200;
  for (let i = 0; i < 61; i += 1) {
    const response = await requestLocal({
      url: `${baseUrl}/api/v1/wechat-proxy/qrconnect?appid=test&state=${i}`,
      method: "GET",
    });
    status = response.status;
  }

  assert.equal(status, 429);
});

test("GET /wechat-proxy/qrconnect allows WeChat hosts resolved through proxy fake-ip DNS", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  let upstreamCalls = 0;
  mockHttpsRequest(t, async ({ options }) => {
    upstreamCalls += 1;
    assert.equal(options.servername, "open.weixin.qq.com");

    const pinned = await callLookup(options.lookup, options.hostname, {
      family: 4,
    });
    assert.deepEqual(pinned, {
      address: "198.18.23.120",
      family: 4,
    });

    return {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
      },
      body: '<img class="auth_qrcode" src="https://open.weixin.qq.com/connect/qrcode/test-uuid" />',
      connectedAddress: "198.18.23.120",
    };
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "198.18.23.120", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrconnect?appid=test&state=fake-ip`,
    method: "GET",
  });

  assert.equal(response.status, 200);
  assert.equal(upstreamCalls, 1);
  assert.match(response.body, /auth_qrcode/);
});

test("wechat proxy shared limiter blocks across route families", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    body: "<html><body>ok</body></html>",
    connectedAddress: "93.184.216.34",
  }));

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const baseUrl = makeBaseUrl(server);
  const warmup = await requestLocal({
    url: `${baseUrl}/api/v1/wechat-proxy/qrconnect?appid=test&state=warmup`,
    method: "GET",
  });
  assert.equal(warmup.status, 200);

  const sharedRow = query(
    `SELECT scope_key as scopeKey
     FROM security_rate_limits
     WHERE scope_key LIKE 'wechat_proxy_shared:%'
     LIMIT 1`,
  )[0];
  assert.ok(sharedRow?.scopeKey);

  run(
    `UPDATE security_rate_limits
     SET count = 120,
         reset_at = $resetAt,
         block_until = NULL
     WHERE scope_key = $scopeKey`,
    {
      $scopeKey: sharedRow.scopeKey,
      $resetAt: new Date(Date.now() + 60 * 1000).toISOString(),
    },
  );

  const blocked = await requestLocal({
    url: `${baseUrl}/api/v1/wechat-proxy/qrstatus`,
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ uuid: "wx_uuid_456" }),
  });

  assert.equal(blocked.status, 429);
});

test("POST /wechat-proxy/qrstatus blocks fixed upstream host when DNS resolves to loopback and keeps logs redacted", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  let upstreamCalls = 0;
  mockHttpsRequest(t, async () => {
    upstreamCalls += 1;
    return {
      status: 200,
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
      body: "unexpected",
      connectedAddress: "93.184.216.34",
    };
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async (hostname) => {
    if (String(hostname) === "long.open.weixin.qq.com") {
      return [{ address: "127.0.0.1", family: 4 }];
    }
    return [{ address: "93.184.216.34", family: 4 }];
  });
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
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrstatus`,
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ uuid: "wx-uuid-secret-123" }),
  });

  assert.equal(response.status, 502);
  assert.equal(upstreamCalls, 0);
  assert.equal(response.body.includes("不安全"), true);

  const warnText = warnCalls.join("\n");
  assert.equal(warnText.includes("wx-uuid-secret-123"), false);
});

test("GET /wechat-proxy/qrconnect repins DNS for allowlisted redirect hops", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  let requestCount = 0;
  mockHttpsRequest(t, async ({ options, url }) => {
    requestCount += 1;
    const pinned = await callLookup(options.lookup, options.hostname, {
      family: 4,
    });

    if (requestCount === 1) {
      assert.equal(url.hostname, "open.weixin.qq.com");
      assert.deepEqual(pinned, {
        address: "93.184.216.34",
        family: 4,
      });
      return {
        status: 302,
        headers: {
          location:
            "https://long.open.weixin.qq.com/connect/l/qrconnect?uuid=next-hop&f=url",
        },
        connectedAddress: "93.184.216.34",
      };
    }

    assert.equal(url.hostname, "long.open.weixin.qq.com");
      assert.deepEqual(pinned, {
        address: "93.184.216.35",
        family: 4,
      });
      return {
        status: 200,
        headers: {
          "content-type": "text/html; charset=utf-8",
        },
        body: "<html><body>ok</body></html>",
        connectedAddress: "93.184.216.35",
      };
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async (hostname) => {
    if (String(hostname) === "long.open.weixin.qq.com") {
      return [{ address: "93.184.216.35", family: 4 }];
    }
    return [{ address: "93.184.216.34", family: 4 }];
  });
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrconnect?appid=test&state=redirect-allow`,
    method: "GET",
  });

  assert.equal(response.status, 200);
  assert.equal(requestCount, 2);
  assert.equal(response.body.includes("ok"), true);
});

test("GET /wechat-proxy/qrconnect blocks allowlisted redirects when the next hop resolves to loopback", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  let requestCount = 0;
  mockHttpsRequest(t, async () => {
    requestCount += 1;
    return {
      status: 302,
      headers: {
        location:
          "https://long.open.weixin.qq.com/connect/l/qrconnect?uuid=blocked-hop&f=url",
      },
      connectedAddress: "93.184.216.34",
    };
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async (hostname) => {
    if (String(hostname) === "long.open.weixin.qq.com") {
      return [{ address: "127.0.0.1", family: 4 }];
    }
    return [{ address: "93.184.216.34", family: 4 }];
  });
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrconnect?appid=test&state=redirect-private`,
    method: "GET",
  });

  assert.equal(response.status, 502);
  assert.equal(requestCount, 1);
  assert.equal(response.body.includes("不安全"), true);
});

test("GET /wechat-proxy/qrconnect blocks redirects to non-allowlisted hosts", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  mockHttpsRequest(t, async () => ({
    status: 302,
    headers: {
      location: "https://evil.example.com/next",
    },
    connectedAddress: "93.184.216.34",
  }));

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrconnect?appid=test&state=redirect`,
    method: "GET",
  });

  assert.equal(response.status, 502);
  assert.equal(response.body.includes("跳转"), true);
});

test("GET /wechat-proxy/qrconnect rejects oversized upstream html responses", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    body: "x".repeat(256 * 1024 + 32),
    connectedAddress: "93.184.216.34",
  }));

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrconnect?appid=test&state=size`,
    method: "GET",
  });

  assert.equal(response.status, 502);
  assert.equal(response.body.includes("响应体"), true);
});

test("GET /wechat-proxy/qrconnect returns upstream timeout when body stalls after headers", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  const originalTimeoutMs = env.wechatProxyTimeoutMs;
  env.wechatProxyTimeoutMs = 40;
  t.after(() => {
    env.wechatProxyTimeoutMs = originalTimeoutMs;
  });

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    connectedAddress: "93.184.216.34",
    streamBody: (response) => {
      response.write("<html><body>partial");
    },
  }));

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/qrconnect?appid=test&state=timeout`,
    method: "GET",
  });

  assert.equal(response.status, 502);
  const payload = JSON.parse(response.body);
  assert.equal(payload?.success, false);
  assert.equal(payload?.message, "上游请求超时");
});

test("POST /wechat-proxy/hortor-login rejects upstream content types outside the allowlist", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
    body: "<xml>invalid</xml>",
    connectedAddress: "93.184.216.34",
  }));

  const lookupMock = t.mock.method(dns.promises, "lookup", async () => [
    { address: "93.184.216.34", family: 4 },
  ]);
  t.after(() => lookupMock.mock.restore());

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'wechat_proxy_%'`);
  });

  const response = await requestLocal({
    url: `${makeBaseUrl(server)}/api/v1/wechat-proxy/hortor-login?gameId=xyzwapp`,
    method: "POST",
    headers: {
      origin: env.corsOrigins[0],
      referer: `${env.corsOrigins[0]}/login`,
      "content-type": "text/plain; charset=utf-8",
      "x-xyzw-device-unique-id": "DID-test_123",
    },
    body: "payload",
  });

  assert.equal(response.status, 502);
  assert.equal(response.body.includes("响应类型"), true);
});
