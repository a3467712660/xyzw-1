import { query, run } from "../db/client.js";
import { normalizeAccessScope } from "../constants/accessScope.js";
import { env } from "../config/env.js";
import { codeSuffix, hmacHex, maskedCode } from "../lib/crypto.js";

const redactStoredCode = (id) => `invite-redacted:${String(id || "").trim()}`;
const inviteCodeHmac = (code) => hmacHex(env.inviteCodePepper, code);
const inviteCodeMask = (code) => maskedCode(code, "INV");

const normalizeInvite = (row) => {
  if (!row) return null;
  return {
    ...row,
    code: String(row.codeMask || row.code || "").trim(),
    codeMask: String(row.codeMask || row.code || "").trim(),
    codeSuffix: String(row.codeSuffix || "").trim(),
    isActive: Number(row.isActive) === 1,
    isTemporary: Number(row.isTemporary) === 1,
    featureScope: normalizeAccessScope(row.featureScope),
    bindAccountLimit: Math.max(1, Number(row.bindAccountLimit) || 1),
  };
};

export const inviteCodeRepository = {
  findByCode(code) {
    const rows = query(
      `SELECT
         id,
         code_mask as codeMask,
         code_suffix as codeSuffix,
         created_by as createdBy,
         used_by as usedBy,
         used_at as usedAt,
         expires_at as expiresAt,
         created_at as createdAt,
         feature_scope as featureScope,
         bind_account_limit as bindAccountLimit,
         is_active as isActive,
         is_temporary as isTemporary
       FROM invite_codes
       WHERE code_hmac = $codeHmac`,
      { $codeHmac: inviteCodeHmac(code) },
    );
    return normalizeInvite(rows[0]);
  },

  findById(id) {
    const rows = query(
      `SELECT id, code_mask as codeMask, code_suffix as codeSuffix, used_at as usedAt, is_active as isActive FROM invite_codes WHERE id = $id`,
      { $id: id },
    );
    if (!rows[0]) return null;
    return {
      ...rows[0],
      isActive: Number(rows[0].isActive) === 1,
    };
  },

  existsByCode(code) {
    const rows = query(`SELECT id FROM invite_codes WHERE code_hmac = $codeHmac`, {
      $codeHmac: inviteCodeHmac(code),
    });
    return Boolean(rows[0]);
  },

  markInactiveById(id) {
    run(`UPDATE invite_codes SET is_active = 0 WHERE id = $id`, { $id: id });
  },

  consumeById({ id, usedBy, usedAt }) {
    run(
      `UPDATE invite_codes
       SET used_by = $usedBy, used_at = $usedAt, is_active = 0
       WHERE id = $id`,
      {
        $id: id,
        $usedBy: usedBy,
        $usedAt: usedAt,
      },
    );
  },

  create({
    id,
    code,
    createdBy,
    expiresAt = null,
    isTemporary = false,
    featureScope = "full",
    bindAccountLimit = 1,
    createdAt,
  }) {
    run(
      `INSERT INTO invite_codes
        (id, code, code_hmac, code_suffix, code_mask, created_by, used_by, used_at, expires_at, is_temporary, feature_scope, bind_account_limit, is_active, created_at)
       VALUES
        ($id, $storedCode, $codeHmac, $codeSuffix, $codeMask, $createdBy, NULL, NULL, $expiresAt, $isTemporary, $featureScope, $bindAccountLimit, 1, $createdAt)`,
      {
        $id: id,
        $storedCode: redactStoredCode(id),
        $codeHmac: inviteCodeHmac(code),
        $codeSuffix: codeSuffix(code),
        $codeMask: inviteCodeMask(code),
        $createdBy: createdBy,
        $expiresAt: expiresAt,
        $isTemporary: isTemporary ? 1 : 0,
        $featureScope: normalizeAccessScope(featureScope),
        $bindAccountLimit: Math.max(1, Math.min(999, Number(bindAccountLimit) || 1)),
        $createdAt: createdAt,
      },
    );
  },

  listWithCreatorAndConsumer() {
    const rows = query(
      `SELECT
        ic.id,
        ic.code_mask as codeMask,
        ic.code_suffix as codeSuffix,
        ic.created_at as createdAt,
        ic.expires_at as expiresAt,
        ic.is_temporary as isTemporary,
        ic.feature_scope as featureScope,
        ic.bind_account_limit as bindAccountLimit,
        ic.is_active as isActive,
        ic.used_at as usedAt,
        creator.username as createdBy,
        consumer.username as usedBy
      FROM invite_codes ic
      JOIN users creator ON creator.id = ic.created_by
      LEFT JOIN users consumer ON consumer.id = ic.used_by
      ORDER BY ic.created_at DESC`,
    );

    return rows.map((row) => normalizeInvite(row));
  },

  findLatestTemporaryCreatedAt() {
    const rows = query(
      `SELECT created_at as createdAt
       FROM invite_codes
       WHERE is_temporary = 1
       ORDER BY created_at DESC
       LIMIT 1`,
    );
    return rows[0]?.createdAt ? String(rows[0].createdAt) : "";
  },

  deactivateActiveTemporary() {
    run(
      `UPDATE invite_codes
       SET is_active = 0
       WHERE is_temporary = 1
         AND is_active = 1
         AND used_at IS NULL`,
    );
  },

  markExpiredTemporaryInactive(nowAt) {
    run(
      `UPDATE invite_codes
       SET is_active = 0
       WHERE is_temporary = 1
         AND is_active = 1
         AND used_at IS NULL
         AND expires_at IS NOT NULL
         AND expires_at <= $nowAt`,
      { $nowAt: nowAt },
    );
  },

  listPublicTemporaryActive({ limit = 20, nowAt }) {
    const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
    return query(
      `SELECT
         id,
         code_mask as codeMask,
         code_suffix as codeSuffix,
         created_at as createdAt,
         expires_at as expiresAt
       FROM invite_codes
       WHERE is_temporary = 1
         AND is_active = 1
         AND used_at IS NULL
         AND (expires_at IS NULL OR expires_at > $nowAt)
       ORDER BY created_at DESC
       LIMIT ${safeLimit}`,
      { $nowAt: nowAt },
    );
  },
};
