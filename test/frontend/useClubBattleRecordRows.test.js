import assert from "node:assert/strict";
import test from "node:test";
import {
  getClubBattleTopRows,
  normalizeClubBattleRows,
} from "../../src/components/Club/records/useClubBattleRecordRows.js";

test("club battle rows normalizer keeps single-club member metrics stable", () => {
  const rows = normalizeClubBattleRows([
    {
      buildingCnt: 8,
      headImg: "avatar-a",
      loseCnt: 10,
      name: "成员A",
      roleId: 1,
      winCnt: 20,
    },
  ]);

  assert.deepEqual(rows[0], {
    avatar: "avatar-a",
    deathCnt: 10,
    kd: "2.00",
    key: 1,
    killCnt: 20,
    killStreakCnt: 0,
    name: "成员A",
    occupyCnt: 8,
    rank: 1,
    raw: {
      buildingCnt: 8,
      headImg: "avatar-a",
      loseCnt: 10,
      name: "成员A",
      roleId: 1,
      winCnt: 20,
    },
    reviveCnt: 4,
  });
});

test("club battle rows normalizer supports peach roleInfo record shape", () => {
  const rows = normalizeClubBattleRows(
    [
      {
        carCnt: 6,
        killCnt: 18,
        mCKCnt: 4,
        reviveCnt: 3,
        roleInfo: {
          headImg: "avatar-b",
          name: "敌方B",
        },
      },
    ],
    {
      avatarGetter: (player) => player.roleInfo.headImg,
      deathGetter: (player) => player.reviveCnt,
      extraGetter: (player) => ({
        carCnt: player.carCnt,
      }),
      killGetter: (player) => player.killCnt,
      killStreakGetter: (player) => player.mCKCnt,
      nameGetter: (player) => player.roleInfo.name,
      occupyGetter: (player) => player.carCnt,
      reviveGetter: (player) => player.reviveCnt,
    },
  );

  assert.equal(rows[0].name, "敌方B");
  assert.equal(rows[0].avatar, "avatar-b");
  assert.equal(rows[0].killCnt, 18);
  assert.equal(rows[0].occupyCnt, 6);
  assert.equal(rows[0].killStreakCnt, 4);
  assert.equal(rows[0].reviveCnt, 3);
  assert.equal(rows[0].kd, "6.00");
});

test("club battle top rows keep descending and ascending ranking stable", () => {
  const rows = [
    { key: "a", kd: "1.20", killCnt: 10, rank: 2 },
    { key: "b", kd: "3.40", killCnt: 30, rank: 1 },
    { key: "c", kd: "2.10", killCnt: 20, rank: 3 },
  ];

  assert.deepEqual(
    getClubBattleTopRows(rows, "killCnt").map((item) => item.key),
    ["b", "c", "a"],
  );
  assert.deepEqual(
    getClubBattleTopRows(rows, "killCnt", {
      limit: 2,
      order: "asc",
    }).map((item) => item.key),
    ["a", "c"],
  );
  assert.deepEqual(
    getClubBattleTopRows(rows, "kd").map((item) => item.key),
    ["b", "c", "a"],
  );
});
