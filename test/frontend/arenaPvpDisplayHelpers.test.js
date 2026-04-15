import assert from "node:assert/strict";
import test from "node:test";
import {
  buildArenaBattleRunResultView,
  buildArenaManualLineupEntries,
  buildArenaManualTargetOptions,
  buildArenaTargetListView,
} from "../../src/components/cards/pvp/arenaPvpDisplayHelpers.js";

test("arena pvp display helpers keep manual target options and entries stable", () => {
  assert.deepEqual(
    buildArenaManualTargetOptions(
      [
        { name: "Alpha", roleId: "1001" },
        { name: "Beta", roleId: "1002" },
      ],
      [
        { name: "Alpha" },
        { name: "Gamma" },
      ],
      {
        dashText: "-",
        formatRecordSourceOption: (name) => `${name} (record source)`,
      },
    ),
    [
      { label: "Alpha (1001)", value: "1001" },
      { label: "Beta (1002)", value: "1002" },
      { label: "Alpha (record source)", value: "name:Alpha" },
      { label: "Gamma (record source)", value: "name:Gamma" },
    ],
  );

  assert.deepEqual(
    buildArenaManualLineupEntries(
      {
        "name:Gamma": "司马懿",
        "1002": "吕赵",
      },
      "未知",
    ),
    [
      { key: "1002", lineupType: "吕赵" },
      { key: "name:Gamma", lineupType: "司马懿" },
    ],
  );
});

test("arena pvp display helpers keep target reference ordering and skip summary stable", () => {
  const view = buildArenaTargetListView({
    arenaRecords: [
      { name: "Guard", roleId: "2001", scoreDelta: 5, type: "攻" },
      { name: "Guard", roleId: "2001", scoreDelta: 3, type: "守" },
      { isWin: false, name: "Low", roleId: "2002", scoreDelta: -5, type: "攻" },
      { isWin: true, name: "Low", roleId: "2002", scoreDelta: 5, type: "守" },
    ],
    isSkippedLineupType: (lineupType) => lineupType.includes("吕赵"),
    myRoleId: "self",
    preferredWinRate: 80,
    rankList: [
      { lineupType: "吕赵", name: "Skip", powerText: "100万", rank: 1, roleId: "2000", score: 100 },
      { lineupType: "典韦队", name: "Guard", powerText: "110万", rank: 2, roleId: "2001", score: 99 },
      { lineupType: "姜维队", name: "Low", powerText: "120万", rank: 3, roleId: "2002", score: 98 },
      { lineupType: "未知阵容", name: "Fallback", powerText: "130万", rank: 4, roleId: "2003", score: 97 },
      { lineupType: "未知阵容", name: "Me", powerText: "200万", rank: 5, roleId: "self", score: 96 },
    ],
    targetWinStats: {
      2002: { total: 4, wins: 1 },
    },
    unknownText: "未知",
  });

  assert.equal(view.preferredThreshold, 80);
  assert.equal(view.skippedTotal, 1);
  assert.deepEqual(
    view.recommendedTargets.map((item) => item.roleId),
    ["2001", "2003", "2002"],
  );
  assert.deepEqual(
    view.skippedTargets.map((item) => item.roleId),
    ["2000"],
  );
  assert.equal(view.recommendedTargets[0].rateText, "100");
  assert.equal(view.recommendedTargets[1].rateText, "-");
  assert.equal(view.recommendedTargets[2].isBelowPreferredRate, true);
});

test("arena pvp display helpers keep latest run summary stable", () => {
  const view = buildArenaBattleRunResultView({
    arenaRecords: [
      { createdAt: 1500, id: "before-1", isWin: true, name: "Before", scoreDelta: 5 },
      { createdAt: 3000, id: "run-1", isWin: true, name: "Alpha", scoreDelta: 5, type: "攻" },
      { createdAt: 5000, id: "run-2", isWin: false, name: "Beta", scoreDelta: -3, type: "守" },
      { createdAt: 20000, id: "late-1", isWin: true, name: "Late", scoreDelta: 8, type: "攻" },
    ],
    endedAt: 8000,
    plannedCount: 3,
    previousRecordIds: ["before-1"],
    startedAt: 2000,
  });

  assert.equal(view.hasRunContext, true);
  assert.equal(view.executedCount, 2);
  assert.equal(view.wins, 1);
  assert.equal(view.losses, 1);
  assert.equal(view.scoreDeltaText, "+2");
  assert.deepEqual(
    view.recentRecords.map((item) => item.id),
    ["run-2", "run-1"],
  );
});
