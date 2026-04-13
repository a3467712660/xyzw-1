<template>
  <div class="toolbar">
    <n-button
      size="small"
      type="primary"
      :loading="loading"
      @click="$emit('refresh')"
    >
      刷新数据
    </n-button>
    <n-button
      size="small"
      :disabled="editingHeroCount === 0"
      @click="$emit('save-lineup')"
    >
      保存阵容
    </n-button>
    <n-button
      size="small"
      type="success"
      :disabled="editingHeroCount >= 5"
      @click="$emit('add-hero')"
    >
      上阵英雄
    </n-button>
    <n-button
      size="small"
      type="info"
      @click="$emit('show-saved-lineups')"
    >
      已保存阵容 ({{ savedLineupCount }})
    </n-button>
  </div>
</template>

<script setup>
defineProps({
  editingHeroCount: {
    type: Number,
    default: 0,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  savedLineupCount: {
    type: Number,
    default: 0,
  },
});

defineEmits(["add-hero", "refresh", "save-lineup", "show-saved-lineups"]);
</script>

<style scoped lang="scss">
.toolbar {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
  flex-wrap: wrap;
}
</style>
