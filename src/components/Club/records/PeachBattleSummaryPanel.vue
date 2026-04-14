<template>
  <div
    class="peach-battle-summary-panel"
    :class="[`is-${variant}`, `is-${tone}`]"
  >
    <ClubBattleSummaryPanel
      v-if="variant === 'style1'"
      :rank-panels="rankPanels"
      :show-avatar="false"
      :show-rank-medal="false"
      :stats="stats"
      @image-error="$emit('image-error', $event)"
    ></ClubBattleSummaryPanel>

    <template v-else>
      <div class="style2-dashboard">
        <div class="dashboard-stats">
          <div
            v-for="(statRow, rowIndex) in statRows"
            :key="`stats-row-${rowIndex}`"
            class="stat-card-row"
          >
            <div
              v-for="stat in statRow"
              :key="stat.label"
              class="stat-card-mini"
            >
              <div class="stat-label-mini">{{ stat.label }}</div>
              <div class="stat-value-mini">{{ stat.value }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="style2-rankings-row">
        <div
          v-for="panel in rankPanels"
          :key="panel.title"
          class="summary-card"
        >
          <div class="summary-title">{{ panel.title }}</div>
          <div
            v-for="(item, index) in panel.items"
            :key="item.key || `${panel.title}-${index}`"
            class="top3-item"
          >
            <span class="top3-name">{{ item.name }}</span>
            <span class="top3-value">{{ item.value }}</span>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed } from "vue";
import ClubBattleSummaryPanel from "./ClubBattleSummaryPanel.vue";

const props = defineProps({
  rankPanels: {
    type: Array,
    default: () => [],
  },
  stats: {
    type: Array,
    default: () => [],
  },
  tone: {
    type: String,
    default: "own",
  },
  variant: {
    type: String,
    default: "style1",
  },
});

defineEmits(["image-error"]);

const statRows = computed(() => {
  const rows = [];
  for (let index = 0; index < props.stats.length; index += 2) {
    rows.push(props.stats.slice(index, index + 2));
  }
  return rows;
});
</script>

<style scoped lang="scss">
.style2-dashboard {
  margin-bottom: 15px;
}

.dashboard-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-card-row {
  display: flex;
  gap: 10px;
}

.stat-card-mini {
  flex: 1;
  background: #f8f9fa;
  padding: 10px;
  border-radius: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.stat-label-mini {
  font-size: 11px;
  color: #888;
  margin-bottom: 2px;
}

.stat-value-mini {
  font-size: 14px;
  font-weight: 800;
  color: #333;
}

.style2-rankings-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
  margin-bottom: 15px;
}

.summary-card {
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.summary-title {
  padding: 6px;
  text-align: center;
  font-weight: bold;
  font-size: 13px;
  color: #fff;
}

.is-own .summary-title {
  background: #4285f4;
}

.is-opponent .summary-title {
  background: #e53935;
}

.top3-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
}

.top3-name {
  flex: 1;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-right: 5px;
}

.top3-value {
  font-weight: bold;
}

@media (max-width: 768px) {
  .style2-rankings-row {
    grid-template-columns: 1fr;
  }

  .stat-card-row {
    flex-direction: column;
  }
}
</style>
