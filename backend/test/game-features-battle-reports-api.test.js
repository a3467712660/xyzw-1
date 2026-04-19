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

const createClubMemberExportPayload = (overrides = {}) => ({
  clubName: "测试俱乐部",
  exportedAt: "2026-04-19 12:00",
  memberCount: 2,
  members: [
    {
      index: 1,
      name: "成员甲",
      roleId: "100001",
      powerText: "123.45亿",
      redQuenchText: "10红",
      lineupType: "控制",
      jobLabel: "会长",
      avatarText: "甲",
    },
    {
      index: 2,
      name: "成员乙",
      roleId: "100002",
      powerText: "88.00亿",
      redQuenchText: "5红",
      lineupType: "-",
      jobLabel: "成员",
      avatarText: "乙",
    },
  ],
  ...overrides,
});

const createBattleReportExportPayload = (overrides = {}) => ({
  reportType: "salt-field",
  title: "测试盐场战报",
  subtitle: "测试俱乐部 · 盐场周战绩",
  reportDate: "2026/04/18",
  exportedAt: "2026-04-19 12:00",
  sections: [
    {
      title: "测试俱乐部 盐场周报",
      subtitle: "按击杀数排序 · 共 2 人",
      tone: "salt",
      metric2Label: "死亡",
      metric3Label: "攻城",
      stats: [
        { label: "参战人数", value: "2" },
        { label: "总击杀", value: "30" },
        { label: "总死亡", value: "10" },
      ],
      rows: [
        {
          index: 1,
          name: "战报成员甲",
          roleId: "200001",
          avatarText: "甲",
          killText: "20",
          metric2Text: "4",
          metric3Text: "8",
          kdText: "5.00",
          noteText: "复活丹 0",
        },
        {
          index: 2,
          name: "战报成员乙",
          roleId: "200002",
          avatarText: "乙",
          killText: "10",
          metric2Text: "6",
          metric3Text: "2",
          kdText: "1.67",
          noteText: "复活丹 1",
        },
      ],
    },
  ],
  ...overrides,
});

test("club member export image route renders fixed-width PNG and rejects unsafe payloads", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `club_export_user_${suffix}`;
  const username = `club_export_user_${suffix}`;
  createUser({ id: userId, username, password: "GameTest123!Aa" });
  t.after(() => run(`DELETE FROM users WHERE id = $userId`, { $userId: userId }));

  const server = await createServer({
    gameService: {
      getCatalog: () => ({ features: [] }),
      getWorkbenchCatalog: () => ({ modules: [] }),
      getRenderedReplayImage: async () => null,
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
  const exportUrl = `${baseUrl}/api/v1/game-features/token-1/club-members/export-image`;
  const denied = await fetch(exportUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createClubMemberExportPayload()),
  });
  assert.equal(denied.status, 401);

  const headers = authHeaders({ userId, username });
  const image = await fetch(exportUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(createClubMemberExportPayload({
      clubName: "测试俱乐部 should-not-leak",
    })),
  });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/png");
  assert.equal(image.headers.get("cache-control"), "no-store");
  const imageBody = Buffer.from(await image.arrayBuffer());
  assert.equal(imageBody.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(imageBody.readUInt32BE(16), 1200);
  assert.equal(imageBody.includes(Buffer.from("token")), false);
  assert.equal(imageBody.includes(Buffer.from("cookie")), false);
  assert.equal(imageBody.includes(Buffer.from("password")), false);

  const tooManyMembers = Array.from({ length: 221 }, (_, index) => ({
    index: index + 1,
    name: `成员${index + 1}`,
    roleId: `${100000 + index}`,
    powerText: "1亿",
    redQuenchText: "0红",
    lineupType: "-",
    jobLabel: "成员",
    avatarText: "员",
  }));
  const tooMany = await fetch(exportUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(createClubMemberExportPayload({
      memberCount: tooManyMembers.length,
      members: tooManyMembers,
    })),
  });
  assert.equal(tooMany.status, 400);

  const extraSensitiveField = await fetch(exportUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(createClubMemberExportPayload({
      members: [
        {
          ...createClubMemberExportPayload().members[0],
          token: "should-not-be-accepted",
        },
      ],
      cookie: "should-not-be-accepted",
    })),
  });
  assert.equal(extraSensitiveField.status, 400);

  const badTokenId = await fetch(`${baseUrl}/api/v1/game-features/bad!/club-members/export-image`, {
    method: "POST",
    headers,
    body: JSON.stringify(createClubMemberExportPayload()),
  });
  assert.equal(badTokenId.status, 400);
});

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
      broadcastLegionWarReviveInfo: async ({ legions }) => ({
        status: "success",
        sentCount: 1,
        messages: legions.map((item) => `${item.name}:剩${item.reviveLeft}`),
        token: "should-not-leak",
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

  const broadcast = await fetch(`${baseUrl}/api/v1/game-features/token-1/legion-war/broadcast-revive`, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({ legions: [{ id: "l-1", name: "A", reviveLeft: 140 }] }),
  });
  assert.equal(broadcast.status, 200);
  const broadcastText = JSON.stringify(await broadcast.json());
  assert.match(broadcastText, /A:剩140/);
  assert.equal(broadcastText.includes("should-not-leak"), false);
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
      broadcastLegionWarReviveInfo: async () => ({}),
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

  const exportUrl = `${baseUrl}/api/v1/battle-reports/token-1/export-image`;
  const deniedExport = await fetch(exportUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(createBattleReportExportPayload()),
  });
  assert.equal(deniedExport.status, 401);

  const exportImage = await fetch(exportUrl, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify(createBattleReportExportPayload()),
  });
  assert.equal(exportImage.status, 200);
  assert.equal(exportImage.headers.get("content-type"), "image/png");
  assert.equal(exportImage.headers.get("cache-control"), "no-store");
  const exportImageBody = Buffer.from(await exportImage.arrayBuffer());
  assert.equal(exportImageBody.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(exportImageBody.readUInt32BE(16), 1200);
  assert.equal(exportImageBody.includes(Buffer.from("token")), false);
  assert.equal(exportImageBody.includes(Buffer.from("cookie")), false);
  assert.equal(exportImageBody.includes(Buffer.from("password")), false);

  const peachRows = [
    {
      index: 1,
      name: "我方成员甲",
      roleId: "300001",
      avatarText: "甲",
      killText: "20",
      metric2Text: "4",
      metric3Text: "8",
      kdText: "5.00",
      noteText: "3",
    },
    {
      index: 2,
      name: "我方成员乙",
      roleId: "300002",
      avatarText: "乙",
      killText: "10",
      metric2Text: "6",
      metric3Text: "2",
      kdText: "1.67",
      noteText: "1",
    },
  ];
  const peachSection = (title, tone) => ({
    title,
    subtitle: `${tone === "own" ? "我方" : "敌方"}战绩 · 共 2 人`,
    tone,
    metric2Label: "复活",
    metric3Label: "连杀",
    stats: [
      { label: "总 K/D", value: "3.00" },
      { label: "总击杀", value: "30" },
      { label: "总复活", value: "10" },
      { label: "人均击杀", value: "15.0" },
    ],
    rankPanels: [
      {
        key: "kill",
        title: "击杀 Top3",
        items: peachRows.map((row) => ({ name: row.name, value: row.killText })),
      },
      {
        key: "kd",
        title: "KD Top3",
        items: peachRows.map((row) => ({ name: row.name, value: row.kdText })),
      },
    ],
    rows: peachRows,
  });
  const peachExport = await fetch(exportUrl, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify(createBattleReportExportPayload({
      reportType: "peach-garden",
      title: "测试蟠桃园战报",
      subtitle: "我方俱乐部 VS 敌方俱乐部",
      badgeLabel: "对战双方",
      badgeValue: "2 队",
      sections: [
        peachSection("我方俱乐部", "own"),
        peachSection("敌方俱乐部", "opponent"),
      ],
    })),
  });
  assert.equal(peachExport.status, 200);
  assert.equal(peachExport.headers.get("content-type"), "image/png");
  const peachExportBody = Buffer.from(await peachExport.arrayBuffer());
  assert.equal(peachExportBody.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(peachExportBody.readUInt32BE(16), 1200);

  const tooManyRows = Array.from({ length: 221 }, (_, index) => ({
    index: index + 1,
    name: `成员${index + 1}`,
    roleId: `${200000 + index}`,
    avatarText: "员",
    killText: "1",
    metric2Text: "0",
    metric3Text: "0",
    kdText: "0.00",
    noteText: "-",
  }));
  const tooMany = await fetch(exportUrl, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify(createBattleReportExportPayload({
      sections: [
        {
          ...createBattleReportExportPayload().sections[0],
          rows: tooManyRows,
        },
      ],
    })),
  });
  assert.equal(tooMany.status, 400);

  const extraSensitiveField = await fetch(exportUrl, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify(createBattleReportExportPayload({
      sections: [
        {
          ...createBattleReportExportPayload().sections[0],
          rows: [
            {
              ...createBattleReportExportPayload().sections[0].rows[0],
              token: "should-not-be-accepted",
            },
          ],
        },
      ],
      cookie: "should-not-be-accepted",
    })),
  });
  assert.equal(extraSensitiveField.status, 400);

  const badTokenId = await fetch(`${baseUrl}/api/v1/battle-reports/bad!/export-image`, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify(createBattleReportExportPayload()),
  });
  assert.equal(badTokenId.status, 400);
});

test("battle report query maps game 200020 to friendly empty state", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `battle_empty_user_${suffix}`;
  const username = `battle_empty_user_${suffix}`;
  createUser({ id: userId, username, password: "BattleEmpty123!Aa" });
  t.after(() => run(`DELETE FROM users WHERE id = $userId`, { $userId: userId }));

  const noDataError = new Error("服务器错误: 200020 - 无战报");
  noDataError.code = "200020";
  noDataError.payload = { errCode: 200020 };

  const server = await createServer({
    gameService: {
      getCatalog: () => ({}),
      getSummary: async () => ({}),
      runAction: async () => ({}),
      getLegionWarSnapshot: async () => ({}),
      broadcastLegionWarReviveInfo: async () => ({}),
      getLineups: async () => ({}),
      saveLineups: async () => ({}),
      applyLineup: async () => ({}),
    },
    battleService: {
      getCatalog: () => ({
        types: [{ id: "peach-garden", title: "蟠桃园战报" }],
      }),
      queryReports: async () => {
        throw noDataError;
      },
      parseReport: async () => ({ report: null }),
    },
  });
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const queryRes = await fetch(`${baseUrl}/api/v1/battle-reports/token-1/query`, {
    method: "POST",
    headers: authHeaders({ userId, username }),
    body: JSON.stringify({ reportType: "peach-garden", date: "2026-04-19" }),
  });

  assert.equal(queryRes.status, 200);
  const payload = await queryRes.json();
  assert.equal(payload.success, true);
  assert.deepEqual(payload.data.reports, []);
  assert.equal(payload.data.businessCode, "200020");
  assert.equal(payload.data.emptyReason, "当天暂无战报，可能未参加或战报尚未生成");
});

test("game workbench routes expose native modules, cards, allowlisted actions, and replay renders", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const userId = `workbench_user_${suffix}`;
  const username = `workbench_user_${suffix}`;
  createUser({ id: userId, username, password: "Workbench123!Aa" });
  t.after(() => run(`DELETE FROM users WHERE id = $userId`, { $userId: userId }));

  const calls = [];
  const server = await createServer({
    gameService: {
      getCatalog: () => ({}),
      getSummary: async () => ({}),
      runAction: async () => ({}),
      getLegionWarSnapshot: async () => ({}),
      broadcastLegionWarReviveInfo: async () => ({}),
      getLineups: async () => ({}),
      saveLineups: async () => ({}),
      applyLineup: async () => ({}),
      getWorkbenchCatalog: () => ({
        modules: [
          {
            id: "daily",
            label: "日常",
            groupId: "operations",
            sections: [{ id: "daily", label: "日常" }],
          },
          {
            id: "dataAnalysis",
            label: "数据分析",
            groupId: "analysis",
            sections: [{ id: "rankGroup", label: "榜单" }],
          },
        ],
      }),
      getWorkbenchBootstrap: async ({ tokenId, user }) => ({
        tokenId,
        selectedModuleId: "daily",
        selectedSectionId: "daily",
        connectionStatus: "ready",
        roleName: "Alice",
        userIdSeen: user.id,
        token: "should-not-leak",
      }),
      getWorkbenchSection: async ({ sectionId }) => ({
        moduleId: "daily",
        sectionId,
        title: "日常",
        cards: [
          {
            id: "daily-task-status",
            type: "task",
            title: "日常任务",
            status: "ready",
            metrics: [{ label: "进度", value: "3/5" }],
            actions: [{ id: "daily-tasks", label: "领取奖励", enabled: true }],
            detail: { cookie: "should-not-leak" },
          },
        ],
      }),
      runWorkbenchAction: async ({ tokenId, actionId }) => {
        calls.push({ tokenId, actionId });
        return {
          actionId,
          status: "success",
          message: "已执行",
          card: { id: "daily-task-status", title: "日常任务" },
          token: "should-not-leak",
        };
      },
      renderWorkbenchReplay: async ({ tokenId, payload }) => ({
        renderId: `render-${tokenId}`,
        imageUrl: `/api/v1/game-features/rendered-replays/render-${tokenId}/image`,
        summary: "胜利",
        diagnostics: { payloadShape: payload?.shape || "empty", signature: "should-not-leak" },
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
      getRenderedReplayImage: async ({ renderId }) => ({
        renderId,
        contentType: "image/svg+xml",
        body: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
      }),
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
  const headers = authHeaders({ userId, username });

  const catalog = await fetch(`${baseUrl}/api/v1/game-features/workbench/catalog`, { headers });
  assert.equal(catalog.status, 200);
  const catalogPayload = await catalog.json();
  assert.deepEqual(catalogPayload.data.modules.map((item) => item.id), ["daily", "dataAnalysis"]);

  const bootstrap = await fetch(`${baseUrl}/api/v1/game-features/token-1/workbench/bootstrap`, {
    method: "POST",
    headers,
    body: "{}",
  });
  assert.equal(bootstrap.status, 200);
  const bootstrapText = JSON.stringify(await bootstrap.json());
  assert.equal(bootstrapText.includes("should-not-leak"), false);
  assert.match(bootstrapText, /daily/);

  const section = await fetch(`${baseUrl}/api/v1/game-features/token-1/workbench/section`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sectionId: "daily" }),
  });
  assert.equal(section.status, 200);
  const sectionText = JSON.stringify(await section.json());
  assert.match(sectionText, /daily-task-status/);
  assert.equal(sectionText.includes("should-not-leak"), false);

  const invalidAction = await fetch(`${baseUrl}/api/v1/game-features/token-1/workbench/action`, {
    method: "POST",
    headers,
    body: JSON.stringify({ actionId: "raw-token-dump" }),
  });
  assert.equal(invalidAction.status, 400);

  const action = await fetch(`${baseUrl}/api/v1/game-features/token-1/workbench/action`, {
    method: "POST",
    headers,
    body: JSON.stringify({ sectionId: "daily", cardId: "daily-task-status", actionId: "daily-tasks" }),
  });
  assert.equal(action.status, 200);
  const actionText = JSON.stringify(await action.json());
  assert.equal(actionText.includes("should-not-leak"), false);
  assert.deepEqual(calls, [{ tokenId: "token-1", actionId: "daily-tasks" }]);

  const replay = await fetch(`${baseUrl}/api/v1/game-features/token-1/workbench/replay-render`, {
    method: "POST",
    headers,
    body: JSON.stringify({ payload: { shape: "fight-pvp", token: "should-not-leak" } }),
  });
  assert.equal(replay.status, 200);
  const replayPayload = await replay.json();
  assert.equal(replayPayload.data.imageUrl, "/api/v1/game-features/rendered-replays/render-token-1/image");
  assert.equal(JSON.stringify(replayPayload).includes("should-not-leak"), false);

  const image = await fetch(`${baseUrl}${replayPayload.data.imageUrl}`, { headers });
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/svg+xml");
});
