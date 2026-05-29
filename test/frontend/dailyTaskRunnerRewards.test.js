import test from "node:test";
import assert from "node:assert/strict";

import { DailyTaskRunner } from "../../src/utils/dailyTaskRunner.js";

function createRunnerWithResponses(responsesByCommand = {}) {
  const calls = [];
  const tokenStore = {
    gameTokens: [{ id: "token-1", name: "测试账号" }],
    sendMessageWithPromise: async (tokenId, cmd, params = {}, timeout) => {
      calls.push({ tokenId, cmd, params, timeout });
      const response = responsesByCommand[cmd];
      return typeof response === "function" ? response({ tokenId, cmd, params, timeout, calls }) : response;
    },
  };
  const runner = new DailyTaskRunner(tokenStore, { commandDelay: 0, taskDelay: 0 });
  runner.callbacks = { onLog: () => {} };
  return { runner, calls };
}

test("DailyTaskRunner dynamically claims all claimable daily special discount rewards", async () => {
  const { runner, calls } = createRunnerWithResponses({
    discount_getdiscountinfo: {
      discountList: [
        { discountId: 1, discountState: 2 },
        { discountId: 3, discountState: 1 },
        { discountId: 7, state: 1 },
      ],
    },
    discount_claimreward: { reward: [] },
  });

  await runner.claimDailySpecialRewards("token-1");

  assert.deepEqual(
    calls.map(({ cmd, params }) => [cmd, params]),
    [
      ["discount_getdiscountinfo", {}],
      ["discount_claimreward", { discountId: 3 }],
      ["discount_claimreward", { discountId: 7 }],
    ],
  );
});

test("DailyTaskRunner dynamically claims all configured free card rewards once", async () => {
  const { runner, calls } = createRunnerWithResponses({
    card_claimreward: { reward: [] },
  });

  await runner.claimCardRewards("token-1");

  assert.deepEqual(
    calls
      .filter(({ cmd }) => cmd === "card_claimreward")
      .map(({ params }) => params),
    [
      { cardId: 1 },
      { cardId: 4003 },
      { cardId: 4004 },
      { cardId: 4005 },
    ],
  );
});
