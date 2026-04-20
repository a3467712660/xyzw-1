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
        <span class="col score metric-col">
          <span class="mobile-metric-label">{{ t("arenaPvpCard.columns.score") }}</span>
          <span class="value-chip score-chip">{{ item.score ?? "-" }}</span>
        </span>
        <span class="col lineup lineup-col metric-col">
          <span class="mobile-metric-label">{{ t("arenaPvpCard.columns.lineup") }}</span>
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
        <span class="col power metric-col">
          <span class="mobile-metric-label">{{ t("arenaPvpCard.columns.power") }}</span>
          <span class="value-chip power-chip">{{ item.powerText }}</span>
        </span>
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
  border-bottom: 1px dashed var(--border-light);
  padding: 2px 6px 8px;
}

.rank-row {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 12px;
  padding: 9px 10px;
  font-size: 13px;
  color: var(--text-primary);
  transition: all 0.2s ease;
}

.rank-row:hover {
  border-color: color-mix(in srgb, var(--primary-color) 40%, var(--border-light));
  transform: translateY(-1px);
}

.player-col {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.player-avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.player-avatar-img,
.player-avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.player-avatar-fallback {
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-tertiary);
}

.player-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.player-name {
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.player-id {
  font-size: 11px;
  color: var(--text-tertiary);
}

.value-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  max-width: 100%;
  border-radius: 999px;
  padding: 3px 10px;
  font-weight: 600;
  font-size: 12px;
  border: 1px solid var(--border-light);
  width: fit-content;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.metric-col {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.mobile-metric-label {
  display: none;
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
  min-width: 0;
  max-width: 100%;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  line-height: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
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
  min-width: 56px;
  justify-content: center;
  align-items: center;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.rank-badge.top1 {
  background: linear-gradient(120deg, #ffcc47, #ffb300);
  border-color: #ffb300;
  color: #5c3a00;
}

.rank-badge.top2 {
  background: linear-gradient(120deg, #dbe4ef, #c8d2df);
  border-color: #c2ccd9;
  color: #334155;
}

.rank-badge.top3 {
  background: linear-gradient(120deg, #f6c9a5, #eba97b);
  border-color: #e8a374;
  color: #5a341f;
}

.rank-row.mine {
  border-color: var(--primary-color);
  box-shadow: inset 0 0 0 1px var(--primary-color),
    0 4px 12px color-mix(in srgb, var(--primary-color) 20%, transparent);
}

.rank-row.row-top1 {
  background: linear-gradient(90deg, #fff8e7 0%, var(--bg-primary) 55%);
}

.rank-row.row-top2 {
  background: linear-gradient(90deg, #f7f9fc 0%, var(--bg-primary) 55%);
}

.rank-row.row-top3 {
  background: linear-gradient(90deg, #fff5ef 0%, var(--bg-primary) 55%);
}

@media (max-width: 992px) and (min-width: 769px) {
  .rank-header,
  .rank-row {
    grid-template-columns: 72px minmax(0, 1fr) 84px 96px 100px;
    gap: 8px;
  }
}

@media (max-width: 768px) {
  .rank-section {
    padding: 12px;
    border-radius: 14px;
  }

  .section-title {
    margin-bottom: 8px;
    font-size: 14px;
  }

  .rank-list {
    gap: 6px;
  }

  .rank-header {
    display: none;
  }

  .rank-row {
    grid-template-columns: auto minmax(0, 1fr) auto;
    grid-template-areas:
      "rank name power"
      "rank score lineup";
    gap: 7px 8px;
    align-items: center;
    padding: 8px;
    border-radius: 11px;
    font-size: 12px;
  }

  .rank-row:hover {
    transform: none;
  }

  .col.rank {
    grid-area: rank;
  }

  .col.name {
    grid-area: name;
  }

  .col.score {
    grid-area: score;
  }

  .col.lineup {
    grid-area: lineup;
  }

  .col.power {
    grid-area: power;
    justify-self: end;
  }

  .player-col {
    gap: 6px;
  }

  .player-avatar {
    width: 26px;
    height: 26px;
  }

  .player-name {
    font-size: 12px;
  }

  .player-id {
    display: none;
  }

  .metric-col {
    gap: 4px;
  }

  .mobile-metric-label {
    display: inline-flex;
    flex: 0 0 auto;
    color: var(--text-tertiary);
    font-size: 10px;
    font-weight: 700;
    line-height: 1;
  }

  .score {
    justify-self: start;
  }

  .lineup {
    justify-self: end;
  }

  .rank-header,
  .rank-row {
    font-size: 12px;
  }

  .rank-badge {
    min-width: 42px;
    padding: 2px 5px;
    font-size: 11px;
  }

  .value-chip,
  .lineup-pill {
    padding: 2px 6px;
    font-size: 11px;
  }

  .manual-lineup-badge {
    padding: 1px 4px;
    font-size: 9px;
  }
}
</style>
