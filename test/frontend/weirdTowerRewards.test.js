import assert from "node:assert/strict";
import test from "node:test";

import {
  claimWeirdTowerChapterReward,
  didWeirdTowerFightWin,
  resolveWeirdTowerPendingRewardChapter,
  resolveWeirdTowerChapterReward,
} from "../../src/utils/weirdTowerRewards.js";

test("weird tower chapter reward resolves from pre-fight floor 10 clears", () => {
  assert.deepEqual(
    resolveWeirdTowerChapterReward({
      fightResult: { winList: [true] },
      preFightTowerId: 9,
    }),
    {
      chapter: 1,
      shouldClaim: true,
    },
  );

  assert.deepEqual(
    resolveWeirdTowerChapterReward({
      fightResult: { winList: [true] },
      preFightTowerId: 19,
    }),
    {
      chapter: 2,
      shouldClaim: true,
    },
  );
});

test("weird tower chapter reward ignores non-final-floor or failed fights", () => {
  assert.deepEqual(
    resolveWeirdTowerChapterReward({
      fightResult: { winList: [true] },
      preFightTowerId: 8,
    }),
    {
      chapter: null,
      shouldClaim: false,
    },
  );

  assert.deepEqual(
    resolveWeirdTowerChapterReward({
      fightResult: { winList: [false] },
      preFightTowerId: 9,
    }),
    {
      chapter: null,
      shouldClaim: false,
    },
  );
});

test("weird tower pending reward chapter follows rewardTowerId instead of towerId change", () => {
  assert.equal(
    resolveWeirdTowerPendingRewardChapter({
      rewardTowerId: 28,
      towerId: 290,
    }),
    29,
  );

  assert.equal(
    resolveWeirdTowerPendingRewardChapter({
      rewardTowerId: 29,
      towerId: 290,
    }),
    null,
  );

  assert.equal(
    resolveWeirdTowerPendingRewardChapter({
      rewardTowerId: 29,
      towerId: 300,
    }),
    30,
  );
});

test("weird tower chapter claim retries 12200020 until rewardTowerId catches up", async () => {
  const towerStates = [
    { evoTower: { towerId: 290, rewardTowerId: 28 } },
    { evoTower: { towerId: 290, rewardTowerId: 28 } },
    { evoTower: { towerId: 290, rewardTowerId: 28 } },
  ];
  let towerInfoCalls = 0;
  let claimCalls = 0;
  const waits = [];

  const chapter = await claimWeirdTowerChapterReward({
    chapter: 29,
    getTowerInfo: async () => {
      const index = Math.min(towerInfoCalls, towerStates.length - 1);
      towerInfoCalls++;
      return towerStates[index];
    },
    claimReward: async () => {
      claimCalls++;
      if (claimCalls === 1) {
        throw new Error("服务器错误: 12200020 - 未知错误");
      }
      return { evoTower: { towerId: 290, rewardTowerId: 29 } };
    },
    wait: async (ms) => {
      waits.push(ms);
    },
    maxAttempts: 4,
  });

  assert.equal(chapter, 29);
  assert.equal(claimCalls, 2);
  assert.deepEqual(waits, [150]);
});

test("weird tower chapter claim skips duplicate claim when reward already caught up", async () => {
  let claimCalls = 0;

  const chapter = await claimWeirdTowerChapterReward({
    chapter: 29,
    getTowerInfo: async () => ({ evoTower: { towerId: 290, rewardTowerId: 29 } }),
    claimReward: async () => {
      claimCalls++;
      return { evoTower: { towerId: 290, rewardTowerId: 29 } };
    },
    wait: async () => {},
  });

  assert.equal(chapter, 29);
  assert.equal(claimCalls, 0);
});

test("weird tower win detection accepts multiple response shapes", () => {
  assert.equal(
    didWeirdTowerFightWin({ winList: [true] }),
    true,
  );
  assert.equal(
    didWeirdTowerFightWin({ battleData: { result: { isWin: true } } }),
    true,
  );
  assert.equal(
    didWeirdTowerFightWin({ result: { isWin: true } }),
    true,
  );
  assert.equal(
    didWeirdTowerFightWin({ battleData: { result: { accept: { ext: { curHP: 0 } } } } }),
    true,
  );
  assert.equal(
    didWeirdTowerFightWin({ battleData: { result: { accept: { ext: { curHP: 10 } } } } }),
    false,
  );
});
