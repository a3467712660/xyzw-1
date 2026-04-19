import { randomId } from "../db/sql.js";
import {
  gameCommandService,
  normalizeGameCommandError,
  stripSensitiveGamePayload,
} from "./gameCommandService.js";

const BATTLE_REPORT_TYPES = Object.freeze([
  {
    id: "salt-field",
    title: "盐场战报",
    description: "查询盐场匹配、周战绩和实时战况摘要。",
  },
  {
    id: "peach-garden",
    title: "蟠桃园战报",
    description: "查询蟠桃园概览和对战战报摘要。",
  },
  {
    id: "manual",
    title: "手动解析",
    description: "粘贴 JSON 战报并在 App 内查看详情。",
  },
]);

export const BATTLE_REPORT_TYPE_IDS = BATTLE_REPORT_TYPES.map((item) => item.id);

const summarizePayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return "暂无战报详情";
  }
  if (payload.result?.isWin === true || payload.isWin === true) {
    return "胜利";
  }
  if (payload.result?.isWin === false || payload.isWin === false) {
    return "失败";
  }
  const count =
    payload.legionRankList?.length
    || payload.records?.length
    || payload.list?.length
    || payload.rankList?.length
    || 0;
  return count ? `共 ${count} 条记录` : "已解析战报";
};

const parseJsonText = (rawText) => {
  try {
    const parsed = JSON.parse(String(rawText || ""));
    if (!parsed || typeof parsed !== "object") {
      const error = new Error("战报格式不支持");
      error.status = 400;
      error.code = "BATTLE_REPORT_UNSUPPORTED";
      throw error;
    }
    return parsed;
  } catch (error) {
    if (error.status) throw error;
    const next = new Error("战报格式不支持");
    next.status = 400;
    next.code = "BATTLE_REPORT_UNSUPPORTED";
    throw next;
  }
};

export const createBattleReportService = ({
  commandService = gameCommandService,
} = {}) => ({
  getCatalog() {
    return {
      types: BATTLE_REPORT_TYPES,
    };
  },

  async queryReports({ user, tokenId, reportType, date }) {
    if (reportType === "manual") {
      return { reports: [] };
    }
    const cmd = reportType === "peach-garden" ? "legion_getpayloadrecord" : "legion_getwarrank";
    const params = reportType === "peach-garden" && date ? { date } : {};
    const raw = await commandService.executeAllowedCommand({
      user,
      tokenId,
      cmd,
      params,
      timeout: 12_000,
    });
    const safe = stripSensitiveGamePayload(raw);
    return {
      reports: [
        {
          id: randomId("br"),
          reportType,
          title: BATTLE_REPORT_TYPES.find((item) => item.id === reportType)?.title || "战报",
          summary: summarizePayload(safe),
          createdAt: new Date().toISOString(),
          detail: safe,
        },
      ],
    };
  },

  async parseReport({ rawText }) {
    const payload = parseJsonText(rawText);
    const safe = stripSensitiveGamePayload(payload);
    return {
      report: {
        id: randomId("brp"),
        reportType: "manual",
        title: "手动战报",
        summary: summarizePayload(safe),
        createdAt: new Date().toISOString(),
        detail: safe,
      },
    };
  },
});

export const battleReportService = createBattleReportService();

export const normalizeBattleReportError = (error, fallbackMessage = "战报处理失败") => {
  if (error?.status) {
    return {
      status: error.status,
      code: error.code || "BATTLE_REPORT_FAILED",
      message: error.message || fallbackMessage,
    };
  }
  return normalizeGameCommandError(error, fallbackMessage);
};
