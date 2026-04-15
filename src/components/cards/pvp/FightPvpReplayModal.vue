<template>
  <n-modal
    class="fight-pvp-replay-modal modal-w-960"
    preset="card"
    size="huge"
    v-model:show="showModel"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }"
    :title="t('fightPvpCard.replay.title')"
  >
    <template #header-extra>
      <span class="replay-header-extra">
        {{ t("fightPvpCard.replay.versionLabel", { value: replay?.battleVersion || "-" }) }}
      </span>
    </template>

    <div class="replay-modal-content">
      <div v-if="state === 'loading'" class="replay-state replay-state--loading">
        <n-spin size="large">
          <template #description>
            {{ currentMessage || t("fightPvpCard.replay.loading") }}
          </template>
        </n-spin>
      </div>

      <n-alert
        v-else-if="state === 'empty-payload'"
        type="warning"
        :title="t('fightPvpCard.replay.emptyTitle')"
      >
        {{ currentMessage || t("fightPvpCard.replay.emptyDescription") }}
      </n-alert>

      <n-alert
        v-else-if="state === 'version-mismatch'"
        type="warning"
        :title="t('fightPvpCard.replay.versionMismatchTitle')"
      >
        {{ currentMessage }}
      </n-alert>

      <n-alert
        v-else-if="state === 'runtime-load-failed'"
        type="error"
        :title="t('fightPvpCard.replay.runtimeLoadFailedTitle')"
      >
        {{ currentMessage }}
      </n-alert>

      <n-alert
        v-else-if="state === 'replay-start-failed'"
        type="error"
        :title="t('fightPvpCard.replay.replayStartFailedTitle')"
      >
        {{ currentMessage }}
      </n-alert>

      <div class="replay-runtime-shell">
        <div ref="replayHostRef" class="replay-runtime-host"></div>
      </div>

      <div v-if="diagnosticLines.length > 0" class="replay-diagnostic">
        <div class="replay-diagnostic__title">
          {{ t("fightPvpCard.replay.diagnosticTitle") }}
        </div>
        <div
          v-for="(line, index) in diagnosticLines"
          :key="`diagnostic-${index}`"
          class="replay-diagnostic__line"
        >
          {{ line }}
        </div>
      </div>
    </div>

    <template #footer>
      <div class="replay-modal-footer">
        <n-button @click="showModel = false">
          {{ t("fightPvpCard.actions.close") }}
        </n-button>
      </div>
    </template>
  </n-modal>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useTokenStore } from "@/stores/tokenStore";
import {
  FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS,
  guardFightPvpReplayVersion,
} from "@/services/replay/fightPvpReplayVersionGuard.js";
import { startFightPvpReplayRuntime } from "@/services/replay/fightPvpReplayRuntimeBridge.js";

const props = defineProps({
  replay: {
    type: Object,
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
  t: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits(["error", "update:show"]);

const tokenStore = useTokenStore();
const replayHostRef = ref(null);
const state = ref("idle");
const currentMessage = ref("");
const currentDiagnostics = ref(null);
let runtimeSession = null;

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const replay = computed(() => props.replay || null);

const diagnosticLines = computed(() => {
  const diagnostics = currentDiagnostics.value;
  if (!diagnostics) {
    return [];
  }

  const lines = [];
  if (Array.isArray(diagnostics.steps) && diagnostics.steps.length > 0) {
    lines.push(`steps: ${diagnostics.steps.join(" -> ")}`);
  }
  if (diagnostics.runtimeSnapshotBeforeBoot) {
    lines.push(
      `beforeBoot: scene=${diagnostics.runtimeSnapshotBeforeBoot.sceneName || "null"}, platform=${diagnostics.runtimeSnapshotBeforeBoot.runtimePlatform || "unknown"}, prepared=${diagnostics.runtimeSnapshotBeforeBoot.gamePrepared}, renderer=${diagnostics.runtimeSnapshotBeforeBoot.gameRendererInitialized}`,
    );
  }
  if (diagnostics.runtimeSnapshotAfterBoot) {
    lines.push(
      `afterBoot: scene=${diagnostics.runtimeSnapshotAfterBoot.sceneName || "null"}, state=${diagnostics.runtimeSnapshotAfterBoot.currentGameState || "null"}, prepared=${diagnostics.runtimeSnapshotAfterBoot.gamePrepared}, renderer=${diagnostics.runtimeSnapshotAfterBoot.gameRendererInitialized}`,
    );
  }
  if (diagnostics.runtimeSnapshotAfterLauncher) {
    lines.push(
      `afterLauncher: scene=${diagnostics.runtimeSnapshotAfterLauncher.sceneName || "null"}, state=${diagnostics.runtimeSnapshotAfterLauncher.currentGameState || "null"}, launcher=${diagnostics.runtimeSnapshotAfterLauncher.launcherReady ? "ready" : "missing"}`,
    );
  }
  if (Array.isArray(diagnostics.gameStateHistory) && diagnostics.gameStateHistory.length > 0) {
    lines.push(`states: ${diagnostics.gameStateHistory.join(" -> ")}`);
  }
  if (Array.isArray(diagnostics.bundleAssetProbe) && diagnostics.bundleAssetProbe.length > 0) {
    lines.push(
      `bundleProbe: ${diagnostics.bundleAssetProbe.map((entry) => `${entry.pathname}:${entry.status || (entry.ok ? "ok" : "error")}`).join(", ")}`,
    );
  }
  if (Array.isArray(diagnostics.wxAccessLog) && diagnostics.wxAccessLog.length > 0) {
    const firstAccess = diagnostics.wxAccessLog[0];
    lines.push(`wxFirstAccess: ${firstAccess.name}`);
  }
  if (diagnostics.replayEntrypoint) {
    lines.push(`replayEntrypoint: ${diagnostics.replayEntrypoint}`);
  }
  if (diagnostics.error) {
    lines.push(`error: ${diagnostics.error}`);
  }
  return lines;
});

const clearHost = () => {
  if (replayHostRef.value) {
    replayHostRef.value.innerHTML = "";
  }
};

const resetRuntime = () => {
  if (runtimeSession?.dispose) {
    runtimeSession.dispose();
  }
  runtimeSession = null;
  clearHost();
};

const clearState = () => {
  currentMessage.value = "";
  currentDiagnostics.value = null;
  state.value = "idle";
};

const cleanupReplay = () => {
  resetRuntime();
  clearState();
};

const emitErrorMessage = (message) => {
  emit("error", message || "");
};

const startReplay = async () => {
  resetRuntime();
  clearState();

  if (!replay.value?.battleData) {
    state.value = "empty-payload";
    currentMessage.value = props.t("fightPvpCard.replay.emptyDescription");
    emitErrorMessage(currentMessage.value);
    return;
  }

  state.value = "loading";
  currentMessage.value = props.t("fightPvpCard.replay.loading");
  emitErrorMessage("");

  const guardResult = await guardFightPvpReplayVersion({
    replay: replay.value,
    tokenStore,
    selectedToken: tokenStore.selectedToken,
  });

  if (!guardResult.ok) {
    currentDiagnostics.value = {
      error: guardResult.message,
      steps: ["guard-battle-version"],
      runtimeSnapshotBeforeBoot: {
        sceneName: null,
        gamePrepared: null,
        gameRendererInitialized: null,
      },
    };
    state.value = guardResult.reason === FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.VERSION_MISMATCH
      ? "version-mismatch"
      : "replay-start-failed";
    currentMessage.value = guardResult.message;
    emitErrorMessage(currentMessage.value);
    return;
  }

  runtimeSession = await startFightPvpReplayRuntime({
    replay: replay.value,
    hostElement: replayHostRef.value,
  });
  currentDiagnostics.value = runtimeSession?.diagnostics || null;

  if (!runtimeSession?.ok) {
    state.value = runtimeSession?.reason === "runtime-load-failed"
      ? "runtime-load-failed"
      : "replay-start-failed";
    currentMessage.value = runtimeSession?.message
      || props.t("fightPvpCard.replay.runtimeNotReady");
    emitErrorMessage(currentMessage.value);
    return;
  }

  state.value = "playing";
  currentMessage.value = "";
  emitErrorMessage("");
};

watch(
  [showModel, () => replay.value?.replayId],
  ([visible]) => {
    if (!visible) {
      cleanupReplay();
      emitErrorMessage("");
      return;
    }

    void startReplay();
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  cleanupReplay();
});
</script>

<style scoped lang="scss">
.modal-w-960 {
  width: min(960px, calc(100vw - 32px));
}

.replay-header-extra {
  font-size: 12px;
  color: var(--text-tertiary);
}

.replay-modal-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.replay-state--loading {
  display: flex;
  justify-content: center;
  padding: 16px 0 4px;
}

.replay-runtime-shell {
  min-height: 320px;
  border-radius: 16px;
  border: 1px solid var(--border-light);
  background:
    radial-gradient(circle at top, rgba(255, 255, 255, 0.14), transparent 45%),
    linear-gradient(180deg, #1a1f2c 0%, #10141d 100%);
  overflow: hidden;
}

.replay-runtime-host {
  width: 100%;
  min-height: 320px;
}

.replay-diagnostic {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px 14px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.06);
  border: 1px dashed rgba(15, 23, 42, 0.18);
}

.replay-diagnostic__title {
  font-size: 13px;
  font-weight: 600;
}

.replay-diagnostic__line {
  font-size: 12px;
  color: var(--text-tertiary);
  word-break: break-word;
}

.replay-modal-footer {
  display: flex;
  justify-content: flex-end;
}

:deep(.fight-pvp-replay-runtime-viewport) {
  width: 100%;
  height: 100%;
  min-height: 320px;
}

:deep(.fight-pvp-replay-runtime-canvas) {
  width: 100%;
  min-height: 320px;
  display: block;
}
</style>
