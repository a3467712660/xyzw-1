const parseForwardedProto = (forwardedValue) => {
  const raw = String(forwardedValue || "").trim();
  if (!raw) return "";
  const match = raw.match(/proto=([^;,\s]+)/i);
  return String(match?.[1] || "").trim().toLowerCase();
};

export const isHttpsRequest = (req) => {
  const forwardedProto = String(req?.headers?.["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase();
  if (forwardedProto === "https") return true;

  const forwarded = parseForwardedProto(req?.headers?.forwarded);
  if (forwarded === "https") return true;

  return Boolean(req?.secure);
};

export const resolveCookieSecure = (req, configuredSecure) =>
  Boolean(configuredSecure) || isHttpsRequest(req);
