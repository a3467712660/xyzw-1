export function useFightPvpTargetSync({
  tokenStore,
  message,
  t,
  targetLists,
  syncingTargetLists,
  GAME_TARGET_LIST_BASE_CMD_CANDIDATES,
  sanitizeFightHistoryRecords,
  normalizeFightHistoryRecord,
  mergeFightRecord,
  calculateRedCountFromHeroes,
  extractGameTargetLists,
  persistTargetLists,
  sleep,
}) {
  const enrichFriendListRedCounts = async (tokenId, friends) => {
    const list = Array.isArray(friends) ? friends : [];
    const candidates = list.filter((item) => (Number(item?.red) || 0) <= 0);
    if (candidates.length === 0)
      return list;

    const mergedMap = new Map(
      list.map((item) => [item.id, normalizeFightHistoryRecord(item)]),
    );

    const chunkSize = 3;
    for (let i = 0; i < candidates.length; i += chunkSize) {
      if (tokenStore.getWebSocketStatus(tokenId) !== "connected")
        break;

      const chunk = candidates.slice(i, i + chunkSize);
      const results = await Promise.all(
        chunk.map(async (item) => {
          try {
            const res = await tokenStore.sendMessageWithPromise(
              tokenId,
              "rank_getroleinfo",
              {
                roleId: Number(item.id),
                bottleType: 0,
                includeBottleTeam: false,
                isSearch: false,
                includeHero: true,
                includeHeroDetail: true,
                includePearl: false,
              },
              5000,
            );
            const red = calculateRedCountFromHeroes(res?.roleInfo?.heroes);
            return {
              id: String(item.id),
              red,
              serverName:
                res?.roleInfo?.serverName
                || res?.roleInfo?.serverId
                || item.serverName
                || t("fightPvpCard.common.unknown"),
              name:
                res?.roleInfo?.name
                || item.name
                || t("fightPvpCard.common.unknownPlayer"),
              headImg: res?.roleInfo?.headImg || item.headImg || "",
            };
          } catch {
            return null;
          }
        }),
      );

      results.forEach((result) => {
        if (!result || !mergedMap.has(result.id))
          return;
        const existing = mergedMap.get(result.id);
        const incoming = normalizeFightHistoryRecord({
          ...result,
          updatedAt: Date.now(),
        });
        mergedMap.set(result.id, mergeFightRecord(existing, incoming));
      });

      await sleep(100);
    }

    return sanitizeFightHistoryRecords(
      [...mergedMap.values()].filter((item) => item),
    );
  };

  const syncTargetListsFromGame = async () => {
    if (!tokenStore.selectedToken) {
      message.warning(t("fightPvpCard.messages.selectRoleFirst"));
      return;
    }
    if (syncingTargetLists.value)
      return;

    const tokenId = tokenStore.selectedToken.id;
    const wsStatus = tokenStore.getWebSocketStatus(tokenId);
    if (wsStatus !== "connected") {
      message.error(t("fightPvpCard.messages.wsDisconnectedSyncFriends"));
      return;
    }

    syncingTargetLists.value = true;
    try {
      let totalFriends = [];
      const wsClient = tokenStore.getWebSocketClient?.(tokenId);
      const commandRegistry = wsClient?.registry?.commands;
      const isCommandSupported = (cmd) =>
        commandRegistry instanceof Map ? commandRegistry.has(cmd) : true;

      for (const candidate of GAME_TARGET_LIST_BASE_CMD_CANDIDATES) {
        if (tokenStore.getWebSocketStatus(tokenId) !== "connected")
          break;
        if (!isCommandSupported(candidate.cmd))
          continue;

        try {
          const res = await tokenStore.sendMessageWithPromise(
            tokenId,
            candidate.cmd,
            candidate.params || {},
            4200,
          );
          const parsed = extractGameTargetLists(res);
          if (parsed.friends.length > 0) {
            totalFriends = sanitizeFightHistoryRecords([
              ...totalFriends,
              ...parsed.friends,
            ]);
          }
        } catch {
          // 忽略单个候选命令失败，继续尝试其它探测入口
        }

        await sleep(100);
      }

      if (totalFriends.length === 0) {
        message.warning(t("fightPvpCard.messages.friendListNotRecognized"));
        return;
      }

      targetLists.value = {
        friends: sanitizeFightHistoryRecords([
          ...(targetLists.value.friends || []),
          ...totalFriends,
        ]),
        follows: [],
      };
      persistTargetLists();

      const hasZeroRedFriends = targetLists.value.friends.some(
        (item) => (Number(item?.red) || 0) <= 0,
      );
      if (hasZeroRedFriends) {
        message.info(t("fightPvpCard.messages.friendsSyncedFillingRed"));
        const enrichedFriends = await enrichFriendListRedCounts(
          tokenId,
          targetLists.value.friends,
        );
        targetLists.value = {
          friends: enrichedFriends,
          follows: [],
        };
        persistTargetLists();
      }

      const friendCount = targetLists.value.friends.length;
      message.success(t("fightPvpCard.messages.syncDone", { count: friendCount }));
    } finally {
      syncingTargetLists.value = false;
    }
  };

  return {
    enrichFriendListRedCounts,
    syncTargetListsFromGame,
  };
}
