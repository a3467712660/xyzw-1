import { ref } from "vue";

export function useScheduledTaskRunner({
  addLog,
  batchSettings,
  executeScheduledTask,
  isRunning,
  matchesCronExpression,
  scheduledTasks,
}) {
  const intervalId = ref(null);
  let lastTaskExecution = null;
  let healthCheckInterval = null;
  const pageLoadTime = Date.now();

  const stopScheduler = () => {
    if (intervalId.value) {
      clearInterval(intervalId.value);
      intervalId.value = null;
      addLog({
        time: new Date().toLocaleTimeString(),
        message: "=== 定时任务调度服务已停止 ===",
        type: "info",
      });
    }

    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
      healthCheckInterval = null;
    }
  };

  const startScheduler = () => {
    if (intervalId.value) {
      clearInterval(intervalId.value);
    }

    intervalId.value = setInterval(() => {
      try {
        const now = new Date();
        const currentTime = now.toLocaleTimeString("zh-CN", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        });

        const tasksToRun = scheduledTasks.value.filter((task) => task.enabled);
        if (tasksToRun.length === 0) {
          return;
        }

        tasksToRun.forEach((task) => {
          let shouldRun = false;

          if (task.runType === "daily") {
            const taskTime = task.runTime;
            const nowTime = now.toLocaleTimeString("zh-CN", {
              hour12: false,
              hour: "2-digit",
              minute: "2-digit",
            });
            shouldRun = nowTime === taskTime;
          } else if (task.runType === "cron") {
            try {
              shouldRun = matchesCronExpression(task.cronExpression, now);
            } catch (error) {
              console.error(
                `[${new Date().toISOString()}] Error parsing cron expression ${task.cronExpression}:`,
                error,
              );
              addLog({
                time: currentTime,
                message: `=== 解析定时任务 ${task.name} 的Cron表达式失败: ${error.message} ===`,
                type: "error",
              });
              return;
            }
          }

          if (!shouldRun) {
            return;
          }

          const taskExecutionKey =
            `${task.id}_${now.getDate()}_${now.getHours()}_${now.getMinutes()}`;
          const lastExecutionKey = localStorage.getItem(
            `lastTaskExecution_${task.id}`,
          );

          if (lastExecutionKey !== taskExecutionKey) {
            localStorage.setItem(
              `lastTaskExecution_${task.id}`,
              taskExecutionKey,
            );
            lastTaskExecution = Date.now();
            executeScheduledTask(task);
          }
        });
      } catch (error) {
        console.error(
          `[${new Date().toISOString()}] Error in task scheduler:`,
          error,
        );
        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== 定时任务调度服务发生错误: ${error.message} ===`,
          type: "error",
        });
      }
    }, 10000);
  };

  const healthCheck = () => {
    if (!intervalId.value) {
      console.error(
        `[${new Date().toISOString()}] Task scheduler interval is not running, restarting...`,
      );
      startScheduler();
    }

    if (isRunning.value) {
      const now = Date.now();
      const tenMinutesAgo = now - 10 * 60 * 1000;
      if (lastTaskExecution && lastTaskExecution < tenMinutesAgo) {
        console.error(
          `[${new Date().toISOString()}] isRunning has been true for more than 10 minutes, resetting to false`,
        );
        isRunning.value = false;
        addLog({
          time: new Date().toLocaleTimeString(),
          message: "=== 检测到任务执行超时，已重置isRunning状态 ===",
          type: "warning",
        });
      }
    }

    if (batchSettings.enableRefresh && batchSettings.refreshInterval > 0) {
      const elapsedMinutes = (Date.now() - pageLoadTime) / 1000 / 60;
      if (elapsedMinutes >= batchSettings.refreshInterval) {
        if (!isRunning.value) {
          console.log(
            `[${new Date().toISOString()}] Refreshing page as scheduled (Interval: ${batchSettings.refreshInterval}m, Elapsed: ${elapsedMinutes.toFixed(1)}m)`,
          );
          window.location.reload();
        } else {
          console.log(
            `[${new Date().toISOString()}] Scheduled refresh postponed due to running task`,
          );
        }
      }
    }
  };

  const scheduleTaskExecution = () => {
    addLog({
      time: new Date().toLocaleTimeString(),
      message: "=== 定时任务调度服务已启动 ===",
      type: "info",
    });

    startScheduler();

    if (healthCheckInterval) {
      clearInterval(healthCheckInterval);
    }
    healthCheckInterval = setInterval(healthCheck, 5 * 60 * 1000);
    healthCheck();
  };

  return {
    healthCheck,
    intervalId,
    scheduleTaskExecution,
    startScheduler,
    stopScheduler,
  };
}
