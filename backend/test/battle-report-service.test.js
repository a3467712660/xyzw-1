import assert from "node:assert/strict";
import test from "node:test";
import {
  BATTLE_REPORT_NO_DATA_CODE,
  BATTLE_REPORT_NO_DATA_MESSAGE,
  createBattleReportService,
  normalizeBattleReportError,
} from "../src/services/battleReportService.js";

test("battle report service maps command 200020 error to empty reports", async () => {
  const error = new Error("服务器错误: 200020 - 无战报");
  error.code = 200020;
  error.payload = { errCode: "200020" };
  const service = createBattleReportService({
    commandService: {
      executeAllowedCommand: async () => {
        throw error;
      },
    },
  });

  const result = await service.queryReports({
    user: { id: "u-1" },
    tokenId: "token-1",
    reportType: "peach-garden",
    date: "2026-04-19",
  });

  assert.deepEqual(result.reports, []);
  assert.equal(result.businessCode, BATTLE_REPORT_NO_DATA_CODE);
  assert.equal(result.emptyReason, BATTLE_REPORT_NO_DATA_MESSAGE);
});

test("battle report service maps payload 200020 to empty reports", async () => {
  const service = createBattleReportService({
    commandService: {
      executeAllowedCommand: async () => ({ code: "200020", message: "无记录" }),
    },
  });

  const result = await service.queryReports({
    user: { id: "u-1" },
    tokenId: "token-1",
    reportType: "salt-field",
    date: "2026-04-19",
  });

  assert.deepEqual(result.reports, []);
  assert.equal(result.businessCode, BATTLE_REPORT_NO_DATA_CODE);
});

test("battle report parse strips sensitive fields", async () => {
  const service = createBattleReportService({
    commandService: {
      executeAllowedCommand: async () => ({}),
    },
  });

  const result = await service.parseReport({
    rawText: JSON.stringify({
      winner: "A",
      token: "should-not-leak",
      nested: { cookie: "should-not-leak", score: 100 },
    }),
  });

  const text = JSON.stringify(result);
  assert.equal(text.includes("should-not-leak"), false);
  assert.equal(result.report.detail.winner, "A");
  assert.equal(result.report.detail.nested.score, 100);
});

test("battle report error normalization returns no data metadata", () => {
  const error = new Error("200020");
  error.payload = { businessCode: "200020" };

  const normalized = normalizeBattleReportError(error, "战报查询失败");

  assert.equal(normalized.status, 200);
  assert.equal(normalized.code, "BATTLE_REPORT_NO_DATA");
  assert.equal(normalized.data.businessCode, BATTLE_REPORT_NO_DATA_CODE);
});
