import { stopScheduledJobs, syncScheduledJobs } from "../services/taskService.js";
import { cleanupExpiredTrialUserCaches } from "../services/binStorageService.js";
import { startLogCleanupJob } from "../services/logCleanupService.js";
import { startTaskControlSchedulerJob } from "../services/taskControlSchedulerService.js";
import { securityRateLimitRepository } from "../repositories/securityRateLimitRepository.js";

const TRIAL_CACHE_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

function startTrialCacheCleanupJob({
  cleanupExpiredTrialUserCachesFn = cleanupExpiredTrialUserCaches,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  consoleRef = console,
} = {}) {
  const runCleanup = async () => {
    try {
      const result = await cleanupExpiredTrialUserCachesFn();
      if (result.clearedUsers > 0) {
        consoleRef.log(
          `[trial-cache-cleanup] cleared=${result.clearedUsers}, files=${result.removedFiles}, dirs=${result.removedDirs}, scanned=${result.scannedUsers}`,
        );
      }
    } catch (error) {
      consoleRef.error("[trial-cache-cleanup] failed:", error.message);
    }
  };

  runCleanup();
  const timer = setIntervalFn(runCleanup, TRIAL_CACHE_CLEANUP_INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return {
    stop: () => clearIntervalFn(timer),
  };
}

function startRateLimitCleanupJob({
  securityRateLimitRepositoryRef = securityRateLimitRepository,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  consoleRef = console,
} = {}) {
  const runCleanup = () => {
    try {
      const cleanupBefore = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      securityRateLimitRepositoryRef.cleanupAllExpired(cleanupBefore);
    } catch (error) {
      consoleRef.error("[rate-limit-cleanup] failed:", error.message);
    }
  };

  runCleanup();
  const timer = setIntervalFn(runCleanup, RATE_LIMIT_CLEANUP_INTERVAL_MS);
  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return {
    stop: () => clearIntervalFn(timer),
  };
}

export function startBackgroundJobs({
  syncScheduledJobsFn = syncScheduledJobs,
  stopScheduledJobsFn = stopScheduledJobs,
  cleanupExpiredTrialUserCachesFn = cleanupExpiredTrialUserCaches,
  startLogCleanupJobFn = startLogCleanupJob,
  startTaskControlSchedulerJobFn = startTaskControlSchedulerJob,
  securityRateLimitRepositoryRef = securityRateLimitRepository,
  setIntervalFn = setInterval,
  clearIntervalFn = clearInterval,
  consoleRef = console,
} = {}) {
  syncScheduledJobsFn();

  const trialCacheCleanup = startTrialCacheCleanupJob({
    cleanupExpiredTrialUserCachesFn,
    setIntervalFn,
    clearIntervalFn,
    consoleRef,
  });
  const rateLimitCleanup = startRateLimitCleanupJob({
    securityRateLimitRepositoryRef,
    setIntervalFn,
    clearIntervalFn,
    consoleRef,
  });
  const logCleanup = startLogCleanupJobFn();
  const taskControlScheduler = startTaskControlSchedulerJobFn();

  return {
    trialCacheCleanup,
    rateLimitCleanup,
    logCleanup,
    taskControlScheduler,
    stopAll: async ({ schedulerGraceMs = 5000 } = {}) => {
      trialCacheCleanup?.stop?.();
      rateLimitCleanup?.stop?.();
      logCleanup?.stop?.();
      taskControlScheduler?.stop?.();
      stopScheduledJobsFn();
      if (typeof taskControlScheduler?.waitForIdle === "function") {
        await taskControlScheduler.waitForIdle(schedulerGraceMs);
      }
    },
  };
}
