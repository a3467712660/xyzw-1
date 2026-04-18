import assert from "node:assert/strict";
import * as dns from "node:dns";
import http from "node:http";
import { PassThrough } from "node:stream";
import test from "node:test";
import express from "express";
import { run } from "../src/db/client.js";
import { initDatabase } from "../src/db/database.js";
import { env } from "../src/config/env.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
import {
  fetchProxyResource,
  ProxySafetyError,
} from "../src/lib/proxySafety.js";
import tokenImportProxyRoutes from "../src/routes/tokenImportProxy.js";
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

const createStreamingBody = ({
  initialChunks = [],
  trailingChunks = [],
  endAfterMs = null,
} = {}) => {
  const body = new PassThrough();
  queueMicrotask(() => {
    initialChunks.forEach((chunk) => body.write(chunk));
    if (endAfterMs === null) {
      return;
    }
    setTimeout(() => {
      trailingChunks.forEach((chunk) => body.write(chunk));
      body.end();
    }, endAfterMs);
  });
  return body;
};

test("fetchProxyResource pins transport lookup to validated public addresses", async () => {
  const upstream = await fetchProxyResource({
    route: "/api/v1/token-import/proxy",
    url: "https://api.example.com/import.json",
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    allowedHosts: ["api.example.com"],
    allowedContentTypes: ["application/json", "application/*+json"],
    timeoutMs: 50,
    maxResponseBytes: 1024,
    lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    requestImpl: async ({ url, lookup, resolvedAddresses }) => {
      assert.equal(url.toString(), "https://api.example.com/import.json");
      assert.deepEqual(resolvedAddresses, [
        { address: "93.184.216.34", family: 4 },
      ]);

      const pinned = await callLookup(lookup, url.hostname, { family: 4 });
      assert.deepEqual(pinned, {
        address: "93.184.216.34",
        family: 4,
      });

      return {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        bodyBuffer: Buffer.from('{"ok":true}', "utf8"),
        connectedAddress: "93.184.216.34",
      };
    },
  });

  assert.equal(upstream.status, 200);
  assert.deepEqual(JSON.parse(upstream.bodyBuffer.toString("utf8")), { ok: true });
});

test("fetchProxyResource detects connected address drift outside validated dns results", async () => {
  let requestImplCalled = false;

  await assert.rejects(
    fetchProxyResource({
      route: "/api/v1/token-import/proxy",
      url: "https://api.example.com/import.json",
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      allowedHosts: ["api.example.com"],
      allowedContentTypes: ["application/json", "application/*+json"],
      timeoutMs: 50,
      maxResponseBytes: 1024,
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      requestImpl: async ({ url, lookup, resolvedAddresses }) => {
        requestImplCalled = true;
        assert.equal(url.hostname, "api.example.com");
        assert.deepEqual(resolvedAddresses, [
          { address: "93.184.216.34", family: 4 },
        ]);

        const pinned = await callLookup(lookup, url.hostname, { family: 4 });
        assert.deepEqual(pinned, {
          address: "93.184.216.34",
          family: 4,
        });

        return {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
          bodyBuffer: Buffer.from('{"ok":true}', "utf8"),
          connectedAddress: "127.0.0.1",
        };
      },
    }),
    (error) => {
      assert.equal(error instanceof ProxySafetyError, true);
      assert.equal(error.reason, "PRIVATE_IP_BLOCKED");
      return true;
    },
  );

  assert.equal(requestImplCalled, true);
});

test("fetchProxyResource repins DNS on each allowlisted redirect hop", async () => {
  let requestCount = 0;

  const upstream = await fetchProxyResource({
    route: "/api/v1/token-import/proxy",
    url: "https://api.example.com/import.json",
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    allowedHosts: ["api.example.com", "cdn.example.com"],
    allowedContentTypes: ["application/json", "application/*+json"],
    timeoutMs: 50,
    maxResponseBytes: 1024,
    lookup: async (hostname) => {
      if (String(hostname) === "cdn.example.com") {
        return [{ address: "93.184.216.35", family: 4 }];
      }
      return [{ address: "93.184.216.34", family: 4 }];
    },
    requestImpl: async ({ url, lookup, resolvedAddresses }) => {
      requestCount += 1;
      const pinned = await callLookup(lookup, url.hostname, { family: 4 });

      if (requestCount === 1) {
        assert.equal(url.hostname, "api.example.com");
        assert.deepEqual(resolvedAddresses, [
          { address: "93.184.216.34", family: 4 },
        ]);
        assert.deepEqual(pinned, {
          address: "93.184.216.34",
          family: 4,
        });
        return {
          status: 302,
          headers: {
            location: "https://cdn.example.com/next.json",
          },
          bodyBuffer: Buffer.alloc(0),
          connectedAddress: "93.184.216.34",
        };
      }

      assert.equal(url.hostname, "cdn.example.com");
      assert.deepEqual(resolvedAddresses, [
        { address: "93.184.216.35", family: 4 },
      ]);
      assert.deepEqual(pinned, {
        address: "93.184.216.35",
        family: 4,
      });
      return {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        bodyBuffer: Buffer.from('{"ok":true}', "utf8"),
        connectedAddress: "93.184.216.35",
      };
    },
  });

  assert.equal(requestCount, 2);
  assert.deepEqual(JSON.parse(upstream.bodyBuffer.toString("utf8")), { ok: true });
});

test("fetchProxyResource blocks allowlisted redirects when the next hop resolves to loopback", async () => {
  let requestCount = 0;

  await assert.rejects(
    fetchProxyResource({
      route: "/api/v1/token-import/proxy",
      url: "https://api.example.com/import.json",
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      allowedHosts: ["api.example.com", "cdn.example.com"],
      allowedContentTypes: ["application/json", "application/*+json"],
      timeoutMs: 50,
      maxResponseBytes: 1024,
      lookup: async (hostname) => {
        if (String(hostname) === "cdn.example.com") {
          return [{ address: "127.0.0.1", family: 4 }];
        }
        return [{ address: "93.184.216.34", family: 4 }];
      },
      requestImpl: async () => {
        requestCount += 1;
        return {
          status: 302,
          headers: {
            location: "https://cdn.example.com/next.json",
          },
          bodyBuffer: Buffer.alloc(0),
          connectedAddress: "93.184.216.34",
        };
      },
    }),
    (error) => {
      assert.equal(error instanceof ProxySafetyError, true);
      assert.equal(error.reason, "PRIVATE_IP_BLOCKED");
      return true;
    },
  );

  assert.equal(requestCount, 1);
});

test("fetchProxyResource times out when node response body stalls after headers", async () => {
  await assert.rejects(
    fetchProxyResource({
      route: "/api/v1/token-import/proxy",
      url: "https://api.example.com/import.json",
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      allowedHosts: ["api.example.com"],
      allowedContentTypes: ["application/json", "application/*+json"],
      timeoutMs: 40,
      maxResponseBytes: 1024,
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      requestImpl: async () => ({
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        body: createStreamingBody(),
        connectedAddress: "93.184.216.34",
      }),
    }),
    (error) => {
      assert.equal(error instanceof ProxySafetyError, true);
      assert.equal(error.reason, "TIMEOUT");
      return true;
    },
  );
});

test("fetchProxyResource keeps stalled body errors as TIMEOUT when response stays below max bytes", async () => {
  await assert.rejects(
    fetchProxyResource({
      route: "/api/v1/token-import/proxy",
      url: "https://api.example.com/import.json",
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      allowedHosts: ["api.example.com"],
      allowedContentTypes: ["application/json", "application/*+json"],
      timeoutMs: 40,
      maxResponseBytes: 1024,
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      requestImpl: async () => ({
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
        body: createStreamingBody({
          initialChunks: ['{"partial":true'],
        }),
        connectedAddress: "93.184.216.34",
      }),
    }),
    (error) => {
      assert.equal(error instanceof ProxySafetyError, true);
      assert.equal(error.reason, "TIMEOUT");
      return true;
    },
  );
});

test("fetchProxyResource times out when redirect second hop body stalls", async () => {
  let requestCount = 0;

  await assert.rejects(
    fetchProxyResource({
      route: "/api/v1/token-import/proxy",
      url: "https://api.example.com/import.json",
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      allowedHosts: ["api.example.com", "cdn.example.com"],
      allowedContentTypes: ["application/json", "application/*+json"],
      timeoutMs: 40,
      maxResponseBytes: 1024,
      lookup: async (hostname) => {
        if (String(hostname) === "cdn.example.com") {
          return [{ address: "93.184.216.35", family: 4 }];
        }
        return [{ address: "93.184.216.34", family: 4 }];
      },
      requestImpl: async ({ url }) => {
        requestCount += 1;
        if (requestCount === 1) {
          assert.equal(url.hostname, "api.example.com");
          return {
            status: 302,
            headers: {
              location: "https://cdn.example.com/next.json",
            },
            bodyBuffer: Buffer.alloc(0),
            connectedAddress: "93.184.216.34",
          };
        }

        assert.equal(url.hostname, "cdn.example.com");
        return {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
          body: createStreamingBody({
            initialChunks: ['{"nextHop":'],
          }),
          connectedAddress: "93.184.216.35",
        };
      },
    }),
    (error) => {
      assert.equal(error instanceof ProxySafetyError, true);
      assert.equal(error.reason, "TIMEOUT");
      return true;
    },
  );

  assert.equal(requestCount, 2);
});

test("fetchProxyResource rejects custom requestImpl outside test environment", async (t) => {
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  t.after(() => {
    process.env.NODE_ENV = previousNodeEnv;
  });

  let requestImplCalled = false;

  await assert.rejects(
    fetchProxyResource({
      route: "/api/v1/token-import/proxy",
      url: "https://api.example.com/import.json",
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      allowedHosts: ["api.example.com"],
      allowedContentTypes: ["application/json", "application/*+json"],
      timeoutMs: 40,
      maxResponseBytes: 1024,
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      requestImpl: async () => {
        requestImplCalled = true;
        return {
          status: 200,
          headers: {
            "content-type": "application/json; charset=utf-8",
          },
          bodyBuffer: Buffer.from('{"ok":true}', "utf8"),
          connectedAddress: "93.184.216.34",
        };
      },
    }),
    (error) => {
      assert.equal(error instanceof ProxySafetyError, true);
      assert.equal(error.reason, "FETCH_IMPL_NOT_ALLOWED");
      return true;
    },
  );

  assert.equal(requestImplCalled, false);
});

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

  mockHttpsRequest(t, async ({ options, url, bodyBuffer }) => {
    assert.equal(url.toString(), "https://api.example.com/import.json");
    assert.equal(options.method, "GET");
    assert.equal(bodyBuffer.length, 0);
    assert.equal(options.servername, "api.example.com");

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
      body: '{"ok":true}',
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

  let upstreamCalls = 0;
  mockHttpsRequest(t, async () => {
    upstreamCalls += 1;
    return {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      body: '{"unexpected":true}',
      connectedAddress: "93.184.216.34",
    };
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
  assert.equal(upstreamCalls, 0);

  const warnText = warnCalls.join("\n");
  assert.equal(warnText.includes("secret-token-123"), false);
  assert.equal(
    warnText.includes("https://api.example.com/import.json?token=secret-token-123"),
    false,
  );
});

test("POST /token-import/proxy repins DNS for allowlisted redirect hops", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `proxy_redirect_allow_user_${suffix}`;
  const username = `proxy_redirect_allow_user_${suffix}`;
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });
  createUser({ id: userId, username, password: "ProxyRedirectAllow123!Aa" });

  const originalTrustedHosts = env.trustedImportApiHosts;
  env.trustedImportApiHosts = ["api.example.com", "cdn.example.com"];
  t.after(() => {
    env.trustedImportApiHosts = originalTrustedHosts;
  });

  let requestCount = 0;
  mockHttpsRequest(t, async ({ options, url }) => {
    requestCount += 1;
    const pinned = await callLookup(options.lookup, options.hostname, {
      family: 4,
    });

    if (requestCount === 1) {
      assert.equal(url.hostname, "api.example.com");
      assert.deepEqual(pinned, {
        address: "93.184.216.34",
        family: 4,
      });
      return {
        status: 302,
        headers: {
          location: "https://cdn.example.com/next.json",
        },
        connectedAddress: "93.184.216.34",
      };
    }

    assert.equal(url.hostname, "cdn.example.com");
    assert.deepEqual(pinned, {
      address: "93.184.216.35",
      family: 4,
    });
    return {
      status: 200,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
      body: '{"ok":true}',
      connectedAddress: "93.184.216.35",
    };
  });

  const lookupMock = t.mock.method(dns.promises, "lookup", async (hostname) => {
    if (String(hostname) === "cdn.example.com") {
      return [{ address: "93.184.216.35", family: 4 }];
    }
    return [{ address: "93.184.216.34", family: 4 }];
  });
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
  assert.equal(requestCount, 2);
  assert.deepEqual(JSON.parse(response.body), { ok: true });
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

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
    body: "<html>not json</html>",
    connectedAddress: "93.184.216.34",
  }));

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

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    body: `"${"x".repeat(1024 * 1024 + 8)}"`,
    connectedAddress: "93.184.216.34",
  }));

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

test("POST /token-import/proxy returns upstream timeout when body stalls after headers", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `proxy_timeout_user_${suffix}`;
  const username = `proxy_timeout_user_${suffix}`;
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });
  createUser({ id: userId, username, password: "ProxyTimeout123!Aa" });

  const originalTrustedHosts = env.trustedImportApiHosts;
  const originalTimeoutMs = env.tokenImportProxyTimeoutMs;
  env.trustedImportApiHosts = ["api.example.com"];
  env.tokenImportProxyTimeoutMs = 40;
  t.after(() => {
    env.trustedImportApiHosts = originalTrustedHosts;
    env.tokenImportProxyTimeoutMs = originalTimeoutMs;
  });

  mockHttpsRequest(t, async () => ({
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
    connectedAddress: "93.184.216.34",
    streamBody: (response) => {
      response.write('{"ok":');
    },
  }));

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
  assert.equal(payload?.error?.code, "TOKEN_IMPORT_PROXY_UPSTREAM_TIMEOUT");
});
