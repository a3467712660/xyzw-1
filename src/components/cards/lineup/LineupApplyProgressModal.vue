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
      <n-spin :show="spinning">
        <LineupRuntimeStatusPanel
          :debug-finished="debugFinished"
          :debug-lineup-name="debugLineupName"
          :debug-mode="debugMode"
          :debug-paused="debugPaused"
          :debug-steps="debugSteps"
          :format-step-status="formatStepStatus"
          @abort-debug="$emit('abort-debug')"
          @close-debug="$emit('close-debug')"
          @continue-debug="$emit('continue-debug')"
        >
          <LineupApplyStatusPanel
            :elapsed-text="elapsedText"
            :estimated-text="estimatedText"
            :finish-text="finishText"
            :overdue="overdue"
            :percent="percent"
            :remaining-text="remainingText"
            :spinning="spinning"
            :stage="stage"
            :status="status"
          ></LineupApplyStatusPanel>
        </LineupRuntimeStatusPanel>
      </n-spin>
    </div>
  </n-modal>
</template>

<script setup>
import LineupApplyStatusPanel from "./LineupApplyStatusPanel.vue";
import LineupRuntimeStatusPanel from "./LineupRuntimeStatusPanel.vue";

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
</style>
