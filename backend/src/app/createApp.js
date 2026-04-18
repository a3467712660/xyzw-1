import express from "express";
import { env } from "../config/env.js";
import { registerMiddleware } from "./registerMiddleware.js";
import { registerRoutes } from "./registerRoutes.js";
import { registerErrorHandler } from "./registerErrorHandler.js";
import { createAppLogger } from "../lib/logger.js";
import { createHttpMetrics } from "../services/httpMetrics.js";

export function createApp(options = {}) {
  const app = express();
  const logger = createAppLogger({ stream: options.logStream });
  const metrics = createHttpMetrics({
    enabled:
      typeof options.metricsEnabled === "boolean"
        ? options.metricsEnabled
        : env.metricsEnabled,
  });
  const { corsOriginSet } = registerMiddleware(app, { logger, metrics });
  registerRoutes(app, { metrics });
  registerErrorHandler(app, { logger });
  return {
    app,
    corsOriginSet,
    logger,
    metrics,
  };
}
