const SCHEDULED_BATCH_TASKS = new Set([
  "batchOpenBox",
  "batchFish",
  "batchRecruit",
  "batchLegacyGiftSendEnhanced",
]);

const BAOKU_TASKS = new Set(["batchbaoku45", "batchbaoku13"]);
const DREAM_TASKS = new Set(["batchmengjing", "batchBuyDreamItems"]);
const CAR_TASKS = new Set(["batchSmartSendCar", "batchClaimCars"]);
const ARENA_TASKS = new Set(["batchTopUpArena", "batcharenafight"]);
const WEIRD_TOWER_TASKS = new Set([
  "climbWeirdTower",
  "batchUseItems",
  "batchMergeItems",
  "batchClaimFreeEnergy",
]);

export function useScheduledTaskExecutor({
  addLog,
  availableTasks,
  isCarActivityOpen,
  isWeirdTowerActivityOpen,
  isarenaActivityOpen,
  isbaokuActivityOpen,
  ismengjingActivityOpen,
  selectedTokens,
  shouldStop,
  taskHandlers,
  tokenStore,
  tokens,
}) {
  const getTaskLabel = (taskName) => {
    return availableTasks.find((task) => task.value === taskName)?.label || taskName;
  };

  const resolveTaskHandler = (taskName) => {
    return taskHandlers[taskName];
  };

  const verifyTaskDependencies = async (task) => {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 开始验证定时任务 ${task.name} 的依赖 ===`,
      type: "info",
    });

    try {
      localStorage.setItem("test", "test");
      localStorage.removeItem("test");
      addLog({
        time: new Date().toLocaleTimeString(),
        message: "✅ localStorage可用",
        type: "info",
      });
    } catch (error) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `❌ localStorage不可用: ${error.message}`,
        type: "error",
      });
      return false;
    }

    if (!tokenStore || !tokenStore.gameTokens) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: "❌ Token存储不可用",
        type: "error",
      });
      return false;
    }

    for (const taskName of task.selectedTasks) {
      const taskFunction = resolveTaskHandler(taskName);
      if (typeof taskFunction !== "function") {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `❌ 任务函数不存在: ${taskName}`,
          type: "error",
        });
        return false;
      }
    }

    const connectedTokens = task.selectedTokens.map((tokenId) => {
      const tokenName
        = tokenStore.gameTokens.find((token) => token.id === tokenId)?.name
          || tokenId;
      return { id: tokenId, name: tokenName };
    });

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `✅ 将使用 ${connectedTokens.length} 个账号执行任务`,
      type: "info",
    });

    task.connectedTokens = connectedTokens.map((token) => token.id);

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 定时任务 ${task.name} 的依赖验证通过，将执行 ${connectedTokens.length} 个账号 ===`,
      type: "success",
    });
    return true;
  };

  const shouldSkipTask = (taskName) => {
    if (BAOKU_TASKS.has(taskName) && !isbaokuActivityOpen.value) {
      return `${getTaskLabel(taskName)} (不在宝库开放时间)`;
    }
    if (DREAM_TASKS.has(taskName) && !ismengjingActivityOpen.value) {
      return `${getTaskLabel(taskName)} (不在梦境开放时间)`;
    }
    if (CAR_TASKS.has(taskName) && !isCarActivityOpen.value) {
      return `${getTaskLabel(taskName)} (不在发车开放时间)`;
    }
    if (ARENA_TASKS.has(taskName) && !isarenaActivityOpen.value) {
      return `${getTaskLabel(taskName)} (不在竞技场开放时间)`;
    }
    if (WEIRD_TOWER_TASKS.has(taskName) && !isWeirdTowerActivityOpen.value) {
      return `${getTaskLabel(taskName)} (不在怪异塔开放时间)`;
    }
    return "";
  };

  const executeScheduledTask = async (task) => {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 开始执行定时任务: ${task.name} ===`,
      type: "info",
    });

    try {
      const dependenciesValid = await verifyTaskDependencies(task);
      if (!dependenciesValid) {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== 定时任务 ${task.name} 依赖验证失败，取消执行 ===`,
          type: "error",
        });
        return;
      }

      const sourceTokenIds = task.connectedTokens || task.selectedTokens;
      const availableTokens = sourceTokenIds.filter((tokenId) => {
        return tokens.value.some((token) => token.id === tokenId);
      });
      const missingTokens = sourceTokenIds.filter((tokenId) => {
        return !tokens.value.some((token) => token.id === tokenId);
      });

      if (missingTokens.length > 0) {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `⚠️  跳过不存在的Token: ${missingTokens.join(", ")}`,
          type: "warning",
        });
      }

      if (availableTokens.length === 0) {
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== 定时任务 ${task.name} 没有可用的Token，取消执行 ===`,
          type: "error",
        });
        return;
      }

      selectedTokens.value = [...availableTokens];

      const taskPromises = task.selectedTasks.map(async (taskName) => {
        if (shouldStop.value) {
          return;
        }

        const skipReason = shouldSkipTask(taskName);
        if (skipReason) {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `跳过任务: ${skipReason}`,
            type: "warning",
          });
          return;
        }

        addLog({
          time: new Date().toLocaleTimeString(),
          message: `执行任务: ${getTaskLabel(taskName)}`,
          type: "info",
        });

        const taskFunction = resolveTaskHandler(taskName);
        if (typeof taskFunction !== "function") {
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `任务函数不存在: ${taskName}`,
            type: "error",
          });
          return;
        }

        if (SCHEDULED_BATCH_TASKS.has(taskName)) {
          await taskFunction(true);
        } else {
          await taskFunction();
        }
      });

      await Promise.all(taskPromises);

      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 定时任务执行完成: ${task.name} ===`,
        type: "success",
      });
    } catch (error) {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== 定时任务执行失败: ${error.message} ===`,
        type: "error",
      });
      console.error(
        `[${new Date().toISOString()}] Error executing scheduled task ${task.name}:`,
        error,
      );
    }
  };

  return {
    executeScheduledTask,
    resolveTaskHandler,
    verifyTaskDependencies,
  };
}
