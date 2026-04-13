import assert from "node:assert/strict";
import test from "node:test";
import {
  extractValidData,
  formatPower,
  typeBg,
  typeName,
} from "../../src/services/legionWar/legionWarFormatters.js";

test("formatPower and type helpers preserve legion war display semantics", () => {
  assert.equal(formatPower(0), "0");
  assert.equal(formatPower(12345), "1.23万");
  assert.equal(formatPower(200000000), "2.00亿");
  assert.equal(typeBg(6), "#1bd7d7");
  assert.equal(typeName(9), "道路");
});

test("extractValidData derives legion, member, and score summaries from battlefield payload", () => {
  const result = extractValidData({
    battlefield: {
      buildingData: {
        stronghold_a: { point: 30 },
        stronghold_b: { point: 80 },
      },
      legions: {
        alpha: {
          id: "alpha",
          blessingIdList: ["b1"],
          blessingScore: 20,
          buildings: {
            stronghold_a: true,
            stronghold_b: true,
          },
          custom: { "red:quench": 18 },
          killCnt: 9,
          level: 7,
          name: "Alpha",
          color: 1,
          membersV2: { u1: {}, u2: {} },
          point: 55,
          position: "1_1",
          strongholdId: "1_1",
          power: 123456,
          serverId: 12,
        },
      },
      roles: {
        u1: {
          legionID: "alpha",
          isOnline: true,
          revive: 2,
          d: 8,
          state: "march",
          name: "Alice",
          aB: 5,
          killCnt: 3,
          point: 10,
        },
      },
    },
  });

  assert.equal(result.legionInfo.alpha.score, 130);
  assert.equal(result.legionInfo.alpha.OnlineCount, 1);
  assert.equal(result.legionInfo.alpha.danCount, 2);
  assert.equal(result.memberInfo[0].lastState, "行进");
  assert.equal(result.memberInfo[0].legionName, "Alpha");
});
