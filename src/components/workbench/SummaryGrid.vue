<template>
  <div class="app-page__summary workbench-summary-grid">
    <slot
      v-for="(item, index) in items"
      :key="item.key || item.label || index"
      name="item"
      :index="index"
      :item="item"
    >
      <article class="app-summary-card workbench-summary-card">
        <span class="app-summary-card__label">{{ item.label }}</span>
        <strong class="app-summary-card__value">{{ item.value }}</strong>
        <span v-if="item.meta" class="app-summary-card__meta">{{ item.meta }}</span>
      </article>
    </slot>
  </div>
</template>

<script setup>
defineProps({
  items: {
    type: Array,
    default: () => [],
  },
});
</script>
