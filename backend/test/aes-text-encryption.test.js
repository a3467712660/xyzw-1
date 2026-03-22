import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { aesDecrypt, aesEncrypt } from "../src/lib/crypto.js";

const key = crypto.createHash("sha256").update(process.env.AES_KEY || "").digest();

const legacyCbcEncrypt = (text) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
};

test("aesEncrypt/aesDecrypt: text uses GCM and can roundtrip", () => {
  const plain = "account@example.com";
  const payload = aesEncrypt(plain);

  assert.ok(typeof payload === "string");
  assert.ok(payload.startsWith("gcm:"));
  assert.equal(aesDecrypt(payload), plain);
});

test("aesDecrypt: supports legacy CBC payload", () => {
  const plain = "legacy-note";
  const legacyPayload = legacyCbcEncrypt(plain);
  assert.equal(aesDecrypt(legacyPayload), plain);
});

test("aesDecrypt: tampered GCM payload is rejected", () => {
  const payload = aesEncrypt("sensitive");
  const parts = payload.split(":");
  const last = parts[3];
  parts[3] = `${last.slice(0, -1)}${last.slice(-1) === "0" ? "1" : "0"}`;
  const tampered = parts.join(":");

  assert.throws(() => aesDecrypt(tampered), /authentication failed/);
});

