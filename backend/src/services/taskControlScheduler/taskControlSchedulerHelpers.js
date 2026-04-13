import {
  parseTaskControlRowsFromPayload,
  sanitizeTaskControlWsUrl,
} from "../../schemas/taskControlState.js";
import { redactUrl, sanitizeForLog } from "../../lib/logRedactor.js";

export const CHECK_INTERVAL_MS = 15_000;
export const TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;
export const DEFAULT_TIMEOUT_MS = 10_000;
export const AUTHUSER_TIMEOUT_MS = 8_000;
export const AUTHUSER_RETRY_COUNT = 2;
export const QUIET_WINDOW_PREF_KEY = "task_control_quiet_windows_v1";
export const SERVER_ERROR_CODE_MAP = {
  12400000: "挂机奖励领取过于频繁",
  3500020: "没有可领取的奖励",
  200160: "模块未开启",
  200760: "界面状态已变化，请重新登录",
  200400: "操作太快，请稍后再试",
};

export const TASK_META = {
  daily: { title: "日常任务", taskName: "startBatch" },
  hangup: { title: "领取挂机", taskName: "claimHangUpRewards" },
  bottle: { title: "重置罐子", taskName: "resetBottles" },
  tower: { title: "爬咸将塔", taskName: "climbTower" },
  "send-car": { title: "智能发车", taskName: "batchSmartSendCar" },
  "claim-car": { title: "收车", taskName: "batchClaimCars" },
  study: { title: "答题", taskName: "batchStudy" },
  legacy: { title: "领取功法残卷", taskName: "batchLegacyClaim" },
  arena: { title: "竞技场战斗", taskName: "batcharenafight" },
  "club-store": { title: "俱乐部商店购买", taskName: "legion_storebuygoods" },
};

export const SUPPORTED_TASK_IDS = new Set([
  "daily",
  "hangup",
  "bottle",
  "tower",
  "study",
  "legacy",
  "arena",
  "club-store",
  "claim-car",
  "send-car",
]);

export const CRON_CATCHUP_MAX_MINUTES = 5;
export const EMPTY_PRIORITY = Number.MAX_SAFE_INTEGER;
export const MAX_TOKEN_EXECUTION_QUEUE_LENGTH = 300;
export const MAX_AUTO_TASKS_PER_USER_PER_TICK = 20;
export const WS_CONNECT_TIMEOUT_MS = 12_000;
export const WS_CONNECT_RETRY_COUNT = 2;
export const WS_CONNECT_RETRY_BASE_DELAY_MS = 500;
export const WS_CIRCUIT_OPEN_FAIL_COUNT = 3;
export const WS_CIRCUIT_OPEN_MS = 60_000;
export const TASK_CONTROL_CUSTOM_WS_URL_ENABLED = ["1", "true", "on", "yes"].includes(
  String(process.env.TASK_CONTROL_CUSTOM_WS_URL_ENABLED || "").trim().toLowerCase(),
);
export const TASK_CONTROL_CUSTOM_WS_URL_ALLOWLIST = String(
  process.env.TASK_CONTROL_CUSTOM_WS_URL_ALLOWLIST || "hortorgames.com,.hortorgames.com",
)
  .split(",")
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean);

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const RETRYABLE_NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "EPIPE",
  "EHOSTUNREACH",
  "ENETUNREACH",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CONNECT",
]);

const RETRYABLE_NETWORK_ERROR_PATTERNS = [
  /secure TLS connection was established/i,
  /socket hang up/i,
  /network.*timeout/i,
  /fetch failed/i,
  /websocket.*unexpected response/i,
];

export const collectErrorMessages = (error) => {
  const messages = [];
  if (!error || typeof error !== "object") {
    return messages;
  }
  if (typeof error.message === "string") {
    messages.push(error.message);
  }
  if (
    error.cause &&
    typeof error.cause === "object" &&
    typeof error.cause.message === "string"
  ) {
    messages.push(error.cause.message);
  }
  return messages;
};

export const collectErrorCodes = (error) => {
  const codes = [];
  if (!error || typeof error !== "object") {
    return codes;
  }
  if (typeof error.code === "string") {
    codes.push(error.code);
  }
  if (
    error.cause &&
    typeof error.cause === "object" &&
    typeof error.cause.code === "string"
  ) {
    codes.push(error.cause.code);
  }
  return codes;
};

export const isRetryableNetworkError = (error) => {
  if (!error) {
    return false;
  }
  if (error?.name === "AbortError") {
    return true;
  }
  const codes = collectErrorCodes(error);
  if (codes.some((code) => RETRYABLE_NETWORK_ERROR_CODES.has(String(code).toUpperCase()))) {
    return true;
  }
  const messages = collectErrorMessages(error);
  return messages.some((message) =>
    RETRYABLE_NETWORK_ERROR_PATTERNS.some((pattern) => pattern.test(String(message || ""))),
  );
};

export const formatExecutionErrorMessage = (error) => {
  if (isRetryableNetworkError(error)) {
    const code = collectErrorCodes(error)[0];
    return code
      ? `网络连接异常（TLS/链路中断，${code}），请稍后重试`
      : "网络连接异常（TLS/链路中断），请稍后重试";
  }
  const raw = String(error?.message || "").trim();
  return raw || "未知错误";
};

export const parseTaskRows = (payloadJson) =>
  parseTaskControlRowsFromPayload(payloadJson);

export const minuteKey = (date = new Date()) =>
  `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(
    date.getDate(),
  ).padStart(2, "0")}${String(date.getHours()).padStart(2, "0")}${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;

export const getHourlyIntervalFromCron = (expr = "") => {
  const parts = String(expr || "").trim().split(/\s+/);
  if (parts.length !== 5) {
    return null;
  }
  const [m, h, d, mo, w] = parts;
  if (m !== "0" || d !== "*" || mo !== "*" || w !== "*") {
    return null;
  }
  if (!h.startsWith("*/")) {
    return null;
  }
  const interval = Number(h.slice(2));
  if (!Number.isInteger(interval) || interval < 1 || interval > 23) {
    return null;
  }
  return interval;
};

export const isIntervalDueNow = (row, nowTs) => {
  const intervalHours = getHourlyIntervalFromCron(row?.cronExpr);
  if (!intervalHours) {
    return false;
  }
  const intervalMs = intervalHours * 60 * 60 * 1000;
  const lastRunTs = Number(new Date(row?.lastRunAt || "").getTime());
  if (!Number.isFinite(lastRunTs) || lastRunTs <= 0) {
    return false;
  }
  return lastRunTs + intervalMs <= nowTs;
};

export const parseTokenString = (tokenText) => {
  if (!tokenText || typeof tokenText !== "string") {
    return "";
  }
  const value = tokenText.trim();
  if (!value) {
    return "";
  }
  try {
    const parsed = JSON.parse(value);
    return String(parsed?.token || parsed?.gameToken || value).trim();
  } catch {
    return value;
  }
};

export const maskTokenIdForLog = (tokenId) => {
  const value = String(tokenId || "").trim();
  if (!value) {
    return "***";
  }
  if (value.length <= 8) {
    return `${value.slice(0, 2)}***`;
  }
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
};

export const extractRoleIdFromTokenText = (tokenText) => {
  if (!tokenText || typeof tokenText !== "string") {
    return "";
  }
  try {
    const parsed = JSON.parse(tokenText);
    const roleId = Number(parsed?.roleId || parsed?.role?.roleId);
    return Number.isFinite(roleId) && roleId > 0 ? String(roleId) : "";
  } catch {
    return "";
  }
};

const URL_IN_LOG_PATTERN = /\b(?:wss?|https?):\/\/[^\s)]+/gi;
const TOKEN_KV_IN_LOG_PATTERN =
  /\b(token|actualToken|refreshToken|accessToken|sessionToken)=([^&\s]+)/gi;
const BEARER_IN_LOG_PATTERN = /(Bearer\s+)([A-Za-z0-9._~-]+)/gi;
const P_QUERY_IN_LOG_PATTERN = /([?&]p=)([^&\s]+)/gi;

export const sanitizeTaskControlLogMessage = (message) => {
  let text = sanitizeForLog(message ?? "");
  text = text.replace(URL_IN_LOG_PATTERN, (matched) => redactUrl(matched));
  text = text.replace(TOKEN_KV_IN_LOG_PATTERN, (_matched, key) => `${key}=***`);
  text = text.replace(BEARER_IN_LOG_PATTERN, "$1***");
  text = text.replace(P_QUERY_IN_LOG_PATTERN, "$1***");
  return text;
};

export {
  sanitizeTaskControlWsUrl,
};
