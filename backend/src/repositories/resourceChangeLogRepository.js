import { query, run, transaction } from "../db/client.js";

export const resourceChangeLogRepository = {
  listByUser(userId) {
    return query(
      `SELECT scope_key as scopeKey, payload_json as payloadJson, updated_at as updatedAt
       FROM resource_change_logs
       WHERE user_id = $userId
       ORDER BY updated_at DESC`,
      { $userId: userId },
    );
  },

  upsertOne({ userId, scopeKey, payloadJson, createdAt, updatedAt }) {
    run(
      `INSERT INTO resource_change_logs (user_id, scope_key, payload_json, created_at, updated_at)
       VALUES ($userId, $scopeKey, $payloadJson, $createdAt, $updatedAt)
       ON CONFLICT(user_id, scope_key)
       DO UPDATE SET
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`,
      {
        $userId: userId,
        $scopeKey: scopeKey,
        $payloadJson: payloadJson,
        $createdAt: createdAt,
        $updatedAt: updatedAt,
      },
    );
  },

  upsertMany({ userId, items, timestamp }) {
    transaction(() => {
      items.forEach((item) => {
        run(
          `INSERT INTO resource_change_logs (user_id, scope_key, payload_json, created_at, updated_at)
           VALUES ($userId, $scopeKey, $payloadJson, $createdAt, $updatedAt)
           ON CONFLICT(user_id, scope_key)
           DO UPDATE SET
             payload_json = excluded.payload_json,
             updated_at = excluded.updated_at`,
          {
            $userId: userId,
            $scopeKey: item.scopeKey,
            $payloadJson: item.payloadJson,
            $createdAt: timestamp,
            $updatedAt: timestamp,
          },
        );
      });
    });
  },
};
