<template>
  <div class="style-4">
    <div class="style4-shell">
      <div class="style4-header">
        <div class="style4-header__copy">
          <span class="style4-header__eyebrow">{{ eyebrow }}</span>
          <h2>{{ title }}</h2>
        </div>
        <div class="style4-header__status">
          <span>{{ statusLabel }}</span>
          <strong>{{ statusValue }}</strong>
        </div>
      </div>

      <div class="style4-overview">
        <article
          v-for="metric in metrics"
          :key="metric.label"
          class="style4-overview__card"
        >
          <span>{{ metric.label }}</span>
          <strong>{{ metric.value }}</strong>
          <small>{{ metric.meta }}</small>
        </article>
      </div>

      <div class="style4-content">
        <div class="style4-rank-panels">
          <section
            v-for="panel in rankPanels"
            :key="panel.key"
            class="style4-rank-panel"
          >
            <header class="style4-rank-panel__head">
              <span>{{ panel.icon }}</span>
              <strong>{{ panel.title }}</strong>
            </header>
            <div class="style4-rank-panel__list">
              <div
                v-for="(player, index) in panel.items"
                :key="player.key || `${panel.key}-${index}`"
                class="style4-rank-panel__item"
              >
                <span class="style4-rank-panel__index">0{{ index + 1 }}</span>
                <span class="style4-rank-panel__name">{{ player.name }}</span>
                <span class="style4-rank-panel__value">{{ player.value }}</span>
              </div>
            </div>
          </section>
        </div>

        <div class="style4-table-panel">
          <table class="style4-table">
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
              <tr
                v-for="player in playerRows"
                :key="player.key || player.roleId"
              >
                <td>{{ player.rank }}</td>
                <td class="style4-table__name-cell">
                  <div class="style4-table__player">
                    <img
                      v-if="player.avatar || player.headImg"
                      class="style4-table__avatar"
                      :src="player.avatar || player.headImg"
                      @error="$emit('image-error', $event)"
                    >
                    <div v-else class="style4-table__avatar-placeholder">
                      {{ getClubBattleAvatarText(player.name) }}
                    </div>
                    <span>{{ player.name }}</span>
                  </div>
                </td>
                <td>{{ player.killCnt || player.winCnt || 0 }}</td>
                <td>{{ player.deathCnt || player.loseCnt || 0 }}</td>
                <td>{{ player.occupyCnt || player.buildingCnt || 0 }}</td>
                <td>{{ player.reviveCnt }}</td>
                <td>{{ player.kd }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { getClubBattleAvatarText } from "./clubBattleRecordDisplayHelpers.js";

defineProps({
  eyebrow: {
    type: String,
    default: "战术视图",
  },
  metrics: {
    type: Array,
    default: () => [],
  },
  playerRows: {
    type: Array,
    default: () => [],
  },
  rankPanels: {
    type: Array,
    default: () => [],
  },
  statusLabel: {
    type: String,
    default: "总 K/D",
  },
  statusValue: {
    type: [String, Number],
    default: "",
  },
  title: {
    type: String,
    default: "",
  },
});

defineEmits(["image-error"]);
</script>

<style scoped lang="scss">
.style-4 {
  background:
    radial-gradient(circle at top left, rgba(77, 134, 214, 0.18), transparent 24%),
    linear-gradient(180deg, #111827, #0f172a);
  padding: 20px;
  border-radius: 18px;
  color: #e5edf7;
  font-family: "SFMono-Regular", "JetBrains Mono", "Menlo", monospace;
}

.style4-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.style4-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 20px;
  border-radius: 18px;
  background: rgba(15, 23, 42, 0.56);
  border: 1px solid rgba(99, 120, 150, 0.22);
}

.style4-header__copy {
  min-width: 0;
}

.style4-header__eyebrow {
  display: inline-flex;
  margin-bottom: 10px;
  color: #7dd3fc;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.22em;
  text-transform: uppercase;
}

.style4-header__copy h2 {
  margin: 0;
  font-size: 28px;
  line-height: 1.08;
}

.style4-header__status {
  display: flex;
  min-width: 140px;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 16px;
  background: rgba(23, 37, 61, 0.9);
  border: 1px solid rgba(80, 110, 146, 0.26);
}

.style4-header__status span {
  color: #8ba1bb;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.style4-header__status strong {
  color: #f8fbff;
  font-size: 28px;
  line-height: 1;
}

.style4-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.style4-overview__card {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 16px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(86, 106, 134, 0.22);
}

.style4-overview__card span {
  color: #8aa2bf;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.style4-overview__card strong {
  font-size: 22px;
  color: #f8fbff;
}

.style4-overview__card small {
  color: #6e88a8;
  font-size: 12px;
  line-height: 1.5;
}

.style4-content {
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 16px;
}

.style4-rank-panels {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.style4-rank-panel {
  padding: 14px;
  border-radius: 16px;
  background: rgba(15, 23, 42, 0.54);
  border: 1px solid rgba(86, 106, 134, 0.22);
}

.style4-rank-panel__head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
  color: #d8e5f4;
  font-size: 13px;
}

.style4-rank-panel__list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.style4-rank-panel__item {
  display: grid;
  grid-template-columns: 32px minmax(0, 1fr) auto;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.style4-rank-panel__index {
  color: #5ec6ff;
}

.style4-rank-panel__name {
  min-width: 0;
  color: #eef5ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.style4-rank-panel__value {
  color: #f8c66d;
  font-weight: 700;
}

.style4-table-panel {
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(86, 106, 134, 0.22);
  background: rgba(15, 23, 42, 0.54);
}

.style4-table {
  width: 100%;
  border-collapse: collapse;
}

.style4-table thead {
  background: rgba(42, 67, 106, 0.9);
}

.style4-table th,
.style4-table td {
  padding: 12px 10px;
  border-bottom: 1px solid rgba(86, 106, 134, 0.18);
  text-align: center;
  font-size: 12px;
}

.style4-table th {
  color: #dce8f7;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.style4-table tbody tr:nth-child(even) {
  background: rgba(20, 30, 48, 0.4);
}

.style4-table__name-cell {
  text-align: left;
}

.style4-table__player {
  display: flex;
  align-items: center;
  gap: 8px;
}

.style4-table__avatar,
.style4-table__avatar-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  flex-shrink: 0;
}

.style4-table__avatar {
  object-fit: cover;
}

.style4-table__avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(94, 120, 155, 0.18);
  color: #bfd2e7;
}

@media (max-width: 768px) {
  .style4-content,
  .style4-overview {
    grid-template-columns: 1fr;
  }

  .style4-header {
    flex-direction: column;
  }
}
</style>
