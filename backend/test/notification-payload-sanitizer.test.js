import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeNotificationPayloadForClient } from "../src/lib/notificationPayloadSanitizer.js";

test("sanitizeNotificationPayloadForClient removes top-level dangerous keys", () => {
  const sanitized = sanitizeNotificationPayloadForClient({
    path: "/admin/feedback",
    resetPath: "/mfa-reset#token=abc",
    expiresAt: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(sanitized, {
    path: "/admin/feedback",
    expiresAt: "2026-01-01T00:00:00.000Z",
  });
});

test("sanitizeNotificationPayloadForClient removes nested dangerous keys recursively", () => {
  const sanitized = sanitizeNotificationPayloadForClient({
    detail: {
      sessionId: "abc",
      nested: {
        token: "xyz",
      },
    },
  });

  assert.deepEqual(sanitized, {
    detail: {
      nested: {},
    },
  });
});

test("sanitizeNotificationPayloadForClient masks dangerous value patterns", () => {
  const sanitized = sanitizeNotificationPayloadForClient({
    path: "/safe",
    extra: "/mfa-reset#token=abc",
    nested: [
      "/mfa-qr-approve?sid=xyz",
      {
        link: "/mfa-reset?token=secret",
      },
    ],
  });

  assert.deepEqual(sanitized, {
    path: "/safe",
    extra: "***",
    nested: [
      "***",
      {
        link: "***",
      },
    ],
  });
});

test("sanitizeNotificationPayloadForClient preserves safe fields", () => {
  const sanitized = sanitizeNotificationPayloadForClient({
    path: "/admin/feedback",
    expiresAt: "2026-01-01T00:00:00.000Z",
    version: "2.0.0",
    source: "changelog",
  });

  assert.deepEqual(sanitized, {
    path: "/admin/feedback",
    expiresAt: "2026-01-01T00:00:00.000Z",
    version: "2.0.0",
    source: "changelog",
  });
});
