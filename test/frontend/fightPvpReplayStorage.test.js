import assert from "node:assert/strict";
import test from "node:test";

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

const createReplay = (index) => ({
  replayId: `fight-pvp-live:battle-${index}`,
  battleId: `battle-${index}`,
  battleVersion: 1,
  tokenId: "token-a",
  source: "fight-pvp-live",
  targetId: "target-a",
  targetName: "目标",
  createdAt: new Date(Date.UTC(2026, 3, 15, 12, 0, index)).toISOString(),
  battleData: {
    id: `battle-${index}`,
    version: 1,
    leftTeam: {
      roleId: "role-left",
      name: "我方",
    },
    rightTeam: {
      roleId: "role-right",
      name: "敌方",
    },
    result: {
      isWin: index % 2 === 0,
    },
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

test("fight pvp replay storage isolates records by user and token", () => {
  assert.equal(
    buildFightPvpReplayStorageKey({ userId: "user-1", tokenId: "token-1" }),
    "fight_pvp_replays_v1:user-1:token-1",
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
  assert.match(String(tokenStore.gameData.lastUpdated || ""), /T/);
});

test("fight pvp replay storage falls back to cached liveContext when quick refresh fails", async () => {
  const cachedRoleInfo = {
    role: {
      roleId: "role-left",
      pvpMapId: 120010,
    },
  };
  const tokenStore = {
    gameData: {
      roleInfo: cachedRoleInfo,
      lastUpdated: null,
    },
    getWebSocketStatus() {
      return "connected";
    },
    async sendMessageWithPromise() {
      throw new Error("refresh failed");
    },
  };

  const liveContext = await refreshFightPvpReplayLiveContext({
    tokenStore,
    tokenId: "token-a",
  });

  assert.deepEqual(liveContext, {
    tokenStoreRoleInfo: cachedRoleInfo,
  });
  assert.equal(tokenStore.gameData.roleInfo, cachedRoleInfo);
});

test("fight pvp replay storage appends, dedupes, and keeps newest records first", () => {
  appendFightPvpReplay({
    userId: "user-a",
    tokenId: "token-a",
    replay: createReplay(1),
  });
  appendFightPvpReplay({
    userId: "user-a",
    tokenId: "token-a",
    replay: createReplay(2),
  });
  appendFightPvpReplay({
    userId: "user-a",
    tokenId: "token-a",
    replay: {
      ...createReplay(1),
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
});

test("fight pvp replay storage trims old records and supports remove and clear", () => {
  for (let index = 0; index < MAX_FIGHT_PVP_REPLAYS + 5; index += 1) {
    appendFightPvpReplay({
      userId: "user-a",
      tokenId: "token-a",
      replay: createReplay(index),
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

test("fight pvp replay storage backfills missing mapId once and rewrites the record", () => {
  const storageKey = buildFightPvpReplayStorageKey({
    userId: "user-a",
    tokenId: "token-a",
  });
  globalThis.localStorage.setItem(storageKey, JSON.stringify([
    {
      ...createReplay(11),
      mapId: null,
      pvpMapId: null,
      mapIdSource: null,
      pvpMapIdSource: null,
      selfRoleSnapshot: {
        roleId: "role-left",
        pvpMapId: 140001,
      },
      context: {
        pvpMapId: null,
      },
      meta: {},
      backfilledAt: null,
    },
  ]));

  const records = loadFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].mapId, 140001);
  assert.equal(records[0].pvpMapId, 140001);
  assert.equal(records[0].mapIdSource, "replay.selfRoleSnapshot.pvpMapId");
  assert.ok(records[0].backfilledAt);

  const stored = JSON.parse(globalThis.localStorage.getItem(storageKey));
  assert.equal(stored[0].mapId, 140001);
  assert.equal(stored[0].mapIdSource, "replay.selfRoleSnapshot.pvpMapId");
  assert.ok(stored[0].backfilledAt);
  assert.equal(stored[0].selfRoleSnapshot.dress, null);
  assert.equal(stored[0].context.dress, null);
});

test("fight pvp replay storage uses provided liveContext while appending missing-map replays", () => {
  const records = appendFightPvpReplay({
    userId: "user-a",
    tokenId: "token-a",
    replay: {
      ...createReplay(15),
      mapId: null,
      pvpMapId: null,
      mapIdSource: null,
      pvpMapIdSource: null,
      selfRoleSnapshot: {
        roleId: "role-left",
        pvpMapId: null,
        dressPvpMapUsedId: null,
        dressPvpMapMapId: null,
        dress: null,
      },
      context: {
        pvpMapId: null,
        dressPvpMapUsedId: null,
        dressPvpMapMapId: null,
        dress: null,
      },
      meta: {},
      backfilledAt: null,
    },
    liveContext: {
      tokenStoreRoleInfo: {
        role: {
          pvpMapId: 120009,
        },
      },
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].mapId, 120009);
  assert.equal(records[0].mapIdSource, "tokenStore.gameData.roleInfo.role.pvpMapId");
});

test("fight pvp replay storage rewrites leaked dress used ids without inventing a fallback mapId", () => {
  const storageKey = buildFightPvpReplayStorageKey({
    userId: "user-a",
    tokenId: "token-a",
  });
  globalThis.localStorage.setItem(storageKey, JSON.stringify([
    {
      ...createReplay(13),
      mapId: null,
      pvpMapId: 7001,
      mapIdSource: null,
      pvpMapIdSource: "replay.pvpMapId",
      selfRoleSnapshot: {
        roleId: "role-left",
        pvpMapId: 7001,
        dressPvpMapUsedId: 7001,
        dressPvpMapMapId: null,
      },
      context: {
        pvpMapId: 7001,
        dressPvpMapUsedId: 7001,
        dressPvpMapMapId: null,
      },
      meta: {},
      backfilledAt: null,
    },
  ]));

  const records = loadFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].mapId, null);
  assert.equal(records[0].pvpMapId, null);
  assert.equal(records[0].pvpMapIdSource, null);
  assert.deepEqual(records[0].selfRoleSnapshot, {
    roleId: "role-left",
    pvpMapId: null,
    dressPvpMapUsedId: 7001,
    dressPvpMapMapId: null,
    dress: {
      pvpMap: {
        used: 7001,
      },
    },
  });
  assert.deepEqual(records[0].context, {
    pvpMapId: null,
    dressPvpMapUsedId: 7001,
    dressPvpMapMapId: null,
    dress: {
      pvpMap: {
        used: 7001,
      },
    },
  });
  assert.equal(records[0].backfilledAt, null);

  const stored = JSON.parse(globalThis.localStorage.getItem(storageKey));
  assert.equal(stored[0].mapId, null);
  assert.equal(stored[0].pvpMapId, null);
  assert.equal(stored[0].pvpMapIdSource, null);
  assert.equal(stored[0].selfRoleSnapshot.pvpMapId, null);
  assert.equal(stored[0].context.pvpMapId, null);
  assert.equal(stored[0].selfRoleSnapshot.dressPvpMapUsedId, 7001);
  assert.equal(stored[0].context.dressPvpMapUsedId, 7001);
  assert.deepEqual(stored[0].selfRoleSnapshot.dress, {
    pvpMap: {
      used: 7001,
    },
  });
  assert.deepEqual(stored[0].context.dress, {
    pvpMap: {
      used: 7001,
    },
  });
  assert.equal(stored[0].backfilledAt, null);
});

test("fight pvp replay storage backfills missing mapId from persisted dress used id and rewrites the record", () => {
  globalThis.__require = (moduleName) => {
    if (moduleName === "../../../../../launcher/config/Configs") {
      return {
        PVPMapConf: {
          getById(id) {
            return id === 7001 ? { mapId: 120005 } : null;
          },
        },
      };
    }
    throw new Error(`Cannot find module '${moduleName}'`);
  };

  const storageKey = buildFightPvpReplayStorageKey({
    userId: "user-a",
    tokenId: "token-a",
  });
  globalThis.localStorage.setItem(storageKey, JSON.stringify([
    {
      ...createReplay(14),
      mapId: null,
      pvpMapId: null,
      mapIdSource: null,
      pvpMapIdSource: null,
      selfRoleSnapshot: {
        roleId: "role-left",
        pvpMapId: null,
        dressPvpMapUsedId: 7001,
        dressPvpMapMapId: null,
      },
      context: {
        pvpMapId: null,
        dressPvpMapUsedId: 7001,
        dressPvpMapMapId: null,
      },
      meta: {},
      backfilledAt: null,
    },
  ]));

  const records = loadFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].mapId, 120005);
  assert.equal(records[0].pvpMapId, 120005);
  assert.equal(
    records[0].mapIdSource,
    "replay.selfRoleSnapshot.persistedDressPVPMapConf.mapId",
  );
  assert.ok(records[0].backfilledAt);
  assert.equal(records[0].selfRoleSnapshot.pvpMapId, 120005);
  assert.equal(records[0].selfRoleSnapshot.dressPvpMapUsedId, 7001);
  assert.equal(records[0].selfRoleSnapshot.dressPvpMapMapId, 120005);
  assert.deepEqual(records[0].selfRoleSnapshot.dress, {
    pvpMap: {
      used: 7001,
    },
  });
  assert.equal(records[0].context.pvpMapId, 120005);
  assert.equal(records[0].context.dressPvpMapUsedId, 7001);
  assert.equal(records[0].context.dressPvpMapMapId, 120005);
  assert.deepEqual(records[0].context.dress, {
    pvpMap: {
      used: 7001,
    },
  });

  const stored = JSON.parse(globalThis.localStorage.getItem(storageKey));
  assert.equal(stored[0].mapId, 120005);
  assert.equal(
    stored[0].mapIdSource,
    "replay.selfRoleSnapshot.persistedDressPVPMapConf.mapId",
  );
  assert.ok(stored[0].backfilledAt);
});

test("fight pvp replay storage uses provided liveContext while loading missing-map replays", () => {
  const storageKey = buildFightPvpReplayStorageKey({
    userId: "user-a",
    tokenId: "token-a",
  });
  globalThis.localStorage.setItem(storageKey, JSON.stringify([
    {
      ...createReplay(16),
      mapId: null,
      pvpMapId: null,
      mapIdSource: null,
      pvpMapIdSource: null,
      selfRoleSnapshot: {
        roleId: "role-left",
        pvpMapId: null,
      },
      context: {},
      meta: {},
      backfilledAt: null,
    },
  ]));

  const records = loadFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
    liveContext: {
      tokenStoreRoleInfo: {
        role: {
          pvpMapId: 120010,
        },
      },
    },
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].mapId, 120010);
  assert.equal(records[0].mapIdSource, "tokenStore.gameData.roleInfo.role.pvpMapId");
});

test("fight pvp replay storage leaves unreadable missing-map records untouched", () => {
  const storageKey = buildFightPvpReplayStorageKey({
    userId: "user-a",
    tokenId: "token-a",
  });
  globalThis.localStorage.setItem(storageKey, JSON.stringify([
    {
      ...createReplay(12),
      mapId: null,
      pvpMapId: null,
      mapIdSource: null,
      pvpMapIdSource: null,
      selfRoleSnapshot: {
        roleId: "role-left",
      },
      context: {},
      meta: {},
      backfilledAt: null,
    },
  ]));

  const records = loadFightPvpReplays({
    userId: "user-a",
    tokenId: "token-a",
  });

  assert.equal(records.length, 1);
  assert.equal(records[0].mapId, null);
  assert.equal(records[0].backfilledAt, null);

  const stored = JSON.parse(globalThis.localStorage.getItem(storageKey));
  assert.equal(stored[0].mapId, null);
  assert.equal(stored[0].backfilledAt, null);
});
