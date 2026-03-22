<template>
  <div class="changelog-page">
    <div class="changelog-container">
      <!-- 页面头部 -->
      <div class="page-header">
        <div class="back-row">
          <button class="back-btn" type="button" @click="handleBack">
            ← {{ t("notFound.actions.back") }}
          </button>
        </div>
        <div class="header-content">
          <h1 class="page-title">
            <i class="icon-history">📜</i>
            {{ t("changelog.title") }}
          </h1>
          <p class="page-description">{{ t("changelog.description") }}</p>
          <div v-if="isAdmin" class="admin-actions">
            <button
              class="broadcast-btn"
              type="button"
              :disabled="isBroadcasting"
              @click="notifyAllUsers"
            >
              {{
                isBroadcasting
                  ? t("changelog.actions.broadcasting")
                  : t("changelog.actions.broadcastAll")
              }}
            </button>
          </div>
        </div>

        <!-- 筛选器 -->
        <div class="filter-section">
          <div class="filter-group">
            <label>{{ t("changelog.filters.versionType") }}</label>
            <div class="filter-buttons">
              <button
                v-for="type in versionTypes"
                :key="type.value"
                class="filter-btn"
                :class="[{ active: selectedType === type.value }]"
                @click="selectedType = type.value"
              >
                {{ type.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-icon">🚀</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalVersions }}</div>
            <div class="stat-label">{{ t("changelog.stats.totalVersions") }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">✨</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalFeatures }}</div>
            <div class="stat-label">{{ t("changelog.stats.totalFeatures") }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">🐛</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalFixes }}</div>
            <div class="stat-label">{{ t("changelog.stats.totalFixes") }}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon">⬆️</div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.totalImprovements }}</div>
            <div class="stat-label">{{ t("changelog.stats.totalImprovements") }}</div>
          </div>
        </div>
      </div>

      <!-- 更新日志列表 -->
      <div class="changelog-list">
        <transition-group name="changelog-fade">
          <ChangelogCard
            v-for="entry in filteredChangelogs"
            :key="entry.version"
            :entry="entry"
          ></ChangelogCard>
        </transition-group>

        <!-- 空状态 -->
        <div v-if="filteredChangelogs.length === 0" class="empty-state">
          <div class="empty-icon">📭</div>
          <p class="empty-text">{{ t("changelog.empty") }}</p>
          <button class="reset-filter-btn" @click="selectedType = 'all'">
            {{ t("changelog.actions.resetFilter") }}
          </button>
        </div>
      </div>

      <!-- 订阅更新 -->
      <div class="subscribe-section">
        <div class="subscribe-card">
          <div class="subscribe-icon">🔔</div>
        <div class="subscribe-content">
            <h3 class="subscribe-title">{{ t("changelog.subscribe.title") }}</h3>
            <p class="subscribe-desc">{{ t("changelog.subscribe.description") }}</p>
          </div>
          <button class="subscribe-btn" @click="handleSubscribe">
            {{
              isSubscribed
                ? t("changelog.actions.subscribed")
                : t("changelog.actions.subscribe")
            }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import ChangelogCard from "@/components/ChangelogCard.vue";
import { useChangelogStore } from "@/stores/changelogStore";
import { useAuthStore } from "@/stores/auth";
import api from "@/api";

const changelogStore = useChangelogStore();
const authStore = useAuthStore();
const router = useRouter();
const message = useMessage();
const { t } = useI18n();

const selectedType = ref("all");
const isSubscribed = ref(false);
const isBroadcasting = ref(false);
const isAdmin = computed(() => Boolean(authStore.user?.isAdmin));

const versionTypes = computed(() => [
  { value: "all", label: t("changelog.versionTypes.all") },
  { value: "major", label: t("changelog.versionTypes.major") },
  { value: "minor", label: t("changelog.versionTypes.minor") },
  { value: "patch", label: t("changelog.versionTypes.patch") },
  { value: "hotfix", label: t("changelog.versionTypes.hotfix") },
]);

const filteredChangelogs = computed(() => {
  if (selectedType.value === "all") {
    return changelogStore.changelogs;
  }
  return changelogStore.changelogs.filter(
    (changelog) => changelog.type === selectedType.value,
  );
});

const stats = computed(() => ({
  totalVersions: changelogStore.changelogs.length,
  totalFeatures: changelogStore.changelogs.reduce(
    (sum, log) => sum + (log.features?.length || 0),
    0,
  ),
  totalFixes: changelogStore.changelogs.reduce(
    (sum, log) => sum + (log.fixes?.length || 0),
    0,
  ),
  totalImprovements: changelogStore.changelogs.reduce(
    (sum, log) => sum + (log.improvements?.length || 0),
    0,
  ),
}));

const handleSubscribe = () => {
  isSubscribed.value = !isSubscribed.value;
  if (isSubscribed.value) {
    localStorage.setItem("changelog_subscribed", "true");
    message.success(t("changelog.messages.subscribed"));
  } else {
    localStorage.removeItem("changelog_subscribed");
    message.info(t("changelog.messages.unsubscribed"));
  }
};

const notifyAllUsers = async () => {
  if (isBroadcasting.value)
    return;

  const latest = changelogStore.latestVersion;
  if (!latest?.version) {
    message.error(t("changelog.messages.noLatestVersion"));
    return;
  }

  isBroadcasting.value = true;
  try {
    const res = await api.admin.notifyChangelogToAll({
      version: latest.version,
      title: latest.title || `更新日志 ${latest.version}`,
      content: `已发布 ${latest.version} 版本，点击查看详情`,
      path: "/changelog",
    });

    if (!res?.success) {
      message.error(res?.message || t("changelog.messages.broadcastFailed"));
      return;
    }
    message.success(
      t("changelog.messages.broadcastSuccess", {
        count: res?.data?.sentCount ?? 0,
      }),
    );
  } catch (error) {
    message.error(error?.message || t("changelog.messages.broadcastFailed"));
  } finally {
    isBroadcasting.value = false;
  }
};

const handleBack = () => {
  if (window.history.length > 1) {
    router.back();
    return;
  }
  if (authStore.isAuthenticated) {
    router.push("/admin/dashboard");
    return;
  }
  router.push("/");
};

onMounted(() => {
  isSubscribed.value = localStorage.getItem("changelog_subscribed") === "true";
});
</script>

<style scoped lang="scss">
.changelog-page {
  min-height: 100dvh;
  background: transparent;
  padding: 24px var(--spacing-md);
  padding-bottom: calc(var(--spacing-md) + env(safe-area-inset-bottom));
  animation: changelog-fade-in 0.4s ease;
}

.changelog-container {
  max-width: 980px;
  margin: 0 auto;
}

/* 页面头部 */
.page-header {
  margin-bottom: var(--spacing-xl);
  background: var(--surface-glass);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-xl);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(10px);
  padding: var(--spacing-lg);
}

[data-theme="dark"] .page-header {
  background: rgba(18, 32, 58, 0.72);
}

.back-row {
  margin-bottom: var(--spacing-sm);
}

.back-btn {
  min-height: 40px;
  padding: 8px 14px;
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--border-light);
  background: var(--bg-elevated);
  color: var(--text-primary);
  cursor: pointer;
  font-size: var(--font-size-sm);
  transition: all var(--transition-fast);
}

.back-btn:hover {
  border-color: var(--primary-color);
  color: var(--primary-color);
}

.header-content {
  text-align: center;
  margin-bottom: var(--spacing-lg);
}

.admin-actions {
  margin-top: var(--spacing-md);
}

.broadcast-btn {
  min-height: 44px;
  padding: 10px 22px;
  border: none;
  border-radius: var(--border-radius-medium);
  background: linear-gradient(135deg, #0a9153, #2bb673);
  color: #fff;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.broadcast-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(10, 145, 83, 0.28);
}

.broadcast-btn:disabled {
  opacity: 0.72;
  cursor: not-allowed;
}

.page-title {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin: 0 0 var(--spacing-sm) 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-sm);
}

.icon-history {
  font-size: 32px;
}

.page-description {
  font-size: var(--font-size-md);
  color: var(--text-secondary);
  margin: 0;
}

/* 筛选器 */
.filter-section {
  background: var(--surface-glass-strong);
  border-radius: var(--border-radius-large);
  padding: var(--spacing-md);
  border: 1px solid var(--surface-glass-border);
}

.filter-group label {
  display: block;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin-bottom: var(--spacing-sm);
}

.filter-buttons {
  display: flex;
  gap: var(--spacing-xs);
  flex-wrap: wrap;
}

.filter-btn {
  min-height: 44px;
  padding: 10px 14px;
  border: 1px solid var(--border-light);
  background: var(--bg-elevated);
  color: var(--text-secondary);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  transition: all var(--transition-fast);
}

.filter-btn:hover {
  background: var(--bg-tertiary);
  border-color: var(--primary-color);
}

.filter-btn.active {
  background: var(--primary-color);
  color: white;
  border-color: var(--primary-color);
  box-shadow: 0 8px 18px rgba(15, 107, 255, 0.28);
}

/* 统计卡片 */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.stat-card {
  background: var(--surface-glass-strong);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-large);
  padding: var(--spacing-lg);
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  box-shadow: var(--shadow-light);
  transition: all var(--transition-normal);
}

.stat-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-medium);
  border-color: rgba(15, 107, 255, 0.24);
}

.stat-icon {
  font-size: 28px;
}

.stat-content {
  flex: 1;
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
  margin-bottom: 2px;
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

/* 更新日志列表 */
.changelog-list {
  margin-bottom: var(--spacing-xl);
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 52px var(--spacing-lg);
  background: var(--surface-glass-strong);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-large);
  box-shadow: var(--shadow-light);
}

.empty-icon {
  font-size: 56px;
  margin-bottom: var(--spacing-sm);
}

.empty-text {
  color: var(--text-secondary);
  font-size: var(--font-size-md);
  margin: 0 0 var(--spacing-md) 0;
}

.reset-filter-btn {
  min-height: 44px;
  padding: 10px 20px;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: var(--border-radius-medium);
  font-size: var(--font-size-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.reset-filter-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 18px rgba(15, 107, 255, 0.28);
}

/* 订阅部分 */
.subscribe-section {
  margin-top: var(--spacing-xl);
}

.subscribe-card {
  background:
    radial-gradient(
      circle at 84% 24%,
      rgba(255, 255, 255, 0.24),
      transparent 40%
    ),
    linear-gradient(
      135deg,
      var(--primary-color) 0%,
      var(--secondary-color) 100%
    );
  border-radius: var(--border-radius-large);
  padding: 32px;
  display: flex;
  align-items: center;
  gap: 20px;
  box-shadow: var(--shadow-medium);
  border: 1px solid rgba(255, 255, 255, 0.24);
}

.subscribe-icon {
  font-size: 48px;
}

.subscribe-content {
  flex: 1;
}

.subscribe-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
  color: white;
  margin: 0 0 8px 0;
}

.subscribe-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  margin: 0;
}

.subscribe-btn {
  min-height: 44px;
  padding: 12px 32px;
  background: white;
  color: var(--primary-color);
  border: none;
  border-radius: var(--border-radius-medium);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.subscribe-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

/* 过渡动画 */
.changelog-fade-enter-active,
.changelog-fade-leave-active {
  transition: all var(--transition-normal);
}

.changelog-fade-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.changelog-fade-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}

@keyframes changelog-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .changelog-page {
    padding: var(--spacing-md);
  }

  .page-title {
    font-size: var(--font-size-2xl);
  }

  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  .subscribe-card {
    flex-direction: column;
    text-align: center;
    padding: var(--spacing-lg);
  }

  .filter-buttons {
    justify-content: center;
  }
}
</style>
