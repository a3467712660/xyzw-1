import { computed, onUnmounted, ref } from "vue";

const formatDurationMs = (ms) => {
  const totalSeconds = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${seconds}秒`;
  }
  return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
};

export const useLineupApplyProgress = ({
  isRunning,
  applyDebugMode,
  applyDebugPaused,
  estimateApplyDurationMs,
}) => {
  const applyProgressVisible = ref(false);
  const applyProgressStage = ref("");
  const applyProgressStartedAt = ref(0);
  const applyProgressEstimateMs = ref(0);
  const applyProgressNow = ref(Date.now());
  let applyProgressTimer = null;

  const applyProgressElapsedMs = computed(() => {
    if (!applyProgressStartedAt.value) return 0;
    return Math.max(0, applyProgressNow.value - applyProgressStartedAt.value);
  });

  const applyProgressRemainingMs = computed(() => {
    if (!applyProgressEstimateMs.value) return 0;
    return Math.max(0, applyProgressEstimateMs.value - applyProgressElapsedMs.value);
  });

  const applyProgressOverdue = computed(
    () =>
      Boolean(
        applyProgressEstimateMs.value
        && applyProgressElapsedMs.value > applyProgressEstimateMs.value,
      ),
  );

  const applyProgressSpinning = computed(() =>
    isRunning.value && !(applyDebugMode.value && applyDebugPaused.value),
  );

  const applyProgressStatus = computed(() =>
    applyProgressOverdue.value ? "warning" : "success",
  );

  const applyProgressPercent = computed(() => {
    if (!applyProgressEstimateMs.value) return 0;
    const percent = Math.round(
      (applyProgressElapsedMs.value / applyProgressEstimateMs.value) * 100,
    );
    return applyProgressOverdue.value
      ? 99
      : Math.min(95, Math.max(3, percent));
  });

  const applyProgressEstimatedText = computed(() =>
    formatDurationMs(applyProgressEstimateMs.value),
  );

  const applyProgressElapsedText = computed(() =>
    formatDurationMs(applyProgressElapsedMs.value),
  );

  const applyProgressRemainingText = computed(() =>
    applyProgressOverdue.value
      ? "已超时"
      : formatDurationMs(applyProgressRemainingMs.value),
  );

  const applyProgressFinishText = computed(() => {
    if (!applyProgressStartedAt.value || !applyProgressEstimateMs.value) {
      return "--";
    }
    return new Date(
      applyProgressStartedAt.value + applyProgressEstimateMs.value,
    ).toLocaleTimeString("zh-CN", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  });

  const startApplyProgress = (lineup) => {
    applyProgressEstimateMs.value = estimateApplyDurationMs(lineup);
    applyProgressStartedAt.value = Date.now();
    applyProgressNow.value = applyProgressStartedAt.value;
    applyProgressStage.value = "正在准备应用阵容";
    applyProgressVisible.value = true;
    if (applyProgressTimer) {
      clearInterval(applyProgressTimer);
    }
    applyProgressTimer = window.setInterval(() => {
      applyProgressNow.value = Date.now();
    }, 1000);
  };

  const setApplyProgressStage = (stage) => {
    applyProgressStage.value = stage || "正在处理中";
  };

  const finishApplyProgress = ({ keepVisible = false } = {}) => {
    if (applyProgressTimer) {
      clearInterval(applyProgressTimer);
      applyProgressTimer = null;
    }
    if (keepVisible) {
      applyProgressNow.value = Date.now();
      return;
    }
    applyProgressVisible.value = false;
    applyProgressStage.value = "";
    applyProgressStartedAt.value = 0;
    applyProgressEstimateMs.value = 0;
    applyProgressNow.value = Date.now();
  };

  onUnmounted(() => {
    if (applyProgressTimer) {
      clearInterval(applyProgressTimer);
      applyProgressTimer = null;
    }
  });

  return {
    applyProgressElapsedMs,
    applyProgressEstimateMs,
    applyProgressEstimatedText,
    applyProgressElapsedText,
    applyProgressFinishText,
    applyProgressNow,
    applyProgressOverdue,
    applyProgressPercent,
    applyProgressRemainingText,
    applyProgressSpinning,
    applyProgressStage,
    applyProgressStartedAt,
    applyProgressStatus,
    applyProgressVisible,
    finishApplyProgress,
    setApplyProgressStage,
    startApplyProgress,
  };
};
