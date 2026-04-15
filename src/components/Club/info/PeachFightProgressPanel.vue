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
  display: grid;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(64, 169, 255, 0.08);
  border: 1px solid rgba(64, 169, 255, 0.2);
}

.progress-info {
  display: grid;
  gap: 8px;
}

.progress-title {
  font-size: 14px;
  font-weight: 700;
}

.progress-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.72);
}
</style>
