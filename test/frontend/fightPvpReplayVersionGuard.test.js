import assert from "node:assert/strict";
import test from "node:test";

import {
  FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS,
  guardFightPvpReplayVersion,
} from "../../src/services/replay/fightPvpReplayVersionGuard.js";

const createReplay = (battleVersion = 11) => ({
  battleVersion,
  battleData: {
    version: battleVersion,
  },
  tokenId: "token-1",
});

test("fight pvp replay version guard accepts matching versions from store cache", async () => {
  const result = await guardFightPvpReplayVersion({
    replay: createReplay(11),
    selectedToken: { id: "token-1" },
    tokenStore: {
      getBattleVersion: () => 11,
      ensureBattleVersion: async () => {
        throw new Error("should not be called");
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.reason, FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.OK);
});

test("fight pvp replay version guard falls back to ensureBattleVersion when cache is empty", async () => {
  const result = await guardFightPvpReplayVersion({
    replay: createReplay(12),
    selectedToken: { id: "token-1" },
    tokenStore: {
      getBattleVersion: () => null,
      ensureBattleVersion: async (tokenId) => {
        assert.equal(tokenId, "token-1");
        return 12;
      },
    },
  });

  assert.equal(result.ok, true);
  assert.equal(result.currentBattleVersion, 12);
});

test("fight pvp replay version guard blocks mismatched versions with a clear reason", async () => {
  const result = await guardFightPvpReplayVersion({
    replay: createReplay(12),
    selectedToken: { id: "token-1" },
    tokenStore: {
      getBattleVersion: () => 13,
      ensureBattleVersion: async () => 13,
    },
  });

  assert.equal(result.ok, false);
  assert.equal(
    result.reason,
    FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.VERSION_MISMATCH,
  );
  assert.match(result.message, /13/);
  assert.match(result.message, /12/);
});

test("fight pvp replay version guard handles missing replay and missing token", async () => {
  const emptyReplay = await guardFightPvpReplayVersion({
    replay: null,
    tokenStore: {},
  });
  assert.equal(emptyReplay.ok, false);
  assert.equal(
    emptyReplay.reason,
    FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.EMPTY_REPLAY,
  );

  const missingToken = await guardFightPvpReplayVersion({
    replay: createReplay(12),
    tokenStore: {
      getBattleVersion: () => null,
      ensureBattleVersion: async () => null,
    },
  });
  assert.equal(missingToken.ok, false);
  assert.equal(
    missingToken.reason,
    FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.MISSING_SELECTED_TOKEN,
  );
});
