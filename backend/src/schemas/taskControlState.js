import { z } from "zod";
import { validateCronExpression } from "../../../shared/batch/cronUtils.js";

export const TASK_CONTROL_MAX_ROWS = 200;
export const TASK_CONTROL_MAX_TOKEN_IDS_PER_TASK = 50;
export const TASK_CONTROL_MAX_MAP_ITEMS = 200;

const TASK_ID_VALUES = [
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
];

const tokenIdSchema = z.string().trim().min(1).max(64);
const taskIdSchema = z.enum(TASK_ID_VALUES);
const cronExprSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((expr) => validateCronExpression(expr).valid, "cronExpr 格式无效");
const isoDatetimeSchema = z.string().datetime().or(z.literal(""));

const mapByTokenSchema = (valueSchema) =>
  z
    .record(tokenIdSchema, valueSchema)
    .refine(
      (map) => Object.keys(map || {}).length <= TASK_CONTROL_MAX_MAP_ITEMS,
      `映射数量不能超过 ${TASK_CONTROL_MAX_MAP_ITEMS}`,
    );

const dailyRunnerSettingsSchema = z.object({
  friendGoldEnable: z.boolean().optional().default(true),
  recruitEnable: z.boolean().optional().default(true),
  payRecruit: z.boolean().optional().default(true),
  openBox: z.boolean().optional().default(true),
  freeFishEnable: z.boolean().optional().default(true),
  mengjingEnable: z.boolean().optional().default(true),
  legionBossEnable: z.boolean().optional().default(true),
  dailyBossEnable: z.boolean().optional().default(true),
  bossTimes: z.number().int().min(0).max(4).optional().default(2),
  legionBossFormation: z.number().int().min(1).max(6).optional(),
  dailyBossFormation: z.number().int().min(1).max(6).optional(),
}).strict();

const smartCarSettingsSchema = z.object({
  carMinColor: z.number().int().min(1).max(6).optional().default(4),
  useGoldRefreshFallback: z.boolean().optional().default(false),
  smartDepartureGoldThreshold: z.number().int().min(0).max(1_000_000).optional().default(0),
  smartDepartureRecruitThreshold: z.number().int().min(0).max(1_000_000).optional().default(0),
  smartDepartureJadeThreshold: z.number().int().min(0).max(1_000_000).optional().default(0),
  smartDepartureTicketThreshold: z.number().int().min(0).max(1_000_000).optional().default(0),
  smartDepartureMaxRefreshAttempts: z.number().int().min(1).max(500).optional().default(30),
  smartDepartureMatchAll: z.boolean().optional().default(false),
  helperLineupAnalysisEnabled: z.boolean().optional().default(true),
  helperPreferredLineups: z.array(z.string().trim().min(1).max(32)).max(8).optional().default([]),
  actionDelay: z.number().int().min(100).max(10_000).optional(),
  refreshDelay: z.number().int().min(200).max(10_000).optional(),
}).strict();

const arenaConfigSchema = z.object({
  mode: z.enum(["batch", "standalone"]).optional().default("batch"),
  fightCount: z.number().int().min(1).max(10_000).optional().default(10),
  arenaFormation: z.number().int().min(1).max(6).optional().default(1),
  skipLineups: z.array(z.string().trim().min(1).max(32)).max(8).optional().default([]),
}).strict();

const clubStoreConfigSchema = z.object({
  goodsIds: z.array(z.number().int().min(1).max(10_000)).max(32).optional().default([6]),
  onlyUnbought: z.boolean().optional().default(true),
}).strict();

const wsUrlSchema = z
  .string()
  .trim()
  .max(256)
  .optional()
  .default("")
  .refine((wsUrl) => !wsUrl || sanitizeTaskControlWsUrl(wsUrl, { allowCustom: true }).length > 0, "wsUrl 非法：仅允许 wss:// 且 host 必须在允许列表");

export const taskControlTaskRowSchema = z.object({
  id: taskIdSchema,
  enabled: z.boolean().optional().default(false),
  cronExpr: cronExprSchema,
  tokenIds: z.array(tokenIdSchema).max(TASK_CONTROL_MAX_TOKEN_IDS_PER_TASK).optional().default([]),
  tokenNameMap: mapByTokenSchema(z.string().trim().min(1).max(64)).optional().default({}),
  tokenRoleIdMap: mapByTokenSchema(z.string().trim().min(1).max(64)).optional().default({}),
  dailySelectedTasks: z.array(z.enum(["batchGenieSweep"])).max(4).optional().default([]),
  dailyRunner: dailyRunnerSettingsSchema.optional().default({}),
  dailyRunnerByToken: mapByTokenSchema(dailyRunnerSettingsSchema).optional().default({}),
  smartCar: smartCarSettingsSchema.optional().default({}),
  smartCarByToken: mapByTokenSchema(smartCarSettingsSchema).optional().default({}),
  arenaConfig: arenaConfigSchema.optional().default({}),
  clubStore: clubStoreConfigSchema.optional().default({}),
  wsUrl: wsUrlSchema,
  wsUrlByToken: mapByTokenSchema(wsUrlSchema).optional().default({}),
  lastAutoMinuteKey: z.string().trim().max(32).optional().default(""),
  lastRunAt: isoDatetimeSchema.optional().default(""),
  quietDeferredAt: isoDatetimeSchema.optional().default(""),
  quietDeferredReason: z.string().trim().max(64).optional().default(""),
}).strict();

export const taskControlStateBodySchema = z.object({
  tasks: z.array(taskControlTaskRowSchema).max(TASK_CONTROL_MAX_ROWS).optional().default([]),
}).strict();

export const parseTaskControlRowsFromPayload = (payloadJson) => {
  try {
    const parsed = JSON.parse(payloadJson);
    const rawRows = Array.isArray(parsed?.tasks) ? parsed.tasks : [];
    const rows = [];
    const limitedRows = rawRows.slice(0, TASK_CONTROL_MAX_ROWS);
    for (const item of limitedRows) {
      const checked = taskControlTaskRowSchema.safeParse(item);
      if (!checked.success) continue;
      rows.push(checked.data);
    }
    return rows;
  } catch {
    return [];
  }
};

export const isAllowedTaskControlWsHostname = (hostname, allowlist = ["hortorgames.com", ".hortorgames.com"]) => {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  return allowlist.some((pattern) => {
    const normalized = String(pattern || "").trim().toLowerCase();
    if (!normalized) return false;
    if (normalized.startsWith(".")) {
      return host.endsWith(normalized);
    }
    return host === normalized;
  });
};

export const sanitizeTaskControlWsUrl = (
  wsUrl,
  {
    allowCustom = false,
    allowlist = ["hortorgames.com", ".hortorgames.com"],
  } = {},
) => {
  if (!allowCustom) return "";
  const raw = String(wsUrl || "").trim();
  if (!raw) return "";
  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "wss:") return "";
    if (parsed.username || parsed.password) return "";
    if (!isAllowedTaskControlWsHostname(parsed.hostname, allowlist)) return "";
    return parsed.toString();
  } catch {
    return "";
  }
};
