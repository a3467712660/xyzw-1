<template>
  <div :class="wrapperClass">
    <table :class="tableClass">
      <thead>
        <tr>
          <th>排名</th>
          <th>成员</th>
          <th>击杀</th>
          <th>死亡</th>
          <th>攻城</th>
          <th>复活丹</th>
          <th>K/D</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(player, index) in rows" :key="player.key || index">
          <td>
            <div v-if="index < 3" class="rank-medal">
              {{ index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉" }}
            </div>
            <div v-else class="rank-num-plain">{{ player.rank || index + 1 }}</div>
          </td>
          <td class="name-cell">
            <div class="player-cell">
              <img
                v-if="player.avatar"
                :class="avatarClass"
                :src="player.avatar"
                @error="$emit('image-error', $event)"
              >
              <div v-else :class="avatarPlaceholderClass">
                {{ getClubBattleAvatarText(player.name) }}
              </div>
              <span class="player-name">{{ player.name }}</span>
            </div>
          </td>
          <td v-if="variant === 'style1'" class="stat-bg-cell" :style="{ '--cell-bg': getKillColor(player.killCnt) }">
            {{ player.killCnt || 0 }}
          </td>
          <td v-else>
            <div class="bar-cell">
              <div class="bar-val red">{{ player.killCnt || 0 }}</div>
              <div class="progress-bg">
                <div class="progress-fill red" :style="{ '--fill-width': `${getPercent(player.killCnt, maxKills)}%` }"></div>
              </div>
            </div>
          </td>
          <td v-if="variant === 'style1'" class="stat-bg-cell" :style="{ '--cell-bg': getDeathColor(player.deathCnt) }">
            {{ player.deathCnt || 0 }}
          </td>
          <td v-else>
            <div class="bar-cell">
              <div class="bar-val gray">{{ player.deathCnt || 0 }}</div>
              <div class="progress-bg">
                <div class="progress-fill gray" :style="{ '--fill-width': `${getPercent(player.deathCnt, maxDeaths)}%` }"></div>
              </div>
            </div>
          </td>
          <td v-if="variant === 'style1'" class="stat-bg-cell" :style="{ '--cell-bg': getOccupyColor(player.occupyCnt) }">
            {{ player.occupyCnt || 0 }}
          </td>
          <td v-else>
            <div class="bar-cell">
              <div class="bar-val orange">{{ player.occupyCnt || 0 }}</div>
              <div class="progress-bg">
                <div class="progress-fill orange" :style="{ '--fill-width': `${getPercent(player.occupyCnt, maxOccupies)}%` }"></div>
              </div>
            </div>
          </td>
          <td v-if="variant === 'style1'" class="stat-bg-cell" :style="{ '--cell-bg': getReviveColor(player.reviveCnt) }">
            {{ player.reviveCnt || 0 }}
          </td>
          <td v-else>{{ player.reviveCnt || 0 }}</td>
          <td class="kd-val">{{ player.kd }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { getClubBattleAvatarText } from "./clubBattleRecordDisplayHelpers.js";

const props = defineProps({
  getDeathColor: {
    type: Function,
    default: (value) => value,
  },
  getKillColor: {
    type: Function,
    default: (value) => value,
  },
  getOccupyColor: {
    type: Function,
    default: (value) => value,
  },
  getReviveColor: {
    type: Function,
    default: (value) => value,
  },
  maxDeaths: {
    type: Number,
    default: 0,
  },
  maxKills: {
    type: Number,
    default: 0,
  },
  maxOccupies: {
    type: Number,
    default: 0,
  },
  rows: {
    type: Array,
    default: () => [],
  },
  variant: {
    type: String,
    default: "style1",
  },
});

defineEmits(["image-error"]);

const wrapperClass = computed(() =>
  props.variant === "style1" ? "style1-table-container" : "style2-table-wrapper",
);

const tableClass = computed(() =>
  props.variant === "style1" ? "style1-table" : "style2-table",
);

const avatarClass = computed(() =>
  props.variant === "style1" ? "player-avatar-small" : "avatar-xs",
);

const avatarPlaceholderClass = computed(() =>
  props.variant === "style1"
    ? "player-avatar-placeholder-small"
    : "avatar-placeholder-xs",
);

const getPercent = (value, max) => {
  const normalizedMax = Number(max) || 0;
  if (!normalizedMax) {
    return 0;
  }
  return Math.min(100, ((Number(value) || 0) / normalizedMax) * 100);
};
</script>

<style scoped lang="scss">
.style1-table-container,
.style2-table-wrapper {
  width: 100%;
  overflow-x: auto;
}

.style2-table-wrapper {
  background: #fff;
  padding: 0;
}

.style1-table,
.style2-table {
  width: 100%;
  border-collapse: collapse;
}

.style1-table {
  font-size: 12px;
}

.style1-table th {
  background: #f0f0f0;
  color: #333;
  padding: 6px;
  text-align: center;
  font-weight: bold;
  border-bottom: 2px solid #ddd;
}

.style1-table td {
  padding: 5px;
  border-bottom: 1px solid #eee;
  text-align: center;
  vertical-align: middle;
  height: 32px;
}

.style1-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.style2-table thead {
  background: #4285f4;
}

.style2-table th {
  color: #fff;
  padding: 8px 4px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
}

.style2-table td {
  padding: 6px 4px;
  border-bottom: 1px solid #f1f1f1;
  vertical-align: middle;
  text-align: center;
  font-size: 12px;
  color: #444;
}

.style2-table tr:hover {
  background: #f8fbff;
}

.name-cell {
  text-align: left !important;
  padding-left: 5px !important;
}

.player-cell {
  display: flex;
  align-items: center;
  gap: 5px;
  justify-content: flex-start;
  padding-left: 5px;
}

.player-name {
  font-weight: 600;
  color: #333;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.player-avatar-small,
.player-avatar-placeholder-small,
.avatar-xs,
.avatar-placeholder-xs {
  border-radius: 50%;
}

.player-avatar-small,
.player-avatar-placeholder-small {
  width: 20px;
  height: 20px;
}

.avatar-xs,
.avatar-placeholder-xs {
  width: 24px;
  height: 24px;
}

.player-avatar-small,
.avatar-xs {
  object-fit: cover;
}

.player-avatar-placeholder-small,
.avatar-placeholder-xs {
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.player-avatar-placeholder-small {
  font-size: 10px;
}

.avatar-placeholder-xs {
  font-size: 10px;
}

.rank-medal {
  font-size: 16px;
  line-height: 1;
}

.rank-num-plain {
  font-weight: bold;
  color: #888;
}

.stat-bg-cell {
  background-color: var(--cell-bg);
}

.bar-cell {
  display: flex;
  align-items: center;
  gap: 5px;
  width: 100%;
}

.bar-val {
  width: 20px;
  text-align: right;
  font-weight: bold;
  font-size: 11px;
}

.bar-val.red {
  color: #ff5252;
}

.bar-val.gray {
  color: #9e9e9e;
}

.bar-val.orange {
  color: #ffab40;
}

.progress-bg {
  flex: 1;
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
  min-width: 30px;
}

.progress-fill {
  width: var(--fill-width);
  height: 100%;
  border-radius: 2px;
}

.progress-fill.red {
  background: #ff5252;
}

.progress-fill.gray {
  background: #9e9e9e;
}

.progress-fill.orange {
  background: #ffab40;
}

.kd-val {
  font-weight: bold;
  color: #4caf50;
}
</style>
