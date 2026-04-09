const pickArenaTargetId = (targets) => {
  const candidate
    = targets?.rankList?.[0]
      || targets?.roleList?.[0]
      || targets?.targets?.[0]
      || targets?.targetList?.[0]
      || targets?.list?.[0];

  if (candidate?.roleId)
    return candidate.roleId;
  if (candidate?.id)
    return candidate.id;
  return targets?.roleId || targets?.id;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function useGameFeatureActions({
  message,
  router,
  t,
  tokenStore,
}) {
  const ensureSelectedTokenReady = () => {
    if (!tokenStore.selectedToken) {
      message.warning(t("gameFeatures.messages.selectTokenFirst"));
      router.push("/tokens");
      return null;
    }

    const tokenId = tokenStore.selectedToken.id;
    const status = tokenStore.getWebSocketStatus(tokenId);
    if (status !== "connected") {
      message.warning(t("gameFeatures.messages.websocketNotConnected"));
      return null;
    }

    return tokenId;
  };

  const waitForTokenConnection = async (
    tokenId,
    timeout = 8000,
    interval = 150,
  ) => {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const status = tokenStore.getWebSocketStatus(tokenId);
      if (status === "connected") {
        return true;
      }
      if (status === "error") {
        const lastError = tokenStore.wsConnections?.[tokenId]?.lastError?.error;
        throw new Error(lastError || "WebSocket connection error");
      }
      await sleep(interval);
    }

    const finalStatus = tokenStore.getWebSocketStatus(tokenId);
    if (finalStatus === "connected") {
      return true;
    }
    if (finalStatus === "error") {
      const lastError = tokenStore.wsConnections?.[tokenId]?.lastError?.error;
      throw new Error(lastError || "WebSocket connection error");
    }

    return false;
  };

  const initializeGameData = async () => {
    if (!tokenStore.selectedToken)
      return;

    const tokenId = tokenStore.selectedToken.id;

    await Promise.allSettled([
      tokenStore.sendGetRoleInfo(tokenId),
      tokenStore.ensureBattleVersion(tokenId),
    ]);
  };

  const handleFeatureAction = async (featureType) => {
    const tokenId = ensureSelectedTokenReady();
    if (!tokenId) {
      return;
    }

    const actions = {
      "team-challenge": async () => {
        message.info(t("gameFeatures.messages.teamChallengeStart"));
        let targets;
        try {
          targets = await tokenStore.sendMessageWithPromise(
            tokenId,
            "arena_getareatarget",
            {},
            8000,
          );
        } catch (err) {
          message.error(
            t("gameFeatures.messages.arenaTargetFailed", { message: err.message }),
          );
          return;
        }

        const targetId = pickArenaTargetId(targets);
        if (!targetId) {
          message.warning(t("gameFeatures.messages.noArenaTarget"));
          return;
        }

        try {
          await tokenStore.sendMessageWithPromise(
            tokenId,
            "fight_startareaarena",
            { targetId },
            15000,
          );
          message.success(t("gameFeatures.messages.arenaBattleStarted"));
        } catch (err) {
          message.error(
            t("gameFeatures.messages.arenaBattleFailed", { message: err.message }),
          );
        }
      },
      "daily-tasks": () => {
        message.info(t("gameFeatures.messages.dailyTasksStart"));
        tokenStore.sendMessage(tokenId, "task_claimdailyreward");
      },
      "salt-robot": () => {
        message.info(t("gameFeatures.messages.saltRobotClaim"));
        tokenStore.sendMessage(tokenId, "bottlehelper_claim");
      },
      "idle-time": () => {
        message.info(t("gameFeatures.messages.idleRewardClaim"));
        tokenStore.sendMessage(tokenId, "system_claimhangupreward");
      },
      "power-switch": () => {
        message.info(t("gameFeatures.messages.powerSwitchRun"));
        tokenStore.sendMessage(tokenId, "role_getroleinfo");
      },
      "club-ranking": () => {
        message.info(t("gameFeatures.messages.clubRankingSignup"));
        tokenStore.sendMessage(tokenId, "legionmatch_rolesignup");
      },
      "club-checkin": () => {
        message.info(t("gameFeatures.messages.clubCheckin"));
        tokenStore.sendMessage(tokenId, "legion_signin");
      },
      "tower-challenge": () => {
        message.info(t("gameFeatures.messages.towerStart"));
        tokenStore.sendMessage(tokenId, "fight_starttower");
      },
    };

    const action = actions[featureType];
    if (action) {
      await action();
      return;
    }

    message.warning(t("gameFeatures.messages.notImplemented"));
  };

  const connectWebSocket = async () => {
    if (!tokenStore.selectedToken) {
      message.warning(t("gameFeatures.messages.selectOneTokenFirst"));
      router.push("/tokens");
      return false;
    }

    try {
      const tokenId = tokenStore.selectedToken.id;
      const token = tokenStore.selectedToken.token;

      const connectionTask = tokenStore.createWebSocketConnection(tokenId, token);
      message.info(t("gameFeatures.messages.websocketConnecting"));

      await connectionTask;

      const connected = await waitForTokenConnection(tokenId);
      if (connected) {
        message.success(t("gameFeatures.messages.websocketConnected"));
        return true;
      }

      message.warning("连接超时");
      return false;
    } catch (error) {
      console.error("WebSocket连接失败:", error);
      message.error(t("gameFeatures.messages.websocketConnectFailed"));
      return false;
    }
  };

  const disconnectWebSocket = () => {
    if (!tokenStore.selectedToken) {
      return;
    }

    tokenStore.closeWebSocketConnection(tokenStore.selectedToken.id);
    message.info(t("gameFeatures.messages.websocketDisconnected"));
  };

  const toggleConnection = async (connectionStatus) => {
    if (connectionStatus === "connected") {
      disconnectWebSocket();
      return;
    }

    await connectWebSocket();
  };

  return {
    connectWebSocket,
    disconnectWebSocket,
    handleFeatureAction,
    initializeGameData,
    toggleConnection,
  };
}
