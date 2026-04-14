import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLineupHeroFishCaption,
  buildLineupHeroStatGroups,
  getLineupDisplayAvatarText,
  getLineupWeaponLabel,
  resolveLineupDisplayHeroName,
} from "../../src/components/cards/lineup/lineupDisplayHelpers.js";

test("lineup display helpers keep hero fallback and avatar text stable", () => {
  assert.equal(resolveLineupDisplayHeroName(1001, () => "吕布"), "吕布");
  assert.equal(resolveLineupDisplayHeroName(1002, () => ""), "武将1002");
  assert.equal(getLineupDisplayAvatarText("吕布", 1), "吕");
  assert.equal(getLineupDisplayAvatarText("吕布", 2), "吕布");
  assert.equal(getLineupDisplayAvatarText("", 2), "?");
});

test("lineup display helpers keep fish caption and weapon label stable", () => {
  assert.equal(
    buildLineupHeroFishCaption(
      { fishId: 2001, skillId: 501 },
      {
        getFishNameById: () => "霸王",
        getPearlSkillNameById: () => "破甲",
      },
    ),
    "霸王 破甲",
  );
  assert.equal(getLineupWeaponLabel(100, { 100: "南瓜锤" }), "南瓜锤");
  assert.equal(getLineupWeaponLabel(101, {}), "101");
  assert.equal(getLineupWeaponLabel(null, {}), "");
});

test("lineup display helpers keep hero stat grouping stable", () => {
  const groups = buildLineupHeroStatGroups(
    { power: 12345, speed: 8, attack: 4567, hp: 987654 },
    (value) => String(value),
  );

  assert.deepEqual(groups.primary, [
    { className: "stat-power", text: "战力12345" },
    { className: "stat-speed", text: "速度8" },
  ]);
  assert.deepEqual(groups.secondary, [
    { className: "stat-attack", text: "攻击4567" },
    { className: "stat-hp", text: "血量987654" },
  ]);
});
