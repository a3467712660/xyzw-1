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
export const BATTLE_REPORT_NO_DATA_CODE = "200020";
export const BATTLE_REPORT_NO_DATA_MESSAGE = "当天暂无战报，可能未参加或战报尚未生成";

export const battleReportNoDataPayload = () => ({
  reports: [],
  emptyReason: BATTLE_REPORT_NO_DATA_MESSAGE,
  businessCode: BATTLE_REPORT_NO_DATA_CODE,
});

const collectCodeLikeValues = (value, output = [], depth = 0) => {
  if (depth > 4 || value == null) return output;
  if (typeof value === "string" || typeof value === "number") {
    output.push(String(value));
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectCodeLikeValues(item, output, depth + 1));
    return output;
  }
  if (typeof value === "object") {
    ["code", "errCode", "errorCode", "businessCode", "status", "message", "hint"].forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        collectCodeLikeValues(value[key], output, depth + 1);
      }
    });
    collectCodeLikeValues(value.error, output, depth + 1);
    collectCodeLikeValues(value.payload, output, depth + 1);
  }
  return output;
};

export const isBattleReportNoDataError = (value) => {
  const values = collectCodeLikeValues(value);
  if (value?.message) values.push(String(value.message));
  if (value?.publicMessage) values.push(String(value.publicMessage));
  return values.some((item) => {
    const text = String(item || "").trim();
    return text === BATTLE_REPORT_NO_DATA_CODE ||
      text === "BATTLE_REPORT_NO_DATA" ||
      text.includes(BATTLE_REPORT_NO_DATA_CODE);
  });
};

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
    let raw;
    try {
      raw = await commandService.executeAllowedCommand({
        user,
        tokenId,
        cmd,
        params,
        timeout: 12_000,
      });
    } catch (error) {
      if (isBattleReportNoDataError(error)) {
        return battleReportNoDataPayload();
      }
      throw error;
    }
    if (isBattleReportNoDataError(raw)) {
      return battleReportNoDataPayload();
    }
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
  if (isBattleReportNoDataError(error)) {
    return {
      status: 200,
      code: "BATTLE_REPORT_NO_DATA",
      message: BATTLE_REPORT_NO_DATA_MESSAGE,
      data: battleReportNoDataPayload(),
    };
  }
  if (error?.status) {
    return {
      status: error.status,
      code: error.code || "BATTLE_REPORT_FAILED",
      message: error.message || fallbackMessage,
    };
  }
  return normalizeGameCommandError(error, fallbackMessage);
};
