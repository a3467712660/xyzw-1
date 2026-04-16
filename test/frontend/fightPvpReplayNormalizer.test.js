import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFightPvpBattleInputData,
  createFightPvpBattleInputSnapshot,
  createFightPvpReplaySafeBattleEnd,
  getFightPvpBattleInputMissingFields,
  rehydrateFightPvpBattleInputSnapshot,
} from "../../src/services/replay/fightPvpBattleInputSnapshot.js";
import {
  createFightPvpReplayRecordFromBattleInput,
} from "../../src/services/replay/fightPvpReplayNormalizer.js";
import {
  resolveFightPvpMapIdFromLiveContext,
} from "../../src/services/replay/fightPvpLiveMapIdResolver.js";

test.afterEach(() => {
  delete globalThis.PVPMapConf;
  delete globalThis.__require;
});

test("fight pvp battle input builder keeps original game shape and Map options", () => {
  const battleData = {
    id: "battle-1",
    version: 77,
    mode: 7,
    leftTeam: {
      roleId: "role-1",
      name: "我方",
      team: {
        0: { heroId: 1001, battleTeamSlot: 0 },
        1: { heroId: 1002, battleTeamSlot: 1 },
      },
    },
    rightTeam: {
      roleId: "role-2",
      name: "对手",
      team: {
        0: { heroId: 2001, battleTeamSlot: 0 },
      },
    },
    result: {
      isWin: true,
      round: 5,
    },
  };
  const battleResult = {
    isWin: true,
    round: 5,
  };
  const options = new Map([
    ["targetRole", { roleId: "role-2", name: "对手" }],
    ["selfScore", 12],
    ["oppoScore", 8],
  ]);

  const battleInputData = buildFightPvpBattleInputData({
    battleData,
    battleResult,
    mapId: 110001,
    stageNameStr: "切磋系统",
    startTipTopName: "切磋系统",
    startTipStage: "开始切磋",
    options,
    battleEnd: createFightPvpReplaySafeBattleEnd(),
  }, {
    mutate: true,
  });

  assert.equal(battleInputData.battleData, battleData);
  assert.equal(battleInputData.battleResult, battleResult);
  assert.equal(battleInputData.mapId, 110001);
  assert.equal(battleInputData.stageNameStr, "切磋系统");
  assert.equal(battleInputData.startTipTopName, "切磋系统");
  assert.equal(battleInputData.startTipStage, "开始切磋");
  assert.equal(battleInputData.options, options);
  assert.deepEqual(
    battleInputData.battleData.leftTeam.team,
    battleData.leftTeam.team,
  );
});

test("fight pvp battle input snapshot keeps mapId, mode, and Map semantics", () => {
  const battleInputData = buildFightPvpBattleInputData({
    battleData: {
      id: "battle-2",
      version: 88,
      mode: 32,
      leftTeam: {
        roleId: "role-1",
        name: "我方",
        team: {
          0: { heroId: 1001 },
        },
      },
      rightTeam: {
        roleId: "role-2",
        name: "对手",
        team: {
          0: { heroId: 2001 },
        },
      },
      result: {
        isWin: false,
      },
    },
    battleResult: {
      isWin: false,
    },
    mapId: 120001,
    stageNameStr: "切磋系统",
    startTipTopName: "切磋系统",
    startTipStage: "开始切磋",
    options: new Map([
      ["targetRole", { roleId: "role-2", name: "对手" }],
      ["selfScore", 20],
      ["oppoScore", 18],
    ]),
  });

  const snapshot = createFightPvpBattleInputSnapshot(battleInputData);
  const rehydrated = rehydrateFightPvpBattleInputSnapshot(snapshot);

  assert.equal(snapshot.mapId, 120001);
  assert.equal(snapshot.battleVersion, 88);
  assert.equal(snapshot.battleData.mode, 32);
  assert.ok(Array.isArray(snapshot.optionsEntries));
  assert.equal(rehydrated.mapId, 120001);
  assert.equal(rehydrated.battleData.mode, 32);
  assert.ok(rehydrated.options instanceof Map);
  assert.equal(rehydrated.options.get("selfScore"), 20);
  assert.equal(rehydrated.options.get("oppoScore"), 18);
  assert.equal(typeof rehydrated.battleEnd, "function");
  assert.deepEqual(getFightPvpBattleInputMissingFields(rehydrated), []);
});

test("fight pvp replay record creation keeps live map resolution and builds snapshot-backed record", () => {
  const selfRoleRaw = {
    role: {
      roleId: "role-1",
      pvpMapId: 130001,
    },
  };
  const mapResolution = resolveFightPvpMapIdFromLiveContext({
    selfRoleRaw,
  });
  const battleInputData = buildFightPvpBattleInputData({
    battleData: {
      id: "battle-3",
      version: 99,
      mode: 7,
      leftTeam: {
        roleId: "role-1",
        name: "我方",
        headImg: "/left.png",
        power: 123,
        team: { 0: { heroId: 1001 } },
      },
      rightTeam: {
        roleId: "role-2",
        name: "对手",
        headImg: "/right.png",
        power: 456,
        team: { 0: { heroId: 2001 } },
      },
      result: {
        isWin: true,
        round: 6,
      },
    },
    battleResult: {
      isWin: true,
      round: 6,
    },
    mapId: mapResolution.mapId,
    stageNameStr: "切磋系统",
    startTipTopName: "切磋系统",
    startTipStage: "开始切磋",
    options: new Map([
      ["targetRole", { roleId: "role-2", name: "对手" }],
      ["selfScore", 15],
      ["oppoScore", 9],
    ]),
  });

  const record = createFightPvpReplayRecordFromBattleInput({
    battleInputData,
    tokenId: "token-1",
    targetId: "role-2",
    targetName: "对手",
    selfRoleRaw,
    roleInfo: {
      role: {
        roleId: "role-1",
      },
    },
    mapResolution,
  });

  assert.equal(record.replayId, "fight-pvp-live:battle-3");
  assert.equal(record.battleId, "battle-3");
  assert.equal(record.battleVersion, 99);
  assert.equal(record.mapId, 130001);
  assert.equal(record.pvpMapId, 130001);
  assert.equal(record.mapIdSource, "selfRole.role.pvpMapId");
  assert.equal(record.pvpMapIdSource, "selfRole.role.pvpMapId");
  assert.equal(record.mapIdResolveReason, null);
  assert.equal(record.dressPvpMapUsedId, null);
  assert.equal(record.selfRoleContextSource, "selfRoleRaw");
  assert.equal(record.isPlayable, true);
  assert.ok(record.battleInputSnapshot);
  assert.equal(record.battleInputSnapshot.mapId, 130001);
  assert.equal(record.battleInputSnapshot.battleData.mode, 7);
  assert.equal(record.battleInputSummary.sourceType, "battle-input-data");
  assert.deepEqual(record.missingRuntimeFields, []);
});

test("fight pvp replay record keeps live mapId failure metadata for unplayable live capture", () => {
  const battleInputData = buildFightPvpBattleInputData({
    battleData: {
      id: "battle-4",
      version: 100,
      mode: 7,
      leftTeam: {
        roleId: "role-1",
        name: "我方",
        team: { 0: { heroId: 1001 } },
      },
      rightTeam: {
        roleId: "role-2",
        name: "对手",
        team: { 0: { heroId: 2001 } },
      },
      result: {
        isWin: false,
      },
    },
    battleResult: {
      isWin: false,
    },
    mapId: null,
    stageNameStr: "切磋系统",
    startTipTopName: "切磋系统",
    startTipStage: "开始切磋",
    options: new Map([
      ["targetRole", { roleId: "role-2", name: "对手" }],
    ]),
  });

  const record = createFightPvpReplayRecordFromBattleInput({
    battleInputData,
    tokenId: "token-1",
    targetId: "role-2",
    targetName: "对手",
    mapIdResolveReason: "missing-pvp-map-conf",
    dressPvpMapUsedId: 7001,
    selfRoleContextSource: "refreshed-role_getroleinfo",
    disabledReason: "当前自身角色拿到了 PVP 外观 used 值，但运行时里没有可用的 PVPMapConf 配置。",
  });

  assert.equal(record.isPlayable, false);
  assert.equal(record.mapId, null);
  assert.equal(record.battleInputSnapshot.mapId, null);
  assert.equal(record.mapIdResolveReason, "missing-pvp-map-conf");
  assert.equal(record.dressPvpMapUsedId, 7001);
  assert.equal(record.selfRoleContextSource, "refreshed-role_getroleinfo");
  assert.match(record.disabledReason, /PVPMapConf/);
});
