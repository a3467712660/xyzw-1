import { query, run } from "../db/client.js";

export const taskControlRepository = {
  listStateRows() {
    return query(
      `SELECT user_id as userId, payload_json as payloadJson, updated_at as updatedAt
       FROM task_control_states`,
    );
  },

  findStateByUser(userId) {
    const rows = query(
      `SELECT payload_json as payloadJson, updated_at as updatedAt
       FROM task_control_states
       WHERE user_id = $userId`,
      { $userId: userId },
    );
    return rows[0] || null;
  },

  upsertState({ userId, payloadJson, createdAt, updatedAt }) {
    run(
      `INSERT INTO task_control_states (user_id, payload_json, created_at, updated_at)
       VALUES ($userId, $payloadJson, $createdAt, $updatedAt)
       ON CONFLICT(user_id)
       DO UPDATE SET
         payload_json = excluded.payload_json,
         updated_at = excluded.updated_at`,
      {
        $userId: userId,
        $payloadJson: payloadJson,
        $createdAt: createdAt,
        $updatedAt: updatedAt,
      },
    );
  },

  listLogsByUser({ userId, limit }) {
    return query(
      `SELECT id, task_id as taskId, task_name as taskName, status, message, created_at as createdAt
       FROM task_control_logs
       WHERE user_id = $userId
       ORDER BY created_at DESC
       LIMIT ${limit}`,
      { $userId: userId },
    );
  },

  createLog({ id, userId, taskId, taskName, status, message, createdAt }) {
    run(
      `INSERT INTO task_control_logs (
        id, user_id, task_id, task_name, status, message, created_at
      ) VALUES (
        $id, $userId, $taskId, $taskName, $status, $message, $createdAt
      )`,
      {
        $id: id,
        $userId: userId,
        $taskId: taskId,
        $taskName: taskName,
        $status: status,
        $message: message,
        $createdAt: createdAt,
      },
    );
  },

  clearLogsByUser(userId) {
    run(`DELETE FROM task_control_logs WHERE user_id = $userId`, {
      $userId: userId,
    });
  },

  clearAllLogs() {
    run("DELETE FROM task_control_logs");
  },

  deleteLogsBefore(cutoffIso) {
    const result = run(
      `DELETE FROM task_control_logs
       WHERE created_at < $cutoff`,
      {
        $cutoff: String(cutoffIso || "").trim(),
      },
    );
    return Number(result?.changes || 0);
  },

  listLogsForAdmin({
    limit = 500,
    username = "",
    taskName = "",
    status = "",
    taskId = "",
    message = "",
    backendOnly = true,
  }) {
    const safeLimit = Math.max(1, Math.min(2000, Number(limit) || 500));
    const clauses = [];
    const params = {};

    if (backendOnly) {
      clauses.push("l.message LIKE $backendMessagePrefix");
      params.$backendMessagePrefix = "[backend]%";
    }

    if (String(username || "").trim()) {
      clauses.push("u.username LIKE $username");
      params.$username = `%${String(username).trim()}%`;
    }
    if (String(taskName || "").trim()) {
      clauses.push("l.task_name LIKE $taskName");
      params.$taskName = `%${String(taskName).trim()}%`;
    }
    if (String(status || "").trim()) {
      clauses.push("l.status = $status");
      params.$status = String(status).trim();
    }
    if (String(taskId || "").trim()) {
      clauses.push("l.task_id = $taskId");
      params.$taskId = String(taskId).trim();
    }
    if (String(message || "").trim()) {
      clauses.push("l.message LIKE $message");
      params.$message = `%${String(message).trim()}%`;
    }

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    return query(
      `SELECT
         l.id,
         l.user_id as userId,
         u.username as username,
         l.task_id as taskId,
         l.task_name as taskName,
         l.status as status,
         l.message as message,
         l.created_at as createdAt
       FROM task_control_logs l
       LEFT JOIN users u ON u.id = l.user_id
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ${safeLimit}`,
      params,
    );
  },
};
