<template>
  <div
    class="gwb2-mini-card tower-status"
    :data-panel-active="panelActive ? 'true' : 'false'"
  >
    <div class="gwb2-mini-card__surface">
      <div class="gwb2-mini-card__toolbar tower-status__toolbar">
        <div class="gwb2-mini-card__toolbar-main">
          <img
            class="status-icon"
            src="/icons/1733492491706148.png"
            :alt="t('towerStatus.iconAlt')"
          >
          <div class="status-info">
            <h3>{{ t("towerStatus.title") }}</h3>
            <p>{{ t("towerStatus.subtitle") }}</p>
          </div>
        </div>
        <div class="gwb2-mini-card__toolbar-side">
          <div class="gwb2-mini-card__chip tower-energy-chip">
            <img class="energy-icon" src="/icons/xiaoyugan.png" :alt="t('towerStatus.energyAlt')">
            <span class="energy-label">{{ t("towerStatus.energyAlt") }}</span>
            <span class="energy-count">{{ towerEnergy }}</span>
          </div>
        </div>
      </div>

      <div class="gwb2-mini-card__body tower-status__body">
        <div class="gwb2-mini-card__metric-grid">
          <div class="gwb2-mini-card__metric tower-floor">
            <span class="label">{{ t("towerStatus.labels.currentFloor") }}</span>
            <span class="floor-number">{{ currentFloor }}</span>
          </div>
          <div class="gwb2-mini-card__metric tower-runtime">
            <span class="label">当前状态</span>
            <span class="runtime-value">{{ runtime.statusText }}</span>
          </div>
        </div>

        <div class="gwb2-mini-card__list tower-runtime-list">
          <div class="runtime-row">
            <span class="runtime-label">执行阶段</span>
            <strong class="runtime-meta">{{ isClimbing ? t("towerStatus.actions.climbing") : "待命" }}</strong>
          </div>
          <div class="runtime-row">
            <span class="runtime-label">已发挑战</span>
            <strong class="runtime-meta">{{ runtime.progressCount }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="gwb2-mini-card__actions tower-status__actions">
      <div class="gwb2-mini-card__action-rail">
        <n-button
          class="climb-button"
          type="primary"
          :disabled="!canClimb"
          @click="startTowerClimb"
        >
          {{ isClimbing ? t("towerStatus.actions.climbing") : t("towerStatus.actions.start") }}
        </n-button>
        <n-button
          secondary
          class="stop-button"
          type="warning"
          :disabled="!isClimbing"
          @click="stopClimbing"
        >
          {{ t("towerStatus.actions.stop") }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRef, watch } from "vue";
import { useGameCardPanelActive } from "@/composables/gameCards/useGameCardPanelActive";
import { useTokenStore } from "@/stores/tokenStore";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";

const props = defineProps({
  panelActive: {
    type: Boolean,
    default: true,
  },
});

const { panelActive } = useGameCardPanelActive(toRef(props, "panelActive"));
const stopFlag = ref(false);
const pendingTowerInfoRefresh = ref(false);
let connectRefreshHandle = null;

const stopClimbing = () => {
  stopFlag.value = true;
  clearClimbTimeout();
  runtime.phase = "idle";
  runtime.statusText = t("towerStatus.messages.manuallyStopped");
  message.info(t("towerStatus.messages.manuallyStopped"));
};

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

const runtime = reactive({
  phase: "idle",
  progressCount: 0,
  statusText: t("towerStatus.subtitle"),
});
const climbTimeout = ref(null);
const isClimbing = computed(() => runtime.phase === "climb");

const roleInfo = computed(() => {
  const data = tokenStore.gameData?.roleInfo || null;
  return data;
});

const currentFloor = computed(() => {
  const tower = roleInfo.value?.role?.tower;

  if (!tower) {
    return "0 - 0";
  }

  if (!tower.id && tower.id !== 0) {
    return "0 - 0";
  }

  const towerId = tower.id;
  const floor = Math.floor(towerId / 10) + 1;
  const layer = (towerId % 10) + 1;
  return `${floor} - ${layer}`;
});

const towerEnergy = computed(() => {
  const tower = roleInfo.value?.role?.tower;

  const energy = tower?.energy || 0;
  return energy;
});

const canClimb = computed(() => {
  const hasEnergy = towerEnergy.value > 0;
  const notClimbing = !isClimbing.value;
  return hasEnergy && notClimbing;
});

const clearClimbTimeout = () => {
  if (climbTimeout.value) {
    clearTimeout(climbTimeout.value);
    climbTimeout.value = null;
  }
};

const scheduleTowerInfoRefresh = async ({ forceUi = false } = {}) => {
  if (!tokenStore.selectedToken) {
    return;
  }
  if (!panelActive.value && !isClimbing.value && !forceUi) {
    pendingTowerInfoRefresh.value = true;
    return;
  }
  pendingTowerInfoRefresh.value = false;
  await getTowerInfo();
};

const startTowerClimb = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("towerStatus.messages.selectTokenFirst"));
    return;
  }

  if (!canClimb.value) {
    message.warning(t("towerStatus.messages.cannotClimb"));
    return;
  }

  clearClimbTimeout();
  runtime.phase = "climb";
  runtime.progressCount = 0;
  runtime.statusText = "准备挑战中";
  stopFlag.value = false;
  let climbCount = 0;
  const maxClimb = 100;
  climbTimeout.value = setTimeout(() => {
    runtime.phase = "idle";
    runtime.statusText = t("towerStatus.messages.autoStoppedByTimeout");
    stopFlag.value = true;
    message.info(t("towerStatus.messages.autoStoppedByTimeout"));
  }, 60000);

  try {
    const tokenId = tokenStore.selectedToken.id;
    for (let i = 0; i < maxClimb; i++) {
      if (stopFlag.value)
        break;
      await getTowerInfo();
      const tower = roleInfo.value?.role?.tower;
      const energy = tower?.energy || 0;
      if (energy <= 0)
        break;
      runtime.statusText = `正在执行第 ${climbCount + 1} 次挑战`;
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "fight_starttower",
        {},
        10000,
      );
      climbCount++;
      runtime.progressCount = climbCount;
      runtime.statusText = `已发送 ${climbCount} 次挑战`;
      await new Promise((res) => setTimeout(res, 2000));
    }
    if (!stopFlag.value) {
      runtime.statusText = t("towerStatus.messages.climbCompleted", { count: climbCount });
      message.success(t("towerStatus.messages.climbCompleted", { count: climbCount }));
    }
  } catch (error) {
    runtime.statusText = t("towerStatus.messages.climbFailed", {
      error: error.message || t("towerStatus.common.unknownError"),
    });
    message.error(
      t("towerStatus.messages.climbFailed", {
        error: error.message || t("towerStatus.common.unknownError"),
      }),
    );
  } finally {
    clearClimbTimeout();
    runtime.phase = "idle";
  }
};

const getTowerInfo = async () => {
  if (!tokenStore.selectedToken) {
    return;
  }

  try {
    const tokenId = tokenStore.selectedToken.id;
    const wsStatus = tokenStore.getWebSocketStatus(tokenId);

    if (wsStatus !== "connected") {
      return;
    }
    tokenStore.sendMessage(tokenId, "role_getroleinfo");
    tokenStore.sendMessage(tokenId, "tower_getinfo");
  } catch {}
};

const wsStatus = computed(() => {
  if (!tokenStore.selectedToken)
    return "disconnected";
  return tokenStore.getWebSocketStatus(tokenStore.selectedToken.id);
});

watch(wsStatus, (newStatus, oldStatus) => {
  if (newStatus === "connected" && oldStatus !== "connected") {
    if (connectRefreshHandle) {
      clearTimeout(connectRefreshHandle);
    }
    connectRefreshHandle = setTimeout(() => {
      scheduleTowerInfoRefresh();
    }, 1000);
  }
});

watch(
  () => tokenStore.selectedToken,
  (newToken, oldToken) => {
    if (newToken && newToken.id !== oldToken?.id) {
      const status = tokenStore.getWebSocketStatus(newToken.id);
      if (status === "connected") {
        scheduleTowerInfoRefresh();
      }
    }
  },
);

watch(
  panelActive,
  (active) => {
    if (active && pendingTowerInfoRefresh.value) {
      scheduleTowerInfoRefresh({ forceUi: true });
    }
  },
  { immediate: true },
);

onMounted(() => {
  if (tokenStore.selectedToken && wsStatus.value === "connected") {
    scheduleTowerInfoRefresh();
  } else if (!panelActive.value) {
    pendingTowerInfoRefresh.value = true;
  }
});

onBeforeUnmount(() => {
  if (connectRefreshHandle) {
    clearTimeout(connectRefreshHandle);
    connectRefreshHandle = null;
  }
  if (!isClimbing.value) {
    clearClimbTimeout();
  }
});
</script>

<style scoped lang="scss">
.stop-button {
  width: 100%;
  padding: var(--spacing-sm) var(--spacing-md);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  border: 1px solid #e5e7eb;
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  transition: all var(--transition-fast);
  background: #fff;
  color: #e11d48;

  &:hover {
    background: #e11d48;
    color: white;
    border-color: #e11d48;
  }
}

// 使用GameStatus中的统一卡片样式
.tower-status {
  display: flex;
  flex-direction: column;
  min-height: 240px;
}

.status-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  flex-shrink: 0;
}

.tower-status__toolbar {
  display: flex;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.tower-energy-chip {
  gap: 8px;
}

.energy-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.energy-label {
  color: currentColor;
  font-size: 12px;
}

.energy-count {
  font-size: 13px;
  font-weight: 700;
  color: currentColor;
}

.tower-status__body {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.tower-floor,
.tower-runtime {
  align-items: center;

  .label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }

  .floor-number {
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
    color: var(--text-primary);
    font-family: "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace;
  }
}

.tower-runtime {
  justify-content: space-between;
}

.runtime-value,
.runtime-meta {
  color: var(--text-primary);
  font-weight: var(--font-weight-semibold);
}

.tower-runtime-list {
  gap: var(--spacing-sm);
}

.runtime-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
}

.runtime-label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.climb-button {
  width: 100%;
}

@media (max-width: 959px) {
  .tower-status__toolbar {
    flex-direction: column;
    gap: var(--spacing-sm);
    text-align: center;
  }

  .runtime-row {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
