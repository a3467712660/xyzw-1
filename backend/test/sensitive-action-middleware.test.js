import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { makeSensitiveAction } from "../src/middleware/sensitiveAction.js";
import { signJwt } from "../src/lib/crypto.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createServer = async ({ user, sensitiveRequired }) => {
  const app = express();
  app.use((req, _res, next) => {
    req.auth = { user };
    next();
  });
  app.get("/protected", sensitiveRequired, (_req, res) => {
    res.json({ success: true });
  });

  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

test("sensitiveAction middleware rejects missing/invalid/expired token and accepts valid token", async (t) => {
  const user = {
    id: `sa_user_${Date.now()}`,
    tokenVersion: 3,
  };
  const action = makeSensitiveAction({
    purpose: "test-sensitive-action",
    ttlSeconds: 60,
    headerName: "x-test-confirm-token",
    codePrefix: "TEST_CONFIRM",
  });

  const server = await createServer({ user, sensitiveRequired: action.required });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);

  const missing = await fetch(`${baseUrl}/protected`);
  assert.equal(missing.status, 403);
  const missingPayload = await missing.json();
  assert.equal(missingPayload?.error?.code, "TEST_CONFIRM_REQUIRED");

  const wrongPurposeToken = signJwt({ sub: user.id, ver: user.tokenVersion, purpose: "other-purpose" }, 60);
  const wrongPurpose = await fetch(`${baseUrl}/protected`, {
    headers: {
      "x-test-confirm-token": wrongPurposeToken,
    },
  });
  assert.equal(wrongPurpose.status, 403);
  const wrongPurposePayload = await wrongPurpose.json();
  assert.equal(wrongPurposePayload?.error?.code, "TEST_CONFIRM_INVALID");

  const expiredToken = signJwt(
    { sub: user.id, ver: user.tokenVersion, purpose: "test-sensitive-action" },
    -1,
  );
  const expired = await fetch(`${baseUrl}/protected`, {
    headers: {
      "x-test-confirm-token": expiredToken,
    },
  });
  assert.equal(expired.status, 403);
  const expiredPayload = await expired.json();
  assert.equal(expiredPayload?.error?.code, "TEST_CONFIRM_EXPIRED");

  const tokenVersionMismatch = signJwt(
    { sub: user.id, ver: user.tokenVersion - 1, purpose: "test-sensitive-action" },
    60,
  );
  const mismatch = await fetch(`${baseUrl}/protected`, {
    headers: {
      "x-test-confirm-token": tokenVersionMismatch,
    },
  });
  assert.equal(mismatch.status, 403);
  const mismatchPayload = await mismatch.json();
  assert.equal(mismatchPayload?.error?.code, "TEST_CONFIRM_EXPIRED");

  const validToken = action.issue(user);
  const allowed = await fetch(`${baseUrl}/protected`, {
    headers: {
      "x-test-confirm-token": validToken,
    },
  });
  assert.equal(allowed.status, 200);
  const allowedPayload = await allowed.json();
  assert.equal(allowedPayload?.success, true);
});
