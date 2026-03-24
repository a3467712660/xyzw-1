<template>
  <div class="dashboard-page app-page">
    <section class="app-page__hero dashboard-hero">
      <div class="app-page__hero-copy">
        <span class="app-page__eyebrow">控制台总览</span>
        <h1 class="app-page__title">
          {{
            t("dashboard.welcome.title", {
              name: tokenStore.selectedToken?.name || t("dashboard.welcome.defaultPlayer"),
            })
          }}
        </h1>
        <p class="app-page__description">
          {{ t("dashboard.welcome.subtitle", { date: currentDate }) }}
        </p>
        <div class="app-chip-row">
          <span class="app-inline-stat">
            <strong>{{ tokenStore.gameTokens.length }}</strong>
            已导入角色
          </span>
          <span class="app-inline-stat">
            <strong>{{ connectedTokenCount }}</strong>
            在线连接
          </span>
          <span class="app-inline-stat">
            <strong>{{ persistentTokenCount }}</strong>
            长效凭证
          </span>
        </div>
      </div>

      <div class="app-page__actions">
        <n-button
          v-if="canOpenWorkbenchFeatures"
          size="large"
          type="primary"
          @click="router.push('/admin/game-features')"
        >
          {{ t("dashboard.actions.enterGameFeatures") }}
        </n-button>
        <n-button secondary size="large" type="primary" @click="handleManageTokens">
          {{ t("dashboard.actions.manageTokens") }}
        </n-button>
      </div>
    </section>

    <div class="app-page__summary">
      <article v-for="card in summaryCards" :key="card.label" class="app-summary-card">
        <span class="app-summary-card__label">{{ card.label }}</span>
        <strong class="app-summary-card__value">{{ card.value }}</strong>
        <span class="app-summary-card__meta">{{ card.meta }}</span>
      </article>
    </div>

    <section class="app-section-card dashboard-section">
      <div class="dashboard-section__head">
        <div>
          <h2 class="section-title">{{ t("dashboard.quickActions.title") }}</h2>
          <p>把常用链路收成一屏，减少来回跳转。</p>
        </div>
      </div>

      <n-grid item-responsive responsive="screen" :x-gap="16" :y-gap="16">
        <n-grid-item
          v-for="action in quickActions"
          :key="action.id"
          span="24 s:12 l:8"
        >
          <button class="action-card" type="button" @click="handleQuickAction(action)">
            <div class="action-icon">
              <component :is="action.icon"></component>
            </div>
            <div class="action-content">
              <h3>{{ action.title }}</h3>
              <p>{{ action.description }}</p>
            </div>
          </button>
        </n-grid-item>
      </n-grid>
    </section>
  </div>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import { useAuthStore } from "@/stores/auth";
import { canAccessAdminCenter } from "@/utils/accessScope";
import {
  Add,
  CalendarClear,
  Cloud,
  Cube,
  Settings,
} from "@vicons/ionicons5";

const router = useRouter();
const message = useMessage();
const tokenStore = useTokenStore();
const authStore = useAuthStore();
const { locale, t } = useI18n();

const currentDate = computed(() => {
  return new Date().toLocaleDateString(locale.value, {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
});
const canOpenWorkbenchFeatures = computed(() => tokenStore.hasUsableWorkbenchToken);

const connectedTokenCount = computed(() =>
  tokenStore.gameTokens.filter((token) => tokenStore.getWebSocketStatus(token.id) === "connected").length,
);

const persistentTokenCount = computed(() =>
  tokenStore.gameTokens.filter(
    (token) =>
      token.importMethod === "url"
      || token.importMethod === "bin"
      || token.importMethod === "wxQrcode"
      || token.upgradedToPermanent,
  ).length,
);

const summaryCards = computed(() => [
  {
    label: "当前角色",
    value: tokenStore.selectedToken?.name || "未选择",
    meta: tokenStore.selectedToken?.server || "去 Token 管理页选择一个角色",
  },
  {
    label: "连接状态",
    value: tokenStore.selectedToken
      ? tokenStore.getWebSocketStatus(tokenStore.selectedToken.id) || "disconnected"
      : "idle",
    meta: tokenStore.selectedToken ? "会在进入游戏功能时自动拉起" : "请先导入 Token",
  },
  {
    label: "角色总数",
    value: String(tokenStore.gameTokens.length),
    meta: "支持卡片视图和列表视图双模式管理",
  },
  {
    label: "推荐入口",
    value: tokenStore.hasTokens ? "任务控制" : "Token 管理",
    meta: tokenStore.hasTokens ? "执行批量任务与排程" : "先完成角色导入与校验",
  },
]);

const quickActions = computed(() => {
  const actions = [
    {
      id: 2,
      icon: Add,
      title: t("dashboard.quickActions.items.addToken.title"),
      description: t("dashboard.quickActions.items.addToken.description"),
      action: "add-token",
    },
    {
      id: 5,
      icon: Settings,
      title: "个人设置",
      description: "集中管理主题、账号安全和偏好配置。",
      action: "open-settings",
    },
  ];

  if (canOpenWorkbenchFeatures.value) {
    actions.unshift({
      id: 1,
      icon: Cube,
      title: t("dashboard.quickActions.items.gameFeatures.title"),
      description: t("dashboard.quickActions.items.gameFeatures.description"),
      action: "game-features",
    });
    actions.splice(2, 0, {
      id: 3,
      icon: CalendarClear,
      title: "任务控制",
      description: "批量执行任务、管理计划、查看运行状态。",
      action: "task-control",
    });
  }

  if (canAccessAdminCenter(authStore.user)) {
    actions.splice(canOpenWorkbenchFeatures.value ? 3 : 1, 0, {
      id: 4,
      icon: Cloud,
      title: t("dashboard.quickActions.items.websocketTest.title"),
      description: t("dashboard.quickActions.items.websocketTest.description"),
      action: "websocket-test",
    });
  }

  return actions;
});

const handleManageTokens = () => {
  try {
    router.push("/tokens");
  } catch (error) {
    console.error("❌ 导航失败:", error);
    message.error(t("dashboard.messages.navigateTokenFailed"));
  }
};

const handleQuickAction = (action) => {
  switch (action.action) {
    case "game-features":
      router.push("/admin/game-features");
      break;
    case "add-token":
      handleManageTokens();
      break;
    case "task-control":
      router.push("/admin/task-control");
      break;
    case "websocket-test":
      router.push("/websocket-test");
      break;
    case "open-settings":
      router.push("/admin/profile");
      break;
  }
};

onMounted(async () => {
  tokenStore.initTokenStore();
});
</script>

<style scoped lang="scss">
.dashboard-page {
  animation: dashboard-fade-in 0.54s cubic-bezier(0.2, 0.7, 0.1, 1);
}

.dashboard-hero {
  background:
    radial-gradient(circle at 78% 20%, rgba(255, 255, 255, 0.22), transparent 45%),
    linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  color: white;
  border-color: rgba(255, 255, 255, 0.16);
}

.dashboard-hero :deep(.app-page__title),
.dashboard-hero :deep(.app-page__description),
.dashboard-hero :deep(.app-inline-stat),
.dashboard-hero :deep(.app-inline-stat strong) {
  color: white;
}

.dashboard-hero :deep(.app-inline-stat) {
  background: rgba(255, 255, 255, 0.16);
}

.dashboard-section {
  padding: var(--spacing-lg);
}

.dashboard-section__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-lg);
}

.dashboard-section__head p {
  margin: 6px 0 0;
  color: var(--text-secondary);
}

.section-title {
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-semibold);
  color: var(--text-primary);
  margin: 0;
}

.action-card {
  width: 100%;
  display: flex;
  gap: var(--spacing-md);
  align-items: flex-start;
  padding: var(--spacing-lg);
  background: var(--bg-elevated);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-large);
  box-shadow: var(--shadow-light);
  transition: all var(--transition-normal);
  text-align: left;
}

.action-card:hover {
  transform: translateY(-3px);
  border-color: rgba(15, 107, 255, 0.24);
  box-shadow: var(--shadow-medium);
}

.action-icon {
  width: 46px;
  height: 46px;
  border-radius: 14px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
  color: #fff;
  background: linear-gradient(135deg, var(--primary-color) 0%, var(--secondary-color) 100%);
  box-shadow: 0 8px 22px rgba(15, 107, 255, 0.28);
}

.action-icon :deep(svg) {
  width: 22px;
  height: 22px;
}

.action-content h3 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
}

.action-content p {
  color: var(--text-secondary);
  font-size: 14px;
  margin: 0;
  line-height: 1.6;
}

@keyframes dashboard-fade-in {
  from {
    opacity: 0;
    transform: translate3d(0, 18px, 0) scale(0.996);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translate3d(0, 0, 0) scale(1);
    filter: blur(0);
  }
}

@media (max-width: 640px) {
  .dashboard-section {
    padding: var(--spacing-md);
  }

  .action-card {
    padding: var(--spacing-md);
  }
}
</style>
