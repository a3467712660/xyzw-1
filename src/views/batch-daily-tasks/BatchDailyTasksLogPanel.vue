<template>
  <div class="right-column batch-log-panel">
    <n-card class="log-card">
      <template #header>
        <div class="custom-card-header batch-log-panel__header">
          <div class="batch-log-panel__copy">
            <span class="batch-log-panel__eyebrow">执行日志</span>
            <div class="card-title">
              {{ currentRunningTokenName ? `正在执行：${currentRunningTokenName}` : "等待执行" }}
            </div>
            <p class="batch-log-panel__subtitle">
              当前进度 {{ currentProgress }}% · 已记录 {{ logs.length }}/{{ maxLogEntries }} 条
            </p>
          </div>

          <div class="log-header-controls">
            <n-checkbox size="small" v-model:checked="autoScrollLogModel">
              自动滚动
            </n-checkbox>
            <n-checkbox size="small" v-model:checked="filterErrorsOnlyModel">
              只看错误
            </n-checkbox>
            <n-tag v-if="errorCount > 0" size="small" type="error">
              {{ errorCount }} 个错误
            </n-tag>
            <n-button size="small" @click="$emit('clear-logs')">清空日志</n-button>
            <n-button size="small" @click="$emit('copy-logs')">复制日志</n-button>
          </div>
        </div>
      </template>

      <n-progress
        processing
        indicator-placement="inside"
        type="line"
        :percentage="currentProgress"
      ></n-progress>

      <div :ref="setLogContainer" class="log-container">
        <div v-if="filteredLogs.length === 0" class="log-empty">
          当前没有可展示的日志记录。
        </div>

        <template v-else>
          <div
            v-for="(log, index) in filteredLogs"
            :key="index"
            class="log-item"
            :class="`log-item--${log.type || 'info'}`"
          >
            <span class="log-item__time">{{ log.time }}</span>
            <span class="log-item__message">{{ log.message }}</span>
          </div>
        </template>
      </div>
    </n-card>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  autoScrollLog: {
    type: Boolean,
    default: true,
  },
  currentProgress: {
    type: Number,
    default: 0,
  },
  currentRunningTokenName: {
    type: String,
    default: "",
  },
  errorCount: {
    type: Number,
    default: 0,
  },
  filteredLogs: {
    type: Array,
    default: () => [],
  },
  filterErrorsOnly: {
    type: Boolean,
    default: false,
  },
  logs: {
    type: Array,
    default: () => [],
  },
  maxLogEntries: {
    type: Number,
    default: 1000,
  },
  setLogContainer: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits([
  "clear-logs",
  "copy-logs",
  "update:autoScrollLog",
  "update:filterErrorsOnly",
]);

const autoScrollLogModel = computed({
  get: () => props.autoScrollLog,
  set: (value) => emit("update:autoScrollLog", value),
});

const filterErrorsOnlyModel = computed({
  get: () => props.filterErrorsOnly,
  set: (value) => emit("update:filterErrorsOnly", value),
});
</script>

<style scoped lang="scss">
.log-card {
  border-radius: 26px;
}

.batch-log-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.log-card {
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 100%;
}

.batch-log-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.batch-log-panel__copy {
  display: grid;
  gap: 6px;
}

.batch-log-panel__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.card-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
}

.batch-log-panel__subtitle {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.log-header-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
}

.log-card :deep(.n-card__content) {
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
  gap: 12px;
}

.log-container {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 8px;
  min-height: 260px;
  margin-top: 12px;
  padding: 12px;
  overflow-y: auto;
  border: 1px solid var(--surface-glass-border);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(63, 119, 173, 0.06), transparent 12%),
    var(--surface-glass);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12);
}

.log-empty {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-tertiary);
}

.log-item {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid transparent;
  background: rgba(255, 255, 255, 0.18);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease;
}

.log-item:hover {
  transform: translateY(-1px);
  border-color: rgba(63, 119, 173, 0.18);
}

.log-item--success {
  color: #18a058;
  border-color: rgba(24, 160, 88, 0.18);
  background: rgba(24, 160, 88, 0.08);
}

.log-item--warning {
  color: #f0a020;
  border-color: rgba(240, 160, 32, 0.18);
  background: rgba(240, 160, 32, 0.1);
}

.log-item--error {
  color: #d03050;
  border-color: rgba(208, 48, 80, 0.18);
  background: rgba(208, 48, 80, 0.08);
}

.log-item--info {
  color: var(--text-primary);
  border-color: rgba(63, 119, 173, 0.12);
}

.log-item__time {
  color: var(--text-tertiary);
}

.log-item__message {
  line-height: 1.6;
}

@media (max-width: 992px) {
  .log-card {
    min-height: 420px;
  }
}

@media (max-width: 768px) {
  .log-card {
    border-radius: 20px;
  }

  .batch-log-panel__header {
    flex-direction: column;
  }

  .log-header-controls {
    justify-content: flex-start;
  }
}
</style>
