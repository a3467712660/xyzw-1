<template>
  <div class="lineup-assistant-page app-page">
    <PageHero
      eyebrow="阵容助手"
      title="阵容工作台"
      :description="selectedTokenDescription"
    >
      <template #meta>
        <div class="app-chip-row">
          <span class="app-inline-stat">
            <strong>{{ tokenStore.selectedToken?.name || "未选择" }}</strong>
            当前角色
          </span>
          <span class="app-inline-stat">
            <strong>{{ connectionStatusText }}</strong>
            WebSocket
          </span>
          <span class="app-inline-stat">
            <strong>{{ tokenStore.gameTokens.length }}</strong>
            已导入角色
          </span>
          <span class="app-inline-stat">
            <strong>{{ tokenStore.selectedToken?.server || "待选择" }}</strong>
            服务器
          </span>
        </div>
      </template>

      <template #actions>
        <PageToolbar class="lineup-assistant-page__actions">
          <template #left>
            <StatusPill :label="connectionStatusText" :tone="connectionPillTone">
              <template #icon>
                <NIcon>
                  <CloudDone></CloudDone>
                </NIcon>
              </template>
            </StatusPill>
          </template>

          <template #right>
            <n-button
              size="large"
              type="primary"
              @click="handleToggleConnection"
            >
              <template #icon>
                <NIcon>
                  <CloudDone></CloudDone>
                </NIcon>
              </template>
              {{ isConnected ? "断开连接" : "连接 / 重连" }}
            </n-button>

            <n-button
              size="large"
              :disabled="!tokenStore.selectedToken"
              @click="refreshWorkbenchContext"
            >
              <template #icon>
                <NIcon>
                  <Refresh></Refresh>
                </NIcon>
              </template>
              刷新基础数据
            </n-button>

            <n-button
              v-if="!tokenStore.selectedToken"
              secondary
              size="large"
              type="primary"
              @click="router.push('/tokens')"
            >
              前往 Token 管理
            </n-button>
          </template>
        </PageToolbar>
      </template>
    </PageHero>

    <SummaryGrid :items="summaryCards"></SummaryGrid>

    <n-alert
      v-if="!tokenStore.selectedToken"
      class="lineup-assistant-alert"
      type="warning"
      :show-icon="false"
    >
      当前还没有选中角色。先到 Token 管理页选择角色，再回来读取、保存或应用阵容。
    </n-alert>

    <n-alert
      v-else-if="!isConnected"
      class="lineup-assistant-alert"
      type="warning"
      :show-icon="false"
    >
      当前 WebSocket 未连接。连接成功后，本页会自动拉取阵容、武将、鱼灵和科技数据。
    </n-alert>

    <n-alert
      v-else
      class="lineup-assistant-alert"
      type="success"
      :show-icon="false"
    >
      连接正常，可以直接刷新当前阵容、保存本地方案、导入导出 JSON，并一键应用到当前阵容槽位。
    </n-alert>

    <div class="lineup-assistant-shell">
      <Unlimitedlineup></Unlimitedlineup>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import { NIcon, useMessage } from "naive-ui/es";
import { CloudDone, Refresh } from "@vicons/ionicons5";
import Unlimitedlineup from "@/components/cards/Unlimitedlineup.vue";
import PageHero from "@/components/workbench/PageHero.vue";
import PageToolbar from "@/components/workbench/PageToolbar.vue";
import StatusPill from "@/components/workbench/StatusPill.vue";
import SummaryGrid from "@/components/workbench/SummaryGrid.vue";
import { useGameFeatureActions } from "@/composables/useGameFeatureActions";
import { useTokenStore } from "@/stores/tokenStore";

const router = useRouter();
const message = useMessage();
const tokenStore = useTokenStore();
const { t } = useI18n();

const connectionStatus = computed(() => {
  if (!tokenStore.selectedToken) {
    return "disconnected";
  }
  return tokenStore.getWebSocketStatus(tokenStore.selectedToken.id) || "disconnected";
});

const connectionStatusText = computed(() => {
  if (!tokenStore.selectedToken) {
    return "未选择角色";
  }

  switch (connectionStatus.value) {
    case "connected":
      return "已连接";
    case "connecting":
      return "连接中";
    case "error":
      return "连接异常";
    default:
      return "未连接";
  }
});

const isConnected = computed(() => connectionStatus.value === "connected");

const connectionPillTone = computed(() => {
  switch (connectionStatus.value) {
    case "connected":
      return "success";
    case "connecting":
      return "info";
    case "error":
      return "error";
    default:
      return tokenStore.selectedToken ? "default" : "warning";
  }
});

const selectedTokenDescription = computed(() => {
  if (!tokenStore.selectedToken) {
    return "先在 Token 管理页选择角色，再进入这里统一管理阵容保存、导入导出和快速应用。";
  }

  if (!isConnected.value) {
    return `${tokenStore.selectedToken.name} · ${tokenStore.selectedToken.server || "未知服务器"}，当前角色已选中，但还没有建立 WebSocket 连接。`;
  }

  return `${tokenStore.selectedToken.name} · ${tokenStore.selectedToken.server || "未知服务器"}，当前可以直接读取阵容、保存配置并应用阵容方案。`;
});

const summaryCards = computed(() => [
  {
    label: "当前角色",
    value: tokenStore.selectedToken?.name || "未选择",
    meta: tokenStore.selectedToken?.server || "请先去 Token 管理页选择角色",
  },
  {
    label: "连接状态",
    value: connectionStatusText.value,
    meta: isConnected.value ? "可直接操作阵容" : "先建立连接再读取数据",
  },
  {
    label: "角色总数",
    value: String(tokenStore.gameTokens.length),
    meta: "当前账号下已导入的角色数量",
  },
  {
    label: "当前建议",
    value: tokenStore.selectedToken ? (isConnected.value ? "刷新后开始使用" : "先连接 WebSocket") : "先选择角色",
    meta: tokenStore.selectedToken
      ? (isConnected.value ? "建议先点一次刷新基础数据" : "连接成功后会自动初始化必要数据")
      : "没有当前角色时无法读取阵容信息",
  },
]);

const {
  connectWebSocket,
  initializeGameData,
  toggleConnection,
} = useGameFeatureActions({
  message,
  router,
  t,
  tokenStore,
});

const refreshWorkbenchContext = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择 Token");
    router.push("/tokens");
    return;
  }

  if (!isConnected.value) {
    connectWebSocket();
    return;
  }

  await initializeGameData();
  message.success("基础数据已刷新");
};

const handleToggleConnection = async () => {
  await toggleConnection(connectionStatus.value);
};

const lastInitializedConnectionKey = ref("");

const currentInitializationKey = computed(() => {
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

const initializeWorkbenchContextOnce = async () => {
  const initKey = currentInitializationKey.value;
  if (!initKey || initKey === lastInitializedConnectionKey.value) {
    return;
  }

  lastInitializedConnectionKey.value = initKey;
  await initializeGameData();
};

onMounted(() => {
  if (!tokenStore.hasUsableWorkbenchToken) {
    message.warning("当前没有已激活且未过期的 Token，请先前往 Token 管理完成激活");
    router.replace("/tokens");
    return;
  }

  if (!tokenStore.selectedToken) {
    return;
  }

  if (connectionStatus.value === "connected") {
    void initializeWorkbenchContextOnce();
    return;
  }

  if (connectionStatus.value !== "connecting") {
    void connectWebSocket();
  }
});

watch(
  currentInitializationKey,
  (initKey, oldInitKey) => {
    if (!initKey || initKey === oldInitKey) {
      return;
    }

    void initializeWorkbenchContextOnce();
  },
);
</script>

<style scoped lang="scss">
.lineup-assistant-page {
  --lineup-surface: rgba(255, 255, 255, 0.78);
  --lineup-surface-strong: rgba(255, 255, 255, 0.9);
  --lineup-border: rgba(37, 99, 235, 0.13);
  --lineup-shadow: 0 18px 42px rgba(30, 64, 175, 0.1);
  gap: 16px;
}

.lineup-assistant-page :deep(.workbench-page-hero) {
  align-items: start;
  gap: 16px;
  border-color: var(--lineup-border);
  background:
    radial-gradient(circle at 12% 0%, rgba(37, 99, 235, 0.13), transparent 34%),
    linear-gradient(180deg, rgba(239, 246, 255, 0.86), rgba(226, 238, 255, 0.62)),
    rgba(248, 251, 255, 0.74);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.82) inset,
    var(--lineup-shadow);
}

.lineup-assistant-page :deep(.workbench-page-hero__copy) {
  gap: 8px;
}

.lineup-assistant-page :deep(.workbench-page-hero__actions) {
  align-self: start;
  flex: 0 0 auto;
  height: fit-content;
  min-height: 0;
  padding: 12px;
  border-radius: 18px;
  border: 1px solid rgba(37, 99, 235, 0.1);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.56), rgba(219, 234, 254, 0.34)),
    rgba(239, 246, 255, 0.38);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.72) inset,
    0 10px 22px rgba(30, 64, 175, 0.06);
}

.lineup-assistant-page :deep(.app-inline-stat) {
  min-height: 36px;
  padding: 8px 12px;
  background: rgba(239, 246, 255, 0.82);
}

.lineup-assistant-page :deep(.workbench-summary-card) {
  min-height: 118px;
  border-color: var(--lineup-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(239, 246, 255, 0.52)),
    var(--lineup-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 12px 30px rgba(30, 64, 175, 0.08);
}

:global([data-theme="dark"]) .lineup-assistant-page {
  --lineup-surface: rgba(15, 23, 42, 0.78);
  --lineup-surface-strong: rgba(15, 23, 42, 0.9);
  --lineup-border: rgba(96, 165, 250, 0.2);
  --lineup-shadow: 0 18px 42px rgba(0, 0, 0, 0.28);
}

:global([data-theme="dark"]) .lineup-assistant-page :deep(.workbench-page-hero),
:global([data-theme="dark"]) .lineup-assistant-page :deep(.workbench-page-hero__actions),
:global([data-theme="dark"]) .lineup-assistant-page :deep(.workbench-summary-card),
:global([data-theme="dark"]) .lineup-assistant-shell,
:global([data-theme="dark"]) .lineup-assistant-page :deep(.lineup-saver) {
  background:
    linear-gradient(180deg, rgba(30, 41, 59, 0.72), rgba(15, 23, 42, 0.84)),
    var(--lineup-surface);
}

.lineup-assistant-page__actions {
  display: grid;
  gap: 10px;
  align-items: flex-start;
}

.lineup-assistant-page__actions :deep(.workbench-page-toolbar__group) {
  width: 100%;
}

.lineup-assistant-page__actions :deep(.workbench-page-toolbar__group--right) {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-left: 0;
}

.lineup-assistant-page__actions :deep(.workbench-status-pill) {
  justify-content: center;
  min-height: 38px;
}

.lineup-assistant-page__actions :deep(.n-button) {
  min-height: 40px;
}

.lineup-assistant-alert {
  margin-bottom: 16px;
  padding: 14px 16px;
  border-color: var(--lineup-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(239, 246, 255, 0.42)),
    var(--lineup-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.72) inset,
    0 10px 24px rgba(30, 64, 175, 0.08);
}

.lineup-assistant-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 14px;
  border: 1px solid var(--lineup-border);
  border-radius: 26px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.66), rgba(248, 251, 255, 0.72)),
    var(--lineup-surface);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.72) inset,
    0 16px 38px rgba(30, 64, 175, 0.09);
}

.lineup-assistant-page :deep(.lineup-saver) {
  min-height: auto;
  border: 1px solid var(--lineup-border);
  border-radius: 22px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(239, 246, 255, 0.46)),
    var(--lineup-surface-strong);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.78) inset,
    0 12px 30px rgba(30, 64, 175, 0.08);
}

.lineup-assistant-page :deep(.toolbar) {
  width: 100%;
}

.lineup-assistant-page :deep(.lineup-toolbar) {
  border-color: var(--lineup-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.76), rgba(226, 238, 255, 0.46)),
    rgba(255, 255, 255, 0.68);
  box-shadow: 0 1px 0 rgba(255, 255, 255, 0.72) inset;
}

.lineup-assistant-page :deep(.current-team-section) {
  border-color: var(--lineup-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(239, 246, 255, 0.46)),
    rgba(255, 255, 255, 0.68);
}

.lineup-assistant-page :deep(.hero-actions .n-button) {
  min-height: 40px;
}

@media (max-width: 640px) {
  .lineup-assistant-page {
    gap: 12px;
  }

  .lineup-assistant-page :deep(.workbench-page-hero) {
    padding: 16px;
    border-radius: 22px;
    background:
      radial-gradient(circle at 18% 0%, rgba(37, 99, 235, 0.14), transparent 38%),
      linear-gradient(180deg, rgba(239, 246, 255, 0.94), rgba(219, 234, 254, 0.7)),
      rgba(248, 251, 255, 0.76);
  }

  .lineup-assistant-page :deep(.workbench-page-hero__actions) {
    padding: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
  }

  .lineup-assistant-page :deep(.app-page__title) {
    font-size: 28px;
  }

  .lineup-assistant-page :deep(.app-chip-row),
  .lineup-assistant-page :deep(.app-page__summary) {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .lineup-assistant-page :deep(.app-inline-stat) {
    justify-content: space-between;
    min-height: 34px;
    padding: 7px 10px;
    font-size: 12px;
  }

  .lineup-assistant-page :deep(.workbench-summary-card) {
    min-height: 96px;
    padding: 12px;
    border-radius: 16px;
  }

  .lineup-assistant-page__actions {
    width: 100%;
  }

  .lineup-assistant-page__actions :deep(.workbench-page-toolbar__group) {
    display: grid;
    align-items: stretch;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .lineup-assistant-page__actions :deep(.workbench-page-toolbar__group--right) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .lineup-assistant-page__actions :deep(.workbench-page-toolbar__group > *) {
    width: 100%;
    min-width: 0;
  }

  .lineup-assistant-page__actions :deep(.workbench-status-pill) {
    min-height: 34px;
    padding: 7px 10px;
    background: rgba(255, 255, 255, 0.52);
    box-shadow: 0 1px 0 rgba(255, 255, 255, 0.68) inset;
  }

  .lineup-assistant-page__actions :deep(.n-button) {
    min-height: 36px;
    padding-inline: 8px;
  }

  .lineup-assistant-alert {
    padding: 12px 14px;
  }

  .lineup-assistant-shell {
    padding: 10px;
    border-radius: 20px;
  }

  .lineup-assistant-page :deep(.lineup-saver) {
    border-radius: 18px;
  }
}

@media (max-width: 420px) {
  .lineup-assistant-page :deep(.app-chip-row),
  .lineup-assistant-page :deep(.app-page__summary),
  .lineup-assistant-page__actions :deep(.workbench-page-toolbar__group),
  .lineup-assistant-page__actions :deep(.workbench-page-toolbar__group--right) {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
