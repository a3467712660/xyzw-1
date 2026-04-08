<template>
  <div class="gwb2-mini-card tower-status weird-tower">
    <div class="gwb2-mini-card__surface">
      <div class="gwb2-mini-card__toolbar weird-tower__toolbar">
        <div class="gwb2-mini-card__toolbar-main">
          <img
            class="status-icon"
            src="/icons/1733492491706152.png"
            :alt="t('weirdTowerStatus.iconAlt')"
          >
          <div class="status-info">
            <h3>{{ t("weirdTowerStatus.title") }}</h3>
            <p>{{ t("weirdTowerStatus.subtitle") }}</p>
          </div>
        </div>
        <div class="gwb2-mini-card__toolbar-side">
          <div class="gwb2-mini-card__chip tower-energy-chip">
            <img class="energy-icon" src="/icons/xiaoyugan.png" :alt="t('weirdTowerStatus.energyAlt')">
            <span class="energy-label">{{ t("weirdTowerStatus.energyAlt") }}</span>
            <span class="energy-count">{{ towerEnergy }}</span>
          </div>
        </div>
      </div>

      <div class="gwb2-mini-card__metric tower-floor">
        <span class="label">{{ t("weirdTowerStatus.labels.currentFloor") }}</span>
        <span class="floor-number">{{ displayFloor }}</span>
      </div>
    </div>

    <div class="gwb2-mini-card__actions weird-tower__actions">
      <n-button
        class="climb-button"
        type="primary"
        :disabled="!canClimb"
        @click="startTowerClimb"
      >
        {{ isClimbing.value ? t("weirdTowerStatus.actions.climbing") : t("weirdTowerStatus.actions.startClimb") }}
      </n-button>

      <!-- 停止批量爬塔按钮，仅批量时显示 -->
      <n-button v-if="isClimbing" secondary class="stop-button" type="warning" @click="stopClimbing">{{ t("weirdTowerStatus.actions.stopClimb") }}</n-button>

      <n-button
        v-if="!isClimbing && !isUsingItems && !isMerging"
        class="climb-button"
        type="primary"
        @click="startUseItems"
      >
        {{ t("weirdTowerStatus.actions.useItems") }}
      </n-button>
      <n-button v-if="isUsingItems" secondary class="stop-button" type="warning" @click="stopUsingItems">{{ t("weirdTowerStatus.actions.stopUsing") }}</n-button>

      <n-button
        v-if="!isClimbing && !isUsingItems && !isMerging"
        class="climb-button"
        type="primary"
        @click="autoMergeItems"
      >
        {{ isMerging ? t("weirdTowerStatus.actions.merging") : t("weirdTowerStatus.actions.autoMerge") }}
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
let stopItemFlag = false;
let stopMergeFlag = false;

const stopClimbing = () => {
  stopFlag = true;
  if (climbTimeout.value) {
    clearTimeout(climbTimeout.value);
    climbTimeout.value = null;
  }
  isClimbing.value = false;
  message.info(t("weirdTowerStatus.messages.manuallyStoppedClimb"));
};

const stopUsingItems = () => {
  stopItemFlag = true;
  if (itemTimeout.value) {
    clearTimeout(itemTimeout.value);
    itemTimeout.value = null;
  }
  isUsingItems.value = false;
  message.info(t("weirdTowerStatus.messages.manuallyStoppedItems"));
};

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();

// 响应式数据
const isClimbing = ref(false);
const isUsingItems = ref(false);
const isMerging = ref(false);
const climbTimeout = ref(null); // 用于超时重置状态
const itemTimeout = ref(null); // 用于道具使用超时
const mergeTimeout = ref(null); // 用于合成超时
const lastClimbResult = ref(null); // 最后一次爬塔结果

// 计算属性 - 从gameData中获取塔相关信息
const evoTowerInfo = computed(() => {
  const data = tokenStore.gameData?.evoTowerInfo || null;
  return data;
});

const weirdTowerData = computed(() => {
  return evoTowerInfo.value?.evoTower || null;
});

const currentTowerId = computed(() => {
  return weirdTowerData.value?.towerId || 0;
});

const lotteryLeftCnt = computed(() => {
  return weirdTowerData.value?.lotteryLeftCnt || 0;
});

const displayFloor = computed(() => {
  const towerId = currentTowerId.value;

  if (towerId === 0) {
    return "1-1";
  } else {
    // 计算章节和层数
    // 每章10层，0-9为第1章，10-19为第2章，20-29为第3章，以此类推
    const chapter = Math.floor(towerId / 10) + 1;
    const floor = (towerId % 10) + 1;
    return `${chapter}-${floor}`;
  }
});

const towerEnergy = computed(() => {
  return weirdTowerData.value?.energy || 0;
});

const canClimb = computed(() => {
  const hasEnergy = towerEnergy.value > 0;
  const notClimbing = !isClimbing.value;
  const notUsingItems = !isUsingItems.value;
  const notMerging = !isMerging.value;
  return hasEnergy && notClimbing && notUsingItems && notMerging;
});

const getCurrentActivityWeek = computed(() => {
  const now = new Date();
  const start = new Date("2025-12-12T12:00:00"); // 起始时间：黑市周开始
  const weekDuration = 7 * 24 * 60 * 60 * 1000; // 一周毫秒数
  const cycleDuration = 3 * weekDuration; // 三周期毫秒数

  const elapsed = now - start;
  if (elapsed < 0)
    return null; // 活动开始前

  const cyclePosition = elapsed % cycleDuration;

  if (cyclePosition < weekDuration) {
    return "blackMarket";
  } else if (cyclePosition < 2 * weekDuration) {
    return "recruit";
  } else {
    return "chest";
  }
});

const isWeirdTowerActivityOpen = computed(() => {
  return getCurrentActivityWeek.value === "blackMarket";
});

// 方法
const startUseItems = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("weirdTowerStatus.messages.selectTokenFirst"));
    return;
  }

  if (isClimbing.value) {
    message.warning(t("weirdTowerStatus.messages.climbingInProgress"));
    return;
  }

  if (isMerging.value) {
    message.warning(t("weirdTowerStatus.messages.mergingInProgress"));
    return;
  }

  isUsingItems.value = true;
  stopItemFlag = false;

  // 设置超时保护，60秒后自动重置状态
  itemTimeout.value = setTimeout(() => {
    isUsingItems.value = false;
    itemTimeout.value = null;
    stopItemFlag = true;
    message.info(t("weirdTowerStatus.messages.useItemsTimeout"));
  }, 60000);

  try {
    const tokenId = tokenStore.selectedToken.id;

    // 1. 获取活动信息
    const infoRes = await tokenStore.sendMessageWithPromise(
      tokenId,
      "mergebox_getinfo",
      { actType: 1 },
      5000,
    );

    // 获取怪异塔信息以读取剩余道具数量
    const towerInfoRes = await tokenStore.sendMessageWithPromise(
      tokenId,
      "evotower_getinfo",
      {},
      5000,
    );

    if (!infoRes || !infoRes.mergeBox) {
      throw new Error(t("weirdTowerStatus.messages.fetchActivityFailed"));
    }

    let costTotalCnt = infoRes.mergeBox.costTotalCnt || 0;
    let lotteryLeftCnt = towerInfoRes?.evoTower?.lotteryLeftCnt || 0;

    if (lotteryLeftCnt <= 0) {
      message.info(t("weirdTowerStatus.messages.noItemsLeft"));
      isUsingItems.value = false;
      if (itemTimeout.value)
        clearTimeout(itemTimeout.value);
      return;
    }

    message.success(
      t("weirdTowerStatus.messages.useItemsStarted", {
        remaining: lotteryLeftCnt,
        used: costTotalCnt,
      }),
    );
    let processedCount = 0;

    while (lotteryLeftCnt > 0 && !stopItemFlag) {
      let pos = {};
      if (costTotalCnt < 2) {
        pos = { gridX: 4, gridY: 5 };
      } else if (costTotalCnt < 102) {
        pos = { gridX: 7, gridY: 3 };
      } else {
        pos = { gridX: 6, gridY: 3 };
      }

      // 2. 使用道具
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "mergebox_openbox",
        {
          actType: 1,
          pos,
        },
        5000,
      );

      costTotalCnt++;
      lotteryLeftCnt--;
      processedCount++;

      await new Promise((res) => setTimeout(res, 500));
    }

    // 领取累计奖励
    await tokenStore.sendMessageWithPromise(
      tokenId,
      "mergebox_claimcostprogress",
      { actType: 1 },
      5000,
    ).catch(() => {});

    message.success(t("weirdTowerStatus.messages.useItemsCompleted", { count: processedCount }));
    // 刷新一下
    await getTowerInfo();
  } catch (error) {
    message.error(
      t("weirdTowerStatus.messages.useItemsFailed", {
        error: error.message || t("weirdTowerStatus.common.unknownError"),
      }),
    );
  } finally {
    if (itemTimeout.value) {
      clearTimeout(itemTimeout.value);
      itemTimeout.value = null;
    }
    isUsingItems.value = false;
  }
};

const autoMergeItems = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("weirdTowerStatus.messages.selectTokenFirst"));
    return;
  }

  if (isClimbing.value || isUsingItems.value) {
    message.warning(t("weirdTowerStatus.messages.otherActionInProgress"));
    return;
  }

  isMerging.value = true;
  stopMergeFlag = false;

  // 设置超时保护，60秒后自动重置状态
  mergeTimeout.value = setTimeout(() => {
    isMerging.value = false;
    mergeTimeout.value = null;
    stopMergeFlag = true;
    message.info(t("weirdTowerStatus.messages.mergeTimeout"));
  }, 60000);

  try {
    const tokenId = tokenStore.selectedToken.id;
    message.loading(t("weirdTowerStatus.messages.mergingLoading"));

    let loopCount = 0;
    const MAX_LOOPS = 20;

    while (loopCount < MAX_LOOPS && !stopMergeFlag) {
      loopCount++;

      // 获取当前信息
      const infoRes = await tokenStore.sendMessageWithPromise(
        tokenId,
        "mergebox_getinfo",
        { actType: 1 },
        5000,
      );

      if (!infoRes || !infoRes.mergeBox) {
        throw new Error(t("weirdTowerStatus.messages.mergeBoxMissing"));
      }

      // 领取合成奖励
      if (infoRes.mergeBox.taskMap) {
        const taskMap = infoRes.mergeBox.taskMap;
        const taskClaimMap = infoRes.mergeBox.taskClaimMap || {};

        for (const taskId in taskMap) {
          if (stopMergeFlag)
            break;
          if (taskMap[taskId] !== 0 && !taskClaimMap[taskId]) {
            await tokenStore.sendMessageWithPromise(
              tokenId,
              "mergebox_claimmergeprogress",
              { actType: 1, taskId: Number.parseInt(taskId) },
              2000,
            ).catch(() => {});
            await new Promise((res) => setTimeout(res, 500));
          }
        }
      }

      // 解析 gridMap
      const gridMap = infoRes.mergeBox.gridMap || {};
      const items = [];

      // 收集所有 gridConfId === 0 的物品
      for (const xStr in gridMap) {
        for (const yStr in gridMap[xStr]) {
          const item = gridMap[xStr][yStr];
          if (item.gridConfId == 0 && item.gridItemId > 0 && !item.isLock) {
            items.push({
              x: Number.parseInt(xStr),
              y: Number.parseInt(yStr),
              id: item.gridItemId,
            });
          }
        }
      }

      // 按 gridItemId 分组
      const groupedItems = {};
      items.forEach((item) => {
        if (!groupedItems[item.id]) {
          groupedItems[item.id] = [];
        }
        groupedItems[item.id].push(item);
      });

      // 检查是否有可合成项
      let hasPotentialMerge = false;
      for (const id in groupedItems) {
        if (groupedItems[id].length >= 2) {
          hasPotentialMerge = true;
          break;
        }
      }

      if (!hasPotentialMerge) {
        if (loopCount === 1) {
          message.info(t("weirdTowerStatus.messages.noMergeableItems"));
        }
        break;
      }

      const isLevel8OrAbove = infoRes.mergeBox.taskMap && infoRes.mergeBox.taskMap["251212208"] && infoRes.mergeBox.taskMap["251212208"] !== 0;

      if (isLevel8OrAbove) {
        // 8级以上使用智能合成
        await tokenStore.sendMessageWithPromise(
          tokenId,
          "mergebox_automergeitem",
          { actType: 1 },
          10000,
        );
        await new Promise((res) => setTimeout(res, 1500));
      } else {
        // 8级以下手动合成
        for (const id in groupedItems) {
          if (stopMergeFlag)
            break;
          const group = groupedItems[id];
          // 两两合成
          while (group.length >= 2) {
            if (stopMergeFlag)
              break;
            const source = group.shift();
            const target = group.shift();

            await tokenStore.sendMessageWithPromise(
              tokenId,
              "mergebox_mergeitem",
              {
                actType: 1,
                sourcePos: { gridX: source.x, gridY: source.y },
                targetPos: { gridX: target.x, gridY: target.y },
              },
              1000,
            ).catch(() => {});
            await new Promise((res) => setTimeout(res, 300));
          }
        }
      }

      // 继续下一轮循环
      await new Promise((res) => setTimeout(res, 500));
    }

    message.success(t("weirdTowerStatus.messages.mergeCompleted"));
    // 刷新一下
    await getTowerInfo();
  } catch (error) {
    message.error(
      t("weirdTowerStatus.messages.mergeFailed", {
        error: error.message || t("weirdTowerStatus.common.unknownError"),
      }),
    );
  } finally {
    if (mergeTimeout.value) {
      clearTimeout(mergeTimeout.value);
      mergeTimeout.value = null;
    }
    isMerging.value = false;
  }
};

const startTowerClimb = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("weirdTowerStatus.messages.selectTokenFirst"));
    return;
  }

  if (!isWeirdTowerActivityOpen.value) {
    message.warning(t("weirdTowerStatus.messages.activityClosed"));
    return;
  }

  if (!canClimb.value) {
    message.warning(t("weirdTowerStatus.messages.cannotClimb"));
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
    message.info(t("weirdTowerStatus.messages.climbTimeout"));
  }, 60000);

  try {
    const tokenId = tokenStore.selectedToken.id;
    for (let i = 0; i < maxClimb; i++) {
      if (stopFlag)
        break;

      // 检查当前能量
      await getTowerInfo();
      const currentEnergy = towerEnergy.value;
      if (currentEnergy <= 0)
        break;

      // 准备战斗
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "evotower_readyfight",
        {},
        5000,
      );

      // 执行战斗
      const fightResult = await tokenStore.sendMessageWithPromise(
        tokenId,
        "evotower_fight",
        {
          battleNum: 1,
          winNum: 1,
        },
        10000,
      );

      climbCount++;
      message.success(t("weirdTowerStatus.messages.climbCommandSent", { count: climbCount }));

      // 更新爬塔信息
      await getTowerInfo();

      // 检查并领取每日任务奖励
      const towerData = evoTowerInfo.value?.evoTower;
      if (towerData && towerData.taskClaimMap) {
        const now = new Date();
        const year = now.getFullYear().toString().slice(2);
        const month = (now.getMonth() + 1).toString().padStart(2, "0");
        const day = now.getDate().toString().padStart(2, "0");
        const dateKey = `${year}${month}${day}`;

        const dailyTasks = towerData.taskClaimMap[dateKey] || {};
        const taskIds = [1, 2, 3];

        for (const taskId of taskIds) {
          if (!dailyTasks[taskId]) {
            await tokenStore.sendMessageWithPromise(
              tokenId,
              "evotower_claimtask",
              { taskId },
              2000,
            ).then(() => {
              message.success(
                t("weirdTowerStatus.messages.dailyRewardClaimed", {
                  taskId,
                }),
              );
            }).catch(() => {
              // 失败静默，可能是还没达到条件
            });
            // 稍微延时避免请求过快
            await new Promise((r) => setTimeout(r, 200));
          }
        }
      }

      // 检查是否刚通关10层（即当前层是1-1, 2-1, 3-1等）
      const towerId = currentTowerId.value;
      const floor = (towerId % 10) + 1;
      if (
        fightResult
        && fightResult.winList
        && fightResult.winList[0] === true
        && floor === 1
      ) {
        // 领取通关奖励
        await tokenStore.sendMessageWithPromise(
          tokenId,
          "evotower_claimreward",
          {},
          5000,
        );
        message.success(
          t("weirdTowerStatus.messages.chapterRewardClaimed", {
            chapter: Math.floor(towerId / 10),
          }),
        );
      }

      await new Promise((res) => setTimeout(res, 400)); // 每次间隔400毫秒
    }
    // 获取免费道具数量
    const freeEnergyResult = await tokenStore.sendMessageWithPromise(
      tokenId,
      "mergebox_getinfo",
      {
        actType: 1,
      },
      5000,
    );
    if (freeEnergyResult && freeEnergyResult.mergeBox.freeEnergy > 0) {
      // 领取免费道具
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "mergebox_claimfreeenergy",
        {
          actType: 1,
        },
        5000,
      );
      message.success(
        t("weirdTowerStatus.messages.freeItemsClaimed", {
          count: freeEnergyResult.mergeBox.freeEnergy,
        }),
      );
    }
    await new Promise((res) => setTimeout(res, 500));
    message.success(t("weirdTowerStatus.messages.climbCompleted", { count: climbCount }));
  } catch (error) {
    message.error(
      t("weirdTowerStatus.messages.climbFailed", {
        error: error.message || t("weirdTowerStatus.common.unknownError"),
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

const getTowerInfo = async () => {
  if (!tokenStore.selectedToken) {
    return;
  }
  if (!isWeirdTowerActivityOpen.value) {
    return;
  }

  try {
    const tokenId = tokenStore.selectedToken.id;
    // 检查WebSocket连接状态
    const wsStatus = tokenStore.getWebSocketStatus(tokenId);

    if (wsStatus !== "connected") {
      return;
    }
    // 获取怪异塔信息
    await tokenStore.sendMessageWithPromise(
      tokenId,
      "evotower_getinfo",
      {},
      5000,
    );
    // 更新角色信息
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
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
.weird-tower {
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

.weird-tower__toolbar {
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

.weird-tower__actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.climb-button {
  width: 100%;
}

// 响应式设计
@media (max-width: 768px) {
  .weird-tower__toolbar {
    flex-direction: column;
    gap: var(--spacing-sm);
    text-align: center;
  }
}
</style>
