<template>
  <MyCard class="hang-up" :status-class="{ active: state.isRunning }">
    <template #icon>
      <img
        alt="宝库图标"
        src="/icons/Ob7pyorzmHiJcbab2c25af264d0758b527bc1b61cc3b.png"
      >
    </template>
    <template #title>
      <h3>咸王功能</h3>
    </template>
    <template #default>
      <div class="gwb2-mini-card__metric boss-tower__metric">
        <span class="metric-label">宝库当前层数</span>
        <strong class="metric-value">{{ currentTower }}</strong>
      </div>
    </template>
    <template #action>
      <n-button
        block
        secondary
        size="small"
        type="primary"
        @click="extendbosstower"
      >
        宝库战斗
      </n-button>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();
const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);
const dayOfWeek = new Date().getDay();

const bossTowerInfo = computed(() => {
  const data = tokenStore.gameData?.bossTowerInfo || null;
  return data;
});
const currentTower = computed(() => {
  const tower = bossTowerInfo.value?.bossTower;
  return tower?.towerId ?? 1;
});
const state = ref({
  isRunning: false,
});

const extendbosstower = async () => {
  if (!tokenStore.selectedToken)
    return message.warning("请先选择Token");
  const tokenId = tokenStore.selectedToken.id;
  state.value.isRunning = true;
  if (dayOfWeek != 1 && dayOfWeek != 2) {
    if (currentTower.value === 1 || currentTower.value === 2 || currentTower.value === 3) {
      try {
        state.value.isExtending = true;
        message.info("正在战斗...");
        for (let i = 0; i < 2; i++) {
          tokenStore.sendMessage(tokenId, "bosstower_startboss", {});
        }
        for (let j = 0; j < 9; j++) {
          tokenStore.sendMessage(tokenId, "bosstower_startbox", {});
        }
        await tokenStore.sendMessageWithPromise(
          tokenId,
          "bosstower_getinfo",
          {},
          10000,
        );
        message.success("战斗已完成，请上线手动领取奖励");
      } catch (e) {
        message.error(`战斗失败: ${e?.message || "未知错误"}`);
      }
    } else if (currentTower.value === 4 || currentTower.value === 5) {
      try {
        state.value.isExtending = true;
        message.info("正在战斗...");
        for (let i = 0; i < 2; i++) {
          tokenStore.sendMessage(tokenId, "bosstower_startboss", {});
        }
        await tokenStore.sendMessageWithPromise(
          tokenId,
          "bosstower_getinfo",
          {},
          10000,
        );
        message.success("战斗已完成");
      } catch (e) {
        message.error(`战斗失败: ${e?.message || "未知错误"}`);
      }
    } else {
      message.error("当前层数暂不支持");
    }
  } else {
    message.error("未到活动开放时间");
  }
  state.value.isRunning = false;
};
</script>

<style scoped lang="scss">
.boss-tower__metric {
  align-items: center;
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
  font-size: 1.35rem;
  font-weight: 700;
}
</style>
