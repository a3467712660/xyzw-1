import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { startBackgroundJobs } from "../src/app/startBackgroundJobs.js";
import { env } from "../src/config/env.js";
import { scheduleDailyBackup } from "../src/db/client.js";
import { closeDatabase, getDb, initDatabase } from "../src/db/database.js";

test("startBackgroundJobs returns stoppable handles for timers and schedulers", async () => {
  const createdIntervals = [];
  const clearedIntervals = [];
  let syncScheduledJobsCalls = 0;
  let stopScheduledJobsCalls = 0;
  let trialCleanupCalls = 0;
  let rateLimitCleanupCalls = 0;
  let logCleanupStopCalls = 0;
  let schedulerStopCalls = 0;
  let schedulerWaitCalls = 0;

  const backgroundJobs = startBackgroundJobs({
    syncScheduledJobsFn: () => {
      syncScheduledJobsCalls += 1;
    },
    stopScheduledJobsFn: () => {
      stopScheduledJobsCalls += 1;
    },
    cleanupExpiredTrialUserCachesFn: async () => {
      trialCleanupCalls += 1;
      return {
        clearedUsers: 0,
        removedFiles: 0,
        removedDirs: 0,
        scannedUsers: 0,
      };
    },
    startLogCleanupJobFn: () => ({
      stop: () => {
        logCleanupStopCalls += 1;
      },
    }),
    startTaskControlSchedulerJobFn: () => ({
      stop: () => {
        schedulerStopCalls += 1;
      },
      waitForIdle: async (timeoutMs) => {
        schedulerWaitCalls += 1;
        assert.equal(timeoutMs, 1234);
        return true;
      },
    }),
    securityRateLimitRepositoryRef: {
      cleanupAllExpired: () => {
        rateLimitCleanupCalls += 1;
      },
    },
    setIntervalFn: (callback, ms) => {
      const handle = {
        callback,
        ms,
        unref() {},
      };
      createdIntervals.push(handle);
      return handle;
    },
    clearIntervalFn: (handle) => {
      clearedIntervals.push(handle);
    },
    consoleRef: {
      log: () => {},
      error: () => {},
    },
  });

  assert.equal(syncScheduledJobsCalls, 1);
  assert.equal(trialCleanupCalls, 1);
  assert.equal(rateLimitCleanupCalls, 1);
  assert.equal(createdIntervals.length, 2);
  assert.equal(typeof backgroundJobs.stopAll, "function");

  await backgroundJobs.stopAll({ schedulerGraceMs: 1234 });

  assert.equal(stopScheduledJobsCalls, 1);
  assert.equal(logCleanupStopCalls, 1);
  assert.equal(schedulerStopCalls, 1);
  assert.equal(schedulerWaitCalls, 1);
  assert.deepEqual(clearedIntervals, createdIntervals);
});

test("scheduleDailyBackup exposes a stoppable handle and closeDatabase is reentrant", async (t) => {
  const originalDbPath = env.dbPath;
  const originalBackupEnabled = env.appDbBackupEnabled;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xyzw-background-lifecycle-"));

  env.dbPath = path.join(tempDir, "lifecycle.sqlite.bin");
  env.appDbBackupEnabled = true;

  t.after(() => {
    try {
      closeDatabase();
    } catch {
      // ignore cleanup failure in tests
    }
    env.dbPath = originalDbPath;
    env.appDbBackupEnabled = originalBackupEnabled;
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  await initDatabase();

  const backupHandle = scheduleDailyBackup();
  assert.ok(backupHandle);
  assert.equal(backupHandle.isScheduled(), true);

  backupHandle.stop();
  assert.equal(backupHandle.isScheduled(), false);

  assert.doesNotThrow(() => getDb());
  closeDatabase();
  closeDatabase();
  assert.throws(() => getDb(), /Database not initialized/);

  await initDatabase();
  assert.doesNotThrow(() => getDb());
});
