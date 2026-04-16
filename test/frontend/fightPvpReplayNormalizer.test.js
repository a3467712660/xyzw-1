import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFightPvpReplayBattleInput,
} from "../../src/services/replay/fightPvpBattleInputAdapter.js";
import {
  resolveFightPvpMapIdFromLiveContext,
} from "../../src/services/replay/fightPvpReplayMapIdResolver.js";
import {
  FIGHT_PVP_REPLAY_SOURCE,
  normalizeFightPvpReplayPayload,
} from "../../src/services/replay/fightPvpReplayNormalizer.js";

test.afterEach(() => {
  delete globalThis.PVPMapConf;
  delete globalThis.__require;
});

test("fight pvp replay normalizer keeps runtime fields stable and persists map diagnostics", () => {
  const selfRoleRaw = {
    role: {
      roleId: "role-1",
      pvpMapId: 110001,
    },
  };
  const mapResolution = resolveFightPvpMapIdFromLiveContext({
    selfRoleRaw,
  });
  const replay = normalizeFightPvpReplayPayload({
    tokenId: "token-1",
    targetId: "role-2",
    targetName: "对手",
    createdAt: "2026-04-15T12:00:00.000Z",
    selfRoleRaw,
    roleInfo: {
      role: {
        roleId: "role-1",
      },
    },
    mapResolution,
    runtimeLabels: {
      stageNameStr: "切磋系统",
      startTipTopName: "切磋系统",
      startTipStage: "开始切磋",
    },
    runtimeOptionsSnapshot: {
      targetRole: {
        roleId: "role-2",
        name: "对手",
      },
      selfScore: 12,
      oppoScore: 8,
      replayFlag: true,
    },
    battleData: {
      id: "battle-1",
      version: 77,
      mode: 7,
      leftTeam: {
        roleId: "role-1",
        name: "我方",
        headImg: "/left.png",
        power: 123456,
        team: [{ heroId: 1001 }],
      },
      rightTeam: {
        roleId: "role-2",
        name: "对手",
        headImg: "/right.png",
        power: 654321,
        team: [{ heroId: 2001 }],
      },
      result: {
        isWin: true,
        round: 5,
      },
    },
  });

  assert.equal(replay.source, FIGHT_PVP_REPLAY_SOURCE);
  assert.equal(replay.replayId, `${FIGHT_PVP_REPLAY_SOURCE}:battle-1`);
  assert.equal(replay.battleId, "battle-1");
  assert.equal(replay.battleVersion, 77);
  assert.equal(replay.targetId, "role-2");
  assert.equal(replay.targetName, "对手");
  assert.equal(replay.mapId, 110001);
  assert.equal(replay.pvpMapId, 110001);
  assert.equal(replay.mapIdSource, "selfRoleRaw.role.pvpMapId");
  assert.equal(replay.pvpMapIdSource, "selfRoleRaw.role.pvpMapId");
  assert.deepEqual(replay.selfRoleSnapshot, {
    roleId: "role-1",
    pvpMapId: 110001,
    dressPvpMapUsedId: null,
    dressPvpMapMapId: null,
  });
  assert.deepEqual(replay.context, {
    pvpMapId: 110001,
    dressPvpMapUsedId: null,
    dressPvpMapMapId: null,
  });
  assert.equal(replay.meta.mapIdDiagnostics.availableValues["selfRoleRaw.role.pvpMapId"], 110001);
  assert.equal(replay.stageNameStr, "切磋系统");
  assert.equal(replay.startTipTopName, "切磋系统");
  assert.equal(replay.startTipStage, "开始切磋");
  assert.equal(replay.runtimeOptionsSnapshot.selfScore, 12);
  assert.equal(replay.runtimeOptionsSnapshot.oppoScore, 8);
  assert.equal(replay.battleResult?.isWin, true);
});

test("fight pvp replay normalizer builds a stable fallback battle id for legacy battle data", () => {
  const baseInput = {
    tokenId: "token-legacy",
    targetId: "enemy-legacy",
    createdAt: "2026-04-15T12:00:00.000Z",
    battleData: {
      version: 12,
      mode: 7,
      leftTeam: {
        roleId: "self-1",
        name: "我方",
        team: {
          0: { heroId: 1001 },
          1: { heroId: 1002 },
        },
      },
      rightTeam: {
        roleId: "enemy-legacy",
        name: "敌方",
        team: {
          0: { heroId: 2001 },
          1: { heroId: 2002 },
        },
      },
      result: {
        isWin: false,
        round: 9,
        totalFrame: 120,
      },
    },
    roleInfo: {
      role: {
        roleId: "self-1",
        pvpMapId: 120001,
      },
    },
  };

  const left = normalizeFightPvpReplayPayload(baseInput);
  const right = normalizeFightPvpReplayPayload(baseInput);

  assert.match(left.battleId, /^fight-pvp-/);
  assert.equal(left.battleId, right.battleId);
  assert.equal(left.replayId, right.replayId);
  assert.equal(left.mapId, 120001);
  assert.equal(left.mapIdSource, "tokenStore.gameData.roleInfo.role.pvpMapId");
});

test("fight pvp replay normalizer preserves dress used id without polluting pvpMapId when config is unavailable", () => {
  const replay = normalizeFightPvpReplayPayload({
    tokenId: "token-dress-missing",
    battleData: {
      id: "battle-dress-missing",
      version: 1,
      mode: 7,
      leftTeam: {},
      rightTeam: {},
      result: {
        isWin: true,
      },
    },
    selfRoleRaw: {
      role: {
        roleId: "role-1",
        dress: new Map([[6, { used: 7001 }]]),
      },
    },
    roleInfo: {
      role: {
        roleId: "role-1",
      },
    },
  });

  assert.equal(replay.mapId, null);
  assert.equal(replay.pvpMapId, null);
  assert.equal(replay.mapIdSource, null);
  assert.equal(replay.pvpMapIdSource, null);
  assert.deepEqual(replay.selfRoleSnapshot, {
    roleId: "role-1",
    pvpMapId: null,
    dressPvpMapUsedId: 7001,
    dressPvpMapMapId: null,
  });
  assert.deepEqual(replay.context, {
    pvpMapId: null,
    dressPvpMapUsedId: 7001,
    dressPvpMapMapId: null,
  });
  assert.equal(
    replay.meta.mapIdDiagnostics.availableValues["selfRoleRaw.role.dress.configLookup"],
    "dress-config-unavailable",
  );
});

test("fight pvp replay normalizer stores final mapId separately from dress used id after config mapping", () => {
  globalThis.PVPMapConf = {
    getById(id) {
      return id === 7001 ? { mapId: 120005 } : null;
    },
  };

  const replay = normalizeFightPvpReplayPayload({
    tokenId: "token-dress-mapped",
    battleData: {
      id: "battle-dress-mapped",
      version: 1,
      mode: 7,
      leftTeam: {},
      rightTeam: {},
      result: {
        isWin: false,
      },
    },
    selfRoleRaw: {
      role: {
        roleId: "role-1",
        dress: new Map([[6, { used: 7001 }]]),
      },
    },
    roleInfo: {
      role: {
        roleId: "role-1",
      },
    },
  });

  assert.equal(replay.mapId, 120005);
  assert.equal(replay.pvpMapId, 120005);
  assert.equal(replay.mapIdSource, "selfRoleRaw.role.dress.PVPMapConf.mapId");
  assert.equal(replay.pvpMapIdSource, "selfRoleRaw.role.dress.PVPMapConf.mapId");
  assert.deepEqual(replay.selfRoleSnapshot, {
    roleId: "role-1",
    pvpMapId: 120005,
    dressPvpMapUsedId: 7001,
    dressPvpMapMapId: 120005,
  });
  assert.deepEqual(replay.context, {
    pvpMapId: 120005,
    dressPvpMapUsedId: 7001,
    dressPvpMapMapId: 120005,
  });
});

test("fight pvp replay normalizer clears leaked dress used ids from persisted replay pvpMapId fields", () => {
  const replay = normalizeFightPvpReplayPayload({
    source: FIGHT_PVP_REPLAY_SOURCE,
    battleData: {
      id: "battle-leaked-map",
      version: 1,
      mode: 7,
      leftTeam: {},
      rightTeam: {},
      result: {
        isWin: true,
      },
    },
    selfRoleSnapshot: {
      roleId: "role-1",
      pvpMapId: 7001,
      dressPvpMapUsedId: 7001,
    },
    context: {
      pvpMapId: 7001,
      dressPvpMapUsedId: 7001,
    },
  });

  assert.equal(replay.mapId, null);
  assert.equal(replay.pvpMapId, null);
  assert.equal(replay.pvpMapIdSource, null);
  assert.deepEqual(replay.selfRoleSnapshot, {
    roleId: "role-1",
    pvpMapId: null,
    dressPvpMapUsedId: 7001,
    dressPvpMapMapId: null,
  });
  assert.deepEqual(replay.context, {
    pvpMapId: null,
    dressPvpMapUsedId: 7001,
    dressPvpMapMapId: null,
  });
});

test("fight pvp replay adapter converts replay record into runtime-ready battle input", () => {
  const replay = normalizeFightPvpReplayPayload({
    tokenId: "token-1",
    targetId: "role-2",
    targetName: "对手",
    pvpMapId: 110001,
    pvpMapIdSource: "replay.pvpMapId",
    runtimeLabels: {
      stageNameStr: "切磋系统",
      startTipTopName: "切磋系统",
      startTipStage: "开始切磋",
    },
    runtimeOptionsSnapshot: {
      targetRole: {
        roleId: "role-2",
        name: "对手",
      },
      selfScore: 20,
      oppoScore: 18,
      replayFlag: true,
    },
    battleData: {
      id: "battle-2",
      version: 88,
      mode: 7,
      leftTeam: {
        roleId: "role-1",
        name: "我方",
        team: {
          0: { heroId: 1001 },
          1: { heroId: 1002 },
        },
      },
      rightTeam: {
        roleId: "role-2",
        name: "对手",
        team: {
          0: { heroId: 2001 },
          1: { heroId: 2002 },
        },
      },
      result: {
        isWin: false,
      },
    },
  });

  const result = buildFightPvpReplayBattleInput(replay, {
    modules: {
      consts: {
        ModelConst: {
          BATTLE_REPLAY: "BATTLE_REPLAY",
        },
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.battleInput.mapId, 110001);
  assert.equal(result.mapIdResolution.mapIdSource, "replay.pvpMapId");
  assert.equal(result.replayInputSummary.mapIdSource, "replay.pvpMapId");
  assert.equal(result.replayInputSummary.pvpMapIdSource, "replay.pvpMapId");
  assert.equal(result.battleInput.stageNameStr, "切磋系统");
  assert.equal(result.battleInput.startTipStage, "开始切磋");
  assert.equal(Array.isArray(result.battleInput.leftTeam), false);
  assert.deepEqual(
    result.battleInput.battleData.leftTeam.team.map((item) => item.heroId),
    [1001, 1002],
  );
  assert.equal(result.battleInput.options.get("selfScore"), 20);
  assert.equal(result.battleInput.options.get("oppoScore"), 18);
  assert.equal(result.battleInput.options.get("BATTLE_REPLAY"), true);
  assert.equal(result.replayInputSummary.battleMode, 7);
});

test("fight pvp replay adapter reports missing runtime fields for legacy incomplete records", () => {
  const result = buildFightPvpReplayBattleInput({
    battleData: {
      id: "legacy",
      leftTeam: {},
      rightTeam: {},
    },
    battleResult: null,
    stageNameStr: "",
    startTipTopName: "",
    startTipStage: "",
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.missingRuntimeFields, [
    "battleResult",
    "mapId",
    "battleData.mode",
  ]);
  assert.equal(result.mapIdResolution.ok, false);
  assert.match(result.message, /无法确定本场切磋地图/);
  assert.deepEqual(result.resolutionExplanation.availableValues, {});
});
