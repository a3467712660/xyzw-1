<template>
  <MyCard class="star-upgrade" :status-class="{ active: state.isRunning }">
    <template #icon>
      <img src="/icons/legionCup.png" :alt="t('heroUpgradeCard.iconAlt')">
    </template>
    <template #title>
      <h3>{{ t("heroUpgradeCard.title") }}</h3>
      <p>{{ t("heroUpgradeCard.subtitle") }}</p>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? t("heroUpgradeCard.status.running") : t("heroUpgradeCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__toolbar settings">
        <span class="label">{{ t("heroUpgradeCard.labels.heroSelect") }}</span>
        <n-select
          v-model:value="HeroValue"
          :options="HeroOptions"
          @update:value="handleUpdateValue"
        ></n-select>
      </div>
      <div v-if="HeroItem != null" class="gwb2-mini-card__metric hero-summary">
        <div class="hero-item">
          <img :alt="HeroItem.name" :src="HeroItem.avatar">
          <div class="hero-meta">
            <strong>{{ HeroItem.name }}</strong>
            <span>{{ t("heroUpgradeCard.subtitle") }}</span>
          </div>
        </div>
        <div class="hero-property">
          <div class="current-property">
            <div>{{ t("heroUpgradeCard.labels.attack", { value: HeroItem.attack }) }}</div>
            <div>{{ t("heroUpgradeCard.labels.speed", { value: HeroItem.speed }) }}</div>
          </div>
        </div>
      </div>
      <div v-if="HeroItem != null" class="gwb2-mini-card__toolbar upgrade-settings">
        <span class="label">{{ t("heroUpgradeCard.labels.levelUpgrade") }}</span>
        <n-select
          v-model:value="levelNum"
          :options="levelOptions"
        ></n-select>
      </div>
      <div v-else class="gwb2-mini-card__empty hero-empty">
        {{ t("heroUpgradeCard.labels.heroSelect") }}
      </div>
    </template>
    <template #action>
      <n-button
        v-if="HeroItem != null"
        size="small"
        type="primary"
        :disabled="state.isRunning"
        @click="levelHeroUpgrade"
      >
        {{ t("heroUpgradeCard.actions.levelUpgrade") }}
      </n-button>
      <n-button
        v-if="HeroItem != null"
        size="small"
        type="primary"
        :disabled="
          state.isRunning
            || judgeLevelupgrade(HeroItem.level, 1, HeroItem.order) == false
        "
        @click="orderHeroUpgrade"
      >
        {{ t("heroUpgradeCard.actions.orderUpgrade") }}
      </n-button>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";
import { HERO_DICT } from "@/utils/HeroList";

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const HeroOptions = computed(() => [
  ...Object.values(tokenStore.gameData.roleInfo.role.heroes).map((item) => {
    return {
      label: `${HERO_DICT[item.heroId].name}(${item.level}/6000)`,
      value: item.heroId,
      disabled: item.level == 6000,
    };
  }),
]);

const HeroValue = ref(null);
const HeroItem = ref(null);
const levelNum = ref(1);
const lastActionAt = ref(0);
const state = ref({
  isRunning: false,
  showConfirm: false,
  progressText: "idle",
  stopRequested: false,
  total: 0,
  done: 0,
});

const MIN_ACTION_INTERVAL_MS = 1200;
const RATE_LIMIT_RETRY_DELAY_MS = 1800;
const MAX_RATE_LIMIT_RETRY = 2;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isRateLimitError = (error) => {
  const text = String(error?.message || error || "");
  return text.includes("200400") || text.includes(t("heroUpgradeCard.errors.tooFast"));
};
const waitForActionWindow = async () => {
  const elapsed = Date.now() - lastActionAt.value;
  if (elapsed < MIN_ACTION_INTERVAL_MS) {
    await sleep(MIN_ACTION_INTERVAL_MS - elapsed);
  }
};
const sendUpgradeCommand = async (tokenId, cmd, body, timeout = 5000) => {
  let attempt = 0;
  while (attempt <= MAX_RATE_LIMIT_RETRY) {
    try {
      await waitForActionWindow();
      const res = await tokenStore.sendMessageWithPromise(
        tokenId,
        cmd,
        body,
        timeout,
      );
      lastActionAt.value = Date.now();
      return res;
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= MAX_RATE_LIMIT_RETRY) {
        throw error;
      }
      const waitMs = RATE_LIMIT_RETRY_DELAY_MS + attempt * 400;
      message.warning(
        t("heroUpgradeCard.messages.retrying", {
          seconds: Math.ceil(waitMs / 1000),
        }),
      );
      await sleep(waitMs);
      attempt += 1;
    }
  }
  throw new Error(t("heroUpgradeCard.errors.requestFailed"));
};

const handleUpdateValue = (value) => {
  HeroItem.value = Object.assign(
    {},
    tokenStore.gameData.roleInfo.role.heroes[value],
    HERO_DICT[value],
  );
};

const levelOptions = [
  {
    label: "1",
    value: 1,
  },
  {
    label: "5",
    value: 5,
  },
  {
    label: "10",
    value: 10,
  },
  {
    label: "50",
    value: 50,
  },
];

watch(
  () => tokenStore.gameData.roleInfo.heroes,
  () => {
    if (HeroValue.value) {
      if (
        tokenStore.gameData.roleInfo.role.heroes[HeroValue.value].level != 6000
      ) {
        HeroItem.value = Object.assign(
          {},
          tokenStore.gameData.roleInfo.role.heroes[HeroValue.value],
          HERO_DICT[HeroValue.value],
        );
      } else {
        HeroItem.value = null;
      }
    }
  },
  { deep: true }, // 深度监听内部变化
);

// 英雄进阶
const orderHeroUpgrade = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("heroUpgradeCard.messages.selectRoleFirst"));
    return;
  }

  const tokenId = tokenStore.selectedToken.id;

  // 检查WebSocket连接
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error(t("heroUpgradeCard.messages.wsDisconnected"));
    return;
  }
  state.value.isRunning = true;

  try {
    const judgement = judgeLevelupgrade(
      HeroItem.value.level,
      levelNum.value,
      HeroItem.value.order,
    );
    if (judgement == HeroItem.value.level) {
      const result = await sendUpgradeCommand(
        tokenId,
        "hero_heroupgradeorder",
        {
          heroId: HeroValue.value,
        },
        5000,
      );
      if (result?.role.heroes) {
        message.success(t("heroUpgradeCard.messages.orderSuccess"));
        tokenStore.sendGetRoleInfo(tokenId);
      }
    } else {
      message.warning(t("heroUpgradeCard.messages.orderFailed"));
    }
  } catch (error) {
    message.error(t("heroUpgradeCard.messages.orderFailedWithReason", { error: error.message }));
    tokenStore.sendGetRoleInfo(tokenId);
  } finally {
    state.value.isRunning = false;
  }
};

// 英雄升级
const levelHeroUpgrade = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("heroUpgradeCard.messages.selectRoleFirst"));
    return;
  }

  const tokenId = tokenStore.selectedToken.id;

  // 检查WebSocket连接
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error(t("heroUpgradeCard.messages.wsDisconnected"));
    return;
  }
  state.value.isRunning = true;

  try {
    const judgement = judgeLevelupgrade(
      HeroItem.value.level,
      levelNum.value,
      HeroItem.value.order,
    );
    if (judgement == false) {
      const result = await sendUpgradeCommand(
        tokenId,
        "hero_heroupgradelevel",
        {
          heroId: HeroValue.value,
          upgradeNum: levelNum.value,
        },
        5000,
      );
      if (result?.role.heroes) {
        tokenStore.sendGetRoleInfo(tokenId);
      }
    } else {
      message.warning(
        t("heroUpgradeCard.messages.manualUpgradeRequired", {
          level: judgement,
        }),
      );
    }
  } catch (error) {
    message.error(t("heroUpgradeCard.messages.levelFailedWithReason", { error: error.message }));
    tokenStore.sendGetRoleInfo(tokenId);
  } finally {
    state.value.isRunning = false;
  }
};

/**
 * 判断是否需要进阶
 * @param {*} level
 */
const levelArr = [
  { level: 100, order: 1 },
  { level: 200, order: 2 },
  { level: 300, order: 3 },
  { level: 500, order: 4 },
  { level: 700, order: 5 },
  { level: 900, order: 6 },
  { level: 1100, order: 7 },
  { level: 1300, order: 8 },
  { level: 1500, order: 9 },
  { level: 1800, order: 10 },
  { level: 2100, order: 11 },
  { level: 2400, order: 12 },
  { level: 2800, order: 13 },
  { level: 3200, order: 14 },
  { level: 3600, order: 15 },
  { level: 4000, order: 16 },
  { level: 4500, order: 17 },
  { level: 5000, order: 18 },
  { level: 5500, order: 19 },
]; // 需要进阶的等级
const judgeLevelupgrade = (level, levelNum, order) => {
  for (const item of levelArr) {
    console.log(
      level,
      levelNum,
      order,
      order != item.order,
      level <= item.level,
      item.level < level + levelNum,
    );
    if (
      order != item.order
      && level <= item.level
      && item.level < level + levelNum
    ) {
      return item.level;
    } else {
      continue;
    }
  }
  return false;
};
</script>

<style scoped lang="scss">
.settings {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  gap: var(--spacing-sm);

  .label {
    flex-shrink: 0;
  }
}

.hero-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  min-width: 0;
}

.hero-item > img {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  border-radius: 12px;
  border: 1px solid rgba(78, 94, 116, 0.14);
}

.hero-meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.hero-meta strong {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: 700;
}

.hero-meta span {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.hero-summary {
  align-items: stretch;
}

.hero-property {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  justify-content: flex-end;
}

.current-property {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.upgrade-settings {
  justify-content: flex-start;
  gap: var(--spacing-sm);
}

.hero-empty {
  min-height: 96px;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

@media (max-width: 768px) {
  .hero-summary {
    flex-direction: column;
  }

  .hero-property {
    justify-content: flex-start;
  }
}
</style>
