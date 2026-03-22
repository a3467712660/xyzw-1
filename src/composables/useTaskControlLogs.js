import api from "@/api";
import { nextTick, ref } from "vue";

export function useTaskControlLogs({
  locale,
  message,
  t,
}) {
  const logs = ref([]);
  const autoScroll = ref(true);
  const logRef = ref(null);
  let logsPollTimer = null;

  const loadLogs = async () => {
    try {
      const resp = await api.taskControl.listLogs(500);
      const rows = Array.isArray(resp?.data) ? resp.data : [];
      logs.value = rows.map((item) => ({
        id: item.id,
        task: item.taskName || "--",
        message: item.message || "",
        status: item.status || "info",
        time: item.createdAt || new Date().toISOString(),
      }));
    } catch {
      logs.value = [];
    }
  };

  const appendLog = (task, messageText, status = "info") => {
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      task: task?.title || t("taskControl.common.system"),
      message: messageText,
      status,
      time: new Date().toISOString(),
    };

    logs.value.unshift(entry);
    logs.value = logs.value.slice(0, 500);

    api.taskControl.appendLog({
      taskName: entry.task,
      message: entry.message,
      status: entry.status,
    }).catch(() => {});

    if (!autoScroll.value)
      return;

    nextTick(() => {
      if (logRef.value) {
        logRef.value.scrollTop = 0;
      }
    });
  };

  const clearLogs = async () => {
    try {
      await api.taskControl.clearLogs();
    } catch (error) {
      message.warning(error?.message || t("taskControl.messages.clearLogsFailed"));
    }
    logs.value = [];
  };

  const toggleAutoScroll = () => {
    autoScroll.value = !autoScroll.value;
  };

  const formatTime = (iso) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime()))
      return "--:--:--";
    return date.toLocaleTimeString(locale.value, { hour12: false });
  };

  const startLogsPolling = () => {
    if (logsPollTimer)
      window.clearInterval(logsPollTimer);
    logsPollTimer = window.setInterval(() => {
      loadLogs();
    }, 20000);
  };

  const stopLogsPolling = () => {
    if (!logsPollTimer)
      return;
    window.clearInterval(logsPollTimer);
    logsPollTimer = null;
  };

  return {
    appendLog,
    autoScroll,
    clearLogs,
    formatTime,
    loadLogs,
    logRef,
    logs,
    startLogsPolling,
    stopLogsPolling,
    toggleAutoScroll,
  };
}
