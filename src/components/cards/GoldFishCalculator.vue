<template>
  <div class="gold-fish-calc-card">
    <div class="card-header">
      <div class="header-main">
        <img class="header-icon" :alt="t('goldFishCalculator.iconAlt')" :src="mainIconPath">
        <div class="header-text">
          <h3>{{ t("goldFishCalculator.title") }}</h3>
          <p>{{ t("goldFishCalculator.subtitle") }}</p>
        </div>
      </div>
      <div v-if="scopeKey" class="scope">{{ scopeLabel }}</div>
    </div>

    <div class="control-row">
      <span class="label">{{ t("goldFishCalculator.labels.targetFestival") }}</span>
      <n-select
        class="festival-select"
        size="small"
        v-model:value="selectedFestivalKey"
        :options="festivalOptions"
      ></n-select>
      <span class="label">{{ t("goldFishCalculator.labels.daysToNext", { days: daysToNext }) }}</span>
      <n-button size="small" @click="refreshRoleInfo">
        {{ t("goldFishCalculator.actions.refreshRoleInfo") }}
      </n-button>
    </div>

    <div v-if="usingGlobalDefault" class="hint">
      {{ t("goldFishCalculator.hints.usingDefault") }}
    </div>
    <div v-if="selectedFestival?.isEstimated" class="hint hint-estimate">
      {{ t("goldFishCalculator.hints.estimatedDate", {
        label: selectedFestival.label,
        estimateBase: selectedFestival.estimateBase,
      }) }}
    </div>

    <div class="table-wrap">
      <table class="result-table">
        <thead>
          <tr>
            <th>{{ t("goldFishCalculator.table.resource") }}</th>
            <th>{{ t("goldFishCalculator.table.current") }}</th>
            <th>{{ t("goldFishCalculator.table.target") }}</th>
            <th>{{ t("goldFishCalculator.table.dailyGain") }}</th>
            <th>{{ t("goldFishCalculator.table.gainInDays", { days: daysToNext }) }}</th>
            <th>{{ t("goldFishCalculator.table.total") }}</th>
            <th>{{ t("goldFishCalculator.table.gap") }}</th>
            <th>{{ t("goldFishCalculator.table.source") }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in resultRows" :key="row.key">
            <td>
              <div class="resource-cell">
                <img v-if="row.icon" class="resource-icon" :alt="row.label" :src="row.icon">
                <span>{{ row.label }}</span>
              </div>
            </td>
            <td>{{ formatInt(row.current) }}</td>
            <td>{{ formatInt(row.target) }}</td>
            <td :class="row.dailyGain > 0 ? 'increase' : 'stable'">{{ formatRate(row.dailyGain) }}</td>
            <td class="emphasis" :class="row.gainInPeriod > 0 ? 'increase' : 'stable'">
              {{ formatInt(row.gainInPeriod) }}
            </td>
            <td class="emphasis" :class="row.totalAfterPeriod > 0 ? 'increase' : 'stable'">
              {{ formatInt(row.totalAfterPeriod) }}
            </td>
            <td :class="row.targetGap > 0 ? 'increase' : 'stable'">
              {{ formatSigned(row.targetGap) }}
            </td>
            <td>{{ row.sourceLabel }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="mobile-cards">
      <div v-for="row in resultRows" :key="`mobile-${row.key}`" class="mobile-card">
        <div class="mobile-card-head">
          <div class="resource-cell">
            <img v-if="row.icon" class="resource-icon" :alt="row.label" :src="row.icon">
            <span>{{ row.label }}</span>
          </div>
          <span :class="row.targetGap > 0 ? 'increase' : 'stable'">
            {{ formatSigned(row.targetGap) }}
          </span>
        </div>
        <div class="mobile-grid">
          <div class="mobile-cell">
            <span class="mobile-label">{{ t("goldFishCalculator.table.current") }}</span>
            <span>{{ formatInt(row.current) }}</span>
          </div>
          <div class="mobile-cell">
            <span class="mobile-label">{{ t("goldFishCalculator.table.target") }}</span>
            <span>{{ formatInt(row.target) }}</span>
          </div>
          <div class="mobile-cell">
            <span class="mobile-label">{{ t("goldFishCalculator.table.dailyGain") }}</span>
            <span :class="row.dailyGain > 0 ? 'increase' : 'stable'">{{ formatRate(row.dailyGain) }}</span>
          </div>
          <div class="mobile-cell">
            <span class="mobile-label">{{ t("goldFishCalculator.table.gainInDays", { days: daysToNext }) }}</span>
            <span :class="row.gainInPeriod > 0 ? 'increase' : 'stable'">{{ formatInt(row.gainInPeriod) }}</span>
          </div>
          <div class="mobile-cell">
            <span class="mobile-label">{{ t("goldFishCalculator.table.total") }}</span>
            <span class="emphasis" :class="row.totalAfterPeriod > 0 ? 'increase' : 'stable'">
              {{ formatInt(row.totalAfterPeriod) }}
            </span>
          </div>
          <div class="mobile-cell">
            <span class="mobile-label">{{ t("goldFishCalculator.table.source") }}</span>
            <span>{{ row.sourceLabel }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import {
  buildResourceChangeScopeKeyByRoleId,
  hydrateResourceChangeStoreFromServer,
  loadResourceChangeEntryByRoleId,
} from "@/utils/resourceChangeStorage";

const DAY_MS = 24 * 60 * 60 * 1000;
const YEAR_OBSERVE_DAYS = 365;

// 仅使用已确认的官方日期；未覆盖年份会使用估算日期（并在界面提示）
const FESTIVAL_DATE_TABLE = {
  2025: {
    dragonBoat: "2025-05-31",
    midAutumn: "2025-10-06",
  },
  2026: {
    dragonBoat: "2026-06-19",
    midAutumn: "2026-09-25",
  },
};

const FESTIVAL_ESTIMATE_BASE = {
  dragonBoat: "6月19日",
  midAutumn: "9月25日",
};

const DEFAULT_DAILY_GAIN = {
  diamond: 0,
  chestPoint: 0,
  goldRod: 0,
  recruit: 0,
};

const TARGET_RESOURCE = {
  recruit: 3000,
  goldRod: 750,
  diamond: 230000,
  chestPoint: 30000,
};

const RESOURCE_ICON_MAP = {
  goldRod: `${import.meta.env.BASE_URL}fish/hjyg.png`,
  recruit: `${import.meta.env.BASE_URL}icons/zml.png`,
  chestPoint: `${import.meta.env.BASE_URL}box/zsbx.png`,
};

const { t, locale } = useI18n();
const tokenStore = useTokenStore();
const mainIconPath = `${import.meta.env.BASE_URL}icons/1733492491706148.png`;
const selectedFestivalKey = ref("");

const role = computed(() => tokenStore.gameData?.roleInfo?.role || null);
const roleId = computed(() => {
  const currentRole = role.value;
  if (!currentRole)
    return "";
  return String(currentRole.roleId || "");
});

const scopeKey = computed(() => {
  if (!roleId.value)
    return "";
  return buildResourceChangeScopeKeyByRoleId(roleId.value);
});

const scopeLabel = computed(() => {
  if (!tokenStore.selectedToken || !role.value)
    return "";
  return `${tokenStore.selectedToken.name || tokenStore.selectedToken.id} / ${role.value.name || roleId.value}`;
});

const toDateAtLocalStart = (dateText) => {
  const [year, month, day] = dateText.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
};

const getTodayStart = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
};

const getNextNewYear = () => {
  const todayStart = getTodayStart();
  const year = todayStart.getFullYear();
  const current = new Date(year, 0, 1, 0, 0, 0, 0);
  if (current >= todayStart)
    return current;
  return new Date(year + 1, 0, 1, 0, 0, 0, 0);
};

const getNextFestivalDate = (festivalKey) => {
  if (festivalKey === "newYear") {
    return {
      date: getNextNewYear(),
      isEstimated: false,
      estimateBase: "",
    };
  }

  const todayStart = getTodayStart();
  const startYear = todayStart.getFullYear();
  const endYear = startYear + 5;

  for (let year = startYear; year <= endYear; year += 1) {
    const dateText = FESTIVAL_DATE_TABLE[year]?.[festivalKey];
    if (!dateText)
      continue;
    const candidate = toDateAtLocalStart(dateText);
    if (candidate >= todayStart) {
      return {
        date: candidate,
        isEstimated: false,
        estimateBase: "",
      };
    }
  }

  const monthDay = FESTIVAL_ESTIMATE_BASE[festivalKey];
  const [month, day] = monthDay
    .replace("月", "-")
    .replace("日", "")
    .split("-")
    .map(Number);
  let estimate = new Date(startYear, month - 1, day, 0, 0, 0, 0);
  if (estimate < todayStart) {
    estimate = new Date(startYear + 1, month - 1, day, 0, 0, 0, 0);
  }
  return {
    date: estimate,
    isEstimated: true,
    estimateBase: monthDay,
  };
};

const festivalTargets = computed(() => {
  const dragonBoat = getNextFestivalDate("dragonBoat");
  const midAutumn = getNextFestivalDate("midAutumn");
  const newYear = getNextFestivalDate("newYear");
  return [
    {
      key: "dragonBoat",
      label: t("goldFishCalculator.festivals.dragonBoat"),
      ...dragonBoat,
    },
    {
      key: "midAutumn",
      label: t("goldFishCalculator.festivals.midAutumn"),
      ...midAutumn,
    },
    {
      key: "newYear",
      label: t("goldFishCalculator.festivals.newYear"),
      ...newYear,
    },
  ];
});

const formatDate = (date) =>
  new Intl.DateTimeFormat(locale.value, {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).format(date);

const festivalOptions = computed(() =>
  festivalTargets.value.map((item) => ({
    label: t("goldFishCalculator.festivalOption", {
      label: item.label,
      date: formatDate(item.date),
    }),
    value: item.key,
  })),
);

const selectedFestival = computed(() => {
  const hit = festivalTargets.value.find((item) => item.key === selectedFestivalKey.value);
  if (hit)
    return hit;
  return festivalTargets.value[0];
});

const daysToNext = computed(() => {
  if (!selectedFestival.value?.date)
    return 0;
  const todayStart = getTodayStart();
  const diff = selectedFestival.value.date.getTime() - todayStart.getTime();
  return Math.max(0, Math.ceil(diff / DAY_MS));
});

const getItemCount = (items, id) => {
  if (!items)
    return 0;

  if (Array.isArray(items)) {
    const found = items.find((it) => Number(it?.id ?? it?.itemId) === id);
    if (!found)
      return 0;
    return Number(found?.num ?? found?.count ?? found?.quantity ?? 0);
  }

  const direct = items[String(id)] ?? items[id];
  if (direct != null) {
    if (typeof direct === "number")
      return Number(direct);
    if (typeof direct === "object") {
      return Number(direct?.num ?? direct?.count ?? direct?.quantity ?? 0);
    }
    return Number(direct) || 0;
  }

  const matched = Object.values(items).find(
    (node) => Number(node?.itemId ?? node?.id) === id,
  );
  if (!matched)
    return 0;
  return Number(matched?.num ?? matched?.count ?? matched?.quantity ?? 0);
};

const currentResources = computed(() => {
  const currentRole = role.value;
  if (!currentRole) {
    return {
      diamond: 0,
      chestPoint: 0,
      recruit: 0,
    };
  }

  const items
    = currentRole.items || currentRole.itemList || currentRole.bag?.items || currentRole.inventory || null;

  return {
    diamond: Number(currentRole.diamond ?? 0),
    chestPoint:
      getItemCount(items, 2001) * 1
      + getItemCount(items, 2002) * 10
      + getItemCount(items, 2003) * 20
      + getItemCount(items, 2004) * 50,
    goldRod: Math.max(
      getItemCount(items, 1012),
      Number(currentRole?.fishing?.goldRod ?? currentRole?.fishing?.vipRod ?? 0),
    ),
    recruit: getItemCount(items, 1001),
  };
});

const getRecentYearRecords = () => {
  if (!scopeKey.value)
    return [];
  const data = loadResourceChangeEntryByRoleId(roleId.value);
  if (!data || !Array.isArray(data.records))
    return [];

  const yearAgo = Date.now() - YEAR_OBSERVE_DAYS * DAY_MS;
  return data.records.filter((record) => Number(record?.timestamp || 0) >= yearAgo);
};

const parseDailyGainFromLogs = () => {
  const records = getRecentYearRecords();
  if (records.length === 0) {
    return {
      hasAnyData: false,
      rates: {
        diamond: DEFAULT_DAILY_GAIN.diamond,
        chestPoint: DEFAULT_DAILY_GAIN.chestPoint,
        goldRod: DEFAULT_DAILY_GAIN.goldRod,
        recruit: DEFAULT_DAILY_GAIN.recruit,
      },
      source: {
        diamond: t("goldFishCalculator.sources.default"),
        chestPoint: t("goldFishCalculator.sources.default"),
        goldRod: t("goldFishCalculator.sources.default"),
        recruit: t("goldFishCalculator.sources.default"),
      },
    };
  }

  const positiveSum = {
    diamond: 0,
    chestPoint: 0,
    goldRod: 0,
    recruit: 0,
  };
  const changedCount = {
    diamond: 0,
    chestPoint: 0,
    goldRod: 0,
    recruit: 0,
  };

  records.forEach((record) => {
    (record?.changes || []).forEach((change) => {
      const delta = Number(change?.delta || 0);
      if (change.key === "diamond") {
        positiveSum.diamond += delta;
        changedCount.diamond += 1;
      }
      if (change.key === "item:2001") {
        positiveSum.chestPoint += delta * 1;
        changedCount.chestPoint += 1;
      }
      if (change.key === "item:2002") {
        positiveSum.chestPoint += delta * 10;
        changedCount.chestPoint += 1;
      }
      if (change.key === "item:2003") {
        positiveSum.chestPoint += delta * 20;
        changedCount.chestPoint += 1;
      }
      if (change.key === "item:2004") {
        positiveSum.chestPoint += delta * 50;
        changedCount.chestPoint += 1;
      }
      if (change.key === "item:1012" || change.key === "fish:goldRod") {
        positiveSum.goldRod += delta;
        changedCount.goldRod += 1;
      }
      if (change.key === "item:1001") {
        positiveSum.recruit += delta;
        changedCount.recruit += 1;
      }
    });
  });

  const earliestTimestamp = records.reduce((minTs, record) => {
    const ts = Number(record?.timestamp || 0);
    if (!ts)
      return minTs;
    return Math.min(minTs, ts);
  }, Number.POSITIVE_INFINITY);
  const observedDays = Number.isFinite(earliestTimestamp)
    ? Math.max(1, Math.min(
        YEAR_OBSERVE_DAYS,
        Math.ceil((Date.now() - earliestTimestamp) / DAY_MS),
      ))
    : YEAR_OBSERVE_DAYS;

  const fromLogsRate = {
    diamond: positiveSum.diamond / observedDays,
    chestPoint: positiveSum.chestPoint / observedDays,
    goldRod: positiveSum.goldRod / observedDays,
    recruit: positiveSum.recruit / observedDays,
  };

  const hasDiamond = changedCount.diamond > 0;
  const hasChestPoint = changedCount.chestPoint > 0;
  const hasGoldRod = changedCount.goldRod > 0;
  const hasRecruit = changedCount.recruit > 0;

  return {
    hasAnyData: true,
    rates: {
      diamond: hasDiamond ? fromLogsRate.diamond : DEFAULT_DAILY_GAIN.diamond,
      chestPoint: hasChestPoint ? fromLogsRate.chestPoint : DEFAULT_DAILY_GAIN.chestPoint,
      goldRod: hasGoldRod ? fromLogsRate.goldRod : DEFAULT_DAILY_GAIN.goldRod,
      recruit: hasRecruit ? fromLogsRate.recruit : DEFAULT_DAILY_GAIN.recruit,
    },
    source: {
      diamond: hasDiamond
        ? t("goldFishCalculator.sources.changeLog")
        : t("goldFishCalculator.sources.default"),
      chestPoint: hasChestPoint
        ? t("goldFishCalculator.sources.changeLog")
        : t("goldFishCalculator.sources.default"),
      goldRod: hasGoldRod
        ? t("goldFishCalculator.sources.changeLog")
        : t("goldFishCalculator.sources.default"),
      recruit: hasRecruit
        ? t("goldFishCalculator.sources.changeLog")
        : t("goldFishCalculator.sources.default"),
    },
  };
};

const gainBasis = computed(() => parseDailyGainFromLogs());

const usingGlobalDefault = computed(() => !gainBasis.value.hasAnyData);

const calcGainInPeriod = (dailyGain, days) => {
  const raw = Number(dailyGain || 0) * Number(days || 0);
  if (raw >= 0)
    return Math.floor(raw);
  return Math.ceil(raw);
};

const buildRow = (key, label, current) => {
  const dailyGain = Number(gainBasis.value.rates[key] || 0);
  const gainInPeriod = calcGainInPeriod(dailyGain, daysToNext.value);
  const totalAfterPeriod = Number(current || 0) + gainInPeriod;
  const target = Number(TARGET_RESOURCE[key] || 0);
  const targetGap = totalAfterPeriod - target;

  return {
    key,
    label,
    current: Number(current || 0),
    target,
    dailyGain,
    gainInPeriod,
    totalAfterPeriod,
    targetGap,
    icon: RESOURCE_ICON_MAP[key] || "",
    sourceLabel: gainBasis.value.source[key],
  };
};

const resultRows = computed(() => {
  const current = currentResources.value;
  return [
    buildRow("diamond", t("goldFishCalculator.resources.diamond"), current.diamond),
    buildRow("chestPoint", t("goldFishCalculator.resources.chestPoint"), current.chestPoint),
    buildRow("goldRod", t("goldFishCalculator.resources.goldRod"), current.goldRod),
    buildRow("recruit", t("goldFishCalculator.resources.recruit"), current.recruit),
  ];
});

const refreshRoleInfo = () => {
  if (!tokenStore.selectedToken)
    return;
  tokenStore.sendMessage(tokenStore.selectedToken.id, "role_getroleinfo");
};

const formatInt = (value) => Number(value || 0).toLocaleString();
const formatSigned = (value) => {
  const n = Number(value || 0);
  const abs = Math.abs(n).toLocaleString();
  if (n > 0)
    return `+${abs}`;
  if (n < 0)
    return `-${abs}`;
  return "0";
};
const formatRate = (value) => {
  const n = Number(value || 0);
  if (Number.isInteger(n))
    return t("goldFishCalculator.ratePerDay", { value: n });
  return t("goldFishCalculator.ratePerDay", { value: n.toFixed(2) });
};

onMounted(async () => {
  await hydrateResourceChangeStoreFromServer();
  refreshRoleInfo();
});

watch(
  festivalTargets,
  (targets) => {
    if (!targets.length)
      return;
    if (!selectedFestivalKey.value) {
      const nearest = [...targets].sort((a, b) => a.date.getTime() - b.date.getTime())[0];
      selectedFestivalKey.value = nearest?.key || targets[0].key;
      return;
    }

    if (targets.some((item) => item.key === selectedFestivalKey.value))
      return;
    selectedFestivalKey.value = targets[0].key;
  },
  { immediate: true },
);

watch(
  () => tokenId.value,
  async () => {
    await hydrateResourceChangeStoreFromServer();
    refreshRoleInfo();
  },
);
</script>

<style scoped lang="scss">
.gold-fish-calc-card {
  grid-column: 1 / -1;
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-xl);
  padding: var(--spacing-lg);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.card-header {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.header-main {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.header-icon {
  width: 28px;
  height: 28px;
  object-fit: contain;
}

.header-text h3 {
  margin: 0;
  font-size: 1.1rem;
}

.header-text p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.scope {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.control-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.festival-select {
  min-width: 260px;
}

.label {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.hint {
  font-size: var(--font-size-sm);
  color: #a16207;
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: var(--border-radius-medium);
  padding: 8px 10px;
}

.table-wrap {
  overflow-x: auto;
}

.mobile-cards {
  display: none;
}

.result-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 900px;
}

.result-table th,
.result-table td {
  border-bottom: 1px solid var(--border-light);
  padding: 10px 8px;
  text-align: left;
  font-size: var(--font-size-sm);
}

.result-table th {
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.emphasis {
  font-weight: var(--font-weight-bold);
  color: var(--primary-color);
}

.increase {
  color: #dc2626;
  font-weight: var(--font-weight-semibold);
}

.stable {
  color: #16a34a;
  font-weight: var(--font-weight-semibold);
}

.resource-cell {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.resource-icon {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.mobile-card {
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  background: var(--bg-secondary);
  padding: 10px;
}

.mobile-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-weight: var(--font-weight-semibold);
}

.mobile-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.mobile-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.mobile-label {
  font-size: 12px;
  color: var(--text-secondary);
}

@media (max-width: 768px) {
  .gold-fish-calc-card {
    padding: var(--spacing-md);
  }

  .scope {
    width: 100%;
  }

  .control-row {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .festival-select {
    min-width: 0;
    width: 100%;
  }

  .table-wrap {
    display: none;
  }

  .mobile-cards {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
}
</style>
