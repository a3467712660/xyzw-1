<template>
  <div class="refine-slots-panel gwb2-mini-card__stack">
    <div class="gwb2-mini-card__metric-grid slot-stats">
      <div class="gwb2-mini-card__metric stat-card">
        <span class="stat-label">{{ quenchLabel }}</span>
        <strong class="stat-value">{{ stats.quenchTimes }}</strong>
      </div>
      <div class="gwb2-mini-card__metric stat-card">
        <span class="stat-label">{{ stats.bonusName }}</span>
        <strong class="stat-value">+{{ stats.bonusValue }}</strong>
      </div>
    </div>

    <div class="gwb2-mini-card__section-title">{{ slotTitle }}</div>
    <div class="gwb2-mini-card__list slots">
      <div
        v-for="slot in slots"
        :key="slot.id"
        class="slot"
        :class="{
          locked: slot.isLocked,
          [`color-${slot.colorId}`]: slot.colorId > 0,
        }"
      >
        <n-checkbox
          :checked="slot.isLocked"
          @update:checked="$emit('toggle-lock', { slotId: slot.id, isLocked: $event })"
        ></n-checkbox>
        <span class="slot-label">{{ slotLabelPrefix }} {{ slot.id }}</span>
        <div v-if="slot.attrId" class="slot-attr">
          <span>{{ slot.attrName }}</span>
          <span>+{{ slot.attrNum }}%</span>
        </div>
        <div v-else class="slot-empty">{{ emptyText }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  emptyText: {
    type: String,
    default: "未淬炼",
  },
  quenchLabel: {
    type: String,
    default: "淬炼次数",
  },
  slotLabelPrefix: {
    type: String,
    default: "孔位",
  },
  slotTitle: {
    type: String,
    default: "孔位锁定",
  },
  slots: {
    type: Array,
    default: () => [],
  },
  stats: {
    type: Object,
    default: () => ({
      bonusName: "",
      bonusValue: 0,
      quenchTimes: 0,
    }),
  },
});

defineEmits(["toggle-lock"]);
</script>

<style scoped lang="scss">
.slot-stats {
  align-items: stretch;
}

.stat-card {
  align-items: stretch;
}

.stat-label {
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stat-value {
  color: var(--primary-color);
  font-size: var(--font-size-md);
  font-weight: var(--font-weight-bold);
}

.slots {
  gap: var(--spacing-sm);
}

.slot {
  --slot-accent: rgba(78, 94, 116, 0.36);
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border: 1px solid rgba(78, 94, 116, 0.14);
  border-radius: 12px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(214, 224, 234, 0.14)),
    rgba(230, 237, 244, 0.48);
}

.slot.locked {
  border-color: color-mix(in srgb, var(--slot-accent) 26%, rgba(78, 94, 116, 0.18));
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(214, 224, 234, 0.16)),
    rgba(224, 233, 241, 0.68);
}

.slot.color-1 {
  --slot-accent: #ffffff;
  background: rgba(255, 255, 255, 0.12);
}

.slot.color-2 {
  --slot-accent: #4caf50;
  background: rgba(76, 175, 80, 0.1);
}

.slot.color-3 {
  --slot-accent: #2196f3;
  background: rgba(33, 150, 243, 0.1);
}

.slot.color-4 {
  --slot-accent: #9c27b0;
  background: rgba(156, 39, 176, 0.1);
}

.slot.color-5 {
  --slot-accent: #ff9800;
  background: rgba(255, 152, 0, 0.1);
}

.slot.color-6 {
  --slot-accent: #f44336;
  background: rgba(244, 67, 54, 0.1);
}

.slot-label {
  min-width: 40px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.slot-attr {
  display: flex;
  flex: 1;
  justify-content: space-between;
  gap: var(--spacing-sm);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.slot-empty {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  flex: 1;
}

@media (max-width: 959px) {
  .slot {
    flex-direction: column;
    align-items: stretch;
  }

  .slot-attr {
    flex-direction: column;
  }
}
</style>
