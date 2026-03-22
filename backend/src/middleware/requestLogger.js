import { env } from "../config/env.js";
import { redactUrl } from "../lib/logRedactor.js";

export const requestLogger = (req, res, next) => {
  if (!env.logRequests) {
    return next();
  }

  if (req.path === "/health") {
    return next();
  }

  const startedAt = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - startedAt;
    // eslint-disable-next-line no-console
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${redactUrl(req.originalUrl)} ${res.statusCode} ${ms}ms`,
    );
  });

  return next();
};
