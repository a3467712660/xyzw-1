<template>
  <div class="result-section">
    <div class="section-title-row">
      <div class="section-title">{{ t("arenaPvpCard.sections.latestRun") }}</div>
      <span v-if="resultView.startedAt" class="section-hint">
        {{ t("arenaPvpCard.labels.latestRunWindow", { value: runWindowText }) }}
      </span>
    </div>

    <div v-if="resultView.hasRunContext" class="summary-grid">
      <div class="summary-item">
        <span class="summary-label">{{ t("arenaPvpCard.summary.planned") }}</span>
        <span class="summary-value">{{ resultView.plannedCount }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{{ t("arenaPvpCard.summary.executed") }}</span>
        <span class="summary-value">{{ resultView.executedCount }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{{ t("arenaPvpCard.summary.win") }}</span>
        <span class="summary-value win">{{ resultView.wins }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{{ t("arenaPvpCard.summary.loss") }}</span>
        <span class="summary-value loss">{{ resultView.losses }}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{{ t("arenaPvpCard.summary.winRate") }}</span>
        <span class="summary-value">{{ resultView.winRateText }}%</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">{{ t("arenaPvpCard.summary.scoreDelta") }}</span>
        <span class="summary-value" :class="resultView.scoreDeltaClass">
          {{ resultView.scoreDeltaText }}
        </span>
      </div>
    </div>

    <div v-if="resultView.recentRecords.length > 0" class="recent-records">
      <div
        v-for="item in resultView.recentRecords"
        :key="item.id"
        class="record-row"
      >
        <div class="record-avatar">
          <img
            v-if="item.headImg"
            alt="arena-record-avatar"
            class="record-avatar-img"
            :src="item.headImg"
          >
          <span v-else class="record-avatar-fallback">{{ item.avatarText }}</span>
        </div>
        <span class="record-type" :class="item.type === '攻' ? 'attack' : item.type === '守' ? 'defense' : 'unknown'">
          {{ getRecordTypeLabel(item.type) }}
        </span>
        <div class="record-main">
          <div class="record-name-row">
            <span class="record-name">{{ item.name || t("arenaPvpCard.common.unknownPlayer") }}</span>
            <span class="lineup-pill" :class="getLineupClass(item.lineupType)">
              {{ item.lineupType || t("arenaPvpCard.common.unknown") }}
            </span>
          </div>
          <div class="record-meta-row">
            <span class="record-time">{{ item.timeText || "-" }}</span>
            <span class="record-source">{{ item.sourceLabel || t("arenaPvpCard.sources.auto") }}</span>
          </div>
        </div>
        <span class="record-score" :class="item.scoreDeltaClass">
          {{ item.scoreDeltaText }}
        </span>
      </div>
    </div>

    <n-empty
      v-else
      size="small"
      :description="emptyDescription"
    ></n-empty>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { getArenaRecordTypeLabelText } from "./arenaPvpFormatters";

const props = defineProps({
  getLineupClass: {
    type: Function,
    required: true,
  },
  resultView: {
    type: Object,
    default: () => ({
      endedAt: 0,
      executedCount: 0,
      hasRecords: false,
      hasRunContext: false,
      losses: 0,
      plannedCount: 0,
      recentRecords: [],
      scoreDeltaClass: "neutral",
      scoreDeltaText: "0",
      startedAt: 0,
      winRateText: "0.0",
      wins: 0,
    }),
  },
  t: {
    type: Function,
    required: true,
  },
});

const getRecordTypeLabel = (type) =>
  getArenaRecordTypeLabelText(type, {
    attack: props.t("arenaPvpCard.labels.attack"),
    defense: props.t("arenaPvpCard.labels.defense"),
    unknown: props.t("arenaPvpCard.common.unknownMark"),
  });

const emptyDescription = computed(() =>
  props.resultView.hasRunContext
    ? props.t("arenaPvpCard.empty.latestRun")
    : props.t("arenaPvpCard.empty.latestRunIdle"),
);

const runWindowText = computed(() => {
  if (!props.resultView.startedAt) {
    return "";
  }

  const startedAt = new Date(props.resultView.startedAt).toLocaleTimeString();
  if (!props.resultView.endedAt) {
    return startedAt;
  }

  const endedAt = new Date(props.resultView.endedAt).toLocaleTimeString();
  return `${startedAt} - ${endedAt}`;
});
</script>

<style scoped lang="scss">
.result-section {
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass);
  border-radius: 12px;
  padding: 16px;
}

.section-title-row,
.summary-grid,
.record-name-row,
.record-meta-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.section-title-row {
  justify-content: space-between;
  margin-bottom: 12px;
}

.section-title {
  font-weight: 700;
}

.section-hint,
.record-time,
.record-source {
  font-size: 12px;
  color: var(--text-tertiary);
}

.summary-grid {
  margin-bottom: 12px;
}

.summary-item {
  min-width: 120px;
  border-radius: 10px;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  padding: 8px 10px;
}

.summary-label {
  display: block;
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 4px;
}

.summary-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.summary-value.win,
.record-score.positive {
  color: #18a058;
}

.summary-value.loss,
.record-score.negative {
  color: #d03050;
}

.recent-records {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-row {
  display: grid;
  grid-template-columns: 32px 42px minmax(0, 1fr) 64px;
  gap: 8px;
  align-items: center;
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  border-radius: 10px;
  padding: 8px 10px;
}

.record-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

.record-avatar-img,
.record-avatar-fallback {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.record-avatar-fallback {
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-tertiary);
}

.record-type,
.lineup-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid var(--border-light);
  white-space: nowrap;
}

.record-type {
  background: var(--bg-secondary);
}

.record-type.attack {
  color: #92400e;
  background: #fde7d3;
  border-color: #f6c28b;
}

.record-type.defense {
  color: #1e40af;
  background: #dbeafe;
  border-color: #93c5fd;
}

.record-type.unknown {
  color: #334155;
  background: #e2e8f0;
  border-color: #cbd5e1;
}

.record-main {
  min-width: 0;
}

.record-name {
  color: var(--text-primary);
  font-weight: 600;
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

.record-score {
  font-weight: 700;
  text-align: right;
}

.record-score.neutral {
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .record-row {
    grid-template-columns: 28px 38px minmax(0, 1fr);
  }

  .record-score {
    text-align: left;
    grid-column: 2 / -1;
  }
}
</style>
