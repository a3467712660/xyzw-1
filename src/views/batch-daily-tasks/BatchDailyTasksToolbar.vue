<template>
  <n-card class="mt-16 batch-toolbar-card">
    <template #header>
      <div class="batch-toolbar-card__header">
        <div>
          <span class="batch-toolbar-card__eyebrow">批量功能</span>
          <h3>按任务域快速执行</h3>
          <p>按任务类型查看开放状态并执行批量操作。</p>
        </div>
        <div class="batch-toolbar-card__summary">
          <span>当前已选账号</span>
          <strong>{{ selectedTokenCount }}</strong>
        </div>
      </div>
    </template>

    <n-tabs animated class="task-tabs batch-toolbar-tabs" type="line">
      <n-tab-pane
        v-for="group in taskGroups"
        :key="group.name"
        :name="group.name"
        :tab="group.label"
      >
        <div class="toolbar-pane">
          <div class="toolbar-pane__meta">
            <p>{{ group.description }}</p>
            <span
              v-if="getGroupStatusText(group)"
              class="toolbar-pane__status"
              :class="`is-${getGroupStatusTone(group)}`"
            >
              {{ getGroupStatusText(group) }}
            </span>
          </div>

          <div class="toolbar-pane__grid">
            <n-button
              v-for="item in group.items"
              :key="item.key"
              class="toolbar-action-button"
              size="small"
              :disabled="isDisabled(item)"
              :title="getActionTitle(item)"
              @click="handleAction(item)"
            >
              {{ item.label }}
            </n-button>
          </div>
        </div>
      </n-tab-pane>
    </n-tabs>
  </n-card>
</template>

<script setup>
const props = defineProps({
  isBaokuActivityOpen: {
    type: Boolean,
    default: false,
  },
  isCarActivityOpen: {
    type: Boolean,
    default: false,
  },
  isRunning: {
    type: Boolean,
    default: false,
  },
  isWeirdTowerActivityOpen: {
    type: Boolean,
    default: false,
  },
  isWarGuessActivityOpen: {
    type: Boolean,
    default: false,
  },
  isarenaActivityOpen: {
    type: Boolean,
    default: false,
  },
  ismengjingActivityOpen: {
    type: Boolean,
    default: false,
  },
  selectedTokenCount: {
    type: Number,
    default: 0,
  },
  warGuessActivityTip: {
    type: String,
    default: "",
  },
});

const emit = defineEmits([
  "open-helper",
  "open-legacy-gift",
  "open-war-guess",
  "run-action",
]);

const taskGroups = [
  {
    name: "daily",
    label: "日常",
    description: "高频日常、挂机补领、活动入口和基础资源领取。",
    items: [
      { key: "claimHangUpRewards", label: "领取挂机" },
      { key: "batchAddHangUpTime", label: "一键加钟" },
      { key: "resetBottles", label: "重置罐子" },
      { key: "batchlingguanzi", label: "一键领取罐子" },
      { key: "batchclubsign", label: "一键俱乐部签到" },
      { key: "batchClaimMailAttachment", label: "一键领邮件" },
      { key: "batchStudy", label: "一键答题" },
      {
        key: "batcharenafight",
        label: "一键竞技场战斗3次",
        activityFlag: "isarenaActivityOpen",
      },
      {
        key: "batchSmartSendCar",
        label: "智能发车",
        activityFlag: "isCarActivityOpen",
      },
      {
        key: "batchClaimCars",
        label: "一键收车",
        activityFlag: "isCarActivityOpen",
      },
      { key: "store_purchase", label: "一键黑市采购" },
      { key: "collection_claimfreereward", label: "一键领取珍宝阁" },
      { key: "batchGenieSweep", label: "一键灯神扫荡" },
    ],
  },
  {
    name: "dungeon",
    label: "副本",
    description: "围绕爬塔、梦境与副本类清扫任务集中执行。",
    items: [
      { key: "climbTower", label: "一键爬塔" },
      {
        key: "batchmengjing",
        label: "一键梦境",
        activityFlag: "ismengjingActivityOpen",
      },
      { key: "skinChallenge", label: "一键换皮闯关" },
      { key: "batchClaimPeachTasks", label: "一键领取蟠桃园任务" },
      {
        key: "batchBuyDreamItems",
        label: "一键购买梦境商品",
        activityFlag: "ismengjingActivityOpen",
      },
    ],
  },
  {
    name: "baoku",
    label: "宝库",
    description: "按宝库开放状态执行楼层清理，关闭时自动禁用。",
    statusFlag: "isBaokuActivityOpen",
    items: [
      {
        key: "batchbaoku13",
        label: "一键宝库前3层",
        activityFlag: "isBaokuActivityOpen",
      },
      {
        key: "batchbaoku45",
        label: "一键宝库4,5层",
        activityFlag: "isBaokuActivityOpen",
      },
    ],
  },
  {
    name: "weirdTower",
    label: "怪异塔",
    description: "怪异塔爬塔、道具使用、合成与免费领取统一收口。",
    statusFlag: "isWeirdTowerActivityOpen",
    items: [
      {
        key: "climbWeirdTower",
        label: "一键爬怪异塔",
        activityFlag: "isWeirdTowerActivityOpen",
      },
      {
        key: "batchUseItems",
        label: "一键使用怪异塔道具",
        activityFlag: "isWeirdTowerActivityOpen",
      },
      {
        key: "batchMergeItems",
        label: "一键怪异塔合成",
        activityFlag: "isWeirdTowerActivityOpen",
      },
      {
        key: "batchClaimFreeEnergy",
        label: "一键领取怪异塔免费道具",
        activityFlag: "isWeirdTowerActivityOpen",
      },
    ],
  },
  {
    name: "resource",
    label: "资源",
    description: "开箱、钓鱼、招募和养成资源入口都保留在这一组。",
    items: [
      { key: "open-helper:box", label: "批量开箱" },
      { key: "batchClaimBoxPointReward", label: "领取宝箱积分" },
      { key: "open-helper:fish", label: "批量钓鱼" },
      { key: "open-helper:recruit", label: "批量招募" },
      { key: "batchHeroUpgrade", label: "一键英雄升星" },
      { key: "batchBookUpgrade", label: "一键图鉴升星" },
      { key: "batchClaimStarRewards", label: "一键领取图鉴奖励" },
      { key: "legion_storebuygoods", label: "一键购买四圣碎片" },
      { key: "legionStoreBuySkinCoins", label: "一键购买俱乐部5皮肤币" },
    ],
  },
  {
    name: "legacy",
    label: "功法",
    description: "集中处理功法残卷领取与赠送。",
    items: [
      { key: "batchLegacyClaim", label: "批量功法残卷领取" },
      { key: "open-legacy-gift", label: "批量功法残卷赠送" },
    ],
  },
  {
    name: "monthly",
    label: "月度",
    description: "月度补齐和月赛助威入口，按活动开放状态动态提示。",
    statusFlag: "isWarGuessActivityOpen",
    items: [
      { key: "batchTopUpFish", label: "一键钓鱼补齐" },
      {
        key: "batchTopUpArena",
        label: "一键竞技场补齐",
        activityFlag: "isarenaActivityOpen",
      },
      {
        key: "open-war-guess",
        label: "月赛助威",
        activityFlag: "isWarGuessActivityOpen",
      },
    ],
  },
];

const isDisabled = (item) => {
  if (props.isRunning || props.selectedTokenCount === 0) {
    return true;
  }

  if (item.activityFlag) {
    return !props[item.activityFlag];
  }

  return false;
};

const getActionTitle = (item) => {
  if (item.key === "open-war-guess" && !props.isWarGuessActivityOpen) {
    return props.warGuessActivityTip;
  }

  return "";
};

const getGroupStatusText = (group) => {
  if (!group.statusFlag) {
    return props.selectedTokenCount > 0 ? "已选择执行账号" : "请先选择账号";
  }

  if (group.statusFlag === "isWarGuessActivityOpen") {
    return props.isWarGuessActivityOpen ? "月赛开放中" : props.warGuessActivityTip || "当前未开放";
  }

  return props[group.statusFlag] ? "当前可执行" : "当前未开放";
};

const getGroupStatusTone = (group) => {
  if (!group.statusFlag) {
    return props.selectedTokenCount > 0 ? "ready" : "idle";
  }

  return props[group.statusFlag] ? "ready" : "muted";
};

const handleAction = (item) => {
  if (item.key.startsWith("open-helper:")) {
    emit("open-helper", item.key.split(":")[1]);
    return;
  }

  if (item.key === "open-legacy-gift") {
    emit("open-legacy-gift");
    return;
  }

  if (item.key === "open-war-guess") {
    emit("open-war-guess");
    return;
  }

  emit("run-action", item.key);
};
</script>

<style scoped lang="scss">
.batch-toolbar-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.batch-toolbar-card__eyebrow {
  display: inline-block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.batch-toolbar-card__header h3 {
  margin: 0;
  font-size: 24px;
  color: var(--text-primary);
}

.batch-toolbar-card__header p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.batch-toolbar-card__summary {
  display: grid;
  gap: 6px;
  min-width: 140px;
  padding: 14px 16px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 18px;
  background: var(--surface-glass);
}

.batch-toolbar-card__summary span {
  font-size: 12px;
  color: var(--text-tertiary);
}

.batch-toolbar-card__summary strong {
  font-size: 24px;
  color: var(--text-primary);
}

.toolbar-pane {
  display: grid;
  gap: 16px;
  padding-top: 10px;
}

.toolbar-pane__meta {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-pane__meta p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.toolbar-pane__status {
  display: inline-flex;
  align-items: center;
  min-height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid transparent;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.toolbar-pane__status.is-ready {
  color: var(--success-color);
  background: rgba(24, 160, 88, 0.1);
  border-color: rgba(24, 160, 88, 0.2);
}

.toolbar-pane__status.is-idle,
.toolbar-pane__status.is-muted {
  color: var(--text-secondary);
  background: rgba(63, 119, 173, 0.08);
  border-color: rgba(63, 119, 173, 0.16);
}

.toolbar-pane__grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
}

.toolbar-action-button {
  justify-content: flex-start;
  min-height: 44px;
  padding-inline: 14px;
  border-radius: 14px;
}

@media (max-width: 768px) {
  .batch-toolbar-card__header {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar-pane__grid {
    grid-template-columns: 1fr;
  }
}
</style>
