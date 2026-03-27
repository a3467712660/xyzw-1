import { loadBinBuffer } from "@/utils/binStorage";
import { transformToken } from "@/utils/token";
import {
  getConnectionMonitorStats,
  getExpiredConnectionMonitorEntries,
} from "@/services/token/tokenMaintenanceLogic";
import { fetchTokenPayloadFromUrl } from "@/services/tokenImport/tokenRemoteSource";

interface RefLike<T> {
  value: T;
}

interface AttemptTokenRefreshDeps {
  tokenId: string;
  forceReconnect?: boolean;
  tokenRefreshAttempts: RefLike<Record<string, number>>;
  gameTokens: RefLike<any[]>;
  wsConnections: RefLike<Record<string, any>>;
  updateToken: (tokenId: string, updates: Record<string, any>) => boolean;
  markBinSourceState: (
    tokenId: string,
    state: "available" | "missing",
  ) => boolean;
  selectToken: (tokenId: string, forceReconnect?: boolean) => any;
  getCurrentPath: () => string;
  logger: {
    warn: (...args: any[]) => void;
    info: (...args: any[]) => void;
    error: (...args: any[]) => void;
  };
}

export const attemptTokenRefreshById = async ({
  tokenId,
  forceReconnect = false,
  tokenRefreshAttempts,
  gameTokens,
  wsConnections,
  updateToken,
  markBinSourceState,
  selectToken,
  getCurrentPath,
  logger,
}: AttemptTokenRefreshDeps) => {
  const lastAttempt = tokenRefreshAttempts.value[tokenId] || 0;
  const now = Date.now();
  if (now - lastAttempt < 10000) {
    logger.warn(`Token刷新过于频繁，跳过 [${tokenId}]`);
    return false;
  }
  tokenRefreshAttempts.value[tokenId] = now;

  const gameToken = gameTokens.value.find((t) => t.id === tokenId);
  if (!gameToken) {
    return false;
  }

  logger.info(`尝试自动刷新Token [${tokenId}]`);
  let refreshSuccess = false;

  try {
    if (gameToken.importMethod === "url" && gameToken.sourceUrl) {
      const data = await fetchTokenPayloadFromUrl(gameToken.sourceUrl, {
        trustedOnly: true,
        useProxy: true,
      });
      updateToken(tokenId, {
        ...gameToken,
        token: data.token,
        server: data.server || gameToken.server,
      });
      logger.info(`从URL获取token成功: ${gameToken.name}`);
      refreshSuccess = true;
    } else if (
      gameToken.importMethod === "bin" ||
      gameToken.importMethod === "wxQrcode"
    ) {
      const userToken = await loadBinBuffer(tokenId, [gameToken.name]);

      if (userToken) {
        const token = await transformToken(userToken);
        updateToken(tokenId, {
          ...gameToken,
          token,
          binSourceState: "available",
          binSourceMissingAt: null,
        });
        refreshSuccess = true;
      } else {
        markBinSourceState(tokenId, "missing");
        logger.error(`Token刷新失败: 未找到BIN数据 [${tokenId}]`);
      }
    }
  } catch (error) {
    logger.error(`Token刷新过程出错 [${tokenId}]:`, error);
  }

  if (!refreshSuccess) {
    logger.error(`Token刷新失败，请手动重新导入 [${tokenId}]`);
    return false;
  }

  logger.info(`Token刷新成功 [${tokenId}]`);

  const currentPath = getCurrentPath();
  const shouldReconnect =
    forceReconnect ||
    currentPath === "/tokens" ||
    currentPath === "/admin/game-features";

  if (shouldReconnect) {
    logger.info(`触发自动重连 [${tokenId}]`);
    if (wsConnections.value[tokenId]) {
      wsConnections.value[tokenId].reconnectAttempts = 0;
    }
    selectToken(tokenId, true);
  }

  return true;
};

interface ConnectionMonitorDeps {
  wsConnections: RefLike<Record<string, any>>;
  connectionLocks: RefLike<Record<string, any>>;
  activeConnections: RefLike<Record<string, any>>;
  closeWebSocketConnectionAsync: (tokenId: string) => Promise<any>;
  clearCrossTabConnectionState: (args: {
    tokenId: string;
    activeConnections: RefLike<Record<string, any>>;
  }) => void;
  logger: {
    warn: (...args: any[]) => void;
    debug: (...args: any[]) => void;
    info: (...args: any[]) => void;
  };
}

export const createConnectionMonitor = ({
  wsConnections,
  connectionLocks,
  activeConnections,
  closeWebSocketConnectionAsync,
  clearCrossTabConnectionState,
  logger,
}: ConnectionMonitorDeps) => ({
  startMonitoring: () => {
    setInterval(() => {
      const {
        staleHeartbeatTokenIds,
        expiredLockTokenIds,
        expiredCrossTabTokenIds,
      } = getExpiredConnectionMonitorEntries(
        wsConnections.value,
        connectionLocks.value,
        activeConnections.value,
      );

      staleHeartbeatTokenIds.forEach((tokenId) => {
        logger.warn(`检测到连接可能已断开: ${tokenId}`);
        wsConnections.value[tokenId]?.client?.sendHeartbeat?.();
      });

      expiredLockTokenIds.forEach((tokenId) => {
        delete connectionLocks.value[tokenId];
        logger.debug(`清理过期连接锁: ${tokenId}`);
      });

      expiredCrossTabTokenIds.forEach((tokenId) => {
        logger.debug(`清理过期跨标签页状态: ${tokenId}`);
        clearCrossTabConnectionState({ tokenId, activeConnections });
      });
    }, 10000);
  },

  getStats: () => {
    return getConnectionMonitorStats(
      wsConnections.value,
      connectionLocks.value,
      activeConnections.value,
    );
  },

  forceCleanup: async () => {
    logger.info("开始强制清理所有连接...");

    await Promise.all(
      Object.keys(wsConnections.value).map((tokenId) =>
        closeWebSocketConnectionAsync(tokenId),
      ),
    );

    Object.keys(activeConnections.value).forEach((tokenId) => {
      clearCrossTabConnectionState({ tokenId, activeConnections });
    });

    logger.info("强制清理完成");
  },
});
