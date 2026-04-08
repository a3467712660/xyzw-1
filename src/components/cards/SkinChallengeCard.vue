<template>
  <MyCard
    class="skin-challenge"
    :panel-active="panelActive"
    :status-class="statusClass"
  >
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
      <span>{{ headerBadgeText }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__stack">
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

        <div class="gwb2-mini-card__resource-grid boss-grid" :class="{ disabled: !isActivityValid }">
          <div
            v-for="boss in bossCards"
            :key="boss.type"
            class="boss-card"
            :class="{
              active: boss.open,
              busy: activeChallengeType === boss.type,
              cleared: boss.cleared,
              locked: !boss.open,
            }"
          >
            <div class="boss-title">
              {{ boss.title }}
            </div>
            <div class="boss-level">
              {{ t("skinChallengeCard.level", { level: boss.level }) }}
            </div>

            <div class="boss-status">
              <span
                v-if="boss.cleared"
                class="status-text cleared"
              >
                {{ t("skinChallengeCard.status.cleared") }}
              </span>
              <span
                v-else-if="!boss.open"
                class="status-text locked"
              >
                {{ t("skinChallengeCard.status.locked") }}
              </span>
              <span v-else-if="activeChallengeType === boss.type" class="status-text busy">
                {{ t("skinChallengeCard.actions.challenge") }}
              </span>
              <span v-else class="status-text active">
                {{ t("skinChallengeCard.status.active") }}
              </span>
            </div>

            <n-button
              class="challenge-btn"
              size="small"
              type="primary"
              :disabled="!boss.canChallenge || isRefreshing || activeChallengeType !== null"
              @click="challengeSingle(boss.type)"
            >
              {{
                activeChallengeType === boss.type
                  ? t("skinChallengeCard.actions.refreshing")
                  : t("skinChallengeCard.actions.challenge")
              }}
            </n-button>
          </div>
        </div>
      </div>
    </template>
    <template #action>
      <div class="gwb2-mini-card__action-rail gwb2-mini-card__action-rail--single">
        <n-button
          :disabled="isRefreshing || activeChallengeType !== null"
          @click="refreshInfo"
        >
          {{
            isRefreshing
              ? t("skinChallengeCard.actions.refreshing")
              : t("skinChallengeCard.actions.refresh")
          }}
        </n-button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, toRef, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useGameCardPanelActive } from "@/composables/gameCards/useGameCardPanelActive";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

const props = defineProps({
  panelActive: {
    type: Boolean,
    default: true,
  },
});

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();
const { panelActive } = useGameCardPanelActive(toRef(props, "panelActive"));

const isRefreshing = ref(false);
const activeChallengeType = ref(null);
const pendingRefresh = ref(false);
const actId = ref(null);
const levelRewardMap = ref({});
const dailyFightNum = ref(0);
let infoRefreshHandle = null;

const selectedTokenId = computed(() =>
  tokenStore.selectedToken ? String(tokenStore.selectedToken.id) : "",
);

const wsStatus = computed(() => {
  if (!selectedTokenId.value) {
    return "disconnected";
  }
  return tokenStore.getWebSocketStatus(selectedTokenId.value);
});

const isActivityValid = computed(() => {
  if (!actId.value)
    return false;

  const idStr = String(actId.value);
  if (idStr.length < 6)
    return false;

  const year = `20${idStr.substring(0, 2)}`;
  const month = idStr.substring(2, 4);
  const day = idStr.substring(4, 6);

  const startDate = new Date(`${year}-${month}-${day}T00:00:00`);
  const endDate = new Date(startDate);
  endDate.setDate(startDate.getDate() + 7);

  const now = new Date();
  return now >= startDate && now < endDate;
});

const finishedCount = computed(() => Object.keys(levelRewardMap.value).length);

const statusClass = computed(() => {
  if (finishedCount.value >= 48)
    return "completed";
  return "active";
});

const headerBadgeText = computed(() => {
  if (isRefreshing.value)
    return t("skinChallengeCard.actions.refreshing");
  if (activeChallengeType.value != null) {
    return t("skinChallengeCard.bossTitle", { type: activeChallengeType.value });
  }
  return t("skinChallengeCard.todayChallenge", { count: dailyFightNum.value });
});

const todayWeekDay = new Date().getDay();
const openTowerMap = {
  5: [1],
  6: [2],
  0: [3],
  1: [4],
  2: [5],
  3: [6],
  4: [1, 2, 3, 4, 5, 6],
};

const todayOpenTowers = computed(() => openTowerMap[todayWeekDay] || []);

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

const isTowerOpen = (type) =>
  todayOpenTowers.value.includes(type)
  || (todayOpenTowers.value.includes(6) && todayWeekDay === 4);

const isTowerCleared = (type) => {
  const key1 = `${type}008`;
  const key2 = Number(key1);
  return !!(levelRewardMap.value[key1] || levelRewardMap.value[key2]);
};

const getTowerLevel = (type) => {
  for (let i = 8; i >= 1; i -= 1) {
    const key1 = `${type}00${i}`;
    const key2 = Number(key1);
    if (levelRewardMap.value[key1] || levelRewardMap.value[key2]) {
      return i === 8 ? 8 : i + 1;
    }
  }
  return 1;
};

const bossCards = computed(() =>
  Array.from({ length: 6 }, (_, index) => {
    const type = index + 1;
    const open = isTowerOpen(type);
    const cleared = isTowerCleared(type);
    return {
      canChallenge: isActivityValid.value && open && !cleared,
      cleared,
      level: getTowerLevel(type),
      open,
      title: t("skinChallengeCard.bossTitle", { type }),
      type,
    };
  }),
);

const clearInfoRefreshHandle = () => {
  if (infoRefreshHandle) {
    clearTimeout(infoRefreshHandle);
    infoRefreshHandle = null;
  }
};

const getInfo = async () => {
  if (!selectedTokenId.value || wsStatus.value !== "connected")
    return;

  try {
    const res = await tokenStore.sendMessageWithPromise(
      selectedTokenId.value,
      "towers_getinfo",
      {},
      5000,
    );
    if (res) {
      const data = res.actId
        ? res
        : res.towerData && res.towerData.actId
          ? res.towerData
          : res;

      actId.value = data.actId || null;
      levelRewardMap.value = data.levelRewardMap || {};
      dailyFightNum.value = Number(data.todayUseTickCnt || 0);
    }
  } catch {}
};

const scheduleInfoRefresh = ({ delay = 0, forceUi = false } = {}) => {
  clearInfoRefreshHandle();
  if (!selectedTokenId.value || wsStatus.value !== "connected")
    return;
  if (!panelActive.value && activeChallengeType.value == null && !isRefreshing.value && !forceUi) {
    pendingRefresh.value = true;
    return;
  }
  pendingRefresh.value = false;

  const run = async () => {
    infoRefreshHandle = null;
    await getInfo();
  };

  if (delay > 0) {
    infoRefreshHandle = setTimeout(() => {
      void run();
    }, delay);
    return;
  }

  void run();
};

const refreshInfo = async () => {
  isRefreshing.value = true;
  try {
    await getInfo();
    message.success(t("skinChallengeCard.messages.progressRefreshed"));
  } finally {
    isRefreshing.value = false;
  }
};

const challengeSingle = async (type) => {
  if (activeChallengeType.value != null || isRefreshing.value || !selectedTokenId.value)
    return;

  activeChallengeType.value = type;

  try {
    message.info(t("skinChallengeCard.messages.challengeStarted", { type }));

    let needStart = true;
    let loop = true;
    let failCount = 0;

    while (loop) {
      if (needStart) {
        await tokenStore.sendMessageWithPromise(
          selectedTokenId.value,
          "towers_start",
          { towerType: type },
          5000,
        );
      }

      const fightRes = await tokenStore.sendMessageWithPromise(
        selectedTokenId.value,
        "towers_fight",
        { towerType: type },
        5000,
      );
      const battleData = fightRes?.battleData;
      const curHP = battleData?.result?.accept?.ext?.curHP;

      if (curHP === 0) {
        const currentLevel = getTowerLevel(type);
        message.success(
          t("skinChallengeCard.messages.challengeSuccess", {
            type,
            level: currentLevel,
          }),
        );

        needStart = false;
        failCount = 0;

        await getInfo();
        if (isTowerCleared(type)) {
          loop = false;
          message.success(
            t("skinChallengeCard.messages.bossFullyCleared", { type }),
          );
        } else {
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
        needStart = true;
        failCount += 1;

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
    activeChallengeType.value = null;
    await getInfo();
  }
};

watch(
  [selectedTokenId, wsStatus],
  ([tokenId, status], [prevTokenId, prevStatus]) => {
    const tokenChanged = tokenId !== prevTokenId;
    const connectionRestored = status === "connected" && prevStatus !== "connected";

    if (tokenChanged) {
      actId.value = null;
      levelRewardMap.value = {};
      dailyFightNum.value = 0;
      pendingRefresh.value = Boolean(tokenId);
    }

    if (tokenId && status === "connected" && (tokenChanged || connectionRestored)) {
      scheduleInfoRefresh({ delay: tokenChanged ? 1000 : 0 });
    }
  },
  { immediate: true },
);

watch(
  panelActive,
  (active) => {
    if (active && pendingRefresh.value) {
      scheduleInfoRefresh({ forceUi: true });
    }
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  clearInfoRefreshHandle();
});
</script>

<style scoped lang="scss">
.header-info {
  display: flex;
  gap: var(--spacing-md);
  font-size: var(--font-size-sm);
  align-items: stretch;
}

.challenge-count {
  color: var(--text-primary);
  font-weight: 700;
}

.daily-target {
  color: var(--text-secondary);
  text-align: right;
}

.boss-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-sm);
}

.boss-card {
  border: 1px solid rgba(78, 94, 116, 0.12);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(214, 224, 234, 0.18)),
    rgba(223, 231, 239, 0.62);
  padding: 12px;
  display: flex;
  min-width: 0;
  min-height: 150px;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  text-align: center;
  transition:
    border-color var(--transition-fast),
    background var(--transition-fast),
    box-shadow var(--transition-fast),
    opacity var(--transition-fast);

  &.active {
    border-color: color-mix(in srgb, var(--primary-color) 28%, transparent);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.22),
      0 0 0 1px rgba(78, 94, 116, 0.08);
  }

  &.busy {
    border-color: color-mix(in srgb, var(--primary-color) 38%, transparent);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.2), rgba(214, 224, 234, 0.2)),
      rgba(230, 237, 244, 0.82);
  }

  &.cleared {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(207, 227, 214, 0.16)),
      rgba(224, 236, 228, 0.74);
    border-color: var(--success-color);
  }

  &.locked {
    opacity: 0.7;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(209, 219, 229, 0.12)),
      rgba(217, 225, 233, 0.5);
  }
}

.skin-challenge :deep(.gwb2-mini-card__surface) {
  height: 100%;
}

.skin-challenge :deep(.gwb2-mini-card__body) {
  display: flex;
  min-height: 0;
}

.expired-mask {
  text-align: center;
  color: var(--error-color);
  font-weight: 700;
  padding: 12px 14px;
  border: 1px dashed color-mix(in srgb, var(--error-color) 30%, transparent);
  border-radius: 14px;
  background: rgba(239, 68, 68, 0.08);
}

.boss-grid.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.boss-title {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 700;
  margin-bottom: 4px;
  overflow-wrap: anywhere;
}

.boss-level {
  font-size: var(--font-size-md);
  font-weight: 700;
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

  &.busy {
    color: var(--primary-color);
  }

  &.active {
    display: none;
  }
}

.challenge-btn {
  width: 100%;
}

@media (max-width: 959px) {
  .header-info {
    flex-direction: column;
  }

  .daily-target {
    text-align: left;
  }

  .boss-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .boss-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
