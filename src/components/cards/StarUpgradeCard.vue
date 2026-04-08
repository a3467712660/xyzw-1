<template>
  <MyCard class="star-upgrade" :status-class="{ active: state.isRunning }">
    <template #icon>
      <img src="/icons/ta.png" :alt="t('starUpgradeCard.iconAlt')">
    </template>
    <template #title>
      <h3>{{ t("starUpgradeCard.title") }}</h3>
      <p>{{ t("starUpgradeCard.subtitle") }}</p>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? t("starUpgradeCard.status.running") : t("starUpgradeCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__toolbar settings">
        <div class="setting-item">
          <span class="label">{{ t("starUpgradeCard.labels.delay") }}</span>
          <n-input-number
            size="small"
            v-model:value="delay"
            :min="0"
            :step="100"
          ></n-input-number>
        </div>
        <div class="gwb2-mini-card__chip status-row">
          <span class="gwb2-mini-card__chip-dot"></span>
          <span>{{ t("starUpgradeCard.labels.heroCount", { count: heroIds.length }) }}</span>
        </div>
      </div>
      <div class="gwb2-mini-card__metric progress-row">
        <div class="progress-copy">
          <span class="progress-label">{{ t("starUpgradeCard.subtitle") }}</span>
          <span class="progress-text">{{ state.done }}/{{ state.total }} {{ percent }}%</span>
        </div>
        <n-progress type="line" :percentage="percent" :show-indicator="false"></n-progress>
      </div>
    </template>
    <template #action>
      <n-button
        size="small"
        type="primary"
        :disabled="state.isRunning"
        @click="startHeroUpgrade"
      >
        {{ t("starUpgradeCard.actions.heroUpgrade") }}
      </n-button>
      <n-button
        size="small"
        type="primary"
        :disabled="state.isRunning"
        @click="startBookUpgrade"
      >
        {{ t("starUpgradeCard.actions.bookUpgrade") }}
      </n-button>
      <n-button
        size="small"
        type="primary"
        :disabled="state.isRunning"
        @click="startClaimRewards"
      >
        {{ t("starUpgradeCard.actions.claimRewards") }}
      </n-button>
      <n-button
        size="small"
        :disabled="!state.isRunning"
        @click="stopRunning"
      >
        {{ t("starUpgradeCard.actions.stop") }}
      </n-button>
    </template>
  </MyCard>
  <n-modal
    class="star-upgrade__modal"
    preset="dialog"
    v-model:show="state.showConfirm"
    :content="t('starUpgradeCard.confirm.content')"
    :negative-text="t('starUpgradeCard.confirm.cancel')"
    :positive-text="t('starUpgradeCard.confirm.confirm')"
    :title="t('starUpgradeCard.confirm.title')"
  ></n-modal>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";
import { HERO_DICT } from "@/utils/HeroList";

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const delay = ref(900);
const logs = ref([]);
const state = ref({
  isRunning: false,
  showConfirm: false,
  progressText: "idle",
  stopRequested: false,
  total: 0,
  done: 0,
});

const heroIds = computed(() => Object.keys(HERO_DICT).map(Number));

const percent = computed(() =>
  state.value.total > 0
    ? Math.min(100, Math.round((state.value.done / state.value.total) * 100))
    : 0,
);

const addLog = (messageText, type = "info") => {
  logs.value.push({
    id: Date.now() + Math.random(),
    timestamp: Date.now(),
    type,
    message: messageText,
  });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isRateLimitError = (error) => {
  const text = String(error?.message || error || "");
  return text.includes("200400") || text.includes(t("starUpgradeCard.errors.tooFast"));
};
const sendWithRetryOnRateLimit = async (
  tokenId,
  cmd,
  body,
  timeout,
  baseDelay = 900,
) => {
  const maxRetry = 2;
  for (let attempt = 0; attempt <= maxRetry; attempt++) {
    try {
      return await tokenStore.sendMessageWithPromise(tokenId, cmd, body, timeout);
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetry) {
        throw error;
      }
      const waitMs = Math.max(baseDelay, 800) + attempt * 500;
      addLog(
        t("starUpgradeCard.logs.retryWait", {
          seconds: Math.ceil(waitMs / 1000),
        }),
        "warning",
      );
      await sleep(waitMs);
    }
  }
  throw new Error(t("starUpgradeCard.errors.requestFailed"));
};

/** 启动仅英雄升星 */
const startHeroUpgrade = async () => {
  state.value.stopRequested = false;
  state.value.total = heroIds.value.length;
  state.value.done = 0;
  await runHeroUpgrade({ delay: delay.value });
};

/** 启动仅图鉴升星 */
const startBookUpgrade = async () => {
  state.value.stopRequested = false;
  state.value.total = heroIds.value.length;
  state.value.done = 0;
  await runBookUpgrade({ delay: delay.value });
};

/** 启动仅领取奖励 */
const startClaimRewards = async () => {
  state.value.stopRequested = false;
  state.value.total = 10;
  state.value.done = 0;
  await runClaimRewards({ delay: delay.value });
};

const stopRunning = () => {
  state.value.stopRequested = true;
};

/**
 * 执行升星、图鉴升星与奖励领取的组合任务
 * @param {{ delay: number }} mod 延迟设置（毫秒）
 * @returns {Promise<void>}
 */
const executeUpgradeStarTask = async (mod) => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning(t("starUpgradeCard.messages.selectTokenFirst"));
    return;
  }
  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error(t("starUpgradeCard.messages.wsDisconnectedExecute"));
    addLog(t("starUpgradeCard.logs.wsMissing"), "error");
    return;
  }

  try {
    state.value.isRunning = true;
    state.value.progressText = "hero";
    message.success(t("starUpgradeCard.messages.startHero"));
    addLog(t("starUpgradeCard.logs.taskStarted"), "success");

    await runHeroUpgrade(mod);

    state.value.progressText = "book";
    message.success(t("starUpgradeCard.messages.heroDoneBookStart"));
    addLog(t("starUpgradeCard.logs.heroDone"), "success");

    await runBookUpgrade(mod);

    state.value.progressText = "claim";
    message.success(t("starUpgradeCard.messages.bookDoneClaimStart"));
    addLog(t("starUpgradeCard.logs.bookDone"), "success");

    await runClaimRewards(mod);

    state.value.progressText = "done";
    message.success(t("starUpgradeCard.messages.allDone"));
    addLog(t("starUpgradeCard.logs.allDone"), "success");
  } catch (error) {
    addLog(
      t("starUpgradeCard.logs.executeError", {
        error: error.message,
      }),
      "error",
    );
    message.error(t("starUpgradeCard.messages.executeError"));
  } finally {
    state.value.isRunning = false;
  }
};

/**
 * 仅执行英雄升星
 * @param {{ delay: number }} mod
 */
const runHeroUpgrade = async (mod) => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning(t("starUpgradeCard.messages.selectTokenFirst"));
    return;
  }
  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error(t("starUpgradeCard.messages.wsDisconnected"));
    return;
  }
  try {
    state.value.isRunning = true;
    for (const heroId of heroIds.value) {
      if (state.value.stopRequested)
        break;
      let skip = false;
      for (let i = 1; i <= 10; i++) {
        if (state.value.stopRequested) {
          skip = true;
          break;
        }
        try {
          const res = await sendWithRetryOnRateLimit(
            tokenId,
            "hero_heroupgradestar",
            { heroId },
            8000,
            mod.delay,
          );
          const ok
            = res && (res.code === 0 || res.success === true || res.result === 0);
          addLog(
            t("starUpgradeCard.logs.heroAttempt", {
              heroId,
              current: i,
            }),
            ok ? "success" : "error",
          );
          if (!ok)
            throw new Error(t("starUpgradeCard.errors.heroUpgradeFailed"));
        } catch (err) {
          addLog(
            t("starUpgradeCard.logs.heroAttemptFailed", {
              heroId,
              current: i,
            }),
            "error",
          );
          skip = true;
        }
        await sleep(mod.delay);
        if (skip)
          break;
      }
      state.value.done++;
    }
    message.success(
      state.value.stopRequested
        ? t("starUpgradeCard.messages.stopped")
        : t("starUpgradeCard.messages.heroDone"),
    );
  } finally {
    state.value.isRunning = false;
  }
};

/**
 * 仅执行图鉴升星
 * @param {{ delay: number }} mod
 */
const runBookUpgrade = async (mod) => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning(t("starUpgradeCard.messages.selectTokenFirst"));
    return;
  }
  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error(t("starUpgradeCard.messages.wsDisconnected"));
    return;
  }
  try {
    state.value.isRunning = true;
    for (const heroId of heroIds.value) {
      if (state.value.stopRequested)
        break;
      let skip = false;
      for (let i = 1; i <= 10; i++) {
        if (state.value.stopRequested) {
          skip = true;
          break;
        }
        try {
          const res = await sendWithRetryOnRateLimit(
            tokenId,
            "book_upgrade",
            { heroId },
            8000,
            mod.delay,
          );
          const ok
            = res && (res.code === 0 || res.success === true || res.result === 0);
          addLog(
            t("starUpgradeCard.logs.bookAttempt", {
              heroId,
              current: i,
            }),
            ok ? "success" : "error",
          );
          if (!ok)
            throw new Error(t("starUpgradeCard.errors.bookUpgradeFailed"));
        } catch (err) {
          addLog(
            t("starUpgradeCard.logs.bookAttemptFailed", {
              heroId,
              current: i,
            }),
            "error",
          );
          skip = true;
        }
        await sleep(mod.delay);
        if (skip)
          break;
      }
      state.value.done++;
    }
    message.success(
      state.value.stopRequested
        ? t("starUpgradeCard.messages.stopped")
        : t("starUpgradeCard.messages.bookDone"),
    );
  } finally {
    state.value.isRunning = false;
  }
};

/**
 * 仅执行领取奖励
 * @param {{ delay: number }} mod
 */
const runClaimRewards = async (mod) => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning(t("starUpgradeCard.messages.selectTokenFirst"));
    return;
  }
  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error(t("starUpgradeCard.messages.wsDisconnected"));
    return;
  }
  try {
    state.value.isRunning = true;
    for (let i = 1; i <= 10; i++) {
      if (state.value.stopRequested)
        break;
      let success = true;
      try {
        const res = await sendWithRetryOnRateLimit(
          tokenId,
          "book_claimpointreward",
          {},
          8000,
          mod.delay,
        );
        const ok
          = res && (res.code === 0 || res.success === true || res.result === 0);
        addLog(
          t("starUpgradeCard.logs.claimAttempt", {
            current: i,
          }),
          ok ? "success" : "error",
        );
        if (!ok)
          throw new Error(t("starUpgradeCard.errors.claimFailed"));
        state.value.done++;
      } catch (err) {
        addLog(
          t("starUpgradeCard.logs.claimAttemptFailed", {
            current: i,
          }),
          "error",
        );
        state.value.done++;
        success = false;
      }
      await sleep(mod.delay);
      if (!success)
        break;
    }
    message.success(
      state.value.stopRequested
        ? t("starUpgradeCard.messages.stopped")
        : t("starUpgradeCard.messages.claimDone"),
    );
  } finally {
    state.value.isRunning = false;
  }
};

const formatTime = (ts) => new Date(ts).toLocaleTimeString("zh-CN");
</script>

<style scoped lang="scss">
.settings {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}
.setting-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}
.setting-item .n-input-number {
  width: 110px;
}
.status-row {
  flex: 0 0 auto;
}
.progress-row {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: var(--spacing-sm);
}
.progress-copy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}
.progress-label {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.progress-text {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-mono);
  font-weight: 700;
  white-space: nowrap;
}
.log-container {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.log-item {
  display: flex;
  gap: 8px;
}
.log-item.success {
  color: var(--success-color);
}
.log-item.error {
  color: var(--error-color);
}
.time {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}
.msg {
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .progress-copy {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
