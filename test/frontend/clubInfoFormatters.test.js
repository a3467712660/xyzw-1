import assert from "node:assert/strict";
import test from "node:test";
import {
  formatClubInfoNumber,
  formatClubRedQuenchLabel,
  getClubJobLabel,
  getClubJobTagColor,
  getClubLineupTagColor,
  getClubMemberPowerValue,
  getClubMemberRedQuenchValue,
  sortClubMembersByPriority,
} from "../../src/components/Club/info/clubInfoFormatters.js";

test("club info formatters keep number and badge semantics stable", () => {
  assert.equal(formatClubInfoNumber(0), "0");
  assert.equal(formatClubInfoNumber(12345), "1.23万");
  assert.equal(formatClubInfoNumber(200000000), "2.00亿");
  assert.equal(formatClubRedQuenchLabel(61), "61红");
  assert.equal(getClubJobLabel(1), "会长");
  assert.equal(getClubJobLabel(2), "副会长");
  assert.equal(getClubJobLabel(0), "成员");
  assert.deepEqual(getClubJobTagColor(1), {
    color: "#fff7e6",
    borderColor: "#ffd591",
    textColor: "#ad6800",
  });
});

test("club info lineup and member metric helpers keep fallback semantics stable", () => {
  const lineupRules = [
    {
      name: "吕布队",
      colorProps: {
        color: "#111",
        textColor: "#fff",
      },
    },
  ];

  assert.deepEqual(getClubLineupTagColor("吕布队", lineupRules), {
    color: "#111",
    textColor: "#fff",
  });
  assert.deepEqual(getClubLineupTagColor("", lineupRules), {});
  assert.equal(
    getClubMemberPowerValue({ power: 123, custom: { s_power: 456 } }),
    123,
  );
  assert.equal(getClubMemberPowerValue({ custom: { s_power: 456 } }), 456);
  assert.equal(
    getClubMemberRedQuenchValue({ custom: { red_quench_cnt: 12 } }),
    12,
  );
});

test("club info member sorting keeps job, red quench, and power priority stable", () => {
  const sorted = sortClubMembersByPriority([
    { roleId: 3, job: 0, power: 1000, custom: { red_quench_cnt: 1 } },
    { roleId: 2, job: 2, power: 2000, custom: { red_quench_cnt: 5 } },
    { roleId: 1, job: 1, power: 1500, custom: { red_quench_cnt: 2 } },
    { roleId: 4, job: 2, power: 5000, custom: { red_quench_cnt: 4 } },
  ]);

  assert.deepEqual(
    sorted.map((item) => item.roleId),
    [1, 2, 4, 3],
  );
});
