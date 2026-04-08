<template>
  <div class="refine-equip-tabs-panel gwb2-mini-card__stack">
    <div class="gwb2-mini-card__section-title">{{ title }}</div>
    <div class="gwb2-mini-card__segmented equip-tabs">
      <button
        v-for="part in equipParts"
        :key="part.id"
        class="equip-tab"
        type="button"
        :class="{ active: selectedPart === part.id }"
        @click="$emit('select-part', part.id)"
      >
        <div class="tab-name">{{ part.name }}</div>
        <div class="tab-level">Lv.{{ part.level }}</div>
      </button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  equipParts: {
    type: Array,
    default: () => [],
  },
  selectedPart: {
    type: Number,
    default: null,
  },
  title: {
    type: String,
    default: "选择装备",
  },
});

defineEmits(["select-part"]);
</script>

<style scoped lang="scss">
.equip-tabs {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: var(--spacing-sm);
}

.equip-tab {
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
  transition: background var(--transition-fast);
}

.equip-tab:hover {
  background: rgba(255, 255, 255, 0.26);
}

.equip-tab.active {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(214, 224, 234, 0.2)),
    rgba(238, 243, 248, 0.94);
}

.tab-name {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.tab-level {
  margin-top: var(--spacing-xs);
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}

@media (max-width: 959px) {
  .equip-tabs {
    grid-template-columns: 1fr;
  }
}
</style>
