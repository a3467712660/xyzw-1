<template>
  <n-modal
    preset="card"
    style="width: min(400px, calc(100vw - 24px))"
    :show="show"
    :title="title"
    @update:show="$emit('update:show', $event)"
  >
    <div class="settings-content">
      <BatchDailyTaskSettingsForm
        :boss-times-options="bossTimesOptions"
        :formation-options="formationOptions"
        :settings="settings"
        @update-field="(key, value) => $emit('update-field', key, value)"
      ></BatchDailyTaskSettingsForm>
      <div class="modal-actions">
        <n-button type="primary" @click="$emit('save')">保存设置</n-button>
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
  settings: {
    type: Object,
    required: true,
  },
  show: Boolean,
  title: {
    type: String,
    default: "",
  },
});

defineEmits(["save", "update-field", "update:show"]);
</script>

<style scoped lang="scss">
.settings-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.modal-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
