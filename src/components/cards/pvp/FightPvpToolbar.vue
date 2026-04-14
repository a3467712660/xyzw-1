<template>
  <div class="action-section">
    <div class="input-group">
      <n-input
        class="target-input"
        size="medium"
        type="text"
        v-model:value="targetIdModel"
        :placeholder="t('fightPvpCard.placeholders.targetId')"
      ></n-input>
      <n-button
        size="medium"
        type="primary"
        :disabled="loading || !targetId"
        @click="$emit('query-target')"
      >
        <template #icon>
          <n-icon><Refresh></Refresh></n-icon>
        </template>
        {{ t("fightPvpCard.actions.queryTarget") }}
      </n-button>
    </div>

    <div class="fight-options">
      <div class="option-item">
        <span class="option-label">{{ t("fightPvpCard.labels.fightCount") }}</span>
        <n-select
          allow-create
          filterable
          tag
          class="fight-count-select"
          size="medium"
          v-model:value="fightNumModel"
          :options="options"
          :placeholder="t('fightPvpCard.placeholders.fightCount')"
          @update:value="$emit('normalize-fight-num')"
        ></n-select>
      </div>

      <div class="option-actions">
        <n-button
          size="medium"
          type="success"
          :disabled="loading || !targetId || !hasMemberData"
          @click="$emit('start-fight')"
        >
          <template #icon>
            <n-icon><Trophy></Trophy></n-icon>
          </template>
          {{ t("fightPvpCard.actions.startFight") }}
        </n-button>

        <n-button
          size="medium"
          type="default"
          :disabled="loading || !hasMemberData"
          @click="$emit('export-data')"
        >
          <template #icon>
            <n-icon><Copy></Copy></n-icon>
          </template>
          {{ t("fightPvpCard.actions.exportData") }}
        </n-button>

        <n-button
          size="medium"
          type="default"
          :disabled="loading || !hasTargetRawInfo"
          @click="$emit('export-raw')"
        >
          <template #icon>
            <n-icon><DocumentText></DocumentText></n-icon>
          </template>
          {{ t("fightPvpCard.actions.exportRaw") }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Copy, DocumentText, Refresh, Trophy } from "@vicons/ionicons5";

const props = defineProps({
  fightNum: {
    type: [String, Number],
    default: 1,
  },
  hasMemberData: {
    type: Boolean,
    default: false,
  },
  hasTargetRawInfo: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  options: {
    type: Array,
    default: () => [],
  },
  t: {
    type: Function,
    required: true,
  },
  targetId: {
    type: [String, Number],
    default: "",
  },
});

const emit = defineEmits([
  "export-data",
  "export-raw",
  "normalize-fight-num",
  "query-target",
  "start-fight",
  "update:fight-num",
  "update:target-id",
]);

const targetIdModel = computed({
  get: () => props.targetId,
  set: (value) => emit("update:target-id", value),
});

const fightNumModel = computed({
  get: () => props.fightNum,
  set: (value) => emit("update:fight-num", value),
});
</script>

<style scoped lang="scss">
.action-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input-group,
.fight-options,
.option-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.input-group {
  align-items: stretch;
}

.target-input {
  flex: 1;
  min-width: 200px;
}

.option-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.option-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.fight-count-select {
  width: 120px;
}

@media (max-width: 768px) {
  .input-group,
  .fight-options {
    flex-direction: column;
    align-items: stretch;
  }

  .option-actions {
    width: 100%;
  }

  .option-actions :deep(.n-button) {
    flex: 1;
  }
}
</style>
