const DANGEROUS_NOTIFICATION_PAYLOAD_KEYS = new Set([
  "resetpath",
  "reseturl",
  "token",
  "sid",
  "sessionid",
  "ticket",
  "secret",
  "shortcode",
]);

const DANGEROUS_NOTIFICATION_VALUE_PATTERNS = [
  /\/mfa-reset#token=/i,
  /\/mfa-reset\?token=/i,
  /\/mfa-qr-approve#sid=/i,
  /\/mfa-qr-approve\?sid=/i,
];

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const shouldDropPayloadKey = (key) =>
  DANGEROUS_NOTIFICATION_PAYLOAD_KEYS.has(
    String(key || "").trim().toLowerCase(),
  );

const sanitizeNotificationStringValue = (value) => {
  const text = String(value || "");
  return DANGEROUS_NOTIFICATION_VALUE_PATTERNS.some((pattern) =>
    pattern.test(text),
  )
    ? "***"
    : text;
};

export const sanitizeNotificationPayloadForClient = (payload) => {
  if (Array.isArray(payload)) {
    return payload.map((item) => sanitizeNotificationPayloadForClient(item));
  }

  if (typeof payload === "string") {
    return sanitizeNotificationStringValue(payload);
  }

  if (!isPlainObject(payload)) {
    return payload;
  }

  const sanitized = {};
  Object.entries(payload).forEach(([key, value]) => {
    if (shouldDropPayloadKey(key)) {
      return;
    }
    sanitized[key] = sanitizeNotificationPayloadForClient(value);
  });
  return sanitized;
};
