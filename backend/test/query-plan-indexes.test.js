import assert from "node:assert/strict";
import test from "node:test";
import { initDatabase, getDb } from "../src/db/database.js";
import { run } from "../src/db/client.js";
import { createPassword } from "../src/lib/crypto.js";
import { nowIso } from "../src/db/sql.js";

const seedUser = ({ userId, username, password }) => {
  const passwordMeta = createPassword(password);
  const ts = nowIso();
  run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  run(`DELETE FROM users WHERE username = $username`, { $username: username });
  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, $createdAt, $updatedAt
    )`,
    {
      $id: userId,
      $username: username,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
};

const planDetails = (sql, params = []) =>
  getDb()
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...params)
    .map((row) => String(row.detail || ""));

test("query plans use composite indexes for hot notification and log queries", async (t) => {
  await initDatabase();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `plan_user_${suffix}`;
  const username = `plan_user_${suffix}`;
  seedUser({
    userId,
    username,
    password: "PlanIndex123!Aa",
  });

  const createdAt = nowIso();
  run(
    `INSERT INTO user_notifications (
      id, user_id, type, title, content, payload_json, is_read, read_at, created_at
    ) VALUES (
      $id, $userId, 'info', 'title', 'content', NULL, 0, NULL, $createdAt
    )`,
    {
      $id: `notif_${suffix}`,
      $userId: userId,
      $createdAt: createdAt,
    },
  );
  run(
    `INSERT INTO security_event_logs (
      id, user_id, event_type, detail_json, ip, user_agent, created_at
    ) VALUES (
      $id, $userId, 'login', '{}', NULL, NULL, $createdAt
    )`,
    {
      $id: `sec_${suffix}`,
      $userId: userId,
      $createdAt: createdAt,
    },
  );
  run(
    `INSERT INTO task_control_logs (
      id, user_id, task_id, task_name, status, message, created_at
    ) VALUES (
      $id, $userId, 'daily', 'Daily', 'info', 'ok', $createdAt
    )`,
    {
      $id: `task_${suffix}`,
      $userId: userId,
      $createdAt: createdAt,
    },
  );

  t.after(() => {
    run(`DELETE FROM task_control_logs WHERE id = $id`, { $id: `task_${suffix}` });
    run(`DELETE FROM security_event_logs WHERE id = $id`, { $id: `sec_${suffix}` });
    run(`DELETE FROM user_notifications WHERE id = $id`, { $id: `notif_${suffix}` });
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const notificationPlan = planDetails(
    `SELECT id
     FROM user_notifications
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId],
  ).join("\n");
  assert.match(notificationPlan, /idx_user_notifications_user_id_created_at/);

  const unreadNotificationPlan = planDetails(
    `SELECT id
     FROM user_notifications
     WHERE user_id = ?
       AND is_read = 0
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId],
  ).join("\n");
  assert.match(unreadNotificationPlan, /idx_user_notifications_user_id_is_read_created_at/);

  const securityEventUserPlan = planDetails(
    `SELECT id
     FROM security_event_logs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId],
  ).join("\n");
  assert.match(securityEventUserPlan, /idx_security_event_logs_user_id_created_at/);

  const securityEventTypePlan = planDetails(
    `SELECT id
     FROM security_event_logs
     WHERE event_type = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    ["login"],
  ).join("\n");
  assert.match(securityEventTypePlan, /idx_security_event_logs_event_type_created_at/);

  const securityEventScopedPlan = planDetails(
    `SELECT id
     FROM security_event_logs
     WHERE user_id = ?
       AND event_type = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId, "login"],
  ).join("\n");
  assert.match(securityEventScopedPlan, /idx_security_event_logs_user_id_event_type_created_at/);

  const taskControlPlan = planDetails(
    `SELECT id
     FROM task_control_logs
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT 10`,
    [userId],
  ).join("\n");
  assert.match(taskControlPlan, /idx_task_control_logs_user_id_created_at/);
});
