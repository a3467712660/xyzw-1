import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { initDatabase } from "../src/db/database.js";
import { run } from "../src/db/client.js";
import { nowIso } from "../src/db/sql.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
import { createGameFeatureRoutes } from "../src/routes/gameFeatures.js";
import { createBattleReportRoutes } from "../src/routes/battleReports.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
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

const authHeaders = ({ userId, username }) => ({
  authorization: `Bearer ${signJwt({ sub: userId, username, ver: 0 }, 10 * 60)}`,
  "content-type": "application/json",
});

const createServer = async ({ gameService, battleService }) => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1", createGameFeatureRoutes({ gameService }));
  app.use("/api/v1", createBattleReportRoutes({ battleService }));
  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

test("game feature routes require auth, validate action allowlist, and do not expose secrets", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `game_user_${suffix}`;
  const username = `game_user_${suffix}`;
  const password = "GameTest123!Aa";
  createUser({ id: userId, username, password });
  t.after(() => run(`DELETE FROM users WHERE id = $userId`, { $userId: userId }));

  const calls = [];
  const server = await createServer({
    gameService: {
      getCatalog: () => ({
        features: [{ id: "daily-tasks", title: "日常任务" }],
        legionWar: { enabled: true },
        lineupAssistant: { enabled: true },
      }),
      getSummary: async ({ tokenId, user }) => ({
        tokenId,
        roleName: "Alice",
        serverName: "一区",
        binAvailable: true,
        userIdSeen: user.id,
        token: "should-not-leak",
      }),
      runAction: async ({ tokenId, actionId }) => {
        calls.push({ tokenId, actionId });
        return { actionId, status: "success", token: "should-not-leak" };
      },
      getLegionWarSnapshot: async () => ({
        battlefieldId: "bf-1",
        nodes: [{ id: "17,20", typeName: "据点", hp: 10, maxHp: 20 }],
        legions: [{ id: "l-1", name: "A", reviveLeft: 140 }],
      }),
      getLineups: async () => ({
        currentFormation: 1,
        saved: [{ id: "lineup-1", name: "一队", teamId: 1, slots: [] }],
      }),
      saveLineups: async ({ saved }) => ({ saved }),
      applyLineup: async ({ lineupId }) => ({ lineupId, stages: [{ id: "apply", status: "success" }] }),
    },
    battleService: {
      getCatalog: () => ({ types: [] }),
      queryReports: async () => ({ reports: [] }),
      parseReport: async () => ({ report: null }),
    },
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const denied = await fetch(`${baseUrl}/api/v1/game-features/catalog`);
  assert.equal(denied.status, 401);

  const catalog = await fetch(`${baseUrl}/api/v1/game-features/catalog`, {
    headers: authHeaders({ userId, username }),
  });
  assert.equal(catalog.status, 200);
  assert.equal((await catalog.json()).data.features[0].id, "daily-tasks");

  const invalidAction = await fetch(`${baseUrl}/api/v1/game-features/token-1/action`, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({ actionId: "raw-token-dump" }),
  });
  assert.equal(invalidAction.status, 400);

  const action = await fetch(`${baseUrl}/api/v1/game-features/token-1/action`, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({ actionId: "daily-tasks" }),
  });
  assert.equal(action.status, 200);
  const actionText = JSON.stringify(await action.json());
  assert.equal(actionText.includes("should-not-leak"), false);
  assert.deepEqual(calls, [{ tokenId: "token-1", actionId: "daily-tasks" }]);
});

test("battle report routes support query and reject invalid parse payloads", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `battle_user_${suffix}`;
  const username = `battle_user_${suffix}`;
  createUser({ id: userId, username, password: "BattleTest123!Aa" });
  t.after(() => run(`DELETE FROM users WHERE id = $userId`, { $userId: userId }));

  const server = await createServer({
    gameService: {
      getCatalog: () => ({}),
      getSummary: async () => ({}),
      runAction: async () => ({}),
      getLegionWarSnapshot: async () => ({}),
      getLineups: async () => ({}),
      saveLineups: async () => ({}),
      applyLineup: async () => ({}),
    },
    battleService: {
      getCatalog: () => ({
        types: [{ id: "salt-field", title: "盐场战报" }],
      }),
      queryReports: async ({ reportType, date }) => ({
        reports: [{ id: "r-1", reportType, title: "战报", summary: date, detail: { winner: "A" } }],
      }),
      parseReport: async ({ payload }) => ({
        report: { id: "parsed-1", reportType: "manual", title: "手动战报", detail: payload },
      }),
    },
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const queryRes = await fetch(`${baseUrl}/api/v1/battle-reports/token-1/query`, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({ reportType: "salt-field", date: "2026-04-19" }),
  });
  assert.equal(queryRes.status, 200);
  const queryPayload = await queryRes.json();
  assert.equal(queryPayload.data.reports[0].reportType, "salt-field");

  const invalidParse = await fetch(`${baseUrl}/api/v1/battle-reports/parse`, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({ rawText: "not-json" }),
  });
  assert.equal(invalidParse.status, 400);

  const parseRes = await fetch(`${baseUrl}/api/v1/battle-reports/parse`, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({ rawText: "{\"winner\":\"A\"}" }),
  });
  assert.equal(parseRes.status, 200);
  const parseText = JSON.stringify(await parseRes.json());
  assert.equal(parseText.includes("token"), false);
  assert.equal(parseText.includes("cookie"), false);
});
