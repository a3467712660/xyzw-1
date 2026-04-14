<template>
  <div v-if="battleInfo" class="header-section">
    <div class="club-vs-container">
      <div class="club-info own">
        <NAvatar
          round
          class="club-logo"
          :size="80"
          :src="battleInfo.ownClub?.logo || '/icons/xiaoyugan.png'"
        ></NAvatar>
        <div class="club-details">
          <div class="club-name">
            {{ t("peachInfo.club.server", { serverId: battleInfo.ownClub.serverId }) }}
            {{ battleInfo.ownClub?.name || t("peachInfo.common.unknown") }}
          </div>
          <div class="club-stats">
            {{ t("peachInfo.club.id", { id: battleInfo.ownClub.id }) }}
          </div>
          <div class="club-stats">
            {{ t("peachInfo.club.memberCount", { count: battleInfo.ownClub.memberCount }) }} |
            {{ t("peachInfo.club.quenchNum", { count: battleInfo.ownClub.quenchNum }) }} |
            {{ formatPower(battleInfo.ownClub.power) }}
          </div>
          <div class="club-stats announcement">
            {{ battleInfo.ownClub.announcement }}
          </div>
        </div>
      </div>

      <div class="vs-badge">
        <span class="vs-text">VS</span>
      </div>

      <div class="club-info opponent">
        <NAvatar
          round
          class="club-logo"
          :size="80"
          :src="battleInfo.opponentClub?.logo || '/icons/xiaoyugan.png'"
        ></NAvatar>
        <div class="club-details">
          <div class="club-name">
            {{ t("peachInfo.club.server", { serverId: battleInfo.opponentClub.serverId }) }}
            {{ battleInfo.opponentClub?.name || t("peachInfo.common.unknown") }}
          </div>
          <div class="club-stats">
            {{ t("peachInfo.club.id", { id: battleInfo.opponentClub.id }) }}
          </div>
          <div class="club-stats">
            {{ t("peachInfo.club.memberCount", { count: battleInfo.opponentClub.memberCount }) }} |
            {{ t("peachInfo.club.quenchNum", { count: battleInfo.opponentClub.quenchNum }) }} |
            {{ formatPower(battleInfo.opponentClub.power) }}
          </div>
          <div class="club-stats announcement">
            {{ battleInfo.opponentClub.announcement }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { NAvatar } from "naive-ui/es";

defineProps({
  battleInfo: {
    type: Object,
    default: null,
  },
  formatPower: {
    type: Function,
    required: true,
  },
  t: {
    type: Function,
    required: true,
  },
});
</script>

<style scoped lang="scss">
.header-section {
  margin-bottom: 20px;
}

.club-vs-container {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 16px;
  align-items: center;
}

.club-info {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.05);
}

.club-details {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.club-name {
  font-weight: 700;
}

.club-stats {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.72);
  word-break: break-word;
}

.vs-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: linear-gradient(135deg, #ff9f43, #ff6b6b);
  color: #fff;
  font-weight: 700;
}

@media (max-width: 768px) {
  .club-vs-container {
    grid-template-columns: 1fr;
  }

  .vs-badge {
    margin: 0 auto;
  }
}
</style>
