import { query, run } from "../db/client.js";

export const securityRateLimitRepository = {
  cleanupExpired({ scopePrefix, cleanupBefore }) {
    run(
      `DELETE FROM security_rate_limits
       WHERE scope_key LIKE $scope AND reset_at < $cleanupBefore`,
      {
        $scope: `${scopePrefix}:%`,
        $cleanupBefore: cleanupBefore,
      },
    );
  },

  findByScopeKey(scopeKey) {
    const rows = query(
      `SELECT
        scope_key as scopeKey,
        count,
        reset_at as resetAt,
        block_until as blockUntil
      FROM security_rate_limits
      WHERE scope_key = $scopeKey`,
      { $scopeKey: scopeKey },
    );

    return rows[0] || null;
  },

  create({ scopeKey, count, resetAt, updatedAt }) {
    run(
      `INSERT INTO security_rate_limits
        (scope_key, count, reset_at, block_until, updated_at)
       VALUES
        ($scopeKey, $count, $resetAt, NULL, $updatedAt)`,
      {
        $scopeKey: scopeKey,
        $count: count,
        $resetAt: resetAt,
        $updatedAt: updatedAt,
      },
    );
  },

  resetWindow({ scopeKey, count, resetAt, updatedAt }) {
    run(
      `UPDATE security_rate_limits
       SET count = $count,
           reset_at = $resetAt,
           block_until = NULL,
           updated_at = $updatedAt
       WHERE scope_key = $scopeKey`,
      {
        $scopeKey: scopeKey,
        $count: count,
        $resetAt: resetAt,
        $updatedAt: updatedAt,
      },
    );
  },

  setBlockUntil({ scopeKey, blockUntil, updatedAt }) {
    run(
      `UPDATE security_rate_limits
       SET block_until = $blockUntil,
           updated_at = $updatedAt
       WHERE scope_key = $scopeKey`,
      {
        $scopeKey: scopeKey,
        $blockUntil: blockUntil,
        $updatedAt: updatedAt,
      },
    );
  },

  updateCount({ scopeKey, count, updatedAt }) {
    run(
      `UPDATE security_rate_limits
       SET count = $count,
           updated_at = $updatedAt
       WHERE scope_key = $scopeKey`,
      {
        $scopeKey: scopeKey,
        $count: count,
        $updatedAt: updatedAt,
      },
    );
  },
};
