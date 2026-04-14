<template>
  <div class="lineup-apply-status-panel">
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
  </div>
</template>

<script setup>
defineProps({
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
  overdue: Boolean,
  percent: {
    type: Number,
    default: 0,
  },
  remainingText: {
    type: String,
    default: "",
  },
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
</script>

<style scoped lang="scss">
.lineup-apply-status-panel,
.apply-progress-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.apply-progress-stage {
  font-size: 14px;
  font-weight: 600;
  color: #dce8ff;
}

.apply-progress-bar-top {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: rgba(232, 240, 255, 0.72);
}

.apply-progress-time-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
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
</style>
