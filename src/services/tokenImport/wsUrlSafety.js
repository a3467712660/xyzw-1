const OFFICIAL_WS_HOSTS = new Set([
  "xxz-xyzw.hortorgames.com",
]);

export const analyzeWsUrlSafety = (rawValue) => {
  const value = String(rawValue || "").trim();
  if (!value) {
    return {
      isCustom: false,
      isValid: true,
      isOfficial: true,
      hostname: "",
      shouldWarn: false,
    };
  }

  try {
    const parsed = new URL(value);
    const protocol = String(parsed.protocol || "").toLowerCase();
    const isWsProtocol = protocol === "ws:" || protocol === "wss:";
    const hostname = String(parsed.hostname || "").toLowerCase();
    const isOfficial = isWsProtocol && OFFICIAL_WS_HOSTS.has(hostname);
    return {
      isCustom: true,
      isValid: isWsProtocol,
      isOfficial,
      hostname,
      shouldWarn: !isOfficial,
    };
  } catch {
    return {
      isCustom: true,
      isValid: false,
      isOfficial: false,
      hostname: "",
      shouldWarn: true,
    };
  }
};
