import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClubBattleStyle3MvpMeta,
  buildClubBattleStyle4DisplayPanels,
  buildPeachBattleClubMeta,
  buildPeachBattleHeaderTitle,
} from "../../src/components/Club/records/clubBattleRecordLayoutHelpers.js";

test("club battle layout helpers keep peach header copy stable", () => {
  assert.equal(
    buildPeachBattleHeaderTitle("2026/04/13", "我方俱乐部", "敌方俱乐部"),
    "2026/04/13 我方俱乐部 VS 敌方俱乐部 蟠桃大会对战战绩",
  );
  assert.equal(
    buildPeachBattleHeaderTitle("", "", ""),
    "我方俱乐部 VS 敌方俱乐部 蟠桃大会对战战绩",
  );
});

test("club battle layout helpers keep peach club meta stable", () => {
  assert.deepEqual(
    buildPeachBattleClubMeta({
      id: 9,
      memberCount: 30,
      name: "战盟",
      quenchNum: 12,
      serverId: 88,
      totalPower: 123000,
    }),
    {
      idText: "ID: 9",
      nameText: "88服 战盟",
      summaryText: "30人 | 12红 | 12.30万",
    },
  );
});

test("club battle layout helpers keep style3 and style4 display data stable", () => {
  assert.equal(
    buildClubBattleStyle3MvpMeta({
      killCnt: 18,
      occupyCnt: 6,
    }),
    "击杀 18 · 攻城 6",
  );
  assert.equal(buildClubBattleStyle3MvpMeta(null), "击杀 0 · 攻城 0");

  const panels = buildClubBattleStyle4DisplayPanels([
    {
      getValue: (player) => player.killCnt || 0,
      icon: "⚔️",
      key: "kill",
      players: [{ killCnt: 22, name: "成员A", roleId: 1 }],
      title: "击杀尖兵",
    },
    {
      icon: "📈",
      key: "kd",
      players: [{ key: "kd-1", name: "成员B", value: "3.20" }],
      title: "效率核心",
    },
  ]);

  assert.deepEqual(panels, [
    {
      icon: "⚔️",
      items: [{ key: 1, name: "成员A", value: 22 }],
      key: "kill",
      title: "击杀尖兵",
    },
    {
      icon: "📈",
      items: [{ key: "kd-1", name: "成员B", value: "3.20" }],
      key: "kd",
      title: "效率核心",
    },
  ]);
});
