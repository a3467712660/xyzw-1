import { query, run } from "../db/client.js";

export const securityEventRepository = {
  create({
    id,
    userId = null,
    eventType,
    detailJson,
    ip = null,
    userAgent = null,
    createdAt,
  }) {
    run(
      `INSERT INTO security_event_logs
        (id, user_id, event_type, detail_json, ip, user_agent, created_at)
       VALUES
        ($id, $userId, $eventType, $detailJson, $ip, $userAgent, $createdAt)`,
      {
        $id: id,
        $userId: userId,
        $eventType: eventType,
        $detailJson: detailJson,
        $ip: ip,
        $userAgent: userAgent,
        $createdAt: createdAt,
      },
    );
  },

  listByUser({ userId, limit, eventType = "" }) {
    const withType = String(eventType || "").trim();
    if (withType) {
      return query(
        `SELECT
          id,
          user_id as userId,
          event_type as eventType,
          detail_json as detailJson,
          ip,
          user_agent as userAgent,
          created_at as createdAt
        FROM security_event_logs
        WHERE user_id = $userId
          AND event_type = $eventType
        ORDER BY created_at DESC
        LIMIT $limit`,
        {
          $userId: userId,
          $eventType: withType,
          $limit: limit,
        },
      );
    }

    return query(
      `SELECT
        id,
        user_id as userId,
        event_type as eventType,
        detail_json as detailJson,
        ip,
        user_agent as userAgent,
        created_at as createdAt
      FROM security_event_logs
      WHERE user_id = $userId
      ORDER BY created_at DESC
      LIMIT $limit`,
      {
        $userId: userId,
        $limit: limit,
      },
    );
  },

  listForAdmin({ limit, eventType = "", userId = "" }) {
    const withType = String(eventType || "").trim();
    const withUserId = String(userId || "").trim();

    if (withType && withUserId) {
      return query(
        `SELECT
          l.id,
          l.user_id as userId,
          u.username,
          l.event_type as eventType,
          l.detail_json as detailJson,
          l.ip,
          l.user_agent as userAgent,
          l.created_at as createdAt
        FROM security_event_logs l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.event_type = $eventType
          AND l.user_id = $userId
        ORDER BY l.created_at DESC
        LIMIT $limit`,
        {
          $eventType: withType,
          $userId: withUserId,
          $limit: limit,
        },
      );
    }

    if (withType) {
      return query(
        `SELECT
          l.id,
          l.user_id as userId,
          u.username,
          l.event_type as eventType,
          l.detail_json as detailJson,
          l.ip,
          l.user_agent as userAgent,
          l.created_at as createdAt
        FROM security_event_logs l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.event_type = $eventType
        ORDER BY l.created_at DESC
        LIMIT $limit`,
        {
          $eventType: withType,
          $limit: limit,
        },
      );
    }

    if (withUserId) {
      return query(
        `SELECT
          l.id,
          l.user_id as userId,
          u.username,
          l.event_type as eventType,
          l.detail_json as detailJson,
          l.ip,
          l.user_agent as userAgent,
          l.created_at as createdAt
        FROM security_event_logs l
        LEFT JOIN users u ON u.id = l.user_id
        WHERE l.user_id = $userId
        ORDER BY l.created_at DESC
        LIMIT $limit`,
        {
          $userId: withUserId,
          $limit: limit,
        },
      );
    }

    return query(
      `SELECT
        l.id,
        l.user_id as userId,
        u.username,
        l.event_type as eventType,
        l.detail_json as detailJson,
        l.ip,
        l.user_agent as userAgent,
        l.created_at as createdAt
      FROM security_event_logs l
      LEFT JOIN users u ON u.id = l.user_id
      ORDER BY l.created_at DESC
      LIMIT $limit`,
      {
        $limit: limit,
      },
    );
  },

  deleteBefore(cutoffIso) {
    const result = run(
      `DELETE FROM security_event_logs
       WHERE created_at < $cutoff`,
      {
        $cutoff: String(cutoffIso || "").trim(),
      },
    );
    return Number(result?.changes || 0);
  },
};
