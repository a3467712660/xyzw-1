import { computed, ref, watch } from "vue";

export function useBatchLogManager({
  batchSettings,
  forwardQuickTaskLog,
  message,
  nextTick,
  tokens,
}) {
  const currentRunningTokenId = ref(null);
  const currentProgress = ref(0);
  const logs = ref([]);
  const logContainer = ref(null);
  const autoScrollLog = ref(true);
  const filterErrorsOnly = ref(false);

  const errorCount = computed(() => {
    return logs.value.filter((log) => log.type === "error").length;
  });

  const filteredLogs = computed(() => {
    if (filterErrorsOnly.value) {
      return logs.value.filter((log) => log.type === "error");
    }
    return logs.value;
  });

  const currentRunningTokenName = computed(() => {
    const token = tokens.value.find((item) => item.id === currentRunningTokenId.value);
    return token ? token.name : "";
  });

  const addLog = (log) => {
    logs.value.push(log);

    const maxLogEntries = batchSettings.maxLogEntries || 1000;
    if (logs.value.length > maxLogEntries) {
      logs.value = logs.value.slice(-maxLogEntries);
    }

    try {
      if (logContainer.value && autoScrollLog.value) {
        logContainer.value.scrollTop = logContainer.value.scrollHeight;
      }
    } catch (error) {
      console.warn("Failed to scroll log container:", error);
    }

    nextTick(() => {
      try {
        if (logContainer.value && autoScrollLog.value) {
          logContainer.value.scrollTop = logContainer.value.scrollHeight;
        }
      } catch {
        // ignore DOM scroll errors
      }
    });

    forwardQuickTaskLog(log);
  };

  watch(autoScrollLog, (newValue) => {
    if (newValue && logContainer.value) {
      nextTick(() => {
        try {
          logContainer.value.scrollTop = logContainer.value.scrollHeight;
        } catch (error) {
          console.warn("Failed to scroll log container:", error);
        }
      });
    }
  });

  const copyLogs = () => {
    if (logs.value.length === 0) {
      message.warning("没有可复制的日志");
      return;
    }
    const logText = logs.value
      .map((log) => `${log.time} ${log.message}`)
      .join("\n");
    navigator.clipboard
      .writeText(logText)
      .then(() => {
        message.success("日志已复制到剪贴板");
      })
      .catch((error) => {
        message.error(`复制日志失败: ${error.message}`);
      });
  };

  const clearLogs = () => {
    logs.value = [];
    message.success("日志已清空");
  };

  return {
    addLog,
    autoScrollLog,
    clearLogs,
    copyLogs,
    currentProgress,
    currentRunningTokenId,
    currentRunningTokenName,
    errorCount,
    filteredLogs,
    filterErrorsOnly,
    logContainer,
    logs,
  };
}
