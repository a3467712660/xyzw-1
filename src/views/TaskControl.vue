<template>
  <div class="task-control-page">
    <TaskControlList
      :preparing-runner="isPreparingRunner"
      :run-feature="runFeatureTask"
    ></TaskControlList>

    <div v-if="showHiddenRunner" class="batch-hidden">
      <BatchDailyTasks ref="batchRunnerRef"></BatchDailyTasks>
    </div>
  </div>
</template>

<script setup>
import { defineAsyncComponent, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import TaskControlList from "@/components/Task/TaskControlList.vue";

const BatchDailyTasks = defineAsyncComponent(
  () => import("@/views/BatchDailyTasks.vue"),
);

const message = useMessage();
const batchRunnerRef = ref(null);
const showHiddenRunner = ref(false);
const isPreparingRunner = ref(false);
let resolveBatchRunnerReady;
const batchRunnerReady = new Promise((resolve) => {
  resolveBatchRunnerReady = resolve;
});

watch(
  batchRunnerRef,
  (instance) => {
    if (instance && typeof instance.executeQuickTask === "function") {
      resolveBatchRunnerReady?.(instance);
    }
  },
  { immediate: true },
);

const runFeatureTask = async ({
  taskName,
  tokenIds = [],
  batchSettingsOverride,
  taskOptions,
  onLog,
}) => {
  if (!showHiddenRunner.value) {
    showHiddenRunner.value = true;
  }

  if (
    !batchRunnerRef.value
    || typeof batchRunnerRef.value.executeQuickTask !== "function"
  ) {
    isPreparingRunner.value = true;
    try {
      await Promise.race([
        batchRunnerReady,
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error("自动化执行器加载超时，请稍后重试"));
          }, 8000);
        }),
      ]);
    } finally {
      isPreparingRunner.value = false;
    }
  }

  if (
    !batchRunnerRef.value
    || typeof batchRunnerRef.value.executeQuickTask !== "function"
  ) {
    throw new Error("自动化执行器未就绪，请稍后重试");
  }

  try {
    await batchRunnerRef.value.executeQuickTask(taskName, tokenIds, {
      batchSettingsOverride,
      taskOptions,
      onLog,
    });
  } catch (error) {
    message.error(error.message || "执行失败");
    throw error;
  }
};
</script>

<style scoped lang="scss">
.task-control-page {
  display: grid;
  gap: 12px;
  min-height: calc(100dvh - 72px);
  animation: tc-fade-in 0.36s ease;
}

.batch-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  pointer-events: none;
  opacity: 0;
}

@keyframes tc-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
