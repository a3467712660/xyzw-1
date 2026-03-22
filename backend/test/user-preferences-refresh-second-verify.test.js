import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { initDatabase } from "../src/db/database.js";
import { nowIso } from "../src/db/sql.js";
import { run, query } from "../src/db/client.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
import userPreferencesRoutes from "../src/routes/userPreferences.js";
import { createUserRoutes } from "../src/app/userRoutes.js";

const PREF_KEY = "security.token_refresh_second_verify_enabled";

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
    "content-type": "application/json",
  };
};

test("refresh second verify preference: disabling does not require confirm, enabling requires confirm", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `pref_user_${suffix}`;
  const username = `pref_user_${suffix}`;
  const password = "PrefTest123!Aa";

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
  const headers = authHeaders({ userId, username });

  const disableRes = await fetch(`${baseUrl}/api/v1/user/preferences/${encodeURIComponent(PREF_KEY)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ value: false }),
  });
  assert.equal(disableRes.status, 200);

  const [disabledRow] = query(
    `SELECT value_json as valueJson
     FROM user_preferences
     WHERE user_id = $userId AND pref_key = $key`,
    { $userId: userId, $key: PREF_KEY },
  );
  assert.equal(disabledRow?.valueJson, "false");

  const enableDeniedRes = await fetch(`${baseUrl}/api/v1/user/preferences/${encodeURIComponent(PREF_KEY)}`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ value: true }),
  });
  assert.equal(enableDeniedRes.status, 403);

  const confirmRes = await fetch(`${baseUrl}/api/v1/user/confirm-password`, {
    method: "POST",
    headers,
    body: JSON.stringify({ password }),
  });
  assert.equal(confirmRes.status, 200);
  const confirmPayload = await confirmRes.json();
  const confirmToken = String(confirmPayload?.data?.token || "");
  assert.ok(confirmToken, "expected user confirm token");

  const enableRes = await fetch(`${baseUrl}/api/v1/user/preferences/${encodeURIComponent(PREF_KEY)}`, {
    method: "PUT",
    headers: {
      ...headers,
      "x-user-confirm-token": confirmToken,
    },
    body: JSON.stringify({ value: true }),
  });
  assert.equal(enableRes.status, 200);

  const [enabledRow] = query(
    `SELECT value_json as valueJson
     FROM user_preferences
     WHERE user_id = $userId AND pref_key = $key`,
    { $userId: userId, $key: PREF_KEY },
  );
  assert.equal(enabledRow?.valueJson, "true");
});
