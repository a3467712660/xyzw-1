import assert from "node:assert/strict";
import test from "node:test";
import jiti from "jiti";

process.env.TZ = "Asia/Shanghai";

const loadModule = jiti(import.meta.url, { interopDefault: true });
const { isInCurrentWeek } = loadModule("../../src/utils/base.ts");

const RealDate = Date;

function withMockedNow(nowValue, callback) {
  const fixedNow = new RealDate(nowValue);

  class MockDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        return new RealDate(fixedNow);
      }
      return new RealDate(...args);
    }

    static now() {
      return fixedNow.getTime();
    }
  }

  MockDate.parse = RealDate.parse;
  MockDate.UTC = RealDate.UTC;

  globalThis.Date = MockDate;
  try {
    return callback(fixedNow);
  } finally {
    globalThis.Date = RealDate;
  }
}

test("isInCurrentWeek defaults to Monday as the first day of week", () => {
  withMockedNow("2026-01-05T10:00:00+08:00", () => {
    assert.equal(isInCurrentWeek(new Date("2026-01-05T00:01:00+08:00").getTime()), true);
    assert.equal(isInCurrentWeek(new Date("2026-01-11T23:59:59+08:00").getTime()), true);
    assert.equal(isInCurrentWeek(new Date("2026-01-04T23:59:59+08:00").getTime()), false);
    assert.equal(isInCurrentWeek(new Date("2026-01-12T00:00:00+08:00").getTime()), false);
  });
});

test("isInCurrentWeek respects explicit Sunday weekStart", () => {
  withMockedNow("2026-01-05T10:00:00+08:00", () => {
    assert.equal(isInCurrentWeek(new Date("2026-01-04T00:00:00+08:00").getTime(), 0), true);
    assert.equal(isInCurrentWeek(new Date("2026-01-03T23:59:59+08:00").getTime(), 0), false);
  });
});

test("isInCurrentWeek keeps Monday semantics across year boundary", () => {
  withMockedNow("2026-01-01T12:00:00+08:00", () => {
    assert.equal(isInCurrentWeek(new Date("2025-12-29T00:00:00+08:00").getTime()), true);
    assert.equal(isInCurrentWeek(new Date("2025-12-28T23:59:59+08:00").getTime()), false);
  });
});
