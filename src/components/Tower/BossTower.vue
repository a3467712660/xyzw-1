<template>
  <MyCard
    class="boss-tower-card"
    :panel-active="panelActive"
    :status-class="{ active: isRunning }"
  >
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
      <div class="gwb2-mini-card__metric-grid gwb2-mini-card__metric-grid--single">
        <div class="gwb2-mini-card__metric boss-tower__metric">
          <span class="metric-label">宝库当前层数</span>
          <strong class="metric-value">{{ currentTower }}</strong>
        </div>
      </div>
    </template>
    <template #action>
      <div class="gwb2-mini-card__action-rail gwb2-mini-card__action-rail--single">
        <n-button
          block
          secondary
          size="small"
          type="primary"
          :disabled="isRunning"
          @click="extendbosstower"
        >
          宝库战斗
        </n-button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed } from "vue";
import { useMessage } from "naive-ui/es";
import { useGameCardActionLock } from "@/composables/gameCards/useGameCardActionLock";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

defineProps({
  panelActive: {
    type: Boolean,
    default: true,
  },
});

const tokenStore = useTokenStore();
const message = useMessage();
const { isRunning, runLocked } = useGameCardActionLock();

const bossTowerInfo = computed(() => {
  const data = tokenStore.gameData?.bossTowerInfo || null;
  return data;
});
const currentTower = computed(() => {
  const tower = bossTowerInfo.value?.bossTower;
  return tower?.towerId ?? 1;
});

const extendbosstower = async () => {
  await runLocked(async () => {
    if (!tokenStore.selectedToken)
      return message.warning("请先选择Token");
    const tokenId = tokenStore.selectedToken.id;
    const dayOfWeek = new Date().getDay();

    if (dayOfWeek != 1 && dayOfWeek != 2) {
      if (currentTower.value === 1 || currentTower.value === 2 || currentTower.value === 3) {
        try {
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
  });
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
