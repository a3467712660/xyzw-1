import assert from "node:assert/strict";
import test from "node:test";
import { createApp } from "../src/app/createApp.js";
import { initDatabase } from "../src/db/database.js";
import { env } from "../src/config/env.js";
import { query } from "../src/db/client.js";

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

const toCookieHeader = (setCookieValues = []) =>
  setCookieValues
    .map((line) => String(line || "").split(";")[0])
    .filter(Boolean)
    .join("; ");

const fetchCsrfContext = async (baseUrl) => {
  const csrfBootstrapResponse = await fetch(`${baseUrl}/api/v1/auth/csrf`);
  assert.equal(csrfBootstrapResponse.status, 200);
  const csrfPayload = await csrfBootstrapResponse.json();
  const csrfToken = String(csrfPayload?.data?.token || "").trim();
  assert.ok(csrfToken, "expected csrf token from /auth/csrf");

  const cookieHeader = toCookieHeader(csrfBootstrapResponse.headers.getSetCookie());
  assert.ok(cookieHeader.includes(`${env.csrfCookieName}=`), "expected csrf token cookie");
  assert.ok(cookieHeader.includes(`${env.csrfSessionCookieName}=`), "expected csrf session cookie");

  return {
    cookieHeader,
    csrfToken,
  };
};

test("POST /auth/login requires CSRF token when app middleware is enabled", async (t) => {
  await initDatabase();

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const noCsrfResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: "missing_csrf_user",
      password: "missing_csrf_pwd",
    }),
  });
  assert.equal(noCsrfResponse.status, 403);
  const noCsrfPayload = await noCsrfResponse.json();
  assert.equal(noCsrfPayload?.success, false);
  assert.match(String(noCsrfPayload?.message || ""), /CSRF/i);
  const events = query(
    `SELECT event_type as eventType, detail_json as detailJson
     FROM security_event_logs
     WHERE event_type = 'csrf_validation_failed'
     ORDER BY created_at DESC
     LIMIT 1`,
    {},
  );
  assert.equal(events.length, 1);
  const detail = JSON.parse(events[0].detailJson || "{}");
  assert.equal(events[0].eventType, "csrf_validation_failed");
  assert.equal(detail.reason, "header_cookie_mismatch");
  assert.equal(detail.method, "POST");

  const { cookieHeader, csrfToken } = await fetchCsrfContext(baseUrl);

  const withCsrfResponse = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      [env.csrfHeaderName]: csrfToken,
    },
    body: JSON.stringify({
      username: "invalid_user",
      password: "invalid_password",
    }),
  });
  assert.equal(withCsrfResponse.status, 401);
});

test("POST /auth/register requires CSRF token when app middleware is enabled", async (t) => {
  await initDatabase();

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const noCsrfResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      username: `no_csrf_register_${Date.now()}`,
      password: "Test1234!Aa55",
      inviteCode: "INVALID_CODE",
    }),
  });
  assert.equal(noCsrfResponse.status, 403);

  const { cookieHeader, csrfToken } = await fetchCsrfContext(baseUrl);
  const withCsrfResponse = await fetch(`${baseUrl}/api/v1/auth/register`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      [env.csrfHeaderName]: csrfToken,
    },
    body: JSON.stringify({
      username: `with_csrf_register_${Date.now()}`,
      password: "Test1234!Aa55",
      inviteCode: "INVALID_CODE",
    }),
  });

  assert.equal(withCsrfResponse.status, 400);
  const payload = await withCsrfResponse.json();
  assert.equal(payload?.success, false);
  assert.match(String(payload?.message || ""), /邀请码/);
});

test("POST /auth/password-reset requires CSRF token when app middleware is enabled", async (t) => {
  await initDatabase();

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const noCsrfResponse = await fetch(`${baseUrl}/api/v1/auth/password-reset`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      identity: `missing_user_${Date.now()}`,
      shortCode: "ABCD1234",
      newPassword: "Reset1234!Aa55",
    }),
  });
  assert.equal(noCsrfResponse.status, 403);

  const { cookieHeader, csrfToken } = await fetchCsrfContext(baseUrl);
  const withCsrfResponse = await fetch(`${baseUrl}/api/v1/auth/password-reset`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader,
      [env.csrfHeaderName]: csrfToken,
    },
    body: JSON.stringify({
      identity: `missing_user_${Date.now()}`,
      shortCode: "ABCD1234",
      newPassword: "Reset1234!Aa55",
    }),
  });

  assert.equal(withCsrfResponse.status, 200);
  const payload = await withCsrfResponse.json();
  assert.equal(payload?.success, true);
});
