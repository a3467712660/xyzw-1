<template>
  <div class="fight-progress">
    <div class="progress-info">
      <div class="progress-title">{{ title }}</div>
      <div class="progress-stats">
        <span v-for="(item, index) in stats" :key="`${index}-${item}`">{{ item }}</span>
      </div>
    </div>
    <NProgress
      status="processing"
      type="line"
      :percentage="percentage"
      :show-indicator="false"
      :stroke-width="8"
    ></NProgress>
  </div>
</template>

<script setup>
import { NProgress } from "naive-ui/es";

defineProps({
  percentage: {
    type: Number,
    default: 0,
  },
  stats: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: "切磋进行中",
  },
});
</script>

<style scoped lang="scss">
.fight-progress {
  margin: 15px 0;
  padding: 15px;
  background: var(--bg-secondary, #f9f9f9);
  border-radius: var(--border-radius-sm, 4px);
  border: 1px solid var(--border-light, #eee);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-title {
  font-size: var(--font-size-sm, 14px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #333);
}

.progress-stats {
  display: flex;
  gap: 15px;
  font-size: var(--font-size-xs, 12px);
  color: var(--text-secondary, #666);
}

@media (max-width: 768px) {
  .progress-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .progress-stats {
    flex-wrap: wrap;
    gap: 10px;
  }
}
</style>
