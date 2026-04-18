import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { env } from "../src/config/env.js";
import { signJwt, verifyJwt } from "../src/lib/crypto.js";

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const signRawToken = ({ header, payload }) => {
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const data = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .createHmac("sha256", env.jwtSecret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${data}.${signature}`;
};

test("signJwt/verifyJwt: valid token", () => {
  const token = signJwt({ sub: "user-1", username: "alice" }, 60);
  const payload = verifyJwt(token);

  assert.equal(payload.sub, "user-1");
  assert.equal(payload.username, "alice");
  assert.ok(Number.isFinite(payload.iat));
  assert.ok(Number.isFinite(payload.exp));
  assert.equal(payload.iss, "xyzw-web-helper-backend");
  assert.equal(payload.aud, "xyzw-web-helper-api");
  assert.equal(typeof payload.jti, "string");
  assert.ok(payload.jti.length > 0);
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

test("verifyJwt: rejects token with invalid alg header even when signature matches", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signRawToken({
    header: { alg: "none", typ: "JWT" },
    payload: {
      sub: "user-4",
      iss: "xyzw-web-helper-backend",
      aud: "xyzw-web-helper-api",
      jti: "jwt-test-none",
      iat: now,
      exp: now + 60,
    },
  });

  assert.throws(() => verifyJwt(token), /Invalid token header/);
});

test("verifyJwt: rejects token with invalid typ header", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signRawToken({
    header: { alg: "HS256", typ: "JWE" },
    payload: {
      sub: "user-5",
      iss: "xyzw-web-helper-backend",
      aud: "xyzw-web-helper-api",
      jti: "jwt-test-jwe",
      iat: now,
      exp: now + 60,
    },
  });

  assert.throws(() => verifyJwt(token), /Invalid token header/);
});

test("verifyJwt: rejects token with invalid issuer", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signRawToken({
    header: { alg: "HS256", typ: "JWT" },
    payload: {
      sub: "user-6",
      iss: "wrong-issuer",
      aud: "xyzw-web-helper-api",
      jti: "jwt-test-issuer",
      iat: now,
      exp: now + 60,
    },
  });

  assert.throws(() => verifyJwt(token), /Invalid token issuer/);
});

test("verifyJwt: rejects token with invalid audience", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signRawToken({
    header: { alg: "HS256", typ: "JWT" },
    payload: {
      sub: "user-7",
      iss: "xyzw-web-helper-backend",
      aud: "wrong-audience",
      jti: "jwt-test-audience",
      iat: now,
      exp: now + 60,
    },
  });

  assert.throws(() => verifyJwt(token), /Invalid token audience/);
});

test("verifyJwt: rejects token when signature length is wrong", () => {
  const token = signJwt({ sub: "user-8" }, 60);
  const [header, payload] = token.split(".");
  const malformed = `${header}.${payload}.short`;

  assert.throws(() => verifyJwt(malformed), /Signature mismatch/);
});

test("verifyJwt: accepts legacy token without iss and aud during compatibility window", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signRawToken({
    header: { alg: "HS256" },
    payload: {
      sub: "legacy-user",
      iat: now,
      exp: now + 60,
    },
  });

  const payload = verifyJwt(token);
  assert.equal(payload.sub, "legacy-user");
  assert.equal(payload.iss, undefined);
  assert.equal(payload.aud, undefined);
});

test("verifyJwt: rejects token when only issuer is present without audience", () => {
  const now = Math.floor(Date.now() / 1000);
  const token = signRawToken({
    header: { alg: "HS256", typ: "JWT" },
    payload: {
      sub: "partial-claims-user",
      iss: "xyzw-web-helper-backend",
      iat: now,
      exp: now + 60,
    },
  });

  assert.throws(() => verifyJwt(token), /Invalid token audience/);
});
