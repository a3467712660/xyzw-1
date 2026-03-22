const TRUSTED_HOSTS = new Set(["xyzw.xq5007.fun"]);

const toAbsoluteUrl = (rawUrl) => {
  const value = String(rawUrl || "").trim();
  if (!value || typeof window === "undefined") {
    return null;
  }

  try {
    return new URL(value, window.location.origin);
  } catch {
    return null;
  }
};

export const isTrustedTokenImportUrl = (rawUrl) => {
  const parsed = toAbsoluteUrl(rawUrl);
  if (!parsed || typeof window === "undefined") {
    return false;
  }

  const isSameOrigin = parsed.origin === window.location.origin;
  const isLocalhost
    = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  const isTrustedHost = TRUSTED_HOSTS.has(parsed.hostname);
  return isSameOrigin || isLocalhost || isTrustedHost;
};

const buildRequestOptions = (url) => {
  if (typeof window === "undefined") {
    return {
      method: "GET",
      headers: { Accept: "application/json" },
    };
  }

  if (url.origin === window.location.origin) {
    return {
      method: "GET",
      headers: { Accept: "application/json" },
    };
  }

  return {
    method: "GET",
    headers: { Accept: "application/json" },
    mode: "cors",
  };
};

const normalizeScalar = (value) => {
  if (typeof value === "string")
    return value.trim();
  if (typeof value === "number" || typeof value === "boolean")
    return String(value).trim();
  return "";
};

const isMaskedToken = (token) => {
  const value = String(token || "").trim();
  if (!value)
    return false;
  if (value.includes("***"))
    return true;
  return /^[\w-]{2,12}\*{3,}[\w-]{2,12}$/.test(value);
};

const buildTokenFromRolePayload = (payload) => {
  if (!payload || typeof payload !== "object")
    return "";
  const roleToken = normalizeScalar(payload.roleToken || payload.role_token);
  if (!roleToken)
    return "";
  const hasRuntimeIds = payload.sessId !== undefined || payload.connId !== undefined;
  if (!hasRuntimeIds) {
    return roleToken;
  }
  return JSON.stringify({
    roleToken,
    sessId: payload.sessId,
    connId: payload.connId,
    isRestore: payload.isRestore ?? 0,
  });
};

const extractTokenFromObject = (obj) => {
  if (!obj || typeof obj !== "object")
    return "";

  const directCandidates = [
    obj.token,
    obj.gameToken,
    obj.game_token,
    obj.accessToken,
    obj.access_token,
  ];
  for (const candidate of directCandidates) {
    const value = normalizeScalar(candidate);
    if (value) {
      return value;
    }
  }

  if (obj.token && typeof obj.token === "object") {
    const nested = extractTokenFromObject(obj.token);
    if (nested) {
      return nested;
    }
    const rolePayloadToken = buildTokenFromRolePayload(obj.token);
    if (rolePayloadToken) {
      return rolePayloadToken;
    }
  }

  const rolePayloadToken = buildTokenFromRolePayload(obj);
  if (rolePayloadToken) {
    return rolePayloadToken;
  }

  if (Array.isArray(obj.tokenParts) && obj.tokenParts.length > 0) {
    const merged = obj.tokenParts.map((part) => normalizeScalar(part)).join("").trim();
    if (merged) {
      return merged;
    }
  }

  const segmentedEntries = Object.entries(obj)
    .filter(([key, value]) => /^token([_-]?part)?[_-]?\d+$/i.test(key) && value !== undefined && value !== null)
    .sort((a, b) => {
      const aNum = Number(String(a[0]).match(/(\d+)$/)?.[1] || 0);
      const bNum = Number(String(b[0]).match(/(\d+)$/)?.[1] || 0);
      return aNum - bNum;
    });
  if (segmentedEntries.length > 0) {
    const merged = segmentedEntries
      .map(([, value]) => normalizeScalar(value))
      .join("")
      .trim();
    if (merged) {
      return merged;
    }
  }

  return "";
};

const normalizeTokenResponse = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("接口返回数据格式不正确");
  }

  const candidateContainers = [
    payload,
    payload.data,
    payload.result,
    payload.payload,
  ].filter((item) => item && typeof item === "object");

  for (const container of candidateContainers) {
    const extracted = extractTokenFromObject(container);
    if (!extracted) {
      continue;
    }
    if (isMaskedToken(extracted)) {
      throw new Error("后端返回的是脱敏 token，无法用于登录，请返回完整 token");
    }
    return {
      ...payload,
      ...container,
      token: extracted,
    };
  }

  throw new Error("响应中缺少 token 字段");
};

export const fetchTokenPayloadFromUrl = async (rawUrl, options = {}) => {
  const {
    trustedOnly = false,
    useProxy = false,
  } = options;

  const parsed = toAbsoluteUrl(rawUrl);
  if (!parsed) {
    throw new Error("URL 无效");
  }

  if (trustedOnly && !isTrustedTokenImportUrl(parsed.toString())) {
    throw new Error("仅允许同源或受信任 API 地址");
  }

  let requestUrl = parsed.toString();
  let requestOptions = buildRequestOptions(parsed);

  if (useProxy && typeof window !== "undefined" && parsed.origin !== window.location.origin) {
    if (!isTrustedTokenImportUrl(parsed.toString())) {
      throw new Error("代理模式仅允许同源、localhost 或受信任域名");
    }
    requestUrl = `/api/proxy?url=${encodeURIComponent(parsed.toString())}`;
    requestOptions = {
      method: "GET",
      headers: { Accept: "application/json" },
    };
  }

  const response = await fetch(requestUrl, requestOptions);
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status} ${response.statusText}`);
    error.status = response.status;
    error.statusText = response.statusText;
    throw error;
  }

  const data = await response.json();
  return normalizeTokenResponse(data);
};
