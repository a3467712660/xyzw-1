import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClubApplyDisplayModel,
  buildClubMemberExportBannerModel,
  buildPeachFightSummaryItems,
  formatClubInfoPercent,
} from "../../src/components/Club/info/clubInfoDisplayHelpers.js";

test("club info display helpers keep peach fight summary semantics stable", () => {
  assert.equal(formatClubInfoPercent(1, 4), "25.00%");
  assert.equal(formatClubInfoPercent(1, 0), "0.00%");

  const summaryItems = buildPeachFightSummaryItems({
    dieStats: {
      enemyDieHeroGameCount: 1,
      ourDieHeroGameCount: 2,
    },
    fightResult: {
      lossCount: 1,
      totalCount: 4,
      winCount: 3,
    },
    labels: {
      enemyDieRate: "敌方掉将率",
      lossCount: "失败",
      ourDieRate: "我方掉将率",
      totalCount: "总场次",
      winCount: "胜利",
      winRate: "胜率",
    },
  });

  assert.deepEqual(summaryItems, [
    { className: "", label: "总场次", value: 4 },
    { className: "win", label: "胜利", value: 3 },
    { className: "loss", label: "失败", value: 1 },
    { className: "", label: "胜率", value: "75.00%" },
    { className: "", label: "我方掉将率", value: "50.00%" },
    { className: "", label: "敌方掉将率", value: "25.00%" },
  ]);
});

test("club info display helpers keep apply list and export banner semantics stable", () => {
  const applyItem = buildClubApplyDisplayModel(
    {
      applyReason: "求收留",
      headImg: "",
      level: 28,
      name: "吕布",
      power: 123456,
      roleId: 1001,
      serverId: 88,
    },
    (value) => `${value}战力`,
  );

  assert.deepEqual(applyItem, {
    avatar: "/icons/xiaoyugan.png",
    levelText: "等级: 28",
    nameText: "吕布(ID:1001)",
    powerText: "123456战力",
    reasonText: "申请留言: 求收留",
    roleId: 1001,
    serverText: "服务器: 88",
  });

  assert.deepEqual(
    buildClubMemberExportBannerModel({
      clubName: "天下会",
      exportedAt: "2026-04-15 11:30",
      memberCount: 32,
    }),
    {
      clubText: "俱乐部：天下会",
      metaText: "导出时间 2026-04-15 11:30 · 共 32 名成员",
      title: "俱乐部成员信息总览",
    },
  );
});
