import assert from "node:assert/strict";
import test from "node:test";
import {
  formatLineupFishCaption,
  formatLineupPower,
  getLineupHeroDisplayName,
} from "../../src/components/cards/lineup/lineupFormatters.js";

test("lineup formatters keep power display semantics stable", () => {
  assert.equal(formatLineupPower(0), "0");
  assert.equal(formatLineupPower(12345), "1.23万");
  assert.equal(formatLineupPower(200000000), "2.00亿");
});

test("lineup hero and fish captions keep fallback semantics stable", () => {
  assert.equal(getLineupHeroDisplayName("吕布", 1001), "吕布");
  assert.equal(getLineupHeroDisplayName("", 1001), "武将1001");
  assert.equal(getLineupHeroDisplayName(null, null), "未知武将");

  assert.equal(formatLineupFishCaption("霸王", ""), "霸王");
  assert.equal(formatLineupFishCaption("霸王", "破甲"), "霸王 破甲");
  assert.equal(formatLineupFishCaption("", "破甲"), "");
});
