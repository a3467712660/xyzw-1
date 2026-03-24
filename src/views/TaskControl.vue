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
import { onMounted, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useRouter } from "vue-router";
import TaskControlList from "@/components/Task/TaskControlList.vue";
import BatchDailyTasks from "@/views/BatchDailyTasks.vue";
import { useTokenStore } from "@/stores/tokenStore";

const router = useRouter();
const message = useMessage();
const tokenStore = useTokenStore();
const batchRunnerRef = ref(null);
const showHiddenRunner = ref(true);
const isPreparingRunner = ref(false);

const waitForBatchRunnerReady = async (timeoutMs = 20000) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (
      batchRunnerRef.value
      && typeof batchRunnerRef.value.executeQuickTask === "function"
    ) {
      return batchRunnerRef.value;
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }

  const hasRef = Boolean(batchRunnerRef.value);
  const exposedKeys = hasRef ? Object.keys(batchRunnerRef.value) : [];
  throw new Error(
    `自动化执行器加载超时，请稍后重试（ref=${hasRef ? "ready" : "null"}，methods=${exposedKeys.join(",") || "none"}）`,
  );
};

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
      await waitForBatchRunnerReady();
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

onMounted(() => {
  if (!tokenStore.hasUsableWorkbenchToken) {
    message.warning("当前没有已激活且未过期的 Token，请先前往 Token 管理完成激活");
    router.replace("/tokens");
    return;
  }
  showHiddenRunner.value = true;
});
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
