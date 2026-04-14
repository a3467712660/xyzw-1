<template>
  <div class="history-section">
    <div class="history-header">
      <div class="history-tabs">
        <n-button
          size="small"
          :type="activeTab === 'history' ? 'primary' : 'default'"
          @click="$emit('update:active-tab', 'history')"
        >
          {{ t("fightPvpCard.targetLists.history") }}
        </n-button>
        <n-button
          size="small"
          :type="activeTab === 'friends' ? 'primary' : 'default'"
          @click="$emit('update:active-tab', 'friends')"
        >
          {{ t("fightPvpCard.targetLists.friends") }}
        </n-button>
      </div>
      <div class="history-header-actions">
        <n-button
          size="small"
          type="info"
          :disabled="loading"
          :loading="syncing"
          @click="$emit('sync')"
        >
          {{ t("fightPvpCard.actions.syncFromGame") }}
        </n-button>
        <n-button
          text
          size="small"
          type="error"
          :disabled="records.length === 0"
          @click="$emit('clear')"
        >
          {{ t("fightPvpCard.actions.clearCurrent") }}
        </n-button>
      </div>
    </div>

    <div v-if="records.length > 0" class="history-list">
      <div
        v-for="item in records"
        :key="item.id"
        class="history-item"
      >
        <n-avatar
          round
          class="history-avatar"
          :size="38"
          :src="item.headImg"
        ></n-avatar>
        <div class="history-content">
          <div class="history-name-row">
            <span class="history-name">{{ item.name || t("fightPvpCard.common.unknownPlayer") }}</span>
            <span class="history-id">ID: {{ item.id }}</span>
          </div>
          <div class="history-meta">
            <span>{{ t("fightPvpCard.labels.serverName", { value: item.serverName || t("fightPvpCard.common.unknown") }) }}</span>
            <span>{{ t("fightPvpCard.labels.redCount", { value: item.red ?? 0 }) }}</span>
            <span>{{ t("fightPvpCard.labels.updatedAt") }} {{ formatUpdatedAt(item.updatedAt) }}</span>
          </div>
        </div>
        <div class="history-actions">
          <n-button size="small" type="primary" @click="$emit('use-target', item)">
            {{ t("fightPvpCard.actions.use") }}
          </n-button>
          <n-button
            quaternary
            size="small"
            type="error"
            @click="$emit('remove', item.id)"
          >
            {{ t("fightPvpCard.actions.delete") }}
          </n-button>
        </div>
      </div>
    </div>

    <n-empty
      v-else
      size="small"
      :description="
        activeTab === 'history'
          ? t('fightPvpCard.empty.history')
          : t('fightPvpCard.empty.friends')
      "
    ></n-empty>
  </div>
</template>

<script setup>
defineProps({
  activeTab: {
    type: String,
    default: "history",
  },
  formatUpdatedAt: {
    type: Function,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
  records: {
    type: Array,
    default: () => [],
  },
  syncing: {
    type: Boolean,
    default: false,
  },
  t: {
    type: Function,
    required: true,
  },
});

defineEmits(["clear", "remove", "sync", "update:active-tab", "use-target"]);
</script>

<style scoped lang="scss">
.history-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.history-header,
.history-tabs,
.history-header-actions,
.history-name-row,
.history-meta,
.history-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.history-header {
  justify-content: space-between;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px;
  border-radius: 12px;
  background: var(--surface-glass);
  border: 1px solid var(--surface-glass-border);
}

.history-content {
  flex: 1;
  min-width: 0;
}

.history-name {
  font-weight: 600;
}

.history-id,
.history-meta {
  font-size: 12px;
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .history-header,
  .history-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
