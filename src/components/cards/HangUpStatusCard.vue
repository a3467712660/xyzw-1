<template>
  <MyCard
    class="hang-up"
    :panel-active="panelActive"
    :status-class="{ active: hangUp.isActive }"
  >
    <template #icon>
      <img alt="挂机图标" src="/icons/174061875626614.png">
    </template>
    <template #title>
      <h3>挂机时间</h3>
    </template>
    <template #badge>
      <span>{{ hangUp.isActive ? "挂机中" : "已完成" }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__metric-grid hang-up__metrics">
        <div class="gwb2-mini-card__metric hang-up__metric">
          <span class="metric-label">已挂机</span>
          <strong class="metric-value">{{ formatTime(hangUp.elapsedTime) }}</strong>
        </div>
        <div class="gwb2-mini-card__metric hang-up__metric">
          <span class="metric-label">剩余时间</span>
          <strong class="metric-value time-display">{{ formatTime(hangUp.remainingTime) }}</strong>
        </div>
      </div>
    </template>
    <template #action>
      <div class="gwb2-mini-card__action-rail">
        <n-button
          size="small"
          :disabled="isExtending"
          @click="extendHangUp"
        >
          <span v-if="isExtending" class="loading-text">
            <i class="line-md:loading-loop"></i> 加钟中...
          </span>
          <span v-else>加钟</span>
        </n-button>
        <n-button
          size="small"
          type="primary"
          :disabled="isClaiming"
          @click="claimHangUpReward"
        >
          <span v-if="isClaiming" class="loading-text">
            <i class="line-md:loading-loop"></i> 领取中...
          </span>
          <span v-else>领取奖励</span>
        </n-button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, ref, toRef } from "vue";
import { useMessage } from "naive-ui/es";
import { useGameCardPanelActive } from "@/composables/gameCards/useGameCardPanelActive";
import { useGameCardTicker } from "@/composables/gameCards/useGameCardTicker";
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
const { panelActive } = useGameCardPanelActive(toRef(props, "panelActive"));
const { now } = useGameCardTicker({ panelActive });
const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);
const isExtending = ref(false);
const isClaiming = ref(false);

const formatTime = (seconds) => {
  const total = Math.floor(Number(seconds) || 0);
  if (total <= 0)
    return "00:00:00";
  const h = Math.floor(total / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const hangUp = computed(() => {
  const hangUpInfo = roleInfo.value?.role?.hangUp;
  if (!hangUpInfo) {
    return {
      elapsedTime: 0,
      hangUpTime: 0,
      isActive: false,
      lastTime: 0,
      remainingTime: 0,
    };
  }

  const currentNow = now.value / 1000;
  const lastTime = Number(hangUpInfo.lastTime || 0);
  const hangUpTime = Number(hangUpInfo.hangUpTime || 0);
  const elapsed = currentNow - lastTime;
  const remainingTime
    = elapsed <= hangUpTime
      ? Math.floor(hangUpTime - elapsed)
      : 0;

  return {
    elapsedTime: Math.floor(hangUpTime - remainingTime),
    hangUpTime,
    isActive: remainingTime > 0,
    lastTime,
    remainingTime,
  };
});

const extendHangUp = async () => {
  if (!tokenStore.selectedToken)
    return message.warning("请先选择Token");
  const tokenId = tokenStore.selectedToken.id;
  try {
    isExtending.value = true;
    message.info("正在加钟...");
    const tasks = [];
    for (let i = 0; i < 4; i++) {
      tasks.push(
        new Promise((resolve) => {
          setTimeout(() => {
            tokenStore.sendMessage(tokenId, "system_mysharecallback", {
              isSkipShareCard: true,
              type: 2,
            });
            resolve();
          }, i * 300);
        }),
      );
    }
    await Promise.all(tasks);
    setTimeout(() => tokenStore.sendMessage(tokenId, "role_getroleinfo"), 1500);
    setTimeout(() => {
      message.success("加钟操作已完成，请查看挂机剩余时间");
      isExtending.value = false;
    }, 2500);
  } catch (e) {
    message.error(`加钟操作失败: ${e?.message || "未知错误"}`);
    isExtending.value = false;
  }
};

const claimHangUpReward = async () => {
  if (!tokenStore.selectedToken)
    return message.warning("请先选择Token");
  const tokenId = tokenStore.selectedToken.id;
  try {
    isClaiming.value = true;
    message.info("正在领取挂机奖励...");
    tokenStore.sendMessage(tokenId, "system_mysharecallback");
    setTimeout(
      () => tokenStore.sendMessage(tokenId, "system_claimhangupreward"),
      200,
    );
    setTimeout(
      () =>
        tokenStore.sendMessage(tokenId, "system_mysharecallback", {
          isSkipShareCard: true,
          type: 2,
        }),
      400,
    );
    setTimeout(() => tokenStore.sendMessage(tokenId, "role_getroleinfo"), 600);
    setTimeout(() => {
      message.success("挂机奖励领取完成");
      isClaiming.value = false;
    }, 1200);
  } catch (e) {
    message.error(`领取挂机奖励失败: ${e?.message || "未知错误"}`);
    isClaiming.value = false;
  }
};
</script>

<style scoped lang="scss">
.hang-up__metrics {
  align-items: stretch;
}

.hang-up__metric {
  align-items: stretch;
}

.metric-label {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-value {
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-size: 1rem;
  font-weight: 700;
}

@media (max-width: 959px) {
  .hang-up__metrics {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
