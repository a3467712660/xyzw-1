import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFightPvpReplayBattleInput,
} from "../../src/services/replay/fightPvpBattleInputAdapter.js";
import {
  FIGHT_PVP_REPLAY_SOURCE,
  normalizeFightPvpReplayPayload,
} from "../../src/services/replay/fightPvpReplayNormalizer.js";

test("fight pvp replay normalizer keeps runtime fields stable", () => {
  const replay = normalizeFightPvpReplayPayload({
    tokenId: "token-1",
    targetId: "role-2",
    targetName: "对手",
    createdAt: "2026-04-15T12:00:00.000Z",
    mapId: 110001,
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
    leftContext: {
      roleId: "self-1",
      name: "我方",
      pvpMapId: 120001,
    },
  };

  const left = normalizeFightPvpReplayPayload(baseInput);
  const right = normalizeFightPvpReplayPayload(baseInput);

  assert.match(left.battleId, /^fight-pvp-/);
  assert.equal(left.battleId, right.battleId);
  assert.equal(left.replayId, right.replayId);
  assert.equal(left.mapId, 120001);
});

test("fight pvp replay adapter converts replay record into runtime-ready battle input", () => {
  const replay = normalizeFightPvpReplayPayload({
    tokenId: "token-1",
    targetId: "role-2",
    targetName: "对手",
    mapId: 110001,
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
  assert.match(result.message, /该历史回放缺少必要字段/);
});
