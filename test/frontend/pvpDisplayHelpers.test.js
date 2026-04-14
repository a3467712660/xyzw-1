import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFightPvpResultSummary,
  getFightPvpAvatarText,
  resolveFightPvpLegacyBadge,
  resolveFightPvpLineupTagColor,
} from "../../src/components/cards/pvp/pvpDisplayHelpers.js";

test("pvp display helpers keep lineup and legacy badge semantics stable", () => {
  assert.deepEqual(
    resolveFightPvpLineupTagColor("吕赵", [
      {
        colorProps: { color: "#111", textColor: "#fff" },
        name: "吕赵",
      },
    ]),
    { color: "#111", textColor: "#fff" },
  );
  assert.deepEqual(resolveFightPvpLineupTagColor("未知", []), {
    color: "#595959",
    textColor: "#fff",
  });

  assert.deepEqual(
    resolveFightPvpLegacyBadge(3, { 3: { name: "红将", value: "#f33" } }, "未知"),
    { color: "#f33", text: "红将" },
  );
  assert.deepEqual(resolveFightPvpLegacyBadge(0, {}, "未知"), {
    color: "",
    text: "未知",
  });
});

test("pvp display helpers keep avatar and result summary semantics stable", () => {
  assert.equal(getFightPvpAvatarText("吕布", 2), "吕布");
  assert.equal(getFightPvpAvatarText("", 2), "?");

  assert.deepEqual(
    buildFightPvpResultSummary(10, {
      enemyTotalDieHeroCount: 18,
      ourTotalDieHeroCount: 12,
      winCount: 7,
    }),
    {
      enemyDieRateText: "36.00%",
      lossCount: 3,
      ourDieRateText: "24.00%",
      total: 10,
      winCount: 7,
      winRateText: "70.00%",
    },
  );
});
