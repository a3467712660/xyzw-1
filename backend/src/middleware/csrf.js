import { env } from "../config/env.js";
import { parseCookies } from "../lib/cookies.js";
import { createCsrfSessionId, createSignedCsrfToken, verifySignedCsrfToken } from "../lib/csrf.js";
import { resolveCookieSecure } from "../lib/cookieSecurity.js";
import { recordSecurityEvent } from "../services/securityEventService.js";

const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const csrfSessionCookieOptions = (req, maxAgeMs) => ({
  httpOnly: true,
  secure: resolveCookieSecure(req, env.csrfCookieSecure),
  sameSite: env.csrfCookieSameSite,
  path: "/",
  ...(env.csrfCookieDomain ? { domain: env.csrfCookieDomain } : {}),
  maxAge: maxAgeMs,
});

const csrfTokenCookieOptions = (req, maxAgeMs) => ({
  httpOnly: false,
  secure: resolveCookieSecure(req, env.csrfCookieSecure),
  sameSite: env.csrfCookieSameSite,
  path: "/",
  ...(env.csrfCookieDomain ? { domain: env.csrfCookieDomain } : {}),
  maxAge: maxAgeMs,
});

const readCookieMap = (req) => {
  if (!req._cookieMap) {
    req._cookieMap = parseCookies(req.headers?.cookie || "");
  }
  return req._cookieMap;
};

const getHeaderValue = (req) => {
  const key = String(env.csrfHeaderName || "x-csrf-token").toLowerCase();
  const value = req.get(key);
  return String(value || "").trim();
};

const csrfTtlMs = Math.max(1, Number(env.csrfCookieTtlDays || 30)) * 24 * 60 * 60 * 1000;

const parseOrigin = (value) => {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw).origin;
  } catch {
    return "";
  }
};

const recordCsrfFailure = (req, reason) => {
  try {
    recordSecurityEvent({
      userId: null,
      eventType: "csrf_validation_failed",
      detail: {
        reason: String(reason || "unknown"),
        method: String(req.method || "").toUpperCase(),
        path: String(req.path || req.originalUrl || ""),
        origin: parseOrigin(req.get("origin")),
        refererOrigin: parseOrigin(req.get("referer")),
      },
      ip: req.ip || null,
      userAgent: req.headers?.["user-agent"] || null,
    });
  } catch {
    // ignore security event write failures
  }
};

export const clearCsrfCookies = (req, res) => {
  res.clearCookie(env.csrfSessionCookieName, csrfSessionCookieOptions(req, 0));
  res.clearCookie(env.csrfCookieName, csrfTokenCookieOptions(req, 0));
};

export const ensureCsrfCookies = (req, res) => {
  const cookies = readCookieMap(req);
  let sessionId = String(cookies[env.csrfSessionCookieName] || "").trim();
  const cookieToken = String(cookies[env.csrfCookieName] || "").trim();

  if (!sessionId) {
    sessionId = createCsrfSessionId();
    res.cookie(
      env.csrfSessionCookieName,
      sessionId,
      csrfSessionCookieOptions(req, csrfTtlMs),
    );
  }

  const tokenValid = verifySignedCsrfToken({
    token: cookieToken,
    sessionId,
    secret: env.csrfSecret,
  });

  if (!tokenValid) {
    const nextToken = createSignedCsrfToken({
      sessionId,
      secret: env.csrfSecret,
    });
    res.cookie(
      env.csrfCookieName,
      nextToken,
      csrfTokenCookieOptions(req, csrfTtlMs),
    );
    req.csrfToken = nextToken;
  } else {
    req.csrfToken = cookieToken;
  }
  req.csrfSessionId = sessionId;
};

export const csrfProtection = ({
  excludePaths = [],
} = {}) => {
  const excluded = new Set(excludePaths.map((item) => String(item || "").trim()).filter(Boolean));

  return (req, res, next) => {
    ensureCsrfCookies(req, res);
    const method = String(req.method || "").toUpperCase();
    if (method === "OPTIONS" || !UNSAFE_METHODS.has(method)) {
      return next();
    }

    const reqPath = String(req.path || req.originalUrl || "").trim();
    if (excluded.has(reqPath)) {
      return next();
    }

    const cookies = readCookieMap(req);
    const sessionId = String(cookies[env.csrfSessionCookieName] || req.csrfSessionId || "").trim();
    const csrfCookieToken = String(cookies[env.csrfCookieName] || "").trim();
    const csrfHeaderToken = getHeaderValue(req);
    const headerMatchesCookie = Boolean(
      csrfHeaderToken
      && csrfCookieToken
      && csrfHeaderToken === csrfCookieToken,
    );

    if (!headerMatchesCookie) {
      recordCsrfFailure(req, "header_cookie_mismatch");
      return res.status(403).json({
        success: false,
        message: "CSRF 校验失败，请刷新页面后重试",
      });
    }

    const isValid = verifySignedCsrfToken({
      token: csrfHeaderToken,
      sessionId,
      secret: env.csrfSecret,
    });
    if (!isValid) {
      recordCsrfFailure(req, "invalid_or_expired_token");
      return res.status(403).json({
        success: false,
        message: "CSRF 校验失败，请刷新页面后重试",
      });
    }

    return next();
  };
};
