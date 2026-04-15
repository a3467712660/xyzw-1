<template>
  <div class="action-section">
    <div class="fight-inline">
      <div class="fight-count-container">
        <label class="fight-count-label" :for="inputId">
          {{ countLabel }}
        </label>
        <NInput
          :id="inputId"
          class="fight-count-input"
          max="100"
          min="1"
          size="small"
          type="number"
          :placeholder="countPlaceholder"
          :step="1"
          :value="fightCount"
          @input="$emit('validate', $event)"
          @update:value="$emit('update:fight-count', $event)"
        ></NInput>
        <div class="fight-count-hint">{{ rangeHint }}</div>
      </div>
      <NButton class="mr-8" size="small" type="tertiary" @click="$emit('close')">
        {{ closeText }}
      </NButton>
    </div>
    <NButton type="primary" :disabled="!isFightCountValid" @click="$emit('start')">
      {{ startText }}
    </NButton>
  </div>
</template>

<script setup>
import { NButton, NInput } from "naive-ui/es";

defineProps({
  closeText: {
    type: String,
    default: "关闭",
  },
  countLabel: {
    type: String,
    default: "切磋次数",
  },
  countPlaceholder: {
    type: String,
    default: "",
  },
  fightCount: {
    type: [Number, String],
    default: 1,
  },
  inputId: {
    type: String,
    default: "fightCount",
  },
  isFightCountValid: {
    type: Boolean,
    default: true,
  },
  rangeHint: {
    type: String,
    default: "范围 1-100",
  },
  startText: {
    type: String,
    default: "开始切磋",
  },
});

defineEmits(["close", "start", "update:fight-count", "validate"]);
</script>

<style scoped lang="scss">
.action-section {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.fight-inline {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.fight-count-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 132px;
}

.fight-count-label {
  font-size: 13px;
  font-weight: 600;
}

.fight-count-input {
  width: 132px;
}

.fight-count-hint {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.65);
}

.mr-8 {
  margin-right: 8px;
}

@media (max-width: 768px) {
  .action-section {
    align-items: stretch;
  }

  .fight-inline {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
