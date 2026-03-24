<template>
  <div v-if="canAccess" class="feedback-page">
    <div class="container">
      <div class="page-header">
        <div>
          <h1>{{ t("feedbackCenter.title") }}</h1>
          <p>{{ t("feedbackCenter.subtitle") }}</p>
        </div>
        <n-button :loading="loading" @click="fetchFeedbacks">{{ t("feedbackCenter.actions.refresh") }}</n-button>
      </div>

      <n-card embedded class="submit-card">
        <div class="submit-card__title">{{ t("feedbackCenter.submit.title") }}</div>
        <n-form label-placement="top">
          <n-grid :cols="24" :x-gap="12">
            <n-form-item-gi :label="t('feedbackCenter.form.type')" :span="8">
              <n-select
                v-model:value="form.type"
                :options="typeOptions"
                :placeholder="t('feedbackCenter.placeholders.type')"
              ></n-select>
            </n-form-item-gi>
            <n-form-item-gi :label="t('feedbackCenter.form.title')" :span="16">
              <n-input
                show-count
                maxlength="120"
                v-model:value="form.title"
                :placeholder="t('feedbackCenter.placeholders.title')"
              ></n-input>
            </n-form-item-gi>
          </n-grid>
          <n-form-item :label="t('feedbackCenter.form.content')">
            <n-input
              show-count
              maxlength="4000"
              type="textarea"
              v-model:value="form.content"
              :placeholder="t('feedbackCenter.placeholders.content')"
              :rows="4"
            ></n-input>
          </n-form-item>
          <div class="submit-card__actions">
            <n-button
              type="primary"
              :loading="submitting"
              @click="submitFeedback"
            >
              {{ t("feedbackCenter.actions.submit") }}
            </n-button>
          </div>
        </n-form>
      </n-card>

      <n-card embedded class="notify-card">
        <div class="notify-card__head">
          <div class="notify-card__title">{{ t("feedbackCenter.notifications.title") }}</div>
          <div class="notify-card__actions">
            <n-button
              quaternary
              size="small"
              :disabled="!unreadNotifications.length"
              @click="markAllNotificationsRead"
            >
              {{ t("feedbackCenter.notifications.markAllRead") }}
            </n-button>
            <n-button
              quaternary
              size="small"
              :disabled="!notifications.length"
              @click="clearAllNotifications"
            >
              {{ t("feedbackCenter.notifications.clearAll") }}
            </n-button>
          </div>
        </div>
        <div v-if="notifications.length" class="notify-list">
          <div
            v-for="item in notifications"
            :key="item.id"
            class="notify-item"
            :class="{ 'notify-item--unread': !item.isRead }"
          >
            <div class="notify-item__main">
              <strong>{{ item.title }}</strong>
              <p>{{ item.content }}</p>
              <span>{{ formatDate(item.createdAt) }}</span>
            </div>
            <n-button
              v-if="!item.isRead"
              tertiary
              size="small"
              @click="markNotificationRead(item.id)"
            >
              {{ t("feedbackCenter.notifications.markRead") }}
            </n-button>
          </div>
        </div>
        <n-empty v-else :description="t('feedbackCenter.notifications.empty')"></n-empty>
      </n-card>

      <div class="list-toolbar">
        <n-select
          class="list-toolbar__filter"
          v-model:value="statusFilter"
          :options="statusFilterOptions"
        ></n-select>
        <span class="list-toolbar__count">{{ t("feedbackCenter.list.count", { count: feedbacks.length }) }}</span>
      </div>

      <n-spin :show="loading">
        <div v-if="feedbacks.length" class="feedback-list">
          <n-card
            v-for="item in feedbacks"
            :key="item.id"
            embedded
            class="feedback-item"
          >
            <div class="feedback-item__head">
              <div class="feedback-item__meta">
                <span class="chip chip--type">{{
                  typeLabelMap[item.type] || item.type
                }}</span>
                <span class="chip" :class="`chip--${item.status}`">
                  {{ statusLabelMap[item.status] || item.status }}
                </span>
                <span v-if="authStore.user?.isAdmin" class="owner">
                  {{ t("feedbackCenter.list.submitter", { username: item.username }) }}
                </span>
              </div>
              <span class="time">{{ formatDate(item.createdAt) }}</span>
            </div>

            <h3 class="feedback-item__title">{{ item.title }}</h3>
            <p class="feedback-item__content">{{ item.content }}</p>

            <div v-if="item.adminNote" class="admin-note">
              <strong>{{ t("feedbackCenter.list.adminNote") }}</strong>{{ item.adminNote }}
            </div>

            <div v-if="authStore.user?.isAdmin" class="admin-actions">
              <n-button tertiary type="primary" @click="goAdminTickets">
                {{ t("feedbackCenter.actions.goAdminTickets") }}
              </n-button>
            </div>
          </n-card>
        </div>

        <n-empty
          v-else-if="!loading"
          class="empty"
          :description="t('feedbackCenter.list.empty')"
        ></n-empty>
      </n-spin>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, reactive, ref, watch } from "vue";
import { useDialog, useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import api from "@/api";
import { useAuthStore } from "@/stores/auth";

const message = useMessage();
const dialog = useDialog();
const { locale, t } = useI18n();
const router = useRouter();
const authStore = useAuthStore();

const loading = ref(false);
const submitting = ref(false);
const feedbacks = ref([]);
const statusFilter = ref("all");
const notifications = ref([]);

const form = reactive({
  type: "bug",
  title: "",
  content: "",
});

const typeOptions = [
  { label: "Bug", value: "bug" },
  { label: t("feedbackCenter.options.type.feature"), value: "feature" },
  { label: t("feedbackCenter.options.type.other"), value: "other" },
];

const statusOptions = [
  { label: t("feedbackCenter.options.status.open"), value: "open" },
  { label: t("feedbackCenter.options.status.inProgress"), value: "in_progress" },
  { label: t("feedbackCenter.options.status.resolved"), value: "resolved" },
];

const statusFilterOptions = [
  { label: t("feedbackCenter.options.status.all"), value: "all" },
  ...statusOptions,
];

const typeLabelMap = {
  bug: "Bug",
  feature: t("feedbackCenter.options.type.feature"),
  other: t("feedbackCenter.options.type.other"),
};

const statusLabelMap = {
  open: t("feedbackCenter.options.status.open"),
  in_progress: t("feedbackCenter.options.status.inProgress"),
  resolved: t("feedbackCenter.options.status.resolved"),
};

const canAccess = computed(() => authStore.isAuthenticated);
const unreadNotifications = computed(() =>
  notifications.value.filter((item) => !item.isRead),
);

const formatDate = (value) =>
  value ? new Date(value).toLocaleString(locale.value) : t("feedbackCenter.common.dash");

const fetchFeedbacks = async () => {
  loading.value = true;
  try {
    const status = statusFilter.value === "all" ? "" : statusFilter.value;
    const res = await api.feedback.list(status);
    if (!res.success) {
      message.error(res.message || t("feedbackCenter.messages.loadFailed"));
      return;
    }
    feedbacks.value = Array.isArray(res.data) ? res.data : [];
  } catch (error) {
    message.error(error.message || t("feedbackCenter.messages.loadFailed"));
  } finally {
    loading.value = false;
  }
};

const fetchNotifications = async () => {
  try {
    const res = await api.notifications.list({ limit: 20 });
    if (!res.success) {
      return;
    }
    notifications.value = Array.isArray(res.data) ? res.data : [];
  } catch {
    // ignore notification fetch errors
  }
};

const submitFeedback = async () => {
  if (!form.title.trim()) {
    message.warning(t("feedbackCenter.messages.fillTitle"));
    return;
  }
  if (!form.content.trim()) {
    message.warning(t("feedbackCenter.messages.fillContent"));
    return;
  }

  submitting.value = true;
  try {
    const res = await api.feedback.create({
      type: form.type,
      title: form.title.trim(),
      content: form.content.trim(),
    });
    if (!res.success) {
      message.error(res.message || t("feedbackCenter.messages.submitFailed"));
      return;
    }
    message.success(t("feedbackCenter.messages.submitSuccess"));
    form.type = "bug";
    form.title = "";
    form.content = "";
    fetchFeedbacks();
    fetchNotifications();
  } catch (error) {
    message.error(error.message || t("feedbackCenter.messages.submitFailed"));
  } finally {
    submitting.value = false;
  }
};

const goAdminTickets = () => {
  router.push("/admin/feedback-tickets");
};

const markNotificationRead = async (id) => {
  try {
    const res = await api.notifications.markRead(id);
    if (!res.success) {
      message.error(res.message || t("feedbackCenter.messages.operationFailed"));
      return;
    }
    fetchNotifications();
  } catch (error) {
    message.error(error.message || t("feedbackCenter.messages.operationFailed"));
  }
};

const markAllNotificationsRead = async () => {
  try {
    const res = await api.notifications.markAllRead();
    if (!res.success) {
      message.error(res.message || t("feedbackCenter.messages.operationFailed"));
      return;
    }
    message.success(t("feedbackCenter.messages.notificationsMarkedAllRead"));
    fetchNotifications();
  } catch (error) {
    message.error(error.message || t("feedbackCenter.messages.operationFailed"));
  }
};

const clearAllNotifications = () => {
  dialog.warning({
    title: t("feedbackCenter.notifications.clearAllTitle"),
    content: t("feedbackCenter.notifications.clearAllContent"),
    positiveText: t("feedbackCenter.notifications.clearAllConfirm"),
    negativeText: t("common.cancel"),
    onPositiveClick: async () => {
      try {
        const res = await api.notifications.clearAll();
        if (!res.success) {
          message.error(res.message || t("feedbackCenter.messages.operationFailed"));
          return;
        }
        notifications.value = [];
        message.success(res.message || t("feedbackCenter.messages.notificationsCleared"));
      } catch (error) {
        message.error(error.message || t("feedbackCenter.messages.operationFailed"));
      }
    },
  });
};

watch(statusFilter, () => {
  fetchFeedbacks();
});

onMounted(async () => {
  await authStore.initAuth();
  if (!canAccess.value) {
    router.replace("/login");
    return;
  }
  fetchFeedbacks();
  fetchNotifications();
});
</script>

<style scoped lang="scss">
.feedback-page {
  min-height: 100dvh;
  padding: 16px 0;
  animation: feedback-fade-in 0.42s ease;
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
  backdrop-filter: blur(12px);
  box-shadow: var(--shadow-light);
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

.submit-card {
  margin-bottom: 12px;
  border-radius: 16px;
}

.notify-card {
  margin-bottom: 12px;
  border-radius: 16px;
}

.notify-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.notify-card__title {
  font-weight: 700;
  color: var(--text-primary);
}

.notify-list {
  display: grid;
  gap: 8px;
}

.notify-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  justify-content: space-between;
  padding: 10px;
  border-radius: 10px;
  background: var(--surface-glass-strong);
  border: 1px solid var(--border-light);
  transition: all var(--transition-fast);
}

.notify-item:hover {
  border-color: rgba(15, 107, 255, 0.26);
  transform: translateY(-1px);
}

.notify-item--unread {
  background: rgba(15, 107, 255, 0.08);
  border-color: rgba(15, 107, 255, 0.28);
}

.notify-item__main p {
  margin: 4px 0;
  color: var(--text-secondary);
}

.notify-item__main span {
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.submit-card__title {
  font-weight: 700;
  margin-bottom: 10px;
  color: var(--text-primary);
}

.submit-card__actions {
  display: flex;
  justify-content: flex-end;
}

.list-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.list-toolbar__filter {
  width: 190px;
}

.list-toolbar__count {
  color: var(--text-secondary);
  font-size: 13px;
}

.feedback-list {
  display: grid;
  gap: 10px;
}

.feedback-item {
  border-radius: 14px;
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass-strong);
  transition: all var(--transition-fast);
}

.feedback-item:hover {
  border-color: rgba(15, 107, 255, 0.28);
  box-shadow: var(--shadow-light);
}

.feedback-item__head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
}

.feedback-item__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.feedback-item__title {
  margin: 10px 0 6px;
  font-size: 16px;
  color: var(--text-primary);
}

.feedback-item__content {
  margin: 0;
  white-space: pre-wrap;
  color: var(--text-secondary);
}

.admin-note {
  margin-top: 10px;
  padding: 10px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.admin-actions {
  margin-top: 10px;
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
  font-size: 12px;
  color: var(--text-tertiary);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.empty {
  padding: 20px 0;
}

@media (max-width: 768px) {
  .feedback-page :deep(.n-button) {
    min-height: 40px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .notify-card__head {
    gap: 10px;
    flex-wrap: wrap;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
    padding: var(--spacing-md);
  }

  .list-toolbar {
    flex-direction: column;
    align-items: stretch;
  }

  .list-toolbar__filter {
    width: 100%;
  }

  .feedback-item__head {
    flex-direction: column;
  }
}

:deep(.submit-card.n-card),
:deep(.notify-card.n-card) {
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass-strong);
  backdrop-filter: blur(12px);
}

@keyframes feedback-fade-in {
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
