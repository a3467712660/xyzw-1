<template>
  <div class="game-workbench-v2 game-features-page">
    <GameCommandBar
      :active-group-name="activeGroup?.label || ''"
      :active-module-name="activeModuleMeta?.label || ''"
      :connection-action-label="connectionActionLabel"
      :connection-status-text="connectionStatusText"
      :connection-tone="connectionPillTone"
      :description="selectedTokenDescription"
      :eyebrow="t('gameFeatures.workbench.eyebrow')"
      :inspector-action-label="t('gameFeatures.workbench.actions.openInspector')"
      :is-connected="isConnected"
      :show-inspector-button="isMobile"
      :signals="commandSignals"
      :title="t('gameFeatures.workbench.title')"
      :token-action-label="t('gameFeatures.workbench.actions.tokenCenter')"
      @go-tokens="goToTokens"
      @open-inspector="showInspectorDrawer = true"
      @toggle-connection="handleToggleConnection"
    ></GameCommandBar>

    <div
      class="game-workbench-v2__body"
      :class="{ 'game-workbench-v2__body--no-inspector': !showDesktopInspector }"
    >
      <GameModuleRail
        v-model="activeModule"
        :dock-label="t('gameFeatures.workbench.dockLabel')"
        :groups="moduleGroups"
        :show-group-caption="false"
        :show-module-note="false"
      ></GameModuleRail>

      <GameStage
        :eyebrow="t('gameFeatures.workbench.stage.eyebrow')"
        :group-label="activeGroup?.label || ''"
        :module-description="activeModuleMeta?.description || ''"
        :module-name="activeModuleMeta?.label || t('gameFeatures.title')"
        :status-class="connectionClass"
        :status-label="t('gameFeatures.workbench.stage.telemetryLabel')"
        :status-text="connectionStatusText"
      >
        <div class="game-stage-overview">
          <article
            v-for="card in stageSummaryCards"
            :key="card.label"
            class="game-stage-overview__item"
          >
            <span class="game-stage-overview__label">{{ card.label }}</span>
            <strong class="game-stage-overview__value">{{ card.value }}</strong>
            <span class="game-stage-overview__meta">{{ card.meta }}</span>
          </article>
        </div>

        <GameStatus
          v-model:active-module="activeModule"
          :show-identity-card="false"
          :show-intel-panel="false"
          :show-module-rail="false"
        ></GameStatus>
      </GameStage>

      <GameInspector
        v-if="showDesktopInspector"
        :connection-action-label="connectionActionLabel"
        :connection-status-text="connectionStatusText"
        :connection-tone="connectionPillTone"
        :facts="inspectorFacts"
        :facts-label="t('gameFeatures.workbench.inspector.factsLabel')"
        :is-connected="isConnected"
        :module-name="activeModuleMeta?.label || t('gameFeatures.title')"
        :recommendation-detail="summaryCards[3].meta"
        :recommendation-label="t('gameFeatures.workbench.inspector.recommendationLabel')"
        :recommendation-title="summaryCards[3].value"
        :show-token-button="true"
        :subtitle="t('gameFeatures.workbench.inspector.subtitle')"
        :title="t('gameFeatures.workbench.inspector.title')"
        :token-action-label="t('gameFeatures.workbench.actions.tokenCenter')"
        @go-tokens="goToTokens"
        @toggle-connection="handleToggleConnection"
      ></GameInspector>
    </div>

    <n-drawer
      v-if="isMobile"
      height="78vh"
      placement="bottom"
      v-model:show="showInspectorDrawer"
    >
      <n-drawer-content closable :title="t('gameFeatures.workbench.inspector.title')">
        <GameInspector
          v-if="showInspectorDrawer"
          :connection-action-label="connectionActionLabel"
          :connection-status-text="connectionStatusText"
          :connection-tone="connectionPillTone"
          :facts="inspectorFacts"
          :facts-label="t('gameFeatures.workbench.inspector.factsLabel')"
          :is-connected="isConnected"
          :module-name="activeModuleMeta?.label || t('gameFeatures.title')"
          :recommendation-detail="summaryCards[3].meta"
          :recommendation-label="t('gameFeatures.workbench.inspector.recommendationLabel')"
          :recommendation-title="summaryCards[3].value"
          :show-token-button="true"
          :subtitle="t('gameFeatures.workbench.inspector.subtitle')"
          :title="t('gameFeatures.workbench.inspector.title')"
          :token-action-label="t('gameFeatures.workbench.actions.tokenCenter')"
          @go-tokens="goToTokens"
          @toggle-connection="handleToggleConnection"
        ></GameInspector>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  markRaw,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import {
  DocumentText,
  Flash,
  Speedometer,
} from "@vicons/ionicons5";
import {
  buildGameStatusModules,
  findGameStatusModuleById,
  GAME_STATUS_MODULE_IDS,
} from "@/components/game-status/moduleMeta";
import GameCommandBar from "@/components/game-workbench-v2/GameCommandBar.vue";
import GameWorkbenchLoadingState from "@/components/game-workbench-v2/GameWorkbenchLoadingState.vue";
import GameModuleRail from "@/components/game-workbench-v2/GameModuleRail.vue";
import GameStage from "@/components/game-workbench-v2/GameStage.vue";
import { useGameFeatureActions } from "@/composables/useGameFeatureActions";
import { useResponsive } from "@/composables/useResponsive";
import { useAuthStore } from "@/stores/auth";
import { useTokenStore } from "@/stores/tokenStore";
import { hasGameFeatureAccess } from "@/utils/accessScope";

const GameStatus = defineAsyncComponent({
  loader: () => import("@/components/GameStatus.vue"),
  loadingComponent: GameWorkbenchLoadingState,
  delay: 0,
  suspensible: false,
});
const GameInspector = defineAsyncComponent({
  loader: () => import("@/components/game-workbench-v2/GameInspector.vue"),
  loadingComponent: GameWorkbenchLoadingState,
  delay: 0,
  suspensible: false,
});

const GROUP_ICONS = Object.freeze({
  operations: markRaw(Speedometer),
  battle: markRaw(Flash),
  analysis: markRaw(DocumentText),
});
const GAME_WORKBENCH_ROUTE_CLASS = "route-game-workbench-v2-active";

const router = useRouter();
const message = useMessage();
const tokenStore = useTokenStore();
const authStore = useAuthStore();
const { t } = useI18n();
const { isMobile } = useResponsive();

const activeModule = ref(GAME_STATUS_MODULE_IDS.daily);
const lastActivity = ref(null);
const showInspectorDrawer = ref(false);
const showDesktopInspector = computed(() => false);

const canAccessRestrictedGameSections = computed(() =>
  hasGameFeatureAccess(authStore.user),
);

const rawConnectionStatus = computed(() => {
  if (!tokenStore.selectedToken) {
    return "idle";
  }
  return tokenStore.getWebSocketStatus(tokenStore.selectedToken.id) || "disconnected";
});

const connectionStatus = computed(() => {
  if (!tokenStore.selectedToken) {
    return "disconnected";
  }
  return rawConnectionStatus.value === "connected" ? "connected" : "disconnected";
});

const connectionStatusText = computed(() => {
  if (!tokenStore.selectedToken) {
    return t("gameFeatures.connection.notSelected");
  }

  switch (rawConnectionStatus.value) {
    case "connected":
      return t("gameFeatures.connection.connected");
    case "connecting":
      return "连接中";
    case "error":
      return "连接异常";
    default:
      return t("gameFeatures.connection.disconnected");
  }
});

const connectionClass = computed(() => {
  switch (rawConnectionStatus.value) {
    case "connected":
      return "status-connected";
    case "connecting":
      return "status-connecting";
    case "error":
      return "status-disconnected";
    default:
      return "status-idle";
  }
});

const isConnected = computed(() => connectionStatus.value === "connected");

const connectionPillTone = computed(() => {
  switch (rawConnectionStatus.value) {
    case "connected":
      return "success";
    case "connecting":
      return "info";
    case "error":
      return "error";
    case "idle":
      return "warning";
    default:
      return "default";
  }
});

const selectedTokenDescription = computed(() => {
  if (!tokenStore.selectedToken) {
    return "还没有选中角色，先去 Token 管理页导入并选择角色，再回到这里拉起连接。";
  }

  return `${tokenStore.selectedToken.name} · ${tokenStore.selectedToken.server || "未知服务器"}`;
});

const summaryCards = computed(() => [
  {
    label: "当前角色",
    value: tokenStore.selectedToken?.name || "未选择",
    meta: tokenStore.selectedToken?.server || "去 Token 管理页完成导入与选择",
  },
  {
    label: "连接状态",
    value: connectionStatusText.value,
    meta: isConnected.value ? "可直接使用功能面板" : "可在右侧重新建立连接",
  },
  {
    label: "角色总数",
    value: String(tokenStore.gameTokens.length),
    meta: "当前账号已导入角色数量",
  },
  {
    label: "当前建议",
    value: tokenStore.selectedToken ? "检查连接状态" : "先导入 Token",
    meta: tokenStore.selectedToken ? "保持连接稳定后再执行功能" : "导入后再进入本页",
  },
]);

const commandSignals = computed(() => [
  summaryCards.value[0],
  {
    label: "当前分组",
    value: activeGroup.value?.label || t("gameFeatures.workbench.values.pending"),
    meta: activeModuleMeta.value?.description || "先选定工作区，再进入对应功能模块。",
  },
  {
    label: t("gameFeatures.workbench.signals.lastActivity"),
    value: lastActivity.value || t("gameFeatures.workbench.values.none"),
    meta: t("gameFeatures.workbench.signals.lastActivityMeta"),
  },
]);

const stageSummaryCards = computed(() => [
  {
    label: "当前分组",
    value: activeGroup.value?.label || t("gameFeatures.workbench.values.pending"),
    meta: activeGroup.value?.caption || "先锁定你要处理的工作区，再进入功能卡片。",
  },
  {
    label: "当前模块",
    value: activeModuleMeta.value?.label || t("gameFeatures.title"),
    meta: activeModuleMeta.value?.description || "模块说明会跟随左侧导航切换。",
  },
  {
    label: "建议动作",
    value: summaryCards.value[3].value,
    meta: summaryCards.value[3].meta,
  },
]);

const inspectorFacts = computed(() => [
  {
    label: t("gameFeatures.connection.currentToken"),
    value: tokenStore.selectedToken?.name || t("gameFeatures.connection.notSelected"),
    meta: t("gameFeatures.workbench.inspector.facts.currentTokenMeta"),
  },
  {
    label: t("gameFeatures.workbench.inspector.serverLabel"),
    value: tokenStore.selectedToken?.server || t("gameFeatures.workbench.values.pending"),
    meta: t("gameFeatures.workbench.inspector.serverMeta"),
  },
  {
    label: t("gameFeatures.connection.websocketStatus"),
    value: connectionStatusText.value,
    valueClass: connectionClass.value,
    meta: summaryCards.value[1].meta,
  },
  {
    label: t("gameFeatures.connection.lastActivity"),
    value: lastActivity.value || t("gameFeatures.workbench.values.none"),
    meta: t("gameFeatures.workbench.inspector.lastActivityMeta"),
  },
]);

const modules = computed(() =>
  buildGameStatusModules(t, {
    canAccessRestrictedGameSections: canAccessRestrictedGameSections.value,
  }),
);

const activeModuleMeta = computed(() =>
  findGameStatusModuleById(modules.value, activeModule.value) || modules.value[0] || null,
);

const moduleGroups = computed(() => {
  const moduleMap = new Map(modules.value.map((module) => [module.id, module]));
  const groups = [
    {
      id: "operations",
      label: t("gameFeatures.workbench.groups.operations.label"),
      caption: t("gameFeatures.workbench.groups.operations.caption"),
      icon: GROUP_ICONS.operations,
      items: [
        GAME_STATUS_MODULE_IDS.daily,
        GAME_STATUS_MODULE_IDS.activity,
        GAME_STATUS_MODULE_IDS.tools,
      ],
    },
    {
      id: "battle",
      label: t("gameFeatures.workbench.groups.battle.label"),
      caption: t("gameFeatures.workbench.groups.battle.caption"),
      icon: GROUP_ICONS.battle,
      items: [
        GAME_STATUS_MODULE_IDS.legionOps,
        GAME_STATUS_MODULE_IDS.pvp,
      ],
    },
    {
      id: "analysis",
      label: t("gameFeatures.workbench.groups.analysis.label"),
      caption: t("gameFeatures.workbench.groups.analysis.caption"),
      icon: GROUP_ICONS.analysis,
      items: [
        GAME_STATUS_MODULE_IDS.dataAnalysis,
      ],
    },
  ];

  return groups
    .map((group) => ({
      ...group,
      items: group.items.map((itemId) => moduleMap.get(itemId)).filter(Boolean),
    }))
    .filter((group) => group.items.length > 0);
});

const activeGroup = computed(() =>
  moduleGroups.value.find((group) => group.items.some((item) => item.id === activeModule.value))
  || moduleGroups.value[0]
  || null,
);

const availableModuleIds = computed(() =>
  moduleGroups.value.flatMap((group) => group.items.map((item) => item.id)),
);

const connectionActionLabel = computed(() =>
  isConnected.value
    ? t("gameFeatures.connection.disconnect")
    : t("gameFeatures.connection.reconnect"),
);

const {
  connectWebSocket,
  toggleConnection: toggleGameFeatureConnection,
} = useGameFeatureActions({
  message,
  router,
  t,
  tokenStore,
});

const goToTokens = () => {
  router.push("/tokens");
};

const updateLastActivity = () => {
  lastActivity.value = new Date().toLocaleString();
};

const toggleWorkbenchRouteScope = (enabled) => {
  if (typeof document === "undefined") {
    return;
  }

  document.body.classList.toggle(GAME_WORKBENCH_ROUTE_CLASS, enabled);
  document.getElementById("app")?.classList.toggle(GAME_WORKBENCH_ROUTE_CLASS, enabled);
};

const runAfterFirstPaint = (task) => {
  if (typeof window === "undefined") {
    void task();
    return;
  }

  window.requestAnimationFrame(() => {
    window.setTimeout(() => {
      void task();
    }, 0);
  });
};

const handleToggleConnection = async () => {
  await toggleGameFeatureConnection(connectionStatus.value);
  updateLastActivity();
};

watch(
  availableModuleIds,
  (moduleIds) => {
    if (!moduleIds.length) {
      return;
    }
    if (!moduleIds.includes(activeModule.value)) {
      activeModule.value = moduleIds[0];
    }
  },
  { immediate: true },
);

watch(isMobile, (mobile) => {
  if (!mobile) {
    showInspectorDrawer.value = false;
  }
});

onMounted(() => {
  toggleWorkbenchRouteScope(true);

  if (!tokenStore.hasUsableWorkbenchToken) {
    message.warning("当前没有已激活且未过期的 Token，请先前往 Token 管理完成激活");
    router.replace("/tokens");
    return;
  }
  if (tokenStore.selectedToken) {
    const status = tokenStore.getWebSocketStatus(tokenStore.selectedToken.id);
    updateLastActivity();
    runAfterFirstPaint(() => {
      if (status !== "connected" && status !== "connecting") {
        void connectWebSocket();
      }
    });
  }
});

onUnmounted(() => {
  toggleWorkbenchRouteScope(false);
});

watch(
  () => {
    if (!tokenStore.selectedToken) {
      return { status: "disconnected", lastError: null };
    }
    const conn = tokenStore.wsConnections[tokenStore.selectedToken.id];
    return { status: conn?.status, lastError: conn?.lastError };
  },
  (cur, prev) => {
    if (!cur) {
      return;
    }

    if (cur.status !== prev?.status) {
      updateLastActivity();
    }

    if (cur.status === "error" && cur.lastError) {
      const err = String(cur.lastError.error || "").toLowerCase();
      if (err.includes("token") && err.includes("expired")) {
        const importMethod = tokenStore.selectedToken?.importMethod;
        if (
          importMethod === "url"
          || importMethod === "bin"
          || importMethod === "wxQrcode"
        ) {
          message.warning(t("gameFeatures.messages.tokenExpiredRefreshing"));
          return;
        }
        message.error(t("gameFeatures.messages.tokenExpiredReimport"));
        router.push("/tokens");
      }
    }
  },
  { deep: true },
);
</script>

<style lang="scss">
@use "@/assets/styles/game-workbench-v2.scss";

.game-features-page {
  --gwb2-panel: rgba(10, 18, 31, 0.9);
  --gwb2-panel-strong: rgba(12, 22, 38, 0.94);
  --gwb2-border: rgba(85, 136, 218, 0.3);
  --gwb2-glow: rgba(37, 99, 235, 0.22);
  --gwb2-accent: #75a7ff;
  --gwb2-accent-soft: rgba(37, 99, 235, 0.16);
  --gwb2-console-panel: rgba(13, 23, 39, 0.92);
  --gwb2-console-panel-strong: rgba(9, 18, 32, 0.96);
  --gwb2-console-panel-muted: rgba(17, 31, 52, 0.84);
  --gwb2-console-panel-hover: rgba(20, 36, 60, 0.96);
  --gwb2-console-border: rgba(83, 125, 196, 0.26);
  --gwb2-console-divider: rgba(96, 132, 184, 0.2);
  --gwb2-console-highlight: rgba(157, 190, 240, 0.12);
  --gwb2-console-shadow: 0 16px 34px rgba(0, 0, 0, 0.34);
  --gwb2-console-shadow-strong: 0 22px 48px rgba(0, 0, 0, 0.42);
  --gwb2-console-strip: linear-gradient(180deg, rgba(96, 165, 250, 0.08), rgba(9, 18, 32, 0.02));
  padding: clamp(14px, 2vw, 24px);
}

.game-features-page::before {
  background:
    radial-gradient(circle at 16% 5%, rgba(37, 99, 235, 0.18), transparent 30%),
    radial-gradient(circle at 86% 12%, rgba(34, 197, 94, 0.12), transparent 28%),
    linear-gradient(180deg, #050b15 0%, #081323 54%, #07101c 100%);
}

.game-features-page .game-command-bar,
.game-features-page .game-stage,
.game-features-page .game-module-dock__panel,
.game-features-page .game-module-dock__bar {
  border-color: var(--gwb2-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 22%),
    linear-gradient(135deg, rgba(37, 99, 235, 0.12), transparent 62%),
    var(--gwb2-panel);
  box-shadow:
    0 0 0 1px rgba(148, 180, 232, 0.04),
    var(--gwb2-console-shadow);
}

.game-features-page .game-command-bar {
  border-radius: 22px;
  padding: clamp(18px, 2vw, 24px);
}

.game-features-page .game-command-bar::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, #22c55e, #2563eb 54%, rgba(249, 115, 22, 0.72));
}

.game-features-page .game-command-bar__title {
  font-size: clamp(26px, 3vw, 36px);
  letter-spacing: 0;
}

.game-features-page .game-command-bar__description {
  margin-top: 8px;
  color: rgba(203, 213, 225, 0.86);
}

.game-features-page .game-command-bar__signal {
  border-color: rgba(96, 165, 250, 0.2);
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.14), transparent 70%),
    rgba(11, 21, 36, 0.8);
}

.game-features-page .game-command-bar__signal::before {
  background: linear-gradient(180deg, #60a5fa, #22c55e);
}

.game-features-page .game-command-bar__signal-label,
.game-features-page .game-stage-overview__label,
.game-features-page .game-stage__eyebrow {
  color: rgba(148, 163, 184, 0.88);
  letter-spacing: 0.1em;
}

.game-features-page .game-command-bar__signal-value,
.game-features-page .game-stage-overview__value {
  color: #f8fafc;
}

.game-features-page .game-command-bar__signal-meta,
.game-features-page .game-stage-overview__meta {
  color: rgba(203, 213, 225, 0.78);
}

.game-features-page .game-signal-pill {
  min-height: 38px;
  background: rgba(15, 23, 42, 0.72);
}

.game-features-page .game-signal-pill--success {
  color: #63e68b;
  border-color: rgba(34, 197, 94, 0.34);
  background: rgba(22, 101, 52, 0.26);
}

.game-features-page .game-command-bar__action-stack > .n-button {
  min-height: 42px;
}

.game-features-page .n-button {
  border-color: rgba(96, 165, 250, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(96, 165, 250, 0.04)),
    rgba(15, 23, 42, 0.72);
  color: rgba(241, 245, 249, 0.92);
}

.game-features-page .n-button:hover {
  border-color: rgba(96, 165, 250, 0.38);
  background:
    linear-gradient(180deg, rgba(96, 165, 250, 0.16), rgba(15, 23, 42, 0.06)),
    rgba(20, 36, 60, 0.92);
}

.game-features-page .n-button.n-button--primary-type {
  background: linear-gradient(180deg, #4f83ff, #2557d6);
  color: #ffffff;
  box-shadow: 0 10px 24px rgba(37, 99, 235, 0.22);
}

.game-features-page .game-stage {
  border-radius: 22px;
}

.game-features-page .game-stage__header {
  border-bottom-color: var(--gwb2-console-divider);
}

.game-features-page .game-stage__description {
  color: rgba(203, 213, 225, 0.78);
}

.game-features-page .game-stage__telemetry,
.game-features-page .game-stage-overview__item {
  border-color: rgba(96, 165, 250, 0.2);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 34%),
    rgba(10, 20, 36, 0.82);
}

.game-features-page .game-stage__telemetry-value.status-connected {
  color: #63e68b;
}

.game-features-page .game-stage__canvas :is(.gwb2-mini-card, .status-card) {
  border-color: rgba(96, 165, 250, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 24%),
    rgba(10, 20, 36, 0.9);
}

.game-features-page .game-stage__canvas :is(.gwb2-mini-card, .status-card)::before {
  opacity: 0.26;
}

.game-features-page .game-stage__canvas :is(.gwb2-mini-card, .status-card):hover {
  border-color: rgba(96, 165, 250, 0.34);
  background:
    linear-gradient(180deg, rgba(96, 165, 250, 0.08), transparent 28%),
    rgba(13, 26, 45, 0.94);
}

.game-features-page .game-stage__canvas :is(.gwb2-mini-card__toolbar, .status-card .card-header) {
  border-bottom-color: rgba(96, 165, 250, 0.18);
}

.game-features-page .game-stage__canvas :is(.gwb2-mini-card__icon, .status-icon, .icon) {
  border-color: rgba(96, 165, 250, 0.22);
  background:
    linear-gradient(180deg, rgba(96, 165, 250, 0.16), rgba(34, 197, 94, 0.06)),
    rgba(15, 23, 42, 0.72);
}

.game-features-page .game-stage__canvas :is(.gwb2-mini-card__chip, .status-badge) {
  border-color: rgba(96, 165, 250, 0.2);
  background: rgba(15, 23, 42, 0.72);
  color: rgba(226, 232, 240, 0.88);
}

.game-features-page .game-stage__canvas :is(.team-formation-card__status-chip--connected, .daily-task__status-chip--connected, .daily-task__status-chip--completed, .status-badge.active) {
  border-color: rgba(34, 197, 94, 0.34);
  background: rgba(22, 101, 52, 0.28);
  color: #63e68b;
}

.game-features-page .game-stage__canvas .team-selector,
.game-features-page .game-stage__canvas .gwb2-mini-card__segmented {
  border-color: rgba(96, 165, 250, 0.18);
  background: rgba(8, 16, 29, 0.62);
}

.game-features-page .game-stage__canvas .team-selector > button,
.game-features-page .game-stage__canvas .gwb2-mini-card__segmented > button {
  min-height: 38px;
  color: rgba(203, 213, 225, 0.82);
}

.game-features-page .game-stage__canvas .team-selector > button.active,
.game-features-page .game-stage__canvas .gwb2-mini-card__segmented > button.active,
.game-features-page .game-stage__canvas .gwb2-mini-card__segmented > button[aria-pressed="true"] {
  background: linear-gradient(180deg, #dce8ff, #9fbdfd);
  color: #10233f;
  box-shadow: 0 8px 18px rgba(96, 165, 250, 0.22);
}

.game-features-page .game-stage__canvas :is(.current-team-info, .progress-container, .info-container, .gwb2-mini-card__metric, .gwb2-mini-card__list) {
  border-color: rgba(96, 165, 250, 0.18);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent 38%),
    rgba(15, 23, 42, 0.74);
  color: rgba(226, 232, 240, 0.9);
}

.game-features-page .game-stage__canvas .current-team-info .label,
.game-features-page .game-stage__canvas .progress-label,
.game-features-page .game-stage__canvas .gwb2-mini-card__section-title {
  color: rgba(148, 163, 184, 0.9);
}

.game-features-page .game-stage__canvas .current-team-info .team-number,
.game-features-page .game-stage__canvas .progress-value {
  color: #f8fafc;
}

.game-features-page .game-stage__canvas .heroes-container {
  min-height: 96px;
  border-color: rgba(96, 165, 250, 0.2);
  background:
    radial-gradient(circle at 50% 0%, rgba(96, 165, 250, 0.14), transparent 48%),
    rgba(8, 16, 29, 0.72);
}

.game-features-page .game-stage__canvas .hero-circle {
  width: 44px;
  height: 44px;
  border: 1px solid rgba(148, 180, 232, 0.3);
  border-radius: 13px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(96, 165, 250, 0.08)),
    rgba(15, 23, 42, 0.84);
  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.22);
}

.game-features-page .game-stage__canvas .hero-name {
  color: rgba(226, 232, 240, 0.86);
}

.game-features-page .game-stage__canvas .daily-task__run-button {
  min-height: 44px;
  border: 0;
  background: linear-gradient(180deg, #4f83ff, #2557d6);
  color: #ffffff;
  box-shadow: 0 12px 24px rgba(37, 99, 235, 0.24);
}

.game-features-page .game-stage__canvas .daily-task__run-button:disabled {
  background: rgba(71, 85, 105, 0.58);
  color: rgba(226, 232, 240, 0.62);
  box-shadow: none;
}

.game-features-page .game-stage__canvas .settings-gear {
  border-color: rgba(96, 165, 250, 0.2);
  background: rgba(15, 23, 42, 0.7);
  color: rgba(226, 232, 240, 0.9);
}

.game-features-page .game-status-container.activity-mode {
  gap: 12px;
}

.game-features-page .game-status-container.activity-mode :is(.monthly-tasks, .study-challenge-card, .skin-challenge, .consumption-progress-card) {
  border-color: rgba(251, 191, 36, 0.26);
  background:
    radial-gradient(circle at 100% 0%, rgba(251, 191, 36, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), transparent 26%),
    rgba(10, 20, 36, 0.92);
}

.game-features-page .game-status-container.activity-mode :is(.monthly-tasks, .study-challenge-card, .skin-challenge, .consumption-progress-card)::after {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 3px;
  background: linear-gradient(90deg, rgba(251, 191, 36, 0.92), rgba(96, 165, 250, 0.8), transparent);
  pointer-events: none;
}

.game-features-page .game-status-container.activity-mode .gwb2-mini-card__title h3 {
  color: #fff7ed;
  font-size: 16px;
}

.game-features-page .game-status-container.activity-mode .gwb2-mini-card__title p,
.game-features-page .game-status-container.activity-mode .description,
.game-features-page .game-status-container.activity-mode .description.muted {
  color: rgba(226, 232, 240, 0.78);
}

.game-features-page .game-status-container.activity-mode .gwb2-mini-card__icon {
  border-color: rgba(251, 191, 36, 0.28);
  background:
    linear-gradient(180deg, rgba(251, 191, 36, 0.2), rgba(96, 165, 250, 0.08)),
    rgba(15, 23, 42, 0.76);
  color: #fbbf24;
}

.game-features-page .game-status-container.activity-mode .gwb2-mini-card__chip {
  border-color: rgba(251, 191, 36, 0.26);
  background: rgba(120, 53, 15, 0.28);
  color: #fcd34d;
}

.game-features-page .game-status-container.activity-mode :is(.monthly-row, .study-metric, .header-info, .summary-cell, .progress-item, .combo-item, .boss-card) {
  border-color: rgba(251, 191, 36, 0.16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.045), transparent 38%),
    rgba(15, 23, 42, 0.76);
}

.game-features-page .game-status-container.activity-mode :is(.row-title, .study-metric__value, .challenge-count, .item-name, .combo-title strong, .summary-value, .boss-title) {
  color: #f8fafc;
}

.game-features-page .game-status-container.activity-mode :is(.row-subtitle, .row-ratio, .study-metric__state, .daily-target, .summary-label, .summary-meta, .item-footer, .combo-summary) {
  color: rgba(203, 213, 225, 0.72);
}

.game-features-page .game-status-container.activity-mode .row-value strong,
.game-features-page .game-status-container.activity-mode .summary-value,
.game-features-page .game-status-container.activity-mode .item-values {
  color: #fcd34d;
  font-family: var(--font-family-mono);
}

.game-features-page .game-status-container.activity-mode .boss-grid {
  gap: 10px;
}

.game-features-page .game-status-container.activity-mode .boss-card {
  min-height: 132px;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.game-features-page .game-status-container.activity-mode .boss-card.active {
  border-color: rgba(96, 165, 250, 0.34);
  background:
    linear-gradient(180deg, rgba(96, 165, 250, 0.14), transparent 42%),
    rgba(15, 23, 42, 0.8);
}

.game-features-page .game-status-container.activity-mode .boss-card.cleared {
  border-color: rgba(34, 197, 94, 0.36);
  background:
    linear-gradient(180deg, rgba(34, 197, 94, 0.16), transparent 44%),
    rgba(15, 23, 42, 0.82);
}

.game-features-page .game-status-container.activity-mode .boss-card.locked {
  opacity: 0.68;
  background: rgba(15, 23, 42, 0.58);
}

.game-features-page .game-status-container.activity-mode .boss-level {
  color: rgba(226, 232, 240, 0.72);
}

.game-features-page .game-status-container.activity-mode :is(.status-text.active, .completed-text) {
  color: #63e68b;
}

.game-features-page .game-status-container.activity-mode :is(.status-text.locked, .status-indicator.closed) {
  color: #fca5a5;
}

.game-features-page .game-status-container.activity-mode .progress-list {
  border-color: rgba(96, 165, 250, 0.16);
  background: rgba(8, 16, 29, 0.62);
}

.game-features-page .game-status-container.activity-mode .progress-item {
  padding: 12px;
  border: 1px solid rgba(96, 165, 250, 0.14);
  border-radius: 14px;
}

.game-features-page .game-status-container.activity-mode .consumption-controls {
  grid-template-columns: minmax(0, 1fr) minmax(112px, 132px);
}

.game-features-page .game-status-container.activity-mode .consumption-progress-card__icon svg {
  width: 24px;
  height: 24px;
}

.game-features-page .game-status-container.activity-mode .consumption-actions {
  gap: 8px;
}

.route-game-workbench-v2-active :is(.consumption-progress__modal, .n-drawer-content) :is(.combo-toolbar, .combo-item, .combo-empty) {
  border-color: rgba(96, 165, 250, 0.18);
  background: rgba(10, 20, 36, 0.86);
  color: rgba(241, 245, 249, 0.9);
}

.route-game-workbench-v2-active :is(.consumption-progress__modal, .n-drawer-content) .combo-steps {
  color: rgba(203, 213, 225, 0.78);
}

.route-game-workbench-v2-active :is(.n-drawer-content, .n-card) {
  background: rgba(9, 18, 32, 0.96);
  color: rgba(241, 245, 249, 0.94);
}

.route-game-workbench-v2-active :is(.n-drawer-content, .n-card) :is(.n-drawer-header, .n-card-header) {
  border-bottom-color: rgba(96, 165, 250, 0.2);
}

.route-game-workbench-v2-active :is(.task-item, .switch-row) {
  border-bottom-color: rgba(96, 165, 250, 0.14);
}

.route-game-workbench-v2-active .log-container {
  border: 1px solid rgba(96, 165, 250, 0.2);
  background: rgba(5, 12, 24, 0.86);
}

:root:not([data-theme="dark"]) .game-features-page {
  --gwb2-panel: rgba(255, 255, 255, 0.88);
  --gwb2-panel-strong: rgba(248, 251, 255, 0.96);
  --gwb2-border: rgba(37, 99, 235, 0.14);
  --gwb2-glow: rgba(37, 99, 235, 0.12);
  --gwb2-accent: #2563eb;
  --gwb2-accent-soft: rgba(37, 99, 235, 0.1);
  --gwb2-console-panel: rgba(247, 250, 255, 0.9);
  --gwb2-console-panel-strong: rgba(255, 255, 255, 0.96);
  --gwb2-console-panel-muted: rgba(235, 242, 252, 0.88);
  --gwb2-console-panel-hover: rgba(255, 255, 255, 0.98);
  --gwb2-console-border: rgba(37, 99, 235, 0.13);
  --gwb2-console-divider: rgba(79, 114, 164, 0.16);
  --gwb2-console-highlight: rgba(255, 255, 255, 0.72);
  --gwb2-console-shadow: 0 14px 30px rgba(15, 23, 42, 0.08);
  --gwb2-console-shadow-strong: 0 18px 40px rgba(15, 23, 42, 0.12);
  --gwb2-console-strip: linear-gradient(180deg, rgba(255, 255, 255, 0.34), rgba(224, 236, 252, 0.18));
}

:root:not([data-theme="dark"]) .game-features-page::before {
  background:
    radial-gradient(circle at 16% 5%, rgba(37, 99, 235, 0.12), transparent 30%),
    radial-gradient(circle at 86% 12%, rgba(34, 197, 94, 0.08), transparent 28%),
    linear-gradient(180deg, #f7fbff 0%, #edf4ff 56%, #f8fafc 100%);
}

:root:not([data-theme="dark"]) .game-features-page .game-command-bar,
:root:not([data-theme="dark"]) .game-features-page .game-stage,
:root:not([data-theme="dark"]) .game-features-page .game-module-dock__panel,
:root:not([data-theme="dark"]) .game-features-page .game-module-dock__bar {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), transparent 24%),
    linear-gradient(135deg, rgba(37, 99, 235, 0.06), transparent 62%),
    var(--gwb2-panel);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.72),
    var(--gwb2-console-shadow);
}

:root:not([data-theme="dark"]) .game-features-page .game-command-bar__description,
:root:not([data-theme="dark"]) .game-features-page .game-stage__description,
:root:not([data-theme="dark"]) .game-features-page .game-command-bar__signal-meta,
:root:not([data-theme="dark"]) .game-features-page .game-stage-overview__meta,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .hero-name {
  color: var(--text-secondary);
}

:root:not([data-theme="dark"]) .game-features-page .game-command-bar__signal-label,
:root:not([data-theme="dark"]) .game-features-page .game-stage-overview__label,
:root:not([data-theme="dark"]) .game-features-page .game-stage__eyebrow,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .current-team-info .label,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .progress-label,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .gwb2-mini-card__section-title {
  color: var(--text-tertiary);
}

:root:not([data-theme="dark"]) .game-features-page .game-command-bar__signal-value,
:root:not([data-theme="dark"]) .game-features-page .game-stage-overview__value,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .current-team-info .team-number,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .progress-value {
  color: var(--text-primary);
}

:root:not([data-theme="dark"]) .game-features-page .game-command-bar__signal,
:root:not([data-theme="dark"]) .game-features-page .game-stage__telemetry,
:root:not([data-theme="dark"]) .game-features-page .game-stage-overview__item,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.gwb2-mini-card, .status-card),
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.current-team-info, .progress-container, .info-container, .gwb2-mini-card__metric, .gwb2-mini-card__list) {
  border-color: rgba(37, 99, 235, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.64), transparent 36%),
    rgba(255, 255, 255, 0.78);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.gwb2-mini-card, .status-card):hover {
  border-color: rgba(37, 99, 235, 0.22);
  background:
    linear-gradient(180deg, rgba(37, 99, 235, 0.08), transparent 30%),
    rgba(255, 255, 255, 0.94);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.gwb2-mini-card__chip, .status-badge),
:root:not([data-theme="dark"]) .game-features-page .game-signal-pill,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .settings-gear {
  border-color: rgba(37, 99, 235, 0.14);
  background: rgba(239, 246, 255, 0.86);
  color: var(--text-secondary);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.team-formation-card__status-chip--connected, .daily-task__status-chip--connected, .daily-task__status-chip--completed, .status-badge.active),
:root:not([data-theme="dark"]) .game-features-page .game-signal-pill--success {
  border-color: rgba(22, 163, 74, 0.24);
  background: rgba(220, 252, 231, 0.82);
  color: #15803d;
}

:root:not([data-theme="dark"]) .game-features-page .n-button {
  border-color: rgba(37, 99, 235, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(226, 238, 255, 0.5)),
    rgba(248, 251, 255, 0.9);
  color: var(--text-primary);
}

:root:not([data-theme="dark"]) .game-features-page .n-button:hover {
  border-color: rgba(37, 99, 235, 0.24);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(219, 234, 254, 0.62)),
    #ffffff;
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .team-selector,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .gwb2-mini-card__segmented {
  border-color: rgba(37, 99, 235, 0.14);
  background: rgba(230, 240, 255, 0.78);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .team-selector > button,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .gwb2-mini-card__segmented > button {
  color: var(--text-secondary);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .heroes-container {
  border-color: rgba(37, 99, 235, 0.14);
  background:
    radial-gradient(circle at 50% 0%, rgba(37, 99, 235, 0.08), transparent 48%),
    rgba(247, 250, 255, 0.86);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .hero-circle {
  border-color: rgba(37, 99, 235, 0.16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(219, 234, 254, 0.42)),
    #ffffff;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.1);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.monthly-tasks, .study-challenge-card, .skin-challenge, .consumption-progress-card) {
  border-color: rgba(245, 158, 11, 0.22);
  background:
    radial-gradient(circle at 100% 0%, rgba(245, 158, 11, 0.12), transparent 34%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), transparent 26%),
    rgba(255, 251, 235, 0.82);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .gwb2-mini-card__title h3,
:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.row-title, .study-metric__value, .challenge-count, .item-name, .combo-title strong, .summary-value, .boss-title) {
  color: var(--text-primary);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .gwb2-mini-card__title p,
:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .description,
:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .description.muted,
:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.row-subtitle, .row-ratio, .study-metric__state, .daily-target, .summary-label, .summary-meta, .item-footer, .combo-summary) {
  color: var(--text-secondary);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .gwb2-mini-card__icon {
  border-color: rgba(245, 158, 11, 0.2);
  background:
    linear-gradient(180deg, rgba(254, 243, 199, 0.9), rgba(219, 234, 254, 0.4)),
    #ffffff;
  color: #b45309;
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .gwb2-mini-card__chip {
  border-color: rgba(245, 158, 11, 0.22);
  background: rgba(254, 243, 199, 0.82);
  color: #92400e;
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.monthly-row, .study-metric, .header-info, .summary-cell, .progress-item, .combo-item, .boss-card) {
  border-color: rgba(245, 158, 11, 0.16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), transparent 38%),
    rgba(255, 255, 255, 0.72);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .row-value strong,
:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .summary-value,
:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .item-values {
  color: #b45309;
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .boss-card.active {
  border-color: rgba(37, 99, 235, 0.22);
  background:
    linear-gradient(180deg, rgba(219, 234, 254, 0.7), transparent 42%),
    rgba(255, 255, 255, 0.8);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .boss-card.cleared {
  border-color: rgba(34, 197, 94, 0.28);
  background:
    linear-gradient(180deg, rgba(220, 252, 231, 0.72), transparent 44%),
    rgba(255, 255, 255, 0.82);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .boss-card.locked {
  background: rgba(226, 232, 240, 0.54);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .boss-level {
  color: var(--text-secondary);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .progress-list {
  border-color: rgba(37, 99, 235, 0.12);
  background: rgba(247, 250, 255, 0.74);
}

:root:not([data-theme="dark"]) .route-game-workbench-v2-active :is(.n-drawer-content, .n-card) {
  background: rgba(255, 255, 255, 0.98);
  color: var(--text-primary);
}

:root:not([data-theme="dark"]) .route-game-workbench-v2-active :is(.consumption-progress__modal, .n-drawer-content) :is(.combo-toolbar, .combo-item, .combo-empty) {
  border-color: rgba(37, 99, 235, 0.14);
  background: rgba(248, 251, 255, 0.94);
  color: var(--text-primary);
}

:root:not([data-theme="dark"]) .route-game-workbench-v2-active :is(.consumption-progress__modal, .n-drawer-content) .combo-steps {
  color: var(--text-secondary);
}

.game-features-page .game-module-dock__bar {
  border-radius: 18px;
  padding: 8px;
}

.game-features-page .game-module-dock__group {
  min-height: 58px;
  border-color: rgba(96, 165, 250, 0.12);
  background: rgba(15, 23, 42, 0.62);
  color: rgba(203, 213, 225, 0.82);
}

.game-features-page .game-module-dock__group--active,
.game-features-page .game-module-dock__group--expanded {
  border-color: rgba(96, 165, 250, 0.34);
  background:
    linear-gradient(180deg, rgba(96, 165, 250, 0.18), rgba(37, 99, 235, 0.06)),
    rgba(20, 36, 60, 0.92);
  color: #75a7ff;
}

:root:not([data-theme="dark"]) .game-features-page {
  --gwb2-panel: rgba(255, 255, 255, 0.82);
  --gwb2-panel-strong: rgba(255, 255, 255, 0.94);
  --gwb2-border: rgba(30, 64, 175, 0.14);
  --gwb2-glow: rgba(37, 99, 235, 0.13);
  --gwb2-accent: #2563eb;
  --gwb2-accent-soft: rgba(37, 99, 235, 0.1);
  --gwb2-console-panel: rgba(249, 252, 255, 0.86);
  --gwb2-console-panel-strong: rgba(255, 255, 255, 0.96);
  --gwb2-console-panel-muted: rgba(236, 244, 255, 0.84);
  --gwb2-console-panel-hover: rgba(255, 255, 255, 0.98);
  --gwb2-console-border: rgba(37, 99, 235, 0.14);
  --gwb2-console-divider: rgba(71, 85, 105, 0.14);
  --gwb2-console-highlight: rgba(255, 255, 255, 0.78);
  --gwb2-console-shadow: 0 18px 46px rgba(30, 64, 175, 0.1);
  --gwb2-console-shadow-strong: 0 24px 58px rgba(30, 64, 175, 0.14);
  --gwb2-console-strip: linear-gradient(180deg, rgba(255, 255, 255, 0.62), rgba(219, 234, 254, 0.22));
  --gwb2-light-ink: #172033;
  --gwb2-light-muted: #52647c;
  --gwb2-light-subtle: #708097;
  --gwb2-light-blue: #2563eb;
  --gwb2-light-blue-soft: rgba(219, 234, 254, 0.78);
  --gwb2-light-amber: #b45309;
  --gwb2-light-amber-soft: rgba(255, 247, 237, 0.88);
  --gwb2-light-green: #15803d;
  color: var(--gwb2-light-ink);
}

:root:not([data-theme="dark"]) .game-features-page::before {
  background:
    linear-gradient(135deg, rgba(37, 99, 235, 0.11) 0%, transparent 38%),
    linear-gradient(225deg, rgba(20, 184, 166, 0.08) 0%, transparent 44%),
    linear-gradient(180deg, #f8fbff 0%, #eef5ff 46%, #f8fbff 100%);
}

:root:not([data-theme="dark"]) .game-features-page::after {
  opacity: 0.28;
  background-size: 32px 32px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.44), transparent 88%);
}

:root:not([data-theme="dark"]) .game-features-page :is(.game-command-bar, .game-stage, .game-module-rail, .game-inspector, .game-module-dock__panel, .game-module-dock__bar) {
  border-color: rgba(30, 64, 175, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 255, 255, 0.54) 42%, rgba(239, 246, 255, 0.62)),
    rgba(255, 255, 255, 0.82);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 18px 46px rgba(30, 64, 175, 0.1);
}

:root:not([data-theme="dark"]) .game-features-page .game-command-bar::before {
  background: linear-gradient(90deg, #14b8a6, #2563eb 52%, #f59e0b);
  opacity: 0.9;
}

:root:not([data-theme="dark"]) .game-features-page :is(.game-command-bar__title, .game-stage__title, .game-inspector__title) {
  color: var(--gwb2-light-ink);
  text-shadow: 0 1px 0 rgba(255, 255, 255, 0.58);
}

:root:not([data-theme="dark"]) .game-features-page :is(.game-command-bar__description, .game-stage__description, .game-inspector__subtitle, .game-module-rail__group-copy span, .game-module-dock__module-note) {
  color: var(--gwb2-light-muted);
}

:root:not([data-theme="dark"]) .game-features-page :is(.game-command-bar__eyebrow, .game-command-bar__signal-label, .game-stage-overview__label, .game-stage__eyebrow, .game-stage__telemetry-label, .game-module-dock__panel-label) {
  color: var(--gwb2-light-subtle);
}

:root:not([data-theme="dark"]) .game-features-page :is(.game-command-bar__signal, .game-stage__telemetry, .game-stage-overview__item, .game-module-rail__group--active, .game-module-rail__module, .game-module-dock__module) {
  border-color: rgba(37, 99, 235, 0.13);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.78), rgba(239, 246, 255, 0.46)),
    rgba(255, 255, 255, 0.74);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 10px 24px rgba(30, 64, 175, 0.07);
}

:root:not([data-theme="dark"]) .game-features-page :is(.game-command-bar__signal-value, .game-stage-overview__value, .game-stage__telemetry-value, .game-module-rail__module-name, .game-module-dock__module-name) {
  color: var(--gwb2-light-ink);
}

:root:not([data-theme="dark"]) .game-features-page :is(.game-command-bar__signal-meta, .game-stage-overview__meta) {
  color: var(--gwb2-light-muted);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.gwb2-mini-card, .status-card) {
  border-color: rgba(37, 99, 235, 0.13);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.86), rgba(247, 250, 255, 0.72)),
    rgba(255, 255, 255, 0.84);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 14px 32px rgba(30, 64, 175, 0.08);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.gwb2-mini-card, .status-card):hover {
  border-color: rgba(37, 99, 235, 0.24);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(239, 246, 255, 0.82)),
    #ffffff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.86) inset,
    0 18px 40px rgba(30, 64, 175, 0.12);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.gwb2-mini-card__icon, .status-icon, .icon, .settings-gear) {
  border-color: rgba(37, 99, 235, 0.14);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(219, 234, 254, 0.66)),
    #ffffff;
  color: var(--gwb2-light-blue);
  box-shadow: 0 8px 18px rgba(30, 64, 175, 0.09);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.gwb2-mini-card__chip, .status-badge),
:root:not([data-theme="dark"]) .game-features-page .game-signal-pill {
  border-color: rgba(37, 99, 235, 0.15);
  background: rgba(239, 246, 255, 0.9);
  color: var(--gwb2-light-muted);
}

:root:not([data-theme="dark"]) .game-features-page :is(.game-signal-pill--success, .team-formation-card__status-chip--connected, .daily-task__status-chip--connected, .daily-task__status-chip--completed, .status-badge.active) {
  border-color: rgba(22, 163, 74, 0.26);
  background: rgba(220, 252, 231, 0.86);
  color: var(--gwb2-light-green);
}

:root:not([data-theme="dark"]) .game-features-page .n-button {
  border-color: rgba(37, 99, 235, 0.15);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(226, 238, 255, 0.68)),
    #f8fbff;
  color: var(--gwb2-light-ink);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 8px 18px rgba(30, 64, 175, 0.08);
}

:root:not([data-theme="dark"]) .game-features-page .n-button:hover {
  border-color: rgba(37, 99, 235, 0.28);
  background:
    linear-gradient(180deg, #ffffff, rgba(219, 234, 254, 0.74)),
    #ffffff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.86) inset,
    0 12px 24px rgba(30, 64, 175, 0.12);
}

:root:not([data-theme="dark"]) .game-features-page .n-button.n-button--primary-type,
:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .daily-task__run-button {
  border-color: rgba(29, 78, 216, 0.28);
  background: linear-gradient(180deg, #3b82f6, #1d4ed8);
  color: #ffffff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.22) inset,
    0 12px 26px rgba(37, 99, 235, 0.24);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.team-selector, .gwb2-mini-card__segmented) {
  border-color: rgba(37, 99, 235, 0.13);
  background: rgba(226, 238, 255, 0.82);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.74);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.team-selector > button.active, .gwb2-mini-card__segmented > button.active, .gwb2-mini-card__segmented > button[aria-pressed="true"]) {
  background: linear-gradient(180deg, #ffffff, #dbeafe);
  color: #1d4ed8;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.86) inset,
    0 8px 18px rgba(30, 64, 175, 0.12);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas :is(.current-team-info, .progress-container, .info-container, .gwb2-mini-card__metric, .gwb2-mini-card__list, .heroes-container) {
  border-color: rgba(37, 99, 235, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.7), rgba(239, 246, 255, 0.54)),
    rgba(255, 255, 255, 0.68);
  color: var(--gwb2-light-ink);
}

:root:not([data-theme="dark"]) .game-features-page .game-stage__canvas .hero-circle {
  border-color: rgba(37, 99, 235, 0.16);
  background:
    linear-gradient(180deg, #ffffff, #dbeafe),
    #ffffff;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.86) inset,
    0 8px 18px rgba(30, 64, 175, 0.1);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.monthly-tasks, .study-challenge-card, .skin-challenge, .consumption-progress-card) {
  border-color: rgba(245, 158, 11, 0.22);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(255, 247, 237, 0.74)),
    rgba(255, 255, 255, 0.82);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.86) inset,
    0 14px 32px rgba(146, 64, 14, 0.08);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.monthly-tasks, .study-challenge-card, .skin-challenge, .consumption-progress-card)::after {
  background: linear-gradient(90deg, #f59e0b, #2563eb 58%, rgba(20, 184, 166, 0.72));
  opacity: 0.9;
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.monthly-row, .study-metric, .header-info, .summary-cell, .progress-item, .combo-item, .boss-card) {
  border-color: rgba(245, 158, 11, 0.16);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(255, 251, 235, 0.52)),
    rgba(255, 255, 255, 0.72);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.78) inset;
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .gwb2-mini-card__icon {
  border-color: rgba(245, 158, 11, 0.22);
  background:
    linear-gradient(180deg, #fff7ed, #dbeafe),
    #ffffff;
  color: var(--gwb2-light-amber);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .gwb2-mini-card__chip {
  border-color: rgba(245, 158, 11, 0.24);
  background: rgba(255, 247, 237, 0.9);
  color: var(--gwb2-light-amber);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.row-title, .study-metric__value, .challenge-count, .item-name, .combo-title strong, .summary-value, .boss-title) {
  color: var(--gwb2-light-ink);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.row-subtitle, .row-ratio, .study-metric__state, .daily-target, .summary-label, .summary-meta, .item-footer, .combo-summary, .description, .description.muted) {
  color: var(--gwb2-light-muted);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode :is(.row-value strong, .summary-value, .item-values) {
  color: var(--gwb2-light-amber);
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .boss-card.active {
  border-color: rgba(37, 99, 235, 0.24);
  background:
    linear-gradient(180deg, rgba(219, 234, 254, 0.86), rgba(255, 255, 255, 0.72)),
    #ffffff;
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .boss-card.cleared {
  border-color: rgba(34, 197, 94, 0.28);
  background:
    linear-gradient(180deg, rgba(220, 252, 231, 0.86), rgba(255, 255, 255, 0.72)),
    #ffffff;
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .boss-card.locked {
  border-color: rgba(148, 163, 184, 0.18);
  background: rgba(241, 245, 249, 0.76);
  opacity: 0.78;
}

:root:not([data-theme="dark"]) .game-features-page .game-status-container.activity-mode .progress-list {
  border-color: rgba(37, 99, 235, 0.12);
  background: rgba(248, 251, 255, 0.78);
}

:root:not([data-theme="dark"]) .game-features-page .game-module-dock__bar {
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(239, 246, 255, 0.82)),
    rgba(255, 255, 255, 0.9);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.9) inset,
    0 18px 36px rgba(30, 64, 175, 0.14);
}

:root:not([data-theme="dark"]) .game-features-page .game-module-dock__group {
  border-color: rgba(37, 99, 235, 0.12);
  background: rgba(255, 255, 255, 0.74);
  color: var(--gwb2-light-muted);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.78) inset;
}

:root:not([data-theme="dark"]) .game-features-page .game-module-dock__group--active,
:root:not([data-theme="dark"]) .game-features-page .game-module-dock__group--expanded {
  border-color: rgba(37, 99, 235, 0.24);
  background:
    linear-gradient(180deg, rgba(219, 234, 254, 0.92), rgba(255, 255, 255, 0.78)),
    #ffffff;
  color: #1d4ed8;
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.86) inset,
    0 10px 22px rgba(30, 64, 175, 0.14);
}

:root:not([data-theme="dark"]) .route-game-workbench-v2-active :is(.n-drawer-content, .n-card) {
  border-color: rgba(37, 99, 235, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 251, 255, 0.94)),
    #ffffff;
  color: var(--text-primary);
  box-shadow: 0 24px 56px rgba(30, 64, 175, 0.14);
}

:root:not([data-theme="dark"]) .route-game-workbench-v2-active :is(.consumption-progress__modal, .n-drawer-content) :is(.combo-toolbar, .combo-item, .combo-empty) {
  border-color: rgba(37, 99, 235, 0.13);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.84), rgba(239, 246, 255, 0.58)),
    #ffffff;
  color: var(--text-primary);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.78) inset;
}

@media (max-width: 768px) {
  .game-features-page {
    padding: 10px 8px calc(88px + env(safe-area-inset-bottom));
  }

  .game-features-page .game-command-bar {
    padding: 16px;
    border-radius: 18px;
  }

  .game-features-page .game-command-bar__main,
  .game-features-page .game-stage__header {
    gap: 12px;
  }

  .game-features-page .game-command-bar__signal-grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
    margin-top: 14px;
  }

  .game-features-page .game-command-bar__signal {
    padding: 12px 14px;
    border-radius: 14px;
  }

  .game-features-page .game-stage {
    padding: 12px;
    border-radius: 18px;
  }

  .game-features-page .game-stage-overview {
    grid-template-columns: minmax(0, 1fr);
    gap: 8px;
  }

  .game-features-page .game-stage-overview__item {
    padding: 12px 14px;
    border-radius: 14px;
  }

  .game-features-page .game-stage__canvas {
    gap: 10px;
  }

  .game-features-page .game-stage__canvas .game-status-container {
    gap: 10px;
  }

  .game-features-page .game-stage__canvas .hero-circle {
    width: 38px;
    height: 38px;
    border-radius: 11px;
  }

  .game-features-page .game-stage__canvas .heroes-container {
    min-height: 86px;
  }

  .game-features-page .game-status-container.activity-mode .boss-grid,
  .game-features-page .game-status-container.activity-mode .summary-grid,
  .game-features-page .game-status-container.activity-mode .progress-list,
  .game-features-page .game-status-container.activity-mode .consumption-actions {
    grid-template-columns: minmax(0, 1fr);
  }

  .game-features-page .game-status-container.activity-mode .consumption-controls {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
