import { nowIso, randomId } from "../db/sql.js";
import { adminAuditRepository } from "../repositories/adminAuditRepository.js";
import { createUserNotification } from "./notificationService.js";
import { recordSecurityEvent } from "./securityEventService.js";

const asJson = (value) => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ note: "unserializable detail" });
  }
};

export const recordAdminAudit = ({
  adminUserId,
  action,
  targetType,
  targetId = null,
  detail = {},
  ip = null,
  userAgent = null,
}) => {
  if (!adminUserId || !action || !targetType) {
    return;
  }

  adminAuditRepository.create({
    id: randomId("audit"),
    adminUserId,
    action,
    targetType,
    targetId,
    detailJson: asJson(detail),
    ip,
    userAgent,
    createdAt: nowIso(),
  });
  createUserNotification({
    userId: adminUserId,
    type: "security",
    title: "已执行管理员高敏操作",
    content: `操作：${action}${targetType ? `，对象：${targetType}` : ""}${targetId ? `（${targetId}）` : ""}`,
    payload: {
      action,
      targetType,
      targetId,
      detail,
    },
  });
  recordSecurityEvent({
    userId: adminUserId,
    eventType: "admin_sensitive_action",
    detail: {
      action,
      targetType,
      targetId,
      detail,
    },
    ip,
    userAgent,
  });
};
