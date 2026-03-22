import { getOne, nowIso, randomId, run, secureId } from "../db/sql.js";

export const binDownloadRepository = {
  createDownloadTicket({
    id = secureId("bdt"),
    userId,
    tokenId,
    expiresAt,
    createdAt = nowIso(),
    createdIp = null,
    createdUserAgent = null,
  }) {
    run(
      `INSERT INTO bin_download_tickets (
        id, user_id, token_id, expires_at, used_at, used_ip, used_user_agent, created_ip, created_user_agent, created_at
      ) VALUES (
        $id, $userId, $tokenId, $expiresAt, NULL, NULL, NULL, $createdIp, $createdUserAgent, $createdAt
      )`,
      {
        $id: id,
        $userId: userId,
        $tokenId: tokenId,
        $expiresAt: expiresAt,
        $createdIp: createdIp,
        $createdUserAgent: createdUserAgent,
        $createdAt: createdAt,
      },
    );

    return {
      id,
      userId,
      tokenId,
      expiresAt,
      createdAt,
    };
  },

  consumeDownloadTicket({
    id,
    userId,
    tokenId,
    usedAt = nowIso(),
    usedIp = null,
    usedUserAgent = null,
  }) {
    const result = run(
      `UPDATE bin_download_tickets
       SET used_at = $usedAt,
           used_ip = $usedIp,
           used_user_agent = $usedUserAgent
       WHERE id = $id
         AND user_id = $userId
         AND token_id = $tokenId
         AND used_at IS NULL
         AND expires_at > $usedAt`,
      {
        $id: id,
        $userId: userId,
        $tokenId: tokenId,
        $usedAt: usedAt,
        $usedIp: usedIp,
        $usedUserAgent: usedUserAgent,
      },
    );
    return Number(result?.changes || 0) > 0;
  },

  findDownloadTicketById(id) {
    return getOne(
      `SELECT
        id,
        user_id as userId,
        token_id as tokenId,
        expires_at as expiresAt,
        used_at as usedAt,
        used_ip as usedIp,
        used_user_agent as usedUserAgent,
        created_ip as createdIp,
        created_user_agent as createdUserAgent,
        created_at as createdAt
      FROM bin_download_tickets
      WHERE id = $id`,
      { $id: id },
    );
  },

  createDownloadAudit({
    id = randomId("bda"),
    userId,
    tokenId,
    action,
    result,
    message = null,
    ip = null,
    userAgent = null,
    createdAt = nowIso(),
  }) {
    run(
      `INSERT INTO bin_download_audits (
        id, user_id, token_id, action, result, message, ip, user_agent, created_at
      ) VALUES (
        $id, $userId, $tokenId, $action, $result, $message, $ip, $userAgent, $createdAt
      )`,
      {
        $id: id,
        $userId: userId,
        $tokenId: tokenId,
        $action: action,
        $result: result,
        $message: message,
        $ip: ip,
        $userAgent: userAgent,
        $createdAt: createdAt,
      },
    );
  },

  deleteAuditsBefore(cutoffIso) {
    const result = run(
      `DELETE FROM bin_download_audits
       WHERE created_at < $cutoff`,
      {
        $cutoff: String(cutoffIso || "").trim(),
      },
    );
    return Number(result?.changes || 0);
  },

  deleteExpiredTicketsBefore(cutoffIso) {
    const result = run(
      `DELETE FROM bin_download_tickets
       WHERE expires_at < $cutoff`,
      {
        $cutoff: String(cutoffIso || "").trim(),
      },
    );
    return Number(result?.changes || 0);
  },
};
