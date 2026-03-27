export const LOOPBACK_HOST_ALLOWLIST = [
  "localhost",
  "127.0.0.1",
  "::1",
  "[::1]",
];

export const normalizeHost = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export const parseHostPatterns = (rawValue) =>
  Array.from(
    new Set(
      (Array.isArray(rawValue) ? rawValue : String(rawValue || "").split(","))
        .map((item) => normalizeHost(item))
        .filter(Boolean),
    ),
  );

export const matchesAllowedHost = (host, pattern) => {
  const normalizedHost = normalizeHost(host);
  const normalizedPattern = normalizeHost(pattern);
  if (!normalizedHost || !normalizedPattern) {
    return false;
  }

  if (normalizedPattern.startsWith(".")) {
    const suffix = normalizedPattern.slice(1);
    return (
      normalizedHost === suffix || normalizedHost.endsWith(normalizedPattern)
    );
  }

  return normalizedHost === normalizedPattern;
};

export const resolveAllowedHosts = (
  rawValue,
  fallbackHosts = LOOPBACK_HOST_ALLOWLIST,
) => {
  const explicitHosts = parseHostPatterns(rawValue);
  if (explicitHosts.length > 0) {
    return explicitHosts;
  }
  return parseHostPatterns(fallbackHosts);
};

export const isHostAllowed = (
  host,
  rawValue,
  fallbackHosts = LOOPBACK_HOST_ALLOWLIST,
) =>
  resolveAllowedHosts(rawValue, fallbackHosts).some((pattern) =>
    matchesAllowedHost(host, pattern),
  );
