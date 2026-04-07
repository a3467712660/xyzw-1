<template>
  <MyCard class="skin-challenge" :status-class="statusClass">
    <template #icon>
      <img
        src="/icons/1733492491706152.png"
        :alt="t('skinChallengeCard.alt')"
      >
    </template>
    <template #title>
      <h3>{{ t("skinChallengeCard.title") }}</h3>
      <p>{{ t("skinChallengeCard.subtitle") }}</p>
    </template>
    <template #badge>
      <!-- Badge content moved to default slot -->
    </template>
    <template #default>
      <div class="gwb2-mini-card__metric header-info">
        <span class="challenge-count">
          {{ t("skinChallengeCard.todayChallenge", { count: dailyFightNum }) }}
        </span>
        <span
          v-if="isActivityValid"
          class="daily-target"
        >
          {{ t("skinChallengeCard.todayAvailable", { info: todayInfo }) }}
        </span>
        <span v-else class="daily-target">
          {{ t("skinChallengeCard.activityEnded") }}
        </span>
      </div>

      <div v-if="!isActivityValid" class="expired-mask">
        {{ t("skinChallengeCard.currentActivityEnded") }}
      </div>
      <div class="gwb2-mini-card__list boss-grid" :class="{ disabled: !isActivityValid }">
        <div
          v-for="type in 6"
          :key="type"
          class="boss-card"
          :class="{
            active: isTowerOpen(type),
            cleared: isTowerCleared(type),
            locked: !isTowerOpen(type),
          }"
        >
          <div class="boss-title">
            {{ t("skinChallengeCard.bossTitle", { type }) }}
          </div>
          <div class="boss-level">
            {{ t("skinChallengeCard.level", { level: getTowerLevel(type) }) }}
          </div>

          <div class="boss-status">
            <span
              v-if="isTowerCleared(type)"
              class="status-text cleared"
            >
              {{ t("skinChallengeCard.status.cleared") }}
            </span>
            <span
              v-else-if="!isTowerOpen(type)"
              class="status-text locked"
            >
              {{ t("skinChallengeCard.status.locked") }}
            </span>
            <span v-else class="status-text active">
              {{ t("skinChallengeCard.status.active") }}
            </span>
          </div>

          <n-button
            class="challenge-btn"
            size="small"
            type="primary"
            :disabled="!canChallenge(type) || isFighting"
            @click="challengeSingle(type)"
          >
            {{ t("skinChallengeCard.actions.challenge") }}
          </n-button>
        </div>
      </div>

      <div class="gwb2-mini-card__actions action-row">
        <n-button
          class="action-button secondary"
          :disabled="isFighting"
          @click="refreshInfo"
        >
          {{
            isFighting
              ? t("skinChallengeCard.actions.refreshing")
              : t("skinChallengeCard.actions.refresh")
          }}
        </n-button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useTokenStore } from "@/stores/tokenStore";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const isFighting = ref(false);
const actId = ref(null);
const isActivityValid = computed(() => {
  if (!actId.value) return false;

  const idStr = String(actId.value);
  if (idStr.length < 6) return false;

  // Format: YYMMDDX -> 20YY-MM-DD
  const year = `20${idStr.substring(0, 2)}`;
  const month = idStr.substring(2, 4);
  const day = idStr.substring(4, 6);

  const startDate = new Date(`${year}-${month}-${day}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 7);

  const now = new Date();
  return now >= startDate && now < endDate;
});

const levelRewardMap = ref({});
const dailyFightNum = ref(0); // Mock or real data
const finishedCount = computed(() => Object.keys(levelRewardMap.value).length);

const statusClass = computed(() => {
  if (finishedCount.value >= 48) return "completed";
  return "active";
});

// Calculate today's open boss
const todayWeekDay = new Date().getDay(); // 0-6 (Sun-Sat)
const openTowerMap = {
  5: [1], // Friday
  6: [2], // Saturday
  0: [3], // Sunday
  1: [4], // Monday
  2: [5], // Tuesday
  3: [6], // Wednesday
  4: [1, 2, 3, 4, 5, 6], // Thursday (All open)
};

const todayOpenTowers = computed(() => {
  return openTowerMap[todayWeekDay] || [];
});

const todayInfo = computed(() => {
  const weekDays = [
    t("skinChallengeCard.weekdays.sunday"),
    t("skinChallengeCard.weekdays.monday"),
    t("skinChallengeCard.weekdays.tuesday"),
    t("skinChallengeCard.weekdays.wednesday"),
    t("skinChallengeCard.weekdays.thursday"),
    t("skinChallengeCard.weekdays.friday"),
    t("skinChallengeCard.weekdays.saturday"),
  ];
  const dayName = weekDays[todayWeekDay];
  const towers = todayOpenTowers.value;
  if (towers.length === 6) {
    return t("skinChallengeCard.schedule.allOpen", { day: dayName });
  }
  if (towers.length > 0) {
    return t("skinChallengeCard.schedule.bossesOpen", {
      day: dayName,
      bosses: towers.join(","),
    });
  }
  return t("skinChallengeCard.schedule.noActivity", { day: dayName });
});

const isTowerOpen = (type) => {
  return (
    todayOpenTowers.value.includes(type) ||
    (todayOpenTowers.value.includes(6) && todayWeekDay === 4)
  ); // Special case for Thursday if map is correct
};

const isTowerCleared = (type) => {
  const key1 = `${type}008`;
  const key2 = Number(key1);
  return !!(levelRewardMap.value[key1] || levelRewardMap.value[key2]);
};

const getTowerLevel = (type) => {
  // Find highest cleared level
  for (let i = 8; i >= 1; i--) {
    const key1 = `${type}00${i}`;
    const key2 = Number(key1);
    if (levelRewardMap.value[key1] || levelRewardMap.value[key2]) {
      // If 8 is cleared, return 8
      if (i === 8) return 8;
      // Else return next level
      return i + 1;
    }
  }
  return 1;
};

const canChallenge = (type) => {
  return isActivityValid.value && isTowerOpen(type) && !isTowerCleared(type);
};

const getInfo = async () => {
  if (!tokenStore.selectedToken) return;
  const tokenId = tokenStore.selectedToken.id;
  if (tokenStore.getWebSocketStatus(tokenId) !== "connected") return;

  try {
    const res = await tokenStore.sendMessageWithPromise(
      tokenId,
      "towers_getinfo",
      {},
      5000,
    );
    if (res) {
      // Handle nested data structure if necessary
      const data = res.actId
        ? res
        : res.towerData && res.towerData.actId
          ? res.towerData
          : res;

      actId.value = data.actId;
      levelRewardMap.value = data.levelRewardMap || {};

      console.log("SkinChallenge Info:", {
        actId: data.actId,
        mapSize: Object.keys(levelRewardMap.value).length,
        keys: Object.keys(levelRewardMap.value).slice(0, 10),
        map: levelRewardMap.value,
        rawRes: res,
      });

      // Try to find daily num if exists in response
      if (data.todayUseTickCnt !== undefined) {
        dailyFightNum.value = data.todayUseTickCnt;
      }
    }
  } catch {
    // console.error(e);
  }
};

const refreshInfo = async () => {
  isFighting.value = true;
  await getInfo();
  message.success(t("skinChallengeCard.messages.progressRefreshed"));
  isFighting.value = false;
};

const challengeSingle = async (type) => {
  if (isFighting.value) return;

  isFighting.value = true;
  const tokenId = tokenStore.selectedToken.id;

  try {
    message.info(t("skinChallengeCard.messages.challengeStarted", { type }));

    let needStart = true;
    let loop = true;
    let failCount = 0;

    while (loop) {
      if (needStart) {
        await tokenStore.sendMessageWithPromise(
          tokenId,
          "towers_start",
          { towerType: type },
          5000,
        );
      }

      const fightRes = await tokenStore.sendMessageWithPromise(
        tokenId,
        "towers_fight",
        { towerType: type },
        5000,
      );
      const battleData = fightRes?.battleData;
      const curHP = battleData?.result?.accept?.ext?.curHP;

      if (curHP === 0) {
        // Get current level before updating info (it will be the level just cleared)
        const currentLevel = getTowerLevel(type);
        message.success(
          t("skinChallengeCard.messages.challengeSuccess", {
            type,
            level: currentLevel,
          }),
        );

        // 挑战成功，不需要重新 start，直接继续 fight
        needStart = false;
        failCount = 0;

        // 检查是否通关（需要更新 levelRewardMap）
        await getInfo();
        if (isTowerCleared(type)) {
          loop = false;
          message.success(
            t("skinChallengeCard.messages.bossFullyCleared", { type }),
          );
        } else {
          // 等待一下避免过快请求
          await new Promise((r) => setTimeout(r, 1000));
        }
      } else {
        const currentLevel = getTowerLevel(type);
        message.warning(
          t("skinChallengeCard.messages.challengeFailed", {
            type,
            level: currentLevel,
          }),
        );
        // 挑战失败，需要重新 start
        needStart = true;
        failCount++;

        if (failCount >= 3) {
          message.error(
            t("skinChallengeCard.messages.challengeStoppedAfterFailures", {
              type,
              level: currentLevel,
            }),
          );
          loop = false;
        } else {
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    }
  } catch (e) {
    message.error(
      t("skinChallengeCard.messages.challengeError", { message: e.message }),
    );
  } finally {
    isFighting.value = false;
    await getInfo();
  }
};

watch(
  () => tokenStore.selectedToken,
  (newVal) => {
    if (newVal) {
      setTimeout(getInfo, 1000);
    }
  },
  { immediate: true },
);

watch(
  () => tokenStore.getWebSocketStatus(tokenStore.selectedToken?.id),
  (status) => {
    if (status === "connected") {
      getInfo();
    }
  },
);
</script>

<style scoped lang="scss">
.header-info {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  align-items: center;
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-color);
}

.challenge-count {
  font-weight: bold;
  color: var(--primary-color);
}

.daily-target {
  color: var(--text-secondary);
}

.boss-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.boss-card {
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-sm);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  border: 1px solid transparent;
  transition: all var(--transition-fast);

  &.active {
    background: #fff;
    border-color: var(--primary-color);
    box-shadow: var(--shadow-sm);
  }

  &.cleared {
    background: rgba(34, 197, 94, 0.05);
    border-color: var(--success-color);
  }

  &.locked {
    opacity: 0.7;
    background: var(--bg-tertiary);
  }
}

.expired-mask {
  text-align: center;
  color: var(--error-color);
  font-weight: bold;
  padding: var(--spacing-sm);
  background: rgba(239, 68, 68, 0.1);
  border-radius: var(--border-radius-medium);
  margin-bottom: var(--spacing-md);
}

.boss-grid.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.boss-title {
  font-weight: bold;
  color: var(--primary-color);
  font-size: var(--font-size-md);
  margin-bottom: 4px;
}

.boss-level {
  font-size: var(--font-size-lg);
  font-weight: bold;
  margin-bottom: 8px;
}

.boss-status {
  margin-bottom: 8px;
}

.status-text {
  font-size: var(--font-size-sm);
  font-weight: bold;

  &.cleared {
    color: var(--success-color);
  }

  &.locked {
    color: var(--text-tertiary);
  }

  &.active {
    display: none; // Hide "进行中" text if button is there, or show it?
  }
}

.challenge-btn {
  width: 100%;
}

.action-row {
  margin-top: auto;
  display: flex;
  justify-content: flex-start;
}

.action-button {
  width: 100%;
}

@media (max-width: 640px) {
  .boss-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
