<template>
  <div class="resource-changes-card">
    <div class="card-header">
      <div class="header-main">
        <img alt="主图标" class="header-icon" :src="mainIconPath">
        <div class="header-text">
          <h3>资源数据变化</h3>
          <p>按账号本地加密缓存；每次打开自动记录快照，无变化则跳过</p>
        </div>
      </div>
      <div class="header-actions">
        <n-button quaternary size="small" @click="exportData">导出数据</n-button>
        <n-button quaternary size="small" @click="importData">导入数据</n-button>
        <n-dropdown
          trigger="click"
          :options="visibilityMenuOptions"
          @select="handleVisibilityMenuSelect"
        >
          <n-button quaternary size="small">显示管理</n-button>
        </n-dropdown>
        <div v-if="entry.lastOpenedAt" class="open-time">
          最近打开：{{ formatTime(entry.lastOpenedAt) }}
        </div>
      </div>
    </div>

    <div class="summary-row">
      <div class="summary-item">
        <div class="summary-title">今日数据变化</div>
        <div class="summary-value">{{ todayRecords.length }} 次记录</div>
        <div class="summary-sub">{{ countChanges(todayRecords) }} 项资源变化</div>
      </div>
      <div class="summary-item">
        <div class="summary-title">本周数据变化</div>
        <div class="summary-value">{{ weekRecords.length }} 次记录</div>
        <div class="summary-sub">{{ countChanges(weekRecords) }} 项资源变化</div>
      </div>
    </div>

    <div class="panes">
      <section class="pane">
        <h4>今日资源变化汇总</h4>
        <div v-if="todaySummary.length === 0" class="empty-state">今日暂无数据变化</div>
        <div v-else class="summary-list">
          <div
            v-for="item in todaySummary"
            :key="`today-${item.key}`"
            class="summary-row-item"
          >
            <span class="label">{{ item.label }}</span>
            <span class="delta" :class="item.delta > 0 ? 'up' : 'down'">
              {{ formatSigned(item.delta) }}
            </span>
          </div>
        </div>
      </section>

      <section class="pane">
        <h4>本周资源变化汇总</h4>
        <div v-if="weekSummary.length === 0" class="empty-state">本周暂无数据变化</div>
        <div v-else class="summary-list">
          <div
            v-for="item in weekSummary"
            :key="`week-${item.key}`"
            class="summary-row-item"
          >
            <span class="label">{{ item.label }}</span>
            <span class="delta" :class="item.delta > 0 ? 'up' : 'down'">
              {{ formatSigned(item.delta) }}
            </span>
          </div>
        </div>
      </section>
    </div>

    <section class="detail-block">
      <div class="detail-head">
        <h4>{{ selectedRangeLabel }}变化记录</h4>
        <div aria-label="时间范围切换" class="period-switch" role="tablist">
          <button
            v-for="range in RANGE_OPTIONS"
            :key="range.key"
            class="period-btn"
            type="button"
            :class="{ active: selectedRangeKey === range.key }"
            @click="selectedRangeKey = range.key"
          >
            {{ range.label }}
          </button>
        </div>
      </div>

      <div v-if="selectedRangeSummary.length > 0" class="summary-inline">
        <span>汇总变化：</span>
        <span
          v-for="item in selectedRangeSummary.slice(0, 6)"
          :key="`inline-${selectedRangeKey}-${item.key}`"
          class="inline-chip"
        >
          {{ item.label }} {{ formatSigned(item.delta) }}
        </span>
      </div>

      <div v-if="selectedRangeRecords.length === 0" class="empty-state">
        {{ selectedRangeLabel }}没有可展示的变化记录
      </div>

      <div v-else class="record-list">
        <div v-for="record in selectedRangeRecords" :key="record.timestamp" class="record-item">
          <div class="record-head">
            <span>{{ formatTime(record.timestamp) }}</span>
            <span>变化 {{ record.changes.length }} 项</span>
          </div>
          <div class="record-changes">
            <div
              v-for="change in record.changes.slice(0, 8)"
              :key="`${record.timestamp}-${change.key}`"
              class="change-item"
            >
              <span class="label">{{ change.label }}</span>
              <span class="delta" :class="change.delta > 0 ? 'up' : 'down'">
                {{ formatSigned(change.delta) }}
              </span>
              <span class="from-to">{{ formatNumber(change.before) }} → {{ formatNumber(change.after) }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useTokenStore } from "@/stores/tokenStore";
import {
  buildResourceChangeScopeKeyByRoleId,
  exportResourceChangeStore,
  hydrateResourceChangeStoreFromServer,
  importResourceChangeStore,
  loadResourceChangeEntryByRoleId,
  loadResourceChangeEntryByRoleIds,
  saveResourceChangeEntry,
} from "@/utils/resourceChangeStorage";

const MAX_RECORDS = 1200;
const RETAIN_DAYS = 400;

const RANGE_OPTIONS = [
  { key: "week", label: "本周" },
  { key: "month", label: "一个月" },
  { key: "quarter", label: "一个季度" },
  { key: "year", label: "一年" },
];

const ITEM_LABELS = {
  1001: "招募令",
  1003: "进阶石",
  1006: "精铁",
  1007: "竞技场门票",
  1008: "木柴火把",
  1009: "青铜火把",
  1010: "咸神火把",
  1011: "普通鱼竿",
  1012: "金鱼竿",
  1013: "珍珠",
  1014: "军团币",
  1016: "晶石",
  1017: "复活丹",
  1019: "盐靛",
  1020: "皮肤币",
  1021: "扫荡魔毯",
  1022: "白玉",
  1023: "彩玉",
  1026: "扳手",
  1033: "贝壳",
  1035: "金盐靛",
  2001: "木制宝箱",
  2002: "青铜宝箱",
  2003: "黄金宝箱",
  2004: "铂金宝箱",
  2005: "钻石宝箱",
  2101: "助威币",
  3001: "金币袋子",
  3002: "金砖袋子",
  3005: "紫色随机碎片",
  3006: "橙色随机碎片",
  3007: "红色随机碎片",
  3008: "精铁袋子",
  3009: "进阶袋子",
  3010: "梦魇袋子",
  3011: "白玉袋子",
  3012: "扳手袋子",
  3020: "聚宝盆",
  3021: "豪华聚宝盆",
  3201: "红色万能碎片",
  3302: "橙色万能碎片",
  10002: "蓝玉",
  10003: "红玉",
  10101: "四圣宝珠碎片",
  35002: "刷新券",
  35009: "零件",
};

const tokenStore = useTokenStore();
const message = useMessage();
const mainIconPath = `${import.meta.env.BASE_URL}icons/1733492491706148.png`;
const sessionOpenedAt = ref(Date.now());
const hasRecordedInSession = ref(false);
const hiddenChangeKeys = ref([]);
const selectedRangeKey = ref("week");

const createEmptyEntry = () => ({
  lastOpenedAt: null,
  lastSnapshotAt: null,
  snapshot: {},
  records: [],
  hiddenChangeKeys: [],
});

const entry = ref(createEmptyEntry());

const role = computed(() => tokenStore.gameData?.roleInfo?.role || null);
const liveRoleId = computed(() => {
  const currentRole = role.value;
  if (!currentRole)
    return "";
  return String(currentRole.roleId || "");
});

const scopeRoleIds = computed(() => {
  const selectedToken = tokenStore.selectedToken;
  return Array.from(
    new Set(
      [
        liveRoleId.value,
        selectedToken?.activationRoleId,
        selectedToken?.activationGameAccountId,
        selectedToken?.roleId,
      ]
        .map((roleId) => String(roleId || "").trim())
        .filter(Boolean),
    ),
  );
});

const scopeRoleId = computed(() => {
  return scopeRoleIds.value[0] || "";
});

const scopeKey = computed(() => {
  if (!scopeRoleId.value)
    return "";
  return buildResourceChangeScopeKeyByRoleId(scopeRoleId.value);
});

const selectedRangeLabel = computed(() => {
  const hit = RANGE_OPTIONS.find((item) => item.key === selectedRangeKey.value);
  return hit?.label || "一个月";
});

const shouldHideChangeKey = (key = "") => hiddenChangeKeys.value.includes(key);

const resolveLabel = (key) => {
  if (key === "gold")
    return "金币";
  if (key === "diamond")
    return "金砖";
  if (key === "fish:normalRod")
    return "普通鱼竿";
  if (key === "fish:goldRod")
    return "金鱼竿";

  if (key.startsWith("item:")) {
    const id = Number(key.replace("item:", ""));
    return ITEM_LABELS[id] || `道具 ${id}`;
  }

  return key;
};

const availableChangeItems = computed(() => {
  const keySet = new Set(["diamond", "fish:normalRod", "fish:goldRod"]);

  Object.keys(ITEM_LABELS).forEach((id) => keySet.add(`item:${id}`));
  Object.keys(entry.value.snapshot || {}).forEach((key) => keySet.add(key));

  (entry.value.records || []).forEach((record) => {
    (record?.changes || []).forEach((change) => {
      if (change?.key)
        keySet.add(change.key);
    });
  });

  return Array.from(keySet)
    .map((key) => ({ key, label: resolveLabel(key) }))
    .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
});

const visibilityMenuOptions = computed(() => [
  { label: "全部显示", key: "show-all" },
  { label: "全部隐藏", key: "hide-all" },
  { type: "divider", key: "divider-1" },
  {
    label: "自定义隐藏/显示",
    key: "custom",
    children: availableChangeItems.value.map((item) => ({
      label: `${shouldHideChangeKey(item.key) ? "显示" : "隐藏"} ${item.label}`,
      key: `toggle:${encodeURIComponent(item.key)}`,
    })),
  },
]);

const getStartOfToday = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now.getTime();
};

const getStartOfWeek = () => {
  const now = new Date();
  const dayIndex = (now.getDay() + 6) % 7;
  now.setHours(0, 0, 0, 0);
  now.setDate(now.getDate() - dayIndex);
  return now.getTime();
};

const getStartOfMonth = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  now.setDate(1);
  return now.getTime();
};

const getStartOfQuarter = () => {
  const now = new Date();
  const month = now.getMonth();
  const quarterStartMonth = month - (month % 3);
  const d = new Date(now.getFullYear(), quarterStartMonth, 1, 0, 0, 0, 0);
  return d.getTime();
};

const getStartOfYear = () => {
  const now = new Date();
  const d = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
  return d.getTime();
};

const mapDisplayRecords = (records = []) =>
  records
    .map((record) => ({
      ...record,
      changes: (record.changes || []).filter((change) => !shouldHideChangeKey(change.key)),
    }))
    .filter((record) => record.changes.length > 0);

const getPeriodStart = (key) => {
  if (key === "month")
    return getStartOfMonth();
  if (key === "quarter")
    return getStartOfQuarter();
  if (key === "year")
    return getStartOfYear();
  return getStartOfWeek();
};

const getRecordsSince = (start) =>
  mapDisplayRecords((entry.value.records || []).filter((record) => record.timestamp >= start));

const todayRecords = computed(() => getRecordsSince(getStartOfToday()));
const weekRecords = computed(() => getRecordsSince(getStartOfWeek()));
const selectedRangeRecords = computed(() => getRecordsSince(getPeriodStart(selectedRangeKey.value)));

const countChanges = (records) => records.reduce((acc, record) => acc + record.changes.length, 0);

const aggregateRecords = (records) => {
  const sums = {};

  records.forEach((record) => {
    record.changes.forEach((change) => {
      if (!sums[change.key]) {
        sums[change.key] = { key: change.key, label: change.label, delta: 0 };
      }
      sums[change.key].delta += change.delta;
    });
  });

  return Object.values(sums)
    .filter((item) => item.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
};

const todaySummary = computed(() => aggregateRecords(todayRecords.value));
const weekSummary = computed(() => aggregateRecords(weekRecords.value));
const selectedRangeSummary = computed(() => aggregateRecords(selectedRangeRecords.value));

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

const extractItemIds = (items) => {
  if (!items)
    return [];

  if (Array.isArray(items)) {
    return Array.from(
      new Set(items.map((it) => Number(it?.id ?? it?.itemId)).filter((id) => !Number.isNaN(id))),
    );
  }

  const ids = new Set();
  Object.entries(items).forEach(([rawKey, rawValue]) => {
    const fromKey = Number(rawKey);
    if (!Number.isNaN(fromKey)) {
      ids.add(fromKey);
      return;
    }

    const fromValue = Number(rawValue?.itemId ?? rawValue?.id);
    if (!Number.isNaN(fromValue)) {
      ids.add(fromValue);
    }
  });

  return Array.from(ids);
};

const collectSnapshot = (rawRole) => {
  const snapshot = {};
  snapshot.diamond = Number(rawRole?.diamond ?? 0);

  const items
    = rawRole?.items || rawRole?.itemList || rawRole?.bag?.items || rawRole?.inventory || null;

  const dynamicItemIds = extractItemIds(items);
  const targetIds = Array.from(
    new Set([...Object.keys(ITEM_LABELS).map((id) => Number(id)), ...dynamicItemIds]),
  );

  targetIds.forEach((id) => {
    if (!Object.prototype.hasOwnProperty.call(ITEM_LABELS, id))
      return;
    snapshot[`item:${id}`] = getItemCount(items, id);
  });

  if (!Object.prototype.hasOwnProperty.call(snapshot, "item:1011")) {
    const normalRod = Number(rawRole?.fishing?.normalRod ?? rawRole?.fishing?.rod ?? 0);
    snapshot["fish:normalRod"] = Number.isNaN(normalRod) ? 0 : normalRod;
  }

  if (!Object.prototype.hasOwnProperty.call(snapshot, "item:1012")) {
    const goldRod = Number(rawRole?.fishing?.goldRod ?? rawRole?.fishing?.vipRod ?? 0);
    snapshot["fish:goldRod"] = Number.isNaN(goldRod) ? 0 : goldRod;
  }

  return snapshot;
};

const diffSnapshots = (prev = {}, next = {}) => {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  const changes = [];

  keys.forEach((key) => {
    const before = Number(prev[key] ?? 0);
    const after = Number(next[key] ?? 0);
    const delta = after - before;
    if (delta === 0)
      return;

    changes.push({
      key,
      label: resolveLabel(key),
      before,
      after,
      delta,
    });
  });

  return changes.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
};

const pruneRecords = (records) => {
  const minTime = Date.now() - RETAIN_DAYS * 24 * 60 * 60 * 1000;
  return records
    .filter((record) => record.timestamp >= minTime)
    .slice(0, MAX_RECORDS);
};

const saveEntry = (payload) => {
  if (!scopeKey.value)
    return;
  saveResourceChangeEntry(scopeKey.value, {
    ...payload,
    hiddenChangeKeys: [...hiddenChangeKeys.value],
  });
};

const loadEntry = () => {
  if (!scopeRoleId.value) {
    entry.value = createEmptyEntry();
    hiddenChangeKeys.value = [];
    return;
  }
  const stored = loadResourceChangeEntryByRoleIds(scopeRoleIds.value);
  if (!stored || typeof stored !== "object") {
    entry.value = createEmptyEntry();
    hiddenChangeKeys.value = [];
    return;
  }

  entry.value = {
    lastOpenedAt: stored.lastOpenedAt || null,
    lastSnapshotAt: stored.lastSnapshotAt || null,
    snapshot: stored.snapshot || {},
    records: Array.isArray(stored.records) ? stored.records : [],
    hiddenChangeKeys: Array.isArray(stored.hiddenChangeKeys) ? stored.hiddenChangeKeys : [],
  };
  hiddenChangeKeys.value = [...new Set(entry.value.hiddenChangeKeys.map((it) => String(it)))];
};

const persistHiddenChangeKeys = () => {
  if (!scopeKey.value)
    return;
  saveEntry(entry.value);
};

const handleVisibilityMenuSelect = (actionKey) => {
  if (actionKey === "show-all") {
    hiddenChangeKeys.value = [];
    persistHiddenChangeKeys();
    message.success("已显示全部资源变化");
    return;
  }

  if (actionKey === "hide-all") {
    hiddenChangeKeys.value = availableChangeItems.value.map((item) => item.key);
    persistHiddenChangeKeys();
    message.success("已隐藏全部资源变化");
    return;
  }

  if (!String(actionKey).startsWith("toggle:"))
    return;

  const key = decodeURIComponent(String(actionKey).slice("toggle:".length));
  if (!key)
    return;

  const nextSet = new Set(hiddenChangeKeys.value);
  if (nextSet.has(key)) {
    nextSet.delete(key);
    message.success(`已显示：${resolveLabel(key)}`);
  } else {
    nextSet.add(key);
    message.success(`已隐藏：${resolveLabel(key)}`);
  }

  hiddenChangeKeys.value = Array.from(nextSet);
  persistHiddenChangeKeys();
};

const exportData = async () => {
  try {
    const payload = exportResourceChangeStore();
    const text = JSON.stringify(payload);
    await navigator.clipboard.writeText(text);
    message.success("资源变化数据已复制到剪贴板");
  } catch (error) {
    console.error("导出资源变化数据失败:", error);
    message.error("导出失败，请检查浏览器剪贴板权限");
  }
};

const importData = () => {
  const text = window.prompt("请粘贴资源变化数据(JSON)");
  if (!text)
    return;

  try {
    const parsed = JSON.parse(text);
    const totalScopes = importResourceChangeStore(parsed, { merge: true });
    message.success(`导入成功，当前共 ${totalScopes} 个账号范围数据`);
    startSession();
    recordOpenOnce();
  } catch (error) {
    console.error("导入资源变化数据失败:", error);
    message.error("导入失败，JSON 格式无效");
  }
};

const recordOpenOnce = () => {
  if (hasRecordedInSession.value)
    return;
  if (!scopeKey.value || !role.value)
    return;

  const openedAt = sessionOpenedAt.value;
  const previous = loadResourceChangeEntryByRoleIds(scopeRoleIds.value) || createEmptyEntry();

  const snapshot = collectSnapshot(role.value);
  const hasPreviousSnapshot = previous.snapshot && Object.keys(previous.snapshot).length > 0;

  let records = Array.isArray(previous.records) ? [...previous.records] : [];

  if (hasPreviousSnapshot) {
    const changes = diffSnapshots(previous.snapshot, snapshot);
    if (changes.length > 0) {
      records.unshift({
        timestamp: openedAt,
        changes,
      });
    }
  }

  records = pruneRecords(records);

  saveEntry({
    lastOpenedAt: openedAt,
    lastSnapshotAt: openedAt,
    snapshot,
    records,
  });

  hasRecordedInSession.value = true;
  loadEntry();
};

const startSession = () => {
  sessionOpenedAt.value = Date.now();
  hasRecordedInSession.value = false;
  loadEntry();
};

const formatTime = (timestamp) => {
  if (!timestamp)
    return "-";
  const date = new Date(timestamp);
  return date.toLocaleString();
};

const formatNumber = (value) => Number(value || 0).toLocaleString();
const formatSigned = (value) => {
  const num = Number(value || 0);
  const abs = Math.abs(num).toLocaleString();
  return num > 0 ? `+${abs}` : `-${abs}`;
};

onMounted(async () => {
  await hydrateResourceChangeStoreFromServer();
  startSession();

  if (tokenStore.selectedToken) {
    tokenStore.sendMessage(tokenStore.selectedToken.id, "role_getroleinfo");
  }

  recordOpenOnce();
});

watch(
  () => tokenStore.selectedToken?.id || "",
  async () => {
    await hydrateResourceChangeStoreFromServer();
    startSession();

    if (tokenStore.selectedToken) {
      tokenStore.sendMessage(tokenStore.selectedToken.id, "role_getroleinfo");
    }
  },
);

watch(
  () => role.value,
  () => {
    recordOpenOnce();
  },
  { deep: true },
);
</script>

<style scoped lang="scss">
.resource-changes-card {
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
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.header-main {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
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

.open-time {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--spacing-sm);
}

.summary-item {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-large);
  padding: var(--spacing-md);
}

.summary-title {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.summary-value {
  font-size: 1.1rem;
  font-weight: var(--font-weight-bold);
  margin-top: 2px;
}

.summary-sub {
  margin-top: 4px;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.panes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-sm);
}

.pane,
.detail-block {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-large);
  padding: var(--spacing-md);
}

.pane h4,
.detail-block h4 {
  margin: 0 0 var(--spacing-sm);
}

.detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.period-switch {
  display: inline-flex;
  gap: 6px;
  flex-wrap: wrap;
}

.period-btn {
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
  color: var(--text-secondary);
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
}

.period-btn.active {
  color: var(--primary-color);
  border-color: var(--primary-color);
  background: color-mix(in srgb, var(--primary-color) 10%, var(--bg-primary));
}

.summary-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 8px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.inline-chip {
  background: var(--bg-primary);
  border: 1px solid var(--border-light);
  border-radius: 999px;
  padding: 2px 8px;
}

.empty-state {
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.summary-list,
.record-list,
.record-changes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-row-item,
.change-item,
.record-head {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: var(--font-size-sm);
}

.label {
  color: var(--text-primary);
}

.delta {
  font-variant-numeric: tabular-nums;
  font-weight: var(--font-weight-medium);
}

.delta.up {
  color: #16a34a;
}

.delta.down {
  color: #dc2626;
}

.from-to {
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.record-item {
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  padding: 10px;
  background: var(--bg-primary);
}

@media (max-width: 768px) {
  .resource-changes-card {
    padding: var(--spacing-md);
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .period-switch {
    width: 100%;
    overflow-x: auto;
    flex-wrap: nowrap;
    padding-bottom: 2px;
  }

  .period-btn {
    flex: 0 0 auto;
  }

  .summary-row {
    grid-template-columns: 1fr;
  }

  .panes {
    grid-template-columns: 1fr;
  }

  .record-head {
    flex-wrap: wrap;
  }

  .change-item {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 8px;
  }

  .from-to {
    grid-column: 1 / -1;
    font-size: 12px;
  }
}
</style>
