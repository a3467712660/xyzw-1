const XYZW_RUNTIME_LAYER_STATE_KEY = "__xyzwReplayRuntimeLayerState";
const XYZW_RUNTIME_LAYER_EVENT_LIMIT = 40;
const XYZW_GAME_BUNDLE_NAME = "game";
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

const isObjectLike = (value) => value && (typeof value === "object" || typeof value === "function");

const matchesScriptPattern = (value, patterns) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return false;
  }
  return patterns.some((pattern) =>
    normalized.includes(pattern) || normalized.endsWith(pattern),
  );
};

const isGameScriptUrl = (value) => matchesScriptPattern(value, XYZW_GAME_SCRIPT_PATTERNS);

const isMainScriptUrl = (value) => matchesScriptPattern(value, XYZW_MAIN_SCRIPT_PATTERNS);

const trimRuntimeLayerEvents = (entries = []) => {
  if (entries.length <= XYZW_RUNTIME_LAYER_EVENT_LIMIT) {
    return entries;
  }
  entries.splice(0, entries.length - XYZW_RUNTIME_LAYER_EVENT_LIMIT);
  return entries;
};

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
    pendingBundlePromises: new Map(),
    scriptEvents: [],
    pendingScriptPromises: new WeakMap(),
  };
  Object.defineProperty(runtimeWindow, XYZW_RUNTIME_LAYER_STATE_KEY, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: state,
  });
  return state;
};

const snapshotLayerEvent = (entry) => ({
  at: entry?.at || null,
  bundleName: entry?.bundleName || null,
  detail: entry?.detail || null,
  error: entry?.error || null,
  source: entry?.source || null,
  src: entry?.src || null,
  status: entry?.status || null,
  target: entry?.target || null,
});

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
  const entry = {
    at: Date.now(),
    detail,
    error: error ? toErrorMessage(error) : null,
    source,
    src: String(src || ""),
    status: status || "observed",
  };
  state.scriptEvents.push(entry);
  trimRuntimeLayerEvents(state.scriptEvents);
  return entry;
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
  const entry = {
    at: Date.now(),
    bundleName: String(bundleName || ""),
    detail,
    error: error ? toErrorMessage(error) : null,
    source,
    status: status || "observed",
    target: target == null ? null : String(target),
  };
  state.bundleEvents.push(entry);
  trimRuntimeLayerEvents(state.bundleEvents);
  return entry;
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

const getPendingGameBundlePromises = (runtimeWindow) => {
  const state = getOrCreateXyzwRuntimeLayerState(runtimeWindow);
  if (!state) {
    return [];
  }
  return [...state.pendingBundlePromises.values()]
    .filter((entry) =>
      entry.bundleName === XYZW_GAME_BUNDLE_NAME
      || isGameScriptUrl(entry.target)
      || entry.target === XYZW_GAME_BUNDLE_NAME,
    )
    .map((entry) => entry.promise);
};

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

const getPendingGameScriptLoadPromises = (candidateWindow) => {
  const state = getOrCreateXyzwRuntimeLayerState(candidateWindow);
  if (!state) {
    return [];
  }

  const pending = [];
  for (const scriptElement of Array.from(candidateWindow?.document?.scripts || [])) {
    if (!isGameScriptUrl(scriptElement?.src)) {
      continue;
    }
    if (scriptElement.dataset?.loaded === "true" || scriptElement.readyState === "complete") {
      continue;
    }
    if (!state.pendingScriptPromises.has(scriptElement)) {
      const promise = new Promise((resolve) => {
        const finalize = (status, error = null) => {
          recordXyzwRuntimeScriptEvent({
            runtimeWindow: candidateWindow,
            src: scriptElement?.src || "",
            status,
            source: "document-script",
            error,
          });
          resolve();
        };
        scriptElement.addEventListener("load", () => finalize("loaded"), { once: true });
        scriptElement.addEventListener("error", (event) => finalize("error", event?.error || null), { once: true });
      });
      state.pendingScriptPromises.set(scriptElement, promise);
    }
    pending.push(state.pendingScriptPromises.get(scriptElement));
  }
  return pending;
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

const inspectSingleWindowBundleState = (candidateWindow, windowLabel = "window") => {
  const state = getOrCreateXyzwRuntimeLayerState(candidateWindow);
  const scriptUrls = getWindowScriptUrls(candidateWindow);
  const performanceUrls = getWindowPerformanceResourceUrls(candidateWindow);
  const moduleChecks = Object.fromEntries(
    XYZW_CANONICAL_REPLAY_MODULE_IDS.map((moduleId) => [
      moduleId,
      (() => {
        const result = probeXyzwRuntimeModule(candidateWindow, moduleId);
        return {
          error: result.error,
          missing: result.missing,
          ok: result.ok,
          status: result.status,
        };
      })(),
    ]),
  );
  const hasRequire = typeof candidateWindow?.__require === "function";
  const gameScriptInDocument = scriptUrls.some(isGameScriptUrl);
  const gameScriptInPerformance = performanceUrls.some(isGameScriptUrl);
  const mainScriptInDocument = scriptUrls.some(isMainScriptUrl);
  const mainScriptInPerformance = performanceUrls.some(isMainScriptUrl);
  const loadEvidence = {
    bundleEvents: (state?.bundleEvents || []).map(snapshotLayerEvent),
    scriptEvents: (state?.scriptEvents || []).map(snapshotLayerEvent),
  };
  const moduleStatuses = Object.values(moduleChecks).map((entry) => entry.status);
  const anyModulePresent = moduleStatuses.includes("present");
  const gameBundleObserved = Boolean(
    gameScriptInDocument
    || gameScriptInPerformance
    || loadEvidence.bundleEvents.some((entry) =>
      entry.bundleName === XYZW_GAME_BUNDLE_NAME
      || isGameScriptUrl(entry.target),
    )
    || loadEvidence.scriptEvents.some((entry) => isGameScriptUrl(entry.src)),
  );

  let layer = "launcher-only";
  if (!candidateWindow) {
    layer = "no-window";
  } else if (!hasRequire) {
    layer = "no-require";
  } else if (anyModulePresent) {
    layer = "game-bundle-ready";
  } else if (gameBundleObserved) {
    layer = "game-bundle-loading";
  } else {
    layer = "launcher-only";
  }

  return {
    details: {
      loadEvidence,
      gameScriptInDocument,
      gameScriptInPerformance,
      hasRequire,
      mainScriptInDocument,
      mainScriptInPerformance,
      moduleChecks,
      windowLabel,
    },
    layer,
    windowLabel,
  };
};

export const detectXyzwRuntimeLayer = (gameWindow, { windowLabel = "window" } = {}) => {
  if (!gameWindow) {
    return {
      layer: "no-window",
      details: {
        loadEvidence: {
          bundleEvents: [],
          scriptEvents: [],
        },
        gameScriptInDocument: false,
        gameScriptInPerformance: false,
        hasRequire: false,
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

  windows.push({
    ...inspectSingleWindowBundleState(rootWindow, "window"),
  });

  const iframes = Array.from(rootWindow?.document?.querySelectorAll?.("iframe") || []);
  for (let index = 0; index < iframes.length; index += 1) {
    try {
      const iframeWindow = iframes[index]?.contentWindow || null;
      windows.push({
        ...inspectSingleWindowBundleState(iframeWindow, `iframe[${index}]`),
      });
    } catch {
      windows.push({
        details: {
          loadEvidence: {
            bundleEvents: [],
            scriptEvents: [],
          },
          gameScriptInDocument: false,
          gameScriptInPerformance: false,
          hasRequire: false,
          mainScriptInDocument: false,
          mainScriptInPerformance: false,
          moduleChecks: {},
          windowLabel: `iframe[${index}]`,
        },
        layer: "no-window",
        windowLabel: `iframe[${index}]`,
      });
    }
  }

  return {
    currentWindow: windows[0] || null,
    currentWindowLabel: windows[0]?.windowLabel || null,
    windows,
  };
};

const buildGameBundleReadySource = (details) => {
  if (!details) {
    return null;
  }
  let resolvedBundleEvent = null;
  const bundleEvents = details.loadEvidence?.bundleEvents || [];
  for (let index = bundleEvents.length - 1; index >= 0; index -= 1) {
    const entry = bundleEvents[index];
    if (
      entry?.status === "resolved"
      && (
        entry.bundleName === XYZW_GAME_BUNDLE_NAME
        || isGameScriptUrl(entry.target)
      )
    ) {
      resolvedBundleEvent = entry;
      break;
    }
  }
  if (resolvedBundleEvent) {
    return resolvedBundleEvent.source || "bundle-event";
  }
  if (details.gameScriptInDocument) {
    return "document.scripts";
  }
  if (details.gameScriptInPerformance) {
    return "performance.resource";
  }
  if (Object.values(details.moduleChecks || {}).some((entry) => entry?.status === "present")) {
    return "module-require";
  }
  return null;
};

const waitForSignal = async (runtimeWindow, intervalMs) => {
  await new Promise((resolve) => runtimeWindow.setTimeout(resolve, intervalMs));
};

export const ensureXyzwGameBundleReady = async ({
  gameWindow,
  runtimeWindow = gameWindow,
  timeoutMs = 3000,
  intervalMs = 50,
  windowLabel = "window",
} = {}) => {
  const initial = detectXyzwRuntimeLayer(gameWindow, { windowLabel });
  if (
    initial.layer === "game-bundle-ready"
    || initial.layer === "no-window"
    || initial.layer === "no-require"
  ) {
    return {
      attempts: 0,
      details: initial.details,
      error: initial.layer === "game-bundle-ready" ? null : initial.details?.moduleChecks?.BattleUIManager?.error || null,
      gameBundleReadySource: buildGameBundleReadySource(initial.details),
      layer: initial.layer,
      ok: initial.layer === "game-bundle-ready",
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
      ...getPendingGameScriptLoadPromises(gameWindow),
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
    if (latest.layer === "game-bundle-ready") {
      return {
        attempts,
        details: latest.details,
        error: null,
        gameBundleReadySource: buildGameBundleReadySource(latest.details),
        layer: latest.layer,
        ok: true,
        status: latest.layer,
      };
    }
  }

  return {
    attempts,
    details: latest.details,
    error: latest.details?.moduleChecks?.BattleUIManager?.error || null,
    gameBundleReadySource: buildGameBundleReadySource(latest.details),
    layer: latest.layer,
    ok: latest.layer === "game-bundle-ready",
    status: latest.layer,
  };
};
