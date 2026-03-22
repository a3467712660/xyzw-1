import { syncScheduledJobs } from "../services/taskService.js";
import { cleanupExpiredTrialUserCaches } from "../services/binStorageService.js";
import { startLogCleanupJob } from "../services/logCleanupService.js";
import { startTaskControlSchedulerJob } from "../services/taskControlSchedulerService.js";

const TRIAL_CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

function startTrialCacheCleanupJob() {
  const runCleanup = () => {
    try {
      const result = cleanupExpiredTrialUserCaches();
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

export function startBackgroundJobs() {
  syncScheduledJobs();
  startTrialCacheCleanupJob();
  startLogCleanupJob();
  startTaskControlSchedulerJob();
}
