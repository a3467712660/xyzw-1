<template>
  <n-modal
    class="modal-w-400"
    preset="card"
    :show="show"
    :title="templateId ? '编辑任务模板' : '任务模板设置'"
    @update:show="$emit('update:show', $event)"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">模板名称</label>
          <n-input
            placeholder="请输入模板名称"
            size="small"
            :value="templateName"
            @update:value="$emit('update:template-name', $event)"
          ></n-input>
        </div>
      </div>
      <BatchDailyTaskSettingsForm
        :boss-times-options="bossTimesOptions"
        :formation-options="formationOptions"
        :settings="template"
        @update-field="(key, value) => $emit('update-field', key, value)"
      ></BatchDailyTaskSettingsForm>
      <div class="modal-actions modal-actions-right">
        <n-button class="btn-mr" @click="$emit('update:show', false)">取消</n-button>
        <n-button type="primary" @click="$emit('save')">保存模板</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import BatchDailyTaskSettingsForm from "./BatchDailyTaskSettingsForm.vue";

defineProps({
  bossTimesOptions: {
    type: Array,
    default: () => [],
  },
  formationOptions: {
    type: Array,
    default: () => [],
  },
  show: Boolean,
  template: {
    type: Object,
    required: true,
  },
  templateId: {
    type: [String, Number, null],
    default: null,
  },
  templateName: {
    type: String,
    default: "",
  },
});

defineEmits(["save", "update-field", "update:show", "update:template-name"]);
</script>

<style scoped lang="scss">
.modal-w-400 {
  width: 90%;
  max-width: 400px;
}

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

.modal-actions-right {
  margin-top: 20px;
  text-align: right;
}

.btn-mr {
  margin-right: 12px;
}
</style>
