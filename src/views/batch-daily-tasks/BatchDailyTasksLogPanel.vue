<template>
  <div class="right-column">
    <n-card class="log-card">
      <template #header>
        <div class="custom-card-header">
          <div class="card-title">
            {{ currentRunningTokenName ? `正在执行: ${currentRunningTokenName}` : "执行日志" }}
            <span class="log-count-meta">{{ logs.length }}/{{ maxLogEntries }}</span>
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
        <div
          v-for="(log, index) in filteredLogs"
          :key="index"
          class="log-item"
          :class="log.type"
        >
          <span class="time">{{ log.time }}</span>
          <span class="message">{{ log.message }}</span>
        </div>
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
