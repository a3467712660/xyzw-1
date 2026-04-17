const XYZW_RUNTIME_LAYER_STATE_KEY = "__xyzwReplayRuntimeLayerState";
const XYZW_RUNTIME_LAYER_EVENT_LIMIT = 60;
const XYZW_GAME_BUNDLE_NAME = "game";
const XYZW_GAME_SCENE_PATH = "scenes/Game";
const XYZW_CANONICAL_REPLAY_MODULE_IDS = Object.freeze([
  "BattleUIManager",
  "enter-oss",
  "BattleKitCrossSite",
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

const isMissingModuleError = (message) =>
  /cannot find module|module not found|cannot find/i.test(String(message || ""));

const isObjectLike = (value) =>
  value && (typeof value === "object" || typeof value === "function");

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

export const probeXyzwRuntimeModule = (gameWindow, moduleId) => {
  if (!gameWindow) {
    return {
      ok: false,
      status: "no-window",
      moduleId,
      value: null,
      error: null,
      missing: false,
    };
  }

  if (typeof gameWindow.__require !== "function") {
    return {
      ok: false,
      status: "no-require",
      moduleId,
      value: null,
      error: null,
      missing: false,
    };
  }

  try {
    return {
      ok: true,
      status: "present",
      moduleId,
      value: gameWindow.__require(moduleId),
      error: null,
      missing: false,
    };
  } catch (error) {
    const errorText = toErrorMessage(error, `Failed to require module "${moduleId}".`);
    return {
      ok: false,
      status: isMissingModuleError(errorText) ? "module-missing" : "require-threw",
      moduleId,
      value: null,
      error: errorText,
      missing: isMissingModuleError(errorText),
    };
  }
};

const toSerializableModuleCheck = (result) => ({
  error: result.error,
  missing: result.missing,
  ok: result.ok,
  status: result.status,
});

const deriveRuntimeStage = ({
  hasRequire,
  gameBundleRequested,
  gameBundleLoaded,
  gameSceneAssetLoaded,
  gameSceneRunning,
  battleModulesReady,
} = {}) => {
  if (!hasRequire) {
    return "no-require";
  }
  if (battleModulesReady) {
    return "battle-modules-ready";
  }
  if (gameSceneRunning) {
    return "game-scene-running";
  }
  if (gameSceneAssetLoaded) {
    return "game-scene-asset-loaded";
  }
  if (gameBundleLoaded) {
    return "game-bundle-loaded";
  }
  if (gameBundleRequested) {
    return "game-bundle-requested";
  }
  return "launcher-ready";
};

const inspectSingleWindowBundleState = (candidateWindow, windowLabel = "window") => {
  const state = getOrCreateXyzwRuntimeLayerState(candidateWindow);
  const scriptUrls = getWindowScriptUrls(candidateWindow);
  const performanceUrls = getWindowPerformanceResourceUrls(candidateWindow);
  const canonicalModuleChecks = Object.fromEntries(
    XYZW_CANONICAL_REPLAY_MODULE_IDS.map((moduleId) => [
      moduleId,
      toSerializableModuleCheck(probeXyzwRuntimeModule(candidateWindow, moduleId)),
    ]),
  );
  const hasRequire = typeof candidateWindow?.__require === "function";
  const sceneName = candidateWindow?.cc?.director?.getScene?.()?.name
    ?? (state?.runSceneCalls || []).filter((entry) => entry?.sceneName).at(-1)?.sceneName
    ?? null;
  const loadBundleCalls = (state?.loadBundleCalls || []).map(cloneEntry);
  const tryLoadAssetCalls = (state?.tryLoadAssetCalls || []).map(cloneEntry);
  const runSceneCalls = (state?.runSceneCalls || []).map(cloneEntry);
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
  const battleModulesReady = gameSceneRunning
    && canonicalModuleChecks.BattleUIManager?.status === "present";

  return {
    details: {
      battleModulesReady,
      canonicalModuleChecks,
      gameBundleLoaded,
      gameBundleRequested,
      gameSceneAssetLoaded,
      gameSceneRunning,
      gameScriptInDocument: scriptUrls.some(isGameScriptUrl),
      gameScriptInPerformance: performanceUrls.some(isGameScriptUrl),
      hasRequire,
      loadBundleCalls,
      loadEvidence: {
        bundleEvents: (state?.bundleEvents || []).map(cloneEntry),
        scriptEvents: (state?.scriptEvents || []).map(cloneEntry),
      },
      mainScriptInDocument: scriptUrls.some(isMainScriptUrl),
      mainScriptInPerformance: performanceUrls.some(isMainScriptUrl),
      moduleChecks: canonicalModuleChecks,
      runSceneCalls,
      sceneName,
      tryLoadAssetCalls,
      windowLabel,
    },
    layer: deriveRuntimeStage({
      battleModulesReady,
      gameBundleLoaded,
      gameBundleRequested,
      gameSceneAssetLoaded,
      gameSceneRunning,
      hasRequire,
    }),
    windowLabel,
  };
};

export const detectXyzwRuntimeLayer = (gameWindow, { windowLabel = "window" } = {}) => {
  if (!gameWindow) {
    return {
      layer: "no-window",
      details: {
        battleModulesReady: false,
        canonicalModuleChecks: Object.fromEntries(
          XYZW_CANONICAL_REPLAY_MODULE_IDS.map((moduleId) => [
            moduleId,
            {
              error: null,
              missing: false,
              ok: false,
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
        loadBundleCalls: [],
        loadEvidence: {
          bundleEvents: [],
          scriptEvents: [],
        },
        mainScriptInDocument: false,
        mainScriptInPerformance: false,
        moduleChecks: Object.fromEntries(
          XYZW_CANONICAL_REPLAY_MODULE_IDS.map((moduleId) => [
            moduleId,
            {
              error: null,
              missing: false,
              ok: false,
              status: "no-window",
            },
          ]),
        ),
        runSceneCalls: [],
        sceneName: null,
        tryLoadAssetCalls: [],
        windowLabel,
      },
    };
  }

  const inspection = inspectSingleWindowBundleState(gameWindow, windowLabel);
  return {
    layer: inspection.layer,
    details: inspection.details,
  };
};

export const inspectBundleState = (rootWindow = null) => {
  const windows = [];

  if (!rootWindow) {
    return {
      currentWindow: null,
      currentWindowLabel: null,
      windows: [],
    };
  }

  windows.push(inspectSingleWindowBundleState(rootWindow, "window"));
  const iframes = Array.from(rootWindow?.document?.querySelectorAll?.("iframe") || []);
  for (let index = 0; index < iframes.length; index += 1) {
    try {
      windows.push(
        inspectSingleWindowBundleState(iframes[index]?.contentWindow || null, `iframe[${index}]`),
      );
    } catch {
      windows.push(
        detectXyzwRuntimeLayer(null, { windowLabel: `iframe[${index}]` }),
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
    loadBundleCalls: windows[0]?.details?.loadBundleCalls || [],
    moduleChecks: windows[0]?.details?.canonicalModuleChecks || {},
    runSceneCalls: windows[0]?.details?.runSceneCalls || [],
    sceneName: windows[0]?.details?.sceneName ?? null,
    tryLoadAssetCalls: windows[0]?.details?.tryLoadAssetCalls || [],
    windows,
  };
};

const buildBattleModulesReadySource = (details) => {
  if (!details) {
    return null;
  }
  if (details.battleModulesReady) {
    return "BattleUIManager";
  }
  if (details.gameSceneRunning) {
    return "runScene(Game)";
  }
  if (details.gameSceneAssetLoaded) {
    return "TRY_LOAD_ASSET(game, scenes/Game)";
  }
  if (details.gameBundleLoaded) {
    return "loadBundle(game)";
  }
  if (details.gameBundleRequested) {
    return "loadBundle(game):requested";
  }
  if (details.hasRequire) {
    return "launcher-ready";
  }
  return null;
};

const waitForSignal = async (runtimeWindow, intervalMs) => {
  await new Promise((resolve) => runtimeWindow.setTimeout(resolve, intervalMs));
};

export const waitForBattleModulesReady = async ({
  gameWindow,
  runtimeWindow = gameWindow,
  timeoutMs = 15000,
  intervalMs = 50,
  windowLabel = "window",
} = {}) => {
  const initial = detectXyzwRuntimeLayer(gameWindow, { windowLabel });
  if (
    initial.layer === "battle-modules-ready"
    || initial.layer === "no-window"
    || initial.layer === "no-require"
  ) {
    return {
      attempts: 0,
      details: initial.details,
      error: initial.layer === "battle-modules-ready"
        ? null
        : initial.details?.canonicalModuleChecks?.BattleUIManager?.error || null,
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

    latest = detectXyzwRuntimeLayer(gameWindow, { windowLabel });
    if (latest.layer === "battle-modules-ready") {
      return {
        attempts,
        details: latest.details,
        error: null,
        gameBundleReadySource: buildBattleModulesReadySource(latest.details),
        layer: latest.layer,
        ok: true,
        status: latest.layer,
      };
    }
  }

  return {
    attempts,
    details: latest.details,
    error: latest.details?.canonicalModuleChecks?.BattleUIManager?.error || null,
    gameBundleReadySource: buildBattleModulesReadySource(latest.details),
    layer: latest.layer,
    ok: false,
    status: latest.layer,
  };
};

export const ensureXyzwGameBundleReady = (options = {}) =>
  waitForBattleModulesReady(options);
