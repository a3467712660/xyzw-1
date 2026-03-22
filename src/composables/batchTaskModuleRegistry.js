export const BATCH_TASK_MODULE_GROUPS = [
  {
    key: "daily",
    loader: () => import("@/utils/batch/daily"),
    creatorNames: [
      "createTasksBottle",
      "createTasksHangUp",
      "createTasksItem",
    ],
    handlerNames: [
      "resetBottles",
      "batchlingguanzi",
      "claimHangUpRewards",
      "batchAddHangUpTime",
      "batchStudy",
      "batchclubsign",
      "batchClaimMailAttachment",
      "batchWarGuessCheer",
      "batchHeroUpgrade",
      "batchBookUpgrade",
      "batchClaimStarRewards",
      "batchClaimBoxPointReward",
      "batchClaimPeachTasks",
      "batchGenieSweep",
      "batchOpenBox",
      "batchFish",
      "batchRecruit",
    ],
  },
  {
    key: "combat",
    loader: () => import("@/utils/batch/combat"),
    creatorNames: [
      "createTasksArena",
      "createTasksDungeon",
      "createTasksTower",
    ],
    handlerNames: [
      "batcharenafight",
      "batchArenaStandalone",
      "batchTopUpFish",
      "batchTopUpArena",
      "batchbaoku13",
      "batchbaoku45",
      "batchmengjing",
      "batchBuyDreamItems",
      "climbTower",
      "climbWeirdTower",
      "batchClaimFreeEnergy",
      "batchUseItems",
      "batchMergeItems",
    ],
  },
  {
    key: "resource",
    loader: () => import("@/utils/batch/resource"),
    creatorNames: [
      "createTasksCar",
      "createTasksLegacy",
      "createTasksStore",
    ],
    handlerNames: [
      "batchSmartSendCar",
      "batchClaimCars",
      "batchLegacyClaim",
      "batchLegacyGiftSendEnhanced",
      "legion_storebuygoods",
      "legionStoreBuySkinCoins",
      "store_purchase",
      "collection_claimfreereward",
    ],
  },
];

async function loadBatchTaskGroup(group, deps) {
  const loadedModule = await group.loader();
  const groupDeps = deps?.[group.key] || deps;

  return group.creatorNames.reduce((groupResult, creatorName) => {
    const createTasks = loadedModule?.[creatorName];
    if (typeof createTasks !== "function") {
      return groupResult;
    }

    return {
      ...groupResult,
      ...createTasks(groupDeps),
    };
  }, {});
}

export function createBatchTaskModulesFromRegistry(
  deps,
  groups = BATCH_TASK_MODULE_GROUPS,
) {
  const groupByHandlerName = groups.reduce((handlerMap, group) => {
    group.handlerNames?.forEach((handlerName) => {
      handlerMap.set(handlerName, group);
    });

    return handlerMap;
  }, new Map());
  const groupModulesCache = new Map();

  const loadGroupModules = async (group) => {
    if (!group) {
      return null;
    }

    if (!groupModulesCache.has(group.key)) {
      groupModulesCache.set(group.key, loadBatchTaskGroup(group, deps));
    }

    return groupModulesCache.get(group.key);
  };

  const resolveHandler = async (handlerName) => {
    const matchedGroup = groupByHandlerName.get(handlerName);
    if (matchedGroup) {
      const groupModules = await loadGroupModules(matchedGroup);
      const matchedHandler = groupModules?.[handlerName];
      if (typeof matchedHandler === "function") {
        return matchedHandler;
      }
    }

    for (const group of groups) {
      if (group.key === matchedGroup?.key) {
        continue;
      }

      const groupModules = await loadGroupModules(group);
      const fallbackHandler = groupModules?.[handlerName];
      if (typeof fallbackHandler === "function") {
        return fallbackHandler;
      }
    }

    return null;
  };

  return new Proxy(
    {},
    {
      get(_, propertyKey) {
        if (typeof propertyKey !== "string") {
          return undefined;
        }

        return async (...args) => {
          const handler = await resolveHandler(propertyKey);

          if (typeof handler !== "function") {
            throw new TypeError(`未找到批量任务处理器: ${propertyKey}`);
          }

          return handler(...args);
        };
      },
    },
  );
}
