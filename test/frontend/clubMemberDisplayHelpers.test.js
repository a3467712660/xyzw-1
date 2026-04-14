import assert from "node:assert/strict";
import test from "node:test";
import {
  buildClubMemberCardModel,
  buildClubMemberHeroChips,
  getClubMemberAvatarFallback,
} from "../../src/components/Club/info/clubMemberDisplayHelpers.js";

test("club member display helpers keep avatar fallback and chip text stable", () => {
  assert.equal(getClubMemberAvatarFallback("吕布"), "吕");
  assert.equal(getClubMemberAvatarFallback("吕布", 2), "吕布");
  assert.equal(getClubMemberAvatarFallback(""), "?");

  assert.deepEqual(
    buildClubMemberHeroChips(
      [
        { heroName: "吕布", red: 4 },
        { heroName: "太史慈", red: 3 },
      ],
      (hero) => `${hero.heroName}(${hero.red})`,
    ),
    ["吕布(4)", "太史慈(3)"],
  );
});

test("club member display helpers keep normalized card shape stable", () => {
  const card = buildClubMemberCardModel({
    actionLabel: "踢出成员",
    actionType: "error",
    avatar: "/avatar.png",
    avatarText: "吕",
    badges: [{ text: "会长", type: "warning" }],
    chips: ["吕布(4)"],
    id: 1001,
    lineupTag: { text: "吕布队", color: { color: "#111" } },
    metrics: [{ label: "战力", value: "1.23亿" }],
    name: "吕布",
    raw: { roleId: 1001 },
    subtext: "ID: 1001",
  });

  assert.equal(card.name, "吕布");
  assert.equal(card.id, 1001);
  assert.equal(card.actionLabel, "踢出成员");
  assert.deepEqual(card.badges, [{ text: "会长", type: "warning" }]);
  assert.deepEqual(card.chips, ["吕布(4)"]);
  assert.deepEqual(card.metrics, [{ label: "战力", value: "1.23亿" }]);
});
