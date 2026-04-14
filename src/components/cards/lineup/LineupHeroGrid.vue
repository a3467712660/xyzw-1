<template>
  <div class="lineup-heroes-row">
    <div
      v-for="(heroCard, heroIndex) in heroCards"
      :key="`${heroCard.name}-${heroIndex}`"
      class="lineup-hero-card"
    >
      <img
        v-if="heroCard.avatar"
        class="hero-avatar"
        :alt="heroCard.name"
        :src="heroCard.avatar"
      >
      <div v-else class="hero-avatar-placeholder">
        {{ heroCard.avatarText }}
      </div>
      <div class="hero-info-small">
        <div class="hero-header-small">
          <div class="hero-name-small">
            {{ heroCard.name }}
          </div>
          <div v-if="heroCard.levelText" class="hero-level-small">
            {{ heroCard.levelText }}
          </div>
        </div>
        <div v-if="heroCard.fishCaption" class="hero-fish-info">
          <div class="hero-fish-row">
            <span class="hero-fish-name">{{ heroCard.fishCaption }}</span>
            <div v-if="heroCard.slotColors.length > 0" class="hero-fish-slots">
              <span
                v-for="(slotColor, colorIndex) in heroCard.slotColors"
                :key="`${heroCard.name}-${colorIndex}`"
                class="slot-dot"
                :style="{ backgroundColor: slotColor }"
              ></span>
            </div>
          </div>
        </div>
        <div
          v-if="
            heroCard.stats.primary.length > 0 || heroCard.stats.secondary.length > 0
          "
          class="hero-stats-small"
        >
          <div
            v-if="heroCard.stats.primary.length > 0"
            class="stat-row-small"
          >
            <span
              v-for="item in heroCard.stats.primary"
              :key="`${heroCard.name}-${item.className}`"
              :class="item.className"
            >
              {{ item.text }}
            </span>
          </div>
          <div
            v-if="heroCard.stats.secondary.length > 0"
            class="stat-row-small"
          >
            <span
              v-for="item in heroCard.stats.secondary"
              :key="`${heroCard.name}-${item.className}`"
              :class="item.className"
            >
              {{ item.text }}
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { buildLineupHeroCardView } from "./lineupDisplayHelpers.js";

const props = defineProps({
  formatLevel: {
    type: Function,
    required: true,
  },
  formatPower: {
    type: Function,
    required: true,
  },
  getFishNameById: {
    type: Function,
    required: true,
  },
  getHeroAvatar: {
    type: Function,
    required: true,
  },
  getHeroName: {
    type: Function,
    required: true,
  },
  getPearlSkillNameById: {
    type: Function,
    required: true,
  },
  getSlotColors: {
    type: Function,
    required: true,
  },
  heroes: {
    type: Array,
    default: () => [],
  },
});

const heroCards = computed(() =>
  (props.heroes || []).map((hero) =>
    buildLineupHeroCardView(hero, {
      formatLevel: props.formatLevel,
      formatPower: props.formatPower,
      getFishNameById: props.getFishNameById,
      getHeroAvatar: props.getHeroAvatar,
      getHeroName: props.getHeroName,
      getPearlSkillNameById: props.getPearlSkillNameById,
      getSlotColors: props.getSlotColors,
    }),
  ),
);
</script>

<style scoped lang="scss">
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

.hero-header-small,
.hero-fish-row,
.stat-row-small {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.hero-header-small {
  justify-content: space-between;
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
</style>
