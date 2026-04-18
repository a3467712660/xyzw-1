import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app/createApp.js";
import { initDatabase } from "../src/db/database.js";
import { env } from "../src/config/env.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createServer = async (options = {}) => {
  const { app } = createApp(options);
  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

test("createApp emits x-request-id, redacted structured request logs, and Prometheus metrics", async (t) => {
  await initDatabase();

  const originalMetricsEnabled = env.metricsEnabled;
  const originalLogRequests = env.logRequests;
  env.metricsEnabled = true;
  env.logRequests = true;
  t.after(() => {
    env.metricsEnabled = originalMetricsEnabled;
    env.logRequests = originalLogRequests;
  });

  const chunks = [];
  const logStream = {
    write(chunk) {
      chunks.push(String(chunk));
    },
  };

  const server = await createServer({ logStream });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const response = await fetch(`${baseUrl}/api/v1/version?token=secret-token-123&foo=bar`, {
    headers: {
      authorization: "Bearer top-secret-token",
      "x-request-id": "req-test-123",
    },
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-request-id"), "req-test-123");

  await new Promise((resolve) => setTimeout(resolve, 50));

  const joinedLogs = chunks.join("");
  assert.ok(joinedLogs.length > 0, "expected structured request logs to be emitted");
  assert.equal(joinedLogs.includes("secret-token-123"), false);
  assert.equal(joinedLogs.includes("top-secret-token"), false);

  const entries = joinedLogs
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  const requestLog = entries.find((entry) => entry?.requestId === "req-test-123");

  assert.ok(requestLog, "expected request log entry");
  assert.equal(requestLog.method, "GET");
  assert.equal(requestLog.route, "/api/v1/version");
  assert.equal(requestLog.status, 200);
  assert.equal(typeof requestLog.durationMs, "number");
  assert.equal(requestLog.userId, null);
  assert.ok(typeof requestLog.role !== "undefined");
  assert.ok(typeof requestLog.ipHash === "string" && requestLog.ipHash.length > 0);
  assert.equal(String(requestLog.url || "").includes("secret-token-123"), false);

  const metricsResponse = await fetch(`${baseUrl}/metrics`);
  assert.equal(metricsResponse.status, 200);
  const metricsBody = await metricsResponse.text();
  assert.equal(metricsBody.includes("xyzw_http_requests_total"), true);
  assert.equal(metricsBody.includes("xyzw_http_request_duration_ms"), true);
  assert.equal(metricsBody.includes("xyzw_http_rate_limited_total"), true);
});

test("createApp returns 404 for /metrics when metrics are disabled", async (t) => {
  await initDatabase();

  const originalMetricsEnabled = env.metricsEnabled;
  env.metricsEnabled = false;
  t.after(() => {
    env.metricsEnabled = originalMetricsEnabled;
  });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const response = await fetch(`${makeBaseUrl(server)}/metrics`);
  assert.equal(response.status, 404);
});
