import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClubBattleStatItems,
  buildClubBattleTopPanel,
  buildClubBattleTopPanels,
  getClubBattleAvatarText,
  getClubBattleAverageValue,
} from "../../src/components/Club/records/clubBattleRecordDisplayHelpers.js";

test("club battle display helpers keep avatar and average fallbacks stable", () => {
  assert.equal(getClubBattleAvatarText("成员A"), "成");
  assert.equal(getClubBattleAvatarText(""), "?");
  assert.equal(getClubBattleAverageValue(25, 4), "6.3");
  assert.equal(getClubBattleAverageValue(25, 0), "0.0");
});

test("club battle display helpers keep stats and top panel shapes stable", () => {
  assert.deepEqual(
    buildClubBattleStatItems([
      { label: "总击杀", value: 25 },
      { label: "总人数" },
    ]),
    [
      { label: "总击杀", value: 25 },
      { label: "总人数", value: 0 },
    ],
  );

  assert.deepEqual(
    buildClubBattleTopPanel({
      items: [
        { avatar: "a", key: "1", killCnt: 11, name: "成员A" },
        { avatar: "", key: "2", killCnt: 9, name: "成员B" },
      ],
      keyPrefix: "kill",
      title: "击杀前3",
      valueKey: "killCnt",
    }),
    {
      items: [
        { avatar: "a", key: "kill-1", name: "成员A", value: 11 },
        { avatar: "", key: "kill-2", name: "成员B", value: 9 },
      ],
      title: "击杀前3",
    },
  );
});

test("club battle display helpers batch panel builder keeps order stable", () => {
  const panels = buildClubBattleTopPanels([
    {
      items: [{ key: "1", name: "成员A", occupyCnt: 5 }],
      keyPrefix: "occupy",
      title: "攻城前3",
      valueKey: "occupyCnt",
    },
    {
      items: [{ key: "2", kd: "2.50", name: "成员B" }],
      keyPrefix: "kd",
      title: "KD 前3",
      valueKey: "kd",
    },
  ]);

  assert.deepEqual(
    panels.map((panel) => panel.title),
    ["攻城前3", "KD 前3"],
  );
  assert.equal(panels[0].items[0].key, "occupy-1");
  assert.equal(panels[1].items[0].value, "2.50");
});
