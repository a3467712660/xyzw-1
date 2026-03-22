import assert from "node:assert/strict";
import test from "node:test";
import { redactHeaders, redactUrl, sanitizeForLog } from "../src/lib/logRedactor.js";

test("redactHeaders masks authorization/cookie/set-cookie/x-*-token headers", () => {
  const headers = {
    authorization: "Bearer abc",
    cookie: "sid=abc",
    "set-cookie": "sid=abc; HttpOnly",
    "x-user-confirm-token": "u-token",
    "x-admin-confirm-token": "a-token",
    "content-type": "application/json",
  };

  const redacted = redactHeaders(headers);
  assert.equal(redacted.authorization, "[REDACTED]");
  assert.equal(redacted.cookie, "[REDACTED]");
  assert.equal(redacted["set-cookie"], "[REDACTED]");
  assert.equal(redacted["x-user-confirm-token"], "[REDACTED]");
  assert.equal(redacted["x-admin-confirm-token"], "[REDACTED]");
  assert.equal(redacted["content-type"], "application/json");
});

test("redactUrl masks sensitive query params", () => {
  const redacted = redactUrl("/api/v1/bin-files/abc/download?ticket=123&token=xyz&foo=bar&secret=s");
  assert.equal(redacted, "/api/v1/bin-files/abc/download?ticket=***&token=***&foo=bar&secret=***");
});

test("sanitizeForLog escapes control characters", () => {
  assert.equal(sanitizeForLog("/a\tb\r\nc"), "/a\\tb\\r\\nc");
});

test("redactUrl also escapes control characters", () => {
  const redacted = redactUrl("/api/test?foo=a\tb&token=abc\r\nx");
  assert.equal(redacted.includes("token=***"), true);
  assert.equal(/[\r\n\t]/.test(redacted), false);
});
