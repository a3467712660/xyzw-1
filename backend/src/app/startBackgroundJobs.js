import { syncScheduledJobs } from "../services/taskService.js";
import { cleanupExpiredTrialUserCaches } from "../services/binStorageService.js";
import { startLogCleanupJob } from "../services/logCleanupService.js";
import { startTaskControlSchedulerJob } from "../services/taskControlSchedulerService.js";
import { securityRateLimitRepository } from "../repositories/securityRateLimitRepository.js";

const TRIAL_CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function startTrialCacheCleanupJob() {
  const runCleanup = async () => {
    try {
      const result = await cleanupExpiredTrialUserCaches();
      if (result.clearedUsers > 0) {
        // eslint-disable-next-line no-console
        console.log(
          `[trial-cache-cleanup] cleared=${result.clearedUsers}, files=${result.removedFiles}, dirs=${result.removedDirs}, scanned=${result.scannedUsers}`,
        );
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[trial-cache-cleanup] failed:", error.message);
    }
  };

  runCleanup();
  const timer = setInterval(runCleanup, TRIAL_CACHE_CLEANUP_INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

function startRateLimitCleanupJob() {
  const runCleanup = () => {
    try {
      const cleanupBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      securityRateLimitRepository.cleanupAllExpired(cleanupBefore);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error("[rate-limit-cleanup] failed:", error.message);
    }
  };

  runCleanup();
  const timer = setInterval(runCleanup, RATE_LIMIT_CLEANUP_INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

export function startBackgroundJobs() {
  syncScheduledJobs();
  startTrialCacheCleanupJob();
  startRateLimitCleanupJob();
  startLogCleanupJob();
  startTaskControlSchedulerJob();
}
