<template>
  <div class="page-header">
    <div class="header-left-wrap">
      <h2>批量日常任务</h2>
      <div class="header-info-chip">
        <div class="chip-text-main">共 {{ scheduledTaskCount }} 个定时任务</div>
        <div v-if="shortestCountdownTask" class="chip-text-highlight">
          即将执行：{{ shortestCountdownTask.task.name }} ({{
            shortestCountdownTask.countdown.formatted
          }})
        </div>
        <div v-else class="chip-text-muted">暂无定时任务</div>
        <div class="chip-actions">
          <n-button size="small" type="primary" @click="$emit('open-task-modal')">
            新增定时任务
          </n-button>
          <n-button size="small" @click="$emit('open-tasks-modal')">
            查看定时任务
          </n-button>
          <n-button size="small" @click="$emit('export-config')">
            导出配置
          </n-button>
          <n-upload
            accept=".json"
            :custom-request="importConfig"
            :show-file-list="false"
          >
            <n-button size="small">导入配置</n-button>
          </n-upload>
        </div>
      </div>
    </div>

    <div class="header-action-chip">
      <n-button
        size="medium"
        type="primary"
        :disabled="isRunning || selectedTokenCount === 0"
        @click="$emit('start-batch')"
      >
        {{ isRunning ? "执行中..." : "开始执行" }}
      </n-button>
      <n-button
        size="medium"
        type="error"
        :disabled="!isRunning"
        @click="$emit('stop-batch')"
      >
        停止
      </n-button>
      <n-button size="medium" type="info" @click="$emit('open-template-manager')">
        任务模板
      </n-button>
      <n-button size="medium" type="default" @click="$emit('open-batch-settings')">
        <template #icon>
          <n-icon>
            <Settings></Settings>
          </n-icon>
        </template>
        设置
      </n-button>
    </div>
  </div>
</template>

<script setup>
import { Settings } from "@vicons/ionicons5";

defineProps({
  importConfig: {
    type: Function,
    required: true,
  },
  isRunning: {
    type: Boolean,
    default: false,
  },
  scheduledTaskCount: {
    type: Number,
    default: 0,
  },
  selectedTokenCount: {
    type: Number,
    default: 0,
  },
  shortestCountdownTask: {
    type: Object,
    default: null,
  },
});

defineEmits([
  "export-config",
  "open-batch-settings",
  "open-task-modal",
  "open-tasks-modal",
  "open-template-manager",
  "start-batch",
  "stop-batch",
]);
</script>
