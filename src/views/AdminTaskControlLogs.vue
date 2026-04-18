<template>
  <div v-if="canAccess" class="admin-task-logs-page admin-surface-page">
    <div class="container">
      <div class="page-header">
        <div class="page-header__main">
          <h1>后端任务日志</h1>
          <p>仅管理员可见：查看所有账号的后端任务执行日志</p>
        </div>
        <div class="page-header__actions">
          <n-button secondary @click="resetFilters">重置筛选</n-button>
          <n-button type="primary" :loading="loading" @click="fetchLogs">刷新</n-button>
        </div>
      </div>

      <div class="page-overview">
        <div class="overview-card">
          <span class="overview-label">日志总数</span>
          <strong class="overview-value">{{ logs.length }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">涉及账号</span>
          <strong class="overview-value">{{ distinctUserCount }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">启用筛选</span>
          <strong class="overview-value">{{ activeFilterCount }}</strong>
        </div>
        <div class="overview-card">
          <span class="overview-label">读取上限</span>
          <strong class="overview-value">{{ limitValue }}</strong>
        </div>
      </div>

      <div class="status-list">
        <div
          v-for="item in statusSummary"
          :key="item.key"
          class="status-list__item"
          :class="`status-list__item--${item.key}`"
        >
          <div class="status-list__meta">
            <span class="status-list__dot"></span>
            <span class="status-list__label">{{ item.label }}</span>
          </div>
          <strong class="status-list__count">{{ item.count }}</strong>
        </div>
      </div>

      <div class="toolbar toolbar--logs">
        <div class="toolbar__field">
          <span class="toolbar__label">账号筛选</span>
          <n-input
            clearable
            placeholder="按账号名筛选"
            v-model:value="filters.username"
            @keydown.enter.prevent="fetchLogs"
          ></n-input>
        </div>
        <div class="toolbar__field">
          <span class="toolbar__label">任务筛选</span>
          <n-input
            clearable
            placeholder="按任务名筛选"
            v-model:value="filters.taskName"
            @keydown.enter.prevent="fetchLogs"
          ></n-input>
        </div>
        <div class="toolbar__field toolbar__field--compact">
          <span class="toolbar__label">状态</span>
          <n-select
            clearable
            placeholder="按状态筛选"
            v-model:value="filters.status"
            :options="statusOptions"
          ></n-select>
        </div>
        <div class="toolbar__field toolbar__field--wide">
          <span class="toolbar__label">日志内容</span>
          <n-input
            clearable
            placeholder="按日志内容筛选"
            v-model:value="filters.message"
            @keydown.enter.prevent="fetchLogs"
          ></n-input>
        </div>
        <div class="toolbar__field toolbar__field--compact">
          <span class="toolbar__label">读取条数</span>
          <n-input-number
            placeholder="条数"
            v-model:value="filters.limit"
            :max="2000"
            :min="50"
            :step="50"
          ></n-input-number>
        </div>
      </div>

      <n-spin :show="loading">
        <n-card v-if="!isMobile" embedded class="desktop-only desktop-table-card">
          <div class="desktop-table-card__header">
            <h3>执行日志列表</h3>
            <span>共 {{ logs.length }} 条，按时间倒序展示</span>
          </div>
          <n-data-table
            size="small"
            :bordered="false"
            :columns="columns"
            :data="logs"
            :pagination="{ pageSize: 30, pageSizes: [30, 50, 100, 200], showSizePicker: true }"
          ></n-data-table>
        </n-card>

        <div v-else class="mobile-only mobile-log-list">
          <n-card
            v-for="item in logs"
            :key="item.id"
            embedded
            class="mobile-log-card"
            size="small"
          >
            <div class="mobile-log-card__head">
              <span class="mobile-log-card__time">{{ formatDate(item.createdAt) }}</span>
              <span
                class="status-chip"
                :class="{
                  'status-chip--active': item.status === 'success',
                  'status-chip--used': item.status === 'warning',
                  'status-chip--off': item.status === 'error',
                }"
              >
                {{ statusMap[item.status]?.label || item.status || "-" }}
              </span>
            </div>

            <div class="mobile-log-card__meta">
              <div class="info-block">
                <span class="info-label">账号</span>
                <strong>{{ item.username || item.userId || "-" }}</strong>
              </div>
              <div class="info-block">
                <span class="info-label">任务</span>
                <strong>{{ item.taskName || item.taskId || "-" }}</strong>
              </div>
            </div>

            <div class="mobile-log-card__message">
              {{ maskTokenHints(item.message || "-") }}
            </div>
          </n-card>

          <n-empty v-if="!loading && logs.length === 0" description="暂无日志"></n-empty>
        </div>
      </n-spin>
    </div>
  </div>
</template>

<script setup>
import { computed, h, onMounted, onUnmounted, reactive, ref } from "vue";
import { useMessage } from "naive-ui";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";
import api from "@/api";

const authStore = useAuthStore();
const router = useRouter();
const message = useMessage();

const loading = ref(false);
const logs = ref([]);
const isMobile = ref(false);
const DEFAULT_LIMIT = 500;
const filters = reactive({
  username: "",
  taskName: "",
  status: "",
  message: "",
  limit: DEFAULT_LIMIT,
});

const canAccess = computed(
  () => authStore.isAuthenticated && Boolean(authStore.user?.isAdmin),
);

const updateMobileFlag = () => {
  isMobile.value = window.innerWidth <= 768;
};

const statusOptions = [
  { label: "全部状态", value: "" },
  { label: "信息", value: "info" },
  { label: "成功", value: "success" },
  { label: "警告", value: "warning" },
  { label: "错误", value: "error" },
];

const statusMap = {
  info: { label: "信息", type: "default" },
  success: { label: "成功", type: "success" },
  warning: { label: "警告", type: "warning" },
  error: { label: "错误", type: "error" },
};

const limitValue = computed(() => {
  const value = Number(filters.limit);
  if (!Number.isFinite(value)) {
    return DEFAULT_LIMIT;
  }
  return Math.min(2000, Math.max(50, value));
});

const activeFilterCount = computed(() => {
  const filterCount = [
    filters.username,
    filters.taskName,
    filters.status,
    filters.message,
  ].filter((value) => String(value || "").trim()).length;
  return filterCount + (limitValue.value !== DEFAULT_LIMIT ? 1 : 0);
});

const distinctUserCount = computed(() => {
  const values = logs.value
    .map((item) => String(item.username || item.userId || "").trim())
    .filter(Boolean);
  return new Set(values).size;
});

const statusSummary = computed(() => {
  const counts = {
    info: 0,
    success: 0,
    warning: 0,
    error: 0,
  };

  logs.value.forEach((item) => {
    const key = String(item.status || "info");
    if (Object.prototype.hasOwnProperty.call(counts, key)) {
      counts[key] += 1;
    }
  });

  return [
    { key: "info", label: "信息", count: counts.info },
    { key: "success", label: "成功", count: counts.success },
    { key: "warning", label: "警告", count: counts.warning },
    { key: "error", label: "错误", count: counts.error },
  ];
});

const maskTokenId = (tokenId) => {
  const value = String(tokenId || "").trim();
  if (!value)
    return "***";
  if (value.length <= 8)
    return `${value.slice(0, 2)}***`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
};

const maskTokenHints = (messageText) =>
  String(messageText || "").replace(
    /token:([\w-]+)/g,
    (_, tokenId) => `token:${maskTokenId(tokenId)}`,
  );

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("zh-CN") : "-";

const renderStatusChip = (status) => {
  const normalized = String(status || "info");
  const meta = statusMap[normalized] || { label: normalized || "-", type: "default" };
  const className = [
    "status-chip",
    normalized === "success"
      ? "status-chip--active"
      : normalized === "warning"
        ? "status-chip--used"
        : normalized === "error"
          ? "status-chip--off"
          : "",
  ].filter(Boolean);
  return h("span", { class: className }, meta.label);
};

const columns = [
  {
    title: "时间",
    key: "createdAt",
    width: 170,
    render: (row) => formatDate(row.createdAt),
  },
  {
    title: "账号",
    key: "username",
    width: 120,
    render: (row) => row.username || row.userId || "-",
  },
  {
    title: "任务",
    key: "taskName",
    width: 140,
    render: (row) => row.taskName || row.taskId || "-",
  },
  {
    title: "状态",
    key: "status",
    width: 90,
    render: (row) => renderStatusChip(row.status),
  },
  {
    title: "详情",
    key: "message",
    minWidth: 560,
    render: (row) => maskTokenHints(row.message || "-"),
    ellipsis: {
      tooltip: true,
    },
  },
];

const fetchLogs = async () => {
  loading.value = true;
  try {
    const res = await api.admin.listTaskControlLogs({
      limit: limitValue.value,
      username: filters.username,
      taskName: filters.taskName,
      status: filters.status,
      message: filters.message,
    });
    if (!res.success) {
      message.error(res.message || "加载日志失败");
      return;
    }
    logs.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    message.error(error.message || "加载日志失败");
  } finally {
    loading.value = false;
  }
};

const resetFilters = () => {
  filters.username = "";
  filters.taskName = "";
  filters.status = "";
  filters.message = "";
  filters.limit = DEFAULT_LIMIT;
  fetchLogs();
};

onMounted(async () => {
  await authStore.initAuth();
  if (!canAccess.value) {
    router.replace("/admin/dashboard");
    return;
  }
  updateMobileFlag();
  window.addEventListener("resize", updateMobileFlag);
  fetchLogs();
});

onUnmounted(() => {
  window.removeEventListener("resize", updateMobileFlag);
});
</script>

<style scoped lang="scss">
.admin-task-logs-page.admin-surface-page {
  .container {
    max-width: 1480px;
    padding: 0 16px;
    display: grid;
    gap: 16px;
  }

  .page-header {
    margin-bottom: 0;
  }

  .toolbar--logs {
    padding: 16px;
    border-radius: 22px;
  }

  .desktop-table-card {
    border-radius: 24px;
  }

  .desktop-table-card__header {
    padding-bottom: 14px;
    margin-bottom: 14px;
    border-bottom: 1px solid var(--console-divider);
  }

  .mobile-log-list {
    gap: 14px;
  }

  .mobile-log-card {
    border-radius: 22px;
  }
}

.admin-task-logs-page {
  min-height: 100dvh;
  padding: 16px 0;
}

.container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 14px;
}

.page-header__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 10px;
}

.toolbar--logs {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: 12px;
}

.toolbar__field {
  display: grid;
  gap: 8px;
  min-width: 0;
  grid-column: span 3;
}

.toolbar__field--compact {
  grid-column: span 2;
}

.toolbar__field--wide {
  grid-column: span 4;
}

.toolbar__label {
  font-size: 12px;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: var(--font-family-mono);
}

.toolbar--logs :deep(.n-input-number) {
  width: 100%;
}

.desktop-only {
  display: block;
}

.mobile-only {
  display: none;
}

.mobile-log-list {
  display: grid;
  gap: 12px;
}

.mobile-log-card {
  border-radius: 20px;
}

.mobile-log-card :deep(.n-card__content) {
  display: grid;
  gap: 14px;
}

.mobile-log-card__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.mobile-log-card__time {
  font-size: 12px;
  color: var(--text-secondary);
}

.mobile-log-card__meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.mobile-log-card__message {
  padding: 12px 14px;
  border-radius: 16px;
  background: var(--console-panel);
  color: var(--text-primary);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.status-list__item--success .status-list__dot {
  background: var(--success-color);
}

.status-list__item--warning .status-list__dot {
  background: var(--warning-color);
}

.status-list__item--info .status-list__dot {
  background: var(--primary-color);
}

@media (max-width: 1024px) {
  .toolbar__field,
  .toolbar__field--compact,
  .toolbar__field--wide {
    grid-column: span 6;
  }
}

@media (max-width: 768px) {
  .toolbar__field,
  .toolbar__field--compact,
  .toolbar__field--wide {
    grid-column: 1 / -1;
  }

  .desktop-only {
    display: none;
  }

  .mobile-only {
    display: block;
  }

  .mobile-log-card__meta {
    grid-template-columns: 1fr;
  }
}
</style>
