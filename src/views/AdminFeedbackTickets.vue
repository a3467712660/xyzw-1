<template>
  <div v-if="canAccess" class="admin-feedback-page">
    <div class="container">
      <div class="page-header">
        <div>
          <h1>工单管理</h1>
          <p>仅管理员可见：统一处理用户反馈与需求工单</p>
        </div>
        <n-button :loading="loading" @click="fetchFeedbacks">刷新</n-button>
      </div>

      <div class="toolbar">
        <n-select
          class="toolbar__filter"
          v-model:value="statusFilter"
          :options="statusFilterOptions"
        ></n-select>
        <span class="toolbar__count">共 {{ feedbacks.length }} 条</span>
      </div>

      <n-spin :show="loading">
        <div v-if="feedbacks.length" class="ticket-list">
          <n-card
            v-for="item in feedbacks"
            :key="item.id"
            embedded
            class="ticket-item"
          >
            <div class="ticket-item__head">
              <div class="ticket-item__meta">
                <span class="chip chip--type">{{
                  typeLabelMap[item.type] || item.type
                }}</span>
                <span class="chip" :class="`chip--${item.status}`">
                  {{ statusLabelMap[item.status] || item.status }}
                </span>
                <span class="owner">提交人：{{ item.username || "-" }}</span>
              </div>
              <span class="time">{{ formatDate(item.createdAt) }}</span>
            </div>

            <h3 class="ticket-item__title">{{ item.title }}</h3>
            <p class="ticket-item__content">{{ item.content }}</p>

            <div class="ticket-item__actions">
              <n-select
                class="ticket-item__status"
                :options="statusOptions"
                :value="statusDraftMap[item.id]"
                @update:value="(value) => (statusDraftMap[item.id] = value)"
              ></n-select>
              <n-input
                placeholder="管理员备注（工单处理说明）"
                type="textarea"
                :rows="2"
                :value="noteDraftMap[item.id]"
                @update:value="(value) => (noteDraftMap[item.id] = value)"
              ></n-input>
              <div class="ticket-item__button-row">
                <n-button
                  type="primary"
                  :loading="Boolean(savingMap[item.id])"
                  @click="updateTicket(item.id)"
                >
                  保存
                </n-button>
              </div>
            </div>
          </n-card>
        </div>

        <n-empty v-else-if="!loading" class="empty" description="暂无工单"></n-empty>
      </n-spin>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useAuthStore } from "@/stores/auth";
import { useRouter } from "vue-router";
import api from "@/api";

const message = useMessage();
const authStore = useAuthStore();
const router = useRouter();

const loading = ref(false);
const feedbacks = ref([]);
const statusFilter = ref("all");
const statusDraftMap = reactive({});
const noteDraftMap = reactive({});
const savingMap = reactive({});

const canAccess = computed(
  () => authStore.isAuthenticated && Boolean(authStore.user?.isAdmin),
);

const typeLabelMap = {
  bug: "Bug",
  feature: "需求",
  other: "其他",
};

const statusLabelMap = {
  open: "待处理",
  in_progress: "处理中",
  resolved: "已完成",
};

const statusOptions = [
  { label: "待处理", value: "open" },
  { label: "处理中", value: "in_progress" },
  { label: "已完成", value: "resolved" },
];

const statusFilterOptions = [
  { label: "全部状态", value: "all" },
  ...statusOptions,
];

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("zh-CN") : "-";

const syncDrafts = (rows) => {
  const ids = new Set(rows.map((row) => row.id));
  Object.keys(statusDraftMap).forEach((id) => {
    if (!ids.has(id))
      delete statusDraftMap[id];
  });
  Object.keys(noteDraftMap).forEach((id) => {
    if (!ids.has(id))
      delete noteDraftMap[id];
  });

  rows.forEach((item) => {
    statusDraftMap[item.id] = item.status || "open";
    noteDraftMap[item.id] = item.adminNote || "";
  });
};

const fetchFeedbacks = async () => {
  loading.value = true;
  try {
    const status = statusFilter.value === "all" ? "" : statusFilter.value;
    const res = await api.feedback.list(status);
    if (!res.success) {
      message.error(res.message || "加载工单失败");
      return;
    }
    feedbacks.value = Array.isArray(res.data) ? res.data : [];
    syncDrafts(feedbacks.value);
  } catch (error) {
    message.error(error.message || "加载工单失败");
  } finally {
    loading.value = false;
  }
};

const updateTicket = async (id) => {
  const status = String(statusDraftMap[id] || "").trim();
  if (!status) {
    message.warning("请选择状态");
    return;
  }

  savingMap[id] = true;
  try {
    const res = await api.feedback.updateByAdmin(id, {
      status,
      adminNote: String(noteDraftMap[id] || "").trim(),
    });
    if (!res.success) {
      message.error(res.message || "保存失败");
      return;
    }
    message.success("工单已更新");
    fetchFeedbacks();
  } catch (error) {
    message.error(error.message || "保存失败");
  } finally {
    savingMap[id] = false;
  }
};

watch(statusFilter, () => {
  fetchFeedbacks();
});

onMounted(async () => {
  await authStore.initAuth();
  if (!canAccess.value) {
    router.replace("/admin/dashboard");
    return;
  }
  fetchFeedbacks();
});
</script>

<style scoped lang="scss">
.admin-feedback-page {
  min-height: 100dvh;
  padding: 16px 0;
  animation: admin-ticket-fade-in 0.4s ease;
}

.container {
  max-width: 1080px;
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
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.toolbar__filter {
  width: 200px;
}

.toolbar__count {
  color: var(--text-secondary);
  font-size: 13px;
}

.ticket-list {
  display: grid;
  gap: 10px;
}

.ticket-item {
  border-radius: 14px;
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass-strong);
  transition: all var(--transition-fast);
}

.ticket-item:hover {
  border-color: rgba(15, 107, 255, 0.28);
  box-shadow: var(--shadow-light);
}

.ticket-item__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.ticket-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ticket-item__title {
  margin: 10px 0 6px;
  font-size: 16px;
  color: var(--text-primary);
}

.ticket-item__content {
  margin: 0;
  white-space: pre-wrap;
  color: var(--text-secondary);
}

.ticket-item__actions {
  margin-top: 10px;
  display: grid;
  gap: 8px;
}

.ticket-item__status {
  max-width: 180px;
}

.ticket-item__button-row {
  display: flex;
  justify-content: flex-end;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  padding: 3px 10px;
  font-size: 12px;
  font-weight: 700;
}

.chip--type {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
}

.chip--open {
  background: #fee2e2;
  color: #991b1b;
}

.chip--in_progress {
  background: #fef3c7;
  color: #92400e;
}

.chip--resolved {
  background: #dcfce7;
  color: #166534;
}

.time,
.owner {
  color: var(--text-tertiary);
  font-size: 12px;
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.empty {
  padding: 20px 0;
}

@media (max-width: 768px) {
  .page-header,
  .toolbar,
  .ticket-item__head {
    flex-direction: column;
    align-items: stretch;
  }

  .toolbar__filter {
    width: 100%;
  }

  .page-header {
    padding: var(--spacing-md);
  }
}

@keyframes admin-ticket-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
