<template>
  <div class="toolbar-section">
    <div class="summary-grid">
      <div class="summary-item">
        <span class="label">{{ t("arenaPvpCard.summary.status") }}</span>
        <span class="value" :class="isArenaActivityOpen ? 'ok' : 'danger'">
          {{ isArenaActivityOpen ? t("arenaPvpCard.summary.open") : t("arenaPvpCard.summary.closed") }}
        </span>
      </div>
      <div class="summary-item">
        <span class="label">{{ t("arenaPvpCard.summary.ticket") }}</span>
        <span class="value">{{ arenaTicketCount }}</span>
      </div>
      <div class="summary-item">
        <span class="label">{{ t("arenaPvpCard.summary.score") }}</span>
        <span class="value score-with-delta">
          {{ myArenaScoreDisplay }}
          <span
            class="score-delta-mini"
            :class="getScoreDeltaClass(todayArenaScoreDelta)"
          >
            {{ formatScoreDelta(todayArenaScoreDelta, "0") }}
          </span>
        </span>
      </div>
      <div class="summary-item">
        <span class="label">{{ t("arenaPvpCard.summary.rank") }}</span>
        <span class="value" :class="{ ok: isMyArenaRankTop20 }">{{ myArenaRankDisplay }}</span>
      </div>
    </div>

    <div class="action-section">
      <div class="action-row">
        <div class="action-item">
          <span class="item-label">{{ t("arenaPvpCard.actions.formation") }}</span>
          <n-select
            class="action-select"
            v-model:value="selectedFormationModel"
            :disabled="loading || running"
            :options="formationOptions"
          ></n-select>
        </div>
        <div class="action-item">
          <span class="item-label">{{ t("arenaPvpCard.actions.fightCount") }}</span>
          <n-select
            class="action-select"
            v-model:value="fightCountModel"
            :disabled="loading || running"
            :options="fightCountOptions"
          ></n-select>
        </div>
        <n-button type="primary" :disabled="running" :loading="loading" @click="$emit('refresh')">
          <template #icon>
            <n-icon><Refresh></Refresh></n-icon>
          </template>
          {{ t("arenaPvpCard.actions.refresh") }}
        </n-button>
        <n-button
          type="success"
          :disabled="loading || !isConnected"
          :loading="running"
          @click="$emit('run-battles')"
        >
          <template #icon>
            <n-icon><Trophy></Trophy></n-icon>
          </template>
          {{ t("arenaPvpCard.actions.start") }}
        </n-button>
      </div>

      <div class="action-row action-row-sub">
        <div class="action-item">
          <span class="item-label">{{ t("arenaPvpCard.actions.preferredWinRate") }}</span>
          <n-input-number
            clearable
            class="action-select"
            v-model:value="preferredWinRateModel"
            :disabled="loading || running"
            :max="100"
            :min="0"
            :placeholder="t('arenaPvpCard.placeholders.preferredWinRate')"
            :precision="0"
            :step="5"
          ></n-input-number>
        </div>
        <div class="action-item action-item-wide">
          <span class="item-label">{{ t("arenaPvpCard.actions.skipLineups") }}</span>
          <n-select
            filterable
            multiple
            tag
            class="action-select wide"
            v-model:value="skipLineupRulesModel"
            :disabled="loading || running"
            :options="skipLineupOptions"
            :placeholder="t('arenaPvpCard.placeholders.skipLineups')"
          ></n-select>
        </div>
      </div>

      <div class="action-row action-row-sub">
        <div class="action-item">
          <span class="item-label">{{ t("arenaPvpCard.actions.manualTarget") }}</span>
          <n-select
            clearable
            filterable
            class="action-select"
            v-model:value="manualAssignTargetIdModel"
            :disabled="loading || running"
            :options="manualLineupTargetOptions"
            :placeholder="t('arenaPvpCard.placeholders.manualTarget')"
          ></n-select>
        </div>
        <div class="action-item">
          <span class="item-label">{{ t("arenaPvpCard.actions.manualRoleId") }}</span>
          <n-input
            v-model:value="manualAssignRoleIdModel"
            :disabled="loading || running"
            :placeholder="t('arenaPvpCard.placeholders.manualRoleId')"
          ></n-input>
        </div>
        <div class="action-item">
          <span class="item-label">{{ t("arenaPvpCard.actions.manualName") }}</span>
          <n-input
            v-model:value="manualAssignNameModel"
            :disabled="loading || running"
            :placeholder="t('arenaPvpCard.placeholders.manualName')"
          ></n-input>
        </div>
        <div class="action-item">
          <span class="item-label">{{ t("arenaPvpCard.actions.manualLineup") }}</span>
          <n-select
            filterable
            tag
            class="action-select"
            v-model:value="manualAssignLineupModel"
            :disabled="loading || running"
            :options="lineupPresetOptions"
          ></n-select>
        </div>
        <n-button :disabled="loading || running" @click="$emit('save-manual')">
          {{ t("arenaPvpCard.actions.saveManual") }}
        </n-button>
      </div>

      <div v-if="manualLineupEntries.length > 0" class="manual-lineup-list">
        <div v-for="item in manualLineupEntries" :key="item.key" class="manual-lineup-item">
          <span class="manual-lineup-key">{{ item.key }}</span>
          <span class="lineup-pill" :class="getLineupClass(item.lineupType)">
            {{ item.lineupType }}
          </span>
          <n-button tertiary size="tiny" @click="$emit('remove-manual-lineup', item.key)">
            {{ t("arenaPvpCard.actions.delete") }}
          </n-button>
        </div>
      </div>

      <div v-if="lastUpdatedLabel" class="updated-at">
        {{ t("arenaPvpCard.labels.updatedAt", { value: lastUpdatedLabel }) }}
      </div>
    </div>

    <div class="log-section">
      <div class="section-title">{{ t("arenaPvpCard.sections.logs") }}</div>
      <div v-if="battleLogs.length > 0" class="logs">
        <div v-for="log in battleLogs" :key="log.id" class="log-row">
          <span class="time">{{ log.time }}</span>
          <span class="content">{{ log.text }}</span>
        </div>
      </div>
      <n-empty v-else size="small" :description="t('arenaPvpCard.empty.logs')"></n-empty>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { Refresh, Trophy } from "@vicons/ionicons5";

const props = defineProps({
  arenaTicketCount: {
    type: [String, Number],
    default: 0,
  },
  battleLogs: {
    type: Array,
    default: () => [],
  },
  fightCount: {
    type: [String, Number],
    default: 3,
  },
  fightCountOptions: {
    type: Array,
    default: () => [],
  },
  formationOptions: {
    type: Array,
    default: () => [],
  },
  getLineupClass: {
    type: Function,
    required: true,
  },
  getScoreDeltaClass: {
    type: Function,
    required: true,
  },
  isArenaActivityOpen: {
    type: Boolean,
    default: false,
  },
  isConnected: {
    type: Boolean,
    default: false,
  },
  isMyArenaRankTop20: {
    type: Boolean,
    default: false,
  },
  lastUpdatedLabel: {
    type: String,
    default: "",
  },
  lineupPresetOptions: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  manualAssignLineup: {
    type: String,
    default: "",
  },
  manualAssignName: {
    type: String,
    default: "",
  },
  manualAssignRoleId: {
    type: String,
    default: "",
  },
  manualAssignTargetId: {
    type: String,
    default: "",
  },
  manualLineupEntries: {
    type: Array,
    default: () => [],
  },
  manualLineupTargetOptions: {
    type: Array,
    default: () => [],
  },
  myArenaRankDisplay: {
    type: String,
    default: "-",
  },
  myArenaScoreDisplay: {
    type: String,
    default: "-",
  },
  preferredWinRate: {
    type: [String, Number, null],
    default: null,
  },
  running: {
    type: Boolean,
    default: false,
  },
  selectedFormation: {
    type: [String, Number],
    default: 1,
  },
  skipLineupOptions: {
    type: Array,
    default: () => [],
  },
  skipLineupRules: {
    type: Array,
    default: () => [],
  },
  t: {
    type: Function,
    required: true,
  },
  todayArenaScoreDelta: {
    type: Number,
    default: 0,
  },
  formatScoreDelta: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits([
  "refresh",
  "remove-manual-lineup",
  "run-battles",
  "save-manual",
  "update:fight-count",
  "update:manual-assign-lineup",
  "update:manual-assign-name",
  "update:manual-assign-role-id",
  "update:manual-assign-target-id",
  "update:preferred-win-rate",
  "update:selected-formation",
  "update:skip-lineup-rules",
]);

const selectedFormationModel = computed({
  get: () => props.selectedFormation,
  set: (value) => emit("update:selected-formation", value),
});

const fightCountModel = computed({
  get: () => props.fightCount,
  set: (value) => emit("update:fight-count", value),
});

const preferredWinRateModel = computed({
  get: () => props.preferredWinRate,
  set: (value) => emit("update:preferred-win-rate", value),
});

const skipLineupRulesModel = computed({
  get: () => props.skipLineupRules,
  set: (value) => emit("update:skip-lineup-rules", value),
});

const manualAssignTargetIdModel = computed({
  get: () => props.manualAssignTargetId,
  set: (value) => emit("update:manual-assign-target-id", value),
});

const manualAssignRoleIdModel = computed({
  get: () => props.manualAssignRoleId,
  set: (value) => emit("update:manual-assign-role-id", value),
});

const manualAssignNameModel = computed({
  get: () => props.manualAssignName,
  set: (value) => emit("update:manual-assign-name", value),
});

const manualAssignLineupModel = computed({
  get: () => props.manualAssignLineup,
  set: (value) => emit("update:manual-assign-lineup", value),
});
</script>

<style scoped lang="scss">
.toolbar-section {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.summary-item,
.action-section,
.log-section {
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass);
  border-radius: 12px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
}

.label {
  font-size: 12px;
  color: var(--text-tertiary);
}

.value {
  font-size: 18px;
  font-weight: 700;
}

.value.ok,
.score-delta-mini.positive {
  color: #18a058;
}

.value.danger,
.score-delta-mini.negative {
  color: #d03050;
}

.score-delta-mini.neutral {
  color: var(--text-tertiary);
}

.score-with-delta {
  display: flex;
  gap: 8px;
  align-items: baseline;
}

.action-section,
.log-section {
  padding: 16px;
}

.action-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.action-row {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  flex-wrap: wrap;
}

.action-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.action-item-wide {
  flex: 1;
  min-width: 280px;
}

.action-select {
  min-width: 140px;
}

.action-select.wide {
  width: 100%;
}

.item-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.manual-lineup-list,
.logs {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.manual-lineup-item,
.log-row {
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
}

.manual-lineup-key {
  font-family: var(--font-family-mono);
  color: var(--text-secondary);
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

.updated-at,
.time {
  font-size: 12px;
  color: var(--text-tertiary);
}

.section-title {
  font-weight: 700;
  margin-bottom: 8px;
}

@media (max-width: 992px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .action-row {
    flex-direction: column;
    align-items: stretch;
  }

  .action-item,
  .action-item-wide {
    min-width: 0;
  }
}
</style>
