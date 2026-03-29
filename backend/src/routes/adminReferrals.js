import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { adminRequired } from "../middleware/admin.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";
import { makeSensitiveAction } from "../middleware/sensitiveAction.js";
import { nowIso } from "../db/sql.js";
import { recordAdminAudit } from "../services/adminAuditService.js";
import { referralAttributionRepository } from "../repositories/referralAttributionRepository.js";
import { referralConversionRepository } from "../repositories/referralConversionRepository.js";

const router = Router();
const SENSITIVE_ACTION_TTL_SECONDS = 5 * 60;
const SENSITIVE_ACTION_TOKEN_HEADER = "x-admin-confirm-token";
const SENSITIVE_ACTION_TOKEN_PURPOSE = "admin-sensitive-action";
const adminSensitiveAction = makeSensitiveAction({
  purpose: SENSITIVE_ACTION_TOKEN_PURPOSE,
  ttlSeconds: SENSITIVE_ACTION_TTL_SECONDS,
  headerName: SENSITIVE_ACTION_TOKEN_HEADER,
  codePrefix: "ADMIN_CONFIRM",
  requiredMessage: "高危操作需要二次确认，请先验证当前密码",
});
const sensitiveActionRequired = adminSensitiveAction.required;
const adminRateKey = (req) => `${req.auth?.user?.id || "anonymous"}:${req.ip || "anonymous"}`;
const adminApiLimiter = createRateLimiter({
  scope: "admin_referral_api",
  windowMs: 60 * 1000,
  max: 120,
  blockMs: 5 * 60 * 1000,
  keyGenerator: adminRateKey,
});
const adminWriteLimiter = createRateLimiter({
  scope: "admin_referral_write",
  windowMs: 60 * 1000,
  max: 40,
  blockMs: 10 * 60 * 1000,
  keyGenerator: adminRateKey,
});
const referralListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional().default(200),
}).strict();
const conversionIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});
const markPaidBodySchema = z.object({
  note: z.string().trim().max(1000).optional().default(""),
}).strict();
const rejectBodySchema = z.object({
  note: z.string().trim().min(1).max(1000),
}).strict();

const reqMeta = (req) => ({
  ip: String(req.ip || ""),
  userAgent: String(req.headers["user-agent"] || ""),
});

router.use(authRequired, adminRequired);
router.use(adminApiLimiter);

router.get(
  "/referrals/attributions",
  validateRequest({ query: referralListQuerySchema }),
  (req, res) => {
    const rows = referralAttributionRepository.listForAdmin(req.query.limit);
    return res.json({
      success: true,
      data: rows,
    });
  },
);

router.get(
  "/referrals/conversions",
  validateRequest({ query: referralListQuerySchema }),
  (req, res) => {
    const rows = referralConversionRepository.listForAdmin(req.query.limit);
    return res.json({
      success: true,
      data: rows,
    });
  },
);

router.post(
  "/referrals/conversions/:id/mark-paid",
  adminWriteLimiter,
  sensitiveActionRequired,
  validateRequest({ params: conversionIdParamSchema, body: markPaidBodySchema }),
  (req, res) => {
    const current = referralConversionRepository.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: "返佣台账不存在" });
    }
    if (current.rewardStatus !== "pending") {
      return res.status(400).json({ success: false, message: "只有待结算台账可标记为已结算" });
    }

    const timestamp = nowIso();
    const note = String(req.body?.note || "").trim() || current.note || "";
    referralConversionRepository.markPaid({
      id: current.id,
      note,
      paidAt: timestamp,
      paidBy: req.auth.user.id,
      updatedAt: timestamp,
    });

    const updated = referralConversionRepository.findById(current.id);
    recordAdminAudit({
      adminUserId: req.auth.user.id,
      action: "mark_referral_conversion_paid",
      targetType: "referral_conversion",
      targetId: current.id,
      detail: {
        previousStatus: current.rewardStatus,
        currentStatus: updated?.rewardStatus || "paid",
        rewardAmountCents: current.rewardAmountCents,
        note: note || null,
      },
      ...reqMeta(req),
    });

    return res.json({
      success: true,
      message: "返佣台账已标记为已结算",
      data: updated,
    });
  },
);

router.post(
  "/referrals/conversions/:id/reject",
  adminWriteLimiter,
  sensitiveActionRequired,
  validateRequest({ params: conversionIdParamSchema, body: rejectBodySchema }),
  (req, res) => {
    const current = referralConversionRepository.findById(req.params.id);
    if (!current) {
      return res.status(404).json({ success: false, message: "返佣台账不存在" });
    }
    if (current.rewardStatus !== "pending") {
      return res.status(400).json({ success: false, message: "只有待结算台账可拒绝" });
    }

    const timestamp = nowIso();
    const note = String(req.body?.note || "").trim();
    referralConversionRepository.reject({
      id: current.id,
      note,
      updatedAt: timestamp,
    });

    const updated = referralConversionRepository.findById(current.id);
    recordAdminAudit({
      adminUserId: req.auth.user.id,
      action: "reject_referral_conversion",
      targetType: "referral_conversion",
      targetId: current.id,
      detail: {
        previousStatus: current.rewardStatus,
        currentStatus: updated?.rewardStatus || "rejected",
        rewardAmountCents: current.rewardAmountCents,
        note,
      },
      ...reqMeta(req),
    });

    return res.json({
      success: true,
      message: "返佣台账已拒绝",
      data: updated,
    });
  },
);

export default router;
