<template>
  <MyCard class="bottle-helper" :status-class="{ active: state.isRunning }">
    <template #icon>
      <img src="/icons/173746572831736.png" :alt="t('bottleHelperCard.iconAlt')">
    </template>
    <template #title>
      <h3>{{ t("bottleHelperCard.title") }}</h3>
      <p>{{ t("bottleHelperCard.subtitle") }}</p>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? t("bottleHelperCard.status.running") : t("bottleHelperCard.status.stopped") }}</span>
    </template>
    <template #default>
      <div class="gwb2-mini-card__metric bottle-helper__metric">
        <span class="metric-label">{{ t("bottleHelperCard.subtitle") }}</span>
        <strong class="metric-value time-display">{{ formatTime(state.remainingTime) }}</strong>
      </div>
    </template>
    <template #action>
      <n-button
        block
        secondary
        size="small"
        type="primary"
        @click="handleBottleHelper"
      >
        {{ state.isRunning ? t("bottleHelperCard.actions.restart") : t("bottleHelperCard.actions.start") }}
      </n-button>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import MyCard from "../Common/MyCard.vue";

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const state = ref({
  isRunning: false,
  remainingTime: 0,
  stopTime: 0,
});

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

const syncFromRole = () => {
  const role = roleInfo.value?.role;
  if (!role?.bottleHelpers) return;
  const now = Date.now() / 1000;
  state.value.stopTime = role.bottleHelpers.helperStopTime;
  state.value.isRunning = role.bottleHelpers.helperStopTime > now;
  state.value.remainingTime = Math.max(
    0,
    Math.floor(role.bottleHelpers.helperStopTime - now),
  );
};

watch(roleInfo, () => syncFromRole(), { deep: true, immediate: true });

let timer = null;
onMounted(() => {
  timer = setInterval(() => {
    if (state.value.isRunning && state.value.remainingTime > 0) {
      state.value.remainingTime = Math.max(0, state.value.remainingTime - 1);
      if (state.value.remainingTime <= 0) state.value.isRunning = false;
    }
  }, 1000);
});
onUnmounted(() => {
  if (timer) clearInterval(timer);
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
    state.value.isRunning
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
