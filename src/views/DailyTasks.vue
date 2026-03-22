<template>
  <div class="daily-tasks-page app-page">
    <section class="app-page__hero">
      <div class="app-page__hero-copy">
        <span class="app-page__eyebrow">日常任务</span>
        <h1 class="app-page__title">{{ t("dailyTasks.title") }}</h1>
        <p class="app-page__description">
          {{ heroDescription }}
        </p>
        <div class="app-chip-row">
          <span class="app-inline-stat">
            <strong>{{ selectedRole?.name || "未选择" }}</strong>
            当前角色
          </span>
          <span class="app-inline-stat">
            <strong>{{ filteredTasks.length }}</strong>
            当前筛选结果
          </span>
          <span class="app-inline-stat">
            <strong>{{ pendingTaskCount }}</strong>
            待执行任务
          </span>
          <span class="app-inline-stat">
            <strong>{{ autoTaskCount }}</strong>
            自动任务
          </span>
        </div>
      </div>

      <div class="app-page__actions">
        <n-button
          size="large"
          type="primary"
          :loading="isRefreshing"
          @click="refreshTasks"
        >
          <template #icon>
            <n-icon>
              <Refresh></Refresh>
            </n-icon>
          </template>
          {{ t("dailyTasks.actions.refresh") }}
        </n-button>

        <n-dropdown :options="bulkActionOptions" @select="handleBulkAction">
          <n-button size="large">
            {{ t("dailyTasks.actions.bulk") }}
            <template #icon>
              <n-icon>
                <ChevronDown></ChevronDown>
              </n-icon>
            </template>
          </n-button>
        </n-dropdown>
      </div>
    </section>

    <div class="app-page__summary">
      <article v-for="card in summaryCards" :key="card.label" class="app-summary-card">
        <span class="app-summary-card__label">{{ card.label }}</span>
        <strong class="app-summary-card__value">{{ card.value }}</strong>
        <span class="app-summary-card__meta">{{ card.meta }}</span>
      </article>
    </div>

    <n-grid item-responsive responsive="screen" :x-gap="16" :y-gap="16">
      <n-grid-item span="24 l:16">
        <section class="app-section-card task-role-card">
          <div class="section-head">
            <div>
              <h2>角色与执行范围</h2>
              <p>桌面端把角色选择和统计放在同一行，手机端自动拆成单列。</p>
            </div>
          </div>

          <div class="role-selector-shell">
            <div class="selector-group">
              <span class="selector-label">{{ t("dailyTasks.labels.selectRole") }}</span>
              <n-select
                class="role-select"
                v-model:value="selectedRoleId"
                :options="roleOptions"
                :placeholder="t('dailyTasks.placeholders.selectRole')"
                @update:value="onRoleChange"
              ></n-select>
            </div>

            <div v-if="selectedRole" class="role-stats-grid">
              <div class="role-stat-box">
                <span class="role-stat-box__label">{{ t("dailyTasks.stats.total") }}</span>
                <strong class="role-stat-box__value">{{ taskStats.total }}</strong>
              </div>
              <div class="role-stat-box">
                <span class="role-stat-box__label">{{ t("dailyTasks.stats.completed") }}</span>
                <strong class="role-stat-box__value">{{ taskStats.completed }}</strong>
              </div>
              <div class="role-stat-box">
                <span class="role-stat-box__label">{{ t("dailyTasks.stats.progress") }}</span>
                <strong class="role-stat-box__value">{{ taskStats.percentage }}%</strong>
              </div>
            </div>
          </div>
        </section>
      </n-grid-item>

      <n-grid-item span="24 l:8">
        <section class="app-section-card task-tip-card">
          <div class="section-head">
            <div>
              <h2>本页改造重点</h2>
              <p>不碰任务接口和执行逻辑，只整理页面结构和移动端阅读顺序。</p>
            </div>
          </div>

          <ol class="tips-list">
            <li>首屏固定成“角色选择 → 筛选 → 任务列表”的顺序，避免在手机上来回找入口。</li>
            <li>统计信息抽成摘要卡，桌面端一眼看到进度，移动端仍可自然下滑查看。</li>
            <li>任务卡本身保持原逻辑，继续复用已有执行、配置和日志能力。</li>
          </ol>
        </section>
      </n-grid-item>
    </n-grid>

    <section class="app-section-card filter-card">
      <div class="section-head section-head--compact">
        <div>
          <h2>任务筛选</h2>
          <p>统一收口到一排工具栏，移动端自动换行。</p>
        </div>
      </div>

      <div class="filter-bar-shell">
        <n-radio-group
          v-model:value="currentFilter"
          @update:value="onFilterChange"
        >
          <n-radio-button value="all">{{ t("dailyTasks.filters.all") }}</n-radio-button>
          <n-radio-button value="pending">{{ t("dailyTasks.filters.pending") }}</n-radio-button>
          <n-radio-button value="completed">{{ t("dailyTasks.filters.completed") }}</n-radio-button>
          <n-radio-button value="auto">{{ t("dailyTasks.filters.auto") }}</n-radio-button>
        </n-radio-group>

        <div class="search-box">
          <n-input
            clearable
            v-model:value="searchKeyword"
            :placeholder="t('dailyTasks.placeholders.search')"
            @update:value="onSearch"
          >
            <template #prefix>
              <n-icon>
                <Search></Search>
              </n-icon>
            </template>
          </n-input>
        </div>
      </div>
    </section>

    <section class="app-section-card tasks-card">
      <div class="section-head section-head--compact">
        <div>
          <h2>任务列表</h2>
          <p>保持功能卡逻辑不变，只统一页面外层容器和间距。</p>
        </div>
      </div>

      <div v-if="filteredTasks.length" class="tasks-grid">
        <DailyTaskCard
          v-for="task in filteredTasks"
          :key="task.id"
          :task="task"
          @execute="executeTask"
          @toggle-status="toggleTaskStatus"
          @update:task="updateTask"
        ></DailyTaskCard>
      </div>

      <div v-else-if="!isLoading" class="empty-state app-empty-card">
        <n-empty size="large" :description="t('dailyTasks.empty')">
          <template #icon>
            <n-icon>
              <Cube></Cube>
            </n-icon>
          </template>
          <template #extra>
            <n-button type="primary" @click="refreshTasks">
              {{ t("dailyTasks.actions.refresh") }}
            </n-button>
          </template>
        </n-empty>
      </div>

      <div v-if="isLoading" class="loading-state">
        <n-spin size="large">
          <template #description>{{ t("dailyTasks.loading") }}</template>
        </n-spin>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useDialog, useMessage } from "naive-ui/es";
import api from "@/api";
import DailyTaskCard from "@/components/Daily/DailyTaskCard.vue";
import { ChevronDown, Cube, Refresh, Search } from "@vicons/ionicons5";
import { useGameRolesStore } from "@/stores/gameRoles";
import { useAuthStore } from "@/stores/auth";
import {
  connectBackendWs,
  disconnectBackendWs,
  subscribeBackendWs,
} from "@/utils/backendWs";

const router = useRouter();
const message = useMessage();
const dialog = useDialog();
const { t } = useI18n();
const gameRolesStore = useGameRolesStore();
const authStore = useAuthStore();

const isLoading = ref(false);
const isRefreshing = ref(false);
const selectedRoleId = ref(null);
const currentFilter = ref("all");
const searchKeyword = ref("");
const tasks = ref([]);
let unsubscribeBackendWs = null;

const selectedRole = computed(() => {
  return gameRolesStore.gameRoles.find(
    (role) => role.id === selectedRoleId.value,
  );
});

const roleOptions = computed(() => {
  return gameRolesStore.gameRoles.map((role) => ({
    label: `${role.name} (${role.server})`,
    value: role.id,
  }));
});

const taskStats = computed(() => {
  const total = tasks.value.length;
  const completed = tasks.value.filter((task) => task.completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, percentage };
});

const filteredTasks = computed(() => {
  let filtered = tasks.value;

  switch (currentFilter.value) {
    case "pending":
      filtered = filtered.filter((task) => !task.completed);
      break;
    case "completed":
      filtered = filtered.filter((task) => task.completed);
      break;
    case "auto":
      filtered = filtered.filter((task) => task.settings?.autoExecute);
      break;
  }

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    filtered = filtered.filter(
      (task) =>
        task.title.toLowerCase().includes(keyword)
        || task.subtitle?.toLowerCase().includes(keyword),
    );
  }

  return filtered;
});

const pendingTaskCount = computed(() => {
  return tasks.value.filter((task) => !task.completed && task.canExecute).length;
});

const autoTaskCount = computed(() => {
  return tasks.value.filter((task) => task.settings?.autoExecute).length;
});

const heroDescription = computed(() => {
  if (!selectedRole.value) {
    return "先选择一个角色，再统一查看任务状态、批量操作和执行结果。页面已经按 PC / Mobile 重新整理为更清晰的首屏结构。";
  }

  return `${selectedRole.value.name} · ${selectedRole.value.server || "未知服务器"}。当前页面保留原有任务逻辑，只对首屏信息层级、筛选区和任务区做响应式重排。`;
});

const summaryCards = computed(() => [
  {
    label: "当前角色",
    value: selectedRole.value?.name || "未选择",
    meta: selectedRole.value?.server || "选择角色后自动刷新任务",
  },
  {
    label: "任务总数",
    value: String(taskStats.value.total),
    meta: currentFilter.value === "all" ? "显示全部任务" : `当前筛选：${currentFilter.value}`,
  },
  {
    label: "完成进度",
    value: `${taskStats.value.percentage}%`,
    meta: `${taskStats.value.completed} / ${taskStats.value.total || 0} 已完成`,
  },
  {
    label: "自动任务",
    value: String(autoTaskCount.value),
    meta: pendingTaskCount.value > 0 ? `仍有 ${pendingTaskCount.value} 个待执行任务` : "当前无待执行任务",
  },
]);

const bulkActionOptions = [
  {
    label: t("dailyTasks.bulk.executeAllPending"),
    key: "execute-all-pending",
  },
  {
    label: t("dailyTasks.bulk.markAllCompleted"),
    key: "mark-all-completed",
  },
  {
    label: t("dailyTasks.bulk.resetAll"),
    key: "reset-all-tasks",
  },
];

const refreshTasks = async () => {
  if (!selectedRoleId.value) {
    message.warning(t("dailyTasks.messages.selectRoleFirst"));
    return;
  }

  try {
    isRefreshing.value = true;
    isLoading.value = true;
    const res = await api.dailyTasks.getList(selectedRoleId.value);
    if (!res.success) {
      message.error(res.message || t("dailyTasks.messages.loadFailed"));
      return;
    }
    tasks.value = Array.isArray(res.data) ? res.data : [];
    message.success(t("dailyTasks.messages.refreshSuccess"));
  } catch (error) {
    console.error("刷新任务失败:", error);
    message.error(t("dailyTasks.messages.loadFailed"));
  } finally {
    isRefreshing.value = false;
    isLoading.value = false;
  }
};

const onRoleChange = (roleId) => {
  selectedRoleId.value = roleId;
  gameRolesStore.selectRole(
    gameRolesStore.gameRoles.find((role) => role.id === roleId),
  );

  if (roleId) {
    refreshTasks();
  }
};

const onFilterChange = (filter) => {
  currentFilter.value = filter;
};

const onSearch = (keyword) => {
  searchKeyword.value = keyword;
};

const executeTask = async (taskId) => {
  if (!selectedRoleId.value) {
    message.error(t("dailyTasks.messages.selectRoleFirst"));
    return;
  }

  try {
    const res = await api.dailyTasks.complete(taskId, selectedRoleId.value);
    if (!res.success) {
      throw new Error(res.message || t("dailyTasks.messages.executeFailed"));
    }
    const taskIndex = tasks.value.findIndex((task) => task.id === taskId);
    if (taskIndex !== -1) {
      tasks.value[taskIndex] = {
        ...tasks.value[taskIndex],
        completed: true,
        completedAt: new Date().toISOString(),
        canExecute: true,
      };
      if (!tasks.value[taskIndex].logs) {
        tasks.value[taskIndex].logs = [];
      }
      tasks.value[taskIndex].logs.push({
        id: Date.now(),
        timestamp: Date.now(),
        type: "success",
        message:
          res.message
          || t("dailyTasks.messages.executeSuccessWithName", {
            title: tasks.value[taskIndex].title,
          }),
      });
    }
    message.success(t("dailyTasks.messages.executeSuccess"));
  } catch (error) {
    console.error("执行任务失败:", error);

    const taskIndex = tasks.value.findIndex((task) => task.id === taskId);
    if (taskIndex !== -1) {
      if (!tasks.value[taskIndex].logs) {
        tasks.value[taskIndex].logs = [];
      }
      tasks.value[taskIndex].logs.push({
        id: Date.now(),
        timestamp: Date.now(),
        type: "error",
        message: t("dailyTasks.messages.executeFailedWithReason", {
          error: error.message,
        }),
      });
    }

    throw error;
  }
};

const toggleTaskStatus = (taskId) => {
  const taskIndex = tasks.value.findIndex((task) => task.id === taskId);
  if (taskIndex !== -1) {
    tasks.value[taskIndex].completed = !tasks.value[taskIndex].completed;
    message.info(t("dailyTasks.messages.statusUpdated"));
  }
};

const updateTask = async (updatedTask) => {
  const taskIndex = tasks.value.findIndex((task) => task.id === updatedTask.id);
  if (taskIndex !== -1) {
    tasks.value[taskIndex] = updatedTask;
    if (selectedRoleId.value) {
      try {
        await api.dailyTasks.update(updatedTask.id, selectedRoleId.value, {
          enabled: updatedTask.canExecute,
          autoExecute: updatedTask.settings?.autoExecute,
          delay: updatedTask.settings?.delay,
          notification: updatedTask.settings?.notification,
        });
      } catch (error) {
        message.error(error.message || t("dailyTasks.messages.saveConfigFailed"));
      }
    }
  }
};

const handleBulkAction = (key) => {
  switch (key) {
    case "execute-all-pending":
      executeAllPendingTasks();
      break;
    case "mark-all-completed":
      markAllCompleted();
      break;
    case "reset-all-tasks":
      resetAllTasks();
      break;
  }
};

const executeAllPendingTasks = async () => {
  const pendingTasks = tasks.value.filter(
    (task) => !task.completed && task.canExecute,
  );

  if (pendingTasks.length === 0) {
    message.info(t("dailyTasks.messages.noPendingTasks"));
    return;
  }

  dialog.confirm({
    title: t("dailyTasks.dialogs.executeAll.title"),
    content: t("dailyTasks.dialogs.executeAll.content", {
      count: pendingTasks.length,
    }),
    positiveText: t("dailyTasks.common.confirm"),
    negativeText: t("dailyTasks.common.cancel"),
    onPositiveClick: async () => {
      let successCount = 0;
      let failCount = 0;

      for (const task of pendingTasks) {
        try {
          await executeTask(task.id);
          successCount++;
        } catch {
          failCount++;
        }
      }

      message.info(
        t("dailyTasks.messages.bulkExecuteFinished", {
          success: successCount,
          fail: failCount,
        }),
      );
    },
  });
};

const markAllCompleted = () => {
  const pendingTasks = tasks.value.filter((task) => !task.completed);

  if (pendingTasks.length === 0) {
    message.info(t("dailyTasks.messages.allCompleted"));
    return;
  }

  dialog.confirm({
    title: t("dailyTasks.dialogs.markAllCompleted.title"),
    content: t("dailyTasks.dialogs.markAllCompleted.content", {
      count: pendingTasks.length,
    }),
    positiveText: t("dailyTasks.common.confirm"),
    negativeText: t("dailyTasks.common.cancel"),
    onPositiveClick: () => {
      pendingTasks.forEach((task) => {
        task.completed = true;
        task.completedAt = new Date().toISOString();
      });
      message.success(t("dailyTasks.messages.markAllCompletedSuccess"));
    },
  });
};

const resetAllTasks = () => {
  dialog.confirm({
    title: t("dailyTasks.dialogs.resetAll.title"),
    content: t("dailyTasks.dialogs.resetAll.content"),
    positiveText: t("dailyTasks.common.confirm"),
    negativeText: t("dailyTasks.common.cancel"),
    onPositiveClick: () => {
      tasks.value.forEach((task) => {
        task.completed = false;
        task.completedAt = null;
      });
      message.success(t("dailyTasks.messages.resetAllSuccess"));
    },
  });
};

const applyTaskDoneEvent = (payload) => {
  if (payload.type !== "task:done") {
    return;
  }
  if (!selectedRoleId.value || payload.roleId !== selectedRoleId.value) {
    return;
  }

  const taskIndex = tasks.value.findIndex(
    (task) => task.id === payload.taskConfigId,
  );

  if (taskIndex === -1) {
    refreshTasks();
    return;
  }

  const currentTask = tasks.value[taskIndex];
  const nextLogs = Array.isArray(currentTask.logs) ? [...currentTask.logs] : [];
  nextLogs.push({
    id: `${payload.taskConfigId}_${Date.now()}`,
    timestamp: Date.now(),
    type: "success",
    message: payload.message || t("dailyTasks.messages.taskDone"),
  });

  tasks.value[taskIndex] = {
    ...currentTask,
    completed: true,
    completedAt: payload.at || new Date().toISOString(),
    logs: nextLogs,
  };

  message.info(
    t("dailyTasks.messages.scheduledUpdate", {
      title: currentTask.title,
    }),
  );
};

onMounted(async () => {
  await authStore.initAuth();
  if (!authStore.isAuthenticated) {
    router.push("/login");
    return;
  }

  connectBackendWs(authStore.token || null);
  unsubscribeBackendWs = subscribeBackendWs(applyTaskDoneEvent);

  if (gameRolesStore.gameRoles.length === 0) {
    await gameRolesStore.fetchGameRoles();
  }

  if (gameRolesStore.selectedRole) {
    selectedRoleId.value = gameRolesStore.selectedRole.id;
    refreshTasks();
  } else if (gameRolesStore.gameRoles.length > 0) {
    selectedRoleId.value = gameRolesStore.gameRoles[0].id;
    onRoleChange(selectedRoleId.value);
  }
});

onBeforeUnmount(() => {
  if (unsubscribeBackendWs) {
    unsubscribeBackendWs();
    unsubscribeBackendWs = null;
  }
  disconnectBackendWs();
});

watch(
  () => gameRolesStore.selectedRole,
  (newRole) => {
    if (newRole && newRole.id !== selectedRoleId.value) {
      selectedRoleId.value = newRole.id;
    }
  },
);
</script>

<style scoped lang="scss">
.daily-tasks-page {
  min-height: 100dvh;
  animation: daily-fade-in 0.42s ease;
}

.task-role-card,
.task-tip-card,
.filter-card,
.tasks-card {
  padding: clamp(18px, 2vw, 24px);
}

.section-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);

  h2 {
    margin: 0 0 6px;
    font-size: var(--font-size-xl);
    color: var(--text-primary);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
    line-height: 1.6;
  }
}

.section-head--compact {
  margin-bottom: var(--spacing-md);
}

.role-selector-shell {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.selector-group {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: min(100%, 320px);
  flex: 1 1 320px;
}

.selector-label {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.role-select {
  width: 100%;
}

.role-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(120px, 1fr));
  gap: var(--spacing-sm);
  flex: 1 1 360px;
}

.role-stat-box {
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-large);
  padding: var(--spacing-md);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.role-stat-box__label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.role-stat-box__value {
  color: var(--text-primary);
  font-size: clamp(20px, 2vw, 26px);
  font-weight: var(--font-weight-bold);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.task-tip-card {
  height: 100%;
}

.tips-list {
  margin: 0;
  padding-left: 18px;
  color: var(--text-secondary);
  display: grid;
  gap: 10px;
  line-height: 1.6;
}

.filter-bar-shell {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-lg);
  flex-wrap: wrap;
}

.search-box {
  width: min(100%, 320px);
  margin-left: auto;
}

.tasks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-lg);
}

.empty-state,
.loading-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 320px;
}

@keyframes daily-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 959px) {
  .task-role-card,
  .task-tip-card,
  .filter-card,
  .tasks-card {
    padding: var(--spacing-lg);
  }

  .role-selector-shell,
  .filter-bar-shell {
    align-items: stretch;
  }

  .search-box {
    width: 100%;
    margin-left: 0;
  }
}

@media (max-width: 640px) {
  .daily-tasks-page :deep(.n-button) {
    min-height: 40px;
  }

  .role-stats-grid {
    grid-template-columns: 1fr;
    width: 100%;
  }

  .filter-bar-shell {
    flex-direction: column;
    align-items: stretch;
  }

  .tasks-grid {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }
}
</style>
