<template>
  <n-modal
    class="modal-w-600"
    preset="card"
    :show="show"
    :title="title"
    @update:show="$emit('update:show', $event)"
  >
    <BatchDailyTaskModalBody
      :cron-next-runs="cronNextRuns"
      :cron-validation="cronValidation"
      :grouped-available-tasks="groupedAvailableTasks"
      :sorted-tokens="sortedTokens"
      :task-form="taskForm"
      :task-group-definitions="taskGroupDefinitions"
      :task-schedule-selected-group-ids="taskScheduleSelectedGroupIds"
      :token-groups="tokenGroups"
      @cancel="$emit('update:show', false)"
      @deselect-all-tasks="$emit('deselect-all-tasks')"
      @deselect-all-tokens="$emit('deselect-all-tokens')"
      @open-group-manage="$emit('open-group-manage')"
      @parse-cron="$emit('parse-cron')"
      @reset-run-type="$emit('reset-run-type')"
      @save="$emit('save')"
      @select-all-tasks="$emit('select-all-tasks')"
      @select-all-tokens="$emit('select-all-tokens')"
      @toggle-task-group="$emit('toggle-task-group', $event)"
      @update-task-form-field="(key, value) => $emit('update-task-form-field', key, value)"
    ></BatchDailyTaskModalBody>
  </n-modal>
</template>

<script setup>
import BatchDailyTaskModalBody from "./BatchDailyTaskModalBody.vue";

defineProps({
  cronNextRuns: {
    type: Array,
    default: () => [],
  },
  cronValidation: {
    type: Object,
    default: () => ({}),
  },
  groupedAvailableTasks: {
    type: Object,
    default: () => ({}),
  },
  show: Boolean,
  sortedTokens: {
    type: Array,
    default: () => [],
  },
  taskForm: {
    type: Object,
    required: true,
  },
  taskGroupDefinitions: {
    type: Array,
    default: () => [],
  },
  taskScheduleSelectedGroupIds: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: "新增定时任务",
  },
  tokenGroups: {
    type: Array,
    default: () => [],
  },
});

defineEmits([
  "deselect-all-tasks",
  "deselect-all-tokens",
  "open-group-manage",
  "parse-cron",
  "reset-run-type",
  "save",
  "select-all-tasks",
  "select-all-tokens",
  "toggle-task-group",
  "update-task-form-field",
  "update:show",
]);
</script>

<style scoped lang="scss">
.modal-w-600 {
  width: 90%;
  max-width: 600px;
}
</style>
