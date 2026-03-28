import assert from "node:assert/strict";
import test from "node:test";
import { serializeNotificationRowForClient } from "../src/lib/notificationRowSerializer.js";

test("serializeNotificationRowForClient strips payloadJson and sanitizes top-level dangerous payload fields", () => {
  const serialized = serializeNotificationRowForClient({
    id: "n1",
    type: "security",
    title: "x",
    content: "y",
    payloadJson: JSON.stringify({
      path: "/admin/feedback",
      resetPath: "/mfa-reset#token=abc",
    }),
    isRead: 0,
    readAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(serialized, {
    id: "n1",
    type: "security",
    title: "x",
    content: "y",
    isRead: false,
    readAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    payload: {
      path: "/admin/feedback",
    },
  });
  assert.equal("payloadJson" in serialized, false);
});

test("serializeNotificationRowForClient recursively removes dangerous payload keys", () => {
  const serialized = serializeNotificationRowForClient({
    id: "n2",
    type: "security",
    title: "nested",
    content: "nested",
    payloadJson: JSON.stringify({
      detail: {
        sessionId: "abc",
        nested: {
          token: "xyz",
          resetUrl: "/mfa-reset#token=raw",
          ok: "safe",
        },
      },
    }),
    isRead: 1,
    readAt: "2026-01-01T01:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(serialized.payload, {
    detail: {
      nested: {
        ok: "safe",
      },
    },
  });
});

test("serializeNotificationRowForClient masks dangerous payload string values", () => {
  const serialized = serializeNotificationRowForClient({
    id: "n3",
    type: "security",
    title: "masked",
    content: "masked",
    payloadJson: JSON.stringify({
      path: "/admin/feedback",
      extra: "/mfa-reset#token=abc",
      nested: {
        link: "/mfa-qr-approve#sid=xyz",
      },
    }),
    isRead: 0,
    readAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(serialized.payload, {
    path: "/admin/feedback",
    extra: "***",
    nested: {
      link: "***",
    },
  });
});

test("serializeNotificationRowForClient preserves safe fields", () => {
  const serialized = serializeNotificationRowForClient({
    id: "n4",
    type: "system",
    title: "safe",
    content: "safe",
    payloadJson: JSON.stringify({
      path: "/admin/feedback",
      expiresAt: "2026-01-01T00:00:00.000Z",
      version: "2.0.0",
      source: "changelog",
    }),
    isRead: 1,
    readAt: "2026-01-01T02:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.deepEqual(serialized, {
    id: "n4",
    type: "system",
    title: "safe",
    content: "safe",
    isRead: true,
    readAt: "2026-01-01T02:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
    payload: {
      path: "/admin/feedback",
      expiresAt: "2026-01-01T00:00:00.000Z",
      version: "2.0.0",
      source: "changelog",
    },
  });
});
