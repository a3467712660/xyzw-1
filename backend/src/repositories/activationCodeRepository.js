import { query, run } from "../db/client.js";

const normalizeActivationCode = (row) => {
  if (!row) return null;
  return {
    ...row,
    durationMonths: Math.max(1, Number(row.durationMonths) || 1),
    isActive: Number(row.isActive) === 1,
    isDeleted: Number(row.isDeleted) === 1,
  };
};

export const activationCodeRepository = {
  existsByCode(code) {
    const rows = query(`SELECT id FROM activation_codes WHERE code = $code AND is_deleted = 0`, {
      $code: String(code || "").trim().toUpperCase(),
    });
    return Boolean(rows[0]);
  },

  findByCode(code) {
    const rows = query(
      `SELECT
         id,
         code,
         created_by as createdBy,
         duration_months as durationMonths,
         used_by as usedBy,
         used_at as usedAt,
         bound_token_id as boundTokenId,
         bound_game_account_id as boundGameAccountId,
         is_deleted as isDeleted,
         is_active as isActive,
         created_at as createdAt
       FROM activation_codes
       WHERE code = $code
         AND is_deleted = 0`,
      { $code: String(code || "").trim().toUpperCase() },
    );
    return normalizeActivationCode(rows[0]);
  },

  findById(id) {
    const rows = query(
      `SELECT
         id,
         used_at as usedAt,
         is_deleted as isDeleted,
         is_active as isActive
       FROM activation_codes
       WHERE id = $id`,
      { $id: String(id || "").trim() },
    );
    return normalizeActivationCode(rows[0]);
  },

  create({
    id,
    code,
    createdBy,
    durationMonths,
    createdAt,
  }) {
    run(
      `INSERT INTO activation_codes (
         id, code, created_by, duration_months,
         used_by, used_at, bound_token_id, bound_game_account_id,
         is_active, created_at
       ) VALUES (
         $id, $code, $createdBy, $durationMonths,
         NULL, NULL, NULL, NULL,
         1, $createdAt
       )`,
      {
        $id: String(id || "").trim(),
        $code: String(code || "").trim().toUpperCase(),
        $createdBy: String(createdBy || "").trim(),
        $durationMonths: Math.max(1, Math.min(24, Number(durationMonths) || 1)),
        $createdAt: String(createdAt || "").trim(),
      },
    );
  },

  consumeById({
    id,
    usedBy,
    usedAt,
    boundTokenId,
    boundGameAccountId,
  }) {
    run(
      `UPDATE activation_codes
       SET used_by = $usedBy,
           used_at = $usedAt,
           bound_token_id = $boundTokenId,
           bound_game_account_id = $boundGameAccountId,
           is_active = 0
       WHERE id = $id`,
      {
        $id: String(id || "").trim(),
        $usedBy: String(usedBy || "").trim(),
        $usedAt: String(usedAt || "").trim(),
        $boundTokenId: String(boundTokenId || "").trim(),
        $boundGameAccountId: String(boundGameAccountId || "").trim(),
      },
    );
  },

  markInactiveById(id) {
    run(
      `UPDATE activation_codes
       SET is_active = 0
       WHERE id = $id`,
      { $id: String(id || "").trim() },
    );
  },

  listWithCreatorAndConsumer() {
    const rows = query(
      `SELECT
         ac.id,
         ac.code,
         ac.created_at as createdAt,
         ac.duration_months as durationMonths,
         ac.is_active as isActive,
         ac.is_deleted as isDeleted,
         ac.used_at as usedAt,
         ac.bound_token_id as boundTokenId,
         ac.bound_game_account_id as boundGameAccountId,
         creator.username as createdBy,
         consumer.username as usedBy
       FROM activation_codes ac
       JOIN users creator ON creator.id = ac.created_by
       LEFT JOIN users consumer ON consumer.id = ac.used_by
       WHERE ac.is_deleted = 0
       ORDER BY ac.created_at DESC`,
    );
    return rows.map((row) => normalizeActivationCode(row));
  },

  softDeleteById(id) {
    run(
      `UPDATE activation_codes
       SET is_deleted = 1,
           is_active = 0
       WHERE id = $id`,
      { $id: String(id || "").trim() },
    );
  },

  resetBindingById(id) {
    const result = run(
      `UPDATE activation_codes
       SET used_by = NULL,
           used_at = NULL,
           bound_token_id = NULL,
           bound_game_account_id = NULL,
           is_active = CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END
       WHERE id = $id`,
      { $id: String(id || "").trim() },
    );
    return Number(result?.changes || 0);
  },

  resetAllConsumedBindings() {
    const result = run(
      `UPDATE activation_codes
       SET used_by = NULL,
           used_at = NULL,
           bound_token_id = NULL,
           bound_game_account_id = NULL,
           is_active = CASE WHEN is_deleted = 0 THEN 1 ELSE 0 END
       WHERE used_at IS NOT NULL`,
    );
    return Number(result?.changes || 0);
  },
};
