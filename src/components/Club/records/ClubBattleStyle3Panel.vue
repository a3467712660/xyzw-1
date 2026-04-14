<template>
  <div class="style-3">
    <div class="style3-hero">
      <div class="style3-hero__copy">
        <span class="style3-kicker">{{ kicker }}</span>
        <h2>{{ title }}</h2>
      </div>

      <div v-if="mvp" class="style3-mvp">
        <div class="style3-mvp__medal">MVP</div>
        <div class="style3-mvp__player">
          <img
            v-if="mvp.avatar || mvp.headImg"
            class="style3-mvp__avatar"
            :src="mvp.avatar || mvp.headImg"
            @error="$emit('image-error', $event)"
          >
          <div v-else class="style3-mvp__avatar-placeholder">
            {{ getClubBattleAvatarText(mvp.name) }}
          </div>
          <div class="style3-mvp__meta">
            <strong>{{ mvp.name }}</strong>
            <span>{{ mvpMeta }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="style3-stats-grid">
      <article
        v-for="metric in metrics"
        :key="metric.label"
        class="style3-stat-card"
        :class="`is-${metric.tone}`"
      >
        <span class="style3-stat-card__label">{{ metric.label }}</span>
        <strong class="style3-stat-card__value">{{ metric.value }}</strong>
        <span class="style3-stat-card__meta">{{ metric.meta }}</span>
      </article>
    </div>

    <div class="style3-podium">
      <article
        v-for="(player, index) in podiumPlayers"
        :key="player.key || player.roleId || index"
        class="style3-podium-card"
        :class="`is-rank-${index + 1}`"
      >
        <div class="style3-podium-card__rank">
          {{ index === 0 ? "🥇" : index === 1 ? "🥈" : "🥉" }}
        </div>
        <div class="style3-podium-card__player">
          <img
            v-if="player.avatar || player.headImg"
            class="style3-podium-card__avatar"
            :src="player.avatar || player.headImg"
            @error="$emit('image-error', $event)"
          >
          <div v-else class="style3-podium-card__avatar-placeholder">
            {{ getClubBattleAvatarText(player.name) }}
          </div>
          <div class="style3-podium-card__copy">
            <strong>{{ player.name }}</strong>
            <span>K/D {{ player.kd }}</span>
          </div>
        </div>
        <div class="style3-podium-card__metrics">
          <span>击杀 {{ player.killCnt || player.winCnt || 0 }}</span>
          <span>攻城 {{ player.occupyCnt || player.buildingCnt || 0 }}</span>
          <span>复活丹 {{ player.reviveCnt || 0 }}</span>
        </div>
      </article>
    </div>

    <div class="style3-roster-grid">
      <article
        v-for="player in playerRows"
        :key="player.key || player.roleId"
        class="style3-player-card"
        :class="{ 'is-top3': player.rank <= 3 }"
      >
        <div class="style3-player-card__head">
          <div class="style3-player-card__identity">
            <span class="style3-player-card__rank">#{{ player.rank }}</span>
            <img
              v-if="player.avatar || player.headImg"
              class="style3-player-card__avatar"
              :src="player.avatar || player.headImg"
              @error="$emit('image-error', $event)"
            >
            <div v-else class="style3-player-card__avatar-placeholder">
              {{ getClubBattleAvatarText(player.name) }}
            </div>
            <div class="style3-player-card__copy">
              <strong>{{ player.name }}</strong>
              <span>复活丹 {{ player.reviveCnt }}</span>
            </div>
          </div>
          <span class="style3-player-card__kd">K/D {{ player.kd }}</span>
        </div>

        <div class="style3-player-card__grid">
          <div class="style3-mini-metric">
            <span>击杀</span>
            <strong>{{ player.killCnt || player.winCnt || 0 }}</strong>
          </div>
          <div class="style3-mini-metric">
            <span>死亡</span>
            <strong>{{ player.deathCnt || player.loseCnt || 0 }}</strong>
          </div>
          <div class="style3-mini-metric">
            <span>攻城</span>
            <strong>{{ player.occupyCnt || player.buildingCnt || 0 }}</strong>
          </div>
          <div class="style3-mini-metric">
            <span>生存</span>
            <strong>{{ player.survivalCnt }}</strong>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { getClubBattleAvatarText } from "./clubBattleRecordDisplayHelpers.js";
import { buildClubBattleStyle3MvpMeta } from "./clubBattleRecordLayoutHelpers.js";

const props = defineProps({
  kicker: {
    type: String,
    default: "本周战报",
  },
  metrics: {
    type: Array,
    default: () => [],
  },
  mvp: {
    type: Object,
    default: null,
  },
  playerRows: {
    type: Array,
    default: () => [],
  },
  podiumPlayers: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: "",
  },
});

defineEmits(["image-error"]);

const mvpMeta = computed(() => buildClubBattleStyle3MvpMeta(props.mvp));
</script>

<style scoped lang="scss">
.style-3 {
  --style3-danger: #d1495b;
  --style3-warning: #d48a33;
  --style3-success: #1f7a5d;
  --style3-accent: #325c9a;
  background:
    radial-gradient(circle at top right, rgba(50, 92, 154, 0.12), transparent 24%),
    linear-gradient(180deg, #fcfaf4, #f3eee2);
  padding: 20px;
  border-radius: 18px;
  color: #1f2933;
  font-family: "Georgia", "Times New Roman", serif;
}

.style3-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 18px;
  margin-bottom: 18px;
}

.style3-hero__copy {
  padding: 22px;
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(246, 239, 223, 0.82)),
    rgba(255, 255, 255, 0.72);
  box-shadow: 0 14px 30px rgba(61, 67, 74, 0.08);
}

.style3-kicker {
  display: inline-flex;
  margin-bottom: 10px;
  color: #8a6a3a;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.24em;
  text-transform: uppercase;
}

.style3-hero__copy h2 {
  margin: 0;
  font-size: 30px;
  line-height: 1.08;
}

.style3-mvp {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 18px;
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 248, 225, 0.96), rgba(247, 235, 205, 0.86)),
    rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(201, 155, 77, 0.22);
  box-shadow: 0 14px 26px rgba(177, 133, 54, 0.12);
}

.style3-mvp__medal {
  align-self: flex-start;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(187, 140, 52, 0.12);
  color: #9b6a1f;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.style3-mvp__player {
  display: flex;
  align-items: center;
  gap: 12px;
}

.style3-mvp__avatar,
.style3-mvp__avatar-placeholder {
  width: 58px;
  height: 58px;
  border-radius: 18px;
  flex-shrink: 0;
}

.style3-mvp__avatar {
  object-fit: cover;
  border: 2px solid rgba(201, 155, 77, 0.4);
}

.style3-mvp__avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0c46e, #c9862d);
  color: #fff;
  font-size: 22px;
  font-weight: 700;
}

.style3-mvp__meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.style3-mvp__meta strong {
  font-size: 18px;
}

.style3-mvp__meta span {
  color: #6e5731;
  font-size: 13px;
  line-height: 1.5;
}

.style3-stats-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.style3-stat-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(83, 97, 110, 0.1);
  box-shadow: 0 10px 18px rgba(34, 40, 46, 0.05);
}

.style3-stat-card.is-danger {
  border-color: rgba(209, 73, 91, 0.18);
}

.style3-stat-card.is-warning {
  border-color: rgba(212, 138, 51, 0.18);
}

.style3-stat-card.is-success {
  border-color: rgba(31, 122, 93, 0.18);
}

.style3-stat-card.is-accent {
  border-color: rgba(50, 92, 154, 0.18);
}

.style3-stat-card__label {
  color: #6d7781;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.style3-stat-card__value {
  font-size: 28px;
  line-height: 1;
}

.style3-stat-card__meta {
  color: #7a838d;
  font-size: 13px;
  line-height: 1.5;
}

.style3-podium {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-bottom: 18px;
}

.style3-podium-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.76);
  border: 1px solid rgba(83, 97, 110, 0.1);
  box-shadow: 0 12px 24px rgba(34, 40, 46, 0.06);
}

.style3-podium-card.is-rank-1 {
  background:
    linear-gradient(180deg, rgba(255, 244, 211, 0.96), rgba(255, 255, 255, 0.82)),
    rgba(255, 255, 255, 0.82);
}

.style3-podium-card__rank {
  font-size: 22px;
}

.style3-podium-card__player {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.style3-podium-card__avatar,
.style3-podium-card__avatar-placeholder {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  flex-shrink: 0;
}

.style3-podium-card__avatar {
  object-fit: cover;
}

.style3-podium-card__avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(120, 132, 146, 0.16);
  color: #6d7781;
  font-size: 18px;
  font-weight: 700;
}

.style3-podium-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.style3-podium-card__copy strong {
  font-size: 16px;
}

.style3-podium-card__copy span {
  color: #707b86;
  font-size: 13px;
}

.style3-podium-card__metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  color: #5c6670;
  font-size: 12px;
}

.style3-roster-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.style3-player-card {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.78);
  border: 1px solid rgba(83, 97, 110, 0.08);
}

.style3-player-card.is-top3 {
  border-color: rgba(168, 125, 45, 0.22);
  box-shadow: inset 0 0 0 1px rgba(245, 215, 144, 0.24);
}

.style3-player-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.style3-player-card__identity {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.style3-player-card__rank {
  display: inline-flex;
  min-width: 36px;
  justify-content: center;
  padding: 5px 0;
  border-radius: 999px;
  background: rgba(50, 92, 154, 0.08);
  color: #325c9a;
  font-size: 12px;
  font-weight: 800;
}

.style3-player-card__avatar,
.style3-player-card__avatar-placeholder {
  width: 38px;
  height: 38px;
  border-radius: 12px;
  flex-shrink: 0;
}

.style3-player-card__avatar {
  object-fit: cover;
}

.style3-player-card__avatar-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(120, 132, 146, 0.16);
  color: #6d7781;
  font-size: 16px;
  font-weight: 700;
}

.style3-player-card__copy {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.style3-player-card__copy strong {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.style3-player-card__copy span,
.style3-player-card__kd {
  color: #6f7983;
  font-size: 12px;
}

.style3-player-card__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
}

.style3-mini-metric {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 10px;
  border-radius: 14px;
  background: rgba(244, 239, 227, 0.8);
}

.style3-mini-metric span {
  color: #7b858f;
  font-size: 11px;
}

.style3-mini-metric strong {
  font-size: 16px;
}

@media (max-width: 768px) {
  .style3-hero {
    grid-template-columns: 1fr;
  }

  .style3-stats-grid,
  .style3-podium,
  .style3-roster-grid {
    grid-template-columns: 1fr;
  }

  .style3-podium-card__metrics,
  .style3-player-card__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
