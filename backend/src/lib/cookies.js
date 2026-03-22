export const parseCookies = (rawCookieHeader) => {
  const pairs = String(rawCookieHeader || "").split(";");
  const result = {};
  pairs.forEach((segment) => {
    const part = String(segment || "").trim();
    if (!part) return;
    const separator = part.indexOf("=");
    if (separator <= 0) return;
    let key = part.slice(0, separator).trim();
    let value = part.slice(separator + 1).trim();
    try {
      key = decodeURIComponent(key);
      value = decodeURIComponent(value);
    } catch {
      // ignore malformed cookie encoding
    }
    if (result[key] === undefined) {
      result[key] = value;
    }
  });
  return result;
};
