import assert from "node:assert/strict";
import test from "node:test";
import {
  buildLineupHeroEquipmentView,
  buildLineupHeroStatsView,
  buildLineupHeroView,
  buildSavedLineupMetaView,
} from "../../src/components/cards/lineup/lineupViewModels.js";

test("lineup view models keep saved-lineup meta semantics stable", () => {
  assert.deepEqual(
    buildSavedLineupMetaView(
      {
        heroes: [
          {
            equipment: {
              1: {
                quenches: {
                  1: { colorId: 6 },
                  2: { colorId: 5 },
                },
              },
            },
            fishId: 2001,
            heroId: 1001,
          },
        ],
        id: "lineup-1",
        legionResearch: { 1: 10 },
        name: "主力一队",
        savedAt: 1700000000000,
        teamId: 2,
        weaponId: 100,
      },
      {
        formatTime: () => "2026-04-15 12:00",
        getWeaponLabel: () => "南瓜锤",
      },
    ),
    {
      equipmentPartCount: 1,
      hasEquipmentSnapshot: true,
      hasFishData: true,
      hasTechData: true,
      hasWeaponData: true,
      heroes: [
        {
          equipment: {
            1: {
              quenches: {
                1: { colorId: 6 },
                2: { colorId: 5 },
              },
            },
          },
          fishId: 2001,
          heroId: 1001,
        },
      ],
      heroCount: 1,
      id: "lineup-1",
      lineup: {
        heroes: [
          {
            equipment: {
              1: {
                quenches: {
                  1: { colorId: 6 },
                  2: { colorId: 5 },
                },
              },
            },
            fishId: 2001,
            heroId: 1001,
          },
        ],
        id: "lineup-1",
        legionResearch: { 1: 10 },
        name: "主力一队",
        savedAt: 1700000000000,
        teamId: 2,
        weaponId: 100,
      },
      name: "主力一队",
      savedAtText: "2026-04-15 12:00",
      teamId: 2,
      weaponLabel: "南瓜锤",
    },
  );
});

test("lineup view models keep hero stats and equipment fallback stable", () => {
  const hero = {
    artifactId: 9001,
    attack: 4500,
    equipment: {
      1: {
        quenches: {
          1: { colorId: 6 },
          2: { colorId: 5 },
        },
      },
    },
    fishId: 2001,
    heroId: 1001,
    hp: 90000,
    level: 320,
    power: 123456,
    skillId: 5001,
    slotMap: [{ colorId: 5 }],
    speed: 12,
  };

  assert.deepEqual(
    buildLineupHeroStatsView(hero, {
      formatLevel: (value) => value,
      formatPower: (value) => String(value),
      getHeroAvatar: () => "/hero.png",
      getHeroName: () => "吕布",
    }),
    {
      avatar: "/hero.png",
      avatarText: "吕",
      levelText: "Lv.320",
      name: "吕布",
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

  assert.deepEqual(
    buildLineupHeroEquipmentView(hero, {
      getFishNameById: () => "霸王",
      getPearlSkillNameById: () => "破甲",
      getSlotColors: () => ["#ff9900"],
    }),
    {
      artifactIdText: "Artifact#9001",
      equipmentPartCount: 1,
      equipmentParts: [{ partId: 1, redCount: 1, slotCount: 2 }],
      equipmentSummaryTitle: "部位1: 2孔 / 1红",
      fishCaption: "霸王 破甲",
      hasEquipmentSnapshot: true,
      slotColors: ["#ff9900"],
    },
  );
});

test("lineup view models keep merged hero view stable", () => {
  assert.deepEqual(
    buildLineupHeroView(
      {
        heroId: 1002,
        level: 1,
      },
      {
        formatLevel: (value) => value,
        formatPower: (value) => String(value),
        getFishNameById: () => "",
        getHeroAvatar: () => "",
        getHeroName: () => "",
        getPearlSkillNameById: () => "",
        getSlotColors: () => [],
      },
    ),
    {
      artifactIdText: "",
      avatar: "",
      avatarText: "武",
      equipmentPartCount: 0,
      equipmentParts: [],
      equipmentSummaryTitle: "",
      fishCaption: "",
      hasEquipmentSnapshot: false,
      levelText: "Lv.1",
      name: "武将1002",
      slotColors: [],
      stats: {
        primary: [],
        secondary: [],
      },
    },
  );
});
