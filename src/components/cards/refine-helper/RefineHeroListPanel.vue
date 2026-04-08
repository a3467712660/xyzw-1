<template>
  <div class="refine-hero-list-panel gwb2-mini-card__stack">
    <div class="gwb2-mini-card__section-title">{{ title }}</div>
    <div class="gwb2-mini-card__list hero-list">
      <div v-if="loading" class="gwb2-mini-card__empty loading">
        {{ loadingText }}
      </div>
      <div v-else-if="heroes.length === 0" class="gwb2-mini-card__empty empty">
        {{ emptyText }}
      </div>
      <button
        v-for="hero in heroes"
        :key="hero.id"
        v-else
        class="hero-item"
        type="button"
        :class="{ active: selectedHeroId === hero.id }"
        @click="$emit('select-hero', hero.id)"
      >
        <div class="hero-avatar">
          <img
            v-if="hero.avatar"
            :alt="hero.name"
            :src="hero.avatar"
          >
          <div v-else class="hero-placeholder">
            {{ hero.shortName }}
          </div>
        </div>
        <div class="hero-info">
          <div class="hero-name">{{ hero.name }}</div>
          <div class="hero-level">Lv.{{ hero.level }}</div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  emptyText: {
    type: String,
    default: "暂无可用武将",
  },
  heroes: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  loadingText: {
    type: String,
    default: "加载中...",
  },
  selectedHeroId: {
    type: Number,
    default: null,
  },
  title: {
    type: String,
    default: "选择武将",
  },
});

defineEmits(["select-hero"]);
</script>

<style scoped lang="scss">
.hero-list {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--spacing-sm);
}

.hero-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  border: 1px solid rgba(78, 94, 116, 0.12);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(214, 224, 234, 0.16)),
    rgba(230, 237, 244, 0.5);
  color: var(--text-primary);
  cursor: pointer;
  min-width: 0;
  transition: border-color var(--transition-fast), background var(--transition-fast);
}

.hero-item:hover {
  border-color: rgba(78, 94, 116, 0.22);
}

.hero-item.active {
  border-color: var(--primary-color);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(211, 224, 236, 0.16)),
    rgba(224, 233, 241, 0.72);
}

.hero-avatar {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  border-radius: 12px;
  background: rgba(214, 223, 232, 0.52);
}

.hero-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-placeholder {
  color: var(--text-secondary);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.hero-info {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.hero-name {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hero-level {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}

.loading,
.empty {
  min-height: 92px;
  justify-content: center;
}

@media (max-width: 959px) {
  .hero-list {
    grid-template-columns: 1fr;
  }
}
</style>
