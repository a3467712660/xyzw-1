<template>
  <div v-if="canAccess" class="admin-task-logs-page">
    <div class="container">
      <div class="page-header">
        <div>
          <h1>后端任务日志</h1>
          <p>仅管理员可见：查看所有账号的后端任务执行日志</p>
        </div>
        <n-space>
          <n-button secondary @click="resetFilters">重置筛选</n-button>
          <n-button type="primary" :loading="loading" @click="fetchLogs">刷新</n-button>
        </n-space>
      </div>

      <div class="toolbar">
        <n-input
          clearable
          placeholder="按账号名筛选"
          v-model:value="filters.username"
          @keydown.enter.prevent="fetchLogs"
        ></n-input>
        <n-input
          clearable
          placeholder="按任务名筛选"
          v-model:value="filters.taskName"
          @keydown.enter.prevent="fetchLogs"
        ></n-input>
        <n-select
          clearable
          placeholder="按状态筛选"
          v-model:value="filters.status"
          :options="statusOptions"
        ></n-select>
        <n-input
          clearable
          placeholder="按日志内容筛选"
          v-model:value="filters.message"
          @keydown.enter.prevent="fetchLogs"
        ></n-input>
        <n-input-number
          placeholder="条数"
          v-model:value="filters.limit"
          :max="2000"
          :min="50"
          :step="50"
        ></n-input-number>
      </div>

      <div class="meta-row">
        <span>共 {{ logs.length }} 条</span>
      </div>

      <n-spin :show="loading">
        <n-data-table
          v-if="!isMobile"
          size="small"
          :bordered="false"
          :columns="columns"
          :data="logs"
          :pagination="{ pageSize: 30, pageSizes: [30, 50, 100, 200], showSizePicker: true }"
        ></n-data-table>
        <div v-else class="mobile-list">
          <n-card
            v-for="item in logs"
            :key="item.id"
            embedded
            class="mobile-item"
            size="small"
          >
            <div class="mobile-item__head">
              <span class="mobile-item__time">{{ formatDate(item.createdAt) }}</span>
              <NTag
                size="small"
                :bordered="false"
                :type="statusMap[item.status]?.type || 'default'"
              >
                {{ statusMap[item.status]?.label || item.status || "-" }}
              </NTag>
            </div>
            <div class="mobile-item__meta">
              <span>账号：{{ item.username || item.userId || "-" }}</span>
              <span>任务：{{ item.taskName || item.taskId || "-" }}</span>
            </div>
            <div class="mobile-item__message">{{ maskTokenHints(item.message || "-") }}</div>
          </n-card>
          <n-empty v-if="!loading && logs.length === 0" description="暂无日志"></n-empty>
        </div>
      </n-spin>
    </div>
  </div>
</template>

<script setup>
import { computed, h, onMounted, onUnmounted, reactive, ref } from "vue";
import { NTag, useMessage } from "naive-ui";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";
import api from "@/api";

const authStore = useAuthStore();
const router = useRouter();
const message = useMessage();

const loading = ref(false);
const logs = ref([]);
const isMobile = ref(false);
const filters = reactive({
  username: "",
  taskName: "",
  status: "",
  message: "",
  limit: 500,
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
    render: (row) => {
      const st = statusMap[row.status] || { label: row.status || "-", type: "default" };
      return h(
        NTag,
        { size: "small", bordered: false, type: st.type },
        { default: () => st.label },
      );
    },
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
      limit: filters.limit,
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
  filters.limit = 500;
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
.admin-task-logs-page {
  min-height: 100dvh;
  padding: 16px 0;
}

.container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 14px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-xl);
  background: var(--surface-glass);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(12px);
  padding: var(--spacing-lg);
}

.page-header h1 {
  margin: 0;
  color: var(--text-primary);
}

.page-header p {
  margin: 4px 0 0;
  color: var(--text-secondary);
}

.toolbar {
  display: grid;
  grid-template-columns: 1fr 1fr 180px 2fr 140px;
  gap: 10px;
  margin-bottom: 10px;
}

.meta-row {
  color: var(--text-secondary);
  margin-bottom: 8px;
}

@media (max-width: 1024px) {
  .toolbar {
    grid-template-columns: 1fr;
  }
}

.mobile-list {
  display: grid;
  gap: 10px;
}

.mobile-item {
  border-radius: 12px;
}

.mobile-item__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.mobile-item__time {
  font-size: 12px;
  color: var(--text-secondary);
}

.mobile-item__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.mobile-item__message {
  font-size: 13px;
  color: var(--text-primary);
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
