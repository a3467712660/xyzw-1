export function getConnectionMonitorStats(
  wsConnections,
  connectionLocks,
  activeConnections,
) {
  const duplicateTokens = [];
  const stats = {
    totalConnections: Object.keys(wsConnections).length,
    connectedCount: 0,
    connectingCount: 0,
    disconnectedCount: 0,
    errorCount: 0,
    duplicateTokens,
    activeLocks: Object.keys(connectionLocks).length,
    crossTabStates: Object.keys(activeConnections).length,
  };

  const tokenCounts = new Map();
  Object.values(wsConnections).forEach((connection) => {
    stats[`${connection.status}Count`]++;
    const count = tokenCounts.get(connection.tokenId) || 0;
    tokenCounts.set(connection.tokenId, count + 1);
    if (count > 0) {
      stats.duplicateTokens.push(connection.tokenId);
    }
  });

  return stats;
}

export function getExpiredConnectionMonitorEntries(
  wsConnections,
  connectionLocks,
  activeConnections,
  now = Date.now(),
) {
  const staleHeartbeatTokenIds = [];
  Object.entries(wsConnections).forEach(([tokenId, connection]) => {
    const lastActivity = connection.lastMessage?.timestamp || connection.connectedAt;
    if (!lastActivity || connection.status !== "connected") {
      return;
    }

    const timeSinceActivity = now - new Date(lastActivity).getTime();
    if (timeSinceActivity > 30000) {
      staleHeartbeatTokenIds.push(tokenId);
    }
  });

  const expiredLockTokenIds = Object.entries(connectionLocks)
    .filter(([, lock]) => now - lock.timestamp > 600000)
    .map(([tokenId]) => tokenId);

  const expiredCrossTabTokenIds = Object.entries(activeConnections)
    .filter(([, state]) => now - state.timestamp > 300000)
    .map(([tokenId]) => tokenId);

  return {
    staleHeartbeatTokenIds,
    expiredLockTokenIds,
    expiredCrossTabTokenIds,
  };
}
