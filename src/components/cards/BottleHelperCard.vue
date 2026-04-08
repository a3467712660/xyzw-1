<template>
  <MyCard
    class="bottle-helper"
    :panel-active="panelActive"
    :status-class="{ active: bottleHelper.isRunning }"
  >
    <template #icon>
      <img src="/icons/173746572831736.png" :alt="t('bottleHelperCard.iconAlt')">
    </template>
    <template #title>
      <h3>{{ t("bottleHelperCard.title") }}</h3>
      <p>{{ t("bottleHelperCard.subtitle") }}</p>
    </template>
    <template #badge>
      <span>{{ bottleHelper.isRunning ? t("bottleHelperCard.status.running") : t("bottleHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__metric-grid gwb2-mini-card__metric-grid--single">
        <div class="gwb2-mini-card__metric bottle-helper__metric">
          <span class="metric-label">{{ t("bottleHelperCard.subtitle") }}</span>
          <strong class="metric-value time-display">{{ formatTime(bottleHelper.remainingTime) }}</strong>
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
          @click="handleBottleHelper"
        >
          {{ bottleHelper.isRunning ? t("bottleHelperCard.actions.restart") : t("bottleHelperCard.actions.start") }}
        </n-button>
      </div>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, toRef } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
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
const { t } = useI18n();

const { panelActive } = useGameCardPanelActive(toRef(props, "panelActive"));
const { now } = useGameCardTicker({ panelActive });
const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const formatTime = (seconds) => {
  const total = Math.floor(Number(seconds) || 0);
  if (total <= 0) return "00:00:00";
  const h = Math.floor(total / 3600)
    .toString()
    .padStart(2, "0");
  const m = Math.floor((total % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
};

const bottleHelper = computed(() => {
  const stopTime = Number(roleInfo.value?.role?.bottleHelpers?.helperStopTime || 0);
  const currentNow = now.value / 1000;
  const remainingTime = Math.max(0, Math.floor(stopTime - currentNow));

  return {
    isRunning: stopTime > currentNow,
    remainingTime,
    stopTime,
  };
});

const handleBottleHelper = () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("bottleHelperCard.messages.selectTokenFirst"));
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  tokenStore.sendMessage(tokenId, "bottlehelper_stop");
  setTimeout(() => {
    tokenStore.sendMessage(tokenId, "bottlehelper_start");
    tokenStore.sendMessage(tokenId, "role_getroleinfo");
  }, 500);
  message.info(
    bottleHelper.value.isRunning
      ? t("bottleHelperCard.messages.restarting")
      : t("bottleHelperCard.messages.starting"),
  );
};
</script>

<style scoped lang="scss">
.bottle-helper__metric {
  align-items: center;
}

.metric-label {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.metric-value {
  flex: 1;
}
</style>
