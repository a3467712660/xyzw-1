import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWarGuessActivityTip,
  groupAvailableTasks,
  TASK_GROUP_DEFINITIONS,
} from "../../src/views/batch-daily-tasks/batchDailyTaskFormatters.js";

test("batch daily task formatters keep task group ordering and grouping stable", () => {
  assert.deepEqual(
    TASK_GROUP_DEFINITIONS.map((group) => group.name),
    ["daily", "dungeon", "baoku", "weirdTower", "resource", "legacy", "monthly"],
  );

  const grouped = groupAvailableTasks([
    { label: "日常开始", value: "startBatch" },
    { label: "月度充值鱼", value: "batchTopUpFish" },
    { label: "未知任务", value: "unknownTask" },
  ]);

  assert.deepEqual(grouped.daily, [{ label: "日常开始", value: "startBatch" }]);
  assert.deepEqual(grouped.monthly, [
    { label: "月度充值鱼", value: "batchTopUpFish" },
  ]);
  assert.deepEqual(grouped.other, [{ label: "未知任务", value: "unknownTask" }]);
});

test("batch daily task formatters keep war guess tip semantics stable", () => {
  assert.equal(buildWarGuessActivityTip({ isOpen: true }), "");
  assert.equal(
    buildWarGuessActivityTip({
      isOpen: false,
      openDate: new Date(2026, 3, 26),
    }),
    "月赛助威仅在每月第四个周日 (4月26日) 00:00-19:55 开放",
  );
  assert.equal(
    buildWarGuessActivityTip({
      activeWeeks: ["第四个周日"],
      isOpen: false,
    }),
    "月赛助威仅在 第四个周日 开放",
  );
});
