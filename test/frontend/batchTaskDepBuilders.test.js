import test from "node:test";
import assert from "node:assert/strict";

import {
  createCombatBatchTaskDeps,
  createDailyBatchTaskDeps,
  createResourceBatchTaskDeps,
  createSharedBatchTaskDeps,
} from "../../src/composables/batchTaskDepBuilders.js";

function createBaseParams() {
  return {
    addLog: () => {},
    autoScrollLog: { value: true },
    batchSettings: {
      commandDelay: 1,
      taskDelay: 2,
      actionDelay: 3,
      battleDelay: 4,
      refreshDelay: 5,
      longDelay: 6,
    },
    calculateMonthProgress: () => 50,
    canClaim: () => true,
    connectionQueue: { active: 1 },
    currentRunningTokenId: { value: "token-1" },
    currentSettings: { arenaFormation: 2 },
    ensureConnection: async () => {},
    getTodayStartSec: () => 123,
    giftQuantity: { value: 10 },
    gradeLabel: () => "S",
    helperSettings: { count: 100 },
    isRunning: { value: false },
    isTodayAvailable: () => true,
    loadSettings: () => ({ test: true }),
    logContainer: { value: null },
    logs: { value: [] },
    message: { success: () => {} },
    nextTick: async () => {},
    normalizeCars: () => [],
    pickArenaTargetId: () => "target-1",
    recipientIdInput: { value: "1001" },
    recipientInfo: { value: { roleId: 1001 } },
    releaseConnectionSlot: () => {},
    securityPassword: { value: "safe" },
    selectedTokens: { value: ["token-1"] },
    shouldSendCar: () => true,
    shouldStop: { value: false },
    tokenStatus: { value: {} },
    tokenStore: { gameTokens: [] },
    tokens: { value: [{ id: "token-1" }] },
  };
}

test("shared batch task deps centralize common runtime fields and delay config", () => {
  const params = createBaseParams();
  const sharedDeps = createSharedBatchTaskDeps(params);

  assert.equal(sharedDeps.batchSettings, params.batchSettings);
  assert.equal(sharedDeps.currentRunningTokenId, params.currentRunningTokenId);
  assert.equal(sharedDeps.tokenStore, params.tokenStore);
  assert.deepEqual(sharedDeps.delayConfig, {
    command: 1,
    task: 2,
    action: 3,
    battle: 4,
    refresh: 5,
    long: 6,
  });
});

test("domain batch task deps only extend the shared deps with domain-specific fields", () => {
  const params = createBaseParams();
  const sharedDeps = createSharedBatchTaskDeps(params);
  const dailyDeps = createDailyBatchTaskDeps(sharedDeps, params);
  const combatDeps = createCombatBatchTaskDeps(sharedDeps, params);
  const resourceDeps = createResourceBatchTaskDeps(sharedDeps, params);

  assert.equal(dailyDeps.helperSettings, params.helperSettings);
  assert.ok(!("recipientInfo" in dailyDeps));

  assert.equal(combatDeps.currentSettings, params.currentSettings);
  assert.equal(combatDeps.pickArenaTargetId, params.pickArenaTargetId);
  assert.ok(!("recipientInfo" in combatDeps));

  assert.equal(resourceDeps.recipientInfo, params.recipientInfo);
  assert.equal(resourceDeps.securityPassword, params.securityPassword);
  assert.ok(!("currentSettings" in resourceDeps));
});
