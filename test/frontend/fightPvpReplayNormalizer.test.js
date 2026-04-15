import assert from "node:assert/strict";
import test from "node:test";

import {
  FIGHT_PVP_REPLAY_SOURCE,
  normalizeFightPvpReplayPayload,
} from "../../src/services/replay/fightPvpReplayNormalizer.js";

test("fight pvp replay normalizer keeps core replay fields stable", () => {
  const replay = normalizeFightPvpReplayPayload({
    tokenId: "token-1",
    targetId: "role-2",
    targetName: "对手",
    createdAt: "2026-04-15T12:00:00.000Z",
    battleData: {
      id: "battle-1",
      version: 77,
      leftTeam: {
        roleId: "role-1",
        name: "我方",
        headImg: "/left.png",
        power: 123456,
      },
      rightTeam: {
        roleId: "role-2",
        name: "对手",
        headImg: "/right.png",
        power: 654321,
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
  assert.equal(replay.left.name, "我方");
  assert.equal(replay.right.roleId, "role-2");
  assert.equal(replay.battleResult?.isWin, true);
});

test("fight pvp replay normalizer builds a stable fallback battle id for legacy battle data", () => {
  const baseInput = {
    tokenId: "token-legacy",
    targetId: "enemy-legacy",
    createdAt: "2026-04-15T12:00:00.000Z",
    battleData: {
      version: 12,
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
  };

  const left = normalizeFightPvpReplayPayload(baseInput);
  const right = normalizeFightPvpReplayPayload(baseInput);

  assert.match(left.battleId, /^fight-pvp-/);
  assert.equal(left.battleId, right.battleId);
  assert.equal(left.replayId, right.replayId);
});

test("fight pvp replay normalizer tolerates missing and old fields", () => {
  const replay = normalizeFightPvpReplayPayload({
    tokenId: "token-old",
    targetId: "old-enemy",
    battleData: {
      leftTeam: {},
      rightTeam: {},
    },
    leftContext: {
      roleId: "self-old",
      name: "旧我方",
      headImg: "/self-old.png",
      power: 1,
    },
    rightContext: {
      roleId: "old-enemy",
      name: "旧敌方",
      headImg: "/enemy-old.png",
      power: 2,
    },
  });

  assert.equal(replay.left.name, "旧我方");
  assert.equal(replay.right.name, "旧敌方");
  assert.equal(replay.battleVersion, null);
  assert.equal(replay.battleResult, null);
});
