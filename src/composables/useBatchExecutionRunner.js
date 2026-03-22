export function useBatchExecutionRunner({
  DailyTaskRunner,
  addLog,
  batchSettings,
  connectionQueue,
  currentRunningTokenId,
  ensureConnection,
  isRunning,
  message,
  releaseConnectionSlot,
  selectedTokens,
  shouldStop,
  tokenStatus,
  tokenStore,
  tokens,
}) {
  const startBatch = async (customDailySettings = null) => {
    if (selectedTokens.value.length === 0) {
      return;
    }

    isRunning.value = true;
    shouldStop.value = false;

    selectedTokens.value.forEach((id) => {
      tokenStatus.value[id] = "waiting";
    });

    const taskPromises = selectedTokens.value.map(async (tokenId) => {
      if (shouldStop.value) {
        return;
      }

      tokenStatus.value[tokenId] = "running";

      let retryCount = 0;
      const maxRetries = 1;
      let success = false;

      while (retryCount <= maxRetries && !success) {
        if (shouldStop.value) {
          break;
        }

        const token = tokens.value.find((item) => item.id === tokenId);

        try {
          if (retryCount === 0) {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `=== 开始执行: ${token.name} ===`,
              type: "info",
            });
          } else {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `=== 尝试重试: ${token.name} (第${retryCount}次) ===`,
              type: "info",
            });
          }

          await ensureConnection(tokenId);

          const runner = new DailyTaskRunner(tokenStore, {
            commandDelay: batchSettings.commandDelay,
            taskDelay: batchSettings.taskDelay,
          });

          await runner.run(
            tokenId,
            {
              onLog: (log) => addLog(log),
              onProgress: () => {
                // 每个token维护自己的进度
              },
            },
            customDailySettings,
          );

          success = true;
          tokenStatus.value[tokenId] = "completed";
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `=== ${token.name} 执行完成 ===`,
            type: "success",
          });
        } catch (error) {
          console.error(error);
          if (retryCount < maxRetries && !shouldStop.value) {
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} 执行出错: ${error.message}，等待3秒后重试...`,
              type: "warning",
            });
            await new Promise((resolve) => setTimeout(resolve, 3000));
            retryCount++;
          } else {
            tokenStatus.value[tokenId] = "failed";
            addLog({
              time: new Date().toLocaleTimeString(),
              message: `${token.name} 执行失败: ${error.message}`,
              type: "error",
            });
          }
        } finally {
          tokenStore.closeWebSocketConnection(tokenId);
          releaseConnectionSlot();
          addLog({
            time: new Date().toLocaleTimeString(),
            message: `${token.name} 连接已关闭  (队列: ${connectionQueue.active}/${batchSettings.maxActive})`,
            type: "info",
          });
        }
      }
    });

    await Promise.all(taskPromises);
    await new Promise((resolve) => setTimeout(resolve, 1000));

    isRunning.value = false;
    currentRunningTokenId.value = null;
    message.success("批量任务执行结束");
  };

  const stopBatch = () => {
    shouldStop.value = true;
    addLog({
      time: new Date().toLocaleTimeString(),
      message: "正在停止...",
      type: "warning",
    });
  };

  return {
    startBatch,
    stopBatch,
  };
}
