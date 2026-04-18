import assert from "node:assert/strict";
import test from "node:test";

import {
  getThreeWeekActivityCycle,
  isWeirdTowerActivityOpen,
} from "../../src/utils/activityWindows.js";

test("activity window helper resolves three-week cycle labels", () => {
  assert.equal(
    getThreeWeekActivityCycle(new Date("2025-12-12T12:00:00")),
    "黑市周",
  );
  assert.equal(
    getThreeWeekActivityCycle(new Date("2025-12-20T12:00:00")),
    "招募周",
  );
  assert.equal(
    getThreeWeekActivityCycle(new Date("2025-12-28T12:00:00")),
    "宝箱周",
  );
});

test("activity window helper enforces weird tower Friday noon gate", () => {
  assert.equal(
    isWeirdTowerActivityOpen(new Date("2025-12-19T11:00:00"), "黑市周"),
    false,
  );
  assert.equal(
    isWeirdTowerActivityOpen(new Date("2025-12-19T12:00:00"), "黑市周"),
    true,
  );
  assert.equal(
    isWeirdTowerActivityOpen(new Date("2025-12-20T10:00:00"), "黑市周"),
    true,
  );
  assert.equal(
    isWeirdTowerActivityOpen(new Date("2025-12-20T10:00:00"), "招募周"),
    false,
  );
  assert.equal(
    isWeirdTowerActivityOpen(new Date("2025-12-28T10:00:00"), "宝箱周"),
    false,
  );
});
