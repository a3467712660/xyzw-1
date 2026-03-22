import test from "node:test";
import assert from "node:assert/strict";
import { signJwt, verifyJwt } from "../src/lib/crypto.js";

test("signJwt/verifyJwt: valid token", () => {
  const token = signJwt({ sub: "user-1", username: "alice" }, 60);
  const payload = verifyJwt(token);

  assert.equal(payload.sub, "user-1");
  assert.equal(payload.username, "alice");
  assert.ok(Number.isFinite(payload.iat));
  assert.ok(Number.isFinite(payload.exp));
});

test("verifyJwt: expired token", () => {
  const token = signJwt({ sub: "user-2" }, -1);
  assert.throws(() => verifyJwt(token), /Token expired/);
});

test("verifyJwt: tampered signature", () => {
  const token = signJwt({ sub: "user-3" }, 60);
  const parts = token.split(".");
  parts[2] = `${parts[2].slice(0, -1)}x`;
  const tampered = parts.join(".");

  assert.throws(() => verifyJwt(tampered), /Signature mismatch/);
});

test("verifyJwt: empty token", () => {
  assert.throws(() => verifyJwt(""), /Invalid token/);
});
