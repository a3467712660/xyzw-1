import crypto from "crypto";

const TOKEN_SEGMENT_BYTES = 24;

const toBase64Url = (buffer) =>
  Buffer.from(buffer)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");

const isSafeBase64Url = (value) => /^[A-Za-z0-9\-_]+$/.test(String(value || ""));

const signToken = ({ nonce, sessionId, secret }) =>
  crypto
    .createHmac("sha256", String(secret || ""))
    .update(`${nonce}.${sessionId}`)
    .digest("base64url");

export const createCsrfSessionId = () =>
  toBase64Url(crypto.randomBytes(TOKEN_SEGMENT_BYTES));

export const createSignedCsrfToken = ({ sessionId, secret }) => {
  const sid = String(sessionId || "").trim();
  if (!sid) {
    throw new Error("sessionId is required");
  }
  const nonce = toBase64Url(crypto.randomBytes(TOKEN_SEGMENT_BYTES));
  const signature = signToken({ nonce, sessionId: sid, secret });
  return `${nonce}.${signature}`;
};

export const verifySignedCsrfToken = ({ token, sessionId, secret }) => {
  const sid = String(sessionId || "").trim();
  const rawToken = String(token || "").trim();
  if (!sid || !rawToken || !rawToken.includes(".")) {
    return false;
  }
  const [nonce, providedSignature] = rawToken.split(".");
  if (!nonce || !providedSignature) {
    return false;
  }
  if (!isSafeBase64Url(nonce) || !isSafeBase64Url(providedSignature)) {
    return false;
  }

  const expectedSignature = signToken({ nonce, sessionId: sid, secret });
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (providedBuffer.length !== expectedBuffer.length) {
    return false;
  }
  return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
};
