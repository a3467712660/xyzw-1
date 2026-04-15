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

const BATCH_ACTIVITY_WEEK_START = new Date("2025-12-12T12:00:00");
const BATCH_ACTIVITY_WEEK_DURATION = 7 * 24 * 60 * 60 * 1000;
const BATCH_ACTIVITY_CYCLE_DURATION = 3 * BATCH_ACTIVITY_WEEK_DURATION;

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

export const isBatchCarActivityOpen = (now = new Date()) => {
  const day = now.getDay();
  const hour = now.getHours();
  return day >= 1 && day <= 3 && hour >= 6;
};

export const isBatchMengjingActivityOpen = (now = new Date()) => {
  const day = now.getDay();
  return day === 0 || day === 1 || day === 3 || day === 4;
};

export const isBatchBaokuActivityOpen = (now = new Date()) => {
  const day = now.getDay();
  return day !== 1 && day !== 2;
};

export const isBatchArenaActivityOpen = (now = new Date()) => {
  const hour = now.getHours();
  return hour >= 6 && hour < 22;
};

export const getBatchCurrentActivityWeek = (
  now = new Date(),
  start = BATCH_ACTIVITY_WEEK_START,
) => {
  const elapsed = now.getTime() - start.getTime();
  if (elapsed < 0) {
    return null;
  }

  const cyclePosition = elapsed % BATCH_ACTIVITY_CYCLE_DURATION;
  if (cyclePosition < BATCH_ACTIVITY_WEEK_DURATION) {
    return "黑市周";
  }
  if (cyclePosition < 2 * BATCH_ACTIVITY_WEEK_DURATION) {
    return "招募周";
  }
  return "宝箱周";
};

export const isBatchWeirdTowerActivityOpen = (
  now = new Date(),
  currentActivityWeek = getBatchCurrentActivityWeek(now),
) => {
  if (currentActivityWeek !== "黑市周") {
    return false;
  }

  const day = now.getDay();
  const hour = now.getHours();
  if (day === 5) {
    return hour >= 12;
  }
  return true;
};

export const getBatchFourthSundayOfMonth = (now = new Date()) => {
  const year = now.getFullYear();
  const month = now.getMonth();
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();

  let firstSundayDate = 1 + ((7 - dayOfWeek) % 7);
  if (year === 2026 && month === 2 && dayOfWeek === 0) {
    firstSundayDate = 8;
  }

  return new Date(year, month, firstSundayDate + 21);
};

export const isBatchWarGuessActivityOpen = (
  now = new Date(),
  openDate = getBatchFourthSundayOfMonth(now),
) => {
  if (
    now.getFullYear() === 2026
    && now.getMonth() === 2
    && now.getDate() === 1
  ) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < 19 || (hour === 19 && minute <= 55)) {
      return true;
    }
  }

  if (now.getDate() !== openDate.getDate()) {
    return false;
  }

  const hour = now.getHours();
  const minute = now.getMinutes();
  if (hour > 19 || (hour === 19 && minute > 55)) {
    return false;
  }

  return true;
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
