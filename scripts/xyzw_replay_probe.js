function findGameWindow(root = window) {
  if (root && typeof root.__require === "function")
    return { gameWindow: root, label: "window" };
  const iframes = Array.from(document.querySelectorAll("iframe"));
  for (let index = 0; index < iframes.length; index += 1) {
    try {
      const w = iframes[index].contentWindow;
      if (w && typeof w.__require === "function")
        return { gameWindow: w, label: `iframe[${index}]` };
    } catch (_) {}
  }
  return { gameWindow: null, label: null };
}

function getReplaySource(gameWindow) {
  return (
    gameWindow?.__REPLAY_DATA__
    ?? window.__REPLAY_DATA__
    ?? gameWindow?.__xyzwReplayData
    ?? window.__xyzwReplayData
  );
}

function getLiveRequire(gameWindow) {
  const req = gameWindow?.__require;
  if (typeof req !== "function")
    throw new Error("live window.__require is not available");
  return req;
}

function looksLikeBattleInput(source) {
  return !!source?.battleData
    && typeof source?.mapId !== "undefined"
    && (
      typeof source?.battleData?.leftTeam?.team?.get === "function"
      || typeof source?.battleData?.leftTeam?.team?.forEach === "function"
    )
    && (
      typeof source?.battleData?.rightTeam?.team?.get === "function"
      || typeof source?.battleData?.rightTeam?.team?.forEach === "function"
    );
}

function ensureReplayInputData(source, gameWindow, options = {}) {
  if (!gameWindow)
    throw new Error("No game window with __require found");
  const req = getLiveRequire(gameWindow);

  if (looksLikeBattleInput(source)) {
    const prepared = source;
    prepared.battleResult ??= prepared.battleData?.result;
    prepared.mapId ??= 10001;
    if (options && Object.keys(options).length) {
      if (!prepared.options) {
        prepared.options = options;
      } else if (Object.prototype.toString.call(prepared.options) === "[object Object]") {
        Object.assign(prepared.options, options);
      } else {
        prepared.__replayProbeOptions = options;
      }
    }
    return prepared;
  }

  const { EnterOSSState } = req("enter-oss");
  const oss = new EnterOSSState();
  const battleData = oss.getBattleDataByOSS(source);
  if (!battleData) {
    throw new Error(
      "getBattleDataByOSS returned null: expected raw battleData / {battleData} / {fightRoleBase,lastBattleData}",
    );
  }

  const inputData = oss.createBattleInputData(battleData, battleData.result);
  for (const key of [
    "mapId",
    "battleResult",
    "stageNameStr",
    "startTipTopName",
    "startTipStage",
    "topName",
    "showRightPower",
    "hideLeftSkinName",
    "hideRightSkinName",
    "clientRoleNum",
    "isReplay",
    "options",
  ]) {
    if (source && source[key] != null)
      inputData[key] = source[key];
  }
  inputData.mapId ??= 10001;
  inputData.battleResult ??= inputData.battleData?.result;
  if (options && Object.keys(options).length) {
    if (!inputData.options) {
      inputData.options = options;
    } else if (Object.prototype.toString.call(inputData.options) === "[object Object]") {
      Object.assign(inputData.options, options);
    } else {
      inputData.__replayProbeOptions = options;
    }
  }
  return inputData;
}

function isMissingModuleError(message) {
  return /cannot find module|module not found|cannot find/i.test(String(message || ""));
}

function probeModule(gameWindow, moduleId) {
  if (!gameWindow) {
    return { error: null, missing: false, ok: false, status: "no-window" };
  }
  if (typeof gameWindow.__require !== "function") {
    return { error: null, missing: false, ok: false, status: "no-require" };
  }
  try {
    gameWindow.__require(moduleId);
    return { error: null, missing: false, ok: true, status: "present" };
  } catch (error) {
    const errorText = error?.message || String(error);
    return {
      error: errorText,
      missing: isMissingModuleError(errorText),
      ok: false,
      status: isMissingModuleError(errorText) ? "module-missing" : "require-threw",
    };
  }
}

function inspectSingleWindow(candidateWindow, label) {
  const state = candidateWindow?.__xyzwReplayRuntimeLayerState || {};
  if (state && typeof state.launcherRequireRef !== "function" && typeof candidateWindow?.__require === "function") {
    state.launcherRequireRef = candidateWindow.__require;
  }
  const launcherRequireRef = state?.launcherRequireRef || null;
  const currentRequire = typeof candidateWindow?.__require === "function"
    ? candidateWindow.__require
    : null;
  const canonicalModuleChecks = {
    BattleUIManager: probeModule(candidateWindow, "BattleUIManager"),
    "enter-oss": probeModule(candidateWindow, "enter-oss"),
    BattleKitCrossSite: probeModule(candidateWindow, "BattleKitCrossSite"),
  };
  const sceneName = candidateWindow?.cc?.director?.getScene?.()?.name
    ?? state?.runSceneCalls?.at?.(-1)?.sceneName
    ?? null;
  const gameBundleRequested = !!state?.loadBundleCalls?.some((entry) =>
    entry.bundleName === "game" && entry.phase === "requested",
  );
  const gameBundleLoaded = !!state?.loadBundleCalls?.some((entry) =>
    entry.bundleName === "game" && entry.resolved && entry.ok === true,
  );
  const gameSceneAssetLoaded = !!state?.tryLoadAssetCalls?.some((entry) =>
    entry.bundleName === "game" && entry.path === "scenes/Game" && entry.resolved && entry.ok === true,
  );
  const gameSceneRunning = sceneName === "Game"
    || !!state?.runSceneCalls?.some((entry) => entry.sceneName === "Game");
  const battleModulesReady = gameSceneRunning && canonicalModuleChecks.BattleUIManager.ok;
  const sameRequireRef = launcherRequireRef && currentRequire
    ? launcherRequireRef === currentRequire
    : null;
  const hasRequireSwap = launcherRequireRef && currentRequire
    ? launcherRequireRef !== currentRequire
    : false;
  const requireFunctionName = currentRequire?.name || null;
  const launcherRequireFunctionName = launcherRequireRef?.name || null;
  let runtimeStage = "launcher-ready";
  if (!candidateWindow) {
    runtimeStage = "no-window";
  } else if (typeof candidateWindow.__require !== "function") {
    runtimeStage = "no-require";
  } else if (battleModulesReady) {
    runtimeStage = "battle-modules-ready";
  } else if (gameSceneRunning) {
    runtimeStage = "game-scene-running";
  } else if (gameSceneAssetLoaded) {
    runtimeStage = "game-scene-asset-loaded";
  } else if (gameBundleLoaded) {
    runtimeStage = "game-bundle-loaded";
  } else if (gameBundleRequested) {
    runtimeStage = "game-bundle-requested";
  } else if (hasRequireSwap) {
    runtimeStage = "require-swapped";
  }

  return {
    battleModulesReady,
    canonicalModuleChecks,
    currentWindowLabel: label,
    gameBundleLoaded,
    gameBundleRequested,
    gameSceneAssetLoaded,
    gameSceneRunning,
    hasRequire: typeof candidateWindow?.__require === "function",
    hasRequireSwap,
    launcherRequireFunctionName,
    loadBundleCalls: state?.loadBundleCalls || [],
    runSceneCalls: state?.runSceneCalls || [],
    requireFunctionName,
    runtimeStage,
    sceneName,
    sameRequireRef,
    tryLoadAssetCalls: state?.tryLoadAssetCalls || [],
  };
}

function inspectBundleState(root = window) {
  const currentWindow = inspectSingleWindow(root, "window");
  const windows = [currentWindow];
  const iframes = Array.from(root?.document?.querySelectorAll?.("iframe") || []);
  for (let index = 0; index < iframes.length; index += 1) {
    try {
      windows.push(inspectSingleWindow(iframes[index].contentWindow, `iframe[${index}]`));
    } catch (_) {
      windows.push(inspectSingleWindow(null, `iframe[${index}]`));
    }
  }
  return {
    ...currentWindow,
    currentWindow,
    windows,
  };
}

async function waitForBattleModulesReady(gameWindow, {
  timeoutMs = 15000,
  intervalMs = 50,
} = {}) {
  const startedAt = Date.now();
  let snapshot = inspectSingleWindow(gameWindow, "window");
  let attempts = 0;
  while (Date.now() - startedAt < timeoutMs) {
    if (
      snapshot.runtimeStage === "battle-modules-ready"
      || snapshot.runtimeStage === "no-window"
      || snapshot.runtimeStage === "no-require"
    ) {
      return {
        attempts,
        details: snapshot,
        layer: snapshot.runtimeStage,
        ok: snapshot.runtimeStage === "battle-modules-ready",
        status: snapshot.runtimeStage,
      };
    }
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    snapshot = inspectSingleWindow(gameWindow, "window");
  }
  return {
    attempts,
    details: snapshot,
    layer: snapshot.runtimeStage,
    ok: false,
    status: snapshot.runtimeStage,
  };
}

(function attachReplayProbe() {
  const { gameWindow, label } = findGameWindow(window);
  if (!gameWindow) {
    console.error("[xyzw replay] No game window with __require found");
    return;
  }

  const state = gameWindow.__xyzwReplayRuntimeLayerState || (gameWindow.__xyzwReplayRuntimeLayerState = {});
  if (typeof state.launcherRequireRef !== "function" && typeof gameWindow.__require === "function") {
    state.launcherRequireRef = gameWindow.__require;
  }
  const stageInfo = inspectSingleWindow(gameWindow, label || "window");

  function inspect() {
    const replayData = getReplaySource(gameWindow);
    const info = {
      ...inspectBundleState(window),
      BattleUIManagerKeys: Object.keys((() => {
        try { return getLiveRequire(gameWindow)("BattleUIManager"); } catch { return {}; }
      })()),
      EnterOSSKeys: Object.keys((() => {
        try { return getLiveRequire(gameWindow)("enter-oss"); } catch { return {}; }
      })()),
      BattleKitCrossSiteKeys: Object.keys((() => {
        try { return getLiveRequire(gameWindow)("BattleKitCrossSite"); } catch { return {}; }
      })()),
    };
    if (replayData) {
      info.replayData = {
        isWrapped: !!(replayData?.battleData || replayData?.lastBattleData),
        isBattleInputLike: looksLikeBattleInput(replayData),
        mapId: replayData?.mapId,
        leftTeamGetType: typeof replayData?.battleData?.leftTeam?.team?.get,
        leftTeamForEachType: typeof replayData?.battleData?.leftTeam?.team?.forEach,
        rightTeamGetType: typeof replayData?.battleData?.rightTeam?.team?.get,
        rightTeamForEachType: typeof replayData?.battleData?.rightTeam?.team?.forEach,
      };
    }
    console.log("[xyzw replay] inspect", info);
    return info;
  }

  function postCheck(prepared) {
    setTimeout(() => {
      console.log("[xyzw replay] post-check", {
        scene: gameWindow.cc?.director?.getScene?.()?.name,
        canvas: !!gameWindow.cc?.game?.canvas,
        mapId: prepared?.mapId,
        mode: prepared?.battleData?.mode,
        leftTeamGetType: typeof prepared?.battleData?.leftTeam?.team?.get,
        rightTeamGetType: typeof prepared?.battleData?.rightTeam?.team?.get,
        leftTeamForEachType: typeof prepared?.battleData?.leftTeam?.team?.forEach,
        rightTeamForEachType: typeof prepared?.battleData?.rightTeam?.team?.forEach,
      });
    }, 1200);
  }

  const earlyHelper = {
    inspectBundleState() {
      const result = inspectBundleState(window);
      console.log("[xyzw replay] inspectBundleState", result);
      return result;
    },
    waitForBattleModulesReady(options = {}) {
      return waitForBattleModulesReady(gameWindow, options);
    },
  };

  const fullHelper = {
    ...earlyHelper,
    inspect,
    showReplay(inputDataOrRaw = getReplaySource(gameWindow), options = {}) {
      const prepared = ensureReplayInputData(inputDataOrRaw, gameWindow, options);
      const ret = getLiveRequire(gameWindow)("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared, options);
      postCheck(prepared);
      return ret;
    },
    showReplayDirect(rawOrWrappedBattleData = getReplaySource(gameWindow), options = {}) {
      const prepared = ensureReplayInputData(rawOrWrappedBattleData, gameWindow, options);
      const ret = getLiveRequire(gameWindow)("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared, options);
      postCheck(prepared);
      return ret;
    },
    showReplayViaEnterOSS(rawOrWrappedBattleData = getReplaySource(gameWindow)) {
      const { EnterOSSState } = getLiveRequire(gameWindow)("enter-oss");
      return new EnterOSSState().showBattleViewWithData(rawOrWrappedBattleData);
    },
    tryCrossSitePlayback(force = true) {
      return getLiveRequire(gameWindow)("BattleKitCrossSite").BattleKitCrossSite.instance.tryRaisePlayback(force);
    },
  };

  gameWindow.__xyzwReplay = stageInfo.runtimeStage === "battle-modules-ready"
    ? fullHelper
    : earlyHelper;
  Object.defineProperty(gameWindow.__xyzwReplay, "req", {
    enumerable: true,
    get() {
      return getLiveRequire(gameWindow);
    },
  });
  window.__xyzwReplay = gameWindow.__xyzwReplay;
  if (window !== gameWindow)
    window.__xyzwReplayGameWindow = gameWindow;

  console.log("[xyzw replay] helpers attached at gameWindow.__xyzwReplay", {
    runtimeStage: stageInfo.runtimeStage,
  });
})();
