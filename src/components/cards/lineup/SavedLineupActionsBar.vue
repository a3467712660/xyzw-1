<template>
  <div class="saved-lineup-actions-bar">
    <n-button size="tiny" @click.stop="$emit('rename', lineup)">
      重命名
    </n-button>
    <n-button
      size="tiny"
      :disabled="!actionState.hasTech"
      @click.stop="$emit('show-tech', lineup)"
    >
      科技
    </n-button>
    <n-button size="tiny" type="error" @click.stop="$emit('delete', lineup)">
      删除
    </n-button>
    <n-button
      size="tiny"
      type="primary"
      :disabled="!actionState.canApply"
      :loading="actionState.isApplying"
      @click.stop="$emit('apply', lineup)"
    >
      应用
    </n-button>
    <n-button
      size="tiny"
      type="warning"
      :disabled="!actionState.canApply"
      @click.stop="$emit('debug', lineup)"
    >
      调试
    </n-button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { buildSavedLineupActionState } from "./lineupDisplayHelpers.js";

const props = defineProps({
  currentTeamId: {
    type: Number,
    default: 1,
  },
  lineup: {
    type: Object,
    required: true,
  },
});

defineEmits(["apply", "debug", "delete", "rename", "show-tech"]);

const actionState = computed(() =>
  buildSavedLineupActionState(props.lineup, props.currentTeamId),
);
</script>

<style scoped lang="scss">
.saved-lineup-actions-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
