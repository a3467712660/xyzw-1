import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { initDatabase } from "../src/db/database.js";
import { nowIso } from "../src/db/sql.js";
import { query, run } from "../src/db/client.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
import binFileRoutes from "../src/routes/binFiles.js";
import { createUserRoutes } from "../src/app/userRoutes.js";
import userPreferencesRoutes from "../src/routes/userPreferences.js";

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
  app.use("/api/v1", binFileRoutes);
  app.use("/api/v1", userPreferencesRoutes);
  app.use("/api/v1/user", createUserRoutes());

  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const createUser = ({ id, username, password }) => {
  const ts = nowIso();
  const meta = createPassword(password);
  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, $createdAt, $updatedAt
    )`,
    {
      $id: id,
      $username: username,
      $salt: meta.salt,
      $hash: meta.hash,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
};

const authHeaders = ({ userId, username }) => {
  const token = signJwt({ sub: userId, username, ver: 0 }, 60 * 10);
  return {
    authorization: `Bearer ${token}`,
  };
};

const assertBinPlaintextResponseHardeningHeaders = (response) => {
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("pragma"), "no-cache");
  assert.equal(response.headers.get("expires"), "0");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
};

test("GET /bin-files/:tokenId/download requires remote download preference to be enabled", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `bin_user_${suffix}`;
  const username = `bin_user_${suffix}`;
  const password = "BinTest123!Aa";
  const tokenId = `token_${suffix}`;
  const ts = nowIso();

  run(`DELETE FROM user_preferences WHERE user_id = $userId`, { $userId: userId });
  run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });

  createUser({ id: userId, username, password });

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM user_preferences WHERE user_id = $userId`, { $userId: userId });
    run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  });

  const baseUrl = makeBaseUrl(server);
  const putResponse = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}`, {
    method: "PUT",
    headers: {
      ...authHeaders({ userId, username }),
      "content-type": "application/octet-stream",
    },
    body: Buffer.from("bin-data"),
  });
  assert.equal(putResponse.status, 200);

  const deniedWithoutConfirm = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}`, {
    method: "GET",
    headers: authHeaders({ userId, username }),
  });
  assert.equal(deniedWithoutConfirm.status, 403);

  const deniedWithBypassHeader = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}`, {
    method: "GET",
    headers: {
      ...authHeaders({ userId, username }),
      "x-refresh-second-verify-enabled": "false",
    },
  });
  assert.equal(deniedWithBypassHeader.status, 403);

  run(
    `INSERT INTO user_preferences (user_id, pref_key, value_json, created_at, updated_at)
     VALUES ($userId, $key, $valueJson, $createdAt, $updatedAt)`,
    {
      $userId: userId,
      $key: "security.token_refresh_second_verify_enabled",
      $valueJson: "false",
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
  const deniedByServerPreference = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}`, {
    method: "GET",
    headers: authHeaders({ userId, username }),
  });
  assert.equal(deniedByServerPreference.status, 403);

  const confirmResponse = await fetch(`${baseUrl}/api/v1/user/confirm-password`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId, username }),
      "content-type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  assert.equal(confirmResponse.status, 200);
  const confirmPayload = await confirmResponse.json();
  const confirmToken = String(confirmPayload?.data?.token || "");
  assert.ok(confirmToken, "expected user confirm token");

  const internal = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}`, {
    method: "GET",
    headers: {
      ...authHeaders({ userId, username }),
      "x-user-confirm-token": confirmToken,
    },
  });
  assert.equal(internal.status, 200);
  assertBinPlaintextResponseHardeningHeaders(internal);
  assert.equal(Buffer.from(await internal.arrayBuffer()).toString("utf8"), "bin-data");

  const deniedWithoutTicket = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}/download`, {
    method: "GET",
    headers: {
      ...authHeaders({ userId, username }),
    },
  });
  assert.equal(deniedWithoutTicket.status, 403);

  const deniedTicketWithoutConfirm = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}/download-ticket`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId, username }),
    },
  });
  assert.equal(deniedTicketWithoutConfirm.status, 403);

  run(
    `INSERT INTO user_preferences (user_id, pref_key, value_json, created_at, updated_at)
     VALUES ($userId, $key, $valueJson, $createdAt, $updatedAt)`,
    {
      $userId: userId,
      $key: "security.remote_bin_download_enabled",
      $valueJson: "true",
      $createdAt: ts,
      $updatedAt: ts,
    },
  );

  const ticketResponse = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}/download-ticket`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId, username }),
      "x-user-confirm-token": confirmToken,
    },
  });
  assert.equal(ticketResponse.status, 200);
  const ticketPayload = await ticketResponse.json();
  const ticket = String(ticketPayload?.data?.ticket || "");
  assert.ok(ticket, "expected download ticket");

  const allowed = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}/download?ticket=${encodeURIComponent(ticket)}`, {
    method: "GET",
    headers: {
      ...authHeaders({ userId, username }),
    },
  });
  assert.equal(allowed.status, 200);
  assertBinPlaintextResponseHardeningHeaders(allowed);
  const body = Buffer.from(await allowed.arrayBuffer()).toString("utf8");
  assert.equal(body, "bin-data");

  const replay = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}/download?ticket=${encodeURIComponent(ticket)}`, {
    method: "GET",
    headers: authHeaders({ userId, username }),
  });
  assert.equal(replay.status, 403);

  const expiredTicketId = `bdt_expired_${suffix}`;
  run(
    `INSERT INTO bin_download_tickets (
      id, user_id, token_id, expires_at, used_at, used_ip, used_user_agent, created_ip, created_user_agent, created_at
    ) VALUES (
      $id, $userId, $tokenId, $expiresAt, NULL, NULL, NULL, NULL, NULL, $createdAt
    )`,
    {
      $id: expiredTicketId,
      $userId: userId,
      $tokenId: tokenId,
      $expiresAt: new Date(Date.now() - 60 * 1000).toISOString(),
      $createdAt: nowIso(),
    },
  );
  const expiredTicketResponse = await fetch(
    `${baseUrl}/api/v1/bin-files/${tokenId}/download?ticket=${encodeURIComponent(expiredTicketId)}`,
    {
      method: "GET",
      headers: authHeaders({ userId, username }),
    },
  );
  assert.equal(expiredTicketResponse.status, 403);

  const ticketAudits = query(
    `SELECT action, result
     FROM bin_download_audits
     WHERE user_id = $userId
       AND token_id = $tokenId
       AND action IN ('bin_download_ticket_issue', 'bin_download')
     ORDER BY created_at ASC`,
    { $userId: userId, $tokenId: tokenId },
  );
  assert.ok(ticketAudits.some((row) => row.action === "bin_download_ticket_issue" && row.result === "success"));
  assert.ok(ticketAudits.some((row) => row.action === "bin_download" && row.result === "success"));
  assert.ok(ticketAudits.some((row) => row.action === "bin_download" && row.result === "ticket_invalid"));

  const confirmAudits = query(
    `SELECT action, result
     FROM bin_download_audits
     WHERE user_id = $userId
       AND token_id = $tokenId
       AND action = 'bin_confirm_check'`,
    { $userId: userId, $tokenId: tokenId },
  );
  assert.ok(confirmAudits.some((row) => row.result === "required"));
});

test("PUT /user/preferences/security.remote_bin_download_enabled requires user confirm token", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `pref_user_${suffix}`;
  const username = `pref_user_${suffix}`;
  const password = "PrefTest123!Aa";
  createUser({ id: userId, username, password });

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM user_preferences WHERE user_id = $userId`, { $userId: userId });
    run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  });

  const baseUrl = makeBaseUrl(server);
  const denied = await fetch(`${baseUrl}/api/v1/user/preferences/security.remote_bin_download_enabled`, {
    method: "PUT",
    headers: {
      ...authHeaders({ userId, username }),
      "content-type": "application/json",
    },
    body: JSON.stringify({ value: true }),
  });
  assert.equal(denied.status, 403);

  const confirmResponse = await fetch(`${baseUrl}/api/v1/user/confirm-password`, {
    method: "POST",
    headers: {
      ...authHeaders({ userId, username }),
      "content-type": "application/json",
    },
    body: JSON.stringify({ password }),
  });
  assert.equal(confirmResponse.status, 200);
  const confirmPayload = await confirmResponse.json();
  const confirmToken = String(confirmPayload?.data?.token || "");
  assert.ok(confirmToken);

  const allowed = await fetch(`${baseUrl}/api/v1/user/preferences/security.remote_bin_download_enabled`, {
    method: "PUT",
    headers: {
      ...authHeaders({ userId, username }),
      "x-user-confirm-token": confirmToken,
      "content-type": "application/json",
    },
    body: JSON.stringify({ value: true }),
  });
  assert.equal(allowed.status, 200);
  const allowedPayload = await allowed.json();
  assert.equal(allowedPayload?.data?.value, true);
  assert.ok(allowedPayload?.data?.expiresAt, "expected lease expiry");

  const [storedRow] = query(
    `SELECT value_json as valueJson
     FROM user_preferences
     WHERE user_id = $userId AND pref_key = 'security.remote_bin_download_enabled'`,
    { $userId: userId },
  );
  const storedValue = JSON.parse(String(storedRow?.valueJson || "null"));
  assert.equal(storedValue?.enabled, true);
  assert.ok(storedValue?.expiresAt, "expected stored lease expiry");
});

test("GET /user/preferences/security.remote_bin_download_enabled returns false after lease expiry", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `pref_user_${suffix}`;
  const username = `pref_user_${suffix}`;
  const password = "PrefTest123!Aa";
  createUser({ id: userId, username, password });

  const expiredAt = new Date(Date.now() - 60 * 1000).toISOString();
  run(
    `INSERT INTO user_preferences (user_id, pref_key, value_json, created_at, updated_at)
     VALUES ($userId, 'security.remote_bin_download_enabled', $valueJson, $createdAt, $updatedAt)`,
    {
      $userId: userId,
      $valueJson: JSON.stringify({ enabled: true, expiresAt: expiredAt }),
      $createdAt: nowIso(),
      $updatedAt: nowIso(),
    },
  );

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM user_preferences WHERE user_id = $userId`, { $userId: userId });
    run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  });

  const baseUrl = makeBaseUrl(server);
  const res = await fetch(`${baseUrl}/api/v1/user/preferences/security.remote_bin_download_enabled`, {
    headers: authHeaders({ userId, username }),
  });
  assert.equal(res.status, 200);
  const payload = await res.json();
  assert.equal(payload?.data?.value, false);
  assert.equal(payload?.data?.expiresAt, expiredAt);
});

test("PUT /bin-files/:tokenId rejects malformed bin payload and does not persist file", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `bin_invalid_user_${suffix}`;
  const username = `bin_invalid_user_${suffix}`;
  const password = "BinInvalid123!Aa";
  const tokenId = `token_invalid_${suffix}`;

  run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  createUser({ id: userId, username, password });

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM users WHERE id = $userId`, { $userId: userId });
  });

  const baseUrl = makeBaseUrl(server);
  const malformed = await fetch(`${baseUrl}/api/v1/bin-files/${tokenId}`, {
    method: "PUT",
    headers: {
      ...authHeaders({ userId, username }),
      "content-type": "application/octet-stream",
    },
    body: Buffer.from("tiny"),
  });
  assert.equal(malformed.status, 400);

  const listResponse = await fetch(`${baseUrl}/api/v1/bin-files`, {
    method: "GET",
    headers: authHeaders({ userId, username }),
  });
  assert.equal(listResponse.status, 200);
  const listPayload = await listResponse.json();
  const rows = Array.isArray(listPayload?.data) ? listPayload.data : [];
  assert.equal(rows.some((item) => item.tokenId === tokenId), false);
});
