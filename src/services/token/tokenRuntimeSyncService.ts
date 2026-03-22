import type { Ref } from "vue";

import { generateRandomSeed } from "@/utils/randomSeed";
import type { XyzwWebSocketClient } from "@/utils/xyzwWebSocket";

interface WebSocketConnectionState {
  status: "connecting" | "connected" | "disconnected" | "error";
  client: XyzwWebSocketClient | null;
  lastError: { timestamp: string; error: string } | null;
  tokenId: string;
  sessionId: string;
  createdAt: string;
  lastMessageAt: string | null;
  randomSeedSynced?: boolean;
  lastRandomSeedSource?: number | null;
  lastRandomSeed?: number | null;
}

interface WebCtx {
  [tokenId: string]: Partial<WebSocketConnectionState>;
}

const readStatisticsValue = (stats: any, key: string) => {
  if (!stats)
    return undefined;
  try {
    if (typeof stats.get === "function") {
      return stats.get(key);
    }
    if (Object.prototype.hasOwnProperty.call(stats, key)) {
      return stats[key];
    }
  } catch (error) {
    return undefined;
  }
  return undefined;
};

export const extractLastLoginTimestamp = (payload: any) => {
  if (!payload)
    return null;

  const candidateSources = [
    payload?.role?.statistics,
    payload?.statistics,
    payload?.role?.statisticsTime,
    payload?.statisticsTime,
  ];

  const candidateKeys = [
    "last:login:time",
    "lastLoginTime",
    "last_login_time",
  ];

  for (const stats of candidateSources) {
    if (!stats)
      continue;
    for (const key of candidateKeys) {
      const value = readStatisticsValue(stats, key);
      if (value !== undefined && value !== null) {
        const numeric = Number(value);
        if (!Number.isNaN(numeric) && numeric > 0) {
          return numeric;
        }
      }
    }
  }
  return null;
};

export function syncRandomSeedFromStatisticsById({
  tokenId,
  rolePayload,
  client,
  wsConnections,
  logger,
}: {
  tokenId: string;
  rolePayload: any;
  client: XyzwWebSocketClient | null;
  wsConnections: Ref<WebCtx>;
  logger: { info: (...args: any[]) => void; error: (...args: any[]) => void };
}) {
  if (!client)
    return;

  const connection = wsConnections.value[tokenId];
  if (!connection || connection.status !== "connected") {
    return;
  }

  const lastLoginTime = extractLastLoginTimestamp(rolePayload);
  if (!lastLoginTime) {
    return;
  }

  if (
    connection.randomSeedSynced
    && connection.lastRandomSeedSource === lastLoginTime
  ) {
    return;
  }

  const randomSeed = generateRandomSeed(lastLoginTime);

  try {
    client.send("system_custom", {
      key: "randomSeed",
      value: randomSeed,
    });
    connection.randomSeedSynced = true;
    connection.lastRandomSeedSource = lastLoginTime;
    connection.lastRandomSeed = randomSeed;
    logger.info(`同步 randomSeed [${tokenId}]`, {
      lastLoginTime,
      randomSeed,
    });
  } catch (error) {
    logger.error(`发送 randomSeed 失败 [${tokenId}]`, error);
  }
}
