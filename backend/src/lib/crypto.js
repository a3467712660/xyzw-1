import crypto from "crypto";
import { env } from "../config/env.js";

const toBase64Url = (value) =>
  Buffer.from(value)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const fromBase64Url = (value) => {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  const padded = pad ? base64 + "=".repeat(4 - pad) : base64;
  return Buffer.from(padded, "base64");
};

export const sha256Hex = (text) =>
  crypto.createHash("sha256").update(text).digest("hex");

const PASSWORD_HASH_VERSION = "scrypt-v1";
const SCRYPT_N = 1 << 14;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

const makeScryptHash = (plainPassword, saltHex) => {
  const derived = crypto.scryptSync(plainPassword, saltHex, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 128 * 1024 * 1024,
  });
  return [
    PASSWORD_HASH_VERSION,
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    SCRYPT_KEYLEN,
    derived.toString("hex"),
  ].join("$");
};

export const isLegacyPasswordHash = (hash) =>
  !String(hash || "").startsWith(`${PASSWORD_HASH_VERSION}$`);

export const createPassword = (plainPassword) => {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = makeScryptHash(plainPassword, salt);
  return { salt, hash };
};

export const verifyPassword = (plainPassword, salt, hash) => {
  const hashText = String(hash || "");

  if (isLegacyPasswordHash(hashText)) {
    const target = sha256Hex(`${salt}:${plainPassword}`);
    return (
      target.length === hashText.length
      && crypto.timingSafeEqual(Buffer.from(target), Buffer.from(hashText))
    );
  }

  const [version, nRaw, rRaw, pRaw, keyLenRaw, digestHex] = hashText.split("$");
  if (version !== PASSWORD_HASH_VERSION || !digestHex) {
    return false;
  }

  const n = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  const keyLen = Number(keyLenRaw);
  if (!Number.isFinite(n) || !Number.isFinite(r) || !Number.isFinite(p) || !Number.isFinite(keyLen)) {
    return false;
  }

  const target = crypto.scryptSync(plainPassword, salt, keyLen, {
    N: n,
    r,
    p,
    maxmem: 128 * 1024 * 1024,
  });
  const digest = Buffer.from(digestHex, "hex");
  return target.length === digest.length && crypto.timingSafeEqual(target, digest);
};

const normalizedAesKey = () => {
  const raw = env.aesKey;
  const hash = crypto.createHash("sha256").update(raw).digest();
  return hash;
};

const TEXT_ENC_GCM_PREFIX = "gcm";

export const aesEncrypt = (text) => {
  if (!text) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", normalizedAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${TEXT_ENC_GCM_PREFIX}:${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
};

export const aesDecrypt = (payload) => {
  if (!payload) return "";

  const parts = String(payload).split(":");
  if (parts[0] === TEXT_ENC_GCM_PREFIX) {
    const [, ivHex, authTagHex, encryptedHex] = parts;
    if (!ivHex || !authTagHex || !encryptedHex) return "";
    try {
      const iv = Buffer.from(ivHex, "hex");
      const authTag = Buffer.from(authTagHex, "hex");
      const encrypted = Buffer.from(encryptedHex, "hex");
      const decipher = crypto.createDecipheriv("aes-256-gcm", normalizedAesKey(), iv);
      decipher.setAuthTag(authTag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      return decrypted.toString("utf8");
    } catch {
      throw new Error("Encrypted text authentication failed");
    }
  }

  // Backward compatibility: legacy aes-256-cbc payload ("iv:ciphertext")
  const [ivHex, encryptedHex] = parts;
  if (!ivHex || !encryptedHex) return "";
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedHex, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", normalizedAesKey(), iv);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
};

export const encryptBuffer = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error("Buffer is required");
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", normalizedAesKey(), iv);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, encrypted]);
};

export const decryptBuffer = (payload) => {
  if (!Buffer.isBuffer(payload) || payload.length <= 28) {
    throw new Error("Invalid encrypted buffer");
  }

  const iv = payload.subarray(0, 12);
  const authTag = payload.subarray(12, 28);
  const encrypted = payload.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", normalizedAesKey(), iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]);
};

export const signJwt = (payload, expiresInSeconds = 60 * 60 * 24 * 7) => {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedBody = toBase64Url(JSON.stringify(body));
  const data = `${encodedHeader}.${encodedBody}`;

  const signature = crypto
    .createHmac("sha256", env.jwtSecret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  return `${data}.${signature}`;
};

export const verifyJwt = (token) => {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Malformed token");
  }

  const [encodedHeader, encodedBody, signature] = parts;
  const data = `${encodedHeader}.${encodedBody}`;

  const expectedSignature = crypto
    .createHmac("sha256", env.jwtSecret)
    .update(data)
    .digest("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

  if (
    !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  ) {
    throw new Error("Signature mismatch");
  }

  const payload = JSON.parse(fromBase64Url(encodedBody).toString("utf8"));
  const now = Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) {
    throw new Error("Token expired");
  }

  return payload;
};
