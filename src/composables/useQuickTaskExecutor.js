const QUICK_BATCH_SETTING_KEYS = [
  "carMinColor",
  "useGoldRefreshFallback",
  "smartDepartureGoldThreshold",
  "smartDepartureRecruitThreshold",
  "smartDepartureJadeThreshold",
  "smartDepartureTicketThreshold",
  "smartDepartureMaxRefreshAttempts",
  "smartDepartureMatchAll",
  "helperLineupAnalysisEnabled",
  "helperPreferredLineups",
];

export function useQuickTaskExecutor({
  batchArenaStandalone,
  batchSettings,
  batcharenafight,
  legion_storebuygoods,
  selectedTokens,
  startBatch,
  taskHandlers,
  tokens,
}) {
  let quickTaskLogForwarder = null;

  const setSelectedTokenIds = (tokenIds = []) => {
    const validIds = Array.isArray(tokenIds)
      ? tokenIds.filter((id) => tokens.value.some((token) => token.id === id))
      : [];
    selectedTokens.value = [...validIds];
    return selectedTokens.value;
  };

  const getSelectedTokenIds = () => [...selectedTokens.value];

  const forwardQuickTaskLog = (log) => {
    if (typeof quickTaskLogForwarder === "function") {
      try {
        quickTaskLogForwarder(log);
      } catch {
        // 忽略外部日志回调错误，避免影响主流程
      }
    }
  };

  const executeQuickTask = async (taskName, tokenIds = [], options = {}) => {
    const taskFn = taskHandlers[taskName];
    if (typeof taskFn !== "function") {
      throw new TypeError(`未找到任务方法: ${taskName}`);
    }

    const previousSelectedTokenIds = getSelectedTokenIds();
    if (Array.isArray(tokenIds) && tokenIds.length > 0) {
      const appliedIds = setSelectedTokenIds(tokenIds);
      const missingIds = tokenIds.filter((id) => !appliedIds.includes(id));
      if (missingIds.length > 0) {
        throw new Error(`部分账号不存在或不可用: ${missingIds.join(", ")}`);
      }
    }

    if (selectedTokens.value.length === 0) {
      throw new Error("请先选择至少一个账号");
    }

    let backup = null;
    const prevQuickTaskLogForwarder = quickTaskLogForwarder;
    quickTaskLogForwarder
      = typeof options?.onLog === "function" ? options.onLog : null;

    const override = options?.batchSettingsOverride;
    if (override && typeof override === "object") {
      backup = {};
      QUICK_BATCH_SETTING_KEYS.forEach((key) => {
        backup[key] = batchSettings[key];
        if (override[key] !== undefined) {
          batchSettings[key] = override[key];
        }
      });
    }

    try {
      if (taskName === "startBatch") {
        await startBatch(options?.taskOptions?.dailyRunner || null);
        return;
      }

      if (taskName === "batcharenafight") {
        if (options?.taskOptions?.arenaMode === "standalone") {
          await batchArenaStandalone(
            options?.taskOptions?.arenaFightCount || 10,
            {
              arenaFormation: options?.taskOptions?.arenaFormation,
              skipLineups: options?.taskOptions?.arenaSkipLineups,
            },
          );
          return;
        }

        await batcharenafight({
          arenaFormation: options?.taskOptions?.arenaFormation,
        });
        return;
      }

      if (
        taskName === "legion_storebuygoods"
        && options?.taskOptions?.clubStore
      ) {
        await legion_storebuygoods(options.taskOptions.clubStore);
        return;
      }

      await taskFn();
    } finally {
      selectedTokens.value = previousSelectedTokenIds;
      quickTaskLogForwarder = prevQuickTaskLogForwarder;
      if (backup) {
        QUICK_BATCH_SETTING_KEYS.forEach((key) => {
          batchSettings[key] = backup[key];
        });
      }
    }
  };

  return {
    executeQuickTask,
    forwardQuickTaskLog,
    getSelectedTokenIds,
    setSelectedTokenIds,
  };
}
