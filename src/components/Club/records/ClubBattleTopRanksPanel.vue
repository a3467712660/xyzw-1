<template>
  <div class="style2-rankings-grid">
    <div
      v-for="card in cards"
      :key="card.key"
      class="rank-card-s2"
      :class="`${card.tone}-border`"
    >
      <div class="rank-card-title-s2">
        <span class="icon">{{ card.icon }}</span> {{ card.title }}
      </div>
      <div class="rank-list-s2">
        <div
          v-for="(player, index) in card.items"
          :key="`${card.key}-${player.key || index}`"
          class="rank-item-s2"
        >
          <div class="rank-num-s2">{{ index + 1 }}</div>
          <div class="rank-player-s2">
            <img
              v-if="player.avatar"
              class="avatar-xxs"
              :src="player.avatar"
              @error="$emit('image-error', $event)"
            >
            <div v-else class="avatar-xxs-placeholder">
              {{ getClubBattleAvatarText(player.name) }}
            </div>
            <span class="name">{{ player.name }}</span>
          </div>
          <div class="rank-val-s2" :class="card.tone">{{ player.value }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getClubBattleAvatarText } from "./clubBattleRecordDisplayHelpers.js";

defineProps({
  cards: {
    type: Array,
    default: () => [],
  },
});

defineEmits(["image-error"]);
</script>

<style scoped lang="scss">
.style2-rankings-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 16px;
}

.rank-card-s2 {
  background: #fff;
  border-radius: 14px;
  padding: 12px;
  border: 1px solid #edf0f4;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.05);
}

.rank-card-s2.red-border {
  border-top: 3px solid #ff5c5c;
}

.rank-card-s2.orange-border {
  border-top: 3px solid #ffab40;
}

.rank-card-s2.green-border {
  border-top: 3px solid #4caf50;
}

.rank-card-s2.gray-border {
  border-top: 3px solid #90a4ae;
}

.rank-card-s2.purple-border {
  border-top: 3px solid #9c27b0;
}

.rank-card-s2.blue-border {
  border-top: 3px solid #3f8cff;
}

.rank-card-title-s2 {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 10px;
}

.rank-list-s2 {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rank-item-s2 {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border-radius: 10px;
  padding: 8px;
}

.rank-num-s2 {
  width: 24px;
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 700;
  color: #6b7280;
}

.rank-player-s2 {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.avatar-xxs,
.avatar-xxs-placeholder {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  flex-shrink: 0;
}

.avatar-xxs {
  object-fit: cover;
}

.avatar-xxs-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #cbd5e1;
  color: #fff;
  font-size: 10px;
}

.name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 12px;
  color: #334155;
}

.rank-val-s2 {
  font-size: 12px;
  font-weight: 700;
}

.rank-val-s2.red {
  color: #ff5252;
}

.rank-val-s2.orange {
  color: #ff9800;
}

.rank-val-s2.green {
  color: #4caf50;
}

.rank-val-s2.gray {
  color: #78909c;
}

.rank-val-s2.purple {
  color: #8e24aa;
}

.rank-val-s2.blue {
  color: #2563eb;
}

@media (max-width: 900px) {
  .style2-rankings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .style2-rankings-grid {
    grid-template-columns: 1fr;
  }
}
</style>
