import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { initDatabase } from "../src/db/database.js";
import { nowIso } from "../src/db/sql.js";
import { run } from "../src/db/client.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
import authRoutes from "../src/routes/auth.js";
import adminRoutes from "../src/routes/admin.js";
import userPreferencesRoutes from "../src/routes/userPreferences.js";
import { createUserRoutes } from "../src/app/userRoutes.js";
import {
  createMfaSetupPayload,
  encryptMfaSecret,
  generateTotpCode,
} from "../src/services/mfaService.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createAppServer = async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/admin", adminRoutes);
  app.use("/api/v1", userPreferencesRoutes);
  app.use("/api/v1/user", createUserRoutes());

  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const createUser = ({ id, username, password, isAdmin = false }) => {
  const ts = nowIso();
  const meta = createPassword(password);
  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, is_admin, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, $isAdmin, $createdAt, $updatedAt
    )`,
    {
      $id: id,
      $username: username,
      $salt: meta.salt,
      $hash: meta.hash,
      $isAdmin: isAdmin ? 1 : 0,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
};

const enableAdminMfa = ({ userId, username }) => {
  const mfaSetup = createMfaSetupPayload({ username });
  run(
    `UPDATE users
     SET mfa_enabled = 1,
         mfa_totp_secret_enc = $secretEnc,
         mfa_recovery_codes_hash = $recoveryHash,
         updated_at = $updatedAt
     WHERE id = $id`,
    {
      $id: userId,
      $secretEnc: encryptMfaSecret(mfaSetup.secret),
      $recoveryHash: JSON.stringify(mfaSetup.recoveryCodeHashes),
      $updatedAt: nowIso(),
    },
  );
  return mfaSetup;
};

const authHeaders = ({ userId, username }) => {
  const token = signJwt({ sub: userId, username, ver: 0 }, 60 * 10);
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
};

test("security events API exposes user and admin audit history", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = {
    id: `sec_admin_${suffix}`,
    username: `sec_admin_${suffix}`,
    password: "Admin1234!Aa",
  };
  const normalUser = {
    id: `sec_user_${suffix}`,
    username: `sec_user_${suffix}`,
    password: "User1234!Aa",
  };

  run(`DELETE FROM security_event_logs WHERE user_id IN ($adminId, $userId)`, {
    $adminId: adminUser.id,
    $userId: normalUser.id,
  });
  run(`DELETE FROM admin_audit_logs WHERE admin_user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM users WHERE id IN ($adminId, $userId)`, {
    $adminId: adminUser.id,
    $userId: normalUser.id,
  });

  createUser({ ...adminUser, isAdmin: true });
  createUser({ ...normalUser, isAdmin: false });
  const adminMfaSetup = enableAdminMfa({ userId: adminUser.id, username: adminUser.username });

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM security_event_logs WHERE user_id IN ($adminId, $userId)`, {
      $adminId: adminUser.id,
      $userId: normalUser.id,
    });
    run(`DELETE FROM admin_audit_logs WHERE admin_user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM user_preferences WHERE user_id IN ($adminId, $userId)`, {
      $adminId: adminUser.id,
      $userId: normalUser.id,
    });
    run(`DELETE FROM users WHERE id IN ($adminId, $userId)`, {
      $adminId: adminUser.id,
      $userId: normalUser.id,
    });
  });

  const baseUrl = makeBaseUrl(server);

  const loginFailed = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: normalUser.username, password: "wrong-password" }),
  });
  assert.equal(loginFailed.status, 401);

  const loginSuccess = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: normalUser.username, password: normalUser.password }),
  });
  assert.equal(loginSuccess.status, 200);

  const userConfirm = await fetch(`${baseUrl}/api/v1/user/confirm-password`, {
    method: "POST",
    headers: authHeaders({ userId: normalUser.id, username: normalUser.username }),
    body: JSON.stringify({ password: normalUser.password }),
  });
  assert.equal(userConfirm.status, 200);
  const userConfirmPayload = await userConfirm.json();
  const userConfirmToken = String(userConfirmPayload?.data?.token || "");
  assert.ok(userConfirmToken);

  const togglePreference = await fetch(`${baseUrl}/api/v1/user/preferences/security.remote_bin_download_enabled`, {
    method: "PUT",
    headers: {
      ...authHeaders({ userId: normalUser.id, username: normalUser.username }),
      "x-user-confirm-token": userConfirmToken,
    },
    body: JSON.stringify({ value: true }),
  });
  assert.equal(togglePreference.status, 200);

  const adminConfirm = await fetch(`${baseUrl}/api/v1/admin/confirm-password`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({ totpCode: generateTotpCode({ secret: adminMfaSetup.secret }) }),
  });
  assert.equal(adminConfirm.status, 200);
  const adminConfirmPayload = await adminConfirm.json();
  const adminConfirmToken = String(adminConfirmPayload?.data?.token || "");
  assert.ok(adminConfirmToken);

  const adminAction = await fetch(`${baseUrl}/api/v1/admin/users/${normalUser.id}/token-bind-limit`, {
    method: "PATCH",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": adminConfirmToken,
    },
    body: JSON.stringify({ tokenBindLimit: 9 }),
  });
  assert.equal(adminAction.status, 200);

  const userEventsRes = await fetch(`${baseUrl}/api/v1/user/security-events?limit=50`, {
    headers: authHeaders({ userId: normalUser.id, username: normalUser.username }),
  });
  assert.equal(userEventsRes.status, 200);
  const userEventsPayload = await userEventsRes.json();
  const userEvents = Array.isArray(userEventsPayload?.data) ? userEventsPayload.data : [];
  assert.ok(userEvents.some((item) => item.eventType === "login_failed"));
  assert.ok(userEvents.some((item) => item.eventType === "login_success"));
  assert.ok(userEvents.some((item) => item.eventType === "remote_download_toggle"));

  const adminEventsRes = await fetch(
    `${baseUrl}/api/v1/admin/security-events?limit=50&eventType=admin_sensitive_action`,
    {
      headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    },
  );
  assert.equal(adminEventsRes.status, 200);
  const adminEventsPayload = await adminEventsRes.json();
  const adminEvents = Array.isArray(adminEventsPayload?.data) ? adminEventsPayload.data : [];
  assert.ok(adminEvents.length > 0);
  assert.ok(adminEvents.some((item) => item.eventType === "admin_sensitive_action"));
});
