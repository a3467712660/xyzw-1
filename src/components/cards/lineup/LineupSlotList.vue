<template>
  <div class="slot-list-section">
    <div class="quick-switch-section">
      <h4>阵容槽位</h4>
      <div class="team-selector">
        <n-button
          v-for="teamId in availableTeams"
          :key="teamId"
          size="small"
          :loading="switchingTeamId === teamId"
          :type="currentTeamId === teamId ? 'primary' : 'default'"
          @click="$emit('switch-team', teamId)"
        >
          阵容{{ teamId }}
        </n-button>
      </div>
    </div>

    <div v-if="currentTeamInfo" class="current-team-section">
      <h4>
        编辑阵容 (阵容槽位{{ currentTeamId }})
        <span class="drag-tip">拖拽调整站位</span>
      </h4>
      <div class="heroes-grid">
        <div
          v-for="heroView in slotHeroViews"
          :key="`${heroView.hero.heroId}-${heroView.position}`"
          class="hero-item"
          draggable="true"
          :class="{
            'dragging': draggedHeroId === heroView.hero.heroId,
            'drag-over': dragOverPosition === heroView.position,
          }"
          @dragend="$emit('drag-end')"
          @dragleave="$emit('drag-leave')"
          @dragover.prevent="$emit('drag-over', $event, heroView.hero)"
          @dragstart="$emit('drag-start', $event, heroView.hero)"
          @drop="$emit('drop', $event, heroView.hero)"
        >
          <div class="hero-position">{{ heroView.position + 1 }}</div>
          <div class="hero-left" @click="$emit('open-refine', heroView.hero)">
            <div class="hero-avatar">
              <img
                v-if="heroView.avatar"
                :alt="heroView.name"
                :src="heroView.avatar"
              >
              <div v-else class="hero-placeholder">
                {{ heroView.avatarText }}
              </div>
            </div>
            <div class="hero-avatar-info">
              <div class="hero-name-small-inline">
                {{ heroView.name }}
              </div>
              <div v-if="heroView.levelText" class="hero-level-small-inline">
                {{ heroView.levelText }}
              </div>
            </div>
          </div>
          <div class="hero-info" @click="$emit('open-refine', heroView.hero)">
            <div v-if="heroView.fishCaption" class="hero-fish">
              {{ heroView.fishCaption }}
              <span
                v-if="heroView.slotColors.length > 0"
                class="hero-fish-slots-inline"
              >
                <span
                  v-for="(color, idx) in heroView.slotColors"
                  :key="idx"
                  class="slot-dot-small"
                  :style="{ backgroundColor: color }"
                ></span>
              </span>
            </div>
            <div
              v-if="heroView.stats.primary.length || heroView.stats.secondary.length"
              class="hero-stats"
            >
              <div v-if="heroView.stats.primary.length" class="stat-row">
                <span
                  v-for="item in heroView.stats.primary"
                  :key="`${heroView.hero.heroId}-${item.className}`"
                  :class="item.className"
                >
                  {{ item.text }}
                </span>
              </div>
              <div v-if="heroView.stats.secondary.length" class="stat-row">
                <span
                  v-for="item in heroView.stats.secondary"
                  :key="`${heroView.hero.heroId}-${item.className}`"
                  :class="item.className"
                >
                  {{ item.text }}
                </span>
              </div>
            </div>
          </div>
          <div class="hero-actions">
            <n-button
              class="exchange-btn"
              size="tiny"
              type="warning"
              @click.stop="$emit('open-exchange', heroView.hero)"
            >
              更换
            </n-button>
            <n-button
              class="remove-btn"
              size="tiny"
              type="error"
              @click.stop="$emit('remove-hero', heroView.hero)"
            >
              下阵
            </n-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { formatLineupFishCaption } from "./lineupFormatters";
import { buildLineupSlotHeroView } from "./lineupViewModels.js";

const props = defineProps({
  availableTeams: {
    type: Array,
    default: () => [],
  },
  currentTeamId: {
    type: Number,
    default: 1,
  },
  currentTeamInfo: {
    type: Object,
    default: null,
  },
  dragOverPosition: {
    type: Number,
    default: null,
  },
  draggedHeroId: {
    type: Number,
    default: null,
  },
  editingHeroes: {
    type: Array,
    default: () => [],
  },
  formatPower: {
    type: Function,
    required: true,
  },
  getFishInfo: {
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
  getPearlSkillNameByArtifactId: {
    type: Function,
    required: true,
  },
  getSlotColorsByArtifactId: {
    type: Function,
    required: true,
  },
  switchingTeamId: {
    type: Number,
    default: null,
  },
});

defineEmits([
  "drag-end",
  "drag-leave",
  "drag-over",
  "drag-start",
  "drop",
  "open-exchange",
  "open-refine",
  "remove-hero",
  "switch-team",
]);

const getFishCaption = (artifactId) => {
  const fishInfo = props.getFishInfo(artifactId);
  const fishName = fishInfo?.name || "";
  const pearlSkillName = props.getPearlSkillNameByArtifactId(artifactId);
  return formatLineupFishCaption(fishName, pearlSkillName);
};

const slotHeroViews = computed(() =>
  (props.editingHeroes || []).map((hero) =>
    buildLineupSlotHeroView(hero, {
      formatLevel: (value) => value,
      formatPower: props.formatPower,
      getFishCaption,
      getHeroAvatar: props.getHeroAvatar,
      getHeroName: props.getHeroName,
      getSlotColorsByArtifactId: props.getSlotColorsByArtifactId,
    }),
  ),
);
</script>

<style scoped lang="scss">
.slot-list-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.quick-switch-section {
  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
}

.team-selector {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.current-team-section {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);

  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }
}

.drag-tip {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  font-weight: normal;
}

.heroes-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.hero-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: var(--bg-primary);
  border-radius: var(--border-radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  width: 100%;
  transition: all 0.2s;
  cursor: grab;
  border: 2px solid transparent;
}

.hero-item:hover {
  background: var(--primary-color-light);
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.hero-item.dragging {
  opacity: 0.5;
  cursor: grabbing;
}

.hero-item.drag-over {
  border-color: var(--primary-color);
  background: var(--primary-color-light);
}

.hero-position {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary-color);
  color: white;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  cursor: pointer;
}

.hero-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.hero-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-placeholder {
  font-size: 12px;
  color: var(--text-secondary);
}

.hero-avatar-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.hero-name-small-inline {
  font-size: var(--font-size-xs);
  color: var(--text-primary);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-level-small-inline {
  font-size: 10px;
  color: white;
  font-weight: 600;
  white-space: nowrap;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  padding: 2px 6px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(240, 147, 251, 0.3);
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  flex: 1;
}

.hero-fish {
  font-size: var(--font-size-xs);
  color: var(--primary-color);
  background: linear-gradient(
    135deg,
    rgba(114, 46, 209, 0.15) 0%,
    rgba(114, 46, 209, 0.08) 100%
  );
  border: 1px solid rgba(114, 46, 209, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  align-self: flex-start;
  margin-bottom: 6px;
  font-weight: 500;
}

.hero-fish-slots-inline {
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
  padding-left: 6px;
  border-left: 1px solid rgba(114, 46, 209, 0.2);
}

.slot-dot-small {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.hero-stats {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.stat-row {
  display: flex;
  gap: 6px;
  align-items: center;
}

.hero-stats span {
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 500;
  white-space: nowrap;
  min-width: 90px;
  text-align: center;
}

.stat-power {
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
  color: white;
  font-size: 12px;
}

.stat-attack {
  background: linear-gradient(135deg, #ffa940 0%, #fa8c16 100%);
  color: white;
}

.stat-hp {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: white;
}

.stat-speed {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  color: white;
}

.hero-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-left: auto;
  min-width: 60px;
  justify-content: center;
}

.exchange-btn,
.remove-btn {
  flex-shrink: 0;
  width: 100%;
}

@media (max-width: 768px) {
  .hero-item {
    align-items: flex-start;
    flex-wrap: wrap;
  }

  .hero-actions {
    width: 100%;
    margin-left: 0;
    flex-direction: row;
  }

  .exchange-btn,
  .remove-btn {
    width: auto;
    flex: 1;
  }
}
</style>
