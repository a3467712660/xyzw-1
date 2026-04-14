import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLineupHeroCardView,
  buildLineupHeroFishCaption,
  buildLineupHeroStatGroups,
  buildSavedLineupActionState,
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

test("lineup display helpers keep saved-lineup action state stable", () => {
  assert.deepEqual(
    buildSavedLineupActionState(
      { applying: true, legionResearch: { 1: 10 }, teamId: 2 },
      2,
    ),
    {
      canApply: true,
      hasTech: true,
      isApplying: true,
    },
  );
  assert.deepEqual(buildSavedLineupActionState({ teamId: 1 }, 2), {
    canApply: false,
    hasTech: false,
    isApplying: false,
  });
});

test("lineup display helpers keep hero card view stable", () => {
  assert.deepEqual(
    buildLineupHeroCardView(
      {
        attack: 4500,
        fishId: 2001,
        heroId: 1001,
        hp: 90000,
        level: 320,
        power: 123456,
        skillId: 5001,
        slotMap: [{ colorId: 5 }],
        speed: 12,
      },
      {
        formatLevel: (value) => value,
        formatPower: (value) => String(value),
        getFishNameById: () => "霸王",
        getHeroAvatar: () => "/hero.png",
        getHeroName: () => "吕布",
        getPearlSkillNameById: () => "破甲",
        getSlotColors: () => ["#ff9900"],
      },
    ),
    {
      avatar: "/hero.png",
      avatarText: "吕",
      fishCaption: "霸王 破甲",
      levelText: "Lv.320",
      name: "吕布",
      slotColors: ["#ff9900"],
      stats: {
        primary: [
          { className: "stat-power", text: "战力123456" },
          { className: "stat-speed", text: "速度12" },
        ],
        secondary: [
          { className: "stat-attack", text: "攻击4500" },
          { className: "stat-hp", text: "血量90000" },
        ],
      },
    },
  );
});
