<template>
  <n-card class="mt-16" title="批量功能列表">
    <n-tabs animated type="line">
      <n-tab-pane
        v-for="group in taskGroups"
        :key="group.name"
        :name="group.name"
        :tab="group.label"
      >
        <n-space>
          <n-button
            v-for="item in group.items"
            :key="item.key"
            size="small"
            :disabled="isDisabled(item)"
            :title="getActionTitle(item)"
            @click="handleAction(item)"
          >
            {{ item.label }}
          </n-button>
        </n-space>
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
    items: [
      { key: "batchLegacyClaim", label: "批量功法残卷领取" },
      { key: "open-legacy-gift", label: "批量功法残卷赠送" },
    ],
  },
  {
    name: "monthly",
    label: "月度",
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
