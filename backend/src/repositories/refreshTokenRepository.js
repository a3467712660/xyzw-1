import { query, run } from "../db/client.js";

export const refreshTokenRepository = {
  create({
    id,
    userId,
    tokenHash,
    tokenVersion,
    expiresAt,
    createdAt,
    createdIp = null,
    createdUserAgent = null,
  }) {
    run(
      `INSERT INTO refresh_tokens (
        id,
        user_id,
        token_hash,
        token_version,
        expires_at,
        revoked_at,
        replaced_by_id,
        created_at,
        last_used_at,
        created_ip,
        created_user_agent,
        last_used_ip,
        last_used_user_agent
      ) VALUES (
        $id,
        $userId,
        $tokenHash,
        $tokenVersion,
        $expiresAt,
        NULL,
        NULL,
        $createdAt,
        NULL,
        $createdIp,
        $createdUserAgent,
        NULL,
        NULL
      )`,
      {
        $id: id,
        $userId: userId,
        $tokenHash: tokenHash,
        $tokenVersion: Number(tokenVersion ?? 0),
        $expiresAt: expiresAt,
        $createdAt: createdAt,
        $createdIp: createdIp,
        $createdUserAgent: createdUserAgent,
      },
    );
  },

  findById(id) {
    const rows = query(
      `SELECT
        id,
        user_id as userId,
        token_hash as tokenHash,
        token_version as tokenVersion,
        expires_at as expiresAt,
        revoked_at as revokedAt,
        replaced_by_id as replacedById,
        created_at as createdAt,
        last_used_at as lastUsedAt,
        created_ip as createdIp,
        created_user_agent as createdUserAgent,
        last_used_ip as lastUsedIp,
        last_used_user_agent as lastUsedUserAgent
      FROM refresh_tokens
      WHERE id = $id
      LIMIT 1`,
      { $id: id },
    );
    return rows[0] || null;
  },

  revokeById({ id, revokedAt, replacedById = null, lastUsedAt = null, lastUsedIp = null, lastUsedUserAgent = null }) {
    run(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, $revokedAt),
           replaced_by_id = COALESCE($replacedById, replaced_by_id),
           last_used_at = COALESCE($lastUsedAt, last_used_at),
           last_used_ip = COALESCE($lastUsedIp, last_used_ip),
           last_used_user_agent = COALESCE($lastUsedUserAgent, last_used_user_agent)
       WHERE id = $id`,
      {
        $id: id,
        $revokedAt: revokedAt,
        $replacedById: replacedById,
        $lastUsedAt: lastUsedAt,
        $lastUsedIp: lastUsedIp,
        $lastUsedUserAgent: lastUsedUserAgent,
      },
    );
  },

  revokeAllByUserId({ userId, revokedAt }) {
    run(
      `UPDATE refresh_tokens
       SET revoked_at = COALESCE(revoked_at, $revokedAt)
       WHERE user_id = $userId
         AND revoked_at IS NULL`,
      {
        $userId: userId,
        $revokedAt: revokedAt,
      },
    );
  },

  deleteExpired({ now }) {
    run(
      `DELETE FROM refresh_tokens
       WHERE expires_at <= $now`,
      { $now: now },
    );
  },
};
