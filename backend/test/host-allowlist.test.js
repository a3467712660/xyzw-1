import assert from "node:assert/strict";
import test from "node:test";
import {
  isHostAllowed,
  LOOPBACK_HOST_ALLOWLIST,
  resolveAllowedHosts,
} from "../src/lib/hostAllowlist.js";

test("resolveAllowedHosts keeps explicit empty array without loopback fallback", () => {
  assert.deepEqual(resolveAllowedHosts([]), []);
});

test("isHostAllowed rejects loopback when explicit allowlist is empty", () => {
  assert.equal(isHostAllowed("localhost", []), false);
  assert.equal(isHostAllowed("127.0.0.1", []), false);
  assert.equal(isHostAllowed("::1", []), false);
});

test("isHostAllowed still falls back to loopback for empty string in development-style usage", () => {
  assert.equal(
    isHostAllowed("localhost", "", LOOPBACK_HOST_ALLOWLIST),
    true,
  );
});

test("isHostAllowed preserves explicit host and suffix matching", () => {
  assert.equal(isHostAllowed("api.example.com", ["api.example.com"]), true);
  assert.equal(isHostAllowed("foo.example.com", [".example.com"]), true);
  assert.equal(isHostAllowed("evil.com", [".example.com"]), false);
});
