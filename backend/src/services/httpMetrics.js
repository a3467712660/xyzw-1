import client from "prom-client";
import { resolveRequestRoute } from "../lib/logger.js";

const NOOP_MIDDLEWARE = (_req, _res, next) => next();

export const createHttpMetrics = ({ enabled = false } = {}) => {
  if (!enabled) {
    return {
      enabled: false,
      middleware: NOOP_MIDDLEWARE,
      async render() {
        return "";
      },
      contentType: "text/plain; version=0.0.4",
    };
  }

  const registry = new client.Registry();
  const requestCounter = new client.Counter({
    name: "xyzw_http_requests_total",
    help: "Total number of HTTP requests handled by the backend",
    labelNames: ["route", "method", "status_code"],
    registers: [registry],
  });
  const requestDuration = new client.Histogram({
    name: "xyzw_http_request_duration_ms",
    help: "HTTP request duration in milliseconds",
    labelNames: ["route", "method", "status_code"],
    buckets: [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    registers: [registry],
  });
  const rateLimitedCounter = new client.Counter({
    name: "xyzw_http_rate_limited_total",
    help: "Total number of HTTP responses blocked by rate limiting",
    labelNames: ["route", "method"],
    registers: [registry],
  });

  const middleware = (req, res, next) => {
    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const route = resolveRequestRoute(req);
      const method = String(req.method || "").toUpperCase();
      const statusCode = String(res.statusCode || 0);
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      requestCounter.inc({
        route,
        method,
        status_code: statusCode,
      });
      requestDuration.observe(
        {
          route,
          method,
          status_code: statusCode,
        },
        durationMs,
      );
      if (Number(res.statusCode || 0) === 429) {
        rateLimitedCounter.inc({ route, method });
      }
    });
    next();
  };

  return {
    enabled: true,
    registry,
    middleware,
    async render() {
      return registry.metrics();
    },
    contentType: registry.contentType,
  };
};
