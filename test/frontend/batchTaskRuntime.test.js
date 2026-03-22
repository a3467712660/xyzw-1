import test from "node:test";
import assert from "node:assert/strict";

import { useBatchTaskRuntime } from "../../src/composables/useBatchTaskRuntime.js";

function createRuntimeParams() {
  return {
    DailyTaskRunner: class {},
    addLog: () => {},
    autoScrollLog: { value: true },
    availableTasks: [{ value: "batchFish", label: "批量钓鱼" }],
    batchSettings: {},
    calculateMonthProgress: () => 0,
    canClaim: () => true,
    connectionQueue: { active: 0 },
    currentRunningTokenId: { value: null },
    currentSettings: { arenaFormation: 1 },
    ensureConnection: async () => {},
    getTodayStartSec: () => 0,
    giftQuantity: { value: 10 },
    gradeLabel: () => "A",
    helperSettings: { count: 10 },
    isCarActivityOpen: { value: true },
    isRunning: { value: false },
    isTodayAvailable: () => true,
    isWeirdTowerActivityOpen: { value: true },
    isarenaActivityOpen: { value: true },
    isbaokuActivityOpen: { value: true },
    ismengjingActivityOpen: { value: true },
    loadSettings: () => ({}),
    logContainer: { value: null },
    logs: { value: [] },
    message: {},
    nextTick: async () => {},
    normalizeCars: () => [],
    pickArenaTargetId: () => "target-1",
    recipientIdInput: { value: "" },
    recipientInfo: { value: null },
    releaseConnectionSlot: () => {},
    securityPassword: { value: "" },
    selectedTokens: { value: [] },
    shouldSendCar: () => false,
    shouldStop: { value: false },
    tokenStatus: {},
    tokenStore: {},
    tokens: { value: [] },
  };
}

test("useBatchTaskRuntime wires scheduled handlers before exposing quick-task execution", async () => {
  const calls = [];
  const fakeTaskDeps = { daily: { scope: "daily" } };
  const fakeTaskModules = {
    batchFish: async () => "fish",
    batchArenaStandalone: async () => "arena-standalone",
    batcharenafight: async () => "arena",
    legion_storebuygoods: async () => "store",
  };
  const fakeStartBatch = async () => "started";
  const fakeStopBatch = () => "stopped";
  let capturedTaskHandlers = null;

  const runtime = useBatchTaskRuntime(
    createRuntimeParams(),
    {
      createBatchTaskDeps: (params) => {
        calls.push(["deps", params.helperSettings]);
        return fakeTaskDeps;
      },
      useBatchTaskModules: (deps) => {
        calls.push(["modules", deps]);
        return fakeTaskModules;
      },
      useBatchExecutionRunner: () => {
        calls.push(["runner"]);
        return { startBatch: fakeStartBatch, stopBatch: fakeStopBatch };
      },
      useBatchTaskHandlers: ({ startBatch, batchFish }) => {
        calls.push(["handlers", startBatch, batchFish]);
        return {
          taskHandlers: {
            startBatch,
            batchFish,
          },
        };
      },
      useScheduledTaskExecutor: ({ taskHandlers }) => {
        capturedTaskHandlers = taskHandlers;
        return {
          executeScheduledTask: async () => taskHandlers.batchFish(),
        };
      },
      useQuickTaskExecutor: ({ taskHandlers }) => {
        calls.push(["quick", taskHandlers]);
        return {
          executeQuickTask: async (taskName) => taskHandlers[taskName](),
          forwardQuickTaskLog: () => {},
          getSelectedTokenIds: () => [],
          setSelectedTokenIds: () => [],
        };
      },
    },
  );

  assert.equal(capturedTaskHandlers, runtime.taskHandlers);
  assert.equal(runtime.startBatch, fakeStartBatch);
  assert.equal(runtime.stopBatch, fakeStopBatch);
  assert.equal(await runtime.executeScheduledTask(), "fish");
  assert.equal(await runtime.executeQuickTask("batchFish"), "fish");

  assert.deepEqual(
    calls.map((entry) => entry[0]),
    ["deps", "modules", "runner", "handlers", "quick"],
  );
});
