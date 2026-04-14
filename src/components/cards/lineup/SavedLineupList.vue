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
        <div class="lineup-quick-actions">
          <n-button size="tiny" @click.stop="renameLineup(lineup)">重命名</n-button>
          <n-button
            size="tiny"
            :disabled="!lineup.legionResearch || Object.keys(lineup.legionResearch).length === 0"
            @click.stop="actions.showTechModal(lineup)"
          >
            科技
          </n-button>
          <n-button size="tiny" type="error" @click.stop="deleteLineup(lineup)">
            删除
          </n-button>
          <n-button
            size="tiny"
            type="primary"
            :disabled="lineup.teamId !== currentTeamId"
            :loading="lineup.applying"
            @click.stop="$emit('apply', lineup)"
          >
            应用
          </n-button>
          <n-button
            size="tiny"
            type="warning"
            :disabled="lineup.teamId !== currentTeamId"
            @click.stop="$emit('debug', lineup)"
          >
            调试
          </n-button>
        </div>
      </div>
      <div v-if="expandedLineup === lineup" class="lineup-detail">
        <div class="lineup-heroes-row">
          <div
            v-for="(hero, heroIndex) in lineup.heroes"
            :key="`${lineup.id || lineup.name}-${hero.heroId}-${heroIndex}`"
            class="lineup-hero-card"
          >
            <img
              v-if="actions.getHeroAvatar(hero.heroId)"
              class="hero-avatar"
              :src="actions.getHeroAvatar(hero.heroId)"
            >
            <div v-else class="hero-avatar-placeholder">
              {{ getHeroAvatarText(hero) }}
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
              <div v-if="getFishCaption(hero)" class="hero-fish-info">
                <div class="hero-fish-row">
                  <span class="hero-fish-name">
                    {{ getFishCaption(hero) }}
                  </span>
                  <div v-if="actions.getSlotColors(hero.slotMap)" class="hero-fish-slots">
                    <span
                      v-for="(color, colorIndex) in actions.getSlotColors(hero.slotMap)"
                      :key="`${hero.heroId}-${colorIndex}`"
                      class="slot-dot"
                      :style="{ backgroundColor: color }"
                    ></span>
                  </div>
                </div>
              </div>
              <div v-if="getHeroStats(hero).primary.length || getHeroStats(hero).secondary.length" class="hero-stats-small">
                <div v-if="getHeroStats(hero).primary.length" class="stat-row-small">
                  <span
                    v-for="item in getHeroStats(hero).primary"
                    :key="`${hero.heroId}-${item.className}`"
                    :class="item.className"
                  >
                    {{ item.text }}
                  </span>
                </div>
                <div v-if="getHeroStats(hero).secondary.length" class="stat-row-small">
                  <span
                    v-for="item in getHeroStats(hero).secondary"
                    :key="`${hero.heroId}-${item.className}`"
                    :class="item.className"
                  >
                    {{ item.text }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-if="lineups.length === 0" class="no-lineup-tip">
      暂无保存的阵容
    </div>
  </div>
</template>

<script setup>
import {
  buildLineupHeroFishCaption,
  buildLineupHeroStatGroups,
  getLineupDisplayAvatarText,
  getLineupWeaponLabel,
  resolveLineupDisplayHeroName,
} from "./lineupDisplayHelpers";

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

const resolveHeroName = (heroId) =>
  resolveLineupDisplayHeroName(heroId, props.actions.getHeroName);

const getHeroAvatarText = (hero) =>
  getLineupDisplayAvatarText(resolveHeroName(hero.heroId), 1);

const getFishCaption = (hero) =>
  buildLineupHeroFishCaption(hero, {
    getFishNameById: props.actions.getFishNameById,
    getPearlSkillNameById: props.actions.getPearlSkillNameById,
  });

const getHeroStats = (hero) =>
  buildLineupHeroStatGroups(hero, props.actions.formatPower);

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
.lineup-quick-actions,
.hero-fish-row,
.stat-row-small {
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
.stat-row-small {
  font-size: 12px;
  color: rgba(232, 240, 255, 0.78);
}

.hero-fish-skill-name {
  margin-left: 4px;
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

.no-lineup-tip {
  padding: 24px 0;
  text-align: center;
  color: rgba(232, 240, 255, 0.72);
}
</style>
