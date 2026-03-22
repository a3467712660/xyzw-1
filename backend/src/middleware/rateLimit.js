import { nowIso } from "../db/sql.js";
import { securityRateLimitRepository } from "../repositories/securityRateLimitRepository.js";

const defaultKeyGenerator = (req) => req.ip || "anonymous";
const toIso = (ms) => new Date(ms).toISOString();
const toTs = (value) => new Date(value).getTime();

const cleanupExpiredRows = (scopePrefix, nowTs) => {
  const cleanupBefore = new Date(nowTs - 24 * 60 * 60 * 1000).toISOString();
  securityRateLimitRepository.cleanupExpired({ scopePrefix, cleanupBefore });
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
      securityRateLimitRepository.create({
        scopeKey: key,
        count: 1,
        resetAt: toIso(nowTs + windowMs),
        updatedAt: nowIso(),
      });
      cleanupExpiredRows(scope, nowTs);
      return next();
    }

    const blockUntilTs = row.blockUntil ? toTs(row.blockUntil) : NaN;
    if (Number.isFinite(blockUntilTs) && blockUntilTs > nowTs) {
      const retryAfter = Math.ceil((blockUntilTs - nowTs) / 1000);
      return res.status(429).json({
        success: false,
        message: "请求过于频繁，请稍后重试",
        retryAfter,
      });
    }

    const resetAtTs = toTs(row.resetAt);
    if (!Number.isFinite(resetAtTs) || resetAtTs <= nowTs) {
      securityRateLimitRepository.resetWindow({
        scopeKey: key,
        count: 1,
        resetAt: toIso(nowTs + windowMs),
        updatedAt: nowIso(),
      });
      cleanupExpiredRows(scope, nowTs);
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
    return next();
  };
};
