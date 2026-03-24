const LOOPBACK_HOST_ALIASES = new Map([
  ["localhost", "127.0.0.1"],
  ["127.0.0.1", "localhost"],
]);

export const normalizeHttpOrigin = (originValue) => {
  const raw = String(originValue || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const protocol = String(parsed.protocol || "").toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") {
      return null;
    }
    const hostname = String(parsed.hostname || "").toLowerCase();
    const port = String(parsed.port || "");
    return {
      protocol,
      hostname,
      port,
      raw: `${protocol}//${hostname}${port ? `:${port}` : ""}`,
    };
  } catch {
    return null;
  }
};

export const buildLoopbackOriginAlias = (normalizedOrigin) => {
  if (!normalizedOrigin) return null;
  const aliasHost = LOOPBACK_HOST_ALIASES.get(normalizedOrigin.hostname);
  if (!aliasHost) return null;
  return `${normalizedOrigin.protocol}//${aliasHost}${normalizedOrigin.port ? `:${normalizedOrigin.port}` : ""}`;
};

export const isAllowedHttpOrigin = (originValue, allowedOriginSet) => {
  const normalized = normalizeHttpOrigin(originValue);
  if (!normalized) return false;
  if (allowedOriginSet.has(normalized.raw)) {
    return true;
  }
  const alias = buildLoopbackOriginAlias(normalized);
  return Boolean(alias && allowedOriginSet.has(alias));
};
