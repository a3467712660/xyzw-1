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
        <div
          v-for="(lineup, index) in actions.getLineupsByTeamId(selectedTeamTab)"
          :key="index"
          class="lineup-card"
        >
          <div class="lineup-title-bar" @click="toggleLineupExpand(lineup)">
            <div class="lineup-title-left">
              <span class="expand-icon">{{ expandedLineup === lineup ? "▼" : "▶" }}</span>
              <span class="lineup-name">{{ lineup.name }}</span>
              <span
                v-if="lineup.weaponId !== undefined && lineup.weaponId !== null"
                class="lineup-weapon-tag"
              >
                {{ weapon[lineup.weaponId] || lineup.weaponId }}
              </span>
              <span class="lineup-time">{{ actions.formatTime(lineup.savedAt) }}</span>
            </div>
            <div class="lineup-quick-actions">
              <n-button
                size="tiny"
                @click.stop="actions.renameLineup(savedLineups.indexOf(lineup))"
              >
                重命名
              </n-button>
              <n-button
                size="tiny"
                :disabled="!lineup.legionResearch || Object.keys(lineup.legionResearch).length === 0"
                @click.stop="actions.showTechModal(lineup)"
              >
                科技
              </n-button>
              <n-button
                size="tiny"
                type="error"
                @click.stop="actions.deleteLineup(savedLineups.indexOf(lineup))"
              >
                删除
              </n-button>
              <n-button
                size="tiny"
                type="primary"
                :disabled="lineup.teamId !== currentTeamId"
                :loading="lineup.applying"
                @click.stop="applyLineupAndClose(lineup)"
              >
                应用
              </n-button>
              <n-button
                size="tiny"
                type="warning"
                :disabled="lineup.teamId !== currentTeamId"
                @click.stop="startDebugAndClose(lineup)"
              >
                调试
              </n-button>
            </div>
          </div>
          <div v-if="expandedLineup === lineup" class="lineup-detail">
            <div class="lineup-heroes-row">
              <div
                v-for="(hero, heroIndex) in lineup.heroes"
                :key="heroIndex"
                class="lineup-hero-card"
              >
                <img
                  v-if="actions.getHeroAvatar(hero.heroId)"
                  class="hero-avatar"
                  :src="actions.getHeroAvatar(hero.heroId)"
                >
                <div v-else class="hero-avatar-placeholder">
                  {{ resolveHeroName(hero.heroId).substring(0, 1) || "?" }}
                </div>
                <div class="hero-info-small">
                  <div class="hero-header-small">
                    <div class="hero-name-small">
                      {{ resolveHeroName(hero.heroId) }}
                    </div>
                    <div v-if="hero.level" class="hero-level-small">
                      Lv.{{ actions.formatLevel(hero.level) }}
                    </div>
                  </div>
                  <div v-if="hero.fishId" class="hero-fish-info">
                    <div class="hero-fish-row">
                      <span class="hero-fish-name">
                        {{ actions.getFishNameById(hero.fishId) }}
                        <span v-if="hero.skillId" class="hero-fish-skill-name">
                          {{ actions.getPearlSkillNameById(hero.skillId) }}
                        </span>
                      </span>
                      <div v-if="actions.getSlotColors(hero.slotMap)" class="hero-fish-slots">
                        <span
                          v-for="(color, colorIndex) in actions.getSlotColors(hero.slotMap)"
                          :key="colorIndex"
                          class="slot-dot"
                          :style="{ backgroundColor: color }"
                        ></span>
                      </div>
                    </div>
                  </div>
                  <div v-if="hero.power" class="hero-stats-small">
                    <div class="stat-row-small">
                      <span class="stat-power">战力{{ actions.formatPower(hero.power) }}</span>
                      <span v-if="hero.speed" class="stat-speed">速度{{ hero.speed }}</span>
                    </div>
                    <div class="stat-row-small">
                      <span v-if="hero.attack" class="stat-attack">
                        攻击{{ actions.formatPower(hero.attack) }}
                      </span>
                      <span v-if="hero.hp" class="stat-hp">
                        血量{{ actions.formatPower(hero.hp) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="actions.getLineupsByTeamId(selectedTeamTab).length === 0" class="no-lineup-tip">
          暂无保存的阵容
        </div>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { getLineupHeroDisplayName } from "./lineupFormatters";

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

const resolveHeroName = (heroId) =>
  getLineupHeroDisplayName(props.actions.getHeroName(heroId), heroId);
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

.lineups-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 58vh;
  overflow: auto;
}

.lineup-card {
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(9, 15, 26, 0.64);
}

.lineup-title-bar {
  padding: 14px 16px;
  display: flex;
  justify-content: space-between;
  gap: 12px;
  cursor: pointer;
}

.lineup-name {
  font-weight: 700;
  color: #eef4ff;
}

.lineup-time,
.lineup-weapon-tag {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.72);
}

.lineup-detail {
  padding: 0 16px 16px;
}

.lineup-heroes-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 10px;
}

.lineup-hero-card {
  display: flex;
  gap: 10px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.05);
}

.hero-avatar,
.hero-avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}

.hero-avatar-placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: rgba(71, 143, 255, 0.2);
  color: #fff;
}

.hero-info-small {
  flex: 1;
  min-width: 0;
}

.hero-name-small {
  font-weight: 600;
  color: #eef4ff;
}

.hero-level-small,
.hero-fish-name,
.hero-fish-skill-name,
.stat-row-small {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.78);
}

.hero-fish-slots {
  display: flex;
  gap: 4px;
}

.slot-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
}

.no-lineup-tip,
.empty-tip {
  padding: 24px 0;
  text-align: center;
  color: rgba(232, 240, 255, 0.72);
}
</style>
