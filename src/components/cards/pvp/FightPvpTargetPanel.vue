<template>
  <div class="opponent-main-layout">
    <div class="info-card opponent-card left-card">
      <div class="card-title">
        <h4>{{ t("fightPvpCard.sections.opponentInfo") }}</h4>
      </div>

      <div class="opponent-info-table">
        <table class="info-table">
          <tbody>
            <tr>
              <td class="avatar-cell" rowspan="8">
                <n-avatar
                  round
                  class="opponent-avatar"
                  :size="60"
                  :src="memberData.headImg"
                ></n-avatar>
              </td>
              <td class="label-cell">{{ t("fightPvpCard.info.name") }}</td>
              <td class="value-cell">
                {{ memberData.name }}
                <n-tag
                  v-if="memberData.lineupType"
                  class="lineup-type-tag ml-8"
                  size="small"
                  :bordered="false"
                  :color="lineupTagColor"
                >
                  {{ memberData.lineupType }}
                </n-tag>
                <n-tag
                  v-if="memberData.legacy > 0"
                  class="legacy-tag ml-8"
                  size="small"
                  :style="{ '--legacy-bg': legacyBadge.color }"
                >
                  {{ legacyBadge.text }}
                </n-tag>
              </td>
            </tr>
            <tr>
              <td class="label-cell">{{ t("fightPvpCard.info.server") }}</td>
              <td class="value-cell">{{ memberData.serverName }}</td>
            </tr>
            <tr class="highlight-row">
              <td class="label-cell">{{ t("fightPvpCard.info.power") }}</td>
              <td class="value-cell power-value">
                {{ memberData.power }}
              </td>
            </tr>
            <tr>
              <td class="label-cell">{{ t("fightPvpCard.info.weapon") }}</td>
              <td class="value-cell">{{ memberData.lordWeaponId }}</td>
            </tr>
            <tr class="highlight-row">
              <td class="label-cell">{{ t("fightPvpCard.info.lineup") }}</td>
              <td class="value-cell lineup">
                <span class="red-count">
                  {{ t("fightPvpCard.labels.redCount", { value: memberData.red }) }}
                </span>
                <span class="separator">/</span>
                <span class="hole-count">
                  {{ t("fightPvpCard.labels.holeCount", { value: memberData.hole }) }}
                </span>
              </td>
            </tr>
            <tr>
              <td class="label-cell">{{ t("fightPvpCard.info.club") }}</td>
              <td class="value-cell">{{ memberData.legionName }}</td>
            </tr>
            <tr>
              <td class="label-cell">{{ t("fightPvpCard.info.clubPower") }}</td>
              <td class="value-cell">{{ memberData.MaxPower }}</td>
            </tr>
            <tr>
              <td class="label-cell">{{ t("fightPvpCard.info.currentRed") }}</td>
              <td class="value-cell">{{ memberData.legionRed }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="info-card heroes-card right-card">
      <div class="card-title">
        <h4>{{ t("fightPvpCard.sections.opponentLineup") }}</h4>
        <div class="card-title-right">
          <span class="hero-count">
            {{ t("fightPvpCard.labels.heroCount", { value: memberData.heroList.length }) }}
          </span>
          <span class="click-hint">
            {{ t("fightPvpCard.labels.clickAvatarHint") }}
          </span>
        </div>
      </div>

      <div class="heroes-grid compact">
        <div
          v-for="hero in memberData.heroList"
          :key="hero.heroId || hero.heroName"
          class="hero-card compact"
          @click="$emit('select-hero', hero)"
        >
          <div class="hero-avatar-container">
            <div class="hero-circle">
              <img
                v-if="hero.heroAvate"
                class="hero-avatar-img"
                :alt="hero.heroName"
                :src="hero.heroAvate"
              >
              <div v-else class="hero-placeholder">
                {{ getFightPvpAvatarText(hero.heroName) }}
              </div>
            </div>
          </div>

          <div class="hero-info compact">
            <div class="hero-name-row">
              <h5 class="hero-name">
                {{ hero.heroName || t("fightPvpCard.common.unknownHero") }}
              </h5>
              <n-tag
                class="holy-beast-tag"
                size="small"
                :type="hero.HolyBeast ? 'success' : 'warning'"
              >
                {{
                  hero.HolyBeast
                    ? t("fightPvpCard.labels.holyBeastOpened")
                    : t("fightPvpCard.labels.holyBeastClosed")
                }}
              </n-tag>
            </div>
            <div class="hero-stats">
              <span class="stat-item">
                {{ t("fightPvpCard.labels.powerValue", { value: hero.power || "0" }) }}
              </span>
              <span class="stat-item">
                {{ t("fightPvpCard.labels.starValue", { value: hero.star || "0" }) }}
              </span>
              <span class="stat-item">
                {{ t("fightPvpCard.labels.redCount", { value: hero.red || "0" }) }}
              </span>
              <span
                v-if="hero.HolyBeast"
                class="stat-item"
              >
                {{ t("fightPvpCard.labels.holyBeastLevel", { value: hero.HBlevel }) }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import {
  getFightPvpAvatarText,
  resolveFightPvpLegacyBadge,
  resolveFightPvpLineupTagColor,
} from "./pvpDisplayHelpers.js";

const props = defineProps({
  memberData: {
    type: Object,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
});

defineEmits(["select-hero"]);

const lineupTagColor = computed(() =>
  resolveFightPvpLineupTagColor(props.memberData?.lineupType),
);

const legacyBadge = computed(() =>
  resolveFightPvpLegacyBadge(
    props.memberData?.legacy,
    undefined,
    props.t("fightPvpCard.common.unknown"),
  ),
);
</script>

<style scoped lang="scss">
.opponent-main-layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.info-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-large);
  padding: 12px;
  transition: all 0.3s ease;
}

.info-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
}

.info-card.left-card,
.info-card.right-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 10px;
}

.card-title,
.card-title-right,
.hero-name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.card-title {
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--border-light);
}

.card-title h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.hero-count {
  font-size: 13px;
  color: var(--text-secondary);
}

.click-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  font-style: italic;
}

.opponent-info-table {
  width: 100%;
  overflow-x: auto;
}

.info-table {
  width: 100%;
  border-spacing: 0;
  border-collapse: collapse;
  table-layout: auto;
  flex: 1;
}

.info-table tr {
  height: 26px;
}

.info-table td {
  padding: 2px 5px;
  font-size: 13px;
  vertical-align: middle;
  height: 24px;
  line-height: 24px;
}

.avatar-cell {
  width: 70px;
  text-align: center;
  padding: 6px;
}

.opponent-avatar {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  border: 2px solid var(--primary-color-light);
}

.label-cell {
  width: 100px;
  color: var(--text-secondary);
  text-align: right;
  font-weight: 500;
  background-color: var(--bg-secondary);
  border-right: 1px solid var(--border-light);
  white-space: nowrap;
}

.value-cell {
  color: var(--text-primary);
  text-align: left;
  font-weight: 500;
  padding-left: 10px;
  white-space: nowrap;
  min-width: 120px;
}

.highlight-row .value-cell {
  color: var(--primary-color);
  font-weight: 600;
}

.lineup {
  display: flex;
  gap: 6px;
  align-items: center;
}

.red-count {
  color: #ef4444;
  font-weight: 600;
}

.separator {
  color: var(--text-secondary);
}

.hole-count {
  color: #10b981;
  font-weight: 600;
}

.heroes-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  justify-items: center;
  align-items: center;
  padding: 8px 0;
}

.hero-card {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  transition: all 0.3s ease;
}

.hero-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  border-color: var(--primary-color-light);
}

.hero-card.compact {
  width: 130px;
  height: 190px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.hero-avatar-container {
  position: relative;
  margin-bottom: 10px;
}

.hero-circle {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin: 0 auto 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.hero-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-placeholder {
  font-size: 24px;
  font-weight: 600;
  color: var(--text-secondary);
}

.hero-info {
  text-align: center;
}

.hero-name-row {
  justify-content: center;
  margin-bottom: 8px;
  height: 22px;
}

.hero-name {
  margin: 0;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  line-height: 22px;
}

.holy-beast-tag {
  font-size: 10px;
  padding: 2px 6px;
  margin: 0;
  display: inline-flex;
  align-items: center;
  height: 22px;
}

.hero-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.hero-stats .stat-item {
  font-size: 11px;
  line-height: 16px;
  color: var(--text-secondary);
}

.ml-8 {
  margin-left: 8px;
}

@media (max-width: 1200px) {
  .opponent-main-layout {
    grid-template-columns: 1fr;
  }

  .heroes-grid {
    grid-template-columns: repeat(5, minmax(100px, 1fr));
    gap: 12px;
  }
}

@media (max-width: 768px) {
  .heroes-grid {
    grid-template-columns: repeat(5, minmax(80px, 1fr));
    gap: 8px;
  }
}

@media (max-width: 480px) {
  .hero-card.compact {
    width: 100%;
    height: auto;
  }
}
</style>
