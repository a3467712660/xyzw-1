<template>
  <div class="game-workbench-v2 battle-reports-page">
    <GameCommandBar
      eyebrow="Report Center"
      title="战报功能"
      token-action-label="Token 管理"
      :active-group-name="activeGroup?.label || ''"
      :active-module-name="activeModuleMeta?.label || ''"
      :connection-action-label="connectionActionLabel"
      :connection-status-text="connectionStatusText"
      :connection-tone="connectionPillTone"
      :description="selectedTokenDescription"
      :is-connected="isConnected"
      :show-inspector-button="false"
      :signals="commandSignals"
      @go-tokens="goToTokens"
      @toggle-connection="handleToggleConnection"
    ></GameCommandBar>

    <div class="game-workbench-v2__body game-workbench-v2__body--no-inspector">
      <GameModuleRail
        dock-label="战报导航"
        v-model="activeModule"
        :groups="moduleGroups"
      ></GameModuleRail>

      <GameStage
        eyebrow="战报工作区"
        status-label="连接状态"
        :group-label="activeGroup?.label || ''"
        :module-description="activeModuleMeta?.description || ''"
        :module-name="activeModuleMeta?.label || '战报功能'"
        :status-class="connectionClass"
        :status-text="connectionStatusText"
      >
        <div class="battle-reports-stage">
          <div class="game-stage-overview game-stage-overview--report">
            <article
              v-for="card in stageCards"
              :key="card.label"
              class="game-stage-overview__item"
            >
              <span class="game-stage-overview__label">{{ card.label }}</span>
              <strong class="game-stage-overview__value">{{ card.value }}</strong>
              <span class="game-stage-overview__meta">{{ card.meta }}</span>
            </article>
          </div>

          <div
            v-if="mountedModules.saltField"
            v-show="activeModule === REPORT_MODULE_IDS.saltField"
            class="battle-reports-panel battle-reports-panel--salt"
          >
            <header class="battle-reports-panel__header">
              <div class="battle-reports-panel__copy">
                <span class="battle-reports-panel__eyebrow">盐场战报</span>
                <h3>盐场地图、战况与周月报表</h3>
                <p>把匹配详情、周战绩、月战绩和实时态势统一放进同一条工作带里切换查看。</p>
              </div>
            </header>

            <div class="sub-nav sub-nav-center">
              <n-tabs
                animated
                class="sub-tabs"
                size="small"
                type="segment"
                v-model:value="saltFieldSubTab"
              >
                <n-tab-pane name="warrank" tab="匹配详情"></n-tab-pane>
                <n-tab-pane name="weekBattle" tab="周战绩"></n-tab-pane>
                <n-tab-pane name="monthBattle" tab="月战绩"></n-tab-pane>
                <n-tab-pane name="legionWarMap" tab="实时地图"></n-tab-pane>
                <n-tab-pane name="legionWarStatistics" tab="实时战况"></n-tab-pane>
              </n-tabs>
            </div>

            <div
              v-if="mountedSaltTabs.weekBattle"
              v-show="saltFieldSubTab === 'weekBattle'"
              class="warrank-full-container"
            >
              <ClubBattleRecords></ClubBattleRecords>
            </div>
            <div
              v-if="mountedSaltTabs.warrank"
              v-show="saltFieldSubTab === 'warrank'"
              class="warrank-full-container"
            >
              <ClubWarrank></ClubWarrank>
            </div>
            <div
              v-if="mountedSaltTabs.monthBattle"
              v-show="saltFieldSubTab === 'monthBattle'"
              class="warrank-full-container"
            >
              <ClubMonthBattleRecords></ClubMonthBattleRecords>
            </div>
            <div
              v-if="mountedSaltTabs.legionWarMap"
              v-show="saltFieldSubTab === 'legionWarMap'"
              class="warrank-full-container"
            >
              <LegionWarMap></LegionWarMap>
            </div>
            <div
              v-if="mountedSaltTabs.legionWarStatistics"
              v-show="saltFieldSubTab === 'legionWarStatistics'"
              class="warrank-full-container"
            >
              <LegionWarStatistics></LegionWarStatistics>
            </div>
          </div>

          <div
            v-if="mountedModules.peachGarden"
            v-show="activeModule === REPORT_MODULE_IDS.peachGarden"
            class="battle-reports-panel battle-reports-panel--peach"
          >
            <header class="battle-reports-panel__header">
              <div class="battle-reports-panel__copy">
                <span class="battle-reports-panel__eyebrow">蟠桃园战报</span>
                <h3>概览与对战战报并排归档</h3>
                <p>先看蟠桃概览，再切到对战战报，移动端仍保持同一阅读顺序和切换语气。</p>
              </div>
            </header>

            <div class="sub-nav sub-nav-center">
              <n-tabs
                animated
                class="sub-tabs"
                size="small"
                type="segment"
                v-model:value="peachSubTab"
              >
                <n-tab-pane name="peach" tab="蟠桃概览"></n-tab-pane>
                <n-tab-pane name="peachBattle" tab="对战战报"></n-tab-pane>
              </n-tabs>
            </div>

            <div
              v-if="mountedPeachTabs.peach"
              v-show="peachSubTab === 'peach'"
              class="warrank-full-container"
            >
              <PeachInfo></PeachInfo>
            </div>
            <div
              v-if="mountedPeachTabs.peachBattle"
              v-show="peachSubTab === 'peachBattle'"
              class="warrank-full-container"
            >
              <PeachBattleRecords></PeachBattleRecords>
            </div>
          </div>
        </div>
      </GameStage>
    </div>
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
import { DocumentText } from "@vicons/ionicons5";
import GameCommandBar from "@/components/game-workbench-v2/GameCommandBar.vue";
import GameModuleRail from "@/components/game-workbench-v2/GameModuleRail.vue";
import GameStage from "@/components/game-workbench-v2/GameStage.vue";
import { useGameFeatureActions } from "@/composables/useGameFeatureActions";
import { useTokenStore } from "@/stores/tokenStore";

const ClubWarrank = defineAsyncComponent(
  () => import("@/components/Club/ClubWarrank.vue"),
);
const ClubMonthBattleRecords = defineAsyncComponent(
  () => import("@/components/Club/ClubMonthBattleRecords.vue"),
);
const ClubBattleRecords = defineAsyncComponent(
  () => import("@/components/Club/ClubBattleRecords.vue"),
);
const PeachBattleRecords = defineAsyncComponent(
  () => import("@/components/Club/PeachBattleRecords.vue"),
);
const PeachInfo = defineAsyncComponent(
  () => import("@/components/Club/PeachInfo.vue"),
);
const LegionWarMap = defineAsyncComponent(
  () => import("@/components/Club/LegionWarMap.vue"),
);
const LegionWarStatistics = defineAsyncComponent(
  () => import("@/components/Club/LegionWarStatistics.vue"),
);

const REPORT_GROUP_ICONS = Object.freeze({
  reports: markRaw(DocumentText),
});

const REPORT_MODULE_IDS = Object.freeze({
  peachGarden: "peachGarden",
  saltField: "saltField",
});

const REPORT_ROUTE_CLASS = "route-game-workbench-v2-active";

const router = useRouter();
const message = useMessage();
const tokenStore = useTokenStore();
const { t } = useI18n();

const activeModule = ref(REPORT_MODULE_IDS.saltField);
const lastActivity = ref(null);
const saltFieldSubTab = ref("warrank");
const peachSubTab = ref("peach");
const lastLegionInitKey = ref("");

const mountedModules = ref({
  peachGarden: false,
  saltField: true,
});

const mountedSaltTabs = ref({
  legionWarMap: false,
  legionWarStatistics: false,
  monthBattle: false,
  warrank: true,
  weekBattle: false,
});

const mountedPeachTabs = ref({
  peach: true,
  peachBattle: false,
});

const reportModules = computed(() => [
  {
    description: "俱乐部盐场战绩、地图与实时战况。",
    id: REPORT_MODULE_IDS.saltField,
    label: "盐场",
  },
  {
    description: "蟠桃园概览与对战战报。",
    id: REPORT_MODULE_IDS.peachGarden,
    label: "蟠桃园",
  },
]);

const moduleGroups = computed(() => [
  {
    caption: "盐场与蟠桃园战报",
    icon: REPORT_GROUP_ICONS.reports,
    id: "reports",
    items: reportModules.value,
    label: "战报中心",
  },
]);

const activeGroup = computed(() =>
  moduleGroups.value.find((group) => group.items.some((item) => item.id === activeModule.value))
  || moduleGroups.value[0]
  || null,
);

const activeModuleMeta = computed(() =>
  reportModules.value.find((item) => item.id === activeModule.value) || reportModules.value[0] || null,
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

const currentSubTabLabel = computed(() => {
  if (activeModule.value === REPORT_MODULE_IDS.saltField) {
    const labels = {
      legionWarMap: "实时地图",
      legionWarStatistics: "实时战况",
      monthBattle: "月战绩",
      warrank: "匹配详情",
      weekBattle: "周战绩",
    };
    return labels[saltFieldSubTab.value] || "匹配详情";
  }

  const labels = {
    peach: "蟠桃概览",
    peachBattle: "对战战报",
  };
  return labels[peachSubTab.value] || "蟠桃概览";
});

const selectedTokenDescription = computed(() => {
  if (!tokenStore.selectedToken) {
    return "先去 Token 管理页导入并选择角色，再回到这里查看盐场和蟠桃园战报。";
  }

  return `${tokenStore.selectedToken.name} · ${tokenStore.selectedToken.server || "未知服务器"} · 战报视图`;
});

const commandSignals = computed(() => [
  {
    label: "当前角色",
    meta: tokenStore.selectedToken?.server || "去 Token 管理页选择角色",
    value: tokenStore.selectedToken?.name || "未选择",
  },
  {
    label: "连接状态",
    meta: isConnected.value ? "战报组件可直接使用当前连接" : "先恢复连接再查看实时内容",
    value: connectionStatusText.value,
  },
  {
    label: "当前模块",
    meta: activeModuleMeta.value?.description || "选择盐场或蟠桃园",
    value: activeModuleMeta.value?.label || "战报功能",
  },
  {
    label: "当前页签",
    meta: "已从游戏功能独立迁移到战报功能",
    value: currentSubTabLabel.value,
  },
]);

const stageCards = computed(() => [
  {
    label: "当前模块",
    value: activeModuleMeta.value?.label || "战报功能",
    meta: activeModuleMeta.value?.description || "先在左侧切换盐场或蟠桃园，再进入具体页签。",
  },
  {
    label: "当前页签",
    value: currentSubTabLabel.value,
    meta: activeModule.value === REPORT_MODULE_IDS.saltField
      ? "地图、实时战况与周月战绩都在同一工作带里。"
      : "在概览与对战战报之间快速来回切换。",
  },
  {
    label: "连接状态",
    value: connectionStatusText.value,
    meta: isConnected.value ? "实时内容会复用当前连接。" : "建议先恢复连接再查看实时态势。",
  },
  {
    label: "最近活动",
    value: lastActivity.value || "未记录",
    meta: "切换模块、页签或连接动作后，这里的时间会更新。",
  },
]);

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

  document.body.classList.toggle(REPORT_ROUTE_CLASS, enabled);
  document.getElementById("app")?.classList.toggle(REPORT_ROUTE_CLASS, enabled);
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

const currentLegionInitKey = computed(() => {
  if (!tokenStore.selectedToken) {
    return "";
  }

  const tokenId = tokenStore.selectedToken.id;
  const connection = tokenStore.wsConnections[tokenId];
  if (connection?.status !== "connected") {
    return "";
  }

  return `${tokenId}:${connection.connectedAt || "connected"}`;
});

const initializeLegionInfoOnce = () => {
  if (!tokenStore.selectedToken) {
    return;
  }

  const initKey = currentLegionInitKey.value;
  if (!initKey || initKey === lastLegionInitKey.value) {
    return;
  }

  lastLegionInitKey.value = initKey;
  tokenStore.sendMessage(tokenStore.selectedToken.id, "legion_getinfo");
};

watch(
  activeModule,
  (moduleId) => {
    mountedModules.value[moduleId] = true;
    updateLastActivity();
  },
  { immediate: true },
);

watch(
  saltFieldSubTab,
  (tab) => {
    mountedSaltTabs.value[tab] = true;
    updateLastActivity();
  },
  { immediate: true },
);

watch(
  peachSubTab,
  (tab) => {
    mountedPeachTabs.value[tab] = true;
    updateLastActivity();
  },
  { immediate: true },
);

watch(
  currentLegionInitKey,
  (initKey) => {
    if (!initKey) {
      return;
    }
    initializeLegionInfoOnce();
  },
);

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
    if (status === "connected") {
      initializeLegionInfoOnce();
    }
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
      return { lastError: null, status: "disconnected" };
    }
    const conn = tokenStore.wsConnections[tokenStore.selectedToken.id];
    return { lastError: conn?.lastError, status: conn?.status };
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

<style scoped lang="scss">
.battle-reports-stage {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: var(--spacing-md);
}

.battle-reports-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 14px;
  padding: 18px;
  border-radius: 24px;
  border: 1px solid rgba(63, 119, 173, 0.12);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), transparent 26%),
    rgba(255, 255, 255, 0.2);
}

.battle-reports-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.battle-reports-panel__copy {
  display: grid;
  gap: 6px;
}

.battle-reports-panel__eyebrow {
  color: var(--text-tertiary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.battle-reports-panel__copy h3 {
  margin: 0;
  font-size: clamp(18px, 2vw, 24px);
  color: var(--text-primary);
}

.battle-reports-panel__copy p {
  margin: 0;
  max-width: 68ch;
  color: var(--text-secondary);
  line-height: 1.65;
}

.sub-nav-center {
  padding: 10px;
  display: flex;
  justify-content: flex-start;
  border-radius: 20px;
  border: 1px solid rgba(63, 119, 173, 0.12);
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.12), transparent 82%),
    rgba(255, 255, 255, 0.38);
}

.sub-tabs :deep(.n-tabs-nav-scroll-wrapper) {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.sub-tabs :deep(.n-tabs-nav-scroll-content) {
  display: inline-flex;
  flex-wrap: nowrap;
  min-width: max-content;
}

.warrank-full-container {
  width: 100%;
  height: calc(100dvh - 200px);
  min-height: 600px;
  overflow: auto;
  border-radius: 18px;
}

@media (max-width: 959px) {
  .battle-reports-panel {
    padding: 14px;
    border-radius: 20px;
  }

  .sub-nav-center {
    justify-content: flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .warrank-full-container {
    height: auto;
    min-height: calc(100dvh - 180px);
    overflow: visible;
    padding-bottom: env(safe-area-inset-bottom);
  }
}
</style>
