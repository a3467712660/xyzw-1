export function useBatchConnectionManager({
  addLog,
  batchSettings,
  tokenStore,
  tokens,
}) {
  const connectionQueue = { active: 0 };

  const waitForConnection = async (
    tokenId,
    timeout = batchSettings.connectionTimeout,
  ) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const status = tokenStore.getWebSocketStatus(tokenId);
      if (status === "connected") {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    return false;
  };

  const waitForConnectionSlot = async () => {
    while (connectionQueue.active >= batchSettings.maxActive) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    connectionQueue.active++;
  };

  const releaseConnectionSlot = () => {
    if (connectionQueue.active > 0) {
      connectionQueue.active--;
    }
  };

  const ensureConnection = async (tokenId, maxRetries = 2) => {
    const latestToken = tokens.value.find((token) => token.id === tokenId);
    if (!latestToken) {
      throw new Error(`Token not found: ${tokenId}`);
    }

    const status = tokenStore.getWebSocketStatus(tokenId);
    let connected = status === "connected";

    if (!connected) {
      await waitForConnectionSlot();

      addLog({
        time: new Date().toLocaleTimeString(),
        message: `正在连接... (队列: ${connectionQueue.active}/${batchSettings.maxActive})`,
        type: "info",
      });

      tokenStore.createWebSocketConnection(
        tokenId,
        latestToken.token,
        latestToken.wsUrl,
      );
      connected = await waitForConnection(tokenId);

      if (!connected && maxRetries > 0) {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: "连接超时，尝试重连...",
          type: "warning",
        });

        tokenStore.closeWebSocketConnection(tokenId);
        await new Promise((resolve) => setTimeout(resolve, batchSettings.reconnectDelay));

        addLog({
          time: new Date().toLocaleTimeString(),
          message: "正在重连...",
          type: "info",
        });

        const refreshedToken = tokens.value.find((token) => token.id === tokenId);
        tokenStore.createWebSocketConnection(
          tokenId,
          refreshedToken.token,
          refreshedToken.wsUrl,
        );

        connected = await waitForConnection(tokenId);
      }

      if (!connected) {
        releaseConnectionSlot();
        throw new Error("连接失败 (重试后仍超时)");
      }
    }

    try {
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "role_getroleinfo",
        {},
        5000,
      );

      const response = await tokenStore.sendMessageWithPromise(
        tokenId,
        "fight_startlevel",
        {},
        5000,
      );
      if (response?.battleData?.version) {
        tokenStore.setBattleVersion(response.battleData.version);
      }
    } catch (error) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `初始化数据失败: ${error.message}`,
        type: "warning",
      });
    }

    return true;
  };

  return {
    connectionQueue,
    ensureConnection,
    releaseConnectionSlot,
    waitForConnection,
    waitForConnectionSlot,
  };
}
