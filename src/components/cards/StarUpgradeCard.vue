<template>
  <MyCard
    class="star-upgrade-card"
    :panel-active="panelActive"
    :status-class="{ active: state.isRunning }"
  >
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
      <div class="gwb2-mini-card__stack">
        <div class="gwb2-mini-card__control-grid settings">
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

        <div class="gwb2-mini-card__metric-grid star-upgrade-card__metrics">
          <div class="gwb2-mini-card__metric progress-row">
            <div class="progress-copy">
              <span class="progress-label">{{ t("starUpgradeCard.subtitle") }}</span>
              <span class="progress-text">{{ state.done }}/{{ state.total }} {{ percent }}%</span>
            </div>
            <n-progress type="line" :percentage="percent" :show-indicator="false"></n-progress>
          </div>
          <div class="gwb2-mini-card__metric runtime-card">
            <span class="runtime-label">当前阶段</span>
            <strong class="runtime-value">{{ progressPhaseText }}</strong>
          </div>
          <div class="gwb2-mini-card__metric runtime-card">
            <span class="runtime-label">最近结果</span>
            <strong class="runtime-value">{{ state.recentResult }}</strong>
          </div>
          <div class="gwb2-mini-card__metric runtime-card">
            <span class="runtime-label">重试等待</span>
            <strong class="runtime-value">{{ retryWaitText }}</strong>
          </div>
        </div>
      </div>
    </template>
    <template #action>
      <div class="gwb2-mini-card__action-rail star-upgrade-card__actions">
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
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";
import { HERO_DICT } from "@/utils/HeroList";

defineProps({
  panelActive: {
    type: Boolean,
    default: true,
  },
});

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const delay = ref(900);
const state = ref({
  done: 0,
  isRunning: false,
  progressText: "idle",
  recentResult: "待命",
  stopRequested: false,
  total: 0,
  waitSeconds: 0,
});

const heroIds = computed(() => Object.keys(HERO_DICT).map(Number));

const percent = computed(() =>
  state.value.total > 0
    ? Math.min(100, Math.round((state.value.done / state.value.total) * 100))
    : 0,
);

const progressPhaseText = computed(() => {
  switch (state.value.progressText) {
    case "hero":
      return "英雄升星中";
    case "book":
      return "图鉴升星中";
    case "claim":
      return "奖励领取中";
    case "retry":
      return "等待重试";
    case "done":
      return "已完成";
    case "stopped":
      return "已停止";
    case "error":
      return "执行失败";
    default:
      return "待命";
  }
});

const retryWaitText = computed(() =>
  state.value.waitSeconds > 0 ? `${state.value.waitSeconds}s` : "无",
);

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
  for (let attempt = 0; attempt <= maxRetry; attempt += 1) {
    try {
      return await tokenStore.sendMessageWithPromise(tokenId, cmd, body, timeout);
    } catch (error) {
      if (!isRateLimitError(error) || attempt >= maxRetry) {
        throw error;
      }
      const waitMs = Math.max(baseDelay, 800) + attempt * 500;
      state.value.progressText = "retry";
      state.value.waitSeconds = Math.ceil(waitMs / 1000);
      state.value.recentResult = `等待重试 ${state.value.waitSeconds}s`;
      await sleep(waitMs);
      state.value.waitSeconds = 0;
    }
  }
  throw new Error(t("starUpgradeCard.errors.requestFailed"));
};

const startHeroUpgrade = async () => {
  state.value.stopRequested = false;
  state.value.total = heroIds.value.length;
  state.value.done = 0;
  state.value.progressText = "hero";
  state.value.recentResult = "开始执行英雄升星";
  await runHeroUpgrade({ delay: delay.value });
};

const startBookUpgrade = async () => {
  state.value.stopRequested = false;
  state.value.total = heroIds.value.length;
  state.value.done = 0;
  state.value.progressText = "book";
  state.value.recentResult = "开始执行图鉴升星";
  await runBookUpgrade({ delay: delay.value });
};

const startClaimRewards = async () => {
  state.value.stopRequested = false;
  state.value.total = 10;
  state.value.done = 0;
  state.value.progressText = "claim";
  state.value.recentResult = "开始领取奖励";
  await runClaimRewards({ delay: delay.value });
};

const stopRunning = () => {
  state.value.stopRequested = true;
  state.value.progressText = "stopped";
  state.value.recentResult = "等待当前步骤停止";
};

const ensureReadyToken = () => {
  const token = tokenStore.selectedToken;
  if (!token) {
    state.value.progressText = "error";
    state.value.recentResult = t("starUpgradeCard.messages.selectTokenFirst");
    message.warning(t("starUpgradeCard.messages.selectTokenFirst"));
    return null;
  }
  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    state.value.progressText = "error";
    state.value.recentResult = t("starUpgradeCard.messages.wsDisconnected");
    message.error(t("starUpgradeCard.messages.wsDisconnected"));
    return null;
  }
  return tokenId;
};

const runHeroUpgrade = async (mod) => {
  const tokenId = ensureReadyToken();
  if (!tokenId)
    return;
  try {
    state.value.isRunning = true;
    state.value.progressText = "hero";
    for (const [index, heroId] of heroIds.value.entries()) {
      if (state.value.stopRequested)
        break;
      state.value.recentResult = `英雄 ${heroId} 处理中 (${index + 1}/${heroIds.value.length})`;
      let skip = false;
      for (let i = 1; i <= 10; i += 1) {
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
          const ok = res && (res.code === 0 || res.success === true || res.result === 0);
          if (!ok)
            throw new Error(t("starUpgradeCard.errors.heroUpgradeFailed"));
        } catch {
          state.value.recentResult = `英雄 ${heroId} 升星失败`;
          skip = true;
        }
        await sleep(mod.delay);
        if (skip)
          break;
      }
      state.value.done += 1;
    }
    state.value.progressText = state.value.stopRequested ? "stopped" : "done";
    state.value.recentResult = state.value.stopRequested
      ? t("starUpgradeCard.messages.stopped")
      : t("starUpgradeCard.messages.heroDone");
    message.success(state.value.recentResult);
  } finally {
    state.value.isRunning = false;
    state.value.waitSeconds = 0;
  }
};

const runBookUpgrade = async (mod) => {
  const tokenId = ensureReadyToken();
  if (!tokenId)
    return;
  try {
    state.value.isRunning = true;
    state.value.progressText = "book";
    for (const [index, heroId] of heroIds.value.entries()) {
      if (state.value.stopRequested)
        break;
      state.value.recentResult = `图鉴 ${heroId} 处理中 (${index + 1}/${heroIds.value.length})`;
      let skip = false;
      for (let i = 1; i <= 10; i += 1) {
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
          const ok = res && (res.code === 0 || res.success === true || res.result === 0);
          if (!ok)
            throw new Error(t("starUpgradeCard.errors.bookUpgradeFailed"));
        } catch {
          state.value.recentResult = `图鉴 ${heroId} 升级失败`;
          skip = true;
        }
        await sleep(mod.delay);
        if (skip)
          break;
      }
      state.value.done += 1;
    }
    state.value.progressText = state.value.stopRequested ? "stopped" : "done";
    state.value.recentResult = state.value.stopRequested
      ? t("starUpgradeCard.messages.stopped")
      : t("starUpgradeCard.messages.bookDone");
    message.success(state.value.recentResult);
  } finally {
    state.value.isRunning = false;
    state.value.waitSeconds = 0;
  }
};

const runClaimRewards = async (mod) => {
  const tokenId = ensureReadyToken();
  if (!tokenId)
    return;
  try {
    state.value.isRunning = true;
    state.value.progressText = "claim";
    for (let i = 1; i <= 10; i += 1) {
      if (state.value.stopRequested)
        break;
      state.value.recentResult = `正在领取第 ${i} 次奖励`;
      let success = true;
      try {
        const res = await sendWithRetryOnRateLimit(
          tokenId,
          "book_claimpointreward",
          {},
          8000,
          mod.delay,
        );
        const ok = res && (res.code === 0 || res.success === true || res.result === 0);
        if (!ok)
          throw new Error(t("starUpgradeCard.errors.claimFailed"));
        state.value.done += 1;
      } catch {
        state.value.recentResult = `奖励领取在第 ${i} 次停止`;
        state.value.done += 1;
        success = false;
      }
      await sleep(mod.delay);
      if (!success)
        break;
    }
    state.value.progressText = state.value.stopRequested ? "stopped" : "done";
    state.value.recentResult = state.value.stopRequested
      ? t("starUpgradeCard.messages.stopped")
      : t("starUpgradeCard.messages.claimDone");
    message.success(state.value.recentResult);
  } finally {
    state.value.isRunning = false;
    state.value.waitSeconds = 0;
  }
};
</script>

<style scoped lang="scss">
.settings {
  align-items: center;
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

.star-upgrade-card__metrics {
  align-items: stretch;
}

.progress-row {
  grid-column: 1 / -1;
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

.progress-label,
.runtime-label {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.progress-text,
.runtime-value {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-family: var(--font-family-mono);
  font-weight: 700;
  white-space: nowrap;
}

.runtime-card {
  align-items: stretch;
}

.star-upgrade-card__actions {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (max-width: 959px) {
  .progress-copy {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
