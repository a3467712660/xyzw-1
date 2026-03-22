import test from "node:test";
import assert from "node:assert/strict";

import {
  getConnectionMonitorStats,
  getExpiredConnectionMonitorEntries,
} from "../../src/services/token/tokenMaintenanceLogic.js";

test("getConnectionMonitorStats summarizes statuses and duplicates", () => {
  const stats = getConnectionMonitorStats(
    {
      a1: { status: "connected", tokenId: "token-a" },
      a2: { status: "connected", tokenId: "token-a" },
      b1: { status: "connecting", tokenId: "token-b" },
      c1: { status: "error", tokenId: "token-c" },
      d1: { status: "disconnected", tokenId: "token-d" },
    },
    {
      lock1: { timestamp: 1 },
      lock2: { timestamp: 2 },
    },
    {
      tab1: { timestamp: 1 },
    },
  );

  assert.deepEqual(stats, {
    totalConnections: 5,
    connectedCount: 2,
    connectingCount: 1,
    disconnectedCount: 1,
    errorCount: 1,
    duplicateTokens: ["token-a"],
    activeLocks: 2,
    crossTabStates: 1,
  });
});

test("getExpiredConnectionMonitorEntries identifies stale heartbeats and expired states", () => {
  const now = Date.parse("2026-03-13T12:00:00.000Z");
  const expired = getExpiredConnectionMonitorEntries(
    {
      stale: {
        status: "connected",
        connectedAt: "2026-03-13T11:59:20.000Z",
      },
      fresh: {
        status: "connected",
        lastMessage: { timestamp: "2026-03-13T11:59:50.000Z" },
        connectedAt: "2026-03-13T11:59:00.000Z",
      },
      idleDisconnected: {
        status: "disconnected",
        connectedAt: "2026-03-13T11:00:00.000Z",
      },
    },
    {
      expiredLock: { timestamp: now - 600001 },
      freshLock: { timestamp: now - 1000 },
    },
    {
      expiredTab: { timestamp: now - 300001 },
      freshTab: { timestamp: now - 1000 },
    },
    now,
  );

  assert.deepEqual(expired, {
    staleHeartbeatTokenIds: ["stale"],
    expiredLockTokenIds: ["expiredLock"],
    expiredCrossTabTokenIds: ["expiredTab"],
  });
});
