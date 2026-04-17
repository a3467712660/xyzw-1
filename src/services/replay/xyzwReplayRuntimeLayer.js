const XYZW_RUNTIME_LAYER_STATE_KEY = "__xyzwReplayRuntimeLayerState";
const XYZW_RUNTIME_LAYER_EVENT_LIMIT = 60;
const XYZW_GAME_BUNDLE_NAME = "game";
const XYZW_GAME_SCENE_PATH = "scenes/Game";
const XYZW_SRC_LOADER_FAMILY = "src-xyzw-loader";
const XYZW_PUBLIC_LOADER_FAMILY = "public-xyzw-loader";
const XYZW_UNKNOWN_LOADER_FAMILY = "unknown-loader";
const XYZW_SOURCE_PROBE_FAMILY = "source-id-probes";
const XYZW_PRODUCTION_PROBE_FAMILY = "production-id-probes";
const XYZW_CANONICAL_REPLAY_MODULE_IDS = Object.freeze([
  "BattleUIManager",
  "enter-oss",
  "BattleKitCrossSite",
]);
const XYZW_PUBLIC_SCRIPT_PATTERNS = Object.freeze([
  "/xyzw/index.js",
]);
const XYZW_GAME_SCRIPT_PATTERNS = Object.freeze([
  "/assets/game/index.js",
  "/xyzw/game.js",
  "/game.js",
]);
const XYZW_MAIN_SCRIPT_PATTERNS = Object.freeze([
  "/assets/main/index.js",
  "/xyzw/main.js",
  "/main.js",
]);

const toErrorMessage = (error, fallback) =>
  error?.message || String(error || fallback || "Unknown error");

const toErrorName = (error) =>
  typeof error?.name === "string" && error.name
    ? error.name
    : null;

const toStackTop = (error) => {
  const lines = String(error?.stack || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length <= 1) {
    return lines[0] || null;
  }
  return lines[1];
};

const isMissingModuleError = (message) =>
  /cannot find module|module not found|cannot find/i.test(String(message || ""));

const isObjectLike = (value) =>
  value && (typeof value === "object" || typeof value === "function");

const toFunctionSource = (fn) => {
  if (typeof fn !== "function") {
    return null;
  }
  try {
    return Function.prototype.toString.call(fn);
  } catch {
    return null;
  }
};

const matchesScriptPattern = (value, patterns) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  return patterns.some((pattern) =>
    normalized.includes(pattern) || normalized.endsWith(pattern),
  );
};

const isGameScriptUrl = (value) =>
  matchesScriptPattern(value, XYZW_GAME_SCRIPT_PATTERNS);

const isMainScriptUrl = (value) =>
  matchesScriptPattern(value, XYZW_MAIN_SCRIPT_PATTERNS);

const isPublicRuntimeScriptUrl = (value) =>
  matchesScriptPattern(value, XYZW_PUBLIC_SCRIPT_PATTERNS);

const toNormalizedSourceSnippet = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const looksLikePublicXyzwRequireSource = (source) => {
  const normalized = toNormalizedSourceSnippet(source);
  if (!normalized) {
    return false;
  }
  return normalized.includes("function e(t, n, r)")
    || normalized.includes("function e(t,n,r)")
    || normalized.includes("if (!n[a]) { if (!t[a])")
    || normalized.includes("if(!n[a]){if(!t[a])");
};

const looksLikeSrcXyzwRequireSource = (source) => {
  const normalized = toNormalizedSourceSnippet(source);
  if (!normalized) {
    return false;
  }
  return normalized.includes("function i(a, s, c)")
    || normalized.includes("function i(a,s,c)")
    || normalized.includes("function a(r, s, l)")
    || normalized.includes("function a(r,s,l)")
    || normalized.includes("if (!s[t]) { if (!a[t])")
    || normalized.includes("if(!s[t]){if(!a[t])")
    || normalized.includes("if (!s[t]) { if (!r[t])")
    || normalized.includes("if(!s[t]){if(!r[t])");
};

const trimEntries = (entries = []) => {
  if (entries.length <= XYZW_RUNTIME_LAYER_EVENT_LIMIT) {
    return entries;
  }
  entries.splice(0, entries.length - XYZW_RUNTIME_LAYER_EVENT_LIMIT);
  return entries;
};

const cloneEntry = (entry) => ({
  at: entry?.at || null,
  assetPath: entry?.assetPath || null,
  assetType: entry?.assetType || null,
  bundleName: entry?.bundleName || null,
  detail: entry?.detail || null,
  error: entry?.error || null,
  ok: typeof entry?.ok === "boolean" ? entry.ok : null,
  path: entry?.path || null,
  phase: entry?.phase || null,
  resolved: typeof entry?.resolved === "boolean" ? entry.resolved : null,
  sceneName: entry?.sceneName || null,
  source: entry?.source || null,
  src: entry?.src || null,
  status: entry?.status || null,
  target: entry?.target || null,
});

export const getOrCreateXyzwRuntimeLayerState = (runtimeWindow) => {
  if (!isObjectLike(runtimeWindow)) {
    return null;
  }

  const existing = runtimeWindow[XYZW_RUNTIME_LAYER_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing;
  }

  const state = {
    launcherRequireRef: null,
    nextId: 0,
    bundleEvents: [],
    loadBundleCalls: [],
    pendingBundlePromises: new Map(),
    pendingSceneAssetPromises: new Map(),
    runSceneCalls: [],
    scriptEvents: [],
    tryLoadAssetCalls: [],
  };
  Object.defineProperty(runtimeWindow, XYZW_RUNTIME_LAYER_STATE_KEY, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: state,
  });
  return state;
};

export const getLiveRequire = (gameWindow) => {
  const req = gameWindow?.__require;
  if (typeof req !== "function") {
    throw new TypeError("live window.__require is not available");
  }
  return req;
};

export const rememberLauncherRequireRef = (gameWindow) => {
  const state = getOrCreateXyzwRuntimeLayerState(gameWindow);
  if (!state) {
    return null;
  }
  if (!state.launcherRequireRef) {
    const req = gameWindow?.__require;
    if (typeof req === "function") {
      state.launcherRequireRef = req;
    }
  }
  return state.launcherRequireRef || null;
};

export const getRequireFingerprint = (req) => {
  if (typeof req !== "function") {
    return null;
  }
  const src = toFunctionSource(req) || "";
  return {
    name: req.name || null,
    length: src.length,
    head: src.slice(0, 120),
    tail: src.slice(-120),
  };
};

const appendStateEntry = (collection, entry) => {
  collection.push(entry);
  trimEntries(collection);
  return entry;
};

export const recordXyzwRuntimeScriptEvent = ({
  runtimeWindow,
  src,
  status,
  source = "unknown",
  error = null,
  detail = null,
} = {}) => {
  const state = getOrCreateXyzwRuntimeLayerState(runtimeWindow);
  if (!state) {
    return null;
  }
  return appendStateEntry(state.scriptEvents, {
    at: Date.now(),
    detail,
    error: error ? toErrorMessage(error) : null,
    source,
    src: String(src || ""),
    status: status || "observed",
  });
};

export const recordXyzwBundleEvent = ({
  runtimeWindow,
  bundleName,
  status,
  source = "unknown",
  target = null,
  error = null,
  detail = null,
} = {}) => {
  const state = getOrCreateXyzwRuntimeLayerState(runtimeWindow);
  if (!state) {
    return null;
  }
  return appendStateEntry(state.bundleEvents, {
    at: Date.now(),
    bundleName: String(bundleName || ""),
    detail,
    error: error ? toErrorMessage(error) : null,
    source,
    status: status || "observed",
    target: target == null ? null : String(target),
  });
};

export const recordXyzwLoadBundleCall = ({
  runtimeWindow,
  bundleName,
  source = "unknown",
  target = null,
  phase = "requested",
  resolved = false,
  ok = null,
  error = null,
  detail = null,
} = {}) => {
  const state = getOrCreateXyzwRuntimeLayerState(runtimeWindow);
  if (!state) {
    return null;
  }
  return appendStateEntry(state.loadBundleCalls, {
    at: Date.now(),
    bundleName: String(bundleName || ""),
    detail,
    error: error ? toErrorMessage(error) : null,
    ok,
    phase,
    resolved,
    source,
    target: target == null ? null : String(target),
  });
};

export const recordXyzwTryLoadAssetCall = ({
  runtimeWindow,
  bundleName,
  path,
  assetType = null,
  source = "unknown",
  phase = "requested",
  resolved = false,
  ok = null,
  error = null,
  detail = null,
} = {}) => {
  const state = getOrCreateXyzwRuntimeLayerState(runtimeWindow);
  if (!state) {
    return null;
  }
  return appendStateEntry(state.tryLoadAssetCalls, {
    assetType: assetType?.name || assetType || null,
    at: Date.now(),
    bundleName: String(bundleName || ""),
    detail,
    error: error ? toErrorMessage(error) : null,
    ok,
    path: String(path || ""),
    phase,
    resolved,
    source,
  });
};

export const recordXyzwRunSceneCall = ({
  runtimeWindow,
  sceneName,
  source = "cc.director.runScene",
  detail = null,
} = {}) => {
  const state = getOrCreateXyzwRuntimeLayerState(runtimeWindow);
  if (!state) {
    return null;
  }
  return appendStateEntry(state.runSceneCalls, {
    at: Date.now(),
    detail,
    sceneName: sceneName || null,
    source,
  });
};

export const trackXyzwBundlePromise = ({
  runtimeWindow,
  bundleName,
  source = "unknown",
  target = null,
  result,
} = {}) => {
  if (!result || typeof result.then !== "function") {
    return result;
  }

  const state = getOrCreateXyzwRuntimeLayerState(runtimeWindow);
  if (!state) {
    return result;
  }

  const entryId = `${String(bundleName || "")}:${source}:${state.nextId++}`;
  recordXyzwBundleEvent({
    runtimeWindow,
    bundleName,
    status: "requested",
    source,
    target,
  });
  recordXyzwLoadBundleCall({
    runtimeWindow,
    bundleName,
    source,
    target,
    phase: "requested",
    resolved: false,
  });

  const trackedPromise = Promise.resolve(result).then(
    (value) => {
      state.pendingBundlePromises.delete(entryId);
      recordXyzwBundleEvent({
        runtimeWindow,
        bundleName,
        status: "resolved",
        source,
        target,
      });
      recordXyzwLoadBundleCall({
        runtimeWindow,
        bundleName,
        source,
        target,
        phase: "resolved",
        resolved: true,
        ok: true,
      });
      return value;
    },
    (error) => {
      state.pendingBundlePromises.delete(entryId);
      recordXyzwBundleEvent({
        runtimeWindow,
        bundleName,
        status: "rejected",
        source,
        target,
        error,
      });
      recordXyzwLoadBundleCall({
        runtimeWindow,
        bundleName,
        source,
        target,
        phase: "rejected",
        resolved: true,
        ok: false,
        error,
      });
      throw error;
    },
  );

  state.pendingBundlePromises.set(entryId, {
    bundleName: String(bundleName || ""),
    promise: trackedPromise,
    source,
    target: target == null ? null : String(target),
  });

  return trackedPromise;
};

export const trackXyzwTryLoadAssetPromise = ({
  runtimeWindow,
  bundleName,
  path,
  assetType = null,
  source = "unknown",
  result,
} = {}) => {
  if (!result || typeof result.then !== "function") {
    return result;
  }

  const state = getOrCreateXyzwRuntimeLayerState(runtimeWindow);
  if (!state) {
    return result;
  }

  const entryId = `${String(bundleName || "")}:${String(path || "")}:${source}:${state.nextId++}`;
  recordXyzwTryLoadAssetCall({
    runtimeWindow,
    bundleName,
    path,
    assetType,
    source,
    phase: "requested",
    resolved: false,
  });

  const trackedPromise = Promise.resolve(result).then(
    (value) => {
      state.pendingSceneAssetPromises.delete(entryId);
      recordXyzwTryLoadAssetCall({
        runtimeWindow,
        bundleName,
        path,
        assetType,
        source,
        phase: "resolved",
        resolved: true,
        ok: true,
      });
      return value;
    },
    (error) => {
      state.pendingSceneAssetPromises.delete(entryId);
      recordXyzwTryLoadAssetCall({
        runtimeWindow,
        bundleName,
        path,
        assetType,
        source,
        phase: "rejected",
        resolved: true,
        ok: false,
        error,
      });
      throw error;
    },
  );

  state.pendingSceneAssetPromises.set(entryId, {
    bundleName: String(bundleName || ""),
    path: String(path || ""),
    promise: trackedPromise,
    source,
  });

  return trackedPromise;
};

const getPendingPromisesByFilter = (runtimeWindow, selector) => {
  const state = getOrCreateXyzwRuntimeLayerState(runtimeWindow);
  if (!state) {
    return [];
  }
  return selector(state).map((entry) => entry.promise);
};

const getPendingGameBundlePromises = (runtimeWindow) =>
  getPendingPromisesByFilter(runtimeWindow, (state) => [...state.pendingBundlePromises.values()].filter((entry) =>
    entry.bundleName === XYZW_GAME_BUNDLE_NAME
    || isGameScriptUrl(entry.target)
    || entry.target === XYZW_GAME_BUNDLE_NAME,
  ));

const getPendingGameSceneAssetPromises = (runtimeWindow) =>
  getPendingPromisesByFilter(runtimeWindow, (state) => [...state.pendingSceneAssetPromises.values()].filter((entry) =>
    entry.bundleName === XYZW_GAME_BUNDLE_NAME
    && entry.path === XYZW_GAME_SCENE_PATH,
  ));

const getWindowScriptUrls = (candidateWindow) => {
  try {
    return Array.from(candidateWindow?.document?.scripts || [])
      .map((script) => String(script?.src || ""))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const getWindowPerformanceResourceUrls = (candidateWindow) => {
  try {
    const entries = candidateWindow?.performance?.getEntriesByType?.("resource") || [];
    return Array.from(entries)
      .map((entry) => String(entry?.name || ""))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const collectLoaderEvidenceStrings = ({
  scriptUrls = [],
  performanceUrls = [],
  loadEvidence = null,
  liveRequireSource = null,
  launcherRequireSource = null,
  canonicalModuleChecks = null,
} = {}) => {
  const messages = [
    ...scriptUrls,
    ...performanceUrls,
    liveRequireSource,
    launcherRequireSource,
  ];
  for (const entry of loadEvidence?.scriptEvents || []) {
    messages.push(entry?.src, entry?.detail, entry?.error);
  }
  for (const entry of loadEvidence?.bundleEvents || []) {
    messages.push(entry?.target, entry?.detail, entry?.error);
  }
  for (const moduleId of Object.keys(canonicalModuleChecks || {})) {
    messages.push(
      canonicalModuleChecks?.[moduleId]?.errorMessage,
      canonicalModuleChecks?.[moduleId]?.stackTop,
    );
  }
  return messages
    .map((value) => String(value || "").trim())
    .filter(Boolean);
};

const findSuspectedBundlePath = (messages = []) => {
  const publicPath = messages.find((value) => isPublicRuntimeScriptUrl(value));
  if (publicPath) {
    return "/xyzw/index.js";
  }
  const sourcePath = messages.find((value) => isMainScriptUrl(value) || isGameScriptUrl(value));
  return sourcePath || null;
};

const createModuleFamilyMismatchCheck = (moduleId, loaderFamily, probeFamily) => ({
  ok: false,
  status: "module-id-family-mismatch",
  moduleId,
  value: null,
  error: null,
  errorName: null,
  errorMessage: `${moduleId} is a source-era probe and is incompatible with ${loaderFamily}.`,
  stackTop: null,
  missing: false,
  incompatibleProbe: true,
  loaderFamily,
  probeFamily,
});

const toSerializableModuleCheck = (result) => ({
  error: result.error,
  errorMessage: result.errorMessage || result.error,
  errorName: result.errorName || null,
  incompatibleProbe: result.incompatibleProbe === true,
  loaderFamily: result.loaderFamily || null,
  missing: result.missing,
  ok: result.ok,
  probeFamily: result.probeFamily || null,
  stackTop: result.stackTop || null,
  status: result.status,
});

export const detectLoaderFamily = (gameWindow, {
  launcherRequireRef = null,
  currentRequire = null,
  scriptUrls = null,
  performanceUrls = null,
  loadEvidence = null,
  canonicalModuleChecks = null,
} = {}) => {
  const resolvedScriptUrls = scriptUrls || getWindowScriptUrls(gameWindow);
  const resolvedPerformanceUrls = performanceUrls || getWindowPerformanceResourceUrls(gameWindow);
  const liveRequire = currentRequire || (typeof gameWindow?.__require === "function" ? gameWindow.__require : null);
  const launcherRequire = launcherRequireRef || getOrCreateXyzwRuntimeLayerState(gameWindow)?.launcherRequireRef || null;
  const liveRequireSource = toFunctionSource(liveRequire);
  const launcherRequireSource = toFunctionSource(launcherRequire);
  const evidenceStrings = collectLoaderEvidenceStrings({
    scriptUrls: resolvedScriptUrls,
    performanceUrls: resolvedPerformanceUrls,
    loadEvidence,
    liveRequireSource,
    launcherRequireSource,
    canonicalModuleChecks,
  });
  const publicEvidence = [];
  const srcEvidence = [];

  if (resolvedScriptUrls.some(isPublicRuntimeScriptUrl)) {
    publicEvidence.push("document:/xyzw/index.js");
  }
  if (resolvedPerformanceUrls.some(isPublicRuntimeScriptUrl)) {
    publicEvidence.push("performance:/xyzw/index.js");
  }
  if (looksLikePublicXyzwRequireSource(liveRequireSource)) {
    publicEvidence.push("fingerprint:live-require-public");
  }
  if (looksLikePublicXyzwRequireSource(launcherRequireSource)) {
    publicEvidence.push("fingerprint:launcher-require-public");
  }
  if (evidenceStrings.some((value) => isPublicRuntimeScriptUrl(value))) {
    publicEvidence.push("observed:/xyzw/index.js");
  }

  if (resolvedScriptUrls.some((value) => isGameScriptUrl(value) || isMainScriptUrl(value))) {
    srcEvidence.push("document:source-era-loader");
  }
  if (resolvedPerformanceUrls.some((value) => isGameScriptUrl(value) || isMainScriptUrl(value))) {
    srcEvidence.push("performance:source-era-loader");
  }
  if (looksLikeSrcXyzwRequireSource(liveRequireSource)) {
    srcEvidence.push("fingerprint:live-require-source");
  }
  if (looksLikeSrcXyzwRequireSource(launcherRequireSource)) {
    srcEvidence.push("fingerprint:launcher-require-source");
  }
  for (const moduleId of XYZW_CANONICAL_REPLAY_MODULE_IDS) {
    if (canonicalModuleChecks?.[moduleId]?.status === "present") {
      srcEvidence.push(`source-canonical-module:${moduleId}`);
    }
  }

  let loaderFamily = XYZW_UNKNOWN_LOADER_FAMILY;
  if (publicEvidence.length > 0) {
    loaderFamily = XYZW_PUBLIC_LOADER_FAMILY;
  } else if (srcEvidence.length > 0) {
    loaderFamily = XYZW_SRC_LOADER_FAMILY;
  }

  return {
    loaderFamily,
    evidence: {
      publicEvidence,
      srcEvidence,
    },
    liveRequireFingerprint: getRequireFingerprint(liveRequire),
    suspectedBundlePath: findSuspectedBundlePath(evidenceStrings),
  };
};

export const probeXyzwRuntimeModule = (gameWindow, moduleId) => {
  if (!gameWindow) {
    return {
      ok: false,
      status: "no-window",
      moduleId,
      value: null,
      error: null,
      errorName: null,
      errorMessage: null,
      stackTop: null,
      missing: false,
    };
  }

  let req;
  try {
    req = getLiveRequire(gameWindow);
  } catch {
    return {
      ok: false,
      status: "no-require",
      moduleId,
      value: null,
      error: null,
      errorName: null,
      errorMessage: null,
      stackTop: null,
      missing: false,
    };
  }

  try {
    return {
      ok: true,
      status: "present",
      moduleId,
      value: req(moduleId),
      error: null,
      errorName: null,
      errorMessage: null,
      stackTop: null,
      missing: false,
    };
  } catch (error) {
    const errorMessage = toErrorMessage(error, `Failed to require module "${moduleId}".`);
    const errorName = toErrorName(error);
    const stackTop = toStackTop(error);
    const missing = isMissingModuleError(errorMessage);
    return {
      ok: false,
      status: missing ? "module-missing" : "require-threw",
      moduleId,
      value: null,
      error: errorMessage,
      errorName,
      errorMessage,
      stackTop,
      missing,
    };
  }
};

const deriveRuntimeStage = ({
  hasRequire,
  loaderFamily,
  probeFamily,
  probeCompatibility,
  bridgeExposed,
  gameSceneRunning,
  battleModulesReady,
  requireExecError,
} = {}) => {
  if (!hasRequire) {
    return "no-require";
  }
  if (
    loaderFamily === XYZW_PUBLIC_LOADER_FAMILY
    && probeFamily === XYZW_SOURCE_PROBE_FAMILY
    && probeCompatibility === "incompatible-probe"
  ) {
    return "loader-family-mismatch";
  }
  if (
    loaderFamily === XYZW_PUBLIC_LOADER_FAMILY
    && probeFamily === XYZW_PRODUCTION_PROBE_FAMILY
    && bridgeExposed !== true
  ) {
    return "bridge-not-exposed";
  }
  if (battleModulesReady) {
    return "battle-modules-ready";
  }
  if (requireExecError) {
    return "require-exec-error";
  }
  if (gameSceneRunning) {
    return "game-scene-running";
  }
  return "launcher-ready";
};

const isReadyReplayBridge = (value) =>
  Boolean(
    value
    && value.__xyzwReplayBridgeReady === true
    && (typeof value.inspect === "function" || typeof value.play === "function"),
  );

const hasReadyReplayBridge = (candidateWindow) =>
  isReadyReplayBridge(candidateWindow?.__xyzwReplayBridge)
  || isReadyReplayBridge(candidateWindow?.__xyzwReplay);

const inspectSingleWindowBundleState = (
  candidateWindow,
  windowLabel = "window",
  {
    probeFamily = XYZW_SOURCE_PROBE_FAMILY,
  } = {},
) => {
  const state = getOrCreateXyzwRuntimeLayerState(candidateWindow);
  const launcherRequireRef = state?.launcherRequireRef || null;
  const currentRequire = typeof candidateWindow?.__require === "function"
    ? candidateWindow.__require
    : null;
  const launcherRequireSource = toFunctionSource(launcherRequireRef);
  const currentRequireSource = toFunctionSource(currentRequire);
  const scriptUrls = getWindowScriptUrls(candidateWindow);
  const performanceUrls = getWindowPerformanceResourceUrls(candidateWindow);
  const hasRequire = typeof candidateWindow?.__require === "function";
  const sameRequireRef = launcherRequireRef && currentRequire
    ? currentRequire === launcherRequireRef
    : null;
  const sameRequireSource = launcherRequireSource && currentRequireSource
    ? currentRequireSource === launcherRequireSource
    : null;
  const hasRequireSwap = launcherRequireRef && currentRequire
    ? currentRequire !== launcherRequireRef
    : false;
  const requireFunctionName = currentRequire?.name || null;
  const launcherRequireFunctionName = launcherRequireRef?.name || null;
  const launcherRequireFingerprint = getRequireFingerprint(launcherRequireRef);
  const liveRequireFingerprint = getRequireFingerprint(currentRequire);
  const sceneName = candidateWindow?.cc?.director?.getScene?.()?.name
    ?? (state?.runSceneCalls || []).filter((entry) => entry?.sceneName).at(-1)?.sceneName
    ?? null;
  const loadBundleCalls = (state?.loadBundleCalls || []).map(cloneEntry);
  const tryLoadAssetCalls = (state?.tryLoadAssetCalls || []).map(cloneEntry);
  const runSceneCalls = (state?.runSceneCalls || []).map(cloneEntry);
  const loadEvidence = {
    bundleEvents: (state?.bundleEvents || []).map(cloneEntry),
    scriptEvents: (state?.scriptEvents || []).map(cloneEntry),
  };
  const gameBundleRequested = loadBundleCalls.some((entry) =>
    entry.bundleName === XYZW_GAME_BUNDLE_NAME
    && entry.phase === "requested",
  ) || tryLoadAssetCalls.some((entry) =>
    entry.bundleName === XYZW_GAME_BUNDLE_NAME
    && entry.phase === "requested",
  );
  const gameBundleLoaded = loadBundleCalls.some((entry) =>
    entry.bundleName === XYZW_GAME_BUNDLE_NAME
    && entry.resolved
    && entry.ok === true,
  );
  const gameSceneAssetLoaded = tryLoadAssetCalls.some((entry) =>
    entry.bundleName === XYZW_GAME_BUNDLE_NAME
    && entry.path === XYZW_GAME_SCENE_PATH
    && entry.resolved
    && entry.ok === true,
  );
  const gameSceneRunning = sceneName === "Game"
    || runSceneCalls.some((entry) => entry.sceneName === "Game");
  const preliminaryLoaderFamilyInfo = detectLoaderFamily(candidateWindow, {
    launcherRequireRef,
    currentRequire,
    scriptUrls,
    performanceUrls,
    loadEvidence,
  });
  const canonicalModuleChecks = preliminaryLoaderFamilyInfo.loaderFamily === XYZW_PUBLIC_LOADER_FAMILY
    ? Object.fromEntries(
        XYZW_CANONICAL_REPLAY_MODULE_IDS.map((moduleId) => [
          moduleId,
          toSerializableModuleCheck(
            createModuleFamilyMismatchCheck(
              moduleId,
              preliminaryLoaderFamilyInfo.loaderFamily,
              XYZW_SOURCE_PROBE_FAMILY,
            ),
          ),
        ]),
      )
    : Object.fromEntries(
        XYZW_CANONICAL_REPLAY_MODULE_IDS.map((moduleId) => [
          moduleId,
          toSerializableModuleCheck(probeXyzwRuntimeModule(candidateWindow, moduleId)),
        ]),
      );
  const loaderFamilyInfo = detectLoaderFamily(candidateWindow, {
    launcherRequireRef,
    currentRequire,
    scriptUrls,
    performanceUrls,
    loadEvidence,
    canonicalModuleChecks,
  });
  const loaderFamily = loaderFamilyInfo.loaderFamily;
  const bridgeExposed = hasReadyReplayBridge(candidateWindow);
  const productionBridgeReady = loaderFamily === XYZW_PUBLIC_LOADER_FAMILY
    && probeFamily === XYZW_PRODUCTION_PROBE_FAMILY
    && bridgeExposed;
  const battleModulesReady = productionBridgeReady || (
    gameSceneRunning
    && loaderFamily === XYZW_SRC_LOADER_FAMILY
    && canonicalModuleChecks.BattleUIManager?.status === "present"
  );
  const firstRequireExecError = XYZW_CANONICAL_REPLAY_MODULE_IDS.find((moduleId) =>
    canonicalModuleChecks[moduleId]?.status === "require-threw",
  ) || null;
  const requireExecError = !battleModulesReady && Boolean(firstRequireExecError);
  const incompatibleProbes = loaderFamily === XYZW_PUBLIC_LOADER_FAMILY
    ? [...XYZW_CANONICAL_REPLAY_MODULE_IDS]
    : [];
  const probeCompatibility = loaderFamily === XYZW_PUBLIC_LOADER_FAMILY
    && probeFamily === XYZW_SOURCE_PROBE_FAMILY
    ? "incompatible-probe"
    : "compatible-probe";

  return {
    details: {
      battleModulesReady,
      bridgeExposed,
      canonicalModuleChecks,
      gameBundleLoaded,
      gameBundleRequested,
      gameSceneAssetLoaded,
      gameSceneRunning,
      gameScriptInDocument: scriptUrls.some(isGameScriptUrl),
      gameScriptInPerformance: performanceUrls.some(isGameScriptUrl),
      hasRequire,
      hasRequireSwap,
      firstRequireExecErrorModuleId: firstRequireExecError,
      launcherRequireFunctionName,
      launcherRequireFingerprint,
      loadBundleCalls,
      loadEvidence,
      loaderFamily,
      loaderFamilyEvidence: loaderFamilyInfo.evidence,
      liveRequireFingerprint,
      mainScriptInDocument: scriptUrls.some(isMainScriptUrl),
      mainScriptInPerformance: performanceUrls.some(isMainScriptUrl),
      moduleChecks: canonicalModuleChecks,
      incompatibleProbes,
      probeCompatibility,
      probeFamily,
      productionBridgeReady,
      requireExecError,
      requireFunctionName,
      requireSwap: hasRequireSwap,
      runSceneCalls,
      sameRequireSource,
      scene: sceneName,
      sceneName,
      sameRequireRef,
      suspectedBundlePath: loaderFamilyInfo.suspectedBundlePath,
      tryLoadAssetCalls,
      windowLabel,
    },
    layer: deriveRuntimeStage({
      battleModulesReady,
      bridgeExposed,
      gameSceneRunning,
      hasRequire,
      loaderFamily,
      probeCompatibility,
      probeFamily,
      requireExecError,
    }),
    windowLabel,
  };
};

export const detectXyzwRuntimeLayer = (
  gameWindow,
  {
    windowLabel = "window",
    probeFamily = XYZW_SOURCE_PROBE_FAMILY,
  } = {},
) => {
  if (!gameWindow) {
    return {
      layer: "no-window",
      details: {
        battleModulesReady: false,
        bridgeExposed: false,
        canonicalModuleChecks: Object.fromEntries(
          XYZW_CANONICAL_REPLAY_MODULE_IDS.map((moduleId) => [
            moduleId,
            {
              error: null,
              errorMessage: null,
              errorName: null,
              incompatibleProbe: false,
              loaderFamily: null,
              missing: false,
              ok: false,
              probeFamily: null,
              stackTop: null,
              status: "no-window",
            },
          ]),
        ),
        gameBundleLoaded: false,
        gameBundleRequested: false,
        gameSceneAssetLoaded: false,
        gameSceneRunning: false,
        gameScriptInDocument: false,
        gameScriptInPerformance: false,
        hasRequire: false,
        hasRequireSwap: false,
        firstRequireExecErrorModuleId: null,
        incompatibleProbes: [],
        launcherRequireFunctionName: null,
        launcherRequireFingerprint: null,
        loadBundleCalls: [],
        loadEvidence: {
          bundleEvents: [],
          scriptEvents: [],
        },
        loaderFamily: XYZW_UNKNOWN_LOADER_FAMILY,
        loaderFamilyEvidence: {
          publicEvidence: [],
          srcEvidence: [],
        },
        liveRequireFingerprint: null,
        mainScriptInDocument: false,
        mainScriptInPerformance: false,
        moduleChecks: Object.fromEntries(
          XYZW_CANONICAL_REPLAY_MODULE_IDS.map((moduleId) => [
            moduleId,
            {
              error: null,
              errorMessage: null,
              errorName: null,
              incompatibleProbe: false,
              loaderFamily: null,
              missing: false,
              ok: false,
              probeFamily: null,
              stackTop: null,
              status: "no-window",
            },
          ]),
        ),
        probeCompatibility: "incompatible-probe",
        probeFamily,
        requireExecError: false,
        requireFunctionName: null,
        requireSwap: false,
        runSceneCalls: [],
        sameRequireSource: null,
        scene: null,
        sceneName: null,
        sameRequireRef: null,
        suspectedBundlePath: null,
        tryLoadAssetCalls: [],
        windowLabel,
      },
    };
  }

  const inspection = inspectSingleWindowBundleState(gameWindow, windowLabel, {
    probeFamily,
  });
  return {
    layer: inspection.layer,
    details: inspection.details,
  };
};

export const inspectBundleState = (
  rootWindow = null,
  {
    probeFamily = XYZW_SOURCE_PROBE_FAMILY,
  } = {},
) => {
  const windows = [];

  if (!rootWindow) {
    return {
      currentWindow: null,
      currentWindowLabel: null,
      windows: [],
    };
  }

  windows.push(inspectSingleWindowBundleState(rootWindow, "window", { probeFamily }));
  const iframes = Array.from(rootWindow?.document?.querySelectorAll?.("iframe") || []);
  for (let index = 0; index < iframes.length; index += 1) {
    try {
      windows.push(
        inspectSingleWindowBundleState(
          iframes[index]?.contentWindow || null,
          `iframe[${index}]`,
          { probeFamily },
        ),
      );
    } catch {
      windows.push(
        detectXyzwRuntimeLayer(null, { windowLabel: `iframe[${index}]`, probeFamily }),
      );
    }
  }

  return {
    battleModulesReady: windows[0]?.details?.battleModulesReady ?? false,
    canonicalModuleChecks: windows[0]?.details?.canonicalModuleChecks || {},
    currentWindow: windows[0] || null,
    currentWindowLabel: windows[0]?.windowLabel || null,
    gameBundleLoaded: windows[0]?.details?.gameBundleLoaded ?? false,
    gameBundleRequested: windows[0]?.details?.gameBundleRequested ?? false,
    gameSceneAssetLoaded: windows[0]?.details?.gameSceneAssetLoaded ?? false,
    gameSceneRunning: windows[0]?.details?.gameSceneRunning ?? false,
    hasRequire: windows[0]?.details?.hasRequire ?? false,
    hasRequireSwap: windows[0]?.details?.hasRequireSwap ?? false,
    incompatibleProbes: windows[0]?.details?.incompatibleProbes || [],
    launcherRequireFingerprint: windows[0]?.details?.launcherRequireFingerprint ?? null,
    launcherRequireFunctionName: windows[0]?.details?.launcherRequireFunctionName ?? null,
    loaderFamily: windows[0]?.details?.loaderFamily ?? XYZW_UNKNOWN_LOADER_FAMILY,
    loaderFamilyEvidence: windows[0]?.details?.loaderFamilyEvidence || {
      publicEvidence: [],
      srcEvidence: [],
    },
    liveRequireFingerprint: windows[0]?.details?.liveRequireFingerprint ?? null,
    loadBundleCalls: windows[0]?.details?.loadBundleCalls || [],
    moduleChecks: windows[0]?.details?.canonicalModuleChecks || {},
    probeCompatibility: windows[0]?.details?.probeCompatibility ?? "compatible-probe",
    probeFamily: windows[0]?.details?.probeFamily ?? probeFamily,
    requireFunctionName: windows[0]?.details?.requireFunctionName ?? null,
    requireSwap: windows[0]?.details?.requireSwap ?? false,
    runSceneCalls: windows[0]?.details?.runSceneCalls || [],
    sameRequireSource: windows[0]?.details?.sameRequireSource ?? null,
    scene: windows[0]?.details?.scene ?? null,
    sceneName: windows[0]?.details?.sceneName ?? null,
    sameRequireRef: windows[0]?.details?.sameRequireRef ?? null,
    suspectedBundlePath: windows[0]?.details?.suspectedBundlePath ?? null,
    tryLoadAssetCalls: windows[0]?.details?.tryLoadAssetCalls || [],
    windows,
  };
};

export const inspectLoaderFamily = (
  rootWindow = null,
  {
    probeFamily = XYZW_SOURCE_PROBE_FAMILY,
  } = {},
) => {
  const snapshot = inspectBundleState(rootWindow, { probeFamily });
  return {
    currentAssetPath: snapshot.suspectedBundlePath,
    currentWindow: snapshot.currentWindow,
    currentWindowLabel: snapshot.currentWindowLabel,
    incompatibleProbes: snapshot.incompatibleProbes,
    loaderFamily: snapshot.loaderFamily,
    probeCompatibility: snapshot.probeCompatibility,
    probeFamily: snapshot.probeFamily,
    requireFingerprint: snapshot.liveRequireFingerprint,
    suspectedBundlePath: snapshot.suspectedBundlePath,
    windows: snapshot.windows,
  };
};

const buildBattleModulesReadySource = (details) => {
  if (!details) {
    return null;
  }
  if (details.loaderFamily === XYZW_PUBLIC_LOADER_FAMILY) {
    if (details.bridgeExposed) {
      return "window.__xyzwReplayBridge";
    }
    return details.probeFamily === XYZW_PRODUCTION_PROBE_FAMILY
      ? "bridge-not-exposed"
      : "loader-family-mismatch";
  }
  if (details.battleModulesReady) {
    return "BattleUIManager";
  }
  if (details.requireExecError) {
    return "require-exec-error";
  }
  if (details.gameSceneRunning) {
    return "runScene(Game)";
  }
  if (details.hasRequire) {
    return "launcher-ready";
  }
  return null;
};

const getRuntimeLayerErrorMessage = (details) =>
  details?.canonicalModuleChecks?.BattleUIManager?.errorMessage
  || details?.canonicalModuleChecks?.BattleUIManager?.error
  || (
    details?.firstRequireExecErrorModuleId
      ? details?.canonicalModuleChecks?.[details.firstRequireExecErrorModuleId]?.errorMessage
        || details?.canonicalModuleChecks?.[details.firstRequireExecErrorModuleId]?.error
      : null
  )
  || null;

const waitForSignal = async (runtimeWindow, intervalMs) => {
  await new Promise((resolve) => runtimeWindow.setTimeout(resolve, intervalMs));
};

export const waitForBattleModulesReady = async ({
  gameWindow,
  runtimeWindow = gameWindow,
  timeoutMs = 15000,
  intervalMs = 50,
  windowLabel = "window",
  probeFamily = XYZW_SOURCE_PROBE_FAMILY,
} = {}) => {
  const initial = detectXyzwRuntimeLayer(gameWindow, { windowLabel, probeFamily });
  if (
    initial.layer === "battle-modules-ready"
    || initial.layer === "loader-family-mismatch"
    || initial.layer === "bridge-not-exposed"
    || initial.layer === "require-exec-error"
    || initial.layer === "no-window"
    || initial.layer === "no-require"
  ) {
    return {
      attempts: 0,
      details: initial.details,
      error: initial.layer === "battle-modules-ready"
        ? null
        : getRuntimeLayerErrorMessage(initial.details),
      gameBundleReadySource: buildBattleModulesReadySource(initial.details),
      layer: initial.layer,
      ok: initial.layer === "battle-modules-ready",
      status: initial.layer,
    };
  }

  const startedAt = Date.now();
  let attempts = 0;
  let latest = initial;

  while (Date.now() - startedAt < timeoutMs) {
    attempts += 1;
    const pendingSignals = [
      ...getPendingGameBundlePromises(gameWindow),
      ...getPendingGameSceneAssetPromises(gameWindow),
    ];
    if (pendingSignals.length > 0) {
      await Promise.race([
        Promise.allSettled(pendingSignals),
        waitForSignal(runtimeWindow, intervalMs),
      ]);
    } else {
      await waitForSignal(runtimeWindow, intervalMs);
    }

    latest = detectXyzwRuntimeLayer(gameWindow, { windowLabel, probeFamily });
    if (
      latest.layer === "battle-modules-ready"
      || latest.layer === "loader-family-mismatch"
      || latest.layer === "bridge-not-exposed"
      || latest.layer === "require-exec-error"
      || latest.layer === "no-window"
      || latest.layer === "no-require"
    ) {
      return {
        attempts,
        details: latest.details,
        error: latest.layer === "battle-modules-ready"
          ? null
          : getRuntimeLayerErrorMessage(latest.details),
        gameBundleReadySource: buildBattleModulesReadySource(latest.details),
        layer: latest.layer,
        ok: latest.layer === "battle-modules-ready",
        status: latest.layer,
      };
    }
  }

  return {
    attempts,
    details: latest.details,
    error: getRuntimeLayerErrorMessage(latest.details),
    gameBundleReadySource: buildBattleModulesReadySource(latest.details),
    layer: latest.layer,
    ok: false,
    status: latest.layer,
  };
};

export const ensureXyzwGameBundleReady = (options = {}) =>
  waitForBattleModulesReady(options);
