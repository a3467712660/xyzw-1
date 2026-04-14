<template>
  <div class="battle-rankings">
    <div
      v-for="group in groups"
      :key="group.key"
      class="ranking-card"
    >
      <div class="ranking-title">{{ group.title }}</div>
      <div class="ranking-content">
        <div class="ranking-side own">
          <div class="ranking-subtitle">我方 Top3</div>
          <div
            v-for="(player, index) in group.ownItems"
            :key="player.key || `${group.key}-own-${index}`"
            class="ranking-item"
          >
            <div class="rank-number">{{ index + 1 }}</div>
            <img
              v-if="player.avatar"
              class="player-avatar"
              :alt="player.name"
              :src="player.avatar"
              @error="$emit('image-error', $event)"
            >
            <div v-else class="player-avatar-placeholder">
              {{ getClubBattleAvatarText(player.name) }}
            </div>
            <span class="player-name">{{ player.name }}</span>
            <span class="player-value">{{ player.value }}</span>
          </div>
        </div>
        <div class="ranking-side opponent">
          <div class="ranking-subtitle">敌方 Top3</div>
          <div
            v-for="(player, index) in group.opponentItems"
            :key="player.key || `${group.key}-opponent-${index}`"
            class="ranking-item"
          >
            <div class="rank-number">{{ index + 1 }}</div>
            <img
              v-if="player.avatar"
              class="player-avatar"
              :alt="player.name"
              :src="player.avatar"
              @error="$emit('image-error', $event)"
            >
            <div v-else class="player-avatar-placeholder">
              {{ getClubBattleAvatarText(player.name) }}
            </div>
            <span class="player-name">{{ player.name }}</span>
            <span class="player-value">{{ player.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getClubBattleAvatarText } from "./clubBattleRecordDisplayHelpers.js";

defineProps({
  groups: {
    type: Array,
    default: () => [],
  },
});

defineEmits(["image-error"]);
</script>

<style scoped lang="scss">
.battle-rankings {
  margin-bottom: var(--spacing-md);
}

.ranking-card {
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.ranking-title {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-light);
  text-align: center;
}

.ranking-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.ranking-side {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.ranking-subtitle {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-sm);
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--border-radius-sm);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.rank-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

.ranking-item:nth-of-type(2) .rank-number {
  background: #ffd700;
  color: #000;
}

.ranking-item:nth-of-type(3) .rank-number {
  background: #c0c0c0;
  color: #000;
}

.ranking-item:nth-of-type(4) .rank-number {
  background: #cd7f32;
  color: #000;
}

.player-avatar,
.player-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  flex-shrink: 0;
}

.player-avatar {
  object-fit: cover;
}

.player-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #cbd5e1;
  color: #fff;
  font-size: 12px;
}

.player-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-value {
  font-weight: var(--font-weight-bold);
}

@media (max-width: 768px) {
  .ranking-content {
    grid-template-columns: 1fr;
  }
}
</style>
