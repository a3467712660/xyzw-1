<template>
  <MyCard class="hang-up" :status-class="{ active: hangUp.isActive }">
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
      <div class="gwb2-mini-card__metric hang-up__metric">
        <div class="metric-block">
          <span class="metric-label">已挂机</span>
          <strong class="metric-value">{{ formatTime(hangUp.elapsedTime) }}</strong>
        </div>
        <div class="metric-block">
          <span class="metric-label">剩余时间</span>
          <strong class="metric-value time-display">{{ formatTime(hangUp.remainingTime) }}</strong>
        </div>
      </div>
    </template>
    <template #action>
      <n-button
        size="small"
        :disabled="hangUp.isExtending"
        @click="extendHangUp"
      >
        <span v-if="hangUp.isExtending" class="loading-text">
          <i class="line-md:loading-loop"></i> 加钟中...
        </span>
        <span v-else>加钟</span>
      </n-button>
      <n-button
        size="small"
        type="primary"
        :disabled="hangUp.isClaiming"
        @click="claimHangUpReward"
      >
        <span v-if="hangUp.isClaiming" class="loading-text">
          <i class="line-md:loading-loop"></i> 领取中...
        </span>
        <span v-else>领取奖励</span>
      </n-button>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();
const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const hangUp = ref({
  isActive: false,
  remainingTime: 0,
  elapsedTime: 0,
  lastTime: 0,
  hangUpTime: 0,
  isExtending: false,
  isClaiming: false,
});

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

const syncFromRole = () => {
  const role = roleInfo.value?.role;
  if (!role?.hangUp)
    return;
  const now = Date.now() / 1000;
  hangUp.value.lastTime = role.hangUp.lastTime;
  hangUp.value.hangUpTime = role.hangUp.hangUpTime;
  const elapsed = now - hangUp.value.lastTime;
  if (elapsed <= hangUp.value.hangUpTime) {
    hangUp.value.remainingTime = Math.floor(hangUp.value.hangUpTime - elapsed);
    hangUp.value.isActive = true;
  } else {
    hangUp.value.remainingTime = 0;
    hangUp.value.isActive = false;
  }
  hangUp.value.elapsedTime = Math.floor(
    hangUp.value.hangUpTime - hangUp.value.remainingTime,
  );
};

watch(roleInfo, () => syncFromRole(), { deep: true, immediate: true });

let timer = null;
onMounted(() => {
  timer = setInterval(() => {
    if (hangUp.value.isActive && hangUp.value.remainingTime > 0) {
      hangUp.value.remainingTime = Math.max(0, hangUp.value.remainingTime - 1);
      hangUp.value.elapsedTime = hangUp.value.elapsedTime + 1;
      if (hangUp.value.remainingTime <= 0)
        hangUp.value.isActive = false;
    }
  }, 1000);
});
onUnmounted(() => {
  if (timer)
    clearInterval(timer);
});

const extendHangUp = async () => {
  if (!tokenStore.selectedToken)
    return message.warning("请先选择Token");
  const tokenId = tokenStore.selectedToken.id;
  try {
    hangUp.value.isExtending = true;
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
      hangUp.value.isExtending = false;
    }, 2500);
  } catch (e) {
    message.error(`加钟操作失败: ${e?.message || "未知错误"}`);
    hangUp.value.isExtending = false;
  }
};

const claimHangUpReward = async () => {
  if (!tokenStore.selectedToken)
    return message.warning("请先选择Token");
  const tokenId = tokenStore.selectedToken.id;
  try {
    hangUp.value.isClaiming = true;
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
      hangUp.value.isClaiming = false;
    }, 1200);
  } catch (e) {
    message.error(`领取挂机奖励失败: ${e?.message || "未知错误"}`);
    hangUp.value.isClaiming = false;
  }
};
</script>

<style scoped lang="scss">
.hang-up__metric {
  align-items: stretch;
}

.metric-block {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  flex-direction: column;
  gap: 4px;
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

@media (max-width: 768px) {
  .hang-up__metric {
    flex-direction: column;
  }
}
</style>
