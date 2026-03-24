import { initDatabase } from "../db/database.js";
import { query, run } from "../db/client.js";
import { nowIso } from "../db/sql.js";

await initDatabase();

const invalidatedAt = nowIso();

const inviteRow = query(
  `SELECT COUNT(*) as count FROM invite_codes WHERE is_active = 1 AND used_at IS NULL`,
)[0] || { count: 0 };
const activationRow = query(
  `SELECT COUNT(*) as count FROM activation_codes WHERE is_active = 1 AND is_deleted = 0`,
)[0] || { count: 0 };
const resetRow = query(
  `SELECT COUNT(*) as count FROM password_reset_codes WHERE is_active = 1 AND used_at IS NULL`,
)[0] || { count: 0 };

run(
  `UPDATE invite_codes
   SET is_active = 0,
       expires_at = COALESCE(expires_at, $invalidatedAt)
   WHERE is_active = 1 AND used_at IS NULL`,
  { $invalidatedAt: invalidatedAt },
);

run(
  `UPDATE activation_codes
   SET is_active = 0
   WHERE is_active = 1 AND is_deleted = 0`,
);

run(
  `UPDATE password_reset_codes
   SET is_active = 0,
       expires_at = CASE
         WHEN expires_at > $invalidatedAt THEN $invalidatedAt
         ELSE expires_at
       END
   WHERE is_active = 1 AND used_at IS NULL`,
  { $invalidatedAt: invalidatedAt },
);

// eslint-disable-next-line no-console
console.log(
  `[incident] invalidated sensitive codes at ${invalidatedAt}; invite=${Number(inviteRow.count || 0)}, activation=${Number(activationRow.count || 0)}, password_reset=${Number(resetRow.count || 0)}.`,
);
