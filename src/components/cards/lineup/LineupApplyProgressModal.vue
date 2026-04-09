<template>
  <n-modal
    preset="card"
    style="width: 420px; max-width: 90vw"
    :bordered="false"
    :close-on-esc="false"
    :mask-closable="false"
    :show="show"
    :show-close="false"
  >
    <div class="apply-progress-modal">
      <div class="apply-progress-header">
        <div class="apply-progress-title">正在应用阵容</div>
        <div class="apply-progress-subtitle">
          应用过程中请勿关闭页面或重复点击
        </div>
      </div>
      <n-spin :show="spinning">
        <div class="apply-progress-body">
          <div class="apply-progress-stage">
            {{ stage || "正在准备" }}
          </div>
          <div class="apply-progress-bar-wrap">
            <div class="apply-progress-bar-top">
              <span>执行进度</span>
              <span>{{ percent }}%</span>
            </div>
            <n-progress
              type="line"
              :border-radius="999"
              :height="10"
              :percentage="percent"
              :processing="spinning && !overdue"
              :show-indicator="false"
              :status="status"
            ></n-progress>
          </div>
          <div class="apply-progress-time-grid">
            <div class="apply-progress-time-item">
              <span class="label">预计总时长</span>
              <span class="value">{{ estimatedText }}</span>
            </div>
            <div class="apply-progress-time-item">
              <span class="label">预计完成</span>
              <span class="value">{{ finishText }}</span>
            </div>
            <div class="apply-progress-time-item">
              <span class="label">已用时间</span>
              <span class="value">{{ elapsedText }}</span>
            </div>
            <div class="apply-progress-time-item">
              <span class="label">剩余时间</span>
              <span class="value">{{ remainingText }}</span>
            </div>
          </div>
          <div v-if="overdue" class="apply-progress-tip">
            已超过预计时间，仍在继续执行，请保持前台等待完成
          </div>
          <div v-if="debugMode" class="apply-debug-panel">
            <div class="apply-debug-header-row">
              <div class="apply-debug-title">
                分步调试
                <span v-if="debugLineupName">· {{ debugLineupName }}</span>
              </div>
              <div class="apply-debug-state">
                {{
                  debugFinished
                    ? "已结束"
                    : debugPaused
                      ? "等待执行下一步"
                      : "执行中"
                }}
              </div>
            </div>
            <div class="apply-debug-step-list">
              <div
                v-for="step in debugSteps"
                :key="step.key"
                class="apply-debug-step"
                :class="`is-${step.status}`"
              >
                <div class="apply-debug-step-main">
                  <span class="apply-debug-step-index">{{ step.order }}</span>
                  <span class="apply-debug-step-label">{{ step.label }}</span>
                  <span class="apply-debug-step-status">
                    {{ formatStepStatus(step.status) }}
                  </span>
                </div>
                <div v-if="step.detail" class="apply-debug-step-detail">
                  {{ step.detail }}
                </div>
                <div
                  v-if="Array.isArray(step.commands) && step.commands.length > 0"
                  class="apply-debug-step-commands"
                >
                  <div class="apply-debug-step-commands-title">本步骤命令</div>
                  <div class="apply-debug-step-command-list">
                    <span
                      v-for="(command, commandIndex) in step.commands"
                      :key="`${step.key}-${commandIndex}-${command}`"
                      class="apply-debug-step-command"
                    >
                      {{ command }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div class="apply-debug-actions">
              <n-button
                v-if="!debugFinished"
                size="small"
                type="primary"
                :disabled="!debugPaused"
                @click="$emit('continue-debug')"
              >
                执行下一步
              </n-button>
              <n-button
                v-if="!debugFinished"
                size="small"
                @click="$emit('abort-debug')"
              >
                中止调试
              </n-button>
              <n-button
                v-else
                size="small"
                type="primary"
                @click="$emit('close-debug')"
              >
                关闭
              </n-button>
            </div>
          </div>
        </div>
      </n-spin>
    </div>
  </n-modal>
</template>

<script setup>
defineProps({
  debugFinished: Boolean,
  debugLineupName: {
    type: String,
    default: "",
  },
  debugMode: Boolean,
  debugPaused: Boolean,
  debugSteps: {
    type: Array,
    default: () => [],
  },
  elapsedText: {
    type: String,
    default: "",
  },
  estimatedText: {
    type: String,
    default: "",
  },
  finishText: {
    type: String,
    default: "",
  },
  formatStepStatus: {
    type: Function,
    required: true,
  },
  overdue: Boolean,
  percent: {
    type: Number,
    default: 0,
  },
  remainingText: {
    type: String,
    default: "",
  },
  show: Boolean,
  spinning: Boolean,
  stage: {
    type: String,
    default: "",
  },
  status: {
    type: String,
    default: "success",
  },
});

defineEmits(["abort-debug", "close-debug", "continue-debug"]);
</script>

<style scoped lang="scss">
.apply-progress-modal {
  background: linear-gradient(180deg, rgba(14, 20, 33, 0.96), rgba(7, 11, 20, 0.92));
  border: 1px solid rgba(112, 181, 255, 0.18);
  border-radius: 20px;
  padding: 12px;
}

.apply-progress-header {
  margin-bottom: 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.apply-progress-title {
  font-size: 18px;
  font-weight: 700;
  color: #f5f8ff;
}

.apply-progress-subtitle {
  font-size: 13px;
  color: rgba(232, 240, 255, 0.72);
}

.apply-progress-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.apply-progress-stage {
  font-size: 14px;
  font-weight: 600;
  color: #dce8ff;
}

.apply-progress-time-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.apply-progress-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.apply-progress-bar-top {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.72);
}

.apply-progress-time-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
}

.apply-progress-time-item .label {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.62);
}

.apply-progress-time-item .value {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.apply-progress-tip {
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 170, 64, 0.12);
  color: #ffd28f;
  font-size: 12px;
}

.apply-debug-panel {
  padding: 12px;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.apply-debug-header-row,
.apply-debug-step-main,
.apply-debug-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.apply-debug-title,
.apply-debug-step-label {
  font-weight: 600;
  color: #f5f8ff;
}

.apply-debug-state,
.apply-debug-step-status,
.apply-debug-step-detail,
.apply-debug-step-commands-title {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.72);
}

.apply-debug-step-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 260px;
  overflow: auto;
}

.apply-debug-step {
  padding: 10px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
}

.apply-debug-step-index {
  width: 20px;
  height: 20px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(112, 181, 255, 0.22);
  color: #cfe3ff;
  font-size: 11px;
}

.apply-debug-step-command-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 6px;
}

.apply-debug-step-command {
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(112, 181, 255, 0.14);
  color: #dce8ff;
  font-size: 11px;
}
</style>
