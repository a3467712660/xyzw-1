<template>
  <div class="dream-helper-merchant-panel gwb2-mini-card__stack">
    <div class="gwb2-mini-card__section-title">
      {{ title }}
    </div>

    <div class="gwb2-mini-card__action-rail merchant-actions">
      <n-button
        size="small"
        type="primary"
        :disabled="isBusy"
        @click="$emit('refresh-merchant')"
      >
        获取商品
      </n-button>
      <n-button
        size="small"
        type="primary"
        :disabled="isBusy || !merchantDataLoaded"
        @click="$emit('buy-gold')"
      >
        买金币商品
      </n-button>
      <n-button
        size="small"
        type="primary"
        :disabled="isBusy || !merchantDataLoaded"
        @click="$emit('buy-gold-fish')"
      >
        买鱼竿
      </n-button>
    </div>

    <div v-if="merchantSections.length > 0" class="gwb2-mini-card__list merchant-sections">
      <div
        v-for="section in merchantSections"
        :key="section.id"
        class="merchant-section"
      >
        <div class="merchant-section__title">
          {{ section.name }}
        </div>
        <div class="merchant-section__items">
          <div
            v-for="item in section.items"
            :key="`${section.id}-${item.pos}`"
            class="merchant-item"
          >
            <span
              class="merchant-item__name"
              :style="{ color: item.color }"
            >
              {{ item.name }}
            </span>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="gwb2-mini-card__empty merchant-empty">
      {{ emptyText }}
    </div>
  </div>
</template>

<script setup>
defineProps({
  emptyText: {
    type: String,
    default: "请先获取商品列表",
  },
  isBusy: {
    type: Boolean,
    default: false,
  },
  merchantDataLoaded: {
    type: Boolean,
    default: false,
  },
  merchantSections: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: "商店列表",
  },
});

defineEmits([
  "buy-gold",
  "buy-gold-fish",
  "refresh-merchant",
]);
</script>

<style scoped lang="scss">
.merchant-sections {
  gap: var(--spacing-sm);
}

.merchant-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(78, 94, 116, 0.1);
}

.merchant-section:last-child {
  border-bottom: none;
}

.merchant-section__title {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.merchant-section__items {
  display: grid;
  gap: 6px;
}

.merchant-item {
  display: flex;
  min-width: 0;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.merchant-item__name {
  min-width: 0;
  font-size: var(--font-size-xs);
  overflow-wrap: anywhere;
}

.merchant-empty {
  min-height: 96px;
  align-items: center;
  justify-content: center;
}

@media (max-width: 959px) {
  .merchant-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
