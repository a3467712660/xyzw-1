import { nowIso, randomId } from "../db/sql.js";
import { serializeNotificationRowForClient } from "../lib/notificationRowSerializer.js";
import { notificationRepository } from "../repositories/notificationRepository.js";

const asJson = (value) => {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return JSON.stringify({ note: "unserializable payload" });
  }
};

export const createUserNotification = ({
  userId,
  type = "system",
  title,
  content,
  payload = {},
}) => {
  if (!userId || !title || !content) {
    return null;
  }

  const id = randomId("ntf");
  notificationRepository.create({
    id,
    userId,
    type,
    title,
    content,
    payloadJson: asJson(payload),
    createdAt: nowIso(),
  });

  return id;
};

export const listUserNotifications = ({ userId, unreadOnly = false, limit = 50 }) => {
  if (!userId) {
    return [];
  }

  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  return notificationRepository
    .listByUser({ userId, unreadOnly, limit: safeLimit })
    .map((row) => serializeNotificationRowForClient(row));
};

export const markNotificationRead = ({ id, userId, readAt = nowIso() }) => {
  notificationRepository.markRead({ id, userId, readAt });
};

export const markAllNotificationsRead = ({ userId, readAt = nowIso() }) => {
  notificationRepository.markAllRead({ userId, readAt });
};

export const deleteAllNotifications = ({ userId }) => {
  if (!userId) {
    return 0;
  }
  return notificationRepository.deleteAllByUser({ userId });
};
