import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWarGuessActivityTip,
  getBatchCurrentActivityWeek,
  getBatchFourthSundayOfMonth,
  groupAvailableTasks,
  isBatchArenaActivityOpen,
  isBatchBaokuActivityOpen,
  isBatchCarActivityOpen,
  isBatchMengjingActivityOpen,
  isBatchWarGuessActivityOpen,
  isBatchWeirdTowerActivityOpen,
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

test("batch daily task formatters keep activity window helpers stable", () => {
  assert.equal(isBatchCarActivityOpen(new Date("2026-04-13T06:30:00")), true);
  assert.equal(isBatchCarActivityOpen(new Date("2026-04-12T06:30:00")), false);
  assert.equal(isBatchMengjingActivityOpen(new Date("2026-04-13T10:00:00")), true);
  assert.equal(isBatchMengjingActivityOpen(new Date("2026-04-14T10:00:00")), false);
  assert.equal(isBatchBaokuActivityOpen(new Date("2026-04-15T10:00:00")), true);
  assert.equal(isBatchBaokuActivityOpen(new Date("2026-04-13T10:00:00")), false);
  assert.equal(isBatchArenaActivityOpen(new Date("2026-04-15T21:59:00")), true);
  assert.equal(isBatchArenaActivityOpen(new Date("2026-04-15T22:00:00")), false);
});

test("batch daily task formatters keep weekly and war guess calendar helpers stable", () => {
  assert.equal(
    getBatchCurrentActivityWeek(new Date("2025-12-12T12:00:00")),
    "黑市周",
  );
  assert.equal(
    getBatchCurrentActivityWeek(new Date("2025-12-20T12:00:00")),
    "招募周",
  );
  assert.equal(
    getBatchCurrentActivityWeek(new Date("2025-12-28T12:00:00")),
    "宝箱周",
  );

  const marchFourthSunday = getBatchFourthSundayOfMonth(new Date("2026-03-10T00:00:00"));
  assert.equal(marchFourthSunday.toISOString(), new Date("2026-03-29T00:00:00").toISOString());

  assert.equal(
    isBatchWeirdTowerActivityOpen(new Date("2025-12-13T11:00:00"), "黑市周"),
    true,
  );
  assert.equal(
    isBatchWeirdTowerActivityOpen(new Date("2025-12-19T11:00:00"), "黑市周"),
    false,
  );
  assert.equal(
    isBatchWeirdTowerActivityOpen(new Date("2025-12-20T11:00:00"), "招募周"),
    false,
  );

  assert.equal(
    isBatchWarGuessActivityOpen(
      new Date("2026-03-01T19:55:00"),
      new Date("2026-03-29T00:00:00"),
    ),
    true,
  );
  assert.equal(
    isBatchWarGuessActivityOpen(
      new Date("2026-04-26T19:56:00"),
      new Date("2026-04-26T00:00:00"),
    ),
    false,
  );
});
