import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_FIGHT_PVP_REPLAYS,
  appendFightPvpReplay,
  buildFightPvpReplayStorageKey,
  clearFightPvpReplays,
  loadFightPvpReplays,
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
  delete globalThis.localStorage;
});

test("fight pvp replay storage isolates records by user and token", () => {
  assert.equal(
    buildFightPvpReplayStorageKey({ userId: "user-1", tokenId: "token-1" }),
    "fight_pvp_replays_v1:user-1:token-1",
  );
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
