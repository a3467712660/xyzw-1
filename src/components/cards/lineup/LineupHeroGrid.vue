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
        <LineupHeroStatsPanel :hero-card="heroCard"></LineupHeroStatsPanel>
        <LineupEquipmentPanel :hero-card="heroCard"></LineupEquipmentPanel>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import LineupEquipmentPanel from "./LineupEquipmentPanel.vue";
import LineupHeroStatsPanel from "./LineupHeroStatsPanel.vue";
import { buildLineupHeroView } from "./lineupViewModels.js";

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
    buildLineupHeroView(hero, {
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
</style>
