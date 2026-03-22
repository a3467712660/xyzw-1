import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";
import { nowIso, randomId } from "../db/sql.js";
import { taskControlRepository } from "../repositories/taskControlRepository.js";
import { redactUrl, sanitizeForLog } from "../lib/logRedactor.js";
import {
  parseTaskControlRowsFromPayload,
  taskControlStateBodySchema,
} from "../schemas/taskControlState.js";

const router = Router();

const STATE_MAX_LENGTH = 512 * 1024;
const MESSAGE_MAX_LENGTH = 2000;
const TASK_NAME_MAX_LENGTH = 64;
const taskControlLogsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(500),
});
const taskControlLogBodySchema = z.object({
  taskId: z.string().trim().max(128).optional().default(""),
  taskName: z.string().trim().min(1).max(TASK_NAME_MAX_LENGTH),
  status: z.enum(["info", "success", "warning", "error"]).optional().default("info"),
  message: z.string().trim().min(1).max(MESSAGE_MAX_LENGTH),
}).strict();
const taskControlRateKey = (req) => `${req.auth?.user?.id || "anonymous"}:${req.ip || "anonymous"}`;
const taskControlReadLimiter = createRateLimiter({
  scope: "task_control_read",
  windowMs: 60 * 1000,
  max: 120,
  blockMs: 5 * 60 * 1000,
  keyGenerator: taskControlRateKey,
});
const taskControlStateWriteLimiter = createRateLimiter({
  scope: "task_control_state_write",
  windowMs: 60 * 1000,
  max: 20,
  blockMs: 10 * 60 * 1000,
  keyGenerator: taskControlRateKey,
});
const taskControlLogsWriteLimiter = createRateLimiter({
  scope: "task_control_logs_write",
  windowMs: 60 * 1000,
  max: 120,
  blockMs: 10 * 60 * 1000,
  keyGenerator: taskControlRateKey,
});
const taskControlLogsClearLimiter = createRateLimiter({
  scope: "task_control_logs_clear",
  windowMs: 60 * 1000,
  max: 10,
  blockMs: 10 * 60 * 1000,
  keyGenerator: taskControlRateKey,
});

const URL_IN_LOG_PATTERN = /\b(?:wss?|https?):\/\/[^\s)]+/gi;
const TOKEN_KV_IN_LOG_PATTERN =
  /((?:["'])?(?:token|gameToken|actualToken|accessToken|refreshToken|authorization|cookie)(?:["'])?\s*[:=]\s*(?:["'])?)([^"'\s,;&]+)/gi;
const TOKEN_QUERY_IN_LOG_PATTERN =
  /([?&](?:p|token|gameToken|actualToken|accessToken|refreshToken|authorization|cookie)=)([^&\s]+)/gi;
const ENCODED_TOKEN_QUERY_IN_LOG_PATTERN =
  /((?:%3[Ff]|%26)(?:p|token|gameToken|actualToken|accessToken|refreshToken|authorization|cookie)(?:=|%3[Dd]))([^&\s]+)/gi;
const BEARER_IN_LOG_PATTERN = /(Bearer\s+)([A-Za-z0-9._~-]+)/gi;
const JWT_IN_LOG_PATTERN =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g;

const sanitizeTaskControlLogMessage = (message) => {
  let text = sanitizeForLog(message ?? "");
  text = text.replace(URL_IN_LOG_PATTERN, (matched) => redactUrl(matched));
  text = text.replace(TOKEN_QUERY_IN_LOG_PATTERN, "$1***");
  text = text.replace(ENCODED_TOKEN_QUERY_IN_LOG_PATTERN, "$1***");
  text = text.replace(TOKEN_KV_IN_LOG_PATTERN, "$1***");
  text = text.replace(BEARER_IN_LOG_PATTERN, "$1***");
  text = text.replace(JWT_IN_LOG_PATTERN, "***");
  return text;
};

router.use(authRequired);

router.get("/task-control/state", taskControlReadLimiter, (req, res) => {
  const row = taskControlRepository.findStateByUser(req.auth.user.id);

  if (!row) {
    return res.json({
      success: true,
      data: {
        tasks: [],
        updatedAt: null,
      },
    });
  }

  const parsed = parseTaskControlRowsFromPayload(row.payloadJson);

  return res.json({
    success: true,
    data: {
      tasks: parsed,
      updatedAt: row.updatedAt,
    },
  });
});

router.put(
  "/task-control/state",
  taskControlStateWriteLimiter,
  validateRequest({ body: taskControlStateBodySchema }),
  (req, res) => {
  const tasks = req.body.tasks;
  let payloadJson = "";
  try {
    payloadJson = JSON.stringify({ tasks });
  } catch {
    return res.status(400).json({ success: false, message: "任务状态数据无效" });
  }

  if (payloadJson.length > STATE_MAX_LENGTH) {
    return res.status(400).json({ success: false, message: "任务状态数据过大" });
  }

  const ts = nowIso();
  taskControlRepository.upsertState({
    userId: req.auth.user.id,
    payloadJson,
    createdAt: ts,
    updatedAt: ts,
  });

  return res.json({
    success: true,
    message: "任务状态保存成功",
    data: { updatedAt: ts },
  });
  },
);

router.get(
  "/task-control/logs",
  taskControlReadLimiter,
  validateRequest({ query: taskControlLogsQuerySchema }),
  (req, res) => {
  const limit = Number(req.query.limit);

  const rows = taskControlRepository.listLogsByUser({
    userId: req.auth.user.id,
    limit,
  });

  return res.json({ success: true, data: rows });
  },
);

router.post(
  "/task-control/logs",
  taskControlLogsWriteLimiter,
  validateRequest({ body: taskControlLogBodySchema }),
  (req, res) => {
  const {
    taskId,
    taskName,
    status,
    message,
  } = req.body;
  const sanitizedMessage = sanitizeTaskControlLogMessage(message).trim();

  taskControlRepository.createLog({
    id: randomId("tc_log"),
    userId: req.auth.user.id,
    taskId: taskId || null,
    taskName: taskName.slice(0, TASK_NAME_MAX_LENGTH),
    status: status || "info",
    message: sanitizedMessage.slice(0, MESSAGE_MAX_LENGTH),
    createdAt: nowIso(),
  });

  return res.json({ success: true, message: "日志已写入" });
  },
);

router.delete("/task-control/logs", taskControlLogsClearLimiter, (req, res) => {
  taskControlRepository.clearLogsByUser(req.auth.user.id);
  return res.json({ success: true, message: "日志已清空" });
});

export default router;
