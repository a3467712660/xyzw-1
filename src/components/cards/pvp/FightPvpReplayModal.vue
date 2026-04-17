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
  buildFightPvpReplayLiveContext,
  refreshFightPvpReplayLiveContext,
} from "@/services/replay/fightPvpReplayStorage.js";
import {
  getFightPvpLiveMapIdReasonMessageKey,
} from "@/services/replay/fightPvpLiveMapIdResolver.js";
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

const formatDiagnosticValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const getReplayTokenId = () =>
  String(tokenStore.selectedToken?.id || replay.value?.tokenId || "").trim();

const getReplayLiveContext = () =>
  buildFightPvpReplayLiveContext({
    tokenStore,
  });

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
  if (Array.isArray(diagnostics.sceneAssetProbe) && diagnostics.sceneAssetProbe.length > 0) {
    lines.push(
      `sceneProbe: ${diagnostics.sceneAssetProbe.map((entry) => `${entry.stage}:${entry.pathname || entry.scenePath || "-"}:${entry.status || (entry.ok ? "ok" : (entry.error || "error"))}`).join(", ")}`,
    );
  }
  if (diagnostics.firstMissingAsset) {
    lines.push(`firstMissingAsset: ${diagnostics.firstMissingAsset}`);
  }
  if (diagnostics.firstBadContentType) {
    lines.push(`firstBadContentType: ${formatDiagnosticValue(diagnostics.firstBadContentType)}`);
  }
  if (Array.isArray(diagnostics.wxAccessLog) && diagnostics.wxAccessLog.length > 0) {
    const firstAccess = diagnostics.wxAccessLog[0];
    lines.push(`wxFirstAccess: ${firstAccess.name}`);
  }
  if (diagnostics.firstFailedAssetRequest) {
    lines.push(`firstFailedAssetRequest: ${formatDiagnosticValue(diagnostics.firstFailedAssetRequest)}`);
  }
  if (diagnostics.firstHtmlFallbackAssetRequest) {
    lines.push(`firstHtmlFallbackAssetRequest: ${formatDiagnosticValue(diagnostics.firstHtmlFallbackAssetRequest)}`);
  }
  if (diagnostics.firstPendingAssetRequest) {
    lines.push(`firstPendingAssetRequest: ${formatDiagnosticValue(diagnostics.firstPendingAssetRequest)}`);
  }
  if (diagnostics.battleInputSource) {
    lines.push(`battleInputSource: ${diagnostics.battleInputSource}`);
  }
  const directMapId = diagnostics.mapId
    ?? diagnostics.battleInputSummary?.mapId
    ?? diagnostics.replayStartMapId
    ?? null;
  if (directMapId !== null && directMapId !== undefined) {
    lines.push(`mapId: ${directMapId}`);
  }
  if (diagnostics.replayEntrypoint) {
    lines.push(`replayEntrypoint: ${diagnostics.replayEntrypoint}`);
  }
  if (diagnostics.engineReplayEntrypoint) {
    lines.push(`engineReplayEntrypoint: ${diagnostics.engineReplayEntrypoint}`);
  }
  if (diagnostics.replayGameWindowSource) {
    lines.push(`replayGameWindowSource: ${diagnostics.replayGameWindowSource}`);
  }
  if (diagnostics.replayGameWindowStatus) {
    lines.push(`replayGameWindowStatus: ${diagnostics.replayGameWindowStatus}`);
  }
  if (diagnostics.loaderFamily) {
    lines.push(`loaderFamily: ${diagnostics.loaderFamily}`);
  }
  if (diagnostics.probeFamily) {
    lines.push(`probeFamily: ${diagnostics.probeFamily}`);
  }
  if (diagnostics.probeCompatibility) {
    lines.push(`probeCompatibility: ${diagnostics.probeCompatibility}`);
  }
  if (diagnostics.bridgeStatus) {
    lines.push(`bridgeStatus: ${diagnostics.bridgeStatus}`);
  }
  if (diagnostics.bridgeSource) {
    lines.push(`bridgeSource: ${diagnostics.bridgeSource}`);
  }
  if (diagnostics.runtimeStage) {
    lines.push(`runtimeStage: ${diagnostics.runtimeStage}`);
  } else if (diagnostics.runtimeLayer) {
    lines.push(`runtimeStage: ${diagnostics.runtimeLayer}`);
  }
  if (diagnostics.sceneName) {
    lines.push(`sceneName: ${diagnostics.sceneName}`);
  }
  if (diagnostics.gameBundleRequested !== undefined) {
    lines.push(`gameBundleRequested: ${diagnostics.gameBundleRequested}`);
  }
  if (diagnostics.gameBundleLoaded !== undefined) {
    lines.push(`gameBundleLoaded: ${diagnostics.gameBundleLoaded}`);
  }
  if (diagnostics.gameSceneAssetLoaded !== undefined) {
    lines.push(`gameSceneAssetLoaded: ${diagnostics.gameSceneAssetLoaded}`);
  }
  if (diagnostics.gameSceneRunning !== undefined) {
    lines.push(`gameSceneRunning: ${diagnostics.gameSceneRunning}`);
  }
  if (diagnostics.battleModulesReady !== undefined) {
    lines.push(`battleModulesReady: ${diagnostics.battleModulesReady}`);
  }
  if (diagnostics.suspectedBundlePath) {
    lines.push(`suspectedBundlePath: ${diagnostics.suspectedBundlePath}`);
  }
  if (Array.isArray(diagnostics.incompatibleProbes) && diagnostics.incompatibleProbes.length > 0) {
    lines.push(`incompatibleProbes: ${diagnostics.incompatibleProbes.join(", ")}`);
  }
  if (diagnostics.sameRequireRef !== undefined && diagnostics.sameRequireRef !== null) {
    lines.push(`sameRequireRef: ${diagnostics.sameRequireRef}`);
  }
  if (diagnostics.hasRequireSwap !== undefined) {
    lines.push(`hasRequireSwap: ${diagnostics.hasRequireSwap}`);
  }
  if (diagnostics.requireFunctionName) {
    lines.push(`requireFunctionName: ${diagnostics.requireFunctionName}`);
  }
  if (diagnostics.launcherRequireFunctionName) {
    lines.push(`launcherRequireFunctionName: ${diagnostics.launcherRequireFunctionName}`);
  }
  if (diagnostics.gameScriptInDocument !== undefined) {
    lines.push(`gameScriptInDocument: ${diagnostics.gameScriptInDocument}`);
  }
  if (diagnostics.gameScriptInPerformance !== undefined) {
    lines.push(`gameScriptInPerformance: ${diagnostics.gameScriptInPerformance}`);
  }
  if (typeof diagnostics.replayGameBundleReady === "boolean") {
    lines.push(`replayGameBundleReady: ${diagnostics.replayGameBundleReady}`);
  }
  if (typeof diagnostics.replayGameBundleReadyAttempts === "number") {
    lines.push(`replayGameBundleReadyAttempts: ${diagnostics.replayGameBundleReadyAttempts}`);
  }
  if (diagnostics.replayGameBundleReadyError) {
    lines.push(`replayGameBundleReadyError: ${diagnostics.replayGameBundleReadyError}`);
  }
  if (diagnostics.replayGameBundleReadySource) {
    lines.push(`replayGameBundleReadySource: ${diagnostics.replayGameBundleReadySource}`);
  }
  if (Array.isArray(diagnostics.loadBundleCalls) && diagnostics.loadBundleCalls.length > 0) {
    lines.push(`loadBundleCalls: ${formatDiagnosticValue(diagnostics.loadBundleCalls)}`);
  }
  if (Array.isArray(diagnostics.tryLoadAssetCalls) && diagnostics.tryLoadAssetCalls.length > 0) {
    lines.push(`tryLoadAssetCalls: ${formatDiagnosticValue(diagnostics.tryLoadAssetCalls)}`);
  }
  if (Array.isArray(diagnostics.runSceneCalls) && diagnostics.runSceneCalls.length > 0) {
    lines.push(`runSceneCalls: ${formatDiagnosticValue(diagnostics.runSceneCalls)}`);
  }
  if (diagnostics.moduleChecks && Object.keys(diagnostics.moduleChecks).length > 0) {
    lines.push(`moduleChecks: ${formatDiagnosticValue(diagnostics.moduleChecks)}`);
  }
  if (diagnostics.bundleState) {
    lines.push(`bundleState: ${formatDiagnosticValue(diagnostics.bundleState)}`);
  }
  if (Array.isArray(diagnostics.replayEntrypointCandidates) && diagnostics.replayEntrypointCandidates.length > 0) {
    lines.push(
      `scannedEntrypointCandidates: ${diagnostics.replayEntrypointCandidates.map((entry) => `${entry.label}:${entry.status || "unknown"}`).join(", ")}`,
    );
  }
  if (Array.isArray(diagnostics.replayEntrypointRequireDebug) && diagnostics.replayEntrypointRequireDebug.length > 0) {
    lines.push(
      `replayEntrypointRequireDebug: ${formatDiagnosticValue(diagnostics.replayEntrypointRequireDebug)}`,
    );
  }
  if (typeof diagnostics.fallbackEntrypointUsed === "boolean") {
    lines.push(`fallbackEntrypointUsed: ${diagnostics.fallbackEntrypointUsed}`);
  }
  if (diagnostics.fallbackEntrypointReason) {
    lines.push(`fallbackEntrypointReason: ${diagnostics.fallbackEntrypointReason}`);
  }
  if (typeof diagnostics.enterOssAvailableButRejected === "boolean") {
    lines.push(`enterOssAvailableButRejected: ${diagnostics.enterOssAvailableButRejected}`);
  }
  if (typeof diagnostics.battleKitAvailableButRejected === "boolean") {
    lines.push(`battleKitAvailableButRejected: ${diagnostics.battleKitAvailableButRejected}`);
  }
  if (Array.isArray(diagnostics.missingRuntimeFields) && diagnostics.missingRuntimeFields.length > 0) {
    lines.push(`missingRuntimeFields: ${diagnostics.missingRuntimeFields.join(", ")}`);
  }
  if (diagnostics.mapIdSource) {
    lines.push(`mapIdSource: ${diagnostics.mapIdSource}`);
  }
  if (diagnostics.pvpMapIdSource) {
    lines.push(`pvpMapIdSource: ${diagnostics.pvpMapIdSource}`);
  }
  if (diagnostics.mapIdResolveReason) {
    lines.push(`mapIdResolveReason: ${diagnostics.mapIdResolveReason}`);
  }
  if (typeof diagnostics.runtimeRoleAvailable === "boolean") {
    lines.push(`runtimeRoleAvailable: ${diagnostics.runtimeRoleAvailable}`);
  }
  if (diagnostics.runtimeRolePath) {
    lines.push(`runtimeRolePath: ${diagnostics.runtimeRolePath}`);
  }
  if (typeof diagnostics.battleInputAvailable === "boolean") {
    lines.push(`battleInputAvailable: ${diagnostics.battleInputAvailable}`);
  }
  if (diagnostics.runtimeRoleMapId) {
    lines.push(`runtimeRoleMapId: ${diagnostics.runtimeRoleMapId}`);
  }
  if (diagnostics.dressPvpMapUsedId) {
    lines.push(`dressPvpMapUsedId: ${diagnostics.dressPvpMapUsedId}`);
  }
  if (diagnostics.selfRoleContextSource) {
    lines.push(`selfRoleContextSource: ${diagnostics.selfRoleContextSource}`);
  }
  if (Array.isArray(diagnostics.mapIdDiagnostics?.tried) && diagnostics.mapIdDiagnostics.tried.length > 0) {
    lines.push(`tried: ${diagnostics.mapIdDiagnostics.tried.join(" -> ")}`);
  }
  if (diagnostics.availableValues && Object.keys(diagnostics.availableValues).length > 0) {
    lines.push(`availableValues: ${formatDiagnosticValue(diagnostics.availableValues)}`);
  }
  if (diagnostics.fixtureMapFallbackUsed) {
    lines.push("fixtureMapFallbackUsed: true");
  }
  if (diagnostics.battleInputSummary) {
    const summary = diagnostics.battleInputSummary;
    lines.push(
      `battleInputSummary: source=${summary.battleInputSource || summary.sourceType || "-"}, mode=${summary.battleMode ?? "null"}, mapId=${summary.mapId ?? "null"}, stage=${summary.stageNameStr || "-"}, top=${summary.startTipTopName || "-"}, start=${summary.startTipStage || "-"}, teams=${summary.leftTeamSize ?? 0}/${summary.rightTeamSize ?? 0}, scores=${summary.selfScore ?? "-"}:${summary.oppoScore ?? "-"}, targetRole=${summary.hasTargetRole ? "yes" : "no"}, options=${(summary.optionsKeys || []).join("|") || "-"}, runtimeRoleMapId=${summary.runtimeRoleMapId ?? "-"}, engine=${summary.engineReplayEntrypoint || "-"}`,
    );
  }
  if (diagnostics.replayStartSignal !== undefined) {
    lines.push(
      `replayStart: signal=${diagnostics.replayStartSignal ? "true" : "false"}, panel=${diagnostics.replayStartPanel || "-"}, isReplay=${diagnostics.replayStartIsReplay ?? "-"}, mapId=${diagnostics.replayStartMapId ?? "-"}, mode=${diagnostics.replayStartBattleMode ?? "-"}`,
    );
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

const appendTechnicalMessage = (lead, detail) => {
  const prefix = String(lead || "").trim();
  const suffix = String(detail || "").trim();
  if (!prefix)
    return suffix;
  if (!suffix || suffix === prefix)
    return prefix;
  return `${prefix} ${props.t("fightPvpCard.replay.technicalDetailLabel")} ${suffix}`;
};

const getRuntimeStageMessage = (stage) => {
  const stageMap = {
    "launcher-ready": "fightPvpCard.replay.runtimeStageDescriptions.launcherReady",
    "game-scene-running": "fightPvpCard.replay.runtimeStageDescriptions.gameSceneRunning",
    "loader-family-mismatch": "fightPvpCard.replay.runtimeStageDescriptions.loaderFamilyMismatch",
    "bridge-not-exposed": "fightPvpCard.replay.runtimeStageDescriptions.bridgeNotExposed",
    "module-id-family-mismatch": "fightPvpCard.replay.runtimeStageDescriptions.moduleIdFamilyMismatch",
    "require-exec-error": "fightPvpCard.replay.runtimeStageDescriptions.requireExecError",
    "battle-modules-ready": "fightPvpCard.replay.runtimeStageDescriptions.battleModulesReady",
  };
  const key = stageMap[stage];
  return key ? props.t(key) : "";
};

const buildSpecificMapIdFailureMessage = (diagnostics) => {
  const messageKey = getFightPvpLiveMapIdReasonMessageKey(
    diagnostics?.mapIdResolveReason,
  );
  const detailParts = [];
  if (diagnostics?.runtimeRolePath) {
    detailParts.push(`runtimeRolePath=${diagnostics.runtimeRolePath}`);
  }
  if (diagnostics?.selfRoleContextSource) {
    detailParts.push(`selfRoleContextSource=${diagnostics.selfRoleContextSource}`);
  }
  if (typeof diagnostics?.runtimeRoleAvailable === "boolean") {
    detailParts.push(`runtimeRoleAvailable=${diagnostics.runtimeRoleAvailable}`);
  }
  if (typeof diagnostics?.battleInputAvailable === "boolean") {
    detailParts.push(`battleInputAvailable=${diagnostics.battleInputAvailable}`);
  }
  if (diagnostics?.dressPvpMapUsedId) {
    detailParts.push(`dressPvpMapUsedId=${diagnostics.dressPvpMapUsedId}`);
  }

  const lead = props.t(messageKey);
  return detailParts.length > 0
    ? appendTechnicalMessage(lead, detailParts.join(", "))
    : lead;
};

const buildReplayFailureMessage = ({
  failureState,
  detail = "",
  diagnostics = null,
} = {}) => {
  if (failureState === "version-mismatch") {
    return appendTechnicalMessage(
      props.t("fightPvpCard.replay.versionMismatchDescription"),
      detail,
    );
  }

  if (
    failureState === "replay-start-failed"
    && Array.isArray(diagnostics?.missingRuntimeFields)
    && diagnostics.missingRuntimeFields.length > 0
  ) {
    const missingFieldsDetail = `缺少字段：${diagnostics.missingRuntimeFields.join(", ")}。`;
    if (diagnostics.missingRuntimeFields.includes("mapId")) {
      if (diagnostics?.mapIdResolveReason) {
        return buildSpecificMapIdFailureMessage(diagnostics);
      }
      return appendTechnicalMessage(
        props.t("fightPvpCard.replay.missingMapIdDescription"),
        missingFieldsDetail,
      );
    }

    return appendTechnicalMessage(
      props.t("fightPvpCard.replay.missingFieldsDescription"),
      missingFieldsDetail,
    );
  }

  if (
    failureState === "replay-start-failed"
    && diagnostics?.replayEntrypoint
    && diagnostics?.replayStartSignal === false
  ) {
    return appendTechnicalMessage(
      props.t("fightPvpCard.replay.replaySignalMissingDescription"),
      detail,
    );
  }

  if (
    failureState === "replay-start-failed"
    && Array.isArray(diagnostics?.replayEntrypointCandidates)
    && diagnostics.replayEntrypointCandidates.some((entry) =>
      ["wrong-module-id", "wrong-export-path", "not-callable"].includes(entry?.status),
    )
  ) {
    return appendTechnicalMessage(
      props.t("fightPvpCard.replay.engineEntrypointResolveFailedDescription"),
      detail,
    );
  }

  if (
    failureState === "replay-start-failed"
    && diagnostics?.runtimeStage === "loader-family-mismatch"
  ) {
    return appendTechnicalMessage(
      props.t("fightPvpCard.replay.loaderFamilyMismatchDescription"),
      detail,
    );
  }

  if (
    failureState === "replay-start-failed"
    && diagnostics?.runtimeStage === "bridge-not-exposed"
  ) {
    return appendTechnicalMessage(
      props.t("fightPvpCard.replay.bridgeNotExposedDescription"),
      detail,
    );
  }

  if (
    failureState === "replay-start-failed"
    && diagnostics?.runtimeStage === "module-id-family-mismatch"
  ) {
    return appendTechnicalMessage(
      props.t("fightPvpCard.replay.moduleIdFamilyMismatchDescription"),
      detail,
    );
  }

  if (
    failureState === "replay-start-failed"
    && [
      "wrong-window",
      "no-require",
      "launcher-ready",
      "game-scene-running",
      "loader-family-mismatch",
      "bridge-not-exposed",
      "module-id-family-mismatch",
      "require-exec-error",
    ].includes(
      diagnostics?.runtimeStage || diagnostics?.runtimeLayer || diagnostics?.replayGameWindowStatus,
    )
    && Array.isArray(diagnostics?.replayEntrypointCandidates)
    && diagnostics.replayEntrypointCandidates.length > 0
  ) {
    const stageLead = getRuntimeStageMessage(
      diagnostics?.runtimeStage || diagnostics?.runtimeLayer || diagnostics?.replayGameWindowStatus,
    );
    return appendTechnicalMessage(
      stageLead || props.t("fightPvpCard.replay.engineEntrypointUnavailableDescription"),
      detail,
    );
  }

  if (
    failureState === "replay-start-failed"
    && Array.isArray(diagnostics?.replayEntrypointCandidates)
    && diagnostics.replayEntrypointCandidates.every((entry) => entry?.found === false)
  ) {
    return appendTechnicalMessage(
      props.t("fightPvpCard.replay.engineEntrypointUnavailableDescription"),
      detail,
    );
  }

  return detail || props.t("fightPvpCard.replay.runtimeNotReady");
};

const startReplay = async () => {
  resetRuntime();
  clearState();

  if (
    !replay.value?.exactBattleInputData
    && !replay.value?.battleInputData
    && !replay.value?.battleInputSnapshot
    && !replay.value?.battleData
  ) {
    state.value = "empty-payload";
    currentMessage.value = props.t("fightPvpCard.replay.emptyDescription");
    emitErrorMessage(currentMessage.value);
    return;
  }

  if (replay.value?.isPlayable === false) {
    state.value = "replay-start-failed";
    currentMessage.value = replay.value?.disabledReason
      || (
        replay.value?.mapIdResolveReason
          ? buildSpecificMapIdFailureMessage(replay.value)
          : props.t("fightPvpCard.replay.emptyDescription")
      );
    emitErrorMessage(currentMessage.value);
    return;
  }

  state.value = "loading";
  currentMessage.value = props.t("fightPvpCard.replay.loading");
  emitErrorMessage("");

  const liveContext = await refreshFightPvpReplayLiveContext({
    tokenStore,
    tokenId: getReplayTokenId(),
  }) || getReplayLiveContext();

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
    currentMessage.value = buildReplayFailureMessage({
      failureState: state.value,
      detail: guardResult.message,
      diagnostics: currentDiagnostics.value,
    });
    emitErrorMessage(currentMessage.value);
    return;
  }

  runtimeSession = await startFightPvpReplayRuntime({
    replay: replay.value,
    hostElement: replayHostRef.value,
    liveContext,
  });
  currentDiagnostics.value = runtimeSession?.diagnostics || null;

  if (!runtimeSession?.ok) {
    state.value = runtimeSession?.reason === "runtime-load-failed"
      ? "runtime-load-failed"
      : "replay-start-failed";
    currentMessage.value = buildReplayFailureMessage({
      failureState: state.value,
      detail: runtimeSession?.message || "",
      diagnostics: currentDiagnostics.value,
    });
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
