import { query, run } from "../db/client.js";

export const notificationRepository = {
  create({ id, userId, type, title, content, payloadJson, createdAt }) {
    run(
      `INSERT INTO user_notifications
        (id, user_id, type, title, content, payload_json, is_read, read_at, created_at)
       VALUES
        ($id, $userId, $type, $title, $content, $payloadJson, 0, NULL, $createdAt)`,
      {
        $id: id,
        $userId: userId,
        $type: type,
        $title: title,
        $content: content,
        $payloadJson: payloadJson,
        $createdAt: createdAt,
      },
    );
  },

  listByUser({ userId, unreadOnly, limit }) {
    return query(
      `SELECT
        id,
        type,
        title,
        content,
        payload_json as payloadJson,
        is_read as isRead,
        read_at as readAt,
        created_at as createdAt
      FROM user_notifications
      WHERE user_id = $userId
        ${unreadOnly ? "AND is_read = 0" : ""}
      ORDER BY created_at DESC
      LIMIT ${limit}`,
      { $userId: userId },
    );
  },

  markRead({ id, userId, readAt }) {
    run(
      `UPDATE user_notifications
       SET is_read = 1,
           read_at = $readAt
       WHERE id = $id AND user_id = $userId`,
      {
        $id: id,
        $userId: userId,
        $readAt: readAt,
      },
    );
  },

  markAllRead({ userId, readAt }) {
    run(
      `UPDATE user_notifications
       SET is_read = 1,
           read_at = $readAt
       WHERE user_id = $userId AND is_read = 0`,
      {
        $userId: userId,
        $readAt: readAt,
      },
    );
  },

  deleteReadBefore(cutoffIso) {
    const result = run(
      `DELETE FROM user_notifications
       WHERE is_read = 1
         AND read_at IS NOT NULL
         AND read_at < $cutoff`,
      {
        $cutoff: String(cutoffIso || "").trim(),
      },
    );
    return Number(result?.changes || 0);
  },
};
