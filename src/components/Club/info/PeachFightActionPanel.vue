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
  margin: 15px 0;
  display: flex;
  justify-content: flex-start;
}

.fight-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.fight-count-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
}

.fight-count-label {
  font-size: var(--font-size-sm, 14px);
  color: var(--text-primary, #333);
  font-weight: var(--font-weight-medium, 500);
  white-space: nowrap;
}

.fight-count-input {
  width: 100px;
}

.fight-count-hint {
  font-size: var(--font-size-xs, 12px);
  color: var(--text-secondary, #999);
}

.mr-8 {
  margin-right: 8px;
}

@media (max-width: 768px) {
  .action-section {
    flex-wrap: wrap;
    gap: 8px;
  }

  .fight-inline {
    flex-wrap: wrap;
    width: 100%;
  }

  .fight-count-container {
    flex-wrap: wrap;
    margin-right: 0;
    width: 100%;
  }

  .fight-count-input {
    width: 100%;
    min-width: 0;
  }
}
</style>
