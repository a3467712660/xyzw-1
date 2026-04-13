import assert from "node:assert/strict";
import test from "node:test";
import {
  formatClubRankPower,
  formatClubRankScore,
  getClubRankAllianceClass,
  getClubRankLineupTagColor,
  getClubRankRedQuenchClass,
} from "../../src/components/Club/rank/clubRankFormatters.js";

test("club rank formatters keep power, score, and class semantics stable", () => {
  assert.equal(formatClubRankPower(0), "0");
  assert.equal(formatClubRankPower(12345), "1.23万");
  assert.equal(formatClubRankPower(300000000), "3.00亿");
  assert.equal(formatClubRankScore(9876.54), "9877");
  assert.equal(getClubRankAllianceClass("龙盟"), "alliance-dragon");
  assert.equal(getClubRankAllianceClass("未知值"), "alliance-other");
  assert.equal(getClubRankRedQuenchClass(61), "redquench-high");
  assert.equal(getClubRankRedQuenchClass(50), "redquench-medium");
  assert.equal(getClubRankRedQuenchClass(49), "redquench-low");
});

test("club rank lineup tag formatter falls back to neutral color props", () => {
  const lineupRules = [
    {
      name: "吕布队",
      colorProps: {
        color: "#111",
        textColor: "#fff",
      },
    },
  ];

  assert.deepEqual(getClubRankLineupTagColor("吕布队", lineupRules), {
    color: "#111",
    textColor: "#fff",
  });
  assert.deepEqual(getClubRankLineupTagColor("未知阵容", lineupRules), {
    color: "#595959",
    textColor: "#fff",
  });
});
