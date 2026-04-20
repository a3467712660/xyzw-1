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
          role="button"
          tabindex="0"
          @click="emit('select-hero', hero)"
          @keydown.enter="emit('select-hero', hero)"
          @keydown.space.prevent="emit('select-hero', hero)"
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

const emit = defineEmits(["select-hero"]);

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
  grid-template-columns: minmax(288px, 340px) minmax(0, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.info-card {
  position: relative;
  overflow: hidden;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(239, 246, 255, 0.32)),
    var(--bg-secondary);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: var(--border-radius-large);
  padding: 14px;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.68) inset,
    0 14px 34px rgba(30, 64, 175, 0.08);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.info-card:hover {
  border-color: rgba(37, 99, 235, 0.2);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.76) inset,
    0 18px 42px rgba(30, 64, 175, 0.12);
  transform: translateY(-1px);
}

.info-card.left-card,
.info-card.right-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
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
  flex-wrap: wrap;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(37, 99, 235, 0.12);
}

.card-title h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 800;
  color: var(--text-primary);
}

.card-title-right {
  justify-content: flex-end;
  flex-wrap: wrap;
  row-gap: 6px;
}

.hero-count {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 9px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.1);
  color: var(--primary-color);
  font-size: 13px;
  font-weight: 700;
}

.click-hint {
  font-size: 12px;
  color: var(--text-tertiary);
  line-height: 1.4;
}

.opponent-info-table {
  width: 100%;
  overflow: hidden;
}

.info-table {
  width: 100%;
  border-spacing: 0;
  border-collapse: collapse;
  table-layout: fixed;
  flex: 1;
}

.info-table tr {
  height: 30px;
}

.info-table td {
  padding: 4px 6px;
  font-size: 13px;
  vertical-align: middle;
  height: 28px;
  line-height: 1.35;
}

.avatar-cell {
  width: 72px;
  text-align: center;
  padding: 8px 8px 8px 0;
}

.opponent-avatar {
  box-shadow:
    0 0 0 4px rgba(37, 99, 235, 0.08),
    0 10px 22px rgba(30, 64, 175, 0.14);
  border: 2px solid rgba(37, 99, 235, 0.18);
}

.label-cell {
  width: 78px;
  color: var(--text-secondary);
  text-align: right;
  font-weight: 700;
  background-color: transparent;
  border-right: 1px solid rgba(37, 99, 235, 0.1);
  white-space: nowrap;
}

.value-cell {
  color: var(--text-primary);
  text-align: left;
  font-weight: 650;
  padding-left: 10px !important;
  white-space: normal;
  word-break: break-word;
}

.highlight-row .value-cell {
  color: var(--primary-color);
  font-weight: 800;
}

.lineup {
  display: flex;
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.red-count {
  color: #ef4444;
  font-weight: 700;
}

.separator {
  color: var(--text-secondary);
}

.hole-count {
  color: #10b981;
  font-weight: 700;
}

.heroes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  gap: 12px;
  align-items: stretch;
  padding: 2px 0 0;
}

.hero-card {
  position: relative;
  min-width: 0;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.82), rgba(248, 250, 252, 0.78)),
    var(--bg-primary);
  border: 1px solid rgba(37, 99, 235, 0.12);
  border-radius: 18px;
  cursor: pointer;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.72) inset,
    0 10px 22px rgba(15, 23, 42, 0.06);
  transition:
    border-color 0.2s ease,
    box-shadow 0.2s ease,
    transform 0.2s ease;
}

.hero-card:focus-visible {
  outline: 3px solid rgba(37, 99, 235, 0.28);
  outline-offset: 3px;
}

.hero-card:hover {
  transform: translateY(-2px);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 16px 30px rgba(30, 64, 175, 0.12);
  border-color: rgba(37, 99, 235, 0.24);
}

.hero-card.compact {
  width: 100%;
  min-height: 172px;
  height: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: center;
}

.hero-avatar-container {
  position: relative;
  margin-bottom: 8px;
}

.hero-circle {
  width: 58px;
  height: 58px;
  border-radius: 16px;
  background:
    radial-gradient(circle at 30% 20%, rgba(255, 255, 255, 0.95), rgba(219, 234, 254, 0.72)),
    var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin: 0 auto;
  box-shadow:
    0 0 0 1px rgba(37, 99, 235, 0.12),
    0 8px 18px rgba(30, 64, 175, 0.12);
}

.hero-avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.hero-placeholder {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-secondary);
}

.hero-info {
  width: 100%;
  text-align: center;
}

.hero-name-row {
  flex-direction: column;
  justify-content: center;
  margin-bottom: 8px;
  min-height: 44px;
  gap: 4px;
}

.hero-name {
  margin: 0;
  max-width: 100%;
  overflow: hidden;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 800;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.holy-beast-tag {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  margin: 0;
  padding: 1px 7px;
  font-size: 10px;
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 5px;
}

.hero-stats .stat-item {
  max-width: 100%;
  min-height: 20px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(37, 99, 235, 0.07);
  color: var(--text-secondary);
  font-size: 10px;
  line-height: 16px;
  white-space: nowrap;
}

.ml-8 {
  margin-left: 8px;
}

:global([data-theme="dark"]) .info-card {
  background:
    linear-gradient(180deg, rgba(30, 41, 59, 0.78), rgba(15, 23, 42, 0.82)),
    var(--bg-secondary);
  border-color: rgba(96, 165, 250, 0.18);
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.24);
}

:global([data-theme="dark"]) .hero-card {
  background:
    linear-gradient(180deg, rgba(30, 41, 59, 0.76), rgba(15, 23, 42, 0.86)),
    var(--bg-primary);
  border-color: rgba(96, 165, 250, 0.18);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.24);
}

:global([data-theme="dark"]) .hero-stats .stat-item,
:global([data-theme="dark"]) .hero-count {
  background: rgba(96, 165, 250, 0.14);
}

@media (max-width: 1200px) {
  .opponent-main-layout {
    grid-template-columns: 1fr;
  }

  .heroes-grid {
    grid-template-columns: repeat(auto-fit, minmax(132px, 1fr));
  }
}

@media (max-width: 768px) {
  .opponent-main-layout {
    gap: 12px;
  }

  .info-card.left-card,
  .info-card.right-card {
    padding: 12px;
    border-radius: 18px;
  }

  .card-title {
    align-items: flex-start;
  }

  .card-title-right {
    justify-content: flex-start;
  }

  .click-hint {
    flex-basis: 100%;
  }

  .info-table td {
    font-size: 12px;
  }

  .avatar-cell {
    width: 58px;
  }

  .opponent-avatar {
    width: 52px !important;
    height: 52px !important;
  }

  .label-cell {
    width: 70px;
  }

  .heroes-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .hero-card.compact {
    min-height: 154px;
    padding: 11px 8px;
  }

  .hero-circle {
    width: 52px;
    height: 52px;
    border-radius: 15px;
  }

  .hero-name-row {
    min-height: 40px;
  }

  .hero-stats {
    gap: 4px;
  }

  .hero-stats .stat-item {
    padding-inline: 6px;
    font-size: 10px;
  }
}

@media (max-width: 480px) {
  .heroes-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .hero-card.compact {
    min-height: 150px;
  }

  .value-cell {
    padding-left: 8px !important;
  }
}
</style>
