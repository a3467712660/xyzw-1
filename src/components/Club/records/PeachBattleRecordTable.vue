<template>
  <div :class="wrapperClass">
    <table :class="tableClass">
      <thead>
        <tr>
          <th>排名</th>
          <th>成员</th>
          <th>击杀</th>
          <th>连杀</th>
          <th>抢船</th>
          <th>复活</th>
          <th>K/D</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, index) in rows" :key="row.key || index">
          <td>
            <div v-if="index < 3" :class="medalClass">
              {{ getClubBattleRankMedal(index) }}
            </div>
            <span v-else :class="rankClass">{{ row.rank || index + 1 }}</span>
          </td>
          <td :class="nameCellClass">
            <div :class="playerClass">
              <img
                v-if="row.avatar"
                :class="avatarClass"
                :src="row.avatar"
                @error="$emit('image-error', $event)"
              >
              <div v-else :class="avatarPlaceholderClass">
                {{ getClubBattleAvatarText(row.name) }}
              </div>
              <span :class="playerNameClass">{{ row.name }}</span>
            </div>
          </td>
          <td
            v-if="variant === 'style1'"
            class="stat-bg-cell"
            :style="{ '--cell-bg': getClubBattleKillColor(row.killCnt) }"
          >
            {{ row.killCnt || 0 }}
          </td>
          <td v-else>
            <div class="bar-cell">
              <div class="bar-val red">{{ row.killCnt || 0 }}</div>
              <div class="progress-bg">
                <div
                  class="progress-fill red"
                  :style="{ '--fill-width': `${getPercent(row.killCnt)}%` }"
                ></div>
              </div>
            </div>
          </td>
          <td>{{ row.killStreakCnt || 0 }}</td>
          <td>{{ row.occupyCnt || 0 }}</td>
          <td
            v-if="variant === 'style1'"
            class="stat-bg-cell"
            :style="{
              '--cell-bg': getClubBattleReviveColor(row.reviveCnt, { high: 10 }),
            }"
          >
            {{ row.reviveCnt || 0 }}
          </td>
          <td v-else>{{ row.reviveCnt || 0 }}</td>
          <td class="kd-val">{{ row.kd }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { computed } from "vue";
import {
  getClubBattleKillColor,
  getClubBattleRankMedal,
  getClubBattleReviveColor,
} from "./clubBattleRecordFormatters.js";
import { getClubBattleAvatarText } from "./clubBattleRecordDisplayHelpers.js";

const props = defineProps({
  maxKills: {
    type: Number,
    default: 0,
  },
  rows: {
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

const wrapperClass = computed(() =>
  props.variant === "style1" ? "style1-table-container" : "style2-table-wrapper",
);

const tableClass = computed(() => [
  props.variant === "style1" ? "style1-table" : "style2-table",
  `is-${props.tone}`,
]);

const medalClass = computed(() =>
  props.variant === "style1" ? "rank-medal" : "medal-icon",
);

const rankClass = computed(() =>
  props.variant === "style1" ? "" : "rank-num-plain",
);

const nameCellClass = computed(() =>
  props.variant === "style1" ? "col-name" : "",
);

const playerClass = computed(() =>
  props.variant === "style1" ? "player-info" : "player-cell",
);

const avatarClass = computed(() =>
  props.variant === "style1" ? "player-avatar-small" : "avatar-xs",
);

const avatarPlaceholderClass = computed(() =>
  props.variant === "style1"
    ? "player-avatar-placeholder-small"
    : "avatar-placeholder-xs",
);

const playerNameClass = computed(() =>
  props.variant === "style1" ? "" : "player-name-s2",
);

const getPercent = (value) => {
  if (!props.maxKills) {
    return 0;
  }
  return Math.min(100, (Number(value || 0) / props.maxKills) * 100);
};
</script>

<style scoped lang="scss">
.style1-table-container,
.style2-table-wrapper {
  width: 100%;
  overflow-x: auto;
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

.style1-table.is-own th {
  background: #aa50aa;
  color: #fff;
  border-bottom: none;
}

.style1-table.is-opponent th {
  background: #e55555;
  color: #fff;
  border-bottom: none;
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

.style2-table-wrapper {
  background: #fff;
  padding: 0;
}

.style2-table thead {
  background: #4285f4;
}

.style2-table.is-opponent thead {
  background: #e53935;
}

.style2-table th {
  color: #fff;
  padding: 8px 4px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
}

.style2-table th:nth-child(2) {
  text-align: left;
  padding-left: 10px;
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

.col-name {
  text-align: left !important;
  padding-left: 5px !important;
}

.player-info,
.player-cell {
  display: flex;
  align-items: center;
  gap: 5px;
}

.player-cell {
  justify-content: flex-start;
  padding-left: 5px;
}

.player-avatar-small,
.player-avatar-placeholder-small {
  width: 20px;
  height: 20px;
  border-radius: 50%;
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

.rank-medal,
.medal-icon {
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

.avatar-xs,
.avatar-placeholder-xs {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.avatar-placeholder-xs {
  font-size: 10px;
}

.player-name-s2 {
  font-weight: 600;
  color: #333;
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
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

.kd-val {
  font-weight: bold;
  color: #4caf50;
}
</style>
