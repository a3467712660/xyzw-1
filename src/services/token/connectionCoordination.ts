interface LockRecord {
  tokenId: string;
  operation: string;
  timestamp: number;
  sessionId: string;
}

interface CrossTabState {
  action: string;
  sessionId: string;
  timestamp: number;
  url: string;
}

interface LoggerLike {
  debug: (message: string, ...args: any[]) => void;
  warn: (message: string, ...args: any[]) => void;
  info: (message: string, ...args: any[]) => void;
  connectionLock: (tokenId: string, operation: string, locked: boolean) => void;
}

const WS_CONNECTION_PREFIX = "ws_connection_";
const ACTIVE_WINDOW_MS = 30_000;

export const generateSessionId = () =>
  `session_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

export const getCrossTabStorageKey = (tokenId: string) =>
  `${WS_CONNECTION_PREFIX}${tokenId}`;

export const readCrossTabConnectionState = (tokenId: string) => {
  const storageKey = getCrossTabStorageKey(tokenId);
  const stored = localStorage.getItem(storageKey);
  if (!stored) {
    return null;
  }

  try {
    return JSON.parse(stored) as CrossTabState;
  } catch {
    return null;
  }
};

export const writeCrossTabConnectionState = ({
  tokenId,
  action,
  sessionId,
  activeConnections,
}: {
  tokenId: string;
  action: string;
  sessionId: string;
  activeConnections: { value: Record<string, unknown> };
}) => {
  const state: CrossTabState = {
    action,
    sessionId,
    timestamp: Date.now(),
    url: window.location.href,
  };
  localStorage.setItem(getCrossTabStorageKey(tokenId), JSON.stringify(state));
  activeConnections.value[tokenId] = state;
  return state;
};

export const clearCrossTabConnectionState = ({
  tokenId,
  activeConnections,
}: {
  tokenId: string;
  activeConnections: { value: Record<string, unknown> };
}) => {
  delete activeConnections.value[tokenId];
  localStorage.removeItem(getCrossTabStorageKey(tokenId));
};

export const hasRecentForeignConnection = ({
  tokenId,
  currentSessionId,
}: {
  tokenId: string;
  currentSessionId: string;
}) => {
  const state = readCrossTabConnectionState(tokenId);
  if (!state) {
    return null;
  }

  const isRecent = Date.now() - Number(state.timestamp || 0) < ACTIVE_WINDOW_MS;
  const isDifferentSession = state.sessionId !== currentSessionId;

  if (
    isRecent
    && isDifferentSession
    && (state.action === "connecting" || state.action === "connected")
  ) {
    return state;
  }

  return null;
};

export const createConnectionLockHelpers = ({
  connectionLocks,
  logger,
  currentSessionId,
}: {
  connectionLocks: { value: Record<string, Partial<LockRecord>> };
  logger: LoggerLike;
  currentSessionId: string;
}) => {
  const acquireConnectionLock = async (
    tokenId: string,
    operation = "connect",
  ) => {
    const lockKey = `${tokenId}_${operation}`;
    const locks = connectionLocks.value;

    if (locks[lockKey]) {
      logger.debug(`等待连接锁释放: ${tokenId} (${operation})`);
      let attempts = 0;
      while (locks[lockKey] && attempts < 100) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        attempts++;
      }
      if (locks[lockKey]) {
        logger.warn(`连接锁等待超时: ${tokenId} (${operation})`);
        return false;
      }
    }

    locks[lockKey] = {
      tokenId,
      operation,
      timestamp: Date.now(),
      sessionId: currentSessionId,
    };
    logger.connectionLock(tokenId, operation, true);
    return true;
  };

  const releaseConnectionLock = (tokenId: string, operation = "connect") => {
    const lockKey = `${tokenId}_${operation}`;
    if (connectionLocks.value[lockKey]) {
      delete connectionLocks.value[lockKey];
      logger.connectionLock(tokenId, operation, false);
    }
  };

  return {
    acquireConnectionLock,
    releaseConnectionLock,
  };
};

export const subscribeCrossTabConnectionEvents = ({
  currentSessionId,
  wsConnections,
  onRemoteConnected,
  logger,
}: {
  currentSessionId: string;
  wsConnections: { value: Record<string, any> };
  onRemoteConnected: (tokenId: string) => void;
  logger: Pick<LoggerLike, "debug" | "info" | "warn">;
}) => {
  const handler = (event: StorageEvent) => {
    if (!event.key?.startsWith(WS_CONNECTION_PREFIX)) {
      return;
    }

    const tokenId = event.key.replace(WS_CONNECTION_PREFIX, "");
    logger.debug(`检测到跨标签页连接状态变化: ${tokenId}`, event.newValue);

    if (!event.newValue) {
      return;
    }

    try {
      const newState = JSON.parse(event.newValue) as CrossTabState;
      const localConnection = wsConnections.value[tokenId];

      if (
        newState.action === "connected"
        && newState.sessionId !== currentSessionId
        && localConnection?.status === "connected"
      ) {
        logger.info(`检测到其他标签页已连接同一token，关闭本地连接: ${tokenId}`);
        onRemoteConnected(tokenId);
      }
    } catch (error) {
      logger.warn("解析跨标签页状态失败:", error);
    }
  };

  window.addEventListener("storage", handler);
  return () => window.removeEventListener("storage", handler);
};
