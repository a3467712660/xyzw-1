import test from "node:test";
import assert from "node:assert/strict";

import { createBatchTaskModulesFromRegistry } from "../../src/composables/batchTaskModuleRegistry.js";

test("loads only the matched task group and caches it per group", async () => {
  const loaderCalls = [];
  const groups = [
    {
      key: "daily",
      creatorNames: ["createDailyTasks"],
      handlerNames: ["dailyTask"],
      loader: async () => {
        loaderCalls.push("daily");
        return {
          createDailyTasks: () => ({
            dailyTask: async (value) => `daily:${value}`,
          }),
        };
      },
    },
    {
      key: "combat",
      creatorNames: ["createCombatTasks"],
      handlerNames: ["combatTask"],
      loader: async () => {
        loaderCalls.push("combat");
        return {
          createCombatTasks: () => ({
            combatTask: async (value) => `combat:${value}`,
          }),
        };
      },
    },
  ];

  const modules = createBatchTaskModulesFromRegistry({}, groups);

  assert.equal(await modules.dailyTask("one"), "daily:one");
  assert.deepEqual(loaderCalls, ["daily"]);

  assert.equal(await modules.dailyTask("two"), "daily:two");
  assert.deepEqual(loaderCalls, ["daily"]);

  assert.equal(await modules.combatTask("three"), "combat:three");
  assert.deepEqual(loaderCalls, ["daily", "combat"]);
});

test("falls back to scanning other groups when handler map is incomplete", async () => {
  const groups = [
    {
      key: "daily",
      creatorNames: ["createDailyTasks"],
      handlerNames: [],
      loader: async () => ({
        createDailyTasks: () => ({
          recoveredTask: async () => "recovered",
        }),
      }),
    },
  ];

  const modules = createBatchTaskModulesFromRegistry({}, groups);

  assert.equal(await modules.recoveredTask(), "recovered");
});

test("throws a clear error for unknown handlers", async () => {
  const modules = createBatchTaskModulesFromRegistry({}, []);

  await assert.rejects(
    () => modules.missingTask(),
    /未找到批量任务处理器: missingTask/,
  );
});
