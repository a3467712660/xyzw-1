import { nowIso, randomId } from "../db/sql.js";
import { securityEventRepository } from "../repositories/securityEventRepository.js";

const asJson = (value) => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ note: "unserializable detail" });
  }
};

export const recordSecurityEvent = ({
  userId = null,
  eventType,
  detail = {},
  ip = null,
  userAgent = null,
  createdAt,
}) => {
  if (!eventType) {
    return;
  }

  securityEventRepository.create({
    id: randomId("sec"),
    userId,
    eventType: String(eventType),
    detailJson: asJson(detail),
    ip,
    userAgent,
    createdAt: createdAt || nowIso(),
  });
};

export const parseSecurityEventDetail = (detailJson) => {
  if (!detailJson) {
    return {};
  }
  try {
    return JSON.parse(detailJson);
  } catch {
    return { raw: String(detailJson) };
  }
};
