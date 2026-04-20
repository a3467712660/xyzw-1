<template>
  <div class="page-header batch-header">
    <div class="batch-header__main">
      <div class="batch-header__copy">
        <span class="batch-header__eyebrow">批量执行控制台</span>
        <h2>批量日常任务</h2>
        <p>统一管理定时任务、账号分组、批量执行和配置导入导出。</p>
      </div>

      <div class="batch-header__stats">
        <div class="batch-header__stat">
          <span>定时任务</span>
          <strong>{{ scheduledTaskCount }}</strong>
        </div>
        <div class="batch-header__stat">
          <span>已选账号</span>
          <strong>{{ selectedTokenCount }}</strong>
        </div>
        <div class="batch-header__stat batch-header__stat--wide">
          <span>下一次执行</span>
          <strong v-if="shortestCountdownTask">
            {{ shortestCountdownTask.task.name }}
          </strong>
          <strong v-else>暂无定时任务</strong>
          <em v-if="shortestCountdownTask">
            {{ shortestCountdownTask.countdown.formatted }}
          </em>
          <em v-else>去新增一个自动任务</em>
        </div>
      </div>

      <div class="batch-header__secondary-actions">
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

    <div class="header-action-chip batch-header__primary-actions">
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

<style scoped lang="scss">
.batch-header {
  position: relative;
  overflow: hidden;
}

.batch-header::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background-image:
    linear-gradient(var(--console-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--console-grid-line) 1px, transparent 1px);
  background-size: 26px 26px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.18), transparent 64%);
  opacity: 0.18;
}

.batch-header {
  display: grid;
  gap: 18px;
  padding: clamp(18px, 2vw, 24px);
  border: 1px solid var(--surface-glass-border);
  border-radius: 28px;
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.14), transparent 70%),
    var(--surface-glass-strong);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(12px);
}

.batch-header__main {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, auto);
  gap: 18px;
  align-items: start;
}

.batch-header__copy {
  display: grid;
  gap: 8px;
}

.batch-header__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.batch-header__copy h2 {
  margin: 0;
  font-size: clamp(30px, 4vw, 42px);
  line-height: 1;
  color: var(--text-primary);
}

.batch-header__copy p {
  margin: 0;
  max-width: 70ch;
  color: var(--text-secondary);
  line-height: 1.7;
}

.batch-header__stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(140px, 1fr));
  gap: 12px;
}

.batch-header__stat {
  display: grid;
  gap: 6px;
  padding: 14px 16px;
  border: 1px solid rgba(63, 119, 173, 0.14);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 84%),
    rgba(255, 255, 255, 0.32);
}

.batch-header__stat--wide {
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.12), transparent 75%),
    rgba(255, 255, 255, 0.38);
}

.batch-header__stat span {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
}

.batch-header__stat strong {
  font-size: 22px;
  line-height: 1.2;
  color: var(--text-primary);
}

.batch-header__stat em {
  font-style: normal;
  color: var(--primary-color);
  font-size: 13px;
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.batch-header__secondary-actions,
.batch-header__primary-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.batch-header__secondary-actions {
  align-items: center;
}

.batch-header__primary-actions {
  padding: 14px 16px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.08), transparent 82%),
    var(--surface-glass);
  justify-content: flex-end;
}

@media (max-width: 960px) {
  .batch-header__main {
    grid-template-columns: 1fr;
  }

  .batch-header__stats {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .batch-header {
    padding: 18px;
    border-radius: 22px;
  }

  .batch-header__copy h2 {
    font-size: 28px;
  }

  .batch-header__secondary-actions,
  .batch-header__primary-actions {
    width: 100%;
  }

  .batch-header__secondary-actions :deep(.n-button),
  .batch-header__primary-actions :deep(.n-button) {
    min-height: 40px;
  }
}
</style>
