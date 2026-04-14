import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClubBattleDashboardStatRows,
  buildClubBattleMvpModel,
  buildClubBattleTopRankCards,
  buildPeachBattleDefaultStats,
  buildPeachBattleRankGroups,
} from "../../src/components/Club/records/clubBattleRecordStatsHelpers.js";

test("club battle stats helpers keep dashboard row semantics stable", () => {
  assert.deepEqual(
    buildClubBattleDashboardStatRows({
      avgKills: "3.6",
      totalBuilding: 48,
      totalDeaths: 80,
      totalKills: 120,
      totalKD: "1.50",
      totalMembers: 30,
      totalRevives: 25,
      totalWinRate: "60.0",
    }),
    [
      [
        { label: "总 K/D", value: "1.50" },
        { label: "总胜率", value: "60.0%" },
        { label: "参战人数", value: 30 },
        { label: "总复活丹", value: 25 },
      ],
      [
        { label: "总击杀", value: 120 },
        { label: "总死亡", value: 80 },
        { label: "总攻城", value: 48 },
        { label: "人均击杀", value: "3.6" },
      ],
    ],
  );
});

test("club battle stats helpers keep mvp model stable", () => {
  assert.deepEqual(
    buildClubBattleMvpModel({
      avatar: "avatar-a",
      killCnt: 66,
      name: "成员A",
      occupyCnt: 18,
    }),
    {
      avatar: "avatar-a",
      label: "本周 MVP",
      name: "成员A",
      summary: "击杀 66 · 攻城 18",
    },
  );
  assert.equal(buildClubBattleMvpModel(null), null);
});

test("club battle stats helpers keep top rank card shape stable", () => {
  const cards = buildClubBattleTopRankCards({
    deathRank: [{ avatar: "", deathCnt: 11, key: "d1", name: "成员D" }],
    kdRank: [{ avatar: "a", kd: "3.25", key: "k1", name: "成员K" }],
    killRank: [{ avatar: "", key: "k2", killCnt: 20, name: "成员A" }],
    occupyRank: [{ avatar: "", key: "o1", name: "成员O", occupyCnt: 9 }],
    reviveRank: [{ avatar: "", key: "r1", name: "成员R", reviveCnt: 4 }],
    survivalRank: [{ avatar: "", key: "s1", name: "成员S", survivalCnt: 2 }],
  });

  assert.deepEqual(
    cards.map((card) => [card.key, card.title, card.tone]),
    [
      ["kill", "击杀前三", "red"],
      ["occupy", "攻城前三", "orange"],
      ["kd", "KD 前三", "green"],
      ["death", "死亡前三", "gray"],
      ["revive", "复活丹前三", "purple"],
      ["survival", "生存前三", "blue"],
    ],
  );
  assert.equal(cards[0].items[0].value, 20);
  assert.equal(cards[2].items[0].value, "3.25");
  assert.equal(cards[5].items[0].value, 2);
});

test("peach battle stats helpers keep default stats and paired rank groups stable", () => {
  assert.deepEqual(
    buildPeachBattleDefaultStats({
      totalKD: "2.50",
      totalKills: 88,
      totalRevives: 12,
    }),
    [
      { label: "总击杀", tone: "kills", value: 88 },
      { label: "总复活", tone: "revives", value: 12 },
      { label: "总K/D", tone: "kd", value: "2.50" },
    ],
  );

  const rankGroups = buildPeachBattleRankGroups({
    opponentClub: {
      kdRank: [{ kd: "2.20", roleInfo: { name: "敌方B" } }],
      killRank: [{ killCnt: 12, roleInfo: { headImg: "head-b", name: "敌方A" } }],
      reviveRank: [{ reviveCnt: 6, roleInfo: { name: "敌方C" } }],
    },
    ownClub: {
      kdRank: [{ kd: "3.30", roleInfo: { name: "我方B" } }],
      killRank: [{ killCnt: 18, roleInfo: { headImg: "head-a", name: "我方A" } }],
      reviveRank: [{ reviveCnt: 4, roleInfo: { name: "我方C" } }],
    },
  });

  assert.deepEqual(
    rankGroups.map((group) => group.title),
    ["击杀榜", "K/D榜", "复活榜"],
  );
  assert.equal(rankGroups[0].ownItems[0].name, "我方A");
  assert.equal(rankGroups[0].opponentItems[0].value, 12);
  assert.equal(rankGroups[1].ownItems[0].value, "3.30");
});
