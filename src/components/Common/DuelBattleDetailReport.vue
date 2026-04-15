<template>
  <div
    v-if="report"
    class="duel-battle-detail-report"
    :class="{ 'is-export': exportMode }"
  >
    <section class="battle-stage">
      <header class="battle-stage__header">
        <div class="battle-stage__back"></div>
        <h3 class="battle-stage__title">{{ t("fightPvpCard.detail.stageTitle") }}</h3>
        <div class="battle-stage__spacer"></div>
      </header>

      <div class="battle-stage__panel">
        <div v-if="!exportMode" class="battle-stage__action-bar">
          <button
            class="report-export-button report-export-button--primary"
            type="button"
            @click="emit('export')"
          >
            {{ t("fightPvpCard.detail.exportReport") }}
          </button>
          <button
            v-if="latestReplayState.visible"
            class="report-export-button report-export-button--secondary"
            type="button"
            :disabled="latestReplayState.disabled"
            :title="latestReplayState.title"
            @click="emit('open-replay', latestReplay)"
          >
            {{ latestReplayState.label }}
          </button>
        </div>

        <article class="overview-card">
          <div class="overview-card__top">
            <section class="player-summary player-summary--left">
              <div class="player-summary__avatar-wrap">
                <img
                  v-if="report.left?.headImg"
                  class="player-summary__avatar"
                  :alt="report.left.name || t('fightPvpCard.common.unknownPlayer')"
                  :src="report.left.headImg"
                >
                <div v-else class="player-summary__avatar player-summary__avatar--placeholder">
                  {{ buildNameFallback(report.left?.name) }}
                </div>
              </div>
              <div class="player-summary__text">
                <div class="player-summary__name">
                  {{ report.left?.name || t("fightPvpCard.common.unknownPlayer") }}
                </div>
                <div class="player-summary__power">{{ report.left?.powerText || "0" }}</div>
              </div>
            </section>

            <section class="player-summary player-summary--right">
              <div class="player-summary__text">
                <div class="player-summary__name">
                  {{ report.right?.name || t("fightPvpCard.common.unknownPlayer") }}
                </div>
                <div class="player-summary__power">{{ report.right?.powerText || "0" }}</div>
              </div>
              <div class="player-summary__avatar-wrap">
                <img
                  v-if="report.right?.headImg"
                  class="player-summary__avatar"
                  :alt="report.right.name || t('fightPvpCard.common.unknownPlayer')"
                  :src="report.right.headImg"
                >
                <div v-else class="player-summary__avatar player-summary__avatar--placeholder">
                  {{ buildNameFallback(report.right?.name) }}
                </div>
              </div>
            </section>
          </div>

          <div class="battle-board">
            <div class="hero-cluster hero-cluster--left">
              <div
                v-for="(hero, index) in leftBoardHeroes"
                :key="`left-${hero.heroId}-${index}`"
                class="board-hero"
                :class="hero.boardClass"
              >
                <div class="board-hero__avatar">
                  <img
                    v-if="hero.heroAvatar"
                    :alt="hero.heroName || t('fightPvpCard.common.unknownHero')"
                    :src="hero.heroAvatar"
                  >
                  <span v-else>{{ buildNameFallback(hero.heroName) }}</span>
                </div>
                <div class="board-hero__name-row">
                  <span class="board-hero__name">{{ hero.heroName || t("fightPvpCard.common.unknownHero") }}</span>
                  <span v-if="getHolyBeastStars(hero) > 0" class="board-hero__star">
                    {{ renderHolyBeastStars(hero) }}
                  </span>
                  <span v-if="shouldShowHolyBeastLevel(hero)" class="board-hero__level">
                    {{ formatHolyBeastLevel(hero) }}
                  </span>
                </div>
                <div v-if="hero.fishName || hero.pearlSkillName" class="board-hero__skills">
                  <span v-if="hero.fishName">{{ hero.fishName }}</span>
                  <span v-if="hero.pearlSkillName" class="board-hero__skill-link">
                    {{ hero.pearlSkillName }}
                  </span>
                </div>
                <div v-if="hero.pearlSlots?.length" class="board-hero__pearls">
                  <span
                    v-for="(slot, pearlIndex) in hero.pearlSlots"
                    :key="`left-board-${index}-${pearlIndex}`"
                    class="board-hero__pearl-dot"
                    :style="{ backgroundColor: slot.colorValue || '#d4d4d8' }"
                  ></span>
                </div>
              </div>
            </div>

            <div class="battle-board__center">VS</div>

            <div class="hero-cluster hero-cluster--right">
              <div
                v-for="(hero, index) in rightBoardHeroes"
                :key="`right-${hero.heroId}-${index}`"
                class="board-hero"
                :class="hero.boardClass"
              >
                <div class="board-hero__avatar">
                  <img
                    v-if="hero.heroAvatar"
                    :alt="hero.heroName || t('fightPvpCard.common.unknownHero')"
                    :src="hero.heroAvatar"
                  >
                  <span v-else>{{ buildNameFallback(hero.heroName) }}</span>
                </div>
                <div class="board-hero__name-row">
                  <span class="board-hero__name">{{ hero.heroName || t("fightPvpCard.common.unknownHero") }}</span>
                  <span v-if="getHolyBeastStars(hero) > 0" class="board-hero__star">
                    {{ renderHolyBeastStars(hero) }}
                  </span>
                  <span v-if="shouldShowEnemyHolyBeastLevel(hero)" class="board-hero__level">
                    {{ formatHolyBeastLevel(hero) }}
                  </span>
                </div>
                <div v-if="hero.fishName || hero.pearlSkillName" class="board-hero__skills">
                  <span v-if="hero.fishName">{{ hero.fishName }}</span>
                  <span v-if="hero.pearlSkillName" class="board-hero__skill-link">
                    {{ hero.pearlSkillName }}
                  </span>
                </div>
                <div v-if="hero.pearlSlots?.length" class="board-hero__pearls">
                  <span
                    v-for="(slot, pearlIndex) in hero.pearlSlots"
                    :key="`right-board-${index}-${pearlIndex}`"
                    class="board-hero__pearl-dot"
                    :style="{ backgroundColor: slot.colorValue || '#d4d4d8' }"
                  ></span>
                </div>
              </div>
            </div>
          </div>

          <div class="overview-card__divider"></div>

          <div class="overview-card__bottom">
            <div class="summary-group summary-group--left">
              <span class="summary-group__item">
                {{ t("fightPvpCard.detail.leftWins") }}:
                <strong>{{ report.summary?.leftWinCount ?? 0 }}</strong>
              </span>
              <span class="summary-group__item">
                {{ t("fightPvpCard.detail.leftPerfectWins") }}:
                <strong>{{ report.summary?.leftPerfectWinCount ?? 0 }}</strong>
              </span>
            </div>

            <div class="summary-rate">
              <span class="summary-rate__label">{{ t("fightPvpCard.detail.winRate") }}</span>
              <strong class="summary-rate__value">{{ formatWinRate(report.summary?.winRate) }}</strong>
            </div>

            <div class="summary-group summary-group--right">
              <span class="summary-group__item">
                {{ t("fightPvpCard.detail.rightWins") }}:
                <strong>{{ report.summary?.rightWinCount ?? 0 }}</strong>
              </span>
              <span class="summary-group__item">
                {{ t("fightPvpCard.detail.rightPerfectWins") }}:
                <strong>{{ report.summary?.rightPerfectWinCount ?? 0 }}</strong>
              </span>
            </div>
          </div>

        </article>
      </div>
    </section>

    <section class="records-shell">
      <div class="records-shell__title">
        {{ t("fightPvpCard.detail.recordCount", { count: report.totalCount }) }}
      </div>

      <div class="records-shell__list">
        <article
          v-for="round in report.rounds || []"
          :key="`round-${round.index}`"
          class="round-card"
          :class="round.isWin ? 'round-card--win' : 'round-card--loss'"
        >
          <div class="round-card__header">
            <div class="round-card__header-main">
              <span class="round-card__index">
                {{ t("fightPvpCard.detail.roundTitle", { index: round.index }) }}
              </span>
              <span
                class="round-card__state"
                :class="round.isWin ? 'round-card__state--win' : 'round-card__state--loss'"
              >
                {{ round.isWin ? t("fightPvpCard.detail.victory") : t("fightPvpCard.detail.defeat") }}
              </span>
            </div>
            <div class="round-card__header-side">
              <div class="round-card__meta">
                {{ t("fightPvpCard.detail.roundMeta", { roundCount: round.roundCount || 0, frameCount: round.totalFrame || 0 }) }}
              </div>
              <button
                v-if="!exportMode && resolveReplayState(getRoundReplay(round)).visible"
                class="report-export-button report-export-button--secondary report-export-button--compact"
                type="button"
                :disabled="resolveReplayState(getRoundReplay(round)).disabled"
                :title="resolveReplayState(getRoundReplay(round)).title"
                @click="emit('open-replay', getRoundReplay(round))"
              >
                {{ resolveReplayState(getRoundReplay(round)).label }}
              </button>
            </div>
          </div>

          <div class="table-card">
            <table class="battle-table">
              <thead>
                <tr>
                  <th>{{ t("fightPvpCard.detail.tableHero") }}</th>
                  <th>{{ t("fightPvpCard.detail.tableHeal") }}</th>
                  <th>{{ t("fightPvpCard.detail.tableTakeDamage") }}</th>
                  <th>{{ t("fightPvpCard.detail.tableDamage") }}</th>
                  <th>{{ t("fightPvpCard.detail.tableStatus") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in round.leftRows || []"
                  :key="`left-row-${round.index}-${row.battleTeamSlot}`"
                >
                  <td>
                    <div class="hero-row">
                      <span class="hero-row__name">{{ row.heroName || t("fightPvpCard.common.unknownHero") }}</span>
                      <span v-if="getHolyBeastStars(row) > 0" class="hero-row__star">
                        {{ renderHolyBeastStars(row) }}
                      </span>
                      <span v-if="shouldShowHolyBeastLevel(row)" class="hero-row__level">
                        {{ formatHolyBeastLevel(row) }}
                      </span>
                      <div v-if="row.pearlSlots?.length" class="hero-row__pearls">
                        <span
                          v-for="(slot, pearlIndex) in row.pearlSlots"
                          :key="`left-row-pearl-${round.index}-${row.battleTeamSlot}-${pearlIndex}`"
                          class="hero-row__pearl-dot"
                          :style="{ backgroundColor: slot.colorValue || '#d4d4d8' }"
                        ></span>
                      </div>
                    </div>
                  </td>
                  <td class="battle-table__number">{{ row.healText }}</td>
                  <td class="battle-table__number">{{ row.takeDamageText }}</td>
                  <td class="battle-table__number">{{ row.damageText }}</td>
                  <td>
                    <div class="status-cell">
                      <span class="status-cell__text">{{ formatHpPercent(row.hpPercent) }}</span>
                      <div class="status-cell__bar">
                        <div
                          class="status-cell__fill"
                          :class="row.hpPercent <= 30 ? 'status-cell__fill--danger' : 'status-cell__fill--safe'"
                          :style="{ width: `${clampPercent(row.hpPercent)}%` }"
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="round-card__vs">VS</div>

          <div class="table-card">
            <table class="battle-table">
              <thead>
                <tr>
                  <th>{{ t("fightPvpCard.detail.tableHero") }}</th>
                  <th>{{ t("fightPvpCard.detail.tableHeal") }}</th>
                  <th>{{ t("fightPvpCard.detail.tableTakeDamage") }}</th>
                  <th>{{ t("fightPvpCard.detail.tableDamage") }}</th>
                  <th>{{ t("fightPvpCard.detail.tableStatus") }}</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="row in round.rightRows || []"
                  :key="`right-row-${round.index}-${row.battleTeamSlot}`"
                >
                  <td>
                    <div class="hero-row">
                      <span class="hero-row__name">{{ row.heroName || t("fightPvpCard.common.unknownHero") }}</span>
                      <span v-if="getHolyBeastStars(row) > 0" class="hero-row__star">
                        {{ renderHolyBeastStars(row) }}
                      </span>
                      <span v-if="shouldShowEnemyHolyBeastLevel(row)" class="hero-row__level">
                        {{ formatHolyBeastLevel(row) }}
                      </span>
                      <div v-if="row.pearlSlots?.length" class="hero-row__pearls">
                        <span
                          v-for="(slot, pearlIndex) in row.pearlSlots"
                          :key="`right-row-pearl-${round.index}-${row.battleTeamSlot}-${pearlIndex}`"
                          class="hero-row__pearl-dot"
                          :style="{ backgroundColor: slot.colorValue || '#d4d4d8' }"
                        ></span>
                      </div>
                    </div>
                  </td>
                  <td class="battle-table__number">{{ row.healText }}</td>
                  <td class="battle-table__number">{{ row.takeDamageText }}</td>
                  <td class="battle-table__number">{{ row.damageText }}</td>
                  <td>
                    <div class="status-cell">
                      <span class="status-cell__text">{{ formatHpPercent(row.hpPercent) }}</span>
                      <div class="status-cell__bar">
                        <div
                          class="status-cell__fill"
                          :class="row.hpPercent <= 30 ? 'status-cell__fill--danger' : 'status-cell__fill--safe'"
                          :style="{ width: `${clampPercent(row.hpPercent)}%` }"
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";

const props = defineProps({
  currentBattleVersion: {
    type: Number,
    default: null,
  },
  report: {
    type: Object,
    default: null,
  },
  roundReplays: {
    type: Array,
    default: () => [],
  },
  exportMode: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["export", "open-replay"]);

const { t } = useI18n();

const createBoardHeroes = (heroes, side) => {
  const list = Array.isArray(heroes)
    ? heroes
        .slice()
        .sort((left, right) => Number(left?.battleTeamSlot || 0) - Number(right?.battleTeamSlot || 0))
        .slice(0, 5)
    : [];
  while (list.length < 5) {
    list.push({
      heroId: `placeholder-${list.length}`,
      heroName: "",
      heroAvatar: "",
      star: 0,
      order: 0,
      HolyBeast: false,
      HBlevel: 0,
      fishName: "",
      pearlSkillName: "",
      pearlSlots: [],
    });
  }
  return list.map((hero, index) => ({
    ...hero,
    boardClass: getBoardClass(side, index),
  }));
};

const getBoardClass = (side, index) => {
  if (index === 0) {
    return side === "left" ? "board-hero--left-front-top" : "board-hero--right-front-top";
  }
  if (index === 1) {
    return side === "left" ? "board-hero--left-front-bottom" : "board-hero--right-front-bottom";
  }
  if (index === 2) {
    return side === "left" ? "board-hero--left-back-top" : "board-hero--right-back-top";
  }
  if (index === 3) {
    return side === "left" ? "board-hero--left-back-middle" : "board-hero--right-back-middle";
  }
  return side === "left" ? "board-hero--left-back-bottom" : "board-hero--right-back-bottom";
};

const leftBoardHeroes = computed(() => createBoardHeroes(props.report?.left?.heroList, "left"));
const rightBoardHeroes = computed(() => createBoardHeroes(props.report?.right?.heroList, "right"));

const clampPercent = (value) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  return Math.min(Math.max(num, 0), 100);
};

const formatHpPercent = (value) => `${clampPercent(value).toFixed(0)}%`;
const formatWinRate = (value) => `${clampPercent(value).toFixed(1)}%`;

const getHolyBeastLevel = (hero) => Math.max(0, Number(hero?.HBlevel || 0));
const shouldShowHolyBeastLevel = (hero) =>
  !!String(hero?.heroName || "").trim() || Number.isFinite(Number(hero?.heroId));
const shouldShowEnemyHolyBeastLevel = (hero) =>
  (hero?.HolyBeast === true || getHolyBeastLevel(hero) > 0)
  && shouldShowHolyBeastLevel(hero);

const getHolyBeastStars = (hero) => {
  const level = getHolyBeastLevel(hero);
  const hasHolyBeast = hero?.HolyBeast === true || level > 0;
  if (!hasHolyBeast) {
    return 0;
  }
  return Math.max(1, Math.floor(level / 10) + 1);
};

const renderHolyBeastStars = (hero) => "★".repeat(getHolyBeastStars(hero));
const formatHolyBeastLevel = (hero) => `${getHolyBeastLevel(hero)}阶`;

const buildNameFallback = (name) => {
  const text = String(name || "").trim();
  return text.slice(0, 2) || "?";
};

const getRoundReplay = (round) => {
  const roundIndex = Math.max(Number(round?.index || 0) - 1, 0);
  return props.roundReplays?.[roundIndex] || null;
};

const resolveReplayState = (replay) => {
  if (!replay?.battleData) {
    return {
      visible: false,
      disabled: true,
      label: t("fightPvpCard.replay.missingPayload"),
      title: t("fightPvpCard.replay.emptyDescription"),
    };
  }

  if (!replay?.battleVersion) {
    return {
      visible: true,
      disabled: true,
      label: t("fightPvpCard.replay.missingVersion"),
      title: t("fightPvpCard.replay.missingVersion"),
    };
  }

  if (
    Number.isFinite(Number(props.currentBattleVersion))
    && Number(props.currentBattleVersion) > 0
    && Number(replay.battleVersion) !== Number(props.currentBattleVersion)
  ) {
    return {
      visible: true,
      disabled: true,
      label: t("fightPvpCard.replay.versionMismatchShort"),
      title: t("fightPvpCard.replay.versionMismatchTitle"),
    };
  }

  return {
    visible: true,
    disabled: false,
    label: t("fightPvpCard.replay.play"),
    title: t("fightPvpCard.replay.play"),
  };
};

const latestReplay = computed(() => {
  const roundReplays = Array.isArray(props.roundReplays) ? props.roundReplays : [];
  return roundReplays[roundReplays.length - 1] || null;
});

const latestReplayState = computed(() => resolveReplayState(latestReplay.value));
</script>

<style scoped>
.duel-battle-detail-report {
  --detail-orange: #ff8b43;
  --detail-orange-deep: #ff7135;
  --detail-orange-soft: #fff2e8;
  --detail-green: #63c52e;
  --detail-red: #ef5b63;
  --detail-ink: #2c2320;
  --detail-muted: #786f6b;
  --detail-card-shadow: 0 14px 32px rgba(255, 135, 67, 0.12);
  display: flex;
  flex-direction: column;
  gap: 18px;
  max-width: 920px;
  margin: 0 auto;
}

.battle-stage {
  overflow: hidden;
  border-radius: 32px;
  background: linear-gradient(180deg, var(--detail-orange) 0%, #ff8340 48%, #fff7f2 48.1%, #fff7f2 100%);
  box-shadow: 0 20px 48px rgba(255, 128, 57, 0.16);
}

.battle-stage__header {
  height: 112px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: #ffffff;
}

.battle-stage__back,
.battle-stage__spacer {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
}

.battle-stage__back {
  position: relative;
  opacity: 0.9;
}

.battle-stage__back::before {
  content: "";
  position: absolute;
  inset: 5px 7px 5px 3px;
  border-left: 3px solid currentColor;
  border-bottom: 3px solid currentColor;
  transform: rotate(45deg);
  border-radius: 2px;
}

.battle-stage__title {
  margin: 0;
  font-size: 28px;
  font-weight: 800;
  letter-spacing: 0.06em;
}

.battle-stage__panel {
  padding: 18px 18px 22px;
}

.battle-stage__action-bar {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.overview-card {
  background: #ffffff;
  border-radius: 26px;
  padding: 18px 20px 20px;
  box-shadow: var(--detail-card-shadow);
}

.overview-card__top {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
}

.player-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.player-summary--right {
  justify-content: flex-end;
  text-align: right;
}

.player-summary__avatar {
  width: 66px;
  height: 66px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 139, 67, 0.18);
  background: #fff7f2;
  box-shadow: 0 8px 18px rgba(255, 139, 67, 0.16);
}

.player-summary__avatar--placeholder {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--detail-orange-deep);
  font-size: 20px;
  font-weight: 800;
}

.player-summary__text {
  min-width: 0;
}

.player-summary__name {
  font-size: 22px;
  font-weight: 800;
  color: var(--detail-ink);
  line-height: 1.1;
  word-break: break-all;
}

.player-summary__power {
  margin-top: 4px;
  font-size: 17px;
  font-weight: 800;
  color: #efab23;
}

.battle-board {
  margin-top: 20px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 80px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
}

.battle-board__center {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  font-weight: 900;
  color: #ef5b63;
  text-shadow: 0 6px 14px rgba(239, 91, 99, 0.18);
}

.hero-cluster {
  display: grid;
  grid-template-columns: repeat(2, minmax(118px, 1fr));
  grid-auto-rows: minmax(118px, auto);
  gap: 10px 16px;
}

.board-hero--left-front-top {
  grid-column: 2;
  grid-row: 2;
}

.board-hero--left-front-bottom {
  grid-column: 2;
  grid-row: 4;
}

.board-hero--left-back-top {
  grid-column: 1;
  grid-row: 1;
}

.board-hero--left-back-middle {
  grid-column: 1;
  grid-row: 3;
}

.board-hero--left-back-bottom {
  grid-column: 1;
  grid-row: 5;
}

.board-hero--right-front-top {
  grid-column: 1;
  grid-row: 2;
}

.board-hero--right-front-bottom {
  grid-column: 1;
  grid-row: 4;
}

.board-hero--right-back-top {
  grid-column: 2;
  grid-row: 1;
}

.board-hero--right-back-middle {
  grid-column: 2;
  grid-row: 3;
}

.board-hero--right-back-bottom {
  grid-column: 2;
  grid-row: 5;
}

.board-hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 4px;
  min-height: 114px;
}

.board-hero__avatar {
  width: 78px;
  height: 78px;
  border-radius: 22px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle at 30% 20%, #ffffff 0%, #fff2e8 75%);
  color: #ff8b43;
  font-size: 20px;
  font-weight: 800;
}

.board-hero__avatar img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.board-hero__name-row {
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  min-height: 32px;
}

.board-hero__name {
  font-size: 14px;
  font-weight: 700;
  color: var(--detail-ink);
  line-height: 1.1;
  min-height: 15px;
}

.board-hero__star {
  font-size: 12px;
  font-weight: 700;
  color: #efab23;
  line-height: 1;
}

.board-hero__level {
  font-size: 11px;
  font-weight: 700;
  color: #d98b17;
  line-height: 1;
}

.board-hero__skills {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 2px 4px;
  font-size: 12px;
  color: var(--detail-muted);
  line-height: 1.15;
  min-height: 28px;
}

.board-hero__skill-link {
  color: #57b7d9;
}

.board-hero__pearls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 10px;
}

.board-hero__pearl-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.06);
}

.overview-card__divider {
  height: 1px;
  background: linear-gradient(90deg, rgba(255, 139, 67, 0) 0%, rgba(255, 139, 67, 0.25) 18%, rgba(255, 139, 67, 0.25) 82%, rgba(255, 139, 67, 0) 100%);
  margin: 18px 0 16px;
}

.overview-card__bottom {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 10px;
  align-items: center;
}

.report-export-button {
  border: none;
  border-radius: 999px;
  padding: 12px 24px;
  background: linear-gradient(180deg, #ff9a55 0%, #ff7a3f 100%);
  color: #ffffff;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: 0.04em;
  cursor: pointer;
  box-shadow: 0 10px 20px rgba(255, 122, 63, 0.24);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.report-export-button--primary {
  min-width: 220px;
}

.report-export-button--secondary {
  background: linear-gradient(180deg, #5f87ff 0%, #3c6ef0 100%);
  min-width: 180px;
}

.report-export-button--compact {
  min-width: auto;
  padding: 8px 14px;
  font-size: 12px;
}

.report-export-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 14px 24px rgba(255, 122, 63, 0.3);
}

.report-export-button:disabled {
  opacity: 0.72;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.summary-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 14px;
  color: var(--detail-muted);
}

.summary-group--right {
  text-align: right;
  align-items: flex-end;
}

.summary-group__item strong {
  color: var(--detail-orange-deep);
  font-size: 18px;
}

.summary-rate {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.summary-rate__label {
  font-size: 14px;
  color: #c99a16;
  font-weight: 700;
}

.summary-rate__value {
  font-size: 32px;
  font-weight: 900;
  color: #e7a10f;
  line-height: 1;
}

.records-shell {
  padding: 0 12px 4px;
}

.records-shell__title {
  text-align: center;
  font-size: 30px;
  font-weight: 900;
  color: var(--detail-ink);
  margin-bottom: 14px;
}

.records-shell__list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.round-card {
  background: #ffffff;
  border-radius: 24px;
  padding: 16px 14px 18px;
  box-shadow: 0 12px 28px rgba(29, 17, 12, 0.08);
}

.round-card__header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.round-card__header-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.round-card__header-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.round-card__index {
  font-size: 18px;
  font-weight: 800;
  color: var(--detail-ink);
}

.round-card__state {
  font-size: 15px;
  font-weight: 800;
}

.round-card__state--win {
  color: #75bb2e;
}

.round-card__state--loss {
  color: #ef5b63;
}

.round-card__meta {
  font-size: 12px;
  color: var(--detail-muted);
}

.table-card {
  overflow: hidden;
  border-radius: 18px;
  border: 1px solid rgba(255, 139, 67, 0.12);
  background: #ffffff;
}

.battle-table {
  width: 100%;
  border-collapse: collapse;
  table-layout: fixed;
}

.battle-table thead th {
  padding: 11px 8px;
  background: linear-gradient(180deg, #ff9f59 0%, #ff8847 100%);
  color: #ffffff;
  font-size: 13px;
  font-weight: 800;
  text-align: center;
}

.battle-table thead th:first-child {
  border-top-left-radius: 14px;
  border-bottom-left-radius: 14px;
}

.battle-table thead th:last-child {
  border-top-right-radius: 14px;
  border-bottom-right-radius: 14px;
}

.battle-table tbody tr:nth-child(odd) {
  background: #fffdfa;
}

.battle-table tbody tr:nth-child(even) {
  background: #ffffff;
}

.battle-table td {
  padding: 12px 10px;
  border-bottom: 1px solid #f2ece7;
  text-align: center;
  color: #60544f;
  font-size: 13px;
}

.battle-table tbody tr:last-child td {
  border-bottom: none;
}

.battle-table__number {
  font-size: 13px;
  font-weight: 700;
}

.hero-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-start;
  gap: 5px 6px;
  text-align: left;
}

.hero-row__name {
  color: var(--detail-ink);
  font-size: 13px;
  font-weight: 700;
}

.hero-row__star {
  color: #efab23;
  font-size: 11px;
  font-weight: 700;
}

.hero-row__level {
  color: #d98b17;
  font-size: 11px;
  font-weight: 700;
}

.hero-row__pearls {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.hero-row__pearl-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  border: 1px solid rgba(0, 0, 0, 0.05);
}

.round-card__vs {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 0 10px;
  font-size: 28px;
  font-weight: 900;
  color: #ef5b63;
}

.status-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.status-cell__text {
  font-size: 13px;
  font-weight: 800;
  color: var(--detail-ink);
}

.status-cell__bar {
  width: min(100%, 120px);
  height: 8px;
  border-radius: 999px;
  background: #e9e3de;
  overflow: hidden;
}

.status-cell__fill {
  height: 100%;
  border-radius: inherit;
}

.status-cell__fill--safe {
  background: linear-gradient(90deg, #71cf3b 0%, #58b920 100%);
}

.status-cell__fill--danger {
  background: linear-gradient(90deg, #ff6f76 0%, #ef5b63 100%);
}

.is-export .battle-stage,
.is-export .overview-card,
.is-export .round-card {
  box-shadow: none;
}

.is-export .status-cell__fill {
  transition: none;
}

@media (max-width: 960px) {
  .duel-battle-detail-report {
    max-width: 100%;
  }

  .battle-board {
    grid-template-columns: minmax(0, 1fr) 68px minmax(0, 1fr);
    gap: 6px;
  }

  .battle-board__center {
    font-size: 42px;
  }

  .hero-cluster {
    grid-template-columns: repeat(2, minmax(88px, 1fr));
    grid-auto-rows: minmax(102px, auto);
    gap: 8px 12px;
  }

  .overview-card__bottom {
    grid-template-columns: 1fr auto 1fr;
    gap: 8px;
  }

  .board-hero {
    min-height: 102px;
  }

  .board-hero__avatar {
    width: 70px;
    height: 70px;
    border-radius: 18px;
  }

  .board-hero__name {
    font-size: 13px;
  }

  .board-hero__skills {
    min-height: 24px;
    font-size: 11px;
  }

  .summary-group {
    font-size: 13px;
  }

  .summary-group__item strong {
    font-size: 16px;
  }

  .summary-rate__value {
    font-size: 28px;
  }
}

@media (max-width: 768px) {
  .battle-stage {
    border-radius: 24px;
  }

  .battle-stage__header {
    height: 88px;
    padding: 0 16px;
  }

  .battle-stage__title {
    font-size: 22px;
  }

  .battle-stage__panel {
    padding: 12px 8px 16px;
  }

  .overview-card {
    border-radius: 20px;
    padding: 14px 10px 14px;
  }

  .player-summary__name {
    font-size: 15px;
  }

  .player-summary__power {
    font-size: 14px;
  }

  .player-summary__avatar {
    width: 46px;
    height: 46px;
  }

  .player-summary {
    gap: 8px;
  }

  .battle-board {
    margin-top: 14px;
    grid-template-columns: minmax(0, 1fr) 52px minmax(0, 1fr);
    gap: 4px;
  }

  .battle-board__center {
    font-size: 34px;
  }

  .hero-cluster {
    grid-template-columns: repeat(2, minmax(70px, 1fr));
    grid-auto-rows: minmax(88px, auto);
    gap: 6px 8px;
  }

  .board-hero {
    min-height: 88px;
  }

  .board-hero__avatar {
    width: 56px;
    height: 56px;
    border-radius: 16px;
  }

  .board-hero__name-row {
    min-height: 28px;
  }

  .board-hero__name {
    font-size: 12px;
  }

  .board-hero__star,
  .board-hero__level {
    font-size: 10px;
  }

  .board-hero__skills {
    min-height: 20px;
    font-size: 10px;
    gap: 1px 4px;
  }

  .board-hero__pearl-dot {
    width: 9px;
    height: 9px;
  }

  .records-shell {
    padding: 0 4px 4px;
  }

  .records-shell__title {
    font-size: 22px;
    margin-bottom: 10px;
  }

  .overview-card__bottom {
    grid-template-columns: 1fr auto 1fr;
    gap: 4px;
  }

  .summary-group {
    font-size: 11px;
  }

  .summary-group__item strong {
    font-size: 15px;
  }

  .summary-rate__label {
    font-size: 12px;
  }

  .summary-rate__value {
    font-size: 22px;
  }

  .round-card {
    border-radius: 18px;
    padding: 14px 10px 16px;
  }

  .round-card__header {
    flex-direction: row;
    align-items: center;
    gap: 8px;
  }

  .round-card__header-side {
    align-items: flex-start;
  }

  .battle-table thead th,
  .battle-table td {
    padding-left: 6px;
    padding-right: 6px;
  }

  .battle-table thead th {
    font-size: 12px;
  }

  .battle-table td,
  .battle-table__number,
  .hero-row__name {
    font-size: 12px;
  }

  .hero-row__star,
  .hero-row__level {
    font-size: 10px;
  }

  .status-cell__bar {
    width: 92px;
  }
}
</style>
