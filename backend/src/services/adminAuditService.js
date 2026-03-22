import { nowIso, randomId } from "../db/sql.js";
import { adminAuditRepository } from "../repositories/adminAuditRepository.js";
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
