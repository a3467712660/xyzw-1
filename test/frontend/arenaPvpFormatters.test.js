import assert from "node:assert/strict";
import test from "node:test";
import {
  formatArenaRankLabel,
  formatArenaScoreDelta,
  getArenaAvatarFallbackText,
  getArenaLineupClass,
  getArenaRankBadgeClass,
  getArenaRankRowClass,
  getArenaRecordTypeLabelText,
  getArenaScoreDeltaClass,
} from "../../src/components/cards/pvp/arenaPvpFormatters.js";

test("arena pvp formatters keep rank and record text semantics stable", () => {
  assert.equal(formatArenaRankLabel(3, "-"), "#3");
  assert.equal(formatArenaRankLabel(null, "-"), "-");
  assert.equal(
    getArenaRecordTypeLabelText("进攻", { attack: "攻", defense: "守", unknown: "?" }),
    "攻",
  );
  assert.equal(
    getArenaRecordTypeLabelText("防守", { attack: "攻", defense: "守", unknown: "?" }),
    "守",
  );
});

test("arena pvp formatters keep badge and lineup classes stable", () => {
  assert.equal(getArenaRankBadgeClass(1), "top1");
  assert.equal(getArenaRankRowClass(2), "row-top2");
  assert.equal(getArenaLineupClass("吕赵", "未知"), "red");
  assert.equal(getArenaLineupClass("典韦队", "未知"), "blue");
  assert.equal(getArenaLineupClass("未识别阵容", "未知"), "gray");
});

test("arena pvp score delta helpers keep display semantics stable", () => {
  assert.equal(formatArenaScoreDelta(5, "-"), "+5");
  assert.equal(formatArenaScoreDelta(-3, "-"), "-3");
  assert.equal(formatArenaScoreDelta("oops", "-"), "-");
  assert.equal(getArenaScoreDeltaClass(5), "positive");
  assert.equal(getArenaScoreDeltaClass(-3), "negative");
  assert.equal(getArenaScoreDeltaClass(0), "neutral");
  assert.equal(getArenaAvatarFallbackText("张飞"), "张");
});
