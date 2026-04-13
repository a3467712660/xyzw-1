import assert from "node:assert/strict";
import test from "node:test";
import {
  formatExecutionErrorMessage,
  getHourlyIntervalFromCron,
  isIntervalDueNow,
  sanitizeTaskControlLogMessage,
} from "../src/services/taskControlScheduler/taskControlSchedulerHelpers.js";

test("getHourlyIntervalFromCron only accepts supported hourly interval expressions", () => {
  assert.equal(getHourlyIntervalFromCron("0 */6 * * *"), 6);
  assert.equal(getHourlyIntervalFromCron("15 */6 * * *"), null);
  assert.equal(getHourlyIntervalFromCron("0 6 * * *"), null);
});

test("isIntervalDueNow checks lastRunAt against parsed interval hours", () => {
  const nowTs = Date.parse("2026-04-13T12:00:00.000Z");
  assert.equal(
    isIntervalDueNow(
      {
        cronExpr: "0 */4 * * *",
        lastRunAt: "2026-04-13T07:30:00.000Z",
      },
      nowTs,
    ),
    true,
  );
  assert.equal(
    isIntervalDueNow(
      {
        cronExpr: "0 */4 * * *",
        lastRunAt: "2026-04-13T09:30:00.000Z",
      },
      nowTs,
    ),
    false,
  );
});

test("scheduler helper redacts sensitive tokens and retryable network errors", () => {
  assert.match(
    sanitizeTaskControlLogMessage(
      "url=https://x.example.com?a=1&token=secret Bearer abc123?p=payload",
    ),
    /\*\*\*/,
  );
  assert.equal(
    formatExecutionErrorMessage({ code: "ECONNRESET", message: "socket hang up" }),
    "网络连接异常（TLS/链路中断，ECONNRESET），请稍后重试",
  );
});
