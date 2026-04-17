function findGameWindow(root = window) {
  if (root && typeof root.__require === "function")
    return root;
  const iframes = Array.from(document.querySelectorAll("iframe"));
  for (const iframe of iframes) {
    try {
      const w = iframe.contentWindow;
      if (w && typeof w.__require === "function")
        return w;
    } catch (_) {}
  }
  return null;
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

  const passthroughKeys = [
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
  ];

  for (const key of passthroughKeys) {
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

(function attachReplayProbe() {
  const gameWindow = findGameWindow(window);
  if (!gameWindow) {
    console.error("[xyzw replay] No game window with __require found");
    return;
  }

  const req = gameWindow.__require;

  function inspect() {
    const replayData = getReplaySource(gameWindow);

    let battleUIManager;
    let enterOSS;
    let crossSite;
    try { battleUIManager = req("BattleUIManager"); } catch (e) { battleUIManager = { __error: String(e) }; }
    try { enterOSS = req("enter-oss"); } catch (e) { enterOSS = { __error: String(e) }; }
    try { crossSite = req("BattleKitCrossSite"); } catch (e) { crossSite = { __error: String(e) }; }

    const info = {
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

  gameWindow.__xyzwReplay = {
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

  window.__xyzwReplay = gameWindow.__xyzwReplay;
  if (window !== gameWindow)
    window.__xyzwReplayGameWindow = gameWindow;

  console.log("[xyzw replay] helpers attached at gameWindow.__xyzwReplay");
})();
