<template>
  <div class="tasks-list">
    <div v-for="task in scheduledTasks" :key="task.id" class="task-item">
      <div class="task-item-head">
        <div class="task-item-title">{{ task.name }}</div>
        <n-switch
          :value="task.enabled"
          @update:value="onToggleTaskEnabled(task.id, $event)"
        ></n-switch>
      </div>
      <div class="task-item-row">
        <span class="task-item-label">运行类型：</span>
        <span>{{ task.runType === "daily" ? "每天固定时间" : "Cron表达式" }}</span>
      </div>
      <div class="task-item-row">
        <span class="task-item-label">运行时间：</span>
        <span>{{ task.runType === "daily" ? task.runTime : task.cronExpression }}</span>
      </div>
      <div class="task-item-row">
        <span class="task-item-label">下次执行：</span>
        <span
          class="task-next-run"
          :class="taskCountdowns[task.id]?.isNearExecution ? 'is-near' : 'is-normal'"
        >
          {{ task.enabled ? taskCountdowns[task.id]?.formatted || "计算中..." : "已禁用" }}
        </span>
      </div>
      <div class="task-item-row">
        <span class="task-item-label">选中账号：</span>
        <span>{{ task.selectedTokens.length }} 个</span>
      </div>
      <div class="task-item-row task-item-row-last">
        <span class="task-item-label">选中任务：</span>
        <span>{{ task.selectedTasks.length }} 个</span>
      </div>
      <div class="task-item-actions">
        <n-button size="tiny" @click="onEditTask(task)">编辑</n-button>
        <n-button size="tiny" type="error" @click="onDeleteTask(task.id)">
          删除
        </n-button>
        <n-button
          secondary
          size="tiny"
          type="info"
          :loading="executingTaskIds.includes(task.id)"
          @click="onManualExecuteTask(task)"
        >
          立即执行
        </n-button>
      </div>
    </div>
    <div v-if="scheduledTasks.length === 0" class="task-empty-state">
      暂无定时任务
    </div>
  </div>
</template>

<script setup>
defineProps({
  executingTaskIds: {
    type: Array,
    default: () => [],
  },
  onDeleteTask: {
    type: Function,
    required: true,
  },
  onEditTask: {
    type: Function,
    required: true,
  },
  onManualExecuteTask: {
    type: Function,
    required: true,
  },
  onToggleTaskEnabled: {
    type: Function,
    required: true,
  },
  scheduledTasks: {
    type: Array,
    default: () => [],
  },
  taskCountdowns: {
    type: Object,
    default: () => ({}),
  },
});
</script>

<style scoped lang="scss">
.tasks-list {
  max-height: 600px;
  overflow-y: auto;
}

.task-item {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 8px;
  background: var(--surface-glass-strong);
}

.task-item-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.task-item-title {
  font-weight: 700;
}

.task-item-row {
  margin-bottom: 4px;
}

.task-item-row-last {
  margin-bottom: 8px;
}

.task-item-label {
  color: var(--text-tertiary);
}

.task-item-actions {
  display: flex;
  gap: 8px;
}

.task-next-run {
  font-weight: 700;
}

.task-next-run.is-near {
  color: #ff4d4f;
}

.task-next-run.is-normal {
  color: #1677ff;
}

.task-empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-tertiary);
}
</style>
