import { query, run } from "../db/client.js";

const roleSelectSql = `SELECT
  id, name, server, profession, level,
  account_enc as accountEnc,
  note_enc as noteEnc,
  avatar,
  is_active as isActive,
  exp, gold, vip,
  created_at as createdAt,
  updated_at as updatedAt
FROM roles`;

export const roleRepository = {
  listByUser(userId) {
    return query(
      `${roleSelectSql}
       WHERE user_id = $userId
       ORDER BY created_at DESC`,
      { $userId: userId },
    );
  },

  create({
    id,
    userId,
    name,
    server,
    profession,
    level,
    accountEnc,
    noteEnc,
    avatar,
    createdAt,
    updatedAt,
  }) {
    run(
      `INSERT INTO roles (
        id, user_id, name, server, profession, level,
        account_enc, note_enc, avatar, is_active,
        exp, gold, vip, created_at, updated_at
      ) VALUES (
        $id, $userId, $name, $server, $profession, $level,
        $accountEnc, $noteEnc, $avatar, 0,
        0, 1000, 0, $createdAt, $updatedAt
      )`,
      {
        $id: id,
        $userId: userId,
        $name: name,
        $server: server,
        $profession: profession,
        $level: level,
        $accountEnc: accountEnc,
        $noteEnc: noteEnc,
        $avatar: avatar,
        $createdAt: createdAt,
        $updatedAt: updatedAt,
      },
    );
  },

  findById(id) {
    const rows = query(
      `${roleSelectSql}
       WHERE id = $id`,
      { $id: id },
    );
    return rows[0] || null;
  },

  findByIdAndUser(id, userId) {
    const rows = query(
      `${roleSelectSql}
       WHERE id = $id AND user_id = $userId`,
      { $id: id, $userId: userId },
    );
    return rows[0] || null;
  },

  existsByIdAndUser(id, userId) {
    const rows = query(
      `SELECT id FROM roles WHERE id = $id AND user_id = $userId`,
      { $id: id, $userId: userId },
    );
    return Boolean(rows[0]);
  },

  patchById({
    id,
    name,
    server,
    profession,
    level,
    accountEnc,
    noteEnc,
    avatar,
    isActive,
    exp,
    gold,
    vip,
    updatedAt,
  }) {
    run(
      `UPDATE roles SET
        name = COALESCE($name, name),
        server = COALESCE($server, server),
        profession = COALESCE($profession, profession),
        level = COALESCE($level, level),
        account_enc = COALESCE($accountEnc, account_enc),
        note_enc = COALESCE($noteEnc, note_enc),
        avatar = COALESCE($avatar, avatar),
        is_active = COALESCE($isActive, is_active),
        exp = COALESCE($exp, exp),
        gold = COALESCE($gold, gold),
        vip = COALESCE($vip, vip),
        updated_at = $updatedAt
      WHERE id = $id`,
      {
        $id: id,
        $name: name,
        $server: server,
        $profession: profession,
        $level: level,
        $accountEnc: accountEnc,
        $noteEnc: noteEnc,
        $avatar: avatar,
        $isActive: isActive,
        $exp: exp,
        $gold: gold,
        $vip: vip,
        $updatedAt: updatedAt,
      },
    );
  },

  deleteById(id) {
    run(`DELETE FROM roles WHERE id = $id`, { $id: id });
  },
};
