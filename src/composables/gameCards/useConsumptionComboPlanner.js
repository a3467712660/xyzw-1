import { computed, ref } from "vue";

const DEFAULT_MAX_CACHE_ENTRIES = 8;
const DEFAULT_MAX_RESULTS = 50;
const YIELD_EVERY = 250;

const schedulePlannerYield = () =>
  new Promise((resolve) => {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => resolve());
      return;
    }

    setTimeout(resolve, 0);
  });

const compareCombos = (left, right) =>
  left.sumDelta - right.sumDelta
  || left.sumCost - right.sumCost
  || left.combo.length - right.combo.length;

const insertCombo = (results, entry, maxResults) => {
  if (results.length === 0) {
    results.push(entry);
    return;
  }

  let insertAt = results.findIndex((item) => compareCombos(entry, item) < 0);
  if (insertAt < 0) {
    insertAt = results.length;
  }

  if (insertAt >= maxResults && results.length >= maxResults) {
    return;
  }

  results.splice(insertAt, 0, entry);
  if (results.length > maxResults) {
    results.length = maxResults;
  }
};

const makeSignature = (snapshot) => {
  if (!snapshot) {
    return "";
  }

  return JSON.stringify({
    activityKey: snapshot.activityKey || "",
    currentGold: Number(snapshot.currentGold || 0),
    currentOrdStock: Number(snapshot.currentOrdStock || 0),
    goldRateUsed: Number(snapshot.goldRateUsed || 0),
    progressItems: (snapshot.progressItems || []).map((item) => ({
      current: Number(item.current || 0),
      id: Number(item.id || 0),
    })),
    remainingOrdNeeded: Number(snapshot.remainingOrdNeeded || 0),
    totalObtained: Number(snapshot.totalObtained || 0),
  });
};

const buildGroups = (snapshot) => {
  const groups = [];
  const progressItems = snapshot.progressItems || [];
  const missionTypes = snapshot.missionTypes || {};
  const rewardConfigs = snapshot.rewardConfigs || {};

  for (const item of progressItems) {
    const id = Number(item.id);
    const current = Number(item.current || 0);
    const configs = missionTypes[id] || [];
    const rewards = rewardConfigs[id] || [];
    const beforeRounds = configs.filter((config) => config.num <= current).length;
    const options = [];

    for (let index = beforeRounds; index < configs.length; index += 1) {
      const threshold = configs[index].num;
      const completedRounds = index + 1;
      let delta = 0;

      for (let rewardIndex = beforeRounds; rewardIndex < completedRounds; rewardIndex += 1) {
        delta += rewards[rewardIndex]?.num || rewards[rewards.length - 1]?.num || 0;
      }

      const cost = Math.max(0, threshold - current);
      if (delta > 0 && cost > 0) {
        options.push({
          cost,
          delta,
          id,
          name: item.name,
          roundsIndex: completedRounds,
          threshold,
        });
      }
    }

    groups.push({ id, options });
  }

  return groups;
};

const buildSuffixMaxDelta = (groups) => {
  const suffixMaxDelta = Array.from({ length: groups.length + 1 }, () => 0);

  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const maxDelta = Math.max(
      0,
      ...groups[index].options.map((option) => Number(option.delta || 0)),
    );
    suffixMaxDelta[index] = suffixMaxDelta[index + 1] + maxDelta;
  }

  return suffixMaxDelta;
};

const shouldPruneAgainstWorst = (state, worst) => {
  if (!worst) {
    return false;
  }

  if (state.sumDelta > worst.sumDelta) {
    return true;
  }

  if (state.sumDelta < worst.sumDelta) {
    return false;
  }

  if (state.sumCost > worst.sumCost) {
    return true;
  }

  if (state.sumCost < worst.sumCost) {
    return false;
  }

  return state.combo.length >= worst.combo.length;
};

const computeCombos = async (snapshot, options) => {
  const {
    isCancelled,
    maxResults = DEFAULT_MAX_RESULTS,
  } = options;

  const target = Math.ceil(Number(snapshot.remainingOrdNeeded || 0));
  if (target <= 0) {
    return [];
  }

  const groups = buildGroups(snapshot);
  const suffixMaxDelta = buildSuffixMaxDelta(groups);
  const results = [];
  const stack = [
    {
      combo: [],
      idx: 0,
      sumCost: 0,
      sumDelta: 0,
    },
  ];

  let iterations = 0;

  while (stack.length > 0) {
    if (isCancelled()) {
      return null;
    }

    const state = stack.pop();
    iterations += 1;

    if (iterations % YIELD_EVERY === 0) {
      await schedulePlannerYield();
      if (isCancelled()) {
        return null;
      }
    }

    if (state.sumDelta >= target) {
      insertCombo(
        results,
        {
          combo: state.combo,
          sumCost: state.sumCost,
          sumDelta: state.sumDelta,
          totalOrd: Number(snapshot.totalObtained || 0) + state.sumDelta,
        },
        maxResults,
      );
      continue;
    }

    if (state.idx >= groups.length) {
      continue;
    }

    if (state.sumDelta + suffixMaxDelta[state.idx] < target) {
      continue;
    }

    const worst = results.length >= maxResults ? results[results.length - 1] : null;
    if (shouldPruneAgainstWorst(state, worst)) {
      continue;
    }

    const group = groups[state.idx];
    stack.push({
      combo: state.combo,
      idx: state.idx + 1,
      sumCost: state.sumCost,
      sumDelta: state.sumDelta,
    });

    for (let optionIndex = group.options.length - 1; optionIndex >= 0; optionIndex -= 1) {
      const option = group.options[optionIndex];
      stack.push({
        combo: [...state.combo, option],
        idx: state.idx + 1,
        sumCost: state.sumCost + option.cost,
        sumDelta: state.sumDelta + option.delta,
      });
    }
  }

  return results;
};

export function useConsumptionComboPlanner(options = {}) {
  const maxCacheEntries = options.maxCacheEntries || DEFAULT_MAX_CACHE_ENTRIES;
  const maxResults = options.maxResults || DEFAULT_MAX_RESULTS;
  const cache = new Map();

  const loading = ref(false);
  const results = ref([]);
  const activeRequestId = ref(0);

  const cacheSize = computed(() => cache.size);

  const getCached = (signature, { touch = true } = {}) => {
    if (!signature || !cache.has(signature)) {
      return null;
    }

    const cached = cache.get(signature);
    if (touch) {
      cache.delete(signature);
      cache.set(signature, cached);
    }
    return cached;
  };

  const cacheResult = (signature, value) => {
    if (!signature) {
      return;
    }

    if (cache.has(signature)) {
      cache.delete(signature);
    }

    cache.set(signature, value);

    while (cache.size > maxCacheEntries) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
  };

  const cancel = () => {
    activeRequestId.value += 1;
    loading.value = false;
  };

  const runPlanner = async (snapshot, { force = false } = {}) => {
    const signature = makeSignature(snapshot);
    if (!signature) {
      results.value = [];
      loading.value = false;
      return [];
    }

    if (!force) {
      const cached = getCached(signature);
      if (cached) {
        results.value = cached;
        loading.value = false;
        return cached;
      }
    }

    const requestId = activeRequestId.value + 1;
    activeRequestId.value = requestId;
    loading.value = true;

    const computedResults = await computeCombos(snapshot, {
      isCancelled: () => activeRequestId.value !== requestId,
      maxResults,
    });

    if (computedResults == null || activeRequestId.value !== requestId) {
      return [];
    }

    cacheResult(signature, computedResults);
    results.value = computedResults;
    loading.value = false;
    return computedResults;
  };

  return {
    cacheSize,
    cancel,
    getCached,
    makeSignature,
    loading,
    results,
    runPlanner,
  };
}
