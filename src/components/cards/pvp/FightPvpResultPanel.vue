<template>
  <div class="fight-pvp-result-panel">
    <div
      :ref="setExportRef"
      v-if="fightResult?.report"
      class="battle-detail-export-section"
    >
      <DuelBattleDetailReport
        :current-battle-version="currentBattleVersion"
        :export-mode="battleDetailExportMode"
        :report="fightResult.report"
        :round-replays="fightResult.replays || []"
        @export="$emit('export')"
        @open-replay="$emit('open-replay', $event)"
      ></DuelBattleDetailReport>
    </div>

    <div v-else-if="fightResult" class="info-card result-card">
      <div class="card-title">
        <h4>{{ t("fightPvpCard.sections.fightResult") }}</h4>
        <div class="result-summary">
          <div class="summary-item match-count">
            <span class="summary-label">{{ t("fightPvpCard.summary.total") }}</span>
            <span class="summary-value">{{ summary.total }}</span>
          </div>
          <div class="summary-item win-count">
            <span class="summary-label">{{ t("fightPvpCard.summary.win") }}</span>
            <span class="summary-value">{{ summary.winCount }}</span>
          </div>
          <div class="summary-item loss-count">
            <span class="summary-label">{{ t("fightPvpCard.summary.loss") }}</span>
            <span class="summary-value">{{ summary.lossCount }}</span>
          </div>
          <div class="summary-item win-rate">
            <span class="summary-label">{{ t("fightPvpCard.summary.winRate") }}</span>
            <span class="summary-value">{{ summary.winRateText }}</span>
          </div>
          <div class="summary-item die-rate">
            <span class="summary-label">{{ t("fightPvpCard.summary.ourDieRate") }}</span>
            <span class="summary-value">{{ summary.ourDieRateText }}</span>
          </div>
          <div class="summary-item die-rate">
            <span class="summary-label">{{ t("fightPvpCard.summary.enemyDieRate") }}</span>
            <span class="summary-value">{{ summary.enemyDieRateText }}</span>
          </div>
        </div>
      </div>

      <div class="result-list">
        <div
          v-for="(battle, index) in fightResult.resultCount"
          :key="index"
          class="battle-result-item"
          :class="[battle.isWin ? 'win' : 'loss']"
        >
          <div class="battle-header">
            <span class="battle-index">
              {{ t("fightPvpCard.labels.battleIndex", { value: index + 1 }) }}
            </span>
            <div class="battle-header-actions">
              <n-tag size="small" :type="battle.isWin ? 'success' : 'error'">
                {{
                  battle.isWin
                    ? t("fightPvpCard.summary.winResult")
                    : t("fightPvpCard.summary.lossResult")
                }}
              </n-tag>
              <n-button
                v-if="resolveReplayState(battle.replay).visible"
                secondary
                size="tiny"
                type="primary"
                :disabled="resolveReplayState(battle.replay).disabled"
                :title="resolveReplayState(battle.replay).title"
                @click="$emit('open-replay', battle.replay)"
              >
                {{ resolveReplayState(battle.replay).label }}
              </n-button>
            </div>
          </div>

          <div class="battle-details">
            <div class="battle-side left-side">
              <n-avatar
                round
                class="side-avatar"
                :size="32"
                :src="battle.leftheadImg"
              ></n-avatar>
              <div class="side-info">
                <span class="side-name">
                  {{ battle.leftName || t("fightPvpCard.common.unknown") }}
                </span>
                <span class="side-power">
                  {{ t("fightPvpCard.labels.powerValue", { value: battle.leftpower }) }}
                </span>
                <span class="side-die">
                  {{ t("fightPvpCard.labels.dieCount", { value: battle.leftDieHero }) }}
                </span>
              </div>
            </div>

            <div class="battle-vs">VS</div>

            <div class="battle-side right-side">
              <n-avatar
                round
                class="side-avatar"
                :size="32"
                :src="battle.rightheadImg"
              ></n-avatar>
              <div class="side-info">
                <span class="side-name">
                  {{ battle.rightName || t("fightPvpCard.common.unknown") }}
                </span>
                <span class="side-power">
                  {{ t("fightPvpCard.labels.powerValue", { value: battle.rightpower }) }}
                </span>
                <span class="side-die">
                  {{ t("fightPvpCard.labels.dieCount", { value: battle.rightDieHero }) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import DuelBattleDetailReport from "@/components/Common/DuelBattleDetailReport.vue";
import { getFightPvpLiveMapIdReasonMessageKey } from "@/services/replay/fightPvpLiveMapIdResolver.js";
import { buildFightPvpResultSummary } from "./pvpDisplayHelpers.js";

const props = defineProps({
  battleDetailExportMode: Boolean,
  currentBattleVersion: {
    type: Number,
    default: null,
  },
  fightNum: {
    type: [String, Number],
    default: 1,
  },
  fightResult: {
    type: Object,
    default: null,
  },
  setExportRef: {
    type: Function,
    default: null,
  },
  t: {
    type: Function,
    required: true,
  },
});

defineEmits(["export", "open-replay"]);

const summary = computed(() =>
  buildFightPvpResultSummary(props.fightNum, props.fightResult),
);

const buildReplayUnavailableTitle = (replay) => {
  if (replay?.mapIdResolveReason) {
    const detailParts = [];
    if (replay?.runtimeRolePath) {
      detailParts.push(`runtimeRolePath=${replay.runtimeRolePath}`);
    }
    if (replay?.mapIdSource) {
      detailParts.push(`mapIdSource=${replay.mapIdSource}`);
    }

    const lead = props.t(
      getFightPvpLiveMapIdReasonMessageKey(replay.mapIdResolveReason),
    );
    return detailParts.length > 0
      ? `${lead} (${detailParts.join(", ")})`
      : lead;
  }

  return replay?.disabledReason || props.t("fightPvpCard.replay.unavailableDescription");
};

const resolveReplayState = (replay) => {
  if (!replay?.exactBattleInputData && !replay?.battleInputData && !replay?.battleInputSnapshot) {
    return {
      visible: false,
      disabled: true,
      label: props.t("fightPvpCard.replay.missingPayload"),
      title: props.t("fightPvpCard.replay.emptyDescription"),
    };
  }

  if (!replay?.battleVersion) {
    return {
      visible: true,
      disabled: true,
      label: props.t("fightPvpCard.replay.missingVersion"),
      title: props.t("fightPvpCard.replay.missingVersion"),
    };
  }

  if (replay?.isPlayable === false) {
    return {
      visible: true,
      disabled: true,
      label: props.t("fightPvpCard.replay.unavailableShort"),
      title: buildReplayUnavailableTitle(replay),
    };
  }

  if (
    Number.isFinite(Number(props.currentBattleVersion))
    && Number(props.currentBattleVersion) > 0
    && Number(replay.battleVersion) !== Number(props.currentBattleVersion)
  ) {
    return {
      visible: true,
      disabled: true,
      label: props.t("fightPvpCard.replay.versionMismatchShort"),
      title: props.t("fightPvpCard.replay.versionMismatchTitle"),
    };
  }

  return {
    visible: true,
    disabled: false,
    label: props.t("fightPvpCard.replay.play"),
    title: props.t("fightPvpCard.replay.play"),
  };
};
</script>

<style scoped lang="scss">
.fight-pvp-result-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.battle-detail-export-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.info-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-large);
  padding: 12px;
  transition: all 0.3s ease;
}

.info-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.card-title,
.result-summary,
.summary-item,
.battle-header,
.battle-header-actions,
.battle-details,
.battle-side {
  display: flex;
  gap: 12px;
}

.card-title {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-light);
}

.card-title h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.result-summary {
  gap: 16px;
  flex-wrap: wrap;
}

.summary-item {
  align-items: center;
  gap: 6px;
}

.summary-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
}

.win-rate .summary-value,
.win-count .summary-value {
  color: var(--success-color);
}

.die-rate .summary-value {
  color: var(--warning-color);
}

.loss-count .summary-value {
  color: var(--error-color);
}

.result-list {
  margin-top: 12px;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  max-height: 500px;
  overflow-y: auto;
  padding-right: 8px;
}

.battle-result-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  padding: 10px;
  transition: all 0.3s ease;
  width: 100%;
  box-sizing: border-box;
}

.battle-result-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.battle-result-item.win {
  border-left: 4px solid var(--success-color);
  background-color: rgba(16, 185, 129, 0.05);
}

.battle-result-item.loss {
  border-left: 4px solid var(--error-color);
  background-color: rgba(239, 68, 68, 0.05);
}

.battle-header {
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.battle-header-actions {
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.battle-index {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.battle-details {
  align-items: center;
  justify-content: space-between;
}

.battle-side {
  flex: 1;
  align-items: center;
}

.battle-side.left-side {
  justify-content: flex-end;
  text-align: right;
}

.battle-side.right-side {
  justify-content: flex-start;
}

.side-avatar {
  flex-shrink: 0;
}

.side-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.side-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.side-power,
.side-die {
  font-size: 12px;
  color: var(--text-secondary);
}

.battle-vs {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
  flex-shrink: 0;
}

@media (max-width: 1200px) {
  .result-list {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .result-summary,
  .battle-details {
    flex-direction: column;
    gap: 12px;
  }

  .battle-side {
    justify-content: center !important;
  }
}
</style>
