import assert from "node:assert/strict";
import test from "node:test";
import {
  formatClubBattleCompactDate,
  formatClubBattleKD,
  formatClubBattlePower,
  formatClubBattleRate,
  formatClubBattleShortDate,
  getClubBattleDeathColor,
  getClubBattleKillColor,
  getClubBattleOccupyColor,
  getClubBattleRankMedal,
  getClubBattleReviveColor,
} from "../../src/components/Club/records/clubBattleRecordFormatters.js";

test("club battle record formatters keep power and date text stable", () => {
  assert.equal(formatClubBattlePower(0), "0");
  assert.equal(formatClubBattlePower(12345), "1.23万");
  assert.equal(formatClubBattlePower(300000000), "3.00亿");
  assert.equal(formatClubBattleCompactDate("2026/04/14"), "260414");
  assert.equal(formatClubBattleShortDate("2026/04/14"), "04/14");
});

test("club battle record formatters keep kd and rate semantics stable", () => {
  assert.equal(formatClubBattleKD(10, 4), "2.50");
  assert.equal(formatClubBattleKD(10, 0), "0.00");
  assert.equal(formatClubBattleRate(10, 5), "200.0");
  assert.equal(formatClubBattleRate(10, 5, "win-rate"), "66.7");
});

test("club battle record formatters keep metric colors and medals stable", () => {
  assert.equal(getClubBattleKillColor(60), "rgba(76, 175, 80, 0.3)");
  assert.equal(getClubBattleKillColor(25), "rgba(139, 195, 74, 0.3)");
  assert.equal(getClubBattleOccupyColor(120), "rgba(255, 204, 128, 0.3)");
  assert.equal(getClubBattleDeathColor(12), "rgba(255, 205, 210, 0.3)");
  assert.equal(getClubBattleReviveColor(5), "rgba(200, 230, 201, 0.3)");
  assert.equal(
    getClubBattleReviveColor(40, { high: 40 }),
    "rgba(200, 230, 201, 0.3)",
  );
  assert.equal(getClubBattleRankMedal(0), "🥇");
  assert.equal(getClubBattleRankMedal(1), "🥈");
  assert.equal(getClubBattleRankMedal(2), "🥉");
  assert.equal(getClubBattleRankMedal(5), "");
});
