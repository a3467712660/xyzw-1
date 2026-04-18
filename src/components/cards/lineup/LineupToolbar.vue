<template>
  <div class="toolbar lineup-toolbar">
    <div class="lineup-toolbar__meta">
      <span class="lineup-toolbar__eyebrow">阵容操作区</span>
      <strong>已编辑 {{ editingHeroCount }} / 5 位英雄</strong>
      <span>已保存 {{ savedLineupCount }} 套阵容，可随时回看或继续应用。</span>
    </div>

    <div class="lineup-toolbar__actions">
      <n-button
        size="medium"
        type="primary"
        :loading="loading"
        @click="$emit('refresh')"
      >
        刷新数据
      </n-button>
      <n-button
        size="medium"
        :disabled="editingHeroCount === 0"
        @click="$emit('save-lineup')"
      >
        保存阵容
      </n-button>
      <n-button
        size="medium"
        type="success"
        :disabled="editingHeroCount >= 5"
        @click="$emit('add-hero')"
      >
        上阵英雄
      </n-button>
      <n-button
        size="medium"
        type="info"
        @click="$emit('show-saved-lineups')"
      >
        已保存阵容 ({{ savedLineupCount }})
      </n-button>
    </div>
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
.lineup-toolbar {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 16px;
  align-items: start;
  padding: 16px 18px;
  border-radius: 20px;
  border: 1px solid rgba(15, 107, 255, 0.12);
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.12), transparent 76%),
    rgba(255, 255, 255, 0.46);
}

.lineup-toolbar__meta {
  display: grid;
  gap: 6px;
}

.lineup-toolbar__eyebrow {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.lineup-toolbar__meta strong {
  color: var(--text-primary);
  font-size: clamp(18px, 2vw, 22px);
  line-height: 1.25;
}

.lineup-toolbar__meta span:last-child {
  color: var(--text-secondary);
  line-height: 1.6;
}

.lineup-toolbar__actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--spacing-sm);
}

.lineup-toolbar__actions :deep(.n-button) {
  min-height: 44px;
}

@media (max-width: 959px) {
  .lineup-toolbar {
    grid-template-columns: minmax(0, 1fr);
    padding: 14px;
  }

  .lineup-toolbar__actions {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .lineup-toolbar__actions {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
