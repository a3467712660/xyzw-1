import { query, run } from "../db/client.js";

export const adminAuditRepository = {
  create({
    id,
    adminUserId,
    action,
    targetType,
    targetId,
    detailJson,
    ip,
    userAgent,
    createdAt,
  }) {
    run(
      `INSERT INTO admin_audit_logs
        (id, admin_user_id, action, target_type, target_id, detail_json, ip, user_agent, created_at)
       VALUES
        ($id, $adminUserId, $action, $targetType, $targetId, $detailJson, $ip, $userAgent, $createdAt)`,
      {
        $id: id,
        $adminUserId: adminUserId,
        $action: action,
        $targetType: targetType,
        $targetId: targetId,
        $detailJson: detailJson,
        $ip: ip,
        $userAgent: userAgent,
        $createdAt: createdAt,
      },
    );
  },

  listRecent(limit) {
    return query(
      `SELECT
        l.id,
        l.action,
        l.target_type as targetType,
        l.target_id as targetId,
        l.detail_json as detailJson,
        l.ip,
        l.user_agent as userAgent,
        l.created_at as createdAt,
        u.username as adminUsername
      FROM admin_audit_logs l
      JOIN users u ON u.id = l.admin_user_id
      ORDER BY l.created_at DESC
      LIMIT $limit`,
      { $limit: limit },
    );
  },

  deleteBefore(cutoffIso) {
    const result = run(
      `DELETE FROM admin_audit_logs
       WHERE created_at < $cutoff`,
      {
        $cutoff: String(cutoffIso || "").trim(),
      },
    );
    return Number(result?.changes || 0);
  },
};
