import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { initDatabase } from "../src/db/database.js";
import { run } from "../src/db/client.js";
import { createRateLimiter } from "../src/middleware/rateLimit.js";
import authRoutes from "../src/routes/auth.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createServer = async (app) => {
  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

test("createRateLimiter emits standard RateLimit headers on allowed and blocked responses", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'test_rate_limit_headers:%'`);

  const app = express();
  const limiter = createRateLimiter({
    scope: "test_rate_limit_headers",
    windowMs: 60 * 1000,
    max: 2,
    blockMs: 5 * 60 * 1000,
  });

  app.get("/limited", limiter, (_req, res) => {
    res.json({ success: true });
  });

  const server = await createServer(app);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'test_rate_limit_headers:%'`);
  });

  const baseUrl = makeBaseUrl(server);
  const first = await fetch(`${baseUrl}/limited`);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("ratelimit-limit"), "2");
  assert.equal(first.headers.get("ratelimit-remaining"), "1");
  assert.ok(Number(first.headers.get("ratelimit-reset")) > 0);

  const second = await fetch(`${baseUrl}/limited`);
  assert.equal(second.status, 200);
  assert.equal(second.headers.get("ratelimit-limit"), "2");
  assert.equal(second.headers.get("ratelimit-remaining"), "0");
  assert.ok(Number(second.headers.get("ratelimit-reset")) > 0);

  const blocked = await fetch(`${baseUrl}/limited`);
  assert.equal(blocked.status, 429);
  assert.equal(blocked.headers.get("ratelimit-limit"), "2");
  assert.equal(blocked.headers.get("ratelimit-remaining"), "0");
  assert.ok(Number(blocked.headers.get("ratelimit-reset")) > 0);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
});

test("POST /auth/refresh is covered by a dedicated limiter and eventually returns 429", async (t) => {
  await initDatabase();
  run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'auth_refresh:%'`);

  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);

  const server = await createServer(app);
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_rate_limits WHERE scope_key LIKE 'auth_refresh:%'`);
  });

  const baseUrl = makeBaseUrl(server);

  const first = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: "{}",
  });
  assert.equal(first.status, 401);
  assert.ok(first.headers.get("ratelimit-limit"));
  assert.ok(first.headers.get("ratelimit-remaining"));

  let blocked = null;
  for (let index = 0; index < 30; index += 1) {
    const response = await fetch(`${baseUrl}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{}",
    });
    if (response.status === 429) {
      blocked = response;
      break;
    }
  }

  assert.ok(blocked, "expected /auth/refresh to be rate limited");
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.equal(blocked.headers.get("ratelimit-remaining"), "0");
});
