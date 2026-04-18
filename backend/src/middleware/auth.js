import { verifyJwt } from "../lib/crypto.js";
import { userRepository } from "../repositories/userRepository.js";
import { errorResponse } from "../lib/httpResponse.js";
import { parseCookies } from "../lib/cookies.js";
import { env } from "../config/env.js";
import { redactUrl } from "../lib/logRedactor.js";

const AUTH_PREFIX = "Bearer ";
const LEGACY_BEARER_LOG_PREFIX = "[auth] legacy bearer";

export const readBearerTokenFromHeaders = (headers = {}) => {
  const auth = String(headers.authorization || "").trim();
  if (!auth.startsWith(AUTH_PREFIX)) {
    return "";
  }
  return auth.slice(AUTH_PREFIX.length).trim();
};

const readAccessTokenFromCookies = (headers = {}) => {
  const cookies = parseCookies(headers.cookie || "");
  return String(cookies[env.accessCookieName] || "").trim();
};

const logLegacyBearerUsage = ({
  allowed,
  context = "http",
  method = "",
  route = "",
  userId = "",
}) => {
  // eslint-disable-next-line no-console
  console.warn(
    `${LEGACY_BEARER_LOG_PREFIX} allowed=${allowed ? "true" : "false"} context=${String(context || "").trim() || "http"} method=${String(method || "").toUpperCase() || "GET"} route=${redactUrl(route || "")} userId=${String(userId || "").trim() || "unknown"}`,
  );
};

export const readAccessTokenFromRequest = (req, { context = "http" } = {}) => {
  const cookieToken = readAccessTokenFromCookies(req.headers);
  if (cookieToken) {
    return {
      token: cookieToken,
      source: "cookie",
      rejected: false,
    };
  }

  const bearer = readBearerTokenFromHeaders(req.headers);
  if (!bearer) {
    return {
      token: "",
      source: "missing",
      rejected: false,
    };
  }

  if (!env.allowBearerAuthLegacy) {
    logLegacyBearerUsage({
      allowed: false,
      context,
      method: req.method,
      route: req.originalUrl || req.url || "",
    });
    return {
      token: "",
      source: "legacy-bearer-rejected",
      rejected: true,
    };
  }

  return {
    token: bearer,
    source: "legacy-bearer",
    rejected: false,
  };
};

export const loadUserByToken = (token) => {
  const payload = verifyJwt(token);
  const user = userRepository.findById(payload.sub);

  if (!user) {
    return { payload, user: null };
  }

  return {
    payload,
    user: {
      ...user,
      avatar: "/icons/xiaoyugan.png",
    },
  };
};

export const isTrialExpired = (user) =>
  Boolean(
    user?.trialExpiresAt
      && Number.isFinite(new Date(user.trialExpiresAt).getTime())
      && new Date(user.trialExpiresAt).getTime() < Date.now(),
  );

const isTokenVersionValid = (payload, user) => {
  const tokenVersion = Number(payload?.ver);
  const currentVersion = Number(user?.tokenVersion ?? 0);
  if (!Number.isInteger(currentVersion) || currentVersion < 0) return false;
  if (!Number.isInteger(tokenVersion) || tokenVersion < 0) return false;
  return tokenVersion === currentVersion;
};

const createAuthError = (status, code, message) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.publicMessage = message;
  return error;
};

export const assertValidAccessToken = (token) => {
  if (!token) {
    throw createAuthError(401, "AUTH_MISSING_TOKEN", "未登录或登录信息缺失");
  }

  let loaded;
  try {
    loaded = loadUserByToken(token);
  } catch {
    throw createAuthError(401, "AUTH_INVALID_TOKEN", "登录状态无效或已过期");
  }

  const { payload, user } = loaded;
  if (!user) {
    throw createAuthError(401, "AUTH_USER_NOT_FOUND", "用户不存在或已失效");
  }
  if (!isTokenVersionValid(payload, user)) {
    throw createAuthError(401, "AUTH_TOKEN_REVOKED", "登录状态已失效，请重新登录");
  }
  if (isTrialExpired(user)) {
    throw createAuthError(403, "AUTH_TRIAL_EXPIRED", "账号试用已到期，请联系管理员");
  }

  return {
    payload,
    user,
  };
};

export const authRequired = (req, res, next) => {
  const tokenState = readAccessTokenFromRequest(req, { context: "http" });

  if (tokenState.rejected) {
    return errorResponse(
      res,
      401,
      "AUTH_INVALID_TOKEN",
      "登录状态无效或已过期",
    );
  }

  try {
    const { payload, user } = assertValidAccessToken(tokenState.token);

    if (tokenState.source === "legacy-bearer") {
      logLegacyBearerUsage({
        allowed: true,
        context: "http",
        method: req.method,
        route: req.originalUrl || req.url || "",
        userId: user.id,
      });
    }

    req.auth = {
      user,
      tokenPayload: payload,
    };
    return next();
  } catch (error) {
    if (error?.code && error?.status && error?.publicMessage) {
      return errorResponse(
        res,
        Number(error.status),
        String(error.code),
        String(error.publicMessage),
      );
    }

    // eslint-disable-next-line no-console
    console.warn(
      `[auth] invalid token rejected: ${error?.message || "unknown"} (${req.method} ${redactUrl(req.originalUrl || req.url || "")})`,
    );
    return errorResponse(
      res,
      401,
      "AUTH_INVALID_TOKEN",
      "登录状态无效或已过期",
    );
  }
};

export const authOptional = (req, _res, next) => {
  const tokenState = readAccessTokenFromRequest(req, { context: "http" });
  if (!tokenState.token || tokenState.rejected) {
    return next();
  }

  try {
    const { payload, user } = assertValidAccessToken(tokenState.token);
    if (tokenState.source === "legacy-bearer") {
      logLegacyBearerUsage({
        allowed: true,
        context: "http",
        method: req.method,
        route: req.originalUrl || req.url || "",
        userId: user.id,
      });
    }
    req.auth = {
      user,
      tokenPayload: payload,
    };
  } catch {
    // ignore invalid optional token
  }

  return next();
};
