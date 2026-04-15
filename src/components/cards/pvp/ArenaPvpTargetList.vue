<template>
  <div class="target-list-section">
    <div class="section-title-row">
      <div class="section-title-group">
        <div class="section-title">{{ t("arenaPvpCard.sections.targetReference") }}</div>
        <span v-if="targetListView.preferredThreshold !== null" class="section-hint">
          {{ t("arenaPvpCard.labels.preferredTargetHint", { value: targetListView.preferredThreshold }) }}
        </span>
      </div>
      <span v-if="targetListView.skippedTotal > 0" class="skip-summary">
        {{ t("arenaPvpCard.labels.skippedTargetSummary", { value: targetListView.skippedTotal }) }}
      </span>
    </div>

    <div v-if="targetListView.recommendedTargets.length > 0" class="target-list">
      <div
        v-for="item in targetListView.recommendedTargets"
        :key="item.id"
        class="target-row"
      >
        <div class="target-player">
          <div class="target-avatar">
            <img
              v-if="item.headImg"
              class="target-avatar-img"
              :alt="item.name"
              :src="item.headImg"
            >
            <span v-else class="target-avatar-fallback">{{ item.avatarText }}</span>
          </div>
          <div class="target-meta">
            <div class="target-name-row">
              <span class="target-name">{{ item.name }}</span>
              <span class="rank-chip">{{ item.rankLabel }}</span>
            </div>
            <div class="target-sub-row">
              <span class="target-role-id">ID {{ item.roleId || "-" }}</span>
              <span class="target-score">{{ t("arenaPvpCard.labels.targetScore", { value: item.score ?? "-" }) }}</span>
              <span class="target-power">{{ item.powerText || "-" }}</span>
            </div>
          </div>
        </div>

        <div class="target-status">
          <span class="lineup-pill" :class="getLineupClass(item.lineupType)">
            {{ item.lineupType }}
          </span>
          <span class="rate-chip" :class="item.isPreferredRateMatched ? 'matched' : 'fallback'">
            {{ t("arenaPvpCard.labels.targetRate", { value: item.rateText }) }}
          </span>
          <span class="rate-detail">
            {{
              item.isKnownRate
                ? t("arenaPvpCard.labels.targetRateDetail", { wins: item.wins, total: item.total })
                : t("arenaPvpCard.labels.targetRateUnknown")
            }}
          </span>
        </div>
      </div>
    </div>

    <n-empty
      v-else
      size="small"
      :description="t('arenaPvpCard.empty.targetReference')"
    ></n-empty>

    <div v-if="targetListView.skippedTargets.length > 0" class="skipped-block">
      <div class="skipped-title">{{ t("arenaPvpCard.sections.skippedTargets") }}</div>
      <div class="skipped-list">
        <div
          v-for="item in targetListView.skippedTargets"
          :key="`skipped-${item.id}`"
          class="skipped-item"
        >
          <span class="skipped-name">{{ item.name }}</span>
          <span class="lineup-pill" :class="getLineupClass(item.lineupType)">
            {{ item.lineupType }}
          </span>
          <span class="rank-chip">{{ item.rankLabel }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  getLineupClass: {
    type: Function,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
  targetListView: {
    type: Object,
    default: () => ({
      preferredThreshold: null,
      recommendedTargets: [],
      skippedTargets: [],
      skippedTotal: 0,
    }),
  },
});
</script>

<style scoped lang="scss">
.target-list-section {
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass);
  border-radius: 12px;
  padding: 16px;
}

.section-title-row,
.section-title-group,
.target-name-row,
.target-sub-row,
.target-status {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.section-title-row {
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-weight: 700;
}

.section-hint,
.skip-summary,
.target-role-id,
.target-score,
.target-power,
.rate-detail {
  font-size: 12px;
  color: var(--text-tertiary);
}

.target-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.target-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  border-radius: 10px;
  padding: 10px 12px;
}

.target-player {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.target-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  flex-shrink: 0;
}

.target-avatar-img,
.target-avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.target-avatar-fallback {
  display: grid;
  place-items: center;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-tertiary);
}

.target-meta {
  min-width: 0;
}

.target-name {
  font-weight: 600;
  color: var(--text-primary);
}

.target-status {
  justify-content: flex-end;
}

.rate-chip,
.rank-chip,
.lineup-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-light);
  line-height: 1;
  white-space: nowrap;
}

.rank-chip {
  background: var(--bg-secondary);
  color: var(--text-secondary);
}

.rate-chip.matched {
  background: color-mix(in srgb, var(--success-color, #16a34a) 12%, var(--bg-primary));
  color: var(--success-color, #16a34a);
}

.rate-chip.fallback {
  background: color-mix(in srgb, var(--warning-color, #f0a020) 12%, var(--bg-primary));
  color: var(--warning-color, #f0a020);
}

.lineup-pill {
  background: var(--bg-primary);
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

.skipped-block {
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px dashed var(--border-light);
}

.skipped-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.skipped-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.skipped-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
}

.skipped-name {
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .target-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .target-status {
    justify-content: flex-start;
  }
}
</style>
