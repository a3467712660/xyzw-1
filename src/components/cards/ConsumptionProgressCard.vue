<template>
  <div class="consumption-progress-card-shell">
    <MyCard
      class="consumption-progress-card"
      :panel-active="panelActive"
      :status-class="statusClass"
    >
      <template #icon>
        <span class="consumption-progress-card__icon">📊</span>
      </template>
      <template #title>
        <h3>消耗活动进度</h3>
        <p>按需计算补齐方案，避免主界面常驻大枚举</p>
      </template>
      <template #badge>
        <span>{{ plannerSummaryText }}</span>
      </template>
      <template #default>
        <div class="gwb2-mini-card__stack">
          <div class="gwb2-mini-card__metric-grid summary-grid">
            <div class="gwb2-mini-card__metric summary-cell">
              <span class="summary-label">黄金道具数量</span>
              <strong class="summary-value">{{ ActivityGoldItem }}</strong>
              <span class="summary-meta">
                还需 {{ remainingGoldNeeded }} / 获取率 {{ Math.floor((1 / goldRateUsed) * 1000) / 1000 }}
              </span>
            </div>
            <div class="gwb2-mini-card__metric summary-cell">
              <span class="summary-label">普通道具累计</span>
              <strong class="summary-value">{{ totalObtained }}</strong>
              <span class="summary-meta">库存剩余 {{ ActivityItem }}</span>
            </div>
            <div class="gwb2-mini-card__metric summary-cell">
              <span class="summary-label">补齐缺口</span>
              <strong class="summary-value">{{ remainingOrdNeeded }}</strong>
              <span class="summary-meta">库存 {{ ActivityItem }} 已计入</span>
            </div>
            <div class="gwb2-mini-card__metric summary-cell summary-cell--muted">
              <span class="summary-label">方案状态</span>
              <strong class="summary-value">{{ plannerSummaryText }}</strong>
              <span class="summary-meta">{{ plannerSummaryMeta }}</span>
            </div>
          </div>

          <div class="gwb2-mini-card__control-grid consumption-controls">
            <span class="label">使用数量</span>
            <n-input-number
              size="small"
              v-model:value="Activitynumber"
              :min="1"
              :step="1"
            ></n-input-number>
          </div>

          <div v-if="!hasActivityData" class="gwb2-mini-card__empty empty-state">
            暂无活动数据
          </div>
          <div v-else class="gwb2-mini-card__list progress-list">
            <div v-for="item in progressList" :key="item.id" class="progress-item">
              <div class="item-header">
                <span class="item-name">{{ item.name }}</span>
                <span class="item-values">
                  <span class="current">{{ item.current }}</span>
                  <span class="separator">/</span>
                  <span class="target">{{ item.nextTarget }}</span>
                </span>
              </div>
              <n-progress
                rail-color="rgba(0, 0, 0, 0.06)"
                type="line"
                :color="item.isCompleted ? '#52c41a' : '#1890ff'"
                :height="8"
                :percentage="item.percentage"
                :show-indicator="false"
              ></n-progress>
              <div class="item-footer">
                <span v-if="!item.isCompleted" class="next-reward">
                  下一档: {{ item.nextTarget }} (还需 {{ item.nextTarget - item.current }})
                </span>
                <span v-else class="completed-text">已完成所有档位</span>
                <span v-if="item.obtainedItems > 0" class="obtained-items">
                  已获得道具: {{ item.obtainedItems }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
      <template #action>
        <div class="gwb2-mini-card__action-rail consumption-actions">
          <n-button
            size="small"
            type="primary"
            :disabled="state.isRunning"
            @click="OpenActivityItem"
          >
            打开普通道具
          </n-button>
          <n-button
            size="small"
            :disabled="!hasActivityData"
            @click="openComboPlans"
          >
            查看方案
          </n-button>
          <n-button
            size="small"
            :disabled="!hasActivityData || comboLoading"
            @click="recalculateCombos"
          >
            {{ comboLoading ? "计算中..." : "重新计算" }}
          </n-button>
        </div>
      </template>
    </MyCard>

    <n-modal
      v-if="!isMobile"
      class="consumption-progress__modal"
      preset="card"
      v-model:show="showCombosPanel"
    >
      <template #header>
        <h3>可行方案（按总普通道具升序）</h3>
      </template>
      <div class="cp-modal-scroll">
        <div class="combo-toolbar">
          <span class="combo-summary">{{ plannerSummaryMeta }}</span>
          <n-button
            size="small"
            :disabled="!hasActivityData || comboLoading"
            @click="recalculateCombos"
          >
            {{ comboLoading ? "计算中..." : "重新计算" }}
          </n-button>
        </div>
        <div v-if="comboLoading" class="combo-empty">方案计算中，请稍候...</div>
        <div v-else-if="comboList.length === 0" class="combo-empty">{{ comboEmptyText }}</div>
        <div v-else class="combo-list">
          <div
            v-for="(combo, idx) in comboList"
            :key="idx"
            class="combo-item"
          >
            <div class="combo-title">
              <strong>方案 {{ idx + 1 }} : {{ combo.totalOrd }} 档</strong>
            </div>
            <ol class="combo-steps">
              <li
                v-for="step in combo.combo"
                :key="`${step.id}-${step.threshold}`"
              >
                {{ step.name }} -> 达到 {{ step.threshold }} (可得 {{ step.delta }} 普通道具, 还需消耗 {{ step.cost }})
              </li>
            </ol>
          </div>
        </div>
      </div>
      <template #footer>
        <n-space align="center" justify="end">
          <n-button @click="showCombosPanel = false">关闭</n-button>
        </n-space>
      </template>
    </n-modal>

    <n-drawer
      v-else
      height="84vh"
      placement="bottom"
      v-model:show="showCombosPanel"
    >
      <n-drawer-content closable title="可行方案">
        <div class="cp-modal-scroll">
          <div class="combo-toolbar">
            <span class="combo-summary">{{ plannerSummaryMeta }}</span>
            <n-button
              size="small"
              :disabled="!hasActivityData || comboLoading"
              @click="recalculateCombos"
            >
              {{ comboLoading ? "计算中..." : "重新计算" }}
            </n-button>
          </div>
          <div v-if="comboLoading" class="combo-empty">方案计算中，请稍候...</div>
          <div v-else-if="comboList.length === 0" class="combo-empty">{{ comboEmptyText }}</div>
          <div v-else class="combo-list">
            <div
              v-for="(combo, idx) in comboList"
              :key="idx"
              class="combo-item"
            >
              <div class="combo-title">
                <strong>方案 {{ idx + 1 }} : {{ combo.totalOrd }} 档</strong>
              </div>
              <ol class="combo-steps">
                <li
                  v-for="step in combo.combo"
                  :key="`${step.id}-${step.threshold}`"
                >
                  {{ step.name }} -> 达到 {{ step.threshold }} (可得 {{ step.delta }} 普通道具, 还需消耗 {{ step.cost }})
                </li>
              </ol>
            </div>
          </div>
        </div>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, toRef, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useResponsive } from "@/composables/useResponsive";
import { useConsumptionComboPlanner } from "@/composables/gameCards/useConsumptionComboPlanner";
import { useGameCardPanelActive } from "@/composables/gameCards/useGameCardPanelActive";
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
const { isMobile } = useResponsive();
const { panelActive } = useGameCardPanelActive(toRef(props, "panelActive"));
const {
  cancel: cancelComboPlanner,
  getCached,
  loading: comboLoading,
  makeSignature,
  results: comboResults,
  runPlanner,
} = useConsumptionComboPlanner();

const state = ref({
  isRunning: false,
});

const Activitynumber = ref(4);
const pendingRefresh = ref(false);
const showCombosPanel = ref(false);
const cachedComboCount = ref(0);
const comboResultsSignature = ref("");
// 消耗任务ID定义
const ConsumptionTaskID = {
  招募: 1,
  宝箱: 2,
  捕获: 3,
  盐罐: 4,
  金砖: 5,
};

// 任务名称映射
const TaskNames = {
  [ConsumptionTaskID.招募]: "招募",
  [ConsumptionTaskID.宝箱]: "宝箱",
  [ConsumptionTaskID.捕获]: "捕获",
  [ConsumptionTaskID.盐罐]: "盐罐",
  [ConsumptionTaskID.金砖]: "金砖",
};

// 任务档位配置 (参考 ConsumptionTask.ts)
const missionTypes = {
  [ConsumptionTaskID.招募]: [
    { num: 80 },
    { num: 160 },
    { num: 240 },
    { num: 320 },
    { num: 400 },
    { num: 560 },
    { num: 720 },
    { num: 880 },
    { num: 1040 },
    { num: 1200 },
    { num: 1440 },
    { num: 1680 },
    { num: 1920 },
    { num: 2160 },
    { num: 2400 },
    { num: 2720 },
    { num: 3040 },
    { num: 3360 },
    { num: 3680 },
    { num: 4000 },
  ],
  [ConsumptionTaskID.宝箱]: [
    { num: 2000 },
    { num: 4000 },
    { num: 6000 },
    { num: 8000 },
    { num: 10000 },
    { num: 14000 },
    { num: 18000 },
    { num: 22000 },
    { num: 26000 },
    { num: 30000 },
    { num: 36000 },
    { num: 42000 },
    { num: 48000 },
    { num: 54000 },
    { num: 60000 },
    { num: 68000 },
    { num: 76000 },
    { num: 84000 },
    { num: 92000 },
    { num: 100000 },
  ],
  [ConsumptionTaskID.捕获]: [
    { num: 25 },
    { num: 50 },
    { num: 75 },
    { num: 125 },
    { num: 175 },
    { num: 225 },
    { num: 300 },
    { num: 375 },
    { num: 450 },
    { num: 525 },
    { num: 625 },
    { num: 725 },
    { num: 825 },
    { num: 925 },
    { num: 1050 },
    { num: 1175 },
    { num: 1300 },
    { num: 1450 },
    { num: 1600 },
    { num: 1750 },
  ],
  [ConsumptionTaskID.盐罐]: [
    { num: 3 },
    { num: 6 },
    { num: 9 },
    { num: 12 },
    { num: 15 },
    { num: 18 },
    { num: 21 },
    { num: 24 },
    { num: 27 },
    { num: 30 },
    { num: 33 },
    { num: 36 },
    { num: 39 },
    { num: 42 },
    { num: 45 },
    { num: 48 },
    { num: 51 },
    { num: 54 },
    { num: 57 },
    { num: 60 },
  ],
  [ConsumptionTaskID.金砖]: [
    { num: 10000 },
    { num: 20000 },
    { num: 30000 },
    { num: 40000 },
    { num: 50000 },
    { num: 70000 },
    { num: 90000 },
    { num: 110000 },
    { num: 130000 },
    { num: 150000 },
    { num: 180000 },
    { num: 210000 },
    { num: 240000 },
    { num: 270000 },
    { num: 300000 },
    { num: 340000 },
    { num: 380000 },
    { num: 420000 },
    { num: 460000 },
    { num: 500000 },
  ],
};

const rewardConfigs = {
  [ConsumptionTaskID.招募]: [
    { num: 8 },
    { num: 8 },
    { num: 8 },
    { num: 8 },
    { num: 8 },
    { num: 16 },
    { num: 16 },
    { num: 16 },
    { num: 16 },
    { num: 16 },
    { num: 24 },
    { num: 24 },
    { num: 24 },
    { num: 24 },
    { num: 24 },
    { num: 32 },
    { num: 32 },
    { num: 32 },
    { num: 32 },
    { num: 32 },
  ],
  [ConsumptionTaskID.宝箱]: [
    { num: 4 },
    { num: 4 },
    { num: 4 },
    { num: 4 },
    { num: 4 },
    { num: 8 },
    { num: 8 },
    { num: 8 },
    { num: 8 },
    { num: 8 },
    { num: 12 },
    { num: 12 },
    { num: 12 },
    { num: 12 },
    { num: 12 },
    { num: 16 },
    { num: 16 },
    { num: 16 },
    { num: 16 },
    { num: 16 },
  ],
  [ConsumptionTaskID.捕获]: [
    { num: 4 },
    { num: 4 },
    { num: 4 },
    { num: 8 },
    { num: 8 },
    { num: 8 },
    { num: 12 },
    { num: 12 },
    { num: 12 },
    { num: 12 },
    { num: 16 },
    { num: 16 },
    { num: 16 },
    { num: 16 },
    { num: 20 },
    { num: 20 },
    { num: 20 },
    { num: 24 },
    { num: 24 },
    { num: 24 },
  ],
  [ConsumptionTaskID.盐罐]: [
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
    { num: 1 },
  ],
  [ConsumptionTaskID.金砖]: [
    { num: 3 },
    { num: 3 },
    { num: 3 },
    { num: 3 },
    { num: 3 },
    { num: 6 },
    { num: 6 },
    { num: 6 },
    { num: 6 },
    { num: 6 },
    { num: 9 },
    { num: 9 },
    { num: 9 },
    { num: 9 },
    { num: 9 },
    { num: 12 },
    { num: 12 },
    { num: 12 },
    { num: 12 },
    { num: 12 },
  ],
};

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);
const ActivityItem = computed(
  () => roleInfo.value?.role?.items?.[5261]?.quantity || 0,
);
const ActivityGoldItem = computed(
  () => roleInfo.value?.role?.items?.[5262]?.quantity || 0,
);
const commonActivityInfo = computed(() => {
  const data = tokenStore.gameData?.commonActivityInfo;
  return data?.activity?.commonActivityInfo || data?.commonActivityInfo || {};
});

const selectedTokenId = computed(() =>
  tokenStore.selectedToken ? String(tokenStore.selectedToken.id) : "",
);

const wsStatus = computed(() => {
  if (!selectedTokenId.value) {
    return "disconnected";
  }
  return tokenStore.getWebSocketStatus(selectedTokenId.value);
});

const activityEntry = computed(() =>
  Object.entries(commonActivityInfo.value || {}).find(([, activity]) => {
    if (!activity?.task) {
      return false;
    }

    return Object.keys(activity.task).some((key) => {
      const id = Number(key);
      return id >= 1 && id <= 5;
    });
  }) || null,
);

const activityKey = computed(() => activityEntry.value?.[0] || "");
const activityData = computed(() => activityEntry.value?.[1] || null);
const hasActivityData = computed(() => Boolean(activityData.value));

const fetchActivityData = () => {
  if (!selectedTokenId.value || wsStatus.value !== "connected") {
    return;
  }

  tokenStore.sendMessage(tokenStore.selectedToken.id, "activity_get");
  pendingRefresh.value = false;
};

const OpenActivityItem = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return;
  }
  const tokenId = tokenStore.selectedToken.id;
  state.value.isRunning = true;
  message.info("道具开启中");
  try {
    await tokenStore.sendMessageWithPromise(tokenId, "item_openpack", {
      itemId: 5261,
      index: 0,
      number: Activitynumber.value,
    });
    await tokenStore.sendMessage(tokenId, "role_getroleinfo");
    message.success("道具开启完毕");
  } finally {
    state.value.isRunning = false;
  }
};

const progressList = computed(() => {
  if (!activityData.value) return [];

  const tasks = activityData.value.task || {};

  const calcObtainedForTask = (id, consumed) => {
    const rewardCfg = rewardConfigs[id];
    if (!rewardCfg || !rewardCfg.length || !consumed || consumed <= 0) return 0;

    const missionCfg = missionTypes[id] || [];
    let completedRounds = 0;
    for (let i = 0; i < missionCfg.length; i += 1) {
      const threshold = missionCfg[i]?.num || 0;
      if (consumed >= threshold) {
        completedRounds += 1;
      } else {
        break;
      }
    }

    const len = rewardCfg.length;
    const lastVal = rewardCfg[len - 1]?.num || 0;
    let total = 0;
    for (let i = 0; i < completedRounds; i += 1) {
      if (i < len) {
        total += rewardCfg[i]?.num || 0;
      } else {
        total += lastVal;
      }
    }

    return total;
  };

  return Object.keys(TaskNames).map((key) => {
    const id = Number(key);
    const current = tasks[id] || 0;
    const configs = missionTypes[id] || [];

    let nextTarget = 0;
    let isCompleted = false;

    const nextConfig = configs.find((c) => c.num > current);
    if (nextConfig) {
      nextTarget = nextConfig.num;
    } else {
      if (configs.length > 0) {
        nextTarget = configs[configs.length - 1].num;
        isCompleted = true;
      }
    }

    let percentage = 0;
    if (isCompleted) {
      percentage = 100;
    } else if (nextTarget > 0) {
      percentage = Math.min(100, (current / nextTarget) * 100);
    }

    return {
      id,
      name: TaskNames[id],
      current,
      nextTarget,
      percentage,
      isCompleted,
      obtainedItems: calcObtainedForTask(id, current),
    };
  });
});

const totalObtained = computed(() => {
  return progressList.value.reduce((s, it) => s + (it.obtainedItems || 0), 0);
});

const targetGold = ref(250);
const defaultGoldRate = 4;

const currentGold = computed(() => ActivityGoldItem.value || 0);
const remainingGoldNeeded = computed(() =>
  Math.max(0, targetGold.value - currentGold.value),
);

const goldRateObserved = computed(() => {
  const g = currentGold.value || 0;
  const o = totalObtained.value || 0;
  const s = ActivityItem.value || 0;
  if (g > 0 && o > 0 && o > s) {
    return (o - s) / g;
  }
  return null;
});

const goldRateUsed = computed(() => {
  return goldRateObserved.value || defaultGoldRate;
});

const neededOrd = computed(
  () => remainingGoldNeeded.value * (goldRateUsed.value || defaultGoldRate),
);

const currentOrdStock = computed(() => ActivityItem.value || 0);
const remainingOrdNeeded = computed(() =>
  Math.max(0, Math.ceil(neededOrd.value - currentOrdStock.value)),
);

const plannerSnapshot = computed(() => {
  if (!hasActivityData.value) {
    return null;
  }

  return {
    activityKey: activityKey.value,
    currentGold: currentGold.value,
    currentOrdStock: currentOrdStock.value,
    goldRateUsed: goldRateUsed.value,
    missionTypes,
    progressItems: progressList.value.map((item) => ({
      current: item.current,
      id: item.id,
      name: item.name,
    })),
    remainingOrdNeeded: remainingOrdNeeded.value,
    rewardConfigs,
    totalObtained: totalObtained.value,
  };
});

const plannerSignature = computed(() => makeSignature(plannerSnapshot.value));

const statusClass = computed(() => {
  if (comboLoading.value || state.value.isRunning) {
    return "active";
  }

  if (hasActivityData.value && remainingOrdNeeded.value <= 0) {
    return "completed";
  }

  return "";
});

const plannerSummaryText = computed(() => {
  if (!hasActivityData.value) {
    return "待刷新";
  }

  if (remainingOrdNeeded.value <= 0) {
    return "已满足目标";
  }

  if (comboLoading.value) {
    return "计算中";
  }

  if (cachedComboCount.value > 0) {
    return `已缓存 ${cachedComboCount.value} 条`;
  }

  return "待计算";
});

const plannerSummaryMeta = computed(() => {
  if (!hasActivityData.value) {
    return "活动数据加载后可生成方案";
  }

  if (remainingOrdNeeded.value <= 0) {
    return "当前库存和进度已满足目标";
  }

  if (comboLoading.value) {
    return "正在异步生成前 50 条最优方案";
  }

  if (cachedComboCount.value > 0) {
    return `当前输入已命中缓存 ${cachedComboCount.value} 条`;
  }

  return "打开方案面板后按需计算";
});

const comboEmptyText = computed(() => {
  if (!hasActivityData.value) {
    return "暂无可计算的活动数据";
  }

  if (remainingOrdNeeded.value <= 0) {
    return "目标已满足，无需补齐方案";
  }

  return "暂无可行组合";
});

const comboList = computed(() => {
  if (comboResultsSignature.value === plannerSignature.value) {
    return comboResults.value;
  }

  return getCached(plannerSignature.value, { touch: false }) || [];
});

const syncCachedComboCount = () => {
  const cached = getCached(plannerSignature.value, { touch: false });
  cachedComboCount.value = cached?.length || 0;
};

const ensureComboPlans = async ({ force = false } = {}) => {
  if (!hasActivityData.value || !panelActive.value) {
    return [];
  }

  const signature = plannerSignature.value;
  if (!signature) {
    comboResultsSignature.value = "";
    cachedComboCount.value = 0;
    return [];
  }

  const results = await runPlanner(plannerSnapshot.value, { force });
  if (panelActive.value && plannerSignature.value === signature) {
    comboResultsSignature.value = signature;
    syncCachedComboCount();
  }
  return results;
};

const openComboPlans = async () => {
  showCombosPanel.value = true;
  await ensureComboPlans();
};

const recalculateCombos = async () => {
  await ensureComboPlans({ force: true });
};

watch(
  [selectedTokenId, wsStatus],
  ([tokenId, status], [prevTokenId, prevStatus]) => {
    const tokenChanged = tokenId !== prevTokenId;
    const connectionRestored = status === "connected" && prevStatus !== "connected";

    if (tokenChanged) {
      showCombosPanel.value = false;
      comboResultsSignature.value = "";
      cancelComboPlanner();
      cachedComboCount.value = 0;
      pendingRefresh.value = Boolean(tokenId);
    }

    if (tokenId && status === "connected" && (tokenChanged || connectionRestored)) {
      if (panelActive.value) {
        fetchActivityData();
      } else {
        pendingRefresh.value = true;
      }
    }
  },
  { immediate: true },
);

watch(
  plannerSignature,
  async () => {
    syncCachedComboCount();
    if (showCombosPanel.value && panelActive.value) {
      await ensureComboPlans();
    }
  },
  { immediate: true },
);

watch(
  panelActive,
  async (active) => {
    if (!active) {
      cancelComboPlanner();
      return;
    }

    if (pendingRefresh.value) {
      fetchActivityData();
    }

    if (showCombosPanel.value) {
      await ensureComboPlans();
    }
  },
  { immediate: true },
);

watch(showCombosPanel, async (show) => {
  if (!show) {
    cancelComboPlanner();
    syncCachedComboCount();
    return;
  }

  await ensureComboPlans();
});

onBeforeUnmount(() => {
  cancelComboPlanner();
});
</script>

<style scoped lang="scss">
.consumption-progress-card__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1.3rem;
}

.consumption-progress-card-shell,
.consumption-progress-card {
  height: 100%;
}

.summary-grid {
  align-items: stretch;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.summary-cell {
  align-items: stretch;
  min-width: 0;
}

.summary-cell--muted {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(214, 224, 234, 0.18)),
    rgba(224, 233, 241, 0.62);
}

.summary-label {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.summary-value {
  color: var(--text-primary);
  font-family: var(--font-family-mono);
  font-size: 1rem;
  font-weight: 700;
}

.summary-meta {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  overflow-wrap: anywhere;
}

.consumption-controls {
  align-items: center;
}

.empty-state {
  min-height: 100px;
  justify-content: center;
}

.progress-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-md);
}

.progress-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(78, 94, 116, 0.1);
}

.progress-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.consumption-controls :deep(.n-input-number) {
  width: 120px;
}

.consumption-controls .label {
  color: var(--text-tertiary);
  font-weight: 600;
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.consumption-actions {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm);

  .item-name {
    font-weight: 500;
    color: var(--text-primary);
  }

  .item-values {
    font-family: var(--font-mono);

    .current {
      color: var(--primary-color);
      font-weight: 600;
    }

    .separator {
      margin: 0 2px;
      color: var(--text-tertiary);
    }

    .target {
      color: var(--text-secondary);
    }
  }
}

.item-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
  font-size: 11px;

  .next-reward {
    color: var(--text-tertiary);
  }

  .completed-text {
    color: #52c41a;
  }
}
.obtained-items {
  color: var(--primary-color);
  font-weight: 600;
}

.combo-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-md);
}

.combo-summary {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.combo-empty {
  color: var(--text-secondary);
}

.combo-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.combo-item {
  padding-bottom: 12px;
  border-bottom: 1px solid rgba(78, 94, 116, 0.1);
}

.combo-item:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.combo-title {
  margin-bottom: 6px;
}

.combo-steps {
  margin: 0;
  padding-left: 18px;
}

.cp-modal-scroll {
  max-height: 60vh;
  overflow-y: auto;
  padding-right: 8px;
}

.cp-modal-scroll::-webkit-scrollbar {
  width: 10px;
}

.cp-modal-scroll::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 6px;
}

.cp-modal-scroll::-webkit-scrollbar-track {
  background: transparent;
}

@media (max-width: 1279px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .progress-list,
  .consumption-actions {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 959px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }

  .consumption-controls {
    flex-direction: column;
    align-items: stretch;
  }

  .consumption-controls :deep(.n-input-number) {
    width: 100%;
  }

  .item-header,
  .item-footer,
  .combo-toolbar {
    flex-direction: column;
    align-items: flex-start;
  }

  .cp-modal-scroll {
    max-height: none;
    padding-right: 0;
  }

  .consumption-actions {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
