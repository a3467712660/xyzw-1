import test from "node:test";
import assert from "node:assert/strict";
import { createCsrfSessionId, createSignedCsrfToken, verifySignedCsrfToken } from "../src/lib/csrf.js";

const SECRET = "csrf-test-secret";

test("csrf token: valid token passes verification", () => {
  const sessionId = createCsrfSessionId();
  const token = createSignedCsrfToken({ sessionId, secret: SECRET });
  const ok = verifySignedCsrfToken({ token, sessionId, secret: SECRET });
  assert.equal(ok, true);
});

test("csrf token: invalid when session changes", () => {
  const sessionId = createCsrfSessionId();
  const token = createSignedCsrfToken({ sessionId, secret: SECRET });
  const otherSessionId = createCsrfSessionId();
  const ok = verifySignedCsrfToken({ token, sessionId: otherSessionId, secret: SECRET });
  assert.equal(ok, false);
});

test("csrf token: invalid when signature is tampered", () => {
  const sessionId = createCsrfSessionId();
  const token = createSignedCsrfToken({ sessionId, secret: SECRET });
  const [nonce, signature] = token.split(".");
  const tamperedSignature = `${signature.slice(0, -1)}x`;
  const ok = verifySignedCsrfToken({
    token: `${nonce}.${tamperedSignature}`,
    sessionId,
    secret: SECRET,
  });
  assert.equal(ok, false);
});
