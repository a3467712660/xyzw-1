<template>
  <div
    :ref="setExportRef"
    class="record-section"
    :class="{ 'is-exporting-image': isExportingImage }"
  >
    <div class="section-title record-title-row">
      <span>{{ t("arenaPvpCard.sections.records") }}</span>
      <div class="record-actions">
        <n-button
          size="small"
          :disabled="loading || running || !isConnected"
          :loading="recordSyncing"
          @click="$emit('pull-records')"
        >
          {{ t("arenaPvpCard.actions.pullRecords") }}
        </n-button>
        <n-button size="small" :disabled="records.length === 0" @click="$emit('export-image')">
          {{ t("arenaPvpCard.actions.exportImage") }}
        </n-button>
        <n-button tertiary size="small" :disabled="records.length === 0" @click="$emit('clear-records')">
          {{ t("arenaPvpCard.actions.clearRecords") }}
        </n-button>
      </div>
    </div>

    <div class="record-rate-panel">
      <span>{{ t("arenaPvpCard.labels.recordRate", { value: recordBasedWinRate.rate }) }}</span>
      <span>{{ t("arenaPvpCard.labels.recordTotal", { value: recordBasedWinRate.total }) }}</span>
      <span class="win">{{ t("arenaPvpCard.labels.recordWins", { value: recordBasedWinRate.wins }) }}</span>
      <span class="loss">{{ t("arenaPvpCard.labels.recordLosses", { value: recordBasedWinRate.losses }) }}</span>
    </div>

    <div v-if="recordBasedOpponentWinRates.length > 0" class="record-opponent-rates">
      <div
        v-for="item in recordBasedOpponentWinRates"
        :key="item.name"
        class="record-opponent-rate-item"
      >
        <span class="name">{{ item.name }}</span>
        <span class="rate">{{ item.rate }}%</span>
        <span class="detail">{{ item.wins }}/{{ item.total }}</span>
      </div>
    </div>

    <div v-if="records.length > 0" class="record-list">
      <div v-for="item in records" :key="item.id" class="record-row">
        <div class="record-avatar">
          <img
            v-if="resolveRecordAvatar(item)"
            alt="record-avatar"
            class="record-avatar-img"
            :src="resolveRecordAvatar(item)"
            @error="$emit('record-avatar-error', item)"
          >
          <span v-else class="record-avatar-fallback">
            {{ getAvatarFallbackText(item.name) }}
          </span>
        </div>
        <span class="record-type" :class="item.type === '攻' ? 'attack' : item.type === '守' ? 'defense' : 'unknown'">
          {{ getRecordTypeLabel(item.type) }}
        </span>
        <div class="record-name-group">
          <span class="record-name">{{ item.name || t("arenaPvpCard.common.unknownPlayer") }}</span>
          <span class="record-lineup lineup-pill" :class="getLineupClass(item.lineupType)">
            {{ item.lineupType || t("arenaPvpCard.common.unknown") }}
          </span>
          <span
            v-if="resolveCorrectedRecordLineupType(item)"
            class="record-corrected-lineup"
          >
            {{ t("arenaPvpCard.labels.correctedLineup", { value: resolveCorrectedRecordLineupType(item) }) }}
          </span>
        </div>
        <span
          class="record-score"
          :class="getScoreDeltaClass(item.scoreDelta)"
        >
          {{ formatScoreDelta(item.scoreDelta) }}
        </span>
        <span class="record-time">{{ item.timeText || "-" }}</span>
        <span class="record-source">{{ item.sourceLabel || t("arenaPvpCard.sources.auto") }}</span>
      </div>
    </div>

    <n-empty v-else size="small" :description="t('arenaPvpCard.empty.records')"></n-empty>
  </div>
</template>

<script setup>
import {
  formatArenaScoreDelta,
  getArenaAvatarFallbackText,
} from "./arenaPvpFormatters";

defineProps({
  getLineupClass: {
    type: Function,
    required: true,
  },
  getRecordTypeLabel: {
    type: Function,
    required: true,
  },
  getScoreDeltaClass: {
    type: Function,
    required: true,
  },
  isConnected: {
    type: Boolean,
    default: false,
  },
  isExportingImage: {
    type: Boolean,
    default: false,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  recordBasedOpponentWinRates: {
    type: Array,
    default: () => [],
  },
  recordBasedWinRate: {
    type: Object,
    default: () => ({ losses: 0, rate: "0.0", total: 0, wins: 0 }),
  },
  recordSyncing: {
    type: Boolean,
    default: false,
  },
  records: {
    type: Array,
    default: () => [],
  },
  resolveCorrectedRecordLineupType: {
    type: Function,
    required: true,
  },
  resolveRecordAvatar: {
    type: Function,
    required: true,
  },
  running: {
    type: Boolean,
    default: false,
  },
  setExportRef: {
    type: Function,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
});

defineEmits(["clear-records", "export-image", "pull-records", "record-avatar-error"]);

const formatScoreDelta = formatArenaScoreDelta;
const getAvatarFallbackText = getArenaAvatarFallbackText;
</script>

<style scoped lang="scss">
.record-section {
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass);
  border-radius: 12px;
  padding: 16px;
}

.record-title-row,
.record-actions,
.record-rate-panel,
.record-name-group {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.record-title-row {
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-title {
  font-weight: 700;
}

.record-rate-panel {
  margin-bottom: 12px;
  font-size: 13px;
}

.record-rate-panel .win {
  color: #18a058;
}

.record-rate-panel .loss {
  color: #d03050;
}

.record-opponent-rates,
.record-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.record-opponent-rate-item,
.record-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.record-avatar {
  width: 32px;
  height: 32px;
}

.record-avatar-img,
.record-avatar-fallback {
  width: 32px;
  height: 32px;
  border-radius: 50%;
}

.record-avatar-fallback {
  display: grid;
  place-items: center;
  background: var(--surface-glass-strong);
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

.record-score.positive {
  color: #18a058;
}

.record-score.negative {
  color: #d03050;
}

.record-score.neutral,
.record-time,
.record-source {
  color: var(--text-tertiary);
}

.record-section.is-exporting-image .record-list {
  max-height: none;
}
</style>
