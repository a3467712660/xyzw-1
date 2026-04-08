import { computed, ref } from "vue";

export function useGameCardActionLock() {
  const pendingCount = ref(0);

  const isRunning = computed(() => pendingCount.value > 0);

  const runLocked = async (action, { onLocked } = {}) => {
    if (isRunning.value) {
      return typeof onLocked === "function" ? onLocked() : undefined;
    }

    pendingCount.value += 1;

    try {
      return await action();
    } finally {
      pendingCount.value = Math.max(0, pendingCount.value - 1);
    }
  };

  return {
    isRunning,
    runLocked,
  };
}
