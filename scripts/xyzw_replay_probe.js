function findGameWindow(root = window) {
  if (root && typeof root.__require === "function")
    return { gameWindow: root, label: "window" };
  const iframes = Array.from(document.querySelectorAll("iframe"));
  for (let index = 0; index < iframes.length; index += 1) {
    try {
      const w = iframes[index].contentWindow;
      if (w && typeof w.__require === "function") {
        return { gameWindow: w, label: `iframe[${index}]` };
      }
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
  const req = gameWindow.__require;
  if (typeof req !== "function")
    throw new Error("gameWindow.__require is not a function");

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

function isGameScriptUrl(value) {
  return ["/assets/game/index.js", "/xyzw/game.js", "/game.js"].some((pattern) =>
    String(value || "").includes(pattern) || String(value || "").endsWith(pattern),
  );
}

function probeModule(gameWindow, moduleId) {
  if (!gameWindow) {
    return { status: "no-window", error: null, value: null };
  }
  if (typeof gameWindow.__require !== "function") {
    return { status: "no-require", error: null, value: null };
  }
  try {
    return { status: "present", error: null, value: gameWindow.__require(moduleId) };
  } catch (error) {
    const errorText = error?.message || String(error);
    return {
      status: isMissingModuleError(errorText) ? "module-missing" : "require-threw",
      error: errorText,
      value: null,
    };
  }
}

function inspectSingleWindow(candidateWindow, label) {
  const scriptUrls = Array.from(candidateWindow?.document?.scripts || []).map((entry) => entry?.src).filter(Boolean);
  const performanceUrls = Array.from(
    candidateWindow?.performance?.getEntriesByType?.("resource") || [],
  ).map((entry) => entry?.name).filter(Boolean);
  const moduleChecks = {
    BattleUIManager: probeModule(candidateWindow, "BattleUIManager"),
    "enter-oss": probeModule(candidateWindow, "enter-oss"),
    BattleKitCrossSite: probeModule(candidateWindow, "BattleKitCrossSite"),
  };
  const hasRequire = typeof candidateWindow?.__require === "function";
  const gameScriptInDocument = scriptUrls.some(isGameScriptUrl);
  const gameScriptInPerformance = performanceUrls.some(isGameScriptUrl);
  let layer = "launcher-only";
  if (!candidateWindow) {
    layer = "no-window";
  } else if (!hasRequire) {
    layer = "no-require";
  } else if (Object.values(moduleChecks).some((entry) => entry.status === "present")) {
    layer = "game-bundle-ready";
  } else if (gameScriptInDocument || gameScriptInPerformance) {
    layer = "game-bundle-loading";
  }
  return {
    layer,
    details: {
      windowLabel: label,
      hasRequire,
      gameScriptInDocument,
      gameScriptInPerformance,
      moduleChecks,
    },
    windowLabel: label,
  };
}

function inspectBundleState(root = window) {
  const windows = [];
  windows.push(inspectSingleWindow(root, "window"));
  const iframes = Array.from(root?.document?.querySelectorAll?.("iframe") || []);
  for (let index = 0; index < iframes.length; index += 1) {
    try {
      windows.push(inspectSingleWindow(iframes[index].contentWindow, `iframe[${index}]`));
    } catch (_) {
      windows.push(inspectSingleWindow(null, `iframe[${index}]`));
    }
  }
  return {
    currentWindow: windows[0] || null,
    currentWindowLabel: windows[0]?.windowLabel || null,
    windows,
  };
}

function detectRuntimeLayer(gameWindow, label = "window") {
  return inspectSingleWindow(gameWindow, label);
}

async function waitForGameBundleReady(gameWindow, label = "window", {
  timeoutMs = 3000,
  intervalMs = 50,
} = {}) {
  const startedAt = Date.now();
  let attempts = 0;
  let current = detectRuntimeLayer(gameWindow, label);
  while (Date.now() - startedAt < timeoutMs) {
    if (current.layer === "game-bundle-ready" || current.layer === "no-window" || current.layer === "no-require") {
      return {
        ok: current.layer === "game-bundle-ready",
        layer: current.layer,
        status: current.layer,
        attempts,
        details: current.details,
      };
    }
    attempts += 1;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    current = detectRuntimeLayer(gameWindow, label);
  }
  return {
    ok: current.layer === "game-bundle-ready",
    layer: current.layer,
    status: current.layer,
    attempts,
    details: current.details,
  };
}

(function attachReplayProbe() {
  const { gameWindow, label } = findGameWindow(window);
  if (!gameWindow) {
    console.error("[xyzw replay] No game window with __require found");
    return;
  }

  const req = gameWindow.__require;
  const runtimeLayerInfo = detectRuntimeLayer(gameWindow, label || "window");

  function inspect() {
    const replayData = getReplaySource(gameWindow);
    let battleUIManager;
    let enterOSS;
    let crossSite;
    try { battleUIManager = req("BattleUIManager"); } catch (e) { battleUIManager = { __error: String(e) }; }
    try { enterOSS = req("enter-oss"); } catch (e) { enterOSS = { __error: String(e) }; }
    try { crossSite = req("BattleKitCrossSite"); } catch (e) { crossSite = { __error: String(e) }; }

    const info = {
      ...inspectBundleState(window),
      runtimeLayer: detectRuntimeLayer(gameWindow, label || "window").layer,
      hasGameWindow: !!gameWindow,
      hasRequire: typeof req === "function",
      BattleUIManagerKeys: Object.keys(battleUIManager || {}),
      EnterOSSKeys: Object.keys(enterOSS || {}),
      BattleKitCrossSiteKeys: Object.keys(crossSite || {}),
      showReplayType: typeof battleUIManager?.SHOW_BATTLE_REPLAY_UI,
      enterOSSCtorType: typeof enterOSS?.EnterOSSState,
      enterOSSGetBattleDataByOSSType: typeof enterOSS?.EnterOSSState?.prototype?.getBattleDataByOSS,
      enterOSSCreateBattleInputDataType: typeof enterOSS?.EnterOSSState?.prototype?.createBattleInputData,
      crossSiteTryRaisePlaybackType: typeof crossSite?.BattleKitCrossSite?.instance?.tryRaisePlayback,
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
      try {
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
      } catch (e) {
        console.warn("[xyzw replay] post-check failed", e);
      }
    }, 1200);
  }

  const baseHelper = {
    detectRuntimeLayer() {
      const result = detectRuntimeLayer(gameWindow, label || "window");
      console.log("[xyzw replay] detectRuntimeLayer", result);
      return result;
    },
    inspectBundleState() {
      const result = inspectBundleState(window);
      console.log("[xyzw replay] inspectBundleState", result);
      return result;
    },
    waitForGameBundleReady(options = {}) {
      return waitForGameBundleReady(gameWindow, label || "window", options);
    },
  };

  const fullHelper = {
    ...baseHelper,
    req,
    inspect,
    showReplay(inputDataOrRaw = getReplaySource(gameWindow), options = {}) {
      const prepared = ensureReplayInputData(inputDataOrRaw, gameWindow, options);
      console.log("[xyzw replay] dispatch showReplay", {
        mapId: prepared?.mapId,
        mode: prepared?.battleData?.mode,
      });
      const ret = req("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared, options);
      postCheck(prepared);
      return ret;
    },
    showReplayDirect(rawOrWrappedBattleData = getReplaySource(gameWindow), options = {}) {
      const prepared = ensureReplayInputData(rawOrWrappedBattleData, gameWindow, options);
      console.log("[xyzw replay] dispatch showReplayDirect", {
        mapId: prepared?.mapId,
        mode: prepared?.battleData?.mode,
      });
      const ret = req("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared, options);
      postCheck(prepared);
      return ret;
    },
    showReplayViaEnterOSS(rawOrWrappedBattleData = getReplaySource(gameWindow)) {
      const { EnterOSSState } = req("enter-oss");
      return new EnterOSSState().showBattleViewWithData(rawOrWrappedBattleData);
    },
    tryCrossSitePlayback(force = true) {
      const ret = req("BattleKitCrossSite").BattleKitCrossSite.instance.tryRaisePlayback(force);
      console.log("[xyzw replay] tryCrossSitePlayback", { force, ret });
      return ret;
    },
  };

  gameWindow.__xyzwReplay = runtimeLayerInfo.layer === "game-bundle-ready" ? fullHelper : baseHelper;
  window.__xyzwReplay = gameWindow.__xyzwReplay;
  if (window !== gameWindow)
    window.__xyzwReplayGameWindow = gameWindow;

  console.log("[xyzw replay] helpers attached at gameWindow.__xyzwReplay", {
    runtimeLayer: runtimeLayerInfo.layer,
  });
})();
