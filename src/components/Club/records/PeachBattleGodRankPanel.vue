<template>
  <div class="god-ranking" :class="tone">
    <div class="god-ranking-title">{{ title }}</div>
    <div class="god-ranking-content">
      <div class="god-ranking-header">
        <div class="god-rank-number">排名</div>
        <div class="header-avatar"></div>
        <div class="header-player">玩家</div>
        <div class="header-stat">击杀</div>
        <div class="header-stat">连杀</div>
        <div class="header-stat">抢船</div>
        <div class="header-stat">复活</div>
        <div class="header-stat">K/D</div>
      </div>
      <div
        v-for="(player, index) in players"
        :key="player.roleId || player.key || index"
        class="god-ranking-item"
      >
        <div class="god-rank-number">{{ index + 1 }}</div>
        <div class="player-avatar-cell">
          <img
            v-if="player.roleInfo?.headImg"
            class="player-avatar"
            :alt="player.roleInfo?.name"
            :src="player.roleInfo?.headImg"
            @error="$emit('image-error', $event)"
          >
          <div v-else class="player-avatar-placeholder">
            {{ getClubBattleAvatarText(player.roleInfo?.name) }}
          </div>
        </div>
        <span class="header-player">{{ player.roleInfo?.name || "未知成员" }}</span>
        <span class="player-stat">{{ player.killCnt || 0 }}</span>
        <span class="player-stat">{{ player.mCKCnt || 0 }}</span>
        <span class="player-stat">{{ player.carCnt || 0 }}</span>
        <span class="player-stat">{{ player.reviveCnt || 0 }}</span>
        <span class="player-stat">{{ player.kd || 0 }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getClubBattleAvatarText } from "./clubBattleRecordDisplayHelpers.js";

defineProps({
  players: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: "",
  },
  tone: {
    type: String,
    default: "own",
  },
});

defineEmits(["image-error"]);
</script>

<style scoped lang="scss">
.god-ranking {
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.god-ranking-title {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-light);
  text-align: center;
}

.god-ranking-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.god-ranking-header,
.god-ranking-item {
  display: grid;
  grid-template-columns: 56px 48px minmax(110px, 1fr) repeat(5, 64px);
  align-items: center;
  gap: 8px;
}

.god-ranking-header {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: var(--font-weight-semibold);
}

.god-ranking-item {
  padding: 8px 10px;
  background: var(--bg-primary);
  border-radius: var(--border-radius-sm);
}

.god-rank-number,
.header-stat,
.player-stat {
  text-align: center;
}

.player-avatar-cell {
  display: flex;
  justify-content: center;
}

.player-avatar,
.player-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
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

.header-player {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .god-ranking-header,
  .god-ranking-item {
    grid-template-columns: 44px 40px minmax(88px, 1fr) repeat(5, 52px);
    gap: 6px;
    font-size: 12px;
  }
}
</style>
