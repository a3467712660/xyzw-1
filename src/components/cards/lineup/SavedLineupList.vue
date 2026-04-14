<template>
  <div class="lineups-list">
    <div
      v-for="lineup in lineups"
      :key="lineup.id || lineup.savedAt || lineup.name"
      class="lineup-card"
    >
      <div class="lineup-title-bar" @click="$emit('toggle-lineup', lineup)">
        <div class="lineup-title-left">
          <span class="expand-icon">{{ expandedLineup === lineup ? "▼" : "▶" }}</span>
          <span class="lineup-name">{{ lineup.name }}</span>
          <span
            v-if="lineup.weaponId !== undefined && lineup.weaponId !== null"
            class="lineup-weapon-tag"
          >
            {{ getWeaponLabel(lineup.weaponId) }}
          </span>
          <span class="lineup-time">{{ actions.formatTime(lineup.savedAt) }}</span>
        </div>
        <SavedLineupActionsBar
          :current-team-id="currentTeamId"
          :lineup="lineup"
          @apply="$emit('apply', lineup)"
          @debug="$emit('debug', lineup)"
          @delete="deleteLineup(lineup)"
          @rename="renameLineup(lineup)"
          @show-tech="actions.showTechModal(lineup)"
        ></SavedLineupActionsBar>
      </div>
      <div v-if="expandedLineup === lineup" class="lineup-detail">
        <LineupHeroGrid
          :format-level="actions.formatLevel"
          :format-power="actions.formatPower"
          :get-fish-name-by-id="actions.getFishNameById"
          :get-hero-avatar="actions.getHeroAvatar"
          :get-hero-name="actions.getHeroName"
          :get-pearl-skill-name-by-id="actions.getPearlSkillNameById"
          :get-slot-colors="actions.getSlotColors"
          :heroes="lineup.heroes || []"
        ></LineupHeroGrid>
      </div>
    </div>
    <div v-if="lineups.length === 0" class="no-lineup-tip">
      暂无保存的阵容
    </div>
  </div>
</template>

<script setup>
import {
  getLineupWeaponLabel,
} from "./lineupDisplayHelpers.js";
import LineupHeroGrid from "./LineupHeroGrid.vue";
import SavedLineupActionsBar from "./SavedLineupActionsBar.vue";

const props = defineProps({
  actions: {
    type: Object,
    required: true,
  },
  currentTeamId: {
    type: Number,
    default: 1,
  },
  expandedLineup: {
    type: Object,
    default: null,
  },
  lineups: {
    type: Array,
    default: () => [],
  },
  savedLineups: {
    type: Array,
    default: () => [],
  },
  weapon: {
    type: Object,
    required: true,
  },
});

defineEmits(["apply", "debug", "toggle-lineup"]);

const getWeaponLabel = (weaponId) => getLineupWeaponLabel(weaponId, props.weapon);

const getLineupIndex = (lineup) => props.savedLineups.indexOf(lineup);

const renameLineup = (lineup) => {
  const index = getLineupIndex(lineup);
  if (index >= 0) {
    props.actions.renameLineup(index);
  }
};

const deleteLineup = (lineup) => {
  const index = getLineupIndex(lineup);
  if (index >= 0) {
    props.actions.deleteLineup(index);
  }
};
</script>

<style scoped lang="scss">
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

.lineup-title-left,
.lineup-quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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

.no-lineup-tip {
  padding: 24px 0;
  text-align: center;
  color: rgba(232, 240, 255, 0.72);
}
</style>
