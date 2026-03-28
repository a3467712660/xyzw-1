import test from "node:test";
import assert from "node:assert/strict";

import {
  hasSensitiveSourceUrlParams,
  sanitizeSourceUrlForDisplay,
} from "../../src/utils/securitySanitizer.js";

test("hasSensitiveSourceUrlParams detects common sensitive sourceUrl query keys", () => {
  assert.equal(
    hasSensitiveSourceUrlParams("https://api.example.com/token?code=abc123&ticket=xyz"),
    true,
  );
  assert.equal(
    hasSensitiveSourceUrlParams("https://api.example.com/token?lang=zh-CN"),
    false,
  );
});

test("sanitizeSourceUrlForDisplay masks sensitive sourceUrl query values", () => {
  const sanitized = sanitizeSourceUrlForDisplay(
    "https://api.example.com/token?code=abc123&ticket=xyz&lang=zh-CN",
  );

  assert.equal(sanitized.startsWith("https://api.example.com/token?"), true);
  assert.equal(sanitized.includes("abc123"), false);
  assert.equal(sanitized.includes("ticket=xyz"), false);
  assert.equal(sanitized.includes("lang=zh-CN"), true);
});

test("sanitizeSourceUrlForDisplay falls back to text masking when URL parsing fails", () => {
  const sanitized = sanitizeSourceUrlForDisplay(
    "bad url ?token=abc123&code=xyz789",
  );

  assert.equal(sanitized.includes("abc123"), false);
  assert.equal(sanitized.includes("xyz789"), false);
});
