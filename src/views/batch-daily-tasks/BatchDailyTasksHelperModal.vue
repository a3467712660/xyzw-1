<template>
  <n-modal
    preset="card"
    style="width: min(400px, calc(100vw - 24px))"
    :show="show"
    :title="title"
    @update:show="$emit('update:show', $event)"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <div v-if="helperType === 'box'" class="setting-item">
          <label class="setting-label">宝箱类型</label>
          <n-select
            size="small"
            :options="boxTypeOptions"
            :value="helperSettings.boxType"
            @update:value="$emit('update-field', 'boxType', $event)"
          ></n-select>
        </div>
        <div v-if="helperType === 'fish'" class="setting-item">
          <label class="setting-label">鱼竿类型</label>
          <n-select
            size="small"
            :options="fishTypeOptions"
            :value="helperSettings.fishType"
            @update:value="$emit('update-field', 'fishType', $event)"
          ></n-select>
        </div>
        <div class="setting-item">
          <label class="setting-label">消耗数量（10的倍数）</label>
          <n-input-number
            size="small"
            :max="10000"
            :min="10"
            :step="10"
            :value="helperSettings.count"
            @update:value="$emit('update-field', 'count', $event)"
          ></n-input-number>
        </div>
      </div>
      <div class="modal-actions">
        <n-button @click="$emit('update:show', false)">取消</n-button>
        <n-button type="primary" @click="$emit('execute')">开始执行</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
defineProps({
  boxTypeOptions: {
    type: Array,
    default: () => [],
  },
  fishTypeOptions: {
    type: Array,
    default: () => [],
  },
  helperSettings: {
    type: Object,
    required: true,
  },
  helperType: {
    type: String,
    default: "",
  },
  show: Boolean,
  title: {
    type: String,
    default: "",
  },
});

defineEmits(["execute", "update-field", "update:show"]);
</script>

<style scoped lang="scss">
.settings-content,
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.modal-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}
</style>
