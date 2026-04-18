<template>
  <div
    class="gwb2-mini-card tower-status weird-tower"
    :data-panel-active="panelActive ? 'true' : 'false'"
  >
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

      <div class="gwb2-mini-card__body weird-tower__body">
        <div class="gwb2-mini-card__metric-grid">
          <div class="gwb2-mini-card__metric tower-floor">
            <span class="label">{{ t("weirdTowerStatus.labels.currentFloor") }}</span>
            <span class="floor-number">{{ displayFloor }}</span>
          </div>
          <div class="gwb2-mini-card__metric tower-runtime">
            <span class="label">当前状态</span>
            <span class="runtime-value">{{ runtime.statusText }}</span>
          </div>
        </div>

        <div class="gwb2-mini-card__list tower-runtime-list">
          <div class="runtime-row">
            <span class="runtime-label">执行阶段</span>
            <strong class="runtime-meta">{{ activeModeLabel }}</strong>
          </div>
          <div class="runtime-row">
            <span class="runtime-label">处理次数</span>
            <strong class="runtime-meta">{{ runtime.progressCount }}</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="gwb2-mini-card__actions weird-tower__actions">
      <div class="gwb2-mini-card__action-rail weird-tower__action-rail">
        <n-button
          class="climb-button"
          type="primary"
          :disabled="!canClimb"
          @click="startTowerClimb"
        >
          {{ isClimbing ? t("weirdTowerStatus.actions.climbing") : t("weirdTowerStatus.actions.startClimb") }}
        </n-button>
        <n-button
          v-if="isClimbing"
          secondary
          class="stop-button"
          type="warning"
          @click="stopClimbing"
        >
          {{ t("weirdTowerStatus.actions.stopClimb") }}
        </n-button>
        <n-button
          v-if="!isClimbing && !isUsingItems && !isMerging"
          class="climb-button"
          type="primary"
          :disabled="!canManageItems"
          @click="startUseItems"
        >
          {{ t("weirdTowerStatus.actions.useItems") }}
        </n-button>
        <n-button
          v-if="isUsingItems"
          secondary
          class="stop-button"
          type="warning"
          @click="stopUsingItems"
        >
          {{ t("weirdTowerStatus.actions.stopUsing") }}
        </n-button>
        <n-button
          v-if="!isClimbing && !isUsingItems && !isMerging"
          class="climb-button"
          type="primary"
          :disabled="!canManageItems"
          @click="autoMergeItems"
        >
          {{ isMerging ? t("weirdTowerStatus.actions.merging") : t("weirdTowerStatus.actions.autoMerge") }}
        </n-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, toRef, watch } from "vue";
import { useGameCardPanelActive } from "@/composables/gameCards/useGameCardPanelActive";
import { useGameCardTicker } from "@/composables/gameCards/useGameCardTicker";
import { useTokenStore } from "@/stores/tokenStore";
import {
  getThreeWeekActivityCycle,
  isWeirdTowerActivityOpen as isWeirdTowerActivityWindowOpen,
} from "@/utils/activityWindows";
import {
  claimWeirdTowerChapterReward as claimWeirdTowerChapterRewardFlow,
  isWeirdTowerRewardClaimRetryable,
  resolveWeirdTowerChapterReward,
  resolveWeirdTowerPendingRewardChapter,
} from "@/utils/weirdTowerRewards";
import { createWeirdTowerClimbWatchdog } from "@/utils/weirdTowerClimbWatchdog";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";

const props = defineProps({
  panelActive: {
    type: Boolean,
    default: true,
  },
});

let stopFlag = false;
let stopItemFlag = false;
let stopMergeFlag = false;
let connectRefreshHandle = null;
const pendingTowerInfoRefresh = ref(false);

const stopClimbing = () => {
  stopFlag = true;
  clearClimbWatchdog();
  isClimbing.value = false;
  runtime.activeMode = "idle";
  runtime.statusText = t("weirdTowerStatus.messages.manuallyStoppedClimb");
  message.info(t("weirdTowerStatus.messages.manuallyStoppedClimb"));
};

const stopUsingItems = () => {
  stopItemFlag = true;
  clearTimer(itemTimeout);
  isUsingItems.value = false;
  runtime.activeMode = "idle";
  runtime.statusText = t("weirdTowerStatus.messages.manuallyStoppedItems");
  message.info(t("weirdTowerStatus.messages.manuallyStoppedItems"));
};

const tokenStore = useTokenStore();
const message = useMessage();
const { t } = useI18n();
const { panelActive } = useGameCardPanelActive(toRef(props, "panelActive"));
const { now } = useGameCardTicker({ panelActive });

const isClimbing = ref(false);
const isUsingItems = ref(false);
const isMerging = ref(false);
const climbTimeout = ref(null);
const itemTimeout = ref(null);
const mergeTimeout = ref(null);
const runtime = reactive({
  activeMode: "idle",
  progressCount: 0,
  statusText: t("weirdTowerStatus.subtitle"),
});

const clearTimer = (timerRef) => {
  if (timerRef.value) {
    clearTimeout(timerRef.value);
    timerRef.value = null;
  }
};

const clearClimbWatchdog = () => {
  climbWatchdog.clear();
  climbTimeout.value = null;
};

const refreshClimbWatchdog = () => {
  climbTimeout.value = climbWatchdog.refresh();
};

const runClimbStep = async (step) => {
  const result = await step();
  refreshClimbWatchdog();
  return result;
};

const activeModeLabel = computed(() => {
  if (isClimbing.value)
    return t("weirdTowerStatus.actions.climbing");
  if (isUsingItems.value)
    return t("weirdTowerStatus.actions.useItems");
  if (isMerging.value)
    return t("weirdTowerStatus.actions.merging");
  return "待命";
});

const isBusy = computed(() =>
  isClimbing.value || isUsingItems.value || isMerging.value,
);

const setRuntimeStatus = (text, count = runtime.progressCount) => {
  runtime.statusText = text;
  runtime.progressCount = count;
};

const notifyIfVisible = (type, text) => {
  if (panelActive.value) {
    message[type](text);
  }
};

const climbWatchdog = createWeirdTowerClimbWatchdog({
  onTimeout: () => {
    isClimbing.value = false;
    stopFlag = true;
    runtime.activeMode = "idle";
    setRuntimeStatus(t("weirdTowerStatus.messages.climbTimeout"), runtime.progressCount);
    notifyIfVisible("info", t("weirdTowerStatus.messages.climbTimeout"));
  },
});

const fetchTowerInfoByTokenId = (tokenId) =>
  tokenStore.sendMessageWithPromise(
    tokenId,
    "evotower_getinfo",
    {},
    5000,
  );

const claimChapterRewardAfterFinalFloor = async ({
  chapter,
  tokenId,
}) => {
  const claimedChapter = await claimWeirdTowerChapterRewardFlow({
    chapter,
    getTowerInfo: () => runClimbStep(() => fetchTowerInfoByTokenId(tokenId)),
    claimReward: () =>
      runClimbStep(() =>
        tokenStore.sendMessageWithPromise(
          tokenId,
          "evotower_claimreward",
          {},
          5000,
        )),
  });

  setRuntimeStatus(
    t("weirdTowerStatus.messages.chapterRewardClaimed", { chapter: claimedChapter }),
    runtime.progressCount,
  );
  return claimedChapter;
};

const recoverPendingWeirdTowerReward = async (tokenId) => {
  const latestTowerInfo = await runClimbStep(() => fetchTowerInfoByTokenId(tokenId)).catch(() => null);
  const pendingChapter = resolveWeirdTowerPendingRewardChapter(
    latestTowerInfo?.evoTower || {},
  );

  if (pendingChapter == null) {
    return null;
  }

  const claimedChapter = await claimChapterRewardAfterFinalFloor({
    chapter: pendingChapter,
    tokenId,
  });
  await new Promise((resolve) => setTimeout(resolve, 300));
  return claimedChapter;
};

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

const currentActivityWeek = computed(() =>
  getThreeWeekActivityCycle(new Date(now.value)),
);

const isWeirdTowerActivityOpen = computed(() =>
  isWeirdTowerActivityWindowOpen(
    new Date(now.value),
    currentActivityWeek.value,
  ),
);

const canClimb = computed(() => {
  const activityOpen = isWeirdTowerActivityOpen.value;
  const hasEnergy = towerEnergy.value > 0;
  const notClimbing = !isClimbing.value;
  const notUsingItems = !isUsingItems.value;
  const notMerging = !isMerging.value;
  return activityOpen && hasEnergy && notClimbing && notUsingItems && notMerging;
});

const canManageItems = computed(() =>
  isWeirdTowerActivityOpen.value
  && !isClimbing.value
  && !isUsingItems.value
  && !isMerging.value,
);

const scheduleTowerInfoRefresh = async ({ forceUi = false } = {}) => {
  if (!tokenStore.selectedToken) {
    return;
  }
  if (!panelActive.value && !isBusy.value && !forceUi) {
    pendingTowerInfoRefresh.value = true;
    return;
  }
  pendingTowerInfoRefresh.value = false;
  await getTowerInfo();
};

// 方法
const startUseItems = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("weirdTowerStatus.messages.selectTokenFirst"));
    return;
  }

  if (!isWeirdTowerActivityOpen.value) {
    message.warning(t("weirdTowerStatus.messages.activityClosed"));
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
  runtime.activeMode = "items";
  setRuntimeStatus("正在读取道具信息", 0);

  itemTimeout.value = setTimeout(() => {
    isUsingItems.value = false;
    clearTimer(itemTimeout);
    stopItemFlag = true;
    runtime.activeMode = "idle";
    setRuntimeStatus(t("weirdTowerStatus.messages.useItemsTimeout"), runtime.progressCount);
    notifyIfVisible("info", t("weirdTowerStatus.messages.useItemsTimeout"));
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
      setRuntimeStatus(t("weirdTowerStatus.messages.noItemsLeft"), 0);
      isUsingItems.value = false;
      clearTimer(itemTimeout);
      runtime.activeMode = "idle";
      return;
    }

    setRuntimeStatus(
      t("weirdTowerStatus.messages.useItemsStarted", {
        remaining: lotteryLeftCnt,
        used: costTotalCnt,
      }),
      0,
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
      setRuntimeStatus(`已使用 ${processedCount} 个道具`, processedCount);

      await new Promise((res) => setTimeout(res, 500));
    }

    // 领取累计奖励
    await tokenStore.sendMessageWithPromise(
      tokenId,
      "mergebox_claimcostprogress",
      { actType: 1 },
      5000,
    ).catch(() => {});

    setRuntimeStatus(t("weirdTowerStatus.messages.useItemsCompleted", { count: processedCount }), processedCount);
    notifyIfVisible("success", t("weirdTowerStatus.messages.useItemsCompleted", { count: processedCount }));
    await getTowerInfo();
  } catch (error) {
    setRuntimeStatus(
      t("weirdTowerStatus.messages.useItemsFailed", {
        error: error.message || t("weirdTowerStatus.common.unknownError"),
      }),
      runtime.progressCount,
    );
    message.error(
      t("weirdTowerStatus.messages.useItemsFailed", {
        error: error.message || t("weirdTowerStatus.common.unknownError"),
      }),
    );
  } finally {
    clearTimer(itemTimeout);
    isUsingItems.value = false;
    runtime.activeMode = "idle";
  }
};

const autoMergeItems = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("weirdTowerStatus.messages.selectTokenFirst"));
    return;
  }

  if (!isWeirdTowerActivityOpen.value) {
    message.warning(t("weirdTowerStatus.messages.activityClosed"));
    return;
  }

  if (isClimbing.value || isUsingItems.value) {
    message.warning(t("weirdTowerStatus.messages.otherActionInProgress"));
    return;
  }

  isMerging.value = true;
  stopMergeFlag = false;
  runtime.activeMode = "merge";
  setRuntimeStatus("正在分析可合成物品", 0);

  mergeTimeout.value = setTimeout(() => {
    isMerging.value = false;
    clearTimer(mergeTimeout);
    stopMergeFlag = true;
    runtime.activeMode = "idle";
    setRuntimeStatus(t("weirdTowerStatus.messages.mergeTimeout"), runtime.progressCount);
    notifyIfVisible("info", t("weirdTowerStatus.messages.mergeTimeout"));
  }, 60000);

  try {
    const tokenId = tokenStore.selectedToken.id;
    setRuntimeStatus(t("weirdTowerStatus.messages.mergingLoading"), 0);

    let loopCount = 0;
    const MAX_LOOPS = 20;

    while (loopCount < MAX_LOOPS && !stopMergeFlag) {
      loopCount++;
      setRuntimeStatus(`正在执行第 ${loopCount} 轮合成检查`, loopCount);

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
          setRuntimeStatus(t("weirdTowerStatus.messages.noMergeableItems"), 0);
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

      setRuntimeStatus(`已完成第 ${loopCount} 轮合成`, loopCount);
      await new Promise((res) => setTimeout(res, 500));
    }

    setRuntimeStatus(t("weirdTowerStatus.messages.mergeCompleted"), loopCount);
    notifyIfVisible("success", t("weirdTowerStatus.messages.mergeCompleted"));
    await getTowerInfo();
  } catch (error) {
    setRuntimeStatus(
      t("weirdTowerStatus.messages.mergeFailed", {
        error: error.message || t("weirdTowerStatus.common.unknownError"),
      }),
      runtime.progressCount,
    );
    message.error(
      t("weirdTowerStatus.messages.mergeFailed", {
        error: error.message || t("weirdTowerStatus.common.unknownError"),
      }),
    );
  } finally {
    clearTimer(mergeTimeout);
    isMerging.value = false;
    runtime.activeMode = "idle";
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

  clearClimbWatchdog();

  isClimbing.value = true;
  stopFlag = false;
  runtime.activeMode = "climb";
  setRuntimeStatus("正在准备战斗", 0);
  let climbCount = 0;
  const maxClimb = 100;
  refreshClimbWatchdog();

  try {
    const tokenId = tokenStore.selectedToken.id;
    for (let i = 0; i < maxClimb; i++) {
      if (stopFlag)
        break;
      try {
        const towerInfoBeforeFight = await runClimbStep(() => fetchTowerInfoByTokenId(tokenId));
        const currentEnergy = towerInfoBeforeFight?.evoTower?.energy || 0;
        const preFightTowerId = towerInfoBeforeFight?.evoTower?.towerId || 0;
        if (currentEnergy <= 0)
          break;
        setRuntimeStatus(`正在执行第 ${climbCount + 1} 次挑战`, climbCount);

        await runClimbStep(() =>
          tokenStore.sendMessageWithPromise(
            tokenId,
            "evotower_readyfight",
            {},
            5000,
          ));

        const fightResult = await runClimbStep(() =>
          tokenStore.sendMessageWithPromise(
            tokenId,
            "evotower_fight",
            {
              battleNum: 1,
              winNum: 1,
            },
            10000,
          ));

        climbCount++;
        setRuntimeStatus(`已完成 ${climbCount} 次挑战`, climbCount);

        const rewardContext = resolveWeirdTowerChapterReward({
          fightResult,
          preFightTowerId,
        });
        if (rewardContext.shouldClaim) {
          await claimChapterRewardAfterFinalFloor(
            {
              chapter: rewardContext.chapter,
              tokenId,
            },
          );
          await new Promise((resolve) => setTimeout(resolve, 300));
        }

        const towerInfoAfterFight = await runClimbStep(() => fetchTowerInfoByTokenId(tokenId));
        const towerData = towerInfoAfterFight?.evoTower;
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
              await runClimbStep(() =>
                tokenStore.sendMessageWithPromise(
                  tokenId,
                  "evotower_claimtask",
                  { taskId },
                  2000,
                )).catch(() => {});
              await new Promise((r) => setTimeout(r, 200));
            }
          }
        }

        await new Promise((res) => setTimeout(res, 400));
      } catch (error) {
        if (isWeirdTowerRewardClaimRetryable(error)) {
          const recoveredChapter = await recoverPendingWeirdTowerReward(tokenId).catch(() => null);
          if (recoveredChapter != null) {
            continue;
          }
        }
        throw error;
      }
    }
    const freeEnergyResult = await runClimbStep(() =>
      tokenStore.sendMessageWithPromise(
        tokenId,
        "mergebox_getinfo",
        {
          actType: 1,
        },
        5000,
      ));
    if (freeEnergyResult && freeEnergyResult.mergeBox.freeEnergy > 0) {
      await runClimbStep(() =>
        tokenStore.sendMessageWithPromise(
          tokenId,
          "mergebox_claimfreeenergy",
          {
            actType: 1,
          },
          5000,
        ));
      setRuntimeStatus(
        t("weirdTowerStatus.messages.freeItemsClaimed", {
          count: freeEnergyResult.mergeBox.freeEnergy,
        }),
        climbCount,
      );
    }
    await new Promise((res) => setTimeout(res, 500));
    if (!stopFlag) {
      setRuntimeStatus(t("weirdTowerStatus.messages.climbCompleted", { count: climbCount }), climbCount);
      notifyIfVisible("success", t("weirdTowerStatus.messages.climbCompleted", { count: climbCount }));
    }
  } catch (error) {
    setRuntimeStatus(
      t("weirdTowerStatus.messages.climbFailed", {
        error: error.message || t("weirdTowerStatus.common.unknownError"),
      }),
      runtime.progressCount,
    );
    message.error(
      t("weirdTowerStatus.messages.climbFailed", {
        error: error.message || t("weirdTowerStatus.common.unknownError"),
      }),
    );
  }

  clearClimbWatchdog();
  isClimbing.value = false;
  runtime.activeMode = "idle";
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
    const wsStatus = tokenStore.getWebSocketStatus(tokenId);

    if (wsStatus !== "connected") {
      return;
    }
    await tokenStore.sendMessageWithPromise(
      tokenId,
      "evotower_getinfo",
      {},
      5000,
    );
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
  } catch {}
};

// 监听WebSocket连接状态变化
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

// 监听选中Token变化
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

watch(isWeirdTowerActivityOpen, (open, previousOpen) => {
  if (open && !previousOpen) {
    scheduleTowerInfoRefresh();
  }
});

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
  if (!isBusy.value) {
    clearClimbWatchdog();
    clearTimer(itemTimeout);
    clearTimer(mergeTimeout);
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
  min-height: 240px;
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

.weird-tower__body {
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
  .weird-tower__toolbar {
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
