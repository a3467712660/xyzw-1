import { nowIso } from "../db/sql.js";
import { securityRateLimitRepository } from "../repositories/securityRateLimitRepository.js";

const defaultKeyGenerator = (req) => req.ip || "anonymous";
const toIso = (ms) => new Date(ms).toISOString();
const toTs = (value) => new Date(value).getTime();
const toRateLimitSeconds = (targetTs) =>
  Math.max(1, Math.ceil((Number(targetTs || 0) - Date.now()) / 1000));

const applyRateLimitHeaders = ({
  res,
  max,
  remaining,
  resetAfterSeconds,
  retryAfterSeconds = null,
}) => {
  res.setHeader("RateLimit-Limit", String(Math.max(0, Number(max) || 0)));
  res.setHeader(
    "RateLimit-Remaining",
    String(Math.max(0, Number(remaining) || 0)),
  );
  res.setHeader(
    "RateLimit-Reset",
    String(Math.max(1, Number(resetAfterSeconds) || 1)),
  );
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    res.setHeader("Retry-After", String(Math.max(1, retryAfterSeconds)));
  }
};

export const createRateLimiter = ({
  windowMs,
  max,
  blockMs = 10 * 60 * 1000,
  keyGenerator = defaultKeyGenerator,
  scope = "default",
}) => {
  return (req, res, next) => {
    const nowTs = Date.now();
    const key = `${scope}:${keyGenerator(req)}`;

    const row = securityRateLimitRepository.findByScopeKey(key);

    if (!row) {
      const resetAtTs = nowTs + windowMs;
      securityRateLimitRepository.create({
        scopeKey: key,
        count: 1,
        resetAt: toIso(resetAtTs),
        updatedAt: nowIso(),
      });
      applyRateLimitHeaders({
        res,
        max,
        remaining: max - 1,
        resetAfterSeconds: toRateLimitSeconds(resetAtTs),
      });
      return next();
    }

    const blockUntilTs = row.blockUntil ? toTs(row.blockUntil) : NaN;
    if (Number.isFinite(blockUntilTs) && blockUntilTs > nowTs) {
      const retryAfter = Math.ceil((blockUntilTs - nowTs) / 1000);
      applyRateLimitHeaders({
        res,
        max,
        remaining: 0,
        resetAfterSeconds: retryAfter,
        retryAfterSeconds: retryAfter,
      });
      return res.status(429).json({
        success: false,
        message: "请求过于频繁，请稍后重试",
        retryAfter,
      });
    }

    const resetAtTs = toTs(row.resetAt);
    if (!Number.isFinite(resetAtTs) || resetAtTs <= nowTs) {
      const nextResetAtTs = nowTs + windowMs;
      securityRateLimitRepository.resetWindow({
        scopeKey: key,
        count: 1,
        resetAt: toIso(nextResetAtTs),
        updatedAt: nowIso(),
      });
      applyRateLimitHeaders({
        res,
        max,
        remaining: max - 1,
        resetAfterSeconds: toRateLimitSeconds(nextResetAtTs),
      });
      return next();
    }

    const count = Number(row.count) || 0;
    if (count >= max) {
      const nextBlockUntil = toIso(nowTs + blockMs);
      securityRateLimitRepository.setBlockUntil({
        scopeKey: key,
        blockUntil: nextBlockUntil,
        updatedAt: nowIso(),
      });

      const retryAfter = Math.ceil(blockMs / 1000);
      applyRateLimitHeaders({
        res,
        max,
        remaining: 0,
        resetAfterSeconds: retryAfter,
        retryAfterSeconds: retryAfter,
      });
      return res.status(429).json({
        success: false,
        message: "请求过于频繁，请稍后重试",
        retryAfter,
      });
    }

    securityRateLimitRepository.updateCount({
      scopeKey: key,
      count: count + 1,
      updatedAt: nowIso(),
    });
    applyRateLimitHeaders({
      res,
      max,
      remaining: max - (count + 1),
      resetAfterSeconds: toRateLimitSeconds(resetAtTs),
    });
    return next();
  };
};
