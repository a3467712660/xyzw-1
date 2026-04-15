export const TASK_GROUP_DEFINITIONS = [
  {
    name: "daily",
    label: "日常",
    tasks: [
      "startBatch",
      "claimHangUpRewards",
      "resetBottles",
      "batchlingguanzi",
      "batchStudy",
      "batcharenafight",
      "batchSmartSendCar",
      "batchClaimCars",
      "batchGenieSweep",
    ],
  },
  {
    name: "dungeon",
    label: "副本",
    tasks: [
      "climbTower",
      "batchmengjing",
      "skinChallenge",
      "batchClaimPeachTasks",
      "batchBuyDreamItems",
    ],
  },
  {
    name: "baoku",
    label: "宝库",
    tasks: ["batchbaoku13", "batchbaoku45"],
  },
  {
    name: "weirdTower",
    label: "怪异塔",
    tasks: [
      "climbWeirdTower",
      "batchUseItems",
      "batchMergeItems",
      "batchClaimFreeEnergy",
    ],
  },
  {
    name: "resource",
    label: "资源",
    tasks: [
      "batchOpenBox",
      "batchClaimBoxPointReward",
      "batchFish",
      "batchRecruit",
      "legion_storebuygoods",
    ],
  },
  {
    name: "legacy",
    label: "功法",
    tasks: ["batchLegacyClaim", "batchLegacyGiftSendEnhanced"],
  },
  {
    name: "monthly",
    label: "月度",
    tasks: ["batchTopUpFish", "batchTopUpArena"],
  },
];

export const groupAvailableTasks = (
  availableTasks = [],
  taskGroupDefinitions = TASK_GROUP_DEFINITIONS,
) => {
  const groups = {};

  for (const group of taskGroupDefinitions) {
    groups[group.name] = (availableTasks || []).filter((task) =>
      group.tasks.includes(task.value),
    );
  }

  const groupedTaskValues = taskGroupDefinitions.flatMap((group) => group.tasks);
  const otherTasks = (availableTasks || []).filter(
    (task) => !groupedTaskValues.includes(task.value),
  );

  if (otherTasks.length > 0) {
    groups.other = otherTasks;
  }

  return groups;
};

export const buildWarGuessActivityTip = ({
  activeWeeks = [],
  currentWeek = "",
  isOpen,
  openDate,
} = {}) => {
  if (isOpen) {
    return "";
  }

  if (openDate instanceof Date && !Number.isNaN(openDate.getTime())) {
    const month = openDate.getMonth() + 1;
    const date = openDate.getDate();
    return `月赛助威仅在每月第四个周日 (${month}月${date}日) 00:00-19:55 开放`;
  }

  if (Array.isArray(activeWeeks) && activeWeeks.length > 0) {
    return `月赛助威仅在 ${activeWeeks.join(" / ")} 开放`;
  }

  if (currentWeek) {
    return `当前为${currentWeek}，月赛助威暂未开放`;
  }

  return "月赛助威暂未开放";
};
