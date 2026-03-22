import { signJwt, verifyJwt } from "../lib/crypto.js";
import { errorResponse } from "../lib/httpResponse.js";

const DEFAULT_TTL_SECONDS = 5 * 60;

const normalizeHeaderName = (headerName) =>
  String(headerName || "x-sensitive-action-token").trim().toLowerCase();

const readTokenFromHeader = (req, headerName) => {
  const value = req.headers?.[normalizeHeaderName(headerName)];
  if (Array.isArray(value)) {
    return String(value[0] || "").trim();
  }
  return String(value || "").trim();
};

export const issueSensitiveActionToken = ({
  user,
  purpose,
  ttlSeconds,
  ttl,
}) => {
  const safeUser = user || {};
  const safePurpose = String(purpose || "sensitive-action").trim();
  const ttlValue = Number(ttlSeconds ?? ttl);
  const expiresInSeconds = Number.isFinite(ttlValue) && ttlValue > 0
    ? ttlValue
    : DEFAULT_TTL_SECONDS;

  return signJwt(
    {
      sub: safeUser.id,
      ver: Number(safeUser.tokenVersion ?? 0),
      purpose: safePurpose,
    },
    expiresInSeconds,
  );
};

export const sensitiveActionRequired = ({
  purpose,
  headerName,
  codePrefix = "SENSITIVE_ACTION",
  requiredCode,
  invalidCode,
  expiredCode,
  requiredMessage = "敏感操作需要二次确认，请先验证当前密码",
  invalidMessage = "二次确认令牌无效",
  expiredMessage = "二次确认已失效，请重新验证密码",
  getCurrentUser = (req) => req.auth?.user,
} = {}) => {
  const safePurpose = String(purpose || "sensitive-action").trim();
  const safeHeaderName = normalizeHeaderName(headerName);
  const prefix = String(codePrefix || "SENSITIVE_ACTION").trim().toUpperCase();
  const requiredErrorCode = String(requiredCode || `${prefix}_REQUIRED`);
  const invalidErrorCode = String(invalidCode || `${prefix}_INVALID`);
  const expiredErrorCode = String(expiredCode || `${prefix}_EXPIRED`);

  return (req, res, next) => {
    const token = readTokenFromHeader(req, safeHeaderName);
    if (!token) {
      return errorResponse(res, 403, requiredErrorCode, requiredMessage);
    }

    try {
      const payload = verifyJwt(token);
      const currentUser = getCurrentUser(req) || {};

      if (String(payload?.purpose || "") !== safePurpose) {
        return errorResponse(res, 403, invalidErrorCode, invalidMessage);
      }
      if (String(payload?.sub || "") !== String(currentUser?.id || "")) {
        return errorResponse(res, 403, invalidErrorCode, invalidMessage);
      }
      if (Number(payload?.ver) !== Number(currentUser?.tokenVersion ?? 0)) {
        return errorResponse(res, 403, expiredErrorCode, expiredMessage);
      }
      return next();
    } catch {
      return errorResponse(res, 403, expiredErrorCode, expiredMessage);
    }
  };
};

export const makeSensitiveAction = ({
  purpose,
  ttlSeconds,
  headerName,
  ...rest
} = {}) => {
  const safePurpose = String(purpose || "sensitive-action").trim();
  const ttlValue = Number(ttlSeconds);
  const safeTtlSeconds = Number.isFinite(ttlValue) && ttlValue > 0
    ? ttlValue
    : DEFAULT_TTL_SECONDS;
  const required = sensitiveActionRequired({
    purpose: safePurpose,
    headerName,
    ...rest,
  });

  return {
    purpose: safePurpose,
    ttlSeconds: safeTtlSeconds,
    headerName: normalizeHeaderName(headerName),
    issue: (user) => issueSensitiveActionToken({
      user,
      purpose: safePurpose,
      ttlSeconds: safeTtlSeconds,
    }),
    required,
  };
};
