<template>
  <n-modal
    preset="card"
    style="width: 900px; max-width: 90vw"
    title="已保存的阵容"
    :bordered="false"
    :show="show"
    @update:show="$emit('update:show', $event)"
  >
    <div v-if="savedLineups.length === 0" class="empty-tip">
      暂无保存的阵容，点击"保存阵容"开始使用
    </div>
    <div v-else class="saved-lineups-modal-content">
      <div class="team-tabs">
        <div class="team-tabs-left">
          <div
            v-for="teamId in availableTeams"
            :key="teamId"
            class="team-tab"
            :class="{ active: selectedTeamTab === teamId }"
            @click="$emit('update:selected-team-tab', teamId)"
          >
            槽位{{ teamId }}
            <span class="tab-count">({{ actions.getLineupsByTeamId(teamId).length }})</span>
          </div>
        </div>
        <div class="team-tabs-right">
          <n-button
            size="tiny"
            :loading="lineupCloudSyncing || lineupCloudLoading"
            @click="actions.syncSavedLineupsCloudNow"
          >
            上传到服务器
          </n-button>
          <n-button size="tiny" @click="actions.exportLineups">导出</n-button>
          <n-upload
            accept=".json"
            :custom-request="actions.importLineups"
            :show-file-list="false"
          >
            <n-button size="tiny">导入</n-button>
          </n-upload>
        </div>
      </div>
      <div class="lineups-list">
        <SavedLineupList
          :actions="actions"
          :current-team-id="currentTeamId"
          :expanded-lineup="expandedLineup"
          :lineups="actions.getLineupsByTeamId(selectedTeamTab)"
          :saved-lineups="savedLineups"
          :weapon="weapon"
          @apply="applyLineupAndClose"
          @debug="startDebugAndClose"
          @toggle-lineup="toggleLineupExpand"
        ></SavedLineupList>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import SavedLineupList from "./SavedLineupList.vue";

const props = defineProps({
  actions: {
    type: Object,
    required: true,
  },
  availableTeams: {
    type: Array,
    default: () => [],
  },
  currentTeamId: {
    type: Number,
    default: 1,
  },
  expandedLineup: {
    type: Object,
    default: null,
  },
  lineupCloudLoading: Boolean,
  lineupCloudSyncing: Boolean,
  savedLineups: {
    type: Array,
    default: () => [],
  },
  selectedTeamTab: {
    type: Number,
    default: 1,
  },
  show: Boolean,
  weapon: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits([
  "update:expanded-lineup",
  "update:selected-team-tab",
  "update:show",
]);

const toggleLineupExpand = (lineup) => {
  emit("update:expanded-lineup", props.expandedLineup === lineup ? null : lineup);
};

const applyLineupAndClose = (lineup) => {
  props.actions.applyLineup(lineup);
  emit("update:show", false);
};

const startDebugAndClose = (lineup) => {
  props.actions.startDebugApply(lineup);
  emit("update:show", false);
};
</script>

<style scoped lang="scss">
.saved-lineups-modal-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.team-tabs {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.team-tabs-left,
.team-tabs-right,
.lineup-title-left,
.lineup-quick-actions,
.hero-fish-row,
.stat-row-small {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.team-tabs-left {
  gap: 10px;
}

.team-tab {
  padding: 8px 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  cursor: pointer;
  transition: 0.2s ease;
}

.team-tab.active {
  background: rgba(71, 143, 255, 0.22);
  color: #d9e8ff;
}
.empty-tip {
  padding: 24px 0;
  text-align: center;
  color: rgba(232, 240, 255, 0.72);
}
</style>
