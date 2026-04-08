<template>
  <div class="game-workbench-v2">
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

    <div class="game-workbench-v2__body game-workbench-v2__body--no-inspector">
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
import { computed, markRaw, onMounted, onUnmounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import {
  DocumentText,
  Flash,
  Speedometer,
} from "@vicons/ionicons5";
import GameStatus from "@/components/GameStatus.vue";
import {
  buildGameStatusModules,
  findGameStatusModuleById,
  GAME_STATUS_MODULE_IDS,
} from "@/components/game-status/moduleMeta";
import GameCommandBar from "@/components/game-workbench-v2/GameCommandBar.vue";
import GameInspector from "@/components/game-workbench-v2/GameInspector.vue";
import GameModuleRail from "@/components/game-workbench-v2/GameModuleRail.vue";
import GameStage from "@/components/game-workbench-v2/GameStage.vue";
import { useGameFeatureActions } from "@/composables/useGameFeatureActions";
import { useResponsive } from "@/composables/useResponsive";
import { useAuthStore } from "@/stores/auth";
import { useTokenStore } from "@/stores/tokenStore";
import { hasGameFeatureAccess } from "@/utils/accessScope";

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
  summaryCards.value[1],
  summaryCards.value[2],
  {
    label: t("gameFeatures.workbench.signals.lastActivity"),
    value: lastActivity.value || t("gameFeatures.workbench.values.none"),
    meta: t("gameFeatures.workbench.signals.lastActivityMeta"),
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
  initializeGameData,
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
    runAfterFirstPaint(async () => {
      if (status !== "connected") {
        connectWebSocket();
      } else {
        await initializeGameData();
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
</style>
