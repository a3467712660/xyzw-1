import { adminAuditRepository } from "../repositories/adminAuditRepository.js";
import { binDownloadRepository } from "../repositories/binDownloadRepository.js";
import { env } from "../config/env.js";
import { notificationRepository } from "../repositories/notificationRepository.js";
import { securityEventRepository } from "../repositories/securityEventRepository.js";
import { taskControlRepository } from "../repositories/taskControlRepository.js";
import { taskRepository } from "../repositories/taskRepository.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const CLEANUP_HOUR = env.logCleanupHour;
const CLEANUP_MINUTE = env.logCleanupMinute;

const RETENTION_DAYS = {
  taskControlLogs: env.logCleanupTaskControlDays,
  taskRuns: env.logCleanupTaskRunsDays,
  binDownloadAudits: env.logCleanupBinDownloadAuditsDays,
  binDownloadTickets: env.logCleanupBinDownloadTicketsDays,
  userReadNotifications: env.logCleanupReadNotificationsDays,
  securityEvents: env.logCleanupSecurityEventsDays,
  adminAuditLogs: env.logCleanupAdminAuditDays,
};

const cutoffIsoByDays = (days) => {
  const safeDays = Math.max(1, Number(days) || 1);
  return new Date(Date.now() - safeDays * DAY_MS).toISOString();
};

const msUntilNextCleanup = () => {
  const now = new Date();
  const next = new Date(now);
  next.setHours(CLEANUP_HOUR, CLEANUP_MINUTE, 0, 0);
  if (now >= next) {
    next.setDate(next.getDate() + 1);
  }
  return Math.max(1000, next.getTime() - now.getTime());
};

const cleanupLogsOnce = () => {
  const startAt = Date.now();
  const summary = {
    taskControlLogs: 0,
    taskRuns: 0,
    binDownloadAudits: 0,
    binDownloadTickets: 0,
    userReadNotifications: 0,
    securityEvents: 0,
    adminAuditLogs: 0,
  };

  summary.taskControlLogs = taskControlRepository.deleteLogsBefore(
    cutoffIsoByDays(RETENTION_DAYS.taskControlLogs),
  );
  summary.taskRuns = taskRepository.deleteTaskRunsBefore(
    cutoffIsoByDays(RETENTION_DAYS.taskRuns),
  );
  summary.binDownloadAudits = binDownloadRepository.deleteAuditsBefore(
    cutoffIsoByDays(RETENTION_DAYS.binDownloadAudits),
  );
  summary.binDownloadTickets = binDownloadRepository.deleteExpiredTicketsBefore(
    cutoffIsoByDays(RETENTION_DAYS.binDownloadTickets),
  );
  summary.userReadNotifications = notificationRepository.deleteReadBefore(
    cutoffIsoByDays(RETENTION_DAYS.userReadNotifications),
  );
  summary.securityEvents = securityEventRepository.deleteBefore(
    cutoffIsoByDays(RETENTION_DAYS.securityEvents),
  );
  summary.adminAuditLogs = adminAuditRepository.deleteBefore(
    cutoffIsoByDays(RETENTION_DAYS.adminAuditLogs),
  );

  const durationMs = Date.now() - startAt;
  // eslint-disable-next-line no-console
  console.log(`[log-cleanup] done in ${durationMs}ms`, summary);
};

export const startLogCleanupJob = () => {
  const run = () => {
    try {
      cleanupLogsOnce();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[log-cleanup] failed:", error.message);
    }
  };

  run();

  const firstDelay = msUntilNextCleanup();
  const firstTimer = setTimeout(() => {
    run();
    const interval = setInterval(run, DAY_MS);
    if (typeof interval.unref === "function") {
      interval.unref();
    }
  }, firstDelay);

  if (typeof firstTimer.unref === "function") {
    firstTimer.unref();
  }
};
