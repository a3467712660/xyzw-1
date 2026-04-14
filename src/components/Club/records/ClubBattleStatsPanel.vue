<template>
  <div class="style2-dashboard">
    <div class="dashboard-stats">
      <div
        v-for="(row, rowIndex) in statRows"
        :key="`stats-row-${rowIndex}`"
        class="stat-card-row"
      >
        <div
          v-for="stat in row"
          :key="stat.label"
          class="stat-card-mini"
          :class="stat.tone ? `is-${stat.tone}` : ''"
        >
          <div class="stat-label-mini">{{ stat.label }}</div>
          <div class="stat-value-mini">{{ stat.value }}</div>
        </div>
      </div>
    </div>

    <div v-if="mvp" class="dashboard-mvp">
      <img
        v-if="mvp.avatar"
        class="mvp-avatar"
        :src="mvp.avatar"
        @error="$emit('image-error', $event)"
      >
      <div v-else class="mvp-avatar-placeholder">
        {{ getClubBattleAvatarText(mvp.name) }}
      </div>
      <div class="mvp-crown">👑</div>
      <div class="mvp-name">{{ mvp.name }}</div>
      <div class="mvp-label">{{ mvp.label }}</div>
      <div v-if="mvp.summary" class="mvp-summary">{{ mvp.summary }}</div>
    </div>
  </div>
</template>

<script setup>
import { getClubBattleAvatarText } from "./clubBattleRecordDisplayHelpers.js";

defineProps({
  mvp: {
    type: Object,
    default: null,
  },
  statRows: {
    type: Array,
    default: () => [],
  },
});

defineEmits(["image-error"]);
</script>

<style scoped lang="scss">
.style2-dashboard {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.dashboard-stats {
  flex: 1;
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

.stat-card-mini.is-warning .stat-value-mini {
  color: #ff9800;
}

.stat-card-mini.is-danger .stat-value-mini {
  color: #f44336;
}

.stat-card-mini.is-purple .stat-value-mini {
  color: #9c27b0;
}

.dashboard-mvp {
  min-width: 180px;
  background: linear-gradient(160deg, #fff 0%, #f7f3ff 100%);
  border-radius: 16px;
  padding: 16px;
  text-align: center;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.mvp-avatar,
.mvp-avatar-placeholder {
  width: 64px;
  height: 64px;
  border-radius: 50%;
}

.mvp-avatar {
  object-fit: cover;
}

.mvp-avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #c7b8ff;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
}

.mvp-crown {
  position: absolute;
  top: 10px;
  right: 12px;
  font-size: 20px;
}

.mvp-name {
  margin-top: 10px;
  font-weight: 700;
  color: #333;
}

.mvp-label {
  margin-top: 4px;
  font-size: 12px;
  color: #6d5bd0;
  font-weight: 600;
}

.mvp-summary {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

@media (max-width: 768px) {
  .style2-dashboard {
    flex-direction: column;
  }

  .stat-card-row {
    flex-wrap: wrap;
  }
}
</style>
