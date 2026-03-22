import crypto from "crypto";
import { aesDecrypt, aesEncrypt, sha256Hex } from "../lib/crypto.js";

const MFA_ISSUER = "XYZW Web Helper";
const RECOVERY_CODE_COUNT = 8;
const RECOVERY_CODE_BYTES = 5;
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

const normalizeTotpCode = (value) => String(value || "").replace(/\s+/g, "").trim();
const normalizeRecoveryCode = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const hashRecoveryCode = (code) => sha256Hex(`mfa-recovery:${normalizeRecoveryCode(code)}`);

const randomRecoveryCode = () =>
  crypto.randomBytes(RECOVERY_CODE_BYTES).toString("hex").toUpperCase().match(/.{1,4}/g).join("-");

const base32Encode = (input) => {
  const buffer = Buffer.isBuffer(input) ? input : Buffer.from(input);
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  }
  return output;
};

const base32Decode = (input) => {
  const normalized = String(input || "").toUpperCase().replace(/=+$/g, "").replace(/\s+/g, "");
  if (!normalized) return Buffer.alloc(0);

  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of normalized) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
};

const makeTotpCounterBuffer = (counter) => {
  const buffer = Buffer.alloc(8);
  let n = BigInt(counter);
  for (let i = 7; i >= 0; i -= 1) {
    buffer[i] = Number(n & 0xffn);
    n >>= 8n;
  }
  return buffer;
};

const normalizeTotpToken = (value) => String(value || "").replace(/[^0-9]/g, "").slice(0, TOTP_DIGITS);

const safeEqualCode = (a, b) => {
  const x = Buffer.from(String(a || ""), "utf8");
  const y = Buffer.from(String(b || ""), "utf8");
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
};

const buildOtpAuthUrl = ({ accountName, issuer, secret }) => {
  const label = `${issuer}:${accountName}`;
  const query = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  });
  return `otpauth://totp/${encodeURIComponent(label)}?${query.toString()}`;
};

export const generateTotpCode = ({ secret, timestamp = Date.now() }) => {
  const key = base32Decode(secret);
  if (!key.length) return "";
  const counter = Math.floor(Math.floor(Number(timestamp) / 1000) / TOTP_STEP_SECONDS);
  const hmac = crypto.createHmac("sha1", key).update(makeTotpCounterBuffer(counter)).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const codeInt = (
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)
  ) % (10 ** TOTP_DIGITS);
  return String(codeInt).padStart(TOTP_DIGITS, "0");
};

const toRecoveryHashArray = (jsonText) => {
  try {
    const parsed = JSON.parse(String(jsonText || "[]"));
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => String(item || "")).filter(Boolean);
  } catch {
    return [];
  }
};

export const createMfaSetupPayload = ({ username = "", issuer = MFA_ISSUER } = {}) => {
  const secret = base32Encode(crypto.randomBytes(20));
  const accountName = String(username || "").trim() || "admin";
  const otpauthUrl = buildOtpAuthUrl({ accountName, issuer, secret });

  const recoveryCodes = Array.from({ length: RECOVERY_CODE_COUNT }, () => randomRecoveryCode());
  const recoveryCodeHashes = recoveryCodes.map((code) => hashRecoveryCode(code));

  return {
    secret,
    otpauthUrl,
    recoveryCodes,
    recoveryCodeHashes,
  };
};

export const verifyTotpCode = ({ secret, code }) => {
  const normalizedSecret = String(secret || "").trim();
  const normalizedCode = normalizeTotpToken(code);
  if (!normalizedSecret || !normalizedCode) return false;
  const now = Date.now();
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const expected = generateTotpCode({
      secret: normalizedSecret,
      timestamp: now + offset * TOTP_STEP_SECONDS * 1000,
    });
    if (expected && safeEqualCode(expected, normalizedCode)) {
      return true;
    }
  }
  return false;
};

export const encryptMfaSecret = (secret) => aesEncrypt(String(secret || "").trim());

export const decryptMfaSecret = (encryptedSecret) => {
  const raw = aesDecrypt(String(encryptedSecret || ""));
  return String(raw || "").trim();
};

export const verifyAndConsumeRecoveryCode = ({ inputCode, recoveryCodeHashesJson }) => {
  const normalized = normalizeRecoveryCode(inputCode);
  if (!normalized) {
    return {
      ok: false,
      nextRecoveryCodeHashesJson: recoveryCodeHashesJson || "[]",
    };
  }

  const hashes = toRecoveryHashArray(recoveryCodeHashesJson);
  const hashedInput = hashRecoveryCode(normalized);
  const index = hashes.findIndex((value) => value === hashedInput);
  if (index < 0) {
    return {
      ok: false,
      nextRecoveryCodeHashesJson: JSON.stringify(hashes),
    };
  }

  const next = [...hashes.slice(0, index), ...hashes.slice(index + 1)];
  return {
    ok: true,
    nextRecoveryCodeHashesJson: JSON.stringify(next),
  };
};
