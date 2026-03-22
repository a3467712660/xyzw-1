import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { initDatabase } from "../src/db/database.js";
import { nowIso } from "../src/db/sql.js";
import { run, query } from "../src/db/client.js";
import { createPassword } from "../src/lib/crypto.js";

const thisFile = fileURLToPath(import.meta.url);
const backendRoot = path.resolve(path.dirname(thisFile), "..");

test("initAdminMfa script enables admin MFA and records security event", async (t) => {
  await initDatabase();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `admin_mfa_bootstrap_${suffix}`;
  const username = `admin_mfa_bootstrap_${suffix}`;
  const email = `${username}@example.com`;
  const createdAt = nowIso();
  const passwordMeta = createPassword("Admin1234!Aa");

  run(`DELETE FROM security_event_logs WHERE user_id = $id`, { $id: userId });
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: userId,
    $username: username,
  });

  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, is_admin,
      mfa_enabled, mfa_totp_secret_enc, mfa_recovery_codes_hash, created_at, updated_at
    ) VALUES (
      $id, $username, $email, $salt, $hash, 0, 1,
      0, NULL, NULL, $createdAt, $updatedAt
    )`,
    {
      $id: userId,
      $username: username,
      $email: email,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $createdAt: createdAt,
      $updatedAt: createdAt,
    },
  );

  t.after(() => {
    run(`DELETE FROM security_event_logs WHERE user_id = $id`, { $id: userId });
    run(`DELETE FROM users WHERE id = $id`, { $id: userId });
  });

  const result = spawnSync("node", ["src/scripts/initAdminMfa.js"], {
    cwd: backendRoot,
    env: {
      ...process.env,
      ADMIN_USERNAME: username,
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, `stderr: ${result.stderr}`);
  assert.match(result.stdout, /Admin MFA initialized for:/);
  assert.match(result.stdout, /OTPAuth URL: otpauth:\/\/totp\//);
  assert.match(result.stdout, /Recovery Codes:/);

  const users = query(
    `SELECT mfa_enabled as mfaEnabled, mfa_totp_secret_enc as mfaTotpSecretEnc, mfa_recovery_codes_hash as mfaRecoveryCodesHash
     FROM users WHERE id = $id`,
    { $id: userId },
  );
  assert.equal(users.length, 1);
  assert.equal(Number(users[0].mfaEnabled), 1);
  assert.ok(String(users[0].mfaTotpSecretEnc || "").trim().length > 0);
  const hashes = JSON.parse(String(users[0].mfaRecoveryCodesHash || "[]"));
  assert.equal(Array.isArray(hashes), true);
  assert.equal(hashes.length, 8);

  const events = query(
    `SELECT event_type as eventType
     FROM security_event_logs
     WHERE user_id = $userId
     ORDER BY created_at DESC
     LIMIT 1`,
    { $userId: userId },
  );
  assert.equal(events.length, 1);
  assert.equal(events[0].eventType, "mfa_reset_by_cli");
});
