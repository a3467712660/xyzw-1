const LOADER_FAMILIES = Object.freeze({
  SRC: "src-xyzw-loader",
  PUBLIC: "public-xyzw-loader",
  UNKNOWN: "unknown-loader",
});

const PROBE_FAMILIES = Object.freeze({
  SOURCE: "source-id-probes",
  PRODUCTION: "production-id-probes",
});

const SOURCE_MODULE_IDS = Object.freeze([
  "BattleUIManager",
  "enter-oss",
  "BattleKitCrossSite",
]);

const RUNTIME_SCRIPT_URLS = Object.freeze([
  "/xyzw/cocos2d-js-min.js",
  "/xyzw/game-defines.browser.js",
  "/xyzw/index.js",
]);

const toFunctionSource = (value) => {
  if (typeof value !== "function") {
    return "";
  }
  try {
    return Function.prototype.toString.call(value);
  } catch {
    return "";
  }
};

const toNormalizedSourceSnippet = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const getRequireFingerprint = (req) => {
  if (typeof req !== "function") {
    return null;
  }
  const source = toFunctionSource(req);
  return {
    name: req.name || null,
    length: source.length,
    head: source.slice(0, 120),
    tail: source.slice(-120),
  };
};

const isPublicRuntimePath = (value) =>
  String(value || "").includes("/xyzw/index.js");

const looksLikePublicRequire = (source) => {
  const normalized = toNormalizedSourceSnippet(source);
  return normalized.includes("function e(t, n, r)")
    || normalized.includes("function e(t,n,r)")
    || normalized.includes("if (!n[a]) { if (!t[a])")
    || normalized.includes("if(!n[a]){if(!t[a])");
};

const looksLikeSourceRequire = (source) => {
  const normalized = toNormalizedSourceSnippet(source);
  return normalized.includes("function i(a, s, c)")
    || normalized.includes("function i(a,s,c)")
    || normalized.includes("function a(r, s, l)")
    || normalized.includes("function a(r,s,l)")
    || normalized.includes("if (!s[t]) { if (!a[t])")
    || normalized.includes("if(!s[t]){if(!a[t])")
    || normalized.includes("if (!s[t]) { if (!r[t])")
    || normalized.includes("if(!s[t]){if(!r[t])");
};

const getWindowScriptUrls = (targetWindow) => {
  try {
    return Array.from(targetWindow?.document?.scripts || [])
      .map((entry) => String(entry?.src || ""))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const getWindowPerformanceUrls = (targetWindow) => {
  try {
    return Array.from(targetWindow?.performance?.getEntriesByType?.("resource") || [])
      .map((entry) => String(entry?.name || ""))
      .filter(Boolean);
  } catch {
    return [];
  }
};

const findGameWindow = (root = window) => {
  if (typeof root?.__require === "function") {
    return { gameWindow: root, source: "window" };
  }
  const iframes = Array.from(root?.document?.querySelectorAll?.("iframe") || []);
  for (let index = 0; index < iframes.length; index += 1) {
    try {
      const contentWindow = iframes[index]?.contentWindow || null;
      if (typeof contentWindow?.__require === "function") {
        return {
          gameWindow: contentWindow,
          source: `iframe[${index}]`,
        };
      }
    } catch {
      // Ignore inaccessible iframes.
    }
  }
  return { gameWindow: null, source: null };
};

const detectLoaderFamily = (gameWindow) => {
  const scriptUrls = getWindowScriptUrls(gameWindow);
  const performanceUrls = getWindowPerformanceUrls(gameWindow);
  const requireSource = toFunctionSource(gameWindow?.__require);
  const publicEvidence = [];
  const srcEvidence = [];

  if (scriptUrls.some(isPublicRuntimePath)) {
    publicEvidence.push("document:/xyzw/index.js");
  }
  if (performanceUrls.some(isPublicRuntimePath)) {
    publicEvidence.push("performance:/xyzw/index.js");
  }
  if (looksLikePublicRequire(requireSource)) {
    publicEvidence.push("fingerprint:public");
  }

  if (looksLikeSourceRequire(requireSource)) {
    srcEvidence.push("fingerprint:source");
  }

  let loaderFamily = LOADER_FAMILIES.UNKNOWN;
  if (publicEvidence.length > 0) {
    loaderFamily = LOADER_FAMILIES.PUBLIC;
  } else if (srcEvidence.length > 0) {
    loaderFamily = LOADER_FAMILIES.SRC;
  }

  return {
    loaderFamily,
    evidence: {
      publicEvidence,
      srcEvidence,
    },
    requireFingerprint: getRequireFingerprint(gameWindow?.__require),
    suspectedBundlePath: publicEvidence.length > 0 ? "/xyzw/index.js" : null,
    scriptUrls,
    performanceUrls,
  };
};

const looksLikeBattleInput = (value) =>
  Boolean(
    value?.battleData
    && typeof value?.mapId !== "undefined"
    && (
      typeof value?.battleData?.leftTeam?.team?.get === "function"
      || typeof value?.battleData?.leftTeam?.team?.forEach === "function"
    )
    && (
      typeof value?.battleData?.rightTeam?.team?.get === "function"
      || typeof value?.battleData?.rightTeam?.team?.forEach === "function"
    ),
  );

const ensureReplayInputDataForSourceFamily = (source, gameWindow) => {
  if (looksLikeBattleInput(source)) {
    return source;
  }
  const req = gameWindow?.__require;
  if (typeof req !== "function") {
    throw new Error("live window.__require is unavailable");
  }
  const { EnterOSSState } = req("enter-oss");
  const oss = new EnterOSSState();
  const battleData = oss.getBattleDataByOSS(source);
  if (!battleData) {
    throw new Error("getBattleDataByOSS returned null");
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
    if (source && source[key] != null) {
      inputData[key] = source[key];
    }
  }
  inputData.mapId ??= 10001;
  inputData.battleResult ??= inputData.battleData?.result;
  return inputData;
};

const createFamilyMismatchProbe = (moduleId, loaderFamily) => ({
  ok: false,
  status: "module-id-family-mismatch",
  moduleId,
  errorMessage: `${moduleId} is a source-era probe and is incompatible with ${loaderFamily}.`,
  stackTop: null,
});

const inspect = () => {
  const { gameWindow, source } = findGameWindow(window);
  const loaderInfo = detectLoaderFamily(gameWindow);
  return {
    currentAssetPath: loaderInfo.suspectedBundlePath,
    gameWindowSource: source,
    incompatibleProbes:
      loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC
        ? [...SOURCE_MODULE_IDS]
        : [],
    loaderFamily: loaderInfo.loaderFamily,
    loaderFamilyEvidence: loaderInfo.evidence,
    probeCompatibility: "compatible-probe",
    probeFamily: PROBE_FAMILIES.PRODUCTION,
    requireFingerprint: loaderInfo.requireFingerprint,
    scene: gameWindow?.cc?.director?.getScene?.()?.name || null,
    scriptUrls: loaderInfo.scriptUrls,
    performanceUrls: loaderInfo.performanceUrls,
    suspectedBundlePath: loaderInfo.suspectedBundlePath,
    sourceIdProbes:
      loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC
        ? Object.fromEntries(
            SOURCE_MODULE_IDS.map((moduleId) => [
              moduleId,
              createFamilyMismatchProbe(moduleId, loaderInfo.loaderFamily),
            ]),
          )
        : {},
  };
};

const play = (rawOrWrappedData = window.__xyzwReplayData || window.__REPLAY_DATA__ || null) => {
  const { gameWindow } = findGameWindow(window);
  const loaderInfo = detectLoaderFamily(gameWindow);
  if (loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC) {
    return {
      ok: false,
      status: "bridge-not-exposed",
      loaderFamily: loaderInfo.loaderFamily,
      detail:
        "The production/public loader is running, but no stable production replay bridge has been found yet.",
    };
  }

  if (loaderInfo.loaderFamily !== LOADER_FAMILIES.SRC) {
    return {
      ok: false,
      status: "loader-family-mismatch",
      loaderFamily: loaderInfo.loaderFamily,
      detail: "The current loader family is not compatible with source-era replay probes.",
    };
  }

  try {
    const prepared = ensureReplayInputDataForSourceFamily(rawOrWrappedData, gameWindow);
    const result = gameWindow.__require("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared);
    return {
      ok: true,
      status: "played-via-source-bridge",
      loaderFamily: loaderInfo.loaderFamily,
      result,
    };
  } catch (error) {
    return {
      ok: false,
      status: "require-exec-error",
      loaderFamily: loaderInfo.loaderFamily,
      errorMessage: error?.message || String(error),
      stackTop: String(error?.stack || "").split("\n").map((line) => line.trim()).filter(Boolean)[1] || null,
    };
  }
};

const loadRuntimeScript = (src) =>
  new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-replay-runtime-probe="${src}"]`);
    if (existing?.dataset.loaded === "true") {
      resolve();
      return;
    }
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Failed to load runtime script: ${src}`)), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.defer = true;
    script.src = src;
    script.dataset.replayRuntimeProbe = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => reject(new Error(`Failed to load runtime script: ${src}`)), { once: true });
    document.head.appendChild(script);
  });

const ensureRuntimeLoaded = async () => {
  for (const scriptUrl of RUNTIME_SCRIPT_URLS) {
    await loadRuntimeScript(scriptUrl);
  }
};

const attachBridge = async () => {
  await ensureRuntimeLoaded();
  const bridge = {
    __xyzwReplayBridgeReady: false,
    inspect,
    play,
  };
  window.__xyzwReplayBridge = bridge;
  window.__xyzwReplay = bridge;
  console.log("[xyzw replay] public replay bridge attached", inspect());
  return bridge;
};

window.__xyzwReplayBridgeReadyPromise = attachBridge();
