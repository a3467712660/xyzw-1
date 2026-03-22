import { query, run } from "../db/client.js";

export const taskRepository = {
  listRoleTaskKeys({ userId, roleId }) {
    return query(
      `SELECT id, task_key as taskKey FROM task_configs WHERE user_id = $userId AND role_id = $roleId`,
      { $userId: userId, $roleId: roleId },
    );
  },

  createTaskConfig({
    id,
    userId,
    roleId,
    taskKey,
    title,
    subtitle,
    autoExecute,
    cronExpr,
    updatedAt,
    createdAt,
  }) {
    run(
      `INSERT INTO task_configs (
        id, user_id, role_id, task_key, title, subtitle,
        enabled, auto_execute, delay_seconds, notification, cron_expr, updated_at, created_at
      ) VALUES (
        $id, $userId, $roleId, $taskKey, $title, $subtitle,
        0, $autoExecute, 0, 1, $cronExpr, $updatedAt, $createdAt
      )`,
      {
        $id: id,
        $userId: userId,
        $roleId: roleId,
        $taskKey: taskKey,
        $title: title,
        $subtitle: subtitle,
        $autoExecute: autoExecute,
        $cronExpr: cronExpr,
        $updatedAt: updatedAt,
        $createdAt: createdAt,
      },
    );
  },

  listTasksWithLatestRun({ userId, roleId }) {
    return query(
      `SELECT
        tc.id,
        tc.task_key as taskKey,
        tc.title,
        tc.subtitle,
        tc.enabled,
        tc.auto_execute as autoExecute,
        tc.delay_seconds as delaySeconds,
        tc.notification,
        tc.cron_expr as cronExpr,
        tc.updated_at as updatedAt,
        (
          SELECT tr.status FROM task_runs tr
          WHERE tr.task_config_id = tc.id
          ORDER BY tr.run_at DESC
          LIMIT 1
        ) as lastStatus,
        (
          SELECT tr.message FROM task_runs tr
          WHERE tr.task_config_id = tc.id
          ORDER BY tr.run_at DESC
          LIMIT 1
        ) as lastMessage,
        (
          SELECT tr.run_at FROM task_runs tr
          WHERE tr.task_config_id = tc.id
          ORDER BY tr.run_at DESC
          LIMIT 1
        ) as lastRunAt
      FROM task_configs tc
      WHERE tc.user_id = $userId AND tc.role_id = $roleId
      ORDER BY tc.created_at ASC`,
      { $userId: userId, $roleId: roleId },
    );
  },

  findTaskConfigByOwner({ id, userId, roleId }) {
    const rows = query(
      `SELECT id FROM task_configs WHERE id = $id AND user_id = $userId AND role_id = $roleId`,
      { $id: id, $userId: userId, $roleId: roleId },
    );
    return rows[0] || null;
  },

  patchTaskConfig({
    id,
    enabled,
    autoExecute,
    delaySeconds,
    notification,
    cronExpr,
    updatedAt,
  }) {
    run(
      `UPDATE task_configs SET
        enabled = COALESCE($enabled, enabled),
        auto_execute = COALESCE($autoExecute, auto_execute),
        delay_seconds = COALESCE($delaySeconds, delay_seconds),
        notification = COALESCE($notification, notification),
        cron_expr = COALESCE($cronExpr, cron_expr),
        updated_at = $updatedAt
      WHERE id = $id`,
      {
        $id: id,
        $enabled: enabled,
        $autoExecute: autoExecute,
        $delaySeconds: delaySeconds,
        $notification: notification,
        $cronExpr: cronExpr,
        $updatedAt: updatedAt,
      },
    );
  },

  findTaskConfigById(id) {
    const rows = query(`SELECT id FROM task_configs WHERE id = $id`, { $id: id });
    return rows[0] || null;
  },

  findTaskExecutionTarget({ id, userId, roleId }) {
    const rows = query(
      `SELECT id, title, delay_seconds as delaySeconds
       FROM task_configs WHERE id = $id AND user_id = $userId AND role_id = $roleId`,
      { $id: id, $userId: userId, $roleId: roleId },
    );
    return rows[0] || null;
  },

  createTaskRun({ id, userId, roleId, taskConfigId, status, message, runAt, source }) {
    run(
      `INSERT INTO task_runs (id, user_id, role_id, task_config_id, status, message, run_at, source)
       VALUES ($id, $userId, $roleId, $taskConfigId, $status, $message, $runAt, $source)`,
      {
        $id: id,
        $userId: userId,
        $roleId: roleId,
        $taskConfigId: taskConfigId,
        $status: status,
        $message: message,
        $runAt: runAt,
        $source: source,
      },
    );
  },

  listTaskRunsByRole({ userId, roleId, limit, offset }) {
    return query(
      `SELECT tr.id, tr.status, tr.message, tr.run_at as runAt, tr.source,
              tc.title, tc.task_key as taskKey
       FROM task_runs tr
       JOIN task_configs tc ON tc.id = tr.task_config_id
       WHERE tr.user_id = $userId AND tr.role_id = $roleId
       ORDER BY tr.run_at DESC
       LIMIT $limit OFFSET $offset`,
      { $userId: userId, $roleId: roleId, $limit: limit, $offset: offset },
    );
  },

  listTaskConfigsForSchedule(userId = null) {
    const baseSql = `SELECT id, user_id as userId, role_id as roleId, enabled, auto_execute as autoExecute, cron_expr as cronExpr
     FROM task_configs`;

    if (!userId) {
      return query(baseSql);
    }

    return query(`${baseSql}\n     WHERE user_id = $userId`, { $userId: userId });
  },

  deleteTaskRunsBefore(cutoffIso) {
    const result = run(
      `DELETE FROM task_runs
       WHERE run_at < $cutoff`,
      {
        $cutoff: String(cutoffIso || "").trim(),
      },
    );
    return Number(result?.changes || 0);
  },
};
