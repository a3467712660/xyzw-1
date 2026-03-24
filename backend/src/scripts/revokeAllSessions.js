import { initDatabase } from "../db/database.js";
import { query, run } from "../db/client.js";
import { nowIso } from "../db/sql.js";

await initDatabase();

const revokedAt = nowIso();
const userCountRow = query(`SELECT COUNT(*) as count FROM users`)[0] || { count: 0 };
const activeRefreshRow = query(
  `SELECT COUNT(*) as count FROM refresh_tokens WHERE revoked_at IS NULL`,
)[0] || { count: 0 };

run(
  `UPDATE users
   SET token_version = COALESCE(token_version, 0) + 1,
       updated_at = $updatedAt`,
  { $updatedAt: revokedAt },
);

run(
  `UPDATE refresh_tokens
   SET revoked_at = COALESCE(revoked_at, $revokedAt)
   WHERE revoked_at IS NULL`,
  { $revokedAt: revokedAt },
);

// eslint-disable-next-line no-console
console.log(
  `[incident] revoked all sessions at ${revokedAt}; bumped token_version for ${Number(userCountRow.count || 0)} user(s), revoked ${Number(activeRefreshRow.count || 0)} active refresh token(s).`,
);
