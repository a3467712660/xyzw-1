import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";
import { requirePermission } from "../middleware/permission.js";
import { nowIso, randomId } from "../db/sql.js";
import { recordAdminAudit } from "../services/adminAuditService.js";
import { createUserNotification } from "../services/notificationService.js";
import { sendFeedbackResolvedEmail } from "../services/emailService.js";
import { ticketRepository } from "../repositories/ticketRepository.js";

const router = Router();
const FEEDBACK_STATUSES = new Set(["open", "in_progress", "resolved"]);
const feedbackIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});
const createFeedbackBodySchema = z.object({
  type: z.enum(["bug", "feature", "other"]).optional().default("other"),
  title: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(4000),
}).strict();
const updateFeedbackBodySchema = z.object({
  status: z.enum(["open", "in_progress", "resolved"]),
  adminNote: z.string().trim().max(2000).optional().default(""),
}).strict();
const feedbackRateKey = (req) => `${req.auth?.user?.id || "anonymous"}:${req.ip || "anonymous"}`;
const feedbackReadLimiter = createRateLimiter({
  scope: "feedback_read",
  windowMs: 60 * 1000,
  max: 120,
  blockMs: 5 * 60 * 1000,
  keyGenerator: feedbackRateKey,
});
const feedbackCreateLimiter = createRateLimiter({
  scope: "feedback_create",
  windowMs: 10 * 60 * 1000,
  max: 8,
  blockMs: 30 * 60 * 1000,
  keyGenerator: feedbackRateKey,
});
const feedbackAdminUpdateLimiter = createRateLimiter({
  scope: "feedback_admin_update",
  windowMs: 60 * 1000,
  max: 40,
  blockMs: 10 * 60 * 1000,
  keyGenerator: feedbackRateKey,
});

const reqMeta = (req) => ({
  ip: String(req.ip || ""),
  userAgent: String(req.headers["user-agent"] || ""),
});

router.use(authRequired);

router.get("/feedbacks", feedbackReadLimiter, (req, res) => {
  const status = String(req.query?.status || "").trim();
  const shouldFilterStatus = status && FEEDBACK_STATUSES.has(status);
  const isAdmin = Boolean(req.auth?.user?.isAdmin);

  const rows = ticketRepository.list({
    isAdmin,
    userId: req.auth.user.id,
    status: shouldFilterStatus ? status : "",
  });

  return res.json({ success: true, data: rows });
});

router.post(
  "/feedbacks",
  feedbackCreateLimiter,
  validateRequest({ body: createFeedbackBodySchema }),
  (req, res) => {
  const { type, title, content } = req.body;

  const id = randomId("fb");
  const timestamp = nowIso();

  ticketRepository.create({
    id,
    userId: req.auth.user.id,
    type,
    title,
    content,
    createdAt: timestamp,
    updatedAt: timestamp,
  });

  return res.json({ success: true, message: "反馈提交成功" });
  },
);

router.patch(
  "/feedbacks/:id",
  feedbackAdminUpdateLimiter,
  validateRequest({ params: feedbackIdParamSchema, body: updateFeedbackBodySchema }),
  requirePermission(
    (req) => req.auth?.user?.isAdmin,
    { message: "需要管理员权限", code: "AUTH_ADMIN_REQUIRED" },
  ),
  async (req, res) => {
    const id = req.params.id;
    const target = ticketRepository.findByIdWithOwner(id);

    if (!target) {
      return res.status(404).json({ success: false, message: "反馈不存在" });
    }

    const { status, adminNote } = req.body;

    const timestamp = nowIso();
    const resolvedBy = status === "resolved" ? req.auth.user.id : null;
    const resolvedAt = status === "resolved" ? timestamp : null;

    ticketRepository.updateStatus({
      id,
      status,
      adminNote,
      resolvedBy,
      resolvedAt,
      updatedAt: timestamp,
    });

    recordAdminAudit({
      adminUserId: req.auth.user.id,
      action: "update_feedback_status",
      targetType: "feedback",
      targetId: id,
      detail: {
        title: target.title,
        previousStatus: target.status,
        nextStatus: status,
        adminNote: adminNote || null,
        feedbackOwnerId: target.userId,
      },
      ...reqMeta(req),
    });

    if (target.userId && status === "resolved" && target.status !== "resolved") {
      createUserNotification({
        userId: target.userId,
        type: "feedback_resolved",
        title: "你的反馈已处理完成",
        content: `反馈《${target.title}》已由管理员处理并标记为已完成。`,
        payload: {
          feedbackId: id,
          status,
          adminNote: adminNote || null,
        },
      });

      const mailResult = await sendFeedbackResolvedEmail({
        to: target.ownerEmail,
        username: target.ownerUsername,
        feedbackTitle: target.title,
        adminNote,
      });

      if (!mailResult.success && !mailResult.skipped) {
        // eslint-disable-next-line no-console
        console.warn(
          `[feedback-email] failed feedbackId=${id}: ${mailResult.message || "unknown error"}`,
        );
      }
    }

    return res.json({ success: true, message: "反馈状态已更新" });
  },
);

export default router;
