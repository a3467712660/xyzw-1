const TOKEN_IMPORT_LAUNCH_PAYLOAD_KEY = "xyzw:token-import:launch-payload";
const TOKEN_IMPORT_ROUTE_NOTICE_KEY = "xyzw:token-import:route-notice";
const SAFE_TOKEN_IMPORT_QUERY_KEYS = ["name", "server", "auto"];

const hasSessionStorage = () =>
  typeof window !== "undefined" && Boolean(window.sessionStorage);

const normalizeQueryValue = (value) => {
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }
  return String(value || "").trim();
};

const readSessionItem = (key) => {
  if (!hasSessionStorage()) {
    return "";
  }
  try {
    return String(window.sessionStorage.getItem(key) || "");
  } catch {
    return "";
  }
};

const writeSessionItem = (key, value) => {
  if (!hasSessionStorage()) {
    return false;
  }
  try {
    window.sessionStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const removeSessionItem = (key) => {
  if (!hasSessionStorage()) {
    return;
  }
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // ignore
  }
};

export const extractSensitiveTokenImportQuery = (query = {}) => {
  const api = normalizeQueryValue(query.api);
  const wsUrl = normalizeQueryValue(query.wsUrl);
  return {
    api,
    wsUrl,
    hasSensitiveParams: Boolean(api || wsUrl),
  };
};

export const getSanitizedTokenImportQuery = (query = {}) => {
  const sanitized = {};
  SAFE_TOKEN_IMPORT_QUERY_KEYS.forEach((key) => {
    const value = normalizeQueryValue(query[key]);
    if (value) {
      sanitized[key] = value;
    }
  });
  return sanitized;
};

export const stashTokenImportLaunchPayload = (payload = {}) => {
  const api = String(payload.api || "").trim();
  const wsUrl = String(payload.wsUrl || "").trim();
  const name = String(payload.name || "").trim();
  const server = String(payload.server || "").trim();
  const auto = payload.auto === true;

  if (!api && !wsUrl) {
    return false;
  }

  return writeSessionItem(
    TOKEN_IMPORT_LAUNCH_PAYLOAD_KEY,
    JSON.stringify({
      ...(api ? { api } : {}),
      ...(wsUrl ? { wsUrl } : {}),
      ...(name ? { name } : {}),
      ...(server ? { server } : {}),
      ...(auto ? { auto: true } : {}),
    }),
  );
};

export const consumeTokenImportLaunchPayload = () => {
  const raw = readSessionItem(TOKEN_IMPORT_LAUNCH_PAYLOAD_KEY);
  removeSessionItem(TOKEN_IMPORT_LAUNCH_PAYLOAD_KEY);
  if (!raw) {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

export const stashTokenImportRouteNotice = (type) => {
  const normalized = String(type || "").trim();
  if (!normalized) {
    return false;
  }
  return writeSessionItem(TOKEN_IMPORT_ROUTE_NOTICE_KEY, normalized);
};

export const consumeTokenImportRouteNotice = () => {
  const notice = readSessionItem(TOKEN_IMPORT_ROUTE_NOTICE_KEY);
  removeSessionItem(TOKEN_IMPORT_ROUTE_NOTICE_KEY);
  return notice;
};
