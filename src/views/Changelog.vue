<template>
  <div class="public-support-page changelog-page">
    <div aria-hidden="true" class="public-support-page__backdrop"></div>

    <div class="public-support-container">
      <section class="public-support-panel changelog-page__hero">
        <div class="changelog-page__hero-top">
          <div class="changelog-page__hero-copy">
            <span class="public-support-eyebrow">更新记录</span>
            <h1 class="public-support-title">{{ t("changelog.title") }}</h1>
            <p class="public-support-description">{{ t("changelog.description") }}</p>
          </div>

          <div class="public-support-actions changelog-page__hero-actions">
            <n-button secondary @click="handleBack">
              <template #icon>
                <n-icon><ChevronBackOutline></ChevronBackOutline></n-icon>
              </template>
              {{ t("notFound.actions.back") }}
            </n-button>
            <n-button
              v-if="isAdmin"
              type="primary"
              :loading="isBroadcasting"
              @click="notifyAllUsers"
            >
              <template #icon>
                <n-icon><MegaphoneOutline></MegaphoneOutline></n-icon>
              </template>
              {{
                isBroadcasting
                  ? t("changelog.actions.broadcasting")
                  : t("changelog.actions.broadcastAll")
              }}
            </n-button>
          </div>
        </div>

        <div class="changelog-page__summary">
          <article
            v-for="item in summaryCards"
            :key="item.label"
            class="changelog-page__summary-card"
          >
            <div class="changelog-page__summary-icon">
              <n-icon size="18">
                <component :is="item.icon"></component>
              </n-icon>
            </div>
            <div>
              <span class="changelog-page__summary-label">{{ item.label }}</span>
              <strong class="changelog-page__summary-value">{{ item.value }}</strong>
            </div>
          </article>
        </div>

        <div class="changelog-page__filter-wrap">
          <label class="changelog-page__filter-label">
            {{ t("changelog.filters.versionType") }}
          </label>
          <div class="changelog-page__filters" role="tablist">
            <n-button
              v-for="type in versionTypes"
              :key="type.value"
              class="changelog-page__filter-btn"
              role="tab"
              :secondary="selectedType !== type.value"
              :type="selectedType === type.value ? 'primary' : 'default'"
              @click="selectedType = type.value"
            >
              {{ type.label }}
            </n-button>
          </div>
        </div>
      </section>

      <div class="changelog-page__layout">
        <section class="public-support-surface changelog-page__list-panel">
          <header class="changelog-page__list-head">
            <div>
              <h2>版本列表</h2>
              <p>按类型筛选查看功能、新增、修复和重大变更。</p>
            </div>
            <span>{{ filteredChangelogs.length }} 条记录</span>
          </header>

          <transition-group class="changelog-page__list" name="changelog-fade" tag="div">
            <ChangelogCard
              v-for="entry in filteredChangelogs"
              :key="entry.version"
              :entry="entry"
            ></ChangelogCard>
          </transition-group>

          <n-empty
            v-if="filteredChangelogs.length === 0"
            class="changelog-page__empty"
            :description="t('changelog.empty')"
          >
            <template #icon>
              <n-icon size="48">
                <DocumentTextOutline></DocumentTextOutline>
              </n-icon>
            </template>
            <template #extra>
              <n-button type="primary" @click="selectedType = 'all'">
                {{ t("changelog.actions.resetFilter") }}
              </n-button>
            </template>
          </n-empty>
        </section>

        <aside class="public-support-surface changelog-page__subscribe">
          <div class="changelog-page__subscribe-head">
            <span class="public-support-eyebrow">订阅更新</span>
            <h2>{{ t("changelog.subscribe.title") }}</h2>
            <p>{{ t("changelog.subscribe.description") }}</p>
          </div>

          <div class="public-support-meta-grid">
            <div class="public-support-meta-card">
              <span>订阅状态</span>
              <strong>{{ isSubscribed ? "已订阅" : "未订阅" }}</strong>
            </div>
            <div class="public-support-meta-card">
              <span>最新版本</span>
              <strong>{{ latestVersionLabel }}</strong>
            </div>
          </div>

          <div class="public-support-note">
            <strong>说明：</strong>
            订阅状态仅保存在当前浏览器，用于提醒你关注新的版本变更。
          </div>

          <div class="public-support-actions">
            <n-button type="primary" @click="handleSubscribe">
              <template #icon>
                <n-icon><NotificationsOutline></NotificationsOutline></n-icon>
              </template>
              {{
                isSubscribed
                  ? t("changelog.actions.subscribed")
                  : t("changelog.actions.subscribe")
              }}
            </n-button>
          </div>
        </aside>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import {
  BugOutline,
  CalendarOutline,
  ChevronBackOutline,
  DocumentTextOutline,
  MegaphoneOutline,
  NotificationsOutline,
  SparklesOutline,
  TrendingUpOutline,
} from "@vicons/ionicons5";
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

const latestVersionLabel = computed(
  () => changelogStore.latestVersion?.version || "暂无版本",
);

const summaryCards = computed(() => [
  {
    label: t("changelog.stats.totalVersions"),
    value: stats.value.totalVersions,
    icon: CalendarOutline,
  },
  {
    label: t("changelog.stats.totalFeatures"),
    value: stats.value.totalFeatures,
    icon: SparklesOutline,
  },
  {
    label: t("changelog.stats.totalFixes"),
    value: stats.value.totalFixes,
    icon: BugOutline,
  },
  {
    label: t("changelog.stats.totalImprovements"),
    value: stats.value.totalImprovements,
    icon: TrendingUpOutline,
  },
]);

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
.changelog-page.public-support-page {
  .changelog-page__hero,
  .changelog-page__list-panel,
  .changelog-page__subscribe {
    border-radius: 30px;
  }

  .changelog-page__summary-card {
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.16);
  }
}

.changelog-page__hero {
  gap: 22px;
}

.changelog-page__hero-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
}

.changelog-page__hero-copy {
  display: grid;
  gap: 10px;
}

.changelog-page__hero-actions {
  justify-content: flex-end;
}

.changelog-page__summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.changelog-page__summary-card {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 12px;
  align-items: center;
  padding: 16px;
  border-radius: 18px;
  border: 1px solid var(--surface-glass-border);
  background: var(--console-panel);
}

.changelog-page__summary-icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 14px;
  background: rgba(15, 107, 255, 0.1);
  color: var(--primary-color);
}

.changelog-page__summary-label {
  display: block;
  color: var(--text-secondary);
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-family: var(--font-family-mono);
}

.changelog-page__summary-value {
  display: block;
  margin-top: 6px;
  color: var(--text-primary);
  font-size: clamp(24px, 2.4vw, 32px);
  line-height: 1;
  font-weight: 800;
}

.changelog-page__filter-wrap {
  display: grid;
  gap: 10px;
}

.changelog-page__filter-label {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
}

.changelog-page__filters {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.changelog-page__layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
  gap: 16px;
  align-items: start;
}

.changelog-page__list-panel,
.changelog-page__subscribe {
  padding: 22px;
  border-radius: 28px;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(135deg, rgba(15, 107, 255, 0.08), transparent 76%),
    var(--surface-glass-strong);
  box-shadow: var(--shadow-light);
}

.changelog-page__list-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--console-divider);
}

.changelog-page__list-head h2,
.changelog-page__subscribe-head h2 {
  margin: 0;
  color: var(--text-primary);
}

.changelog-page__list-head p,
.changelog-page__subscribe-head p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.changelog-page__list-head span {
  color: var(--text-secondary);
  font-size: 13px;
}

.changelog-page__list {
  display: grid;
  gap: 14px;
}

.changelog-page__empty {
  padding: 28px 0 8px;
}

.changelog-page__subscribe {
  display: grid;
  gap: 18px;
}

.changelog-page__subscribe-head {
  display: grid;
  gap: 8px;
}

.changelog-fade-enter-active,
.changelog-fade-leave-active {
  transition:
    opacity 0.24s ease,
    transform 0.24s ease;
}

.changelog-fade-enter-from,
.changelog-fade-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

@media (max-width: 960px) {
  .changelog-page__layout {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 768px) {
  .changelog-page__hero-top,
  .changelog-page__list-head {
    flex-direction: column;
    align-items: stretch;
  }

  .changelog-page__hero-actions {
    justify-content: flex-start;
  }
}

@media (max-width: 640px) {
  .changelog-page__list-panel,
  .changelog-page__subscribe {
    padding: 18px;
    border-radius: 22px;
  }

  .changelog-page__summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .changelog-page__filters :deep(.n-button) {
    flex: 1 1 calc(50% - 10px);
  }
}
</style>
