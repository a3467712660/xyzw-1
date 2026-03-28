import { sanitizeNotificationPayloadForClient } from "./notificationPayloadSanitizer.js";

const parseNotificationPayloadJson = (payloadJson) => {
  try {
    return payloadJson ? JSON.parse(payloadJson) : {};
  } catch {
    return {};
  }
};

export const serializeNotificationRowForClient = (row = {}) => {
  const parsedPayload = parseNotificationPayloadJson(row.payloadJson);
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    content: row.content,
    isRead: Number(row.isRead) === 1,
    readAt: row.readAt,
    createdAt: row.createdAt,
    payload: sanitizeNotificationPayloadForClient(parsedPayload),
  };
};
