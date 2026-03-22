import { query, run } from "../db/client.js";

export const userPreferenceRepository = {
  findByUserAndKey({ userId, key }) {
    const rows = query(
      `SELECT pref_key as prefKey, value_json as valueJson, updated_at as updatedAt
       FROM user_preferences
       WHERE user_id = $userId AND pref_key = $key`,
      { $userId: userId, $key: key },
    );
    return rows[0] || null;
  },

  upsert({ userId, key, valueJson, createdAt, updatedAt }) {
    run(
      `INSERT INTO user_preferences (user_id, pref_key, value_json, created_at, updated_at)
       VALUES ($userId, $key, $valueJson, $createdAt, $updatedAt)
       ON CONFLICT(user_id, pref_key)
       DO UPDATE SET
         value_json = excluded.value_json,
         updated_at = excluded.updated_at`,
      {
        $userId: userId,
        $key: key,
        $valueJson: valueJson,
        $createdAt: createdAt,
        $updatedAt: updatedAt,
      },
    );
  },
};
