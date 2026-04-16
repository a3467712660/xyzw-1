import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFightPvpBattleInputData,
} from "../../src/services/replay/fightPvpBattleInputSnapshot.js";
import {
  createFightPvpReplayRecordFromBattleInput,
} from "../../src/services/replay/fightPvpReplayNormalizer.js";
import {
  buildFightPvpReplayLiveContext,
  FIGHT_PVP_REPLAY_LIVE_CONTEXT_REFRESH_TIMEOUT_MS,
  MAX_FIGHT_PVP_REPLAYS,
  appendFightPvpReplay,
  buildFightPvpReplayStorageKey,
  clearFightPvpReplays,
  loadFightPvpReplays,
  refreshFightPvpReplayLiveContext,
  removeFightPvpReplay,
} from "../../src/services/replay/fightPvpReplayStorage.js";

const createLiveReplayRecord = (index) => {
  const battleInputData = buildFightPvpBattleInputData({
    battleData: {
      id: `battle-${index}`,
      version: 1,
      mode: 7,
      leftTeam: {
        roleId: "role-left",
        name: "我方",
        headImg: "",
        power: 1,
        team: {
          0: { heroId: 1001 },
        },
      },
      rightTeam: {
        roleId: "role-right",
        name: "敌方",
        headImg: "",
        power: 2,
        team: {
          0: { heroId: 2001 },
        },
      },
      result: {
        isWin: index % 2 === 0,
      },
    },
    battleResult: {
      isWin: index % 2 === 0,
    },
    mapId: 40001,
    mapIdSource: "runtime.ROLE.pvpMapId",
    mapIdResolveReason: null,
    runtimeRoleAvailable: true,
    runtimeRolePath: "runtime.ROLE",
    stageNameStr: "切磋系统",
    startTipTopName: "切磋系统",
    startTipStage: "开始切磋",
    options: new Map([
      ["targetRole", { roleId: "role-right", name: "敌方" }],
      ["selfScore", 10 + index],
      ["oppoScore", 8 + index],
    ]),
  });

  return createFightPvpReplayRecordFromBattleInput({
    battleInputData,
    tokenId: "token-a",
    targetId: "role-right",
    targetName: "敌方",
    createdAt: new Date(Date.UTC(2026, 3, 15, 12, 0, index)).toISOString(),
    mapId: 40001,
    pvpMapId: 40001,
    mapIdSource: "runtime.ROLE.pvpMapId",
    pvpMapIdSource: "runtime.ROLE.pvpMapId",
    runtimeRoleAvailable: true,
    runtimeRolePath: "runtime.ROLE",
    runtimeRoleMapId: 40001,
  });
};

const createLegacyReplayPayload = (index, overrides = {}) => ({
  replayId: `fight-pvp-live:battle-${index}`,
  battleId: `battle-${index}`,
  battleVersion: 1,
  tokenId: "token-a",
  source: "fight-pvp-live",
  targetId: "role-right",
  targetName: "敌方",
  createdAt: new Date(Date.UTC(2026, 3, 15, 12, 0, index)).toISOString(),
  battleData: {
    id: `battle-${index}`,
    version: 1,
    mode: 7,
    leftTeam: {
      roleId: "role-left",
      name: "我方",
      team: {
        0: { heroId: 1001 },
      },
    },
    rightTeam: {
      roleId: "role-right",
      name: "敌方",
      team: {
        0: { heroId: 2001 },
      },
    },
    result: {
      isWin: index % 2 === 0,
    },
  },
  battleResult: {
    isWin: index % 2 === 0,
  },
  left: {
    roleId: "role-left",
    name: "我方",
    headImg: "",
    power: 1,
  },
  right: {
    roleId: "role-right",
    name: "敌方",
    headImg: "",
    power: 2,
  },
  stageNameStr: "切磋系统",
  startTipTopName: "切磋系统",
  startTipStage: "开始切磋",
  runtimeOptionsSnapshot: {
    targetRole: {
      roleId: "role-right",
      name: "敌方",
    },
    selfScore: 20,
    oppoScore: 18,
    replayFlag: true,
  },
  mapId: 120001,
  pvpMapId: 120001,
  mapIdSource: "replay.mapId",
  pvpMapIdSource: "replay.pvpMapId",
  selfRoleSnapshot: {
    roleId: "role-left",
    pvpMapId: 120001,
    dressPvpMapUsedId: null,
    dressPvpMapMapId: null,
    dress: null,
  },
  context: {
    pvpMapId: 120001,
    dressPvpMapUsedId: null,
    dressPvpMapMapId: null,
    dress: null,
  },
  meta: {
    mapIdDiagnostics: {
      tried: ["replay.mapId"],
      values: {
        "replay.mapId": 120001,
      },
      availableValues: {
        "replay.mapId": 120001,
      },
    },
  },
  ...overrides,
});

test.beforeEach(() => {
  const backingStore = new Map();
  delete globalThis.PVPMapConf;
  delete globalThis.__require;
  globalThis.localStorage = {
    clear() {
      backingStore.clear();
    },
    getItem(key) {
      return backingStore.has(key) ? backingStore.get(key) : null;
    },
    removeItem(key) {
      backingStore.delete(key);
    },
    setItem(key, value) {
      backingStore.set(key, String(value));
    },
  };
});

test.after(() => {
  delete globalThis.PVPMapConf;
  delete globalThis.__require;
  delete globalThis.localStorage;
});

test("fight pvp replay storage isolates records by user and token with v2 keys", () => {
  assert.equal(
    buildFightPvpReplayStorageKey({ userId: "user-1", tokenId: "token-1" }),
    "fight_pvp_replays_v3:user-1:token-1",
  );
});

test("fight pvp replay storage builds liveContext from cached roleInfo", () => {
  const tokenStoreRoleInfo = {
    role: {
      roleId: "role-left",
    },
  };

  assert.deepEqual(
    buildFightPvpReplayLiveContext({
      tokenStore: {
        gameData: {
          roleInfo: tokenStoreRoleInfo,
        },
      },
    }),
    {
      tokenStoreRoleInfo,
    },
  );
});

test("fight pvp replay storage quick refreshes liveContext before replay when cache is missing", async () => {
  const calls = [];
  const tokenStoreRoleInfo = {
    role: {
      roleId: "role-left",
      pvpMapId: 120009,
    },
  };
  const tokenStore = {
    gameData: {
      roleInfo: null,
      lastUpdated: null,
    },
    getWebSocketStatus(tokenId) {
      calls.push(["status", tokenId]);
      return "connected";
    },
    async sendMessageWithPromise(tokenId, cmd, params, timeout) {
      calls.push([tokenId, cmd, params, timeout]);
      return tokenStoreRoleInfo;
    },
  };

  const liveContext = await refreshFightPvpReplayLiveContext({
    tokenStore,
    tokenId: "token-a",
  });

  assert.deepEqual(liveContext, {
    tokenStoreRoleInfo,
  });
  assert.deepEqual(calls, [
    ["status", "token-a"],
    [
      "token-a",
      "role_getroleinfo",
      {},
      FIGHT_PVP_REPLAY_LIVE_CONTEXT_REFRESH_TIMEOUT_MS,
    ],
  ]);
  assert.equal(tokenStore.gameData.roleInfo, tokenStoreRoleInfo);
});

test("fight pvp replay storage appends, stores snapshots, dedupes, and keeps newest records first", () => {
  appendFightPvpReplay({
    userId: "user-a",
    tokenId: "token-a",
    replay: createLiveReplayRecord(1),
  });
  appendFightPvpReplay({
    userId: "user-a",
    tokenId: "token-a",
    replay: createLiveReplayRecord(2),
  });
  appendFightPvpReplay({
    userId: "user-a",
    tokenId: "token-a",
    replay: {
      ...createLiveReplayRecord(1),
      createdAt: new Date(Date.UTC(2026, 3, 15, 13, 0, 0)).toISOString(),
    },
  });

  const records = loadFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
  });

  assert.equal(records.length, 2);
  assert.equal(records[0].battleId, "battle-1");
  assert.equal(records[1].battleId, "battle-2");
  assert.equal(records[0].sourceType, "persisted-battle-input-snapshot");
  assert.equal(records[0].battleInputSource, "persisted-battle-input-snapshot");
  assert.equal(records[0].exactBattleInputData, null);
  assert.equal(records[0].battleInputData, null);
  assert.ok(records[0].battleInputSnapshot);
  assert.equal(records[0].mapIdSource, "runtime.ROLE.pvpMapId");
  assert.equal(records[0].mapIdResolveReason, null);

  const stored = JSON.parse(globalThis.localStorage.getItem(
    buildFightPvpReplayStorageKey({ userId: "user-a", tokenId: "token-a" }),
  ));
  assert.equal(stored[0].battleInputData, undefined);
  assert.ok(stored[0].battleInputSnapshot);
  assert.equal(stored[0].mapIdSource, "runtime.ROLE.pvpMapId");
});

test("fight pvp replay storage trims old records and supports remove and clear", () => {
  for (let index = 0; index < MAX_FIGHT_PVP_REPLAYS + 5; index += 1) {
    appendFightPvpReplay({
      userId: "user-a",
      tokenId: "token-a",
      replay: createLiveReplayRecord(index),
    });
  }

  let records = loadFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
  });
  assert.equal(records.length, MAX_FIGHT_PVP_REPLAYS);
  assert.equal(records[0].battleId, `battle-${MAX_FIGHT_PVP_REPLAYS + 4}`);

  records = removeFightPvpReplay({
    userId: "user-a",
    tokenId: "token-a",
    replayId: "fight-pvp-live:battle-10",
  });
  assert.equal(records.some((item) => item.battleId === "battle-10"), false);

  records = clearFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
  });
  assert.deepEqual(records, []);
  assert.deepEqual(
    loadFightPvpReplays({ userId: "user-a", tokenId: "token-a" }),
    [],
  );
});

test("fight pvp replay storage migrates legacy v1 payload into v2 snapshot records", () => {
  const legacyKey = "fight_pvp_replays_v1:user-a:token-a";
  globalThis.localStorage.setItem(legacyKey, JSON.stringify([
    createLegacyReplayPayload(11),
  ]));

  const records = loadFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].isPlayable, true);
  assert.equal(records[0].sourceType, "persisted-battle-input-snapshot");
  assert.ok(records[0].battleInputSnapshot);
  assert.equal(records[0].mapIdSource, "replay.mapId");

  const storedV2 = JSON.parse(globalThis.localStorage.getItem(
    buildFightPvpReplayStorageKey({ userId: "user-a", tokenId: "token-a" }),
  ));
  assert.equal(storedV2.length, 1);
  assert.ok(storedV2[0].battleInputSnapshot);
  assert.equal(storedV2[0].sourceType, "persisted-battle-input-snapshot");
  assert.equal(storedV2[0].mapIdSource, "replay.mapId");
});

test("fight pvp replay storage keeps incomplete legacy records and marks them unavailable", () => {
  const legacyKey = "fight_pvp_replays_v1:user-a:token-a";
  globalThis.localStorage.setItem(legacyKey, JSON.stringify([
    createLegacyReplayPayload(12, {
      battleData: {
        id: "battle-12",
        version: 1,
        leftTeam: {},
        rightTeam: {},
      },
      battleResult: null,
      mapId: null,
      pvpMapId: null,
      mapIdSource: null,
      pvpMapIdSource: null,
      selfRoleSnapshot: {
        roleId: "role-left",
        pvpMapId: null,
      },
      context: {
        pvpMapId: null,
      },
      meta: {},
    }),
  ]));

  const records = loadFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].isPlayable, false);
  assert.match(records[0].disabledReason, /缺少字段|旧回放数据结构不完整/);
  assert.equal(
    globalThis.localStorage.getItem(
      buildFightPvpReplayStorageKey({ userId: "user-a", tokenId: "token-a" }),
    ),
    null,
  );
  assert.ok(globalThis.localStorage.getItem(legacyKey));
});

test("fight pvp replay storage defaults missing live mapId to 40001 on current records", () => {
  const failingRecord = {
    ...createLiveReplayRecord(20),
    exactBattleInputData: null,
    mapId: null,
    pvpMapId: null,
    mapIdSource: null,
    pvpMapIdSource: null,
    battleInputData: buildFightPvpBattleInputData({
      battleData: {
        id: "battle-20",
        version: 1,
        mode: 7,
        leftTeam: {
          roleId: "role-left",
          name: "我方",
          team: { 0: { heroId: 1001 } },
        },
        rightTeam: {
          roleId: "role-right",
          name: "敌方",
          team: { 0: { heroId: 2001 } },
        },
        result: {
          isWin: true,
        },
      },
      battleResult: {
        isWin: true,
      },
      mapId: null,
      stageNameStr: "切磋系统",
      startTipTopName: "切磋系统",
      startTipStage: "开始切磋",
      options: new Map([
        ["targetRole", { roleId: "role-right", name: "敌方" }],
      ]),
    }),
    mapIdResolveReason: "battle-input-mapId-not-written",
    dressPvpMapUsedId: null,
    selfRoleContextSource: "window.ROLE",
    runtimeRoleAvailable: true,
    runtimeRolePath: "runtime.ROLE",
    battleInputAvailable: true,
    disabledReason: "",
    isPlayable: true,
  };

  const records = appendFightPvpReplay({
    userId: "user-a",
    tokenId: "token-a",
    replay: failingRecord,
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].mapId, 40001);
  assert.equal(records[0].mapIdSource, "fallback.defaultMapId.40001");
  assert.equal(records[0].isPlayable, true);

  const stored = JSON.parse(globalThis.localStorage.getItem(
    buildFightPvpReplayStorageKey({ userId: "user-a", tokenId: "token-a" }),
  ));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].mapId, 40001);
  assert.equal(stored[0].mapIdSource, "fallback.defaultMapId.40001");
});
