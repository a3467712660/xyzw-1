<template>
  <div class="refine-auto-conditions-panel gwb2-mini-card__stack">
    <div class="gwb2-mini-card__section-title">{{ title }}</div>

    <div class="gwb2-mini-card__list conditions-list">
      <div
        v-for="(condition, index) in conditions"
        :key="index"
        class="condition-item"
      >
        <div class="auto-form">
          <div class="form-item">
            <span class="form-label">{{ attributeLabel }}</span>
            <n-select
              size="small"
              :options="attrOptions"
              :placeholder="attributePlaceholder"
              :value="condition.attrId"
              @update:value="$emit('update-condition-attr', { index, value: $event })"
            ></n-select>
          </div>
          <div class="form-item">
            <span class="form-label">≥</span>
            <n-input-number
              size="small"
              :max="100"
              :min="1"
              :value="condition.attrValue"
              @update:value="$emit('update-condition-value', { index, value: $event })"
            ></n-input-number>
          </div>
          <div class="form-item">
            <n-button
              size="small"
              type="error"
              :disabled="conditions.length <= 1"
              @click="$emit('remove-condition', index)"
            >
              {{ removeText }}
            </n-button>
          </div>
        </div>
      </div>
    </div>

    <div class="add-condition">
      <n-button size="small" type="primary" @click="$emit('add-condition')">
        {{ addText }}
      </n-button>
    </div>

    <div class="delay-setting">
      <div class="auto-form">
        <div class="form-item">
          <span class="form-label">{{ delayLabel }}</span>
          <n-input-number
            size="small"
            :min="0"
            :step="100"
            :value="delay"
            @update:value="$emit('update-delay', $event)"
          ></n-input-number>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  addText: {
    type: String,
    default: "添加条件",
  },
  attrOptions: {
    type: Array,
    default: () => [],
  },
  attributeLabel: {
    type: String,
    default: "属性",
  },
  attributePlaceholder: {
    type: String,
    default: "选择属性",
  },
  conditions: {
    type: Array,
    default: () => [],
  },
  delay: {
    type: Number,
    default: 0,
  },
  delayLabel: {
    type: String,
    default: "延迟",
  },
  removeText: {
    type: String,
    default: "删除",
  },
  title: {
    type: String,
    default: "自动条件",
  },
});

defineEmits([
  "add-condition",
  "remove-condition",
  "update-condition-attr",
  "update-condition-value",
  "update-delay",
]);
</script>

<style scoped lang="scss">
.conditions-list {
  gap: var(--spacing-sm);
}

.condition-item {
  padding: var(--spacing-sm);
  background: rgba(223, 231, 239, 0.36);
  border-radius: 12px;
  border: 1px solid rgba(78, 94, 116, 0.12);
}

.auto-form {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.form-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  flex: 1 1 0;
  min-width: 0;
}

.form-item :deep(.n-select),
.form-item :deep(.n-input-number) {
  width: 100%;
}

.form-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  white-space: nowrap;
}

.add-condition {
  display: flex;
  justify-content: flex-start;
}

.delay-setting {
  padding-top: var(--spacing-sm);
  border-top: 1px dashed rgba(78, 94, 116, 0.18);
}

@media (max-width: 959px) {
  .auto-form,
  .form-item {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
