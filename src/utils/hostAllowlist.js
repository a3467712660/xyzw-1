const DEFAULT_LOOPBACK_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]"];

export const normalizeHost = (value) =>
  String(value || "")
    .trim()
    .toLowerCase();

export const parseHostPatterns = (rawValue) =>
  Array.from(
    new Set(
      String(rawValue || "")
        .split(",")
        .map((item) => normalizeHost(item))
        .filter(Boolean),
    ),
  );

export const isLoopbackHost = (host) =>
  DEFAULT_LOOPBACK_HOSTS.includes(normalizeHost(host));

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
  fallbackHosts = DEFAULT_LOOPBACK_HOSTS,
) => {
  const explicitHosts = parseHostPatterns(rawValue);
  if (explicitHosts.length > 0) {
    return explicitHosts;
  }
  return parseHostPatterns(fallbackHosts.join(","));
};

export const isHostAllowed = (
  host,
  rawValue,
  fallbackHosts = DEFAULT_LOOPBACK_HOSTS,
) => {
  const normalizedHost = normalizeHost(host);
  if (!normalizedHost) {
    return false;
  }
  return resolveAllowedHosts(rawValue, fallbackHosts).some((pattern) =>
    matchesAllowedHost(normalizedHost, pattern),
  );
};

export const LOOPBACK_HOST_ALLOWLIST = DEFAULT_LOOPBACK_HOSTS;
