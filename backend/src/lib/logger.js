import crypto from "node:crypto";
import pino from "pino";
import pinoHttp from "pino-http";
import { env } from "../config/env.js";
import { redactUrl, sanitizeForLog } from "./logRedactor.js";

const readRequestId = (req) => {
  const headerValue = req.headers["x-request-id"];
  if (Array.isArray(headerValue)) {
    return String(headerValue[0] || "").trim();
  }
  return String(headerValue || "").trim();
};

export const resolveRequestRoute = (req) => {
  const baseUrl = String(req.baseUrl || "").trim();
  const routePath = typeof req.route?.path === "string"
    ? String(req.route.path || "").trim()
    : "";
  if (baseUrl && routePath) {
    return `${baseUrl}${routePath}`;
  }
  if (routePath) {
    return routePath;
  }
  if (req.path) {
    return String(req.path || "").split("?")[0];
  }
  return String(req.originalUrl || req.url || "").split("?")[0] || "/";
};

export const hashIp = (ipAddress) => {
  const raw = String(ipAddress || "").trim();
  if (!raw) {
    return null;
  }
  return crypto
    .createHmac("sha256", env.jwtSecret)
    .update(`request-ip:${raw}`)
    .digest("hex");
};

const resolveRole = (req) => {
  if (!req.auth?.user) {
    return null;
  }
  if (req.auth.user.isAdmin) {
    return "admin";
  }
  return "user";
};

export const buildHttpLogContext = ({
  req,
  res,
  durationMs = null,
}) => ({
  requestId: String(req.id || readRequestId(req) || "").trim() || null,
  route: resolveRequestRoute(req),
  method: String(req.method || "").toUpperCase(),
  status: Number(res?.statusCode || 0),
  durationMs:
    Number.isFinite(durationMs) && durationMs >= 0
      ? Number(durationMs.toFixed(3))
      : null,
  userId: req.auth?.user?.id || null,
  role: resolveRole(req),
  ipHash: hashIp(req.ip || req.socket?.remoteAddress || ""),
  url: redactUrl(req.originalUrl || req.url || ""),
});

export const createAppLogger = ({ stream } = {}) =>
  pino(
    {
      level: env.nodeEnv === "test" ? "debug" : "info",
      base: undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label) => ({ level: label }),
      },
    },
    stream,
  );

export const createRequestContextMiddleware = ({ logger }) =>
  pinoHttp({
    logger,
    autoLogging: false,
    genReqId(req, res) {
      const incomingId = readRequestId(req);
      const requestId = incomingId || crypto.randomUUID();
      res.setHeader("x-request-id", requestId);
      return requestId;
    },
  });

export const createStructuredRequestLogger = ({ logger }) => {
  return (req, res, next) => {
    if (!env.logRequests) {
      return next();
    }

    if (req.path === "/health" || req.path === "/api/v1/health") {
      return next();
    }

    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      logger.info({
        message: "http_request",
        ...buildHttpLogContext({ req, res, durationMs }),
      });
    });
    return next();
  };
};

export const logHttpError = ({
  logger,
  req,
  res,
  error,
}) => {
  const activeLogger = logger || createAppLogger();
  activeLogger.error({
    message: "http_error",
    ...buildHttpLogContext({ req, res }),
    errorName: sanitizeForLog(error?.name || "Error"),
    errorMessage: sanitizeForLog(error?.message || "unknown error"),
    err: error,
  });
};
