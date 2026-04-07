/* eslint-disable test/no-import-node-test */
import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

const loadModule = jiti(import.meta.url, { interopDefault: true });
const { handleGameMessageById } = loadModule("../../src/services/token/tokenMessageService.ts");

const createBaseDeps = () => {
  const warnCalls = [];
  const skippedCalls = [];
  return {
    deps: {
      tokenId: "token-1",
      client: {},
      wsConnections: { value: {} },
      gameTokens: { value: [] },
      gameData: { value: {} },
      updateToken: () => false,
      syncRandomSeedFromStatistics: () => {},
      onMessageSkipped: (...args) => skippedCalls.push(args),
      attemptTokenRefresh: async () => false,
      emitGameEvent: () => {},
      logger: {
        warn: (...args) => warnCalls.push(args),
        error: () => {},
        debug: () => {},
      },
    },
    warnCalls,
    skippedCalls,
  };
};

test("repeated skipped game warnings with the same token, cmd, and message are throttled", async () => {
  const { deps, warnCalls, skippedCalls } = createBaseDeps();
  const repeatedMessage = {
    error: "不在开启时间内",
    cmd: "towers_getinfo",
  };

  await handleGameMessageById({
    ...deps,
    message: repeatedMessage,
  });
  await handleGameMessageById({
    ...deps,
    message: repeatedMessage,
  });

  assert.equal(warnCalls.length, 1);
  assert.equal(skippedCalls.length, 1);
  assert.match(String(warnCalls[0][0] || ""), /\[towers_getinfo\]/);
});
