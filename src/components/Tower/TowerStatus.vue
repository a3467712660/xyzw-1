<template>
  <div class="gwb2-mini-card tower-status">
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

      <div class="gwb2-mini-card__metric tower-floor">
        <span class="label">{{ t("towerStatus.labels.currentFloor") }}</span>
        <span class="floor-number">{{ currentFloor }}</span>
      </div>
    </div>

    <div class="gwb2-mini-card__actions tower-status__actions">
      <n-button
        class="climb-button"
        type="primary"
        :disabled="!canClimb"
        @click="startTowerClimb"
      >
        {{ isClimbing.value ? t("towerStatus.actions.climbing") : t("towerStatus.actions.start") }}
      </n-button>

      <!-- 停止批量爬塔按钮，仅批量时显示 -->
      <n-button secondary class="stop-button" type="warning" @click="stopClimbing">{{ t("towerStatus.actions.stop") }}</n-button>
      <!-- 调试用的重置按钮，只在开发环境显示 -->
      <n-button v-if="false" secondary class="reset-button" @click="resetClimbingState">
        {{ t("towerStatus.actions.reset") }}
      </n-button>
    </div>
  </div>
</template>

<script setup>
// 停止批量爬塔操作
import { computed, onMounted, ref, watch } from "vue";
import { useTokenStore } from "@/stores/tokenStore";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";

let stopFlag = false;

const stopClimbing = () => {
  stopFlag = true;
  if (climbTimeout.value) {
    clearTimeout(climbTimeout.value);
    climbTimeout.value = null;
  }
  isClimbing.value = false;
  message.info(t("towerStatus.messages.manuallyStopped"));
};

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

// 响应式数据
const isClimbing = ref(false);
const climbTimeout = ref(null); // 用于超时重置状态
const lastClimbResult = ref(null); // 最后一次爬塔结果

// 计算属性 - 从gameData中获取塔相关信息
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

// 方法
const startTowerClimb = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("towerStatus.messages.selectTokenFirst"));
    return;
  }

  if (!canClimb.value) {
    message.warning(t("towerStatus.messages.cannotClimb"));
    return;
  }

  // 清除之前的超时
  if (climbTimeout.value) {
    clearTimeout(climbTimeout.value);
    climbTimeout.value = null;
  }

  isClimbing.value = true;
  stopFlag = false;
  let climbCount = 0;
  const maxClimb = 100; // 最多批量次数，防止死循环
  // 设置超时保护，60秒后自动重置状态
  climbTimeout.value = setTimeout(() => {
    isClimbing.value = false;
    climbTimeout.value = null;
    stopFlag = true;
    message.info(t("towerStatus.messages.autoStoppedByTimeout"));
  }, 60000);

  try {
    const tokenId = tokenStore.selectedToken.id;
    for (let i = 0; i < maxClimb; i++) {
      if (stopFlag)
        break;
      await getTowerInfo();
      // 体力判断必须每次都刷新
      const tower = roleInfo.value?.role?.tower;
      const energy = tower?.energy || 0;
      if (energy <= 0)
        break;
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "fight_starttower",
        {},
        10000,
      );
      climbCount++;
      message.success(t("towerStatus.messages.climbCommandSent", { count: climbCount }));
      await new Promise((res) => setTimeout(res, 2000)); // 每次间隔2秒
    }
    message.success(t("towerStatus.messages.climbCompleted", { count: climbCount }));
  } catch (error) {
    message.error(
      t("towerStatus.messages.climbFailed", {
        error: error.message || t("towerStatus.common.unknownError"),
      }),
    );
  }

  // 清除超时并重置状态
  if (climbTimeout.value) {
    clearTimeout(climbTimeout.value);
    climbTimeout.value = null;
  }
  isClimbing.value = false;
};

// 重置爬塔状态的方法
const resetClimbingState = () => {
  if (climbTimeout.value) {
    clearTimeout(climbTimeout.value);
    climbTimeout.value = null;
  }
  isClimbing.value = false;
  message.info(t("towerStatus.messages.stateReset"));
};

const getTowerInfo = async () => {
  if (!tokenStore.selectedToken) {
    return;
  }

  try {
    const tokenId = tokenStore.selectedToken.id;
    // 检查WebSocket连接状态
    const wsStatus = tokenStore.getWebSocketStatus(tokenId);

    if (wsStatus !== "connected") {
      return;
    }
    // 首先获取角色信息，这包含了塔的数据
    const roleResult = tokenStore.sendMessage(tokenId, "role_getroleinfo");
    // 直接请求塔信息
    const towerResult = tokenStore.sendMessage(tokenId, "tower_getinfo");
    if (!roleResult && !towerResult) {
    }
  } catch (error) {
    // 获取塔信息失败：静默，避免噪声
  }
};

// 监听WebSocket连接状态变化
const wsStatus = computed(() => {
  if (!tokenStore.selectedToken)
    return "disconnected";
  return tokenStore.getWebSocketStatus(tokenStore.selectedToken.id);
});

// 监听WebSocket连接状态，连接成功后自动获取塔信息
watch(wsStatus, (newStatus, oldStatus) => {
  if (newStatus === "connected" && oldStatus !== "connected") {
    // 延迟一点时间让WebSocket完全就绪
    setTimeout(() => {
      getTowerInfo();
    }, 1000);
  }
});

// 监听选中Token变化
watch(
  () => tokenStore.selectedToken,
  (newToken, oldToken) => {
    if (newToken && newToken.id !== oldToken?.id) {
      // 检查WebSocket是否已连接
      const status = tokenStore.getWebSocketStatus(newToken.id);
      if (status === "connected") {
        getTowerInfo();
      }
    }
  },
);

// 监听爬塔结果
watch(
  () => tokenStore.gameData.towerResult,
  (newResult, oldResult) => {
    if (newResult && newResult.timestamp !== oldResult?.timestamp) {
      // 显示爬塔结果消息
      if (newResult.success) {
        message.success(t("towerStatus.messages.challengeSuccess"));

        if (newResult.autoReward) {
          setTimeout(() => {
            message.success(
              t("towerStatus.messages.autoRewardClaimed", {
                floor: newResult.rewardFloor,
              }),
            );
          }, 1000);
        }
      } else {
        message.error(t("towerStatus.messages.challengeFailed"));
      }

      // 重置爬塔状态（仅在未批量时重置）
      if (!stopFlag) {
        setTimeout(() => {
          if (climbTimeout.value) {
            clearTimeout(climbTimeout.value);
            climbTimeout.value = null;
          }
          isClimbing.value = false;
        }, 2000);
      }
    }
  },
  { deep: true },
);

// 生命周期
onMounted(() => {
  // 检查WebSocket客户端
  if (tokenStore.selectedToken) {
    const client = tokenStore.getWebSocketClient(tokenStore.selectedToken.id);
  }

  // 组件挂载时获取塔信息
  if (tokenStore.selectedToken && wsStatus.value === "connected") {
    getTowerInfo();
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
  min-height: 240px; // 继续缩小整体高度
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

.tower-floor {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);

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

.tower-status__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.climb-button {
  width: 100%;
}

.reset-button {
  width: 100%;
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-medium);
  border: 1px solid var(--warning-color);
  border-radius: var(--border-radius-small);
  background: transparent;
  color: var(--warning-color);
  cursor: pointer;
  transition: all var(--transition-fast);

  &:hover {
    background: var(--warning-color);
    color: white;
  }
}

.debug-info {
  margin-top: var(--spacing-sm);
  padding: var(--spacing-xs);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-small);
  font-family: monospace;
  word-break: break-all;

  small {
    color: var(--text-secondary);
    font-size: 10px;
  }
}

// 响应式设计
@media (max-width: 768px) {
  .tower-status__toolbar {
    flex-direction: column;
    gap: var(--spacing-sm);
    text-align: center;
  }
}
</style>
