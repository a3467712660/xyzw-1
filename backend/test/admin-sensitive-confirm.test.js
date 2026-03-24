import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { initDatabase } from "../src/db/database.js";
import { nowIso } from "../src/db/sql.js";
import { query, run } from "../src/db/client.js";
import adminRoutes from "../src/routes/admin.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
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
  app.use("/api/v1/admin", adminRoutes);

  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const insertUser = ({ id, username, password, isAdmin = false }) => {
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

const authHeaders = ({ userId, username }) => {
  const token = signJwt({ sub: userId, username, ver: 0 }, 60 * 10);
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
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

test("admin high-risk actions require password confirmation token", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = {
    id: `user_admin_${suffix}`,
    username: `admin_${suffix}`,
    password: "Admin1234!Aa",
  };
  const targetUser = {
    id: `user_target_${suffix}`,
    username: `target_${suffix}`,
    password: "Target1234!Aa",
  };
  const activationCode = {
    id: `actcode_${suffix}`,
    code: `ACTTEST${suffix.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toUpperCase()}`,
  };
  const inviteCode = {
    id: `invite_${suffix}`,
    code: `INVTEST${suffix.replace(/[^a-zA-Z0-9]/g, "").slice(-12).toUpperCase()}`,
  };

  run(`DELETE FROM users WHERE id IN ($adminId, $targetId)`, {
    $adminId: adminUser.id,
    $targetId: targetUser.id,
  });

  insertUser({ ...adminUser, isAdmin: true });
  insertUser({ ...targetUser, isAdmin: false });
  const adminMfaSetup = enableAdminMfa({ userId: adminUser.id, username: adminUser.username });
  run(
    `INSERT INTO activation_codes (
      id, code, created_by, duration_months, used_by, used_at, bound_token_id, bound_game_account_id, is_deleted, is_active, created_at
    ) VALUES (
      $id, $code, $createdBy, 1, NULL, NULL, NULL, NULL, 0, 1, $createdAt
    )`,
    {
      $id: activationCode.id,
      $code: activationCode.code,
      $createdBy: adminUser.id,
      $createdAt: nowIso(),
    },
  );
  run(
    `INSERT INTO invite_codes (
      id, code, created_by, used_by, used_at, expires_at, is_temporary, feature_scope, bind_account_limit, is_active, created_at
    ) VALUES (
      $id, $code, $createdBy, NULL, NULL, NULL, 0, 'full', 1, 1, $createdAt
    )`,
    {
      $id: inviteCode.id,
      $code: inviteCode.code,
      $createdBy: adminUser.id,
      $createdAt: nowIso(),
    },
  );

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id IN ($adminId, $targetId)`, {
      $adminId: adminUser.id,
      $targetId: targetUser.id,
    });
    run(`DELETE FROM activation_codes WHERE id = $id`, { $id: activationCode.id });
    run(`DELETE FROM activation_codes WHERE created_by = $createdBy`, { $createdBy: adminUser.id });
    run(`DELETE FROM invite_codes WHERE id = $id`, { $id: inviteCode.id });
    run(`DELETE FROM invite_codes WHERE created_by = $createdBy`, { $createdBy: adminUser.id });
  });

  const baseUrl = makeBaseUrl(server);

  const denied = await fetch(`${baseUrl}/api/v1/admin/users/${targetUser.id}/admin`, {
    method: "PATCH",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({ isAdmin: true }),
  });
  assert.equal(denied.status, 403);
  const deniedPayload = await denied.json();
  assert.equal(deniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const inviteList = await fetch(`${baseUrl}/api/v1/admin/invite-codes`, {
    method: "GET",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(inviteList.status, 200);
  const inviteListPayload = await inviteList.json();
  const listedInvite = inviteListPayload?.data?.find((item) => item.id === inviteCode.id);
  assert.ok(listedInvite, "expected invite code in list");
  assert.notEqual(listedInvite.code, inviteCode.code);

  const activationList = await fetch(`${baseUrl}/api/v1/admin/activation-codes`, {
    method: "GET",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(activationList.status, 200);
  const activationListPayload = await activationList.json();
  const listedActivation = activationListPayload?.data?.find((item) => item.id === activationCode.id);
  assert.ok(listedActivation, "expected activation code in list");
  assert.notEqual(listedActivation.code, activationCode.code);

  const revealInviteDenied = await fetch(`${baseUrl}/api/v1/admin/invite-codes/${inviteCode.id}/reveal`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(revealInviteDenied.status, 403);
  const revealInviteDeniedPayload = await revealInviteDenied.json();
  assert.equal(revealInviteDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const createInviteDenied = await fetch(`${baseUrl}/api/v1/admin/invite-codes`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({ count: 1, featureScope: "full", bindAccountLimit: 1, isTemporary: false }),
  });
  assert.equal(createInviteDenied.status, 403);
  const createInviteDeniedPayload = await createInviteDenied.json();
  assert.equal(createInviteDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const disableInviteDenied = await fetch(`${baseUrl}/api/v1/admin/invite-codes/${inviteCode.id}/disable`, {
    method: "PATCH",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(disableInviteDenied.status, 403);
  const disableInviteDeniedPayload = await disableInviteDenied.json();
  assert.equal(disableInviteDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const revokeDenied = await fetch(`${baseUrl}/api/v1/admin/users/${targetUser.id}/revoke-sessions`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(revokeDenied.status, 403);
  const revokeDeniedPayload = await revokeDenied.json();
  assert.equal(revokeDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const unbindAllDenied = await fetch(`${baseUrl}/api/v1/admin/activation-codes/unbind-all`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(unbindAllDenied.status, 403);
  const unbindAllDeniedPayload = await unbindAllDenied.json();
  assert.equal(unbindAllDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const unbindDenied = await fetch(`${baseUrl}/api/v1/admin/activation-codes/${activationCode.id}/unbind`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(unbindDenied.status, 403);
  const unbindDeniedPayload = await unbindDenied.json();
  assert.equal(unbindDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const revealActivationDenied = await fetch(`${baseUrl}/api/v1/admin/activation-codes/${activationCode.id}/reveal`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(revealActivationDenied.status, 403);
  const revealActivationDeniedPayload = await revealActivationDenied.json();
  assert.equal(revealActivationDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const createActivationDenied = await fetch(`${baseUrl}/api/v1/admin/activation-codes`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({ count: 1, durationMonths: 1 }),
  });
  assert.equal(createActivationDenied.status, 403);
  const createActivationDeniedPayload = await createActivationDenied.json();
  assert.equal(createActivationDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const disableActivationDenied = await fetch(`${baseUrl}/api/v1/admin/activation-codes/${activationCode.id}/disable`, {
    method: "PATCH",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(disableActivationDenied.status, 403);
  const disableActivationDeniedPayload = await disableActivationDenied.json();
  assert.equal(disableActivationDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const deleteActivationDenied = await fetch(`${baseUrl}/api/v1/admin/activation-codes/${activationCode.id}`, {
    method: "DELETE",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(deleteActivationDenied.status, 403);
  const deleteActivationDeniedPayload = await deleteActivationDenied.json();
  assert.equal(deleteActivationDeniedPayload?.error?.code, "ADMIN_CONFIRM_REQUIRED");

  const badConfirm = await fetch(`${baseUrl}/api/v1/admin/confirm-password`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({ password: "wrong-password" }),
  });
  assert.equal(badConfirm.status, 400);

  const confirm = await fetch(`${baseUrl}/api/v1/admin/confirm-password`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({ totpCode: generateTotpCode({ secret: adminMfaSetup.secret }) }),
  });
  assert.equal(confirm.status, 200);
  const confirmPayload = await confirm.json();
  assert.equal(confirmPayload?.success, true);
  assert.ok(confirmPayload?.data?.token, "expected confirmation token");

  const allowed = await fetch(`${baseUrl}/api/v1/admin/users/${targetUser.id}/admin`, {
    method: "PATCH",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": confirmPayload.data.token,
    },
    body: JSON.stringify({ isAdmin: true }),
  });
  assert.equal(allowed.status, 200);

  const revealInviteAllowed = await fetch(`${baseUrl}/api/v1/admin/invite-codes/${inviteCode.id}/reveal`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": confirmPayload.data.token,
    },
  });
  assert.equal(revealInviteAllowed.status, 410);

  const disableInviteAllowed = await fetch(`${baseUrl}/api/v1/admin/invite-codes/${inviteCode.id}/disable`, {
    method: "PATCH",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": confirmPayload.data.token,
    },
  });
  assert.equal(disableInviteAllowed.status, 200);

  const revealActivationAllowed = await fetch(`${baseUrl}/api/v1/admin/activation-codes/${activationCode.id}/reveal`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": confirmPayload.data.token,
    },
  });
  assert.equal(revealActivationAllowed.status, 410);

  const revokeAllowed = await fetch(`${baseUrl}/api/v1/admin/users/${targetUser.id}/revoke-sessions`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": confirmPayload.data.token,
    },
  });
  assert.equal(revokeAllowed.status, 200);

  const unbindAllAllowed = await fetch(`${baseUrl}/api/v1/admin/activation-codes/unbind-all`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": confirmPayload.data.token,
    },
  });
  assert.equal(unbindAllAllowed.status, 200);

  const unbindAllowed = await fetch(`${baseUrl}/api/v1/admin/activation-codes/${activationCode.id}/unbind`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": confirmPayload.data.token,
    },
  });
  assert.equal(unbindAllowed.status, 200);

  const createActivationAllowed = await fetch(`${baseUrl}/api/v1/admin/activation-codes`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId: adminUser.id, username: adminUser.username }),
      "x-admin-confirm-token": confirmPayload.data.token,
    },
    body: JSON.stringify({ count: 1, durationMonths: 1 }),
  });
  assert.equal(createActivationAllowed.status, 200);

  const updatedRows = query(`SELECT is_admin as isAdmin FROM users WHERE id = $id`, { $id: targetUser.id });
  assert.equal(Number(updatedRows[0]?.isAdmin), 1);
});

test("admin confirmation requires MFA when admin has MFA enabled", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = {
    id: `user_admin_mfa_${suffix}`,
    username: `admin_mfa_${suffix}`,
    password: "Admin1234!Aa",
  };
  const targetUser = {
    id: `user_target_mfa_${suffix}`,
    username: `target_mfa_${suffix}`,
    password: "Target1234!Aa",
  };

  run(`DELETE FROM users WHERE id IN ($adminId, $targetId)`, {
    $adminId: adminUser.id,
    $targetId: targetUser.id,
  });

  insertUser({ ...adminUser, isAdmin: true });
  insertUser({ ...targetUser, isAdmin: false });

  const mfaSetup = enableAdminMfa({ userId: adminUser.id, username: adminUser.username });

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id IN ($adminId, $targetId)`, {
      $adminId: adminUser.id,
      $targetId: targetUser.id,
    });
  });

  const baseUrl = makeBaseUrl(server);
  const headers = authHeaders({ userId: adminUser.id, username: adminUser.username });

  const invalidTotpWithPassword = await fetch(`${baseUrl}/api/v1/admin/confirm-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      password: adminUser.password,
      totpCode: "000000",
    }),
  });
  assert.equal(invalidTotpWithPassword.status, 400);

  const totpCode = generateTotpCode({ secret: mfaSetup.secret });
  const mfaConfirm = await fetch(`${baseUrl}/api/v1/admin/confirm-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      totpCode,
    }),
  });
  assert.equal(mfaConfirm.status, 200);
  const mfaConfirmPayload = await mfaConfirm.json();
  assert.ok(mfaConfirmPayload?.data?.token, "expected mfa confirmation token");

  const allowedWithMfaToken = await fetch(`${baseUrl}/api/v1/admin/users/${targetUser.id}/admin`, {
    method: "PATCH",
    headers: {
      ...headers,
      "x-admin-confirm-token": mfaConfirmPayload.data.token,
    },
    body: JSON.stringify({ isAdmin: true }),
  });
  assert.equal(allowedWithMfaToken.status, 200);

  const passwordFallbackConfirm = await fetch(`${baseUrl}/api/v1/admin/confirm-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      password: adminUser.password,
    }),
  });
  assert.equal(passwordFallbackConfirm.status, 400);

  const recoveryConfirm = await fetch(`${baseUrl}/api/v1/admin/confirm-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      recoveryCode: mfaSetup.recoveryCodes[0],
    }),
  });
  assert.equal(recoveryConfirm.status, 200);
  const recoveryConfirmPayload = await recoveryConfirm.json();
  assert.ok(recoveryConfirmPayload?.data?.token, "expected recovery confirmation token");
});

test("admin routes require MFA-enabled admin account", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = {
    id: `user_admin_nomfa_${suffix}`,
    username: `admin_nomfa_${suffix}`,
    password: "Admin1234!Aa",
  };

  run(`DELETE FROM users WHERE id = $adminId`, {
    $adminId: adminUser.id,
  });

  insertUser({ ...adminUser, isAdmin: true });

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id = $adminId`, {
      $adminId: adminUser.id,
    });
  });

  const baseUrl = makeBaseUrl(server);
  const denied = await fetch(`${baseUrl}/api/v1/admin/invite-codes`, {
    method: "GET",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
  });
  assert.equal(denied.status, 403);
  const payload = await denied.json();
  assert.equal(payload?.error?.code, "AUTH_ADMIN_MFA_REQUIRED");
});
