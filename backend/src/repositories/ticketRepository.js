import { query, run } from "../db/client.js";

export const ticketRepository = {
  list({ isAdmin, userId, status }) {
    const shouldFilterStatus = Boolean(status);
    const params = {};
    const whereList = [];

    if (!isAdmin) {
      whereList.push("f.user_id = $userId");
      params.$userId = userId;
    }
    if (shouldFilterStatus) {
      whereList.push("f.status = $status");
      params.$status = status;
    }

    const whereSql = whereList.length ? `WHERE ${whereList.join(" AND ")}` : "";

    return query(
      `SELECT
        f.id,
        f.user_id as userId,
        f.type,
        f.title,
        f.content,
        f.status,
        f.admin_note as adminNote,
        f.resolved_at as resolvedAt,
        f.created_at as createdAt,
        f.updated_at as updatedAt,
        owner.username as username,
        resolver.username as resolvedByName
      FROM feedback_items f
      JOIN users owner ON owner.id = f.user_id
      LEFT JOIN users resolver ON resolver.id = f.resolved_by
      ${whereSql}
      ORDER BY f.created_at DESC`,
      params,
    );
  },

  findByIdWithOwner(id) {
    const rows = query(
      `SELECT
        f.id,
        f.user_id as userId,
        f.status,
        f.title,
        owner.username as ownerUsername,
        owner.email as ownerEmail
      FROM feedback_items f
      JOIN users owner ON owner.id = f.user_id
      WHERE f.id = $id`,
      { $id: id },
    );

    return rows[0] || null;
  },

  create({ id, userId, type, title, content, createdAt, updatedAt }) {
    run(
      `INSERT INTO feedback_items
        (id, user_id, type, title, content, status, admin_note, resolved_by, resolved_at, created_at, updated_at)
       VALUES
        ($id, $userId, $type, $title, $content, 'open', NULL, NULL, NULL, $createdAt, $updatedAt)`,
      {
        $id: id,
        $userId: userId,
        $type: type,
        $title: title,
        $content: content,
        $createdAt: createdAt,
        $updatedAt: updatedAt,
      },
    );
  },

  updateStatus({ id, status, adminNote, resolvedBy, resolvedAt, updatedAt }) {
    run(
      `UPDATE feedback_items
       SET status = $status,
           admin_note = $adminNote,
           resolved_by = $resolvedBy,
           resolved_at = $resolvedAt,
           updated_at = $updatedAt
       WHERE id = $id`,
      {
        $id: id,
        $status: status,
        $adminNote: adminNote || null,
        $resolvedBy: resolvedBy,
        $resolvedAt: resolvedAt,
        $updatedAt: updatedAt,
      },
    );
  },
};
