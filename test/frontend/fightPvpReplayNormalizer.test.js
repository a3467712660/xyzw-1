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
  delete globalThis.ROLE;
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
  const mapResolution = resolveFightPvpMapIdFromLiveContext({
    runtimeContext: {
      runtimeRoot: {
        ROLE: {
          roleId: "role-1",
          pvpMapId: 40001,
        },
      },
    },
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
    mapIdSource: mapResolution.mapIdSource,
    mapIdResolveReason: mapResolution.mapIdResolveReason,
    runtimeRoleAvailable: mapResolution.runtimeRoleAvailable,
    runtimeRolePath: mapResolution.runtimeRolePath,
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
    selfRoleRaw: {
      role: {
        roleId: "role-1",
      },
    },
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
  assert.equal(record.mapId, 40001);
  assert.equal(record.pvpMapId, 40001);
  assert.equal(record.mapIdSource, "runtime.ROLE.pvpMapId");
  assert.equal(record.pvpMapIdSource, "runtime.ROLE.pvpMapId");
  assert.equal(record.mapIdResolveReason, null);
  assert.equal(record.dressPvpMapUsedId, null);
  assert.equal(record.selfRoleContextSource, "window.ROLE");
  assert.equal(record.runtimeRoleAvailable, true);
  assert.equal(record.runtimeRolePath, "runtime.ROLE");
  assert.equal(record.runtimeRoleMapId, 40001);
  assert.equal(record.battleInputAvailable, false);
  assert.equal(record.isPlayable, true);
  assert.ok(record.exactBattleInputData);
  assert.ok(record.battleInputSnapshot);
  assert.equal(record.exactBattleInputData.mapId, 40001);
  assert.equal(record.exactBattleInputData.mapIdSource, "runtime.ROLE.pvpMapId");
  assert.equal(record.battleInputSnapshot.mapId, 40001);
  assert.equal(record.battleInputSnapshot.mapIdSource, "runtime.ROLE.pvpMapId");
  assert.equal(record.battleInputSnapshot.runtimeRoleAvailable, true);
  assert.equal(record.battleInputSnapshot.runtimeRolePath, "runtime.ROLE");
  assert.equal(record.battleInputSnapshot.battleData.mode, 7);
  assert.equal(record.sourceType, "live-memory-battle-input");
  assert.equal(record.battleInputSource, "live-memory-battle-input");
  assert.equal(record.battleInputSummary.sourceType, "live-memory-battle-input");
  assert.equal(record.battleInputSummary.battleInputSource, "live-memory-battle-input");
  assert.equal(record.battleInputSummary.mapId, 40001);
  assert.equal(record.battleInputSummary.mapIdSource, "runtime.ROLE.pvpMapId");
  assert.equal(record.battleInputSummary.runtimeRoleAvailable, true);
  assert.equal(record.battleInputSummary.runtimeRolePath, "runtime.ROLE");
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
    mapIdResolveReason: "runtime-role-unavailable",
    selfRoleContextSource: "window.ROLE",
    runtimeRoleAvailable: false,
    runtimeRolePath: "runtime.ROLE",
    battleInputAvailable: false,
    disabledReason: "当前 live capture 无法直接读取运行时 self role，因而拿不到 ROLE.pvpMapId。",
  });

  assert.equal(record.isPlayable, false);
  assert.equal(record.mapId, null);
  assert.equal(record.battleInputSnapshot.mapId, null);
  assert.equal(record.mapIdResolveReason, "runtime-role-unavailable");
  assert.equal(record.dressPvpMapUsedId, null);
  assert.equal(record.selfRoleContextSource, "window.ROLE");
  assert.equal(record.runtimeRoleAvailable, false);
  assert.equal(record.runtimeRolePath, "runtime.ROLE");
  assert.equal(record.battleInputAvailable, false);
  assert.equal(record.battleInputSnapshot.mapIdResolveReason, "runtime-role-unavailable");
  assert.equal(record.battleInputSnapshot.runtimeRolePath, "runtime.ROLE");
  assert.match(record.disabledReason, /ROLE\.pvpMapId/);
});
