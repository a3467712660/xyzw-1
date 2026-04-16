<template>
  <div class="replay-history-section">
    <div class="replay-history-header">
      <div class="replay-history-title">
        <h4>{{ t("fightPvpCard.replay.historyTitle") }}</h4>
        <span v-if="errorMessage" class="replay-history-error">
          {{ t("fightPvpCard.replay.lastErrorLabel") }} {{ errorMessage }}
        </span>
      </div>
      <n-button
        text
        size="small"
        type="error"
        :disabled="visibleRecords.length === 0"
        @click="$emit('clear')"
      >
        {{ t("fightPvpCard.actions.clearReplayHistory") }}
      </n-button>
    </div>

    <div v-if="visibleRecords.length > 0" class="replay-history-list">
      <div
        v-for="record in visibleRecords"
        :key="record.replayId"
        class="replay-history-item"
      >
        <div class="replay-history-main">
          <div class="replay-history-top">
            <div class="replay-history-names">
              <span class="replay-history-left">{{ record.left?.name || t("fightPvpCard.common.unknownPlayer") }}</span>
              <span class="replay-history-vs">VS</span>
              <span class="replay-history-right">{{ record.right?.name || record.targetName || t("fightPvpCard.common.unknownPlayer") }}</span>
            </div>
            <n-tag size="small" :type="record.battleResult?.isWin ? 'success' : 'error'">
              {{ record.battleResult?.isWin ? t("fightPvpCard.replay.statusWin") : t("fightPvpCard.replay.statusLoss") }}
            </n-tag>
          </div>
          <div class="replay-history-meta">
            <span>{{ formatRecordUpdatedAt(record) }}</span>
            <span>{{ t("fightPvpCard.replay.versionLabel", { value: record.battleVersion || "-" }) }}</span>
            <span v-if="record.targetId">ID: {{ record.targetId }}</span>
          </div>
        </div>
        <div class="replay-history-actions">
          <n-button
            v-if="resolveReplayState(record).visible"
            size="small"
            type="primary"
            :disabled="resolveReplayState(record).disabled"
            :title="resolveReplayState(record).title"
            @click="$emit('open', record)"
          >
            {{ resolveReplayState(record).label }}
          </n-button>
          <n-button
            quaternary
            size="small"
            type="error"
            @click="$emit('remove', record.replayId)"
          >
            {{ t("fightPvpCard.actions.delete") }}
          </n-button>
        </div>
      </div>
    </div>

    <n-empty
      v-else
      size="small"
      :description="t('fightPvpCard.replay.recentEmpty')"
    ></n-empty>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  currentBattleVersion: {
    type: Number,
    default: null,
  },
  errorMessage: {
    type: String,
    default: "",
  },
  formatUpdatedAt: {
    type: Function,
    required: true,
  },
  records: {
    type: Array,
    default: () => [],
  },
  t: {
    type: Function,
    required: true,
  },
});

defineEmits(["clear", "open", "remove"]);

const visibleRecords = computed(() => (props.records || []).slice(0, 5));

const resolveReplayState = (replay) => {
  if (!replay?.battleInputData && !replay?.battleInputSnapshot) {
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
      title: replay?.disabledReason || props.t("fightPvpCard.replay.unavailableDescription"),
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

const formatRecordUpdatedAt = (record) => {
  const parsed = Date.parse(String(record?.createdAt || ""));
  return props.formatUpdatedAt(Number.isFinite(parsed) ? parsed : Date.now());
};
</script>

<style scoped lang="scss">
.replay-history-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 16px;
  border-radius: 16px;
  background: var(--surface-glass);
  border: 1px solid var(--surface-glass-border);
}

.replay-history-header,
.replay-history-top,
.replay-history-actions,
.replay-history-meta,
.replay-history-names {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.replay-history-header {
  justify-content: space-between;
}

.replay-history-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.replay-history-title h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.replay-history-error,
.replay-history-meta {
  font-size: 12px;
  color: var(--text-tertiary);
}

.replay-history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.replay-history-item {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.65);
  border: 1px solid var(--border-light);
}

.replay-history-main {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.replay-history-left,
.replay-history-right {
  font-weight: 600;
}

.replay-history-vs {
  color: var(--text-tertiary);
  font-size: 12px;
}

@media (max-width: 768px) {
  .replay-history-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
