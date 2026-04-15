<template>
  <div class="lineup-hero-stats-panel">
    <div class="hero-header-small">
      <div class="hero-name-small">
        {{ heroCard.name }}
      </div>
      <div v-if="heroCard.levelText" class="hero-level-small">
        {{ heroCard.levelText }}
      </div>
    </div>

    <div
      v-if="heroCard.stats.primary.length > 0 || heroCard.stats.secondary.length > 0"
      class="hero-stats-small"
    >
      <div v-if="heroCard.stats.primary.length > 0" class="stat-row-small">
        <span
          v-for="item in heroCard.stats.primary"
          :key="`${heroCard.name}-${item.className}`"
          :class="item.className"
        >
          {{ item.text }}
        </span>
      </div>
      <div v-if="heroCard.stats.secondary.length > 0" class="stat-row-small">
        <span
          v-for="item in heroCard.stats.secondary"
          :key="`${heroCard.name}-${item.className}`"
          :class="item.className"
        >
          {{ item.text }}
        </span>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  heroCard: {
    type: Object,
    required: true,
  },
});
</script>

<style scoped lang="scss">
.hero-header-small,
.stat-row-small {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hero-header-small {
  justify-content: space-between;
}

.hero-name-small {
  font-weight: 600;
  color: #eef4ff;
}

.hero-level-small,
.stat-row-small {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.78);
}
</style>
