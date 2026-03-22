import { Router } from "express";
import { z } from "zod";
import { authRequired } from "../middleware/auth.js";
import { validateRequest } from "../middleware/validate.js";
import {
  listUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService.js";

const router = Router();
const notificationsQuerySchema = z.object({
  unreadOnly: z.union([z.literal("1"), z.literal("0"), z.string().length(0)]).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
});
const notificationIdParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});
router.use(authRequired);

router.get("/notifications", validateRequest({ query: notificationsQuerySchema }), (req, res) => {
  const unreadOnly = String(req.query?.unreadOnly || "").trim() === "1";
  const limit = Number(req.query?.limit);

  const data = listUserNotifications({
    userId: req.auth.user.id,
    unreadOnly,
    limit,
  });

  return res.json({ success: true, data });
});

router.patch("/notifications/:id/read", validateRequest({ params: notificationIdParamSchema }), (req, res) => {
  const id = req.params.id;

  markNotificationRead({ id, userId: req.auth.user.id });

  return res.json({ success: true, message: "已标记为已读" });
});

router.patch("/notifications/read-all", (req, res) => {
  markAllNotificationsRead({ userId: req.auth.user.id });

  return res.json({ success: true, message: "全部通知已标记为已读" });
});

export default router;
