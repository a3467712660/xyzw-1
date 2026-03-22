import { computed, ref } from "vue";

export function useScheduledTaskCountdown({
  scheduledTasks,
  calculateNextExecutionTime,
  formatTimeDifference,
}) {
  const taskCountdowns = ref({});
  const nextExecutionTimes = ref({});
  let countdownInterval = null;

  const updateCountdowns = () => {
    const now = Date.now();

    scheduledTasks.value.forEach((task) => {
      if (!task.enabled) {
        delete taskCountdowns.value[task.id];
        return;
      }

      if (
        !nextExecutionTimes.value[task.id]
        || nextExecutionTimes.value[task.id] <= now
      ) {
        nextExecutionTimes.value[task.id] = calculateNextExecutionTime(task);
      }

      if (nextExecutionTimes.value[task.id]) {
        const timeDiff = nextExecutionTimes.value[task.id] - now;
        taskCountdowns.value[task.id] = {
          remainingTime: Math.max(0, timeDiff),
          formatted: formatTimeDifference(Math.max(0, timeDiff)),
          isNearExecution: timeDiff < 5 * 60 * 1000,
        };
      }
    });
  };

  const shortestCountdownTask = computed(() => {
    if (scheduledTasks.value.length === 0) {
      return null;
    }

    let shortestTask = null;
    let shortestTime = Infinity;

    scheduledTasks.value.forEach((task) => {
      if (!task.enabled) {
        return;
      }

      const countdown = taskCountdowns.value[task.id];
      if (countdown && countdown.remainingTime < shortestTime) {
        shortestTime = countdown.remainingTime;
        shortestTask = { task, countdown };
      }
    });

    return shortestTask;
  });

  const resetCountdowns = () => {
    nextExecutionTimes.value = {};
    taskCountdowns.value = {};
    updateCountdowns();
  };

  const startCountdown = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
    }

    updateCountdowns();
    countdownInterval = setInterval(updateCountdowns, 1000);
  };

  const stopCountdown = () => {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  };

  return {
    nextExecutionTimes,
    resetCountdowns,
    shortestCountdownTask,
    startCountdown,
    stopCountdown,
    taskCountdowns,
    updateCountdowns,
  };
}
