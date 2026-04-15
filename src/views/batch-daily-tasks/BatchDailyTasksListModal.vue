<template>
  <n-modal
    class="modal-w-800"
    preset="card"
    title="定时任务列表"
    :show="show"
    @update:show="$emit('update:show', $event)"
  >
    <TaskControlScheduledTasksList
      :executing-task-ids="executingTaskIds"
      :on-delete-task="onDeleteTask"
      :on-edit-task="onEditTask"
      :on-manual-execute-task="onManualExecuteTask"
      :on-toggle-task-enabled="onToggleTaskEnabled"
      :scheduled-tasks="scheduledTasks"
      :task-countdowns="taskCountdowns"
    ></TaskControlScheduledTasksList>
  </n-modal>
</template>

<script setup>
import { defineAsyncComponent } from "vue";

defineProps({
  executingTaskIds: {
    type: Array,
    default: () => [],
  },
  onDeleteTask: {
    type: Function,
    required: true,
  },
  onEditTask: {
    type: Function,
    required: true,
  },
  onManualExecuteTask: {
    type: Function,
    required: true,
  },
  onToggleTaskEnabled: {
    type: Function,
    required: true,
  },
  scheduledTasks: {
    type: Array,
    default: () => [],
  },
  show: Boolean,
  taskCountdowns: {
    type: Object,
    default: () => ({}),
  },
});

defineEmits(["update:show"]);

const TaskControlScheduledTasksList = defineAsyncComponent(
  () => import("@/components/task-control/TaskControlScheduledTasksList.vue"),
);
</script>

<style scoped lang="scss">
.modal-w-800 {
  width: 90%;
  max-width: 800px;
}
</style>
