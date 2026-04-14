<template>
  <div class="rank-section">
    <div class="section-title">{{ t("arenaPvpCard.sections.rankList") }}</div>
    <div v-if="rankList.length > 0" class="rank-list">
      <div class="rank-header">
        <span class="col rank">{{ t("arenaPvpCard.columns.rank") }}</span>
        <span class="col name">{{ t("arenaPvpCard.columns.player") }}</span>
        <span class="col score">{{ t("arenaPvpCard.columns.score") }}</span>
        <span class="col lineup">{{ t("arenaPvpCard.columns.lineup") }}</span>
        <span class="col power">{{ t("arenaPvpCard.columns.power") }}</span>
      </div>
      <div
        v-for="item in rankList.slice(0, 20)"
        :key="item.roleId || `${item.rank}-${item.name}`"
        class="rank-row"
        :class="[
          { mine: String(item.roleId) === myRoleId },
          getRankRowClass(item.rank),
        ]"
      >
        <span class="col rank">
          <span class="rank-badge" :class="getRankBadgeClass(item.rank)">
            {{ formatRankLabel(item.rank) }}
          </span>
        </span>
        <div class="col name player-col">
          <div class="player-avatar">
            <img
              v-if="resolveRankAvatar(item)"
              alt="avatar"
              class="player-avatar-img"
              :src="resolveRankAvatar(item)"
              @error="$emit('rank-avatar-error', item)"
            >
            <span v-else class="player-avatar-fallback">
              {{ getAvatarFallbackText(item.name) }}
            </span>
          </div>
          <div class="player-meta">
            <span class="player-name">{{ item.name || t("arenaPvpCard.common.unknownPlayer") }}</span>
            <span class="player-id">ID {{ item.roleId || "-" }}</span>
          </div>
        </div>
        <span class="col score value-chip score-chip">{{ item.score ?? "-" }}</span>
        <span class="col lineup lineup-col">
          <span class="lineup-pill" :class="getLineupClass(item.lineupType)">
            {{ item.lineupType || t("arenaPvpCard.common.unknown") }}
          </span>
          <span
            v-if="resolveManualLineupType(item.roleId, item.name)"
            class="manual-lineup-badge"
          >
            {{ t("arenaPvpCard.labels.manual") }}
          </span>
        </span>
        <span class="col power value-chip power-chip">{{ item.powerText }}</span>
      </div>
    </div>
    <n-empty v-else size="small" :description="t('arenaPvpCard.empty.rankList')"></n-empty>
  </div>
</template>

<script setup>
import { getArenaAvatarFallbackText } from "./arenaPvpFormatters";

defineProps({
  formatRankLabel: {
    type: Function,
    required: true,
  },
  getLineupClass: {
    type: Function,
    required: true,
  },
  getRankBadgeClass: {
    type: Function,
    required: true,
  },
  getRankRowClass: {
    type: Function,
    required: true,
  },
  myRoleId: {
    type: String,
    default: "",
  },
  rankList: {
    type: Array,
    default: () => [],
  },
  resolveManualLineupType: {
    type: Function,
    required: true,
  },
  resolveRankAvatar: {
    type: Function,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
});

defineEmits(["rank-avatar-error"]);

const getAvatarFallbackText = getArenaAvatarFallbackText;
</script>

<style scoped lang="scss">
.rank-section {
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass);
  border-radius: 12px;
  padding: 16px;
}

.section-title {
  font-weight: 700;
  margin-bottom: 10px;
}

.rank-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rank-header,
.rank-row {
  display: grid;
  grid-template-columns: 90px minmax(0, 1.7fr) 100px 150px 120px;
  gap: 12px;
  align-items: center;
}

.rank-header {
  font-size: 12px;
  color: var(--text-tertiary);
}

.player-col {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.player-avatar-img,
.player-avatar-fallback {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.player-avatar-fallback {
  display: grid;
  place-items: center;
  background: var(--surface-glass-strong);
}

.player-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.player-name {
  font-weight: 600;
}

.player-id {
  font-size: 12px;
  color: var(--text-tertiary);
}

.value-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 3px 10px;
  font-weight: 600;
  font-size: 12px;
  border: 1px solid var(--border-light);
  width: fit-content;
}

.score-chip {
  background: color-mix(in srgb, var(--success-color, #16a34a) 12%, var(--bg-primary));
  color: var(--success-color, #16a34a);
}

.power-chip {
  background: color-mix(in srgb, var(--primary-color) 10%, var(--bg-primary));
  color: var(--text-primary);
}

.lineup-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  line-height: 1;
  white-space: nowrap;
}

.lineup-col {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  white-space: nowrap;
}

.manual-lineup-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  padding: 1px 5px;
  border-radius: 999px;
  border: 1px solid var(--border-light);
  background: color-mix(in srgb, var(--primary-color) 10%, var(--bg-primary));
  color: var(--text-secondary);
}

.lineup-pill.blue {
  color: #0f3b8a;
  background: #cfe2ff;
  border-color: #9dc3ff;
}

.lineup-pill.green {
  color: #1f6b2d;
  background: #d7f5df;
  border-color: #ade6bb;
}

.lineup-pill.red {
  color: #8a1f1f;
  background: #ffd8d8;
  border-color: #ffb0b0;
}

.lineup-pill.pink {
  color: #8a2c68;
  background: #ffd6ef;
  border-color: #ffb7df;
}

.lineup-pill.purple {
  color: #5a2b8a;
  background: #e8d8ff;
  border-color: #cdb1ff;
}

.lineup-pill.gray {
  color: #4b5563;
  background: #eceff3;
  border-color: #d5dbe3;
}

.rank-badge {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-glass-strong);
}

.rank-badge.top1 {
  background: rgba(240, 160, 32, 0.16);
}

.rank-badge.top2 {
  background: rgba(134, 142, 150, 0.16);
}

.rank-badge.top3 {
  background: rgba(208, 122, 52, 0.16);
}

.rank-row.mine {
  border-left: 3px solid var(--primary-color);
  padding-left: 8px;
}

@media (max-width: 992px) {
  .rank-header,
  .rank-row {
    grid-template-columns: 1fr;
  }
}
</style>
