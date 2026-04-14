<template>
  <div class="club-battle-summary-panel">
    <div class="summary-card">
      <div class="summary-title">{{ summaryTitle }}</div>
      <div
        v-for="stat in stats"
        :key="stat.label"
        class="summary-item"
      >
        <span>{{ stat.label }}:</span>
        <span>{{ stat.value }}</span>
      </div>
    </div>

    <div
      v-for="panel in rankPanels"
      :key="panel.title"
      class="summary-card purple-header"
    >
      <div class="summary-title">{{ panel.title }}</div>
      <div
        v-for="(item, index) in panel.items"
        :key="item.key || `${panel.title}-${index}`"
        class="top3-item"
      >
        <div class="top3-rank">
          <div class="rank-medal-small">
            {{ getClubBattleRankMedal(index) }}
          </div>
        </div>
        <div class="top3-info">
          <img
            v-if="item.avatar"
            class="player-avatar-xs"
            :src="item.avatar"
            @error="$emit('image-error', $event)"
          >
          <div v-else class="player-avatar-placeholder-xs">
            {{ getAvatarText(item.name) }}
          </div>
          <span class="top3-name">{{ item.name }}</span>
        </div>
        <div class="top3-value">{{ item.value }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getClubBattleRankMedal } from "./clubBattleRecordFormatters.js";

defineProps({
  rankPanels: {
    type: Array,
    default: () => [],
  },
  stats: {
    type: Array,
    default: () => [],
  },
  summaryTitle: {
    type: String,
    default: "总体统计",
  },
});

defineEmits(["image-error"]);

const getAvatarText = (name) => String(name || "").trim().charAt(0) || "?";
</script>

<style scoped lang="scss">
.club-battle-summary-panel {
  display: grid;
  gap: 14px;
}

.summary-card {
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
}

.summary-title {
  font-weight: 700;
  margin-bottom: 10px;
}

.summary-item,
.top3-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.summary-item + .summary-item,
.top3-item + .top3-item {
  margin-top: 8px;
}

.top3-rank,
.top3-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.rank-medal-small,
.player-avatar-placeholder-xs {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.player-avatar-xs,
.player-avatar-placeholder-xs {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}
</style>
