import { Router } from "express";
import { z } from "zod";
import cron from "node-cron";
import { authRequired } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import {
  executeTaskNow,
  listTaskHistory,
  listTasksByRole,
  syncScheduledJobsForUser,
  updateTaskConfig,
} from "../services/taskService.js";

const router = Router();
const roleIdQuerySchema = z.object({
  roleId: z.string().trim().min(1).max(64),
});
const taskIdParamSchema = z.object({
  taskId: z.string().trim().min(1).max(64),
});
const completeTaskBodySchema = z.object({
  roleId: z.string().trim().min(1).max(64),
}).strict();
const boolLikeSchema = z.union([z.boolean(), z.literal(0), z.literal(1)]);
const taskUpdateBodySchema = z.object({
  roleId: z.string().trim().min(1).max(64),
  enabled: boolLikeSchema.optional(),
  autoExecute: boolLikeSchema.optional(),
  delay: z.coerce.number().int().min(0).max(86_400).optional(),
  notification: boolLikeSchema.optional(),
  cronExpr: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .refine((value) => cron.validate(value), "cronExpr 格式无效")
    .optional(),
}).strict();
const taskHistoryQuerySchema = z.object({
  roleId: z.string().trim().min(1).max(64),
  page: z.coerce.number().int().min(1).max(10_000).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});
router.use(authRequired);

router.get("/daily-tasks", validateRequest({ query: roleIdQuerySchema }), (req, res) => {
  const { roleId } = req.query;

  const tasks = listTasksByRole(req.auth.user.id, String(roleId));
  return res.json({ success: true, data: tasks });
});

router.get("/daily-tasks/status", validateRequest({ query: roleIdQuerySchema }), (req, res) => {
  const { roleId } = req.query;

  const tasks = listTasksByRole(req.auth.user.id, String(roleId));
  const total = tasks.length;
  const completed = tasks.filter((item) => item.completed).length;

  return res.json({
    success: true,
    data: {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    },
  });
});

router.post(
  "/daily-tasks/:taskId/complete",
  validateRequest({ params: taskIdParamSchema, body: completeTaskBodySchema }),
  (req, res) => {
  const { roleId } = req.body;

  const result = executeTaskNow(
    req.auth.user.id,
    String(roleId),
    req.params.taskId,
    "manual",
  );

  return res.json(result);
},
);

router.put(
  "/daily-tasks/:taskId",
  validateRequest({ params: taskIdParamSchema, body: taskUpdateBodySchema }),
  (req, res) => {
  const { roleId } = req.body;

  const patch = {
    enabled:
      req.body.enabled === undefined ? undefined : Number(Boolean(req.body.enabled)),
    autoExecute:
      req.body.autoExecute === undefined
        ? undefined
        : Number(Boolean(req.body.autoExecute)),
    delaySeconds:
      req.body.delay === undefined ? undefined : Number(req.body.delay),
    notification:
      req.body.notification === undefined
        ? undefined
        : Number(Boolean(req.body.notification)),
    cronExpr: req.body.cronExpr,
  };

  const updated = updateTaskConfig(
    req.auth.user.id,
    String(roleId),
    req.params.taskId,
    patch,
  );

  if (!updated) {
    return res.status(404).json({ success: false, message: "任务不存在" });
  }

  syncScheduledJobsForUser(req.auth.user.id);

  return res.json({ success: true, message: "任务配置已更新" });
},
);

router.get("/daily-tasks/history", validateRequest({ query: taskHistoryQuerySchema }), (req, res) => {
  const { roleId, page, limit } = req.query;

  const rows = listTaskHistory(req.auth.user.id, String(roleId), page, limit);
  return res.json({ success: true, data: rows });
});

export default router;
