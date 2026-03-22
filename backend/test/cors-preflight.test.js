import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { registerMiddleware } from "../src/app/registerMiddleware.js";
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
  registerMiddleware(app);
  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

test("CORS preflight echoes allowed origin and credentials", async (t) => {
  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const allowedOrigin = String(env.corsOrigins?.[0] || "http://localhost:3000");
  const response = await fetch(`${makeBaseUrl(server)}/healthz`, {
    method: "OPTIONS",
    headers: {
      origin: allowedOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,x-csrf-token",
    },
  });

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), allowedOrigin);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
});

test("CORS preflight omits CORS headers for denied origin", async (t) => {
  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const response = await fetch(`${makeBaseUrl(server)}/healthz`, {
    method: "OPTIONS",
    headers: {
      origin: "https://evil.example",
      "access-control-request-method": "POST",
      "access-control-request-headers": "content-type,x-csrf-token",
    },
  });

  assert.ok(
    response.status === 200 || response.status === 204,
    `expected denied preflight to return non-error without CORS headers, got ${response.status}`,
  );
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
});
