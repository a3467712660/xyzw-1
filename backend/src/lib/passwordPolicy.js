import { createHash } from "node:crypto";

const PASSWORD_MIN_LENGTH_DEFAULT = 12;
const PASSWORD_MIN_LENGTH_WITH_MFA = 8;
const PASSWORD_RECOMMENDED_LENGTH = 15;
const HIBP_API_BASE_URL = String(process.env.PASSWORD_HIBP_API_BASE_URL || "https://api.pwnedpasswords.com/range").trim().replace(/\/+$/, "");
const HIBP_ENABLED = String(process.env.PASSWORD_HIBP_ENABLED || "false").trim().toLowerCase() === "true";
const HIBP_TIMEOUT_MS = Math.max(500, Math.min(8000, Number(process.env.PASSWORD_HIBP_TIMEOUT_MS) || 2500));

const WEAK_PASSWORDS = new Set([
  "12345678",
  "123456789",
  "1234567890",
  "12345678901",
  "123456789012",
  "123456789a",
  "12345678a",
  "1234567a",
  "123456",
  "1234567",
  "password",
  "password1",
  "password123",
  "qwerty",
  "qwerty123",
  "qwe123",
  "abc123",
  "11111111",
  "00000000",
  "aaaaaaaa",
  "iloveyou",
  "letmein",
  "welcome",
  "admin",
  "admin123",
  "root",
  "dragon",
  "sunshine",
  "football",
  "monkey",
  "superman",
]);

const resolveMinLength = ({ mfaEnabled = false } = {}) =>
  mfaEnabled ? PASSWORD_MIN_LENGTH_WITH_MFA : PASSWORD_MIN_LENGTH_DEFAULT;

const buildPasswordPolicyHint = ({ mfaEnabled = false } = {}) => {
  const minLength = resolveMinLength({ mfaEnabled });
  const mfaHint = mfaEnabled
    ? "（已启用MFA，可使用8位及以上）"
    : "";
  return `密码至少${minLength}位${mfaHint}（建议${PASSWORD_RECOMMENDED_LENGTH}位及以上），且不能使用常见弱口令`;
};

export const passwordPolicyHint = buildPasswordPolicyHint();

const isWeakPassword = (value) => {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (WEAK_PASSWORDS.has(normalized)) {
    return true;
  }

  // Block obvious repeated single-character passwords such as aaaaaaaa / 11111111.
  if (/^(.)\1{7,}$/.test(normalized)) {
    return true;
  }

  return false;
};

export const validatePasswordStrength = (password, { mfaEnabled = false } = {}) => {
  const hint = buildPasswordPolicyHint({ mfaEnabled });
  const minLength = resolveMinLength({ mfaEnabled });
  const value = String(password || "");
  if (value.length < minLength) {
    return { valid: false, message: hint };
  }

  if (isWeakPassword(value)) {
    return { valid: false, message: "密码过于常见，请更换为不易猜测的密码" };
  }

  return { valid: true, message: "" };
};

const sha1HexUpper = (value) =>
  createHash("sha1").update(String(value || ""), "utf8").digest("hex").toUpperCase();

const isPwnedPassword = async (password) => {
  if (!HIBP_ENABLED) {
    return false;
  }

  const digest = sha1HexUpper(password);
  const prefix = digest.slice(0, 5);
  const suffix = digest.slice(5);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);
  try {
    const response = await fetch(`${HIBP_API_BASE_URL}/${prefix}`, {
      method: "GET",
      headers: {
        "Add-Padding": "true",
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }
    const body = await response.text();
    const lines = body.split("\n");
    for (const line of lines) {
      const [hashSuffix] = String(line || "").trim().split(":");
      if (String(hashSuffix || "").toUpperCase() === suffix) {
        return true;
      }
    }
    return false;
  } catch {
    // Fail-open to avoid blocking auth flows when external service is unavailable.
    return false;
  } finally {
    clearTimeout(timer);
  }
};

export const validatePasswordStrengthAsync = async (password, { mfaEnabled = false } = {}) => {
  const localCheck = validatePasswordStrength(password, { mfaEnabled });
  if (!localCheck.valid) {
    return localCheck;
  }
  const pwned = await isPwnedPassword(password);
  if (pwned) {
    return { valid: false, message: "该密码已出现在已知泄露库中，请使用全新密码" };
  }
  return localCheck;
};
