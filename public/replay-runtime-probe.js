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

const GENERIC_OWNER_RE = /(?:^|\.)(?:window|self|top|parent|frames|document)(?:\.|$)/i;
const GLOBAL_KEY_LIMIT = 240;
const MATCH_LIMIT = 40;
const MEMBER_LIMIT = 12;
const NODE_TEXT_LIMIT = 12;
const RANKED_TARGET_LIMIT = 10;
const VISUAL_NODE_LIMIT = 30;
const PRODUCTION_RUNTIME_WAIT_INTERVAL_MS = 100;
const PRODUCTION_RUNTIME_WAIT_TIMEOUT_MS = 3000;
const STABILIZED_RESCAN_DELAY_MS = 300;
const PRODUCTION_TARGET_CONFIDENCE_THRESHOLD = 60;
const INTERACTION_TRACE_WINDOW_MS = 800;
const REPLAY_GETTER_PREFIXES = new Set([
  "get",
  "set",
  "is",
  "has",
  "can",
  "should",
]);
const REPLAY_POSITIVE_SIGNAL_WORDS = new Set([
  "play",
  "replay",
  "playback",
]);
const REPLAY_REPLAY_SIGNAL_WORDS = new Set([
  "replay",
  "playback",
]);
const REPLAY_CONTEXT_WORDS = new Set([
  "battle",
  "fight",
  "pvp",
]);
const REPLAY_METADATA_WORDS = new Set([
  "version",
  "config",
  "state",
  "status",
  "meta",
  "metadata",
]);
const REPLAY_NEGATIVE_SIGNAL_WORDS = new Set([
  "err",
  "error",
  "music",
  "audio",
  "sound",
  "bgm",
  "video",
  "ad",
  "reward",
  "effect",
  "clip",
  "voice",
  "mute",
]);
const REPLAY_BLACKLISTED_METHODS = new Set([
  "_canPlay",
  "getBattleVersion",
  "getVersion",
  "getFightVersion",
  "getBattleResultVersion",
  "_dealPlayErr",
  "playMusic",
  "playVideoAd",
  "playEffect",
  "playEffect2",
]);
const REPLAY_SPECIFIC_REASONS = new Set([
  "methodName:replay/playback",
  "functionSource:replay/playback",
  "componentName:replay/playback",
  "nodePath:replay/playback",
  "battle-context+payload-affinity",
  "source:interaction-trace",
  "source:button-click-event",
  "source:scene-context-handler",
  "context:replay-ui",
  "uiText:replay-zh",
  "buttonText:replay",
  "customEventData:replay",
]);
const REPLAY_UI_CONTEXT_RE = /replay|playback|battle|fight|pvp|回放|回看|复盘|观战|战报|报告|录像|记录详情|历史记录|战斗记录|对战记录|查看详情|播放记录|对战|战斗|记录|战绩|详情|查看|历史|播放|重播/i;
const REPLAY_UI_CONTEXT_ZH_RE = /回放|回看|复盘|观战|战报|报告|录像|记录详情|历史记录|战斗记录|对战记录|查看详情|播放记录|对战|战斗|记录|战绩|详情|查看|历史|播放|重播/;
const CONTEXT_HANDLER_NAME_PREFIXES = Object.freeze([
  "open",
  "openpanel",
  "show",
  "showpanel",
  "init",
  "enter",
  "enterreplay",
  "start",
  "onclick",
  "onbtn",
  "onopen",
  "onpress",
  "onshow",
  "onrecord",
  "onhistory",
  "click",
  "handle",
  "playrecord",
  "setdata",
  "setinfo",
  "refresh",
  "load",
  "preview",
  "previewrecord",
]);
const DISCOVERY_SOURCE_PRIORITY = Object.freeze({
  "interaction-trace": 6,
  "button-click-event": 5,
  "scene-context-handler": 4,
  "global-object": 3,
  "global-function": 2,
  "scene-component": 1,
});
const DISCOVERY_RICH_SOURCES = new Set([
  "scene-context-handler",
  "button-click-event",
  "interaction-trace",
]);
const INTERACTION_TRACE_LIMIT = 20;
const BUTTON_HANDLER_LIMIT = 20;

const sortDiscoverySources = (sources = []) =>
  [...new Set(Array.isArray(sources) ? sources.filter(Boolean) : [])]
    .sort((left, right) => {
      const priorityDiff = (DISCOVERY_SOURCE_PRIORITY[right] || 0)
        - (DISCOVERY_SOURCE_PRIORITY[left] || 0);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return String(left).localeCompare(String(right));
    });

const PROBE_RUNTIME_STATE = {
  attachedAt: null,
  interactionTrace: {
    activeClickContext: null,
    captureAllClicks: true,
    captureWindowMs: INTERACTION_TRACE_WINDOW_MS,
    buttonTouchPatched: false,
    buttonTouchPatchSource: null,
    buttonTouchRestore: null,
    buttonTouchSupported: false,
    candidates: [],
    emitEventsPatched: false,
    emitEventsPatchSource: null,
    emitEventsRestore: null,
    emitEventsSupported: false,
    installedAt: null,
    lastClickContext: null,
  },
  lastInstantResolution: null,
  lastStabilizedResolution: null,
  runtimeBootPromise: null,
  runtimeBootState: null,
  runtimeBootWaitResult: null,
};

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

const toFunctionSourceSnippet = (value, maxLength = 220) =>
  toNormalizedSourceSnippet(toFunctionSource(value)).slice(0, maxLength);

const toIdentifierWords = (value) =>
  String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

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

const isObjectLike = (value) =>
  Boolean(value) && (typeof value === "object" || typeof value === "function");

const isPlainObject = (value) =>
  Boolean(value)
  && typeof value === "object"
  && Object.getPrototypeOf(value) === Object.prototype;

const hasIdentifierWord = (value, words) =>
  toIdentifierWords(value).some((entry) => {
    const normalized = entry.replace(/\d+$/g, "");
    return words.has(entry) || words.has(normalized);
  });

const hasReplaySignalText = (value) =>
  hasIdentifierWord(value, REPLAY_REPLAY_SIGNAL_WORDS);

const hasPlaySignalText = (value) =>
  hasIdentifierWord(value, REPLAY_POSITIVE_SIGNAL_WORDS);

const hasBattleContextText = (value) =>
  hasIdentifierWord(value, REPLAY_CONTEXT_WORDS);

const matchesNegativePlaySignal = (value) =>
  hasIdentifierWord(value, REPLAY_NEGATIVE_SIGNAL_WORDS);

const matchesReplayUiContextText = (value) =>
  REPLAY_UI_CONTEXT_RE.test(String(value || "").trim());

const matchesChineseReplayUiContextText = (value) =>
  REPLAY_UI_CONTEXT_ZH_RE.test(String(value || "").trim());

const toNormalizedTextList = (values, limit = NODE_TEXT_LIMIT) => {
  const textSet = new Set();
  const queue = Array.isArray(values) ? [...values] : [values];

  while (queue.length > 0 && textSet.size < limit) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.unshift(...current);
      continue;
    }
    const text = String(current || "").trim();
    if (text) {
      textSet.add(text);
    }
  }

  return [...textSet];
};

const getReplayUiContextMatches = (values, limit = NODE_TEXT_LIMIT) =>
  toNormalizedTextList(values, limit).filter(matchesReplayUiContextText);

const pickPreferredReplayUiText = (values) => {
  const texts = toNormalizedTextList(values, NODE_TEXT_LIMIT);
  return texts.find(matchesChineseReplayUiContextText)
    || texts.find(matchesReplayUiContextText)
    || texts[0]
    || null;
};

const matchesReplayKeyword = (value) =>
  hasPlaySignalText(value) || hasBattleContextText(value) || matchesReplayUiContextText(value);

const matchesContextHandlerName = (name) => {
  const normalized = String(name || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
  return CONTEXT_HANDLER_NAME_PREFIXES.some((prefix) =>
    normalized === prefix || normalized.startsWith(prefix));
};

const isGetterLikeMethodName = (name) => {
  const words = toIdentifierWords(name);
  return words.length > 0 && REPLAY_GETTER_PREFIXES.has(words[0]);
};

const isMetadataLikeMethodName = (name) =>
  hasIdentifierWord(name, REPLAY_METADATA_WORDS);

const looksLikeMetadataSourceSnippet = (value) =>
  /return\s+[^;{}]*(version|config|state|status|meta|metadata)/i.test(String(value || ""));

const looksLikePureGetterSourceSnippet = (value) => {
  const normalized = toNormalizedSourceSnippet(value);
  if (!normalized) {
    return false;
  }
  return /^function\b[^(]*\([^)]*\)\s*\{\s*return\b/i.test(normalized)
    || /^\([^)]*\)\s*=>\s*[^={][^;]*$/i.test(normalized)
    || /^\w+\([^)]*\)\s*\{\s*return\b/i.test(normalized);
};

const hasBattlePayloadShape = (payloadShape) =>
  Boolean(
    payloadShape
    && (
      payloadShape.kind === "battleInputLike"
      || payloadShape.kind === "wrapped"
      || payloadShape.kind === "raw"
      || payloadShape.hasBattleData
      || payloadShape.hasBattleInputData
      || payloadShape.hasBattleInputSnapshot
      || payloadShape.hasBattleResult
      || payloadShape.hasMapId
    ),
  );

const hasPayloadFieldSignal = (value) =>
  /\b(?:battleData|battleResult|mapId|leftTeam|rightTeam|team|result|round)\b/i.test(
    String(value || ""),
  );

const looksReplayPayloadAffinity = (candidate, payloadShape = null) => {
  if (!hasBattlePayloadShape(payloadShape)) {
    return false;
  }

  const functionSourceSnippet = String(candidate?.functionSourceSnippet || "");
  const componentName = String(candidate?.componentName || "");
  const nodePath = String(candidate?.nodePath || "");
  const contextLabel = `${componentName} ${nodePath}`;
  if (
    matchesNegativePlaySignal(contextLabel)
    || matchesNegativePlaySignal(functionSourceSnippet)
  ) {
    return false;
  }

  return hasPayloadFieldSignal(functionSourceSnippet)
    || hasBattleContextText(componentName)
    || hasBattleContextText(nodePath)
    || hasReplaySignalText(componentName)
    || hasReplaySignalText(nodePath);
};

const scoreReplayPayloadAffinity = (candidate, payloadShape = null) => {
  if (!hasBattlePayloadShape(payloadShape)) {
    return {
      looksReplayPayloadAffinity: false,
      score: 0,
      why: [],
    };
  }

  let score = 0;
  const why = [];
  const functionSourceSnippet = String(candidate?.functionSourceSnippet || "");
  const componentName = String(candidate?.componentName || "");
  const nodePath = String(candidate?.nodePath || "");

  if (hasPayloadFieldSignal(functionSourceSnippet)) {
    score += 24;
    why.push("payloadAffinity:functionSource:battle-fields");
  }
  if (hasBattleContextText(componentName) || hasReplaySignalText(componentName)) {
    score += 16;
    why.push("payloadAffinity:component:battle/replay-context");
  }
  if (hasBattleContextText(nodePath) || hasReplaySignalText(nodePath)) {
    score += 12;
    why.push("payloadAffinity:nodePath:battle/replay-context");
  }

  return {
    looksReplayPayloadAffinity: score > 0,
    score,
    why,
  };
};

const hasReplaySpecificReason = (why = []) =>
  why.some((entry) => REPLAY_SPECIFIC_REASONS.has(entry));

const getPayloadShapeKey = (payloadShape = null) =>
  JSON.stringify({
    hasBattleData: Boolean(payloadShape?.hasBattleData),
    hasBattleInputData: Boolean(payloadShape?.hasBattleInputData),
    hasBattleInputSnapshot: Boolean(payloadShape?.hasBattleInputSnapshot),
    hasBattleResult: Boolean(payloadShape?.hasBattleResult),
    hasMapId: Boolean(payloadShape?.hasMapId),
    kind: payloadShape?.kind || null,
  });

const getObjectName = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "function" && value.name) {
    return value.name;
  }
  const constructorName = value?.constructor?.name;
  if (constructorName && constructorName !== "Object") {
    return constructorName;
  }
  return value?.__classname__ || value?.name || null;
};

const visitMemberHolder = (holder, names, methodSet, propertySet) => {
  if (!holder || !Array.isArray(names)) {
    return;
  }

  for (const name of names) {
    if (name === "constructor" || !matchesReplayKeyword(name)) {
      continue;
    }

    let descriptor = null;
    try {
      descriptor = Object.getOwnPropertyDescriptor(holder, name) || null;
    } catch {
      descriptor = null;
    }
    if (!descriptor) {
      continue;
    }

    if (typeof descriptor.value === "function") {
      methodSet.add(name);
      continue;
    }
    propertySet.add(name);
  }
};

const collectReplayMemberMatches = (value) => {
  if (!isObjectLike(value)) {
    return {
      methodMatches: [],
      propertyMatches: [],
    };
  }

  const methodSet = new Set();
  const propertySet = new Set();

  try {
    visitMemberHolder(
      value,
      Object.keys(value).slice(0, GLOBAL_KEY_LIMIT),
      methodSet,
      propertySet,
    );
  } catch {
    // Ignore dynamic host objects.
  }

  const prototype = Object.getPrototypeOf(value);
  if (
    prototype
    && prototype !== Object.prototype
    && prototype !== Function.prototype
  ) {
    try {
      visitMemberHolder(
        prototype,
        Object.getOwnPropertyNames(prototype).slice(0, GLOBAL_KEY_LIMIT),
        methodSet,
        propertySet,
      );
    } catch {
      // Ignore inaccessible prototypes.
    }
  }

  return {
    methodMatches: [...methodSet].slice(0, MEMBER_LIMIT),
    propertyMatches: [...propertySet].slice(0, MEMBER_LIMIT),
  };
};

const visitContextHandlerHolder = (holder, names, methodSet) => {
  if (!holder || !Array.isArray(names)) {
    return;
  }

  for (const name of names) {
    if (name === "constructor" || !matchesContextHandlerName(name)) {
      continue;
    }

    let descriptor = null;
    try {
      descriptor = Object.getOwnPropertyDescriptor(holder, name) || null;
    } catch {
      descriptor = null;
    }
    if (!descriptor || typeof descriptor.value !== "function") {
      continue;
    }
    methodSet.add(name);
  }
};

const collectContextHandlerMatches = (value) => {
  if (!isObjectLike(value)) {
    return [];
  }

  const methodSet = new Set();
  try {
    visitContextHandlerHolder(
      value,
      Object.keys(value).slice(0, GLOBAL_KEY_LIMIT),
      methodSet,
    );
  } catch {
    // Ignore host objects that throw during key enumeration.
  }

  const prototype = Object.getPrototypeOf(value);
  if (
    prototype
    && prototype !== Object.prototype
    && prototype !== Function.prototype
  ) {
    try {
      visitContextHandlerHolder(
        prototype,
        Object.getOwnPropertyNames(prototype).slice(0, GLOBAL_KEY_LIMIT),
        methodSet,
      );
    } catch {
      // Ignore inaccessible prototypes.
    }
  }

  return [...methodSet].slice(0, MEMBER_LIMIT);
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

const getVisibleCanvasCount = () =>
  Array.from(window?.document?.querySelectorAll?.("canvas") || [])
    .filter((canvas) => {
      if (!canvas || typeof canvas.getBoundingClientRect !== "function") {
        return false;
      }
      const rect = canvas.getBoundingClientRect();
      const style = window.getComputedStyle(canvas);
      return rect.width > 0
        && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden"
        && Number(style.opacity || 1) > 0;
    }).length;

const buildRuntimeBootState = (gameWindow, { phase = "snapshot" } = {}) => {
  const loaderInfo = detectLoaderFamily(gameWindow);
  const now = Date.now();
  return {
    documentReadyState: window?.document?.readyState || null,
    hasCc: Boolean(gameWindow?.cc),
    hasDirector: Boolean(gameWindow?.cc?.director),
    hasGame: Boolean(gameWindow?.cc?.game),
    hasGameCanvas: Boolean(gameWindow?.cc?.game?.canvas),
    hasRequire: typeof gameWindow?.__require === "function",
    loaderFamily: loaderInfo.loaderFamily,
    performanceUrls: loaderInfo.performanceUrls,
    phase,
    scene: gameWindow?.cc?.director?.getScene?.()?.name || null,
    scriptUrls: loaderInfo.scriptUrls,
    timestamps: {
      attachedAt: PROBE_RUNTIME_STATE.attachedAt,
      observedAt: now,
      sinceAttachMs:
        PROBE_RUNTIME_STATE.attachedAt == null
          ? null
          : now - PROBE_RUNTIME_STATE.attachedAt,
    },
    visibleCanvasCount: getVisibleCanvasCount(),
  };
};

const updateRuntimeBootState = (gameWindow, options = {}) => {
  const state = buildRuntimeBootState(gameWindow, options);
  PROBE_RUNTIME_STATE.runtimeBootState = state;
  return state;
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
  inputData.mapId ??= source?.mapId ?? 10001;
  inputData.battleResult ??= inputData.battleData?.result;
  return inputData;
};

const buildSourceIdProbeMismatchMap = (loaderFamily) =>
  Object.fromEntries(
    SOURCE_MODULE_IDS.map((moduleId) => [
      moduleId,
      {
        ok: false,
        status: "module-id-family-mismatch",
        moduleId,
        errorMessage: `${moduleId} is a source-era probe and is incompatible with ${loaderFamily}.`,
        stackTop: null,
      },
    ]),
  );

const getBattleDataLike = (value) =>
  value?.battleData
  || value?.battleInputData?.battleData
  || value?.battleInputSnapshot?.battleData
  || value?.lastBattleData
  || value?.fightRoleBase?.lastBattleData
  || null;

const getCollectionType = (value) => {
  if (value == null) {
    return null;
  }
  if (Array.isArray(value)) {
    return "array";
  }
  if (typeof value?.get === "function" && typeof value?.forEach === "function") {
    return "map-like";
  }
  if (typeof value?.forEach === "function") {
    return "iterable";
  }
  return typeof value;
};

const inspectPayloadShape = (value) => {
  const battleData = getBattleDataLike(value);
  const leftTeam = battleData?.leftTeam?.team ?? battleData?.leftTeam ?? null;
  const rightTeam = battleData?.rightTeam?.team ?? battleData?.rightTeam ?? null;

  let kind = "unknown";
  if (looksLikeBattleInput(value)) {
    kind = "battleInputLike";
  } else if (value?.battleInputData || value?.battleInputSnapshot) {
    kind = "wrapped";
  } else if (value?.battleData || value?.fightRoleBase || value?.lastBattleData) {
    kind = "raw";
  }

  return {
    kind,
    hasBattleData: Boolean(value?.battleData),
    hasBattleInputData: Boolean(value?.battleInputData),
    hasBattleInputSnapshot: Boolean(value?.battleInputSnapshot),
    hasFightRoleBase: Boolean(value?.fightRoleBase),
    hasLastBattleData: Boolean(value?.lastBattleData),
    hasMapId: value?.mapId != null,
    hasBattleResult: value?.battleResult != null || battleData?.result != null,
    leftTeamType: leftTeam == null ? null : typeof leftTeam,
    rightTeamType: rightTeam == null ? null : typeof rightTeam,
    leftTeamCollectionType: getCollectionType(leftTeam),
    rightTeamCollectionType: getCollectionType(rightTeam),
  };
};

const cloneOptionsValue = (value) => {
  if (value instanceof Map) {
    return new Map(value);
  }
  if (isPlainObject(value)) {
    return { ...value };
  }
  return value;
};

const mergeOptionsValue = (innerValue, outerValue) => {
  if (innerValue instanceof Map && outerValue instanceof Map) {
    const merged = new Map(innerValue);
    for (const [key, value] of outerValue.entries()) {
      if (!merged.has(key)) {
        merged.set(key, value);
      }
    }
    return {
      value: merged,
      optionsMerge: "map-merged-missing-keys",
    };
  }

  if (isPlainObject(innerValue) && isPlainObject(outerValue)) {
    const merged = { ...innerValue };
    for (const [key, value] of Object.entries(outerValue)) {
      if (!(key in merged) || merged[key] == null) {
        merged[key] = value;
      }
    }
    return {
      value: merged,
      optionsMerge: "object-merged-missing-keys",
    };
  }

  if (innerValue != null) {
    return {
      value: cloneOptionsValue(innerValue),
      optionsMerge: outerValue != null ? "preserved-inner-type" : "inner-preserved",
    };
  }

  if (outerValue != null) {
    return {
      value: cloneOptionsValue(outerValue),
      optionsMerge: "outer-adopted",
    };
  }

  return {
    value: undefined,
    optionsMerge: "none",
  };
};

const prepareProductionReplayPayload = (value, options = {}) => {
  const wrapper = isObjectLike(value) ? value : null;
  const unwrapped = wrapper?.battleInputData ?? wrapper?.battleInputSnapshot ?? value;

  if (!isObjectLike(unwrapped)) {
    return {
      optionsMerge: "non-object",
      payload: unwrapped,
    };
  }

  const payload = { ...unwrapped };
  const outer = wrapper && wrapper !== unwrapped ? wrapper : null;

  for (const field of [
    "mapId",
    "battleResult",
    "stageNameStr",
    "topName",
    "showRightPower",
  ]) {
    if (payload[field] == null && outer?.[field] != null) {
      payload[field] = outer[field];
    }
  }

  const optionsMergeResult = mergeOptionsValue(payload.options, outer?.options);
  if (optionsMergeResult.value !== undefined) {
    payload.options = optionsMergeResult.value;
  } else if ("options" in payload && payload.options == null) {
    delete payload.options;
  }

  if (payload.battleResult == null && payload?.battleData?.result != null) {
    payload.battleResult = payload.battleData.result;
  }

  if (payload.mapId == null && options?.mapId != null) {
    payload.mapId = options.mapId;
  }

  return {
    optionsMerge: optionsMergeResult.optionsMerge,
    payload,
  };
};

const createTargetCandidate = ({
  buttonText = null,
  buttonTexts = [],
  componentName = null,
  clickedCustomEventData = null,
  clickedNodeLabelTexts = [],
  clickedNodeName = null,
  clickedNodePath = null,
  customEventData = null,
  fn = null,
  handlerComponentName = null,
  handlerTargetNodePath = null,
  invoke,
  label,
  methodName = null,
  nodeName = null,
  nodePath = null,
  ownerKey = null,
  replayContextTexts = [],
  source,
  timestamp = null,
} = {}) => ({
  arity: typeof fn === "function" ? fn.length : null,
  buttonText,
  buttonTexts,
  componentName,
  clickedCustomEventData,
  clickedNodeLabelTexts,
  clickedNodeName,
  clickedNodePath,
  customEventData,
  functionSourceSnippet: toFunctionSourceSnippet(fn),
  handlerComponentName,
  handlerTargetNodePath,
  invoke,
  label,
  methodName,
  nodeName,
  nodePath,
  ownerKey,
  replayContextTexts,
  source,
  timestamp,
});

const collectReplayGlobalCandidates = (gameWindow) => {
  const availableGlobals = [];
  const playMethodCandidates = [];
  const targetCandidates = [];
  const roots = [];
  const seenRoots = new Set();
  const seenGlobals = new Set();
  const seenTargets = new Set();

  const addRoot = (holder, source) => {
    if (!isObjectLike(holder) || seenRoots.has(holder)) {
      return;
    }
    seenRoots.add(holder);
    roots.push({ holder, source });
  };

  addRoot(gameWindow, "gameWindow");
  addRoot(window, "window");
  addRoot(globalThis, "globalThis");

  for (const root of roots) {
    let keys = [];
    try {
      keys = Object.keys(root.holder).slice(0, GLOBAL_KEY_LIMIT);
    } catch {
      keys = [];
    }

    for (const key of keys) {
      if (
        key === "__xyzwReplayBridge"
        || key === "__xyzwReplay"
        || key === "__xyzwReplayBridgeReadyPromise"
      ) {
        continue;
      }

      let value = null;
      try {
        value = root.holder[key];
      } catch {
        value = null;
      }

      const keyMatched = matchesReplayKeyword(key);
      const { methodMatches, propertyMatches } = collectReplayMemberMatches(value);
      if (!keyMatched && methodMatches.length === 0 && propertyMatches.length === 0) {
        continue;
      }

      const globalKey = `${root.source}:${key}`;
      if (!seenGlobals.has(globalKey) && availableGlobals.length < MATCH_LIMIT) {
        seenGlobals.add(globalKey);
        availableGlobals.push({
          key,
          keyMatched,
          methodMatches,
          objectType: getObjectName(value),
          propertyMatches,
          source: root.source,
          type: typeof value,
        });
      }

      if (
        typeof value === "function"
        && keyMatched
        && targetCandidates.length < MATCH_LIMIT
      ) {
        const label = `${root.source}.${key}`;
        if (!seenTargets.has(label)) {
          seenTargets.add(label);
          playMethodCandidates.push({
            arity: value.length,
            functionSourceSnippet: toFunctionSourceSnippet(value),
            label,
            methodName: key,
            ownerKey: key,
            source: "global-function",
          });
          targetCandidates.push(createTargetCandidate({
            fn: value,
            invoke: (payload, playOptions = {}) => value.call(root.holder, payload, playOptions),
            label,
            methodName: key,
            ownerKey: key,
            source: "global-function",
          }));
        }
      }

      if (!isObjectLike(value)) {
        continue;
      }

      for (const methodName of methodMatches) {
        if (targetCandidates.length >= MATCH_LIMIT) {
          break;
        }

        const method = value?.[methodName];
        if (typeof method !== "function") {
          continue;
        }

        const label = `${root.source}.${key}.${methodName}`;
        if (seenTargets.has(label)) {
          continue;
        }

        seenTargets.add(label);
        playMethodCandidates.push({
          arity: method.length,
          functionSourceSnippet: toFunctionSourceSnippet(method),
          label,
          methodName,
          ownerKey: key,
          source: "global-object",
        });
        targetCandidates.push(createTargetCandidate({
          fn: method,
          invoke: (payload, playOptions = {}) => value[methodName].call(value, payload, playOptions),
          label,
          methodName,
          ownerKey: key,
          source: "global-object",
        }));
      }
    }
  }

  return {
    availableGlobals,
    playMethodCandidates,
    targetCandidates,
  };
};

const getSceneNodeChildren = (node) => {
  if (Array.isArray(node?.children)) {
    return node.children.filter(Boolean);
  }
  if (Array.isArray(node?._children)) {
    return node._children.filter(Boolean);
  }
  return [];
};

const getSceneNodeComponents = (node) => {
  if (Array.isArray(node?._components)) {
    return node._components.filter(Boolean);
  }
  if (Array.isArray(node?.components)) {
    return node.components.filter(Boolean);
  }
  return [];
};

const createSceneNodeIndex = (scene) => {
  const pathMap = new WeakMap();
  const records = [];

  if (!scene) {
    return {
      pathMap,
      records,
      scene: null,
    };
  }

  const queue = [{
    node: scene,
    path: scene?.name || "Game",
  }];
  const seenNodes = new Set();

  while (queue.length > 0) {
    const current = queue.shift();
    const node = current?.node || null;
    if (!node || seenNodes.has(node)) {
      continue;
    }
    seenNodes.add(node);

    const nodeName = String(node?.name || "");
    const nodePath = current?.path || nodeName || "Game";
    pathMap.set(node, nodePath);
    records.push({
      node,
      nodeName,
      nodePath,
    });

    for (const child of getSceneNodeChildren(node)) {
      const childName = String(child?.name || "(anonymous)");
      queue.push({
        node: child,
        path: `${nodePath}/${childName}`,
      });
    }
  }

  return {
    pathMap,
    records,
    scene,
  };
};

const getNodePathFromIndex = (node, sceneIndex) => {
  if (!node) {
    return null;
  }
  if (sceneIndex?.pathMap?.has(node)) {
    return sceneIndex.pathMap.get(node) || null;
  }

  const parentSegments = [];
  let current = node;
  let guard = 0;
  while (current && guard < 50) {
    parentSegments.push(String(current?.name || "(anonymous)"));
    current = current?.parent || null;
    guard += 1;
  }

  if (parentSegments.length === 0) {
    return null;
  }
  return parentSegments.reverse().join("/");
};

const extractNodeLabelTexts = (node) => {
  const textSet = new Set();
  const queue = [node];
  const seenNodes = new Set();

  const addText = (value) => {
    const text = String(value || "").trim();
    if (text) {
      textSet.add(text);
    }
  };

  while (queue.length > 0 && textSet.size < NODE_TEXT_LIMIT) {
    const current = queue.shift();
    if (!current || seenNodes.has(current)) {
      continue;
    }
    seenNodes.add(current);

    addText(current?.labelString);
    addText(current?.text);
    addText(current?._string);

    for (const component of getSceneNodeComponents(current)) {
      addText(component?.string);
      addText(component?._string);
      addText(component?.text);
      addText(component?.title);
      addText(component?.content);
      addText(component?.buttonText);
      addText(component?.label);
      addText(component?.placeholder);
      addText(component?.cacheLabel);
    }

    queue.push(...getSceneNodeChildren(current));
  }

  return [...textSet].slice(0, NODE_TEXT_LIMIT);
};

const collectNodeTextCandidates = (node) =>
  extractNodeLabelTexts(node);

const findComponentByName = (node, componentName, handlerName = null) => {
  const components = getSceneNodeComponents(node);
  const normalizeName = (value) =>
    String(value || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toLowerCase();
  const normalizedExpected = normalizeName(componentName);

  if (normalizedExpected) {
    const exactMatch = components.find((component) =>
      normalizeName(getObjectName(component)) === normalizedExpected
      || normalizeName(component?.__classname__) === normalizedExpected);
    if (exactMatch && (!handlerName || typeof exactMatch?.[handlerName] === "function")) {
      return exactMatch;
    }
  }

  if (handlerName) {
    return components.find((component) => typeof component?.[handlerName] === "function") || null;
  }

  return components[0] || null;
};

const buildClickContextSnapshot = (context) => {
  if (!context) {
    return null;
  }

  return {
    buttonText: context.buttonText || null,
    clickedCustomEventData: context.clickedCustomEventData || null,
    clickedNodeLabelTexts: toNormalizedTextList(context.clickedNodeLabelTexts || []),
    clickedNodeName: context.clickedNodeName || null,
    clickedNodePath: context.clickedNodePath || null,
    eventHandlers: Array.isArray(context.eventHandlers)
      ? context.eventHandlers.map((entry) => ({
        componentName: entry?.componentName || null,
        customEventData: entry?.customEventData || null,
        handlerName: entry?.handlerName || null,
        targetNodeName: entry?.targetNodeName || null,
        targetNodePath: entry?.targetNodePath || null,
        timestamp: entry?.timestamp || null,
      }))
      : [],
    replayContextTexts: toNormalizedTextList(context.replayContextTexts || []),
    timestamp: context.timestamp || null,
  };
};

const getActiveInteractionClickContext = () => {
  const traceState = PROBE_RUNTIME_STATE.interactionTrace;
  const activeContext = traceState.activeClickContext;
  if (!activeContext) {
    return null;
  }

  if (activeContext.expiresAt && activeContext.expiresAt < Date.now()) {
    traceState.activeClickContext = null;
    return null;
  }

  return activeContext;
};

const setInteractionClickContext = (context) => {
  const traceState = PROBE_RUNTIME_STATE.interactionTrace;
  traceState.activeClickContext = context;
  traceState.lastClickContext = buildClickContextSnapshot(context);
};

const appendInteractionClickHandler = (context, handlerEntry) => {
  if (!context || !handlerEntry) {
    return;
  }

  if (!Array.isArray(context.eventHandlers)) {
    context.eventHandlers = [];
  }
  context.eventHandlers.push(handlerEntry);
  if (context.eventHandlers.length > BUTTON_HANDLER_LIMIT) {
    context.eventHandlers.splice(0, context.eventHandlers.length - BUTTON_HANDLER_LIMIT);
  }
  PROBE_RUNTIME_STATE.interactionTrace.lastClickContext = buildClickContextSnapshot(context);
};

const summarizeReplayHandlerCandidate = (candidate, extra = {}) => ({
  buttonText: candidate?.buttonText || null,
  buttonTexts: toNormalizedTextList(candidate?.buttonTexts || []),
  clickedCustomEventData: candidate?.clickedCustomEventData || null,
  clickedNodeLabelTexts: toNormalizedTextList(candidate?.clickedNodeLabelTexts || []),
  clickedNodeName: candidate?.clickedNodeName || null,
  clickedNodePath: candidate?.clickedNodePath || null,
  componentName: candidate?.componentName || null,
  customEventData: candidate?.customEventData || null,
  handlerComponentName: candidate?.handlerComponentName || candidate?.componentName || null,
  handlerTargetNodePath: candidate?.handlerTargetNodePath || candidate?.nodePath || null,
  label: candidate?.label || null,
  methodName: candidate?.methodName || null,
  nodePath: candidate?.nodePath || null,
  replayContextTexts: toNormalizedTextList(candidate?.replayContextTexts || []),
  source: candidate?.source || null,
  timestamp: candidate?.timestamp || null,
  ...extra,
});

const buildEventHandlerCandidate = ({
  buttonText = null,
  buttonTexts = [],
  clickedCustomEventData = null,
  clickedNodeLabelTexts = [],
  clickedNodeName = null,
  clickedNodePath = null,
  customEventData = null,
  handlerName = null,
  replayContextTexts = [],
  sceneIndex = null,
  source = "button-click-event",
  targetComponentName = null,
  targetNode = null,
  targetNodePath = null,
  timestamp = Date.now(),
} = {}) => {
  const resolvedComponent = findComponentByName(targetNode, targetComponentName, handlerName);
  if (!resolvedComponent || typeof resolvedComponent?.[handlerName] !== "function") {
    return null;
  }

  const resolvedComponentName = getObjectName(resolvedComponent) || "AnonymousComponent";
  const nodePath = targetNodePath
    || getNodePathFromIndex(targetNode, sceneIndex)
    || String(targetNode?.name || "(anonymous)");
  const method = resolvedComponent[handlerName];
  const replayContext = toNormalizedTextList([
    buttonText,
    buttonTexts,
    clickedCustomEventData,
    clickedNodeLabelTexts,
    clickedNodeName,
    clickedNodePath,
    customEventData,
    replayContextTexts,
    targetNode?.name,
    nodePath,
    targetComponentName,
    resolvedComponentName,
    handlerName,
  ], BUTTON_HANDLER_LIMIT);

  return createTargetCandidate({
    buttonText,
    buttonTexts,
    componentName: resolvedComponentName,
    clickedCustomEventData,
    clickedNodeLabelTexts,
    clickedNodeName: clickedNodeName || null,
    clickedNodePath: clickedNodePath || null,
    customEventData,
    fn: method,
    handlerComponentName: resolvedComponentName,
    handlerTargetNodePath: nodePath,
    invoke: (payload, playOptions = {}) =>
      resolvedComponent[handlerName].call(
        resolvedComponent,
        payload,
        playOptions?.customEventData ?? customEventData ?? null,
      ),
    label: `${nodePath}#${resolvedComponentName}.${handlerName}`,
    methodName: handlerName,
    nodeName: String(targetNode?.name || ""),
    nodePath,
    replayContextTexts: replayContext,
    source,
    timestamp,
  });
};

const scanButtonClickEventCandidates = (
  gameWindow,
  { includeAllHandlersInReplayContext = true } = {},
) => {
  const scene = gameWindow?.cc?.director?.getScene?.() || null;
  const sceneIndex = createSceneNodeIndex(scene);
  const buttonHandlerCandidates = [];
  const replayLikeButtonTexts = new Set();
  const replayLikeCustomEventData = new Set();
  const replayLikeNodeContexts = new Set();
  const targetCandidates = [];
  const seenLabels = new Set();

  for (const record of sceneIndex.records) {
    const node = record.node;
    const nodeName = record.nodeName;
    const nodePath = record.nodePath;
    const nodeTexts = extractNodeLabelTexts(node);
    const matchedButtonTexts = getReplayUiContextMatches(nodeTexts, BUTTON_HANDLER_LIMIT);
    const nodeReplayContextTexts = getReplayUiContextMatches([
      nodeName,
      nodePath,
      nodeTexts,
    ], BUTTON_HANDLER_LIMIT);
    matchedButtonTexts.forEach((entry) => replayLikeButtonTexts.add(entry));
    if (nodeReplayContextTexts.length > 0) {
      replayLikeNodeContexts.add(`${nodePath} :: ${nodeReplayContextTexts.slice(0, 3).join(" | ")}`);
    }

    for (const component of getSceneNodeComponents(node)) {
      const clickEvents = Array.isArray(component?.clickEvents) ? component.clickEvents : null;
      if (!clickEvents || clickEvents.length === 0) {
        continue;
      }

      const buttonContextTexts = toNormalizedTextList([
        nodeName,
        nodePath,
        nodeTexts,
        clickEvents.map((clickEvent) => String(clickEvent?.customEventData || "").trim()),
      ], BUTTON_HANDLER_LIMIT);
      const buttonReplayContextTexts = getReplayUiContextMatches(buttonContextTexts, BUTTON_HANDLER_LIMIT);
      const buttonLooksReplayLike = buttonReplayContextTexts.length > 0;
      if (buttonLooksReplayLike) {
        replayLikeNodeContexts.add(`${nodePath} :: ${buttonReplayContextTexts.slice(0, 3).join(" | ")}`);
      }

      for (const clickEvent of clickEvents) {
        const handlerName = String(clickEvent?.handler || "").trim();
        if (!handlerName) {
          continue;
        }

        const customEventData = String(clickEvent?.customEventData || "").trim();
        if (matchesReplayUiContextText(customEventData)) {
          replayLikeCustomEventData.add(customEventData);
        }
        const targetNode = clickEvent?.target || null;
        const targetNodePath = getNodePathFromIndex(targetNode, sceneIndex);
        const targetNodeName = String(targetNode?.name || "");
        const componentName = String(clickEvent?.component || "");
        const eventReplayContextTexts = getReplayUiContextMatches([
          buttonContextTexts,
          nodePath,
          nodeName,
          targetNodePath,
          targetNodeName,
          componentName,
          handlerName,
          customEventData,
          matchedButtonTexts,
        ], BUTTON_HANDLER_LIMIT);
        const shouldInclude = buttonLooksReplayLike
          ? includeAllHandlersInReplayContext
          : eventReplayContextTexts.length > 0;
        if (!shouldInclude) {
          continue;
        }

        const preferredButtonText = pickPreferredReplayUiText([
          matchedButtonTexts,
          nodeTexts,
          customEventData,
        ]);

        const candidate = buildEventHandlerCandidate({
          buttonText: preferredButtonText,
          buttonTexts: nodeTexts,
          clickedCustomEventData: customEventData || null,
          clickedNodeLabelTexts: nodeTexts,
          clickedNodeName: nodeName,
          clickedNodePath: nodePath,
          customEventData,
          handlerName,
          replayContextTexts: [
            buttonReplayContextTexts,
            eventReplayContextTexts,
          ],
          sceneIndex,
          source: "button-click-event",
          targetComponentName: componentName,
          targetNode,
          targetNodePath,
        });
        if (candidate && !seenLabels.has(candidate.label)) {
          seenLabels.add(candidate.label);
          targetCandidates.push(candidate);
        }

        if (buttonHandlerCandidates.length < BUTTON_HANDLER_LIMIT) {
          buttonHandlerCandidates.push({
            buttonText: preferredButtonText,
            buttonTexts: nodeTexts,
            componentName: componentName || null,
            customEventData: customEventData || null,
            handlerName,
            nodeName,
            nodePath,
            replayContextTexts: eventReplayContextTexts,
            targetNodeName: targetNodeName || null,
            targetNodePath,
          });
        }
      }
    }
  }

  return {
    buttonHandlerCandidates,
    replayLikeButtonTexts: [...replayLikeButtonTexts].slice(0, BUTTON_HANDLER_LIMIT),
    replayLikeCustomEventData: [...replayLikeCustomEventData].slice(0, BUTTON_HANDLER_LIMIT),
    replayLikeNodeContexts: [...replayLikeNodeContexts].slice(0, BUTTON_HANDLER_LIMIT),
    targetCandidates,
  };
};

const buildInteractionClickContext = ({
  captureAllClicks = true,
  captureWindowMs = INTERACTION_TRACE_WINDOW_MS,
  clickedCustomEventData = null,
  node = null,
  sceneIndex = null,
} = {}) => {
  const clickedNodeLabelTexts = extractNodeLabelTexts(node);
  const clickedNodeName = String(node?.name || "");
  const clickedNodePath = getNodePathFromIndex(node, sceneIndex);
  const replayContextTexts = toNormalizedTextList([
    clickedNodeLabelTexts,
    clickedNodeName,
    clickedNodePath,
    clickedCustomEventData,
  ], BUTTON_HANDLER_LIMIT);
  const timestamp = Date.now();

  return {
    buttonText: pickPreferredReplayUiText(replayContextTexts),
    captureAllClicks,
    clickedCustomEventData: clickedCustomEventData || null,
    clickedNodeLabelTexts,
    clickedNodeName: clickedNodeName || null,
    clickedNodePath,
    eventHandlers: [],
    expiresAt: timestamp + captureWindowMs,
    replayContextTexts,
    timestamp,
  };
};

const pushInteractionTraceCandidate = (candidate) => {
  const traceState = PROBE_RUNTIME_STATE.interactionTrace;
  if (!candidate) {
    return;
  }
  const existingIndex = traceState.candidates.findIndex((entry) =>
    entry.label === candidate.label && entry.source === candidate.source);
  if (existingIndex !== -1) {
    traceState.candidates.splice(existingIndex, 1);
  }
  traceState.candidates.push(candidate);
  if (traceState.candidates.length > INTERACTION_TRACE_LIMIT) {
    traceState.candidates.splice(0, traceState.candidates.length - INTERACTION_TRACE_LIMIT);
  }
};

const getInteractionTraceCandidates = () => {
  const replayLikeButtonTexts = new Set();
  const replayLikeCustomEventData = new Set();
  const candidates = PROBE_RUNTIME_STATE.interactionTrace.candidates.map((candidate) => {
    for (const buttonText of toNormalizedTextList([
      candidate?.buttonText,
      candidate?.buttonTexts,
      candidate?.clickedNodeLabelTexts,
    ], BUTTON_HANDLER_LIMIT)) {
      if (matchesReplayUiContextText(buttonText)) {
        replayLikeButtonTexts.add(String(buttonText));
      }
    }
    for (const customEventData of toNormalizedTextList([
      candidate?.customEventData,
      candidate?.clickedCustomEventData,
    ], BUTTON_HANDLER_LIMIT)) {
      if (matchesReplayUiContextText(customEventData)) {
        replayLikeCustomEventData.add(String(customEventData));
      }
    }
    return summarizeReplayHandlerCandidate(candidate);
  });
  const lastClickContext = buildClickContextSnapshot(
    PROBE_RUNTIME_STATE.interactionTrace.lastClickContext,
  );
  for (const buttonText of toNormalizedTextList(lastClickContext?.clickedNodeLabelTexts || [])) {
    if (matchesReplayUiContextText(buttonText)) {
      replayLikeButtonTexts.add(buttonText);
    }
  }
  if (matchesReplayUiContextText(lastClickContext?.clickedCustomEventData)) {
    replayLikeCustomEventData.add(String(lastClickContext.clickedCustomEventData));
  }

  return {
    interactionTraceCandidates: candidates,
    lastClickContext,
    replayLikeButtonTexts: [...replayLikeButtonTexts].slice(0, BUTTON_HANDLER_LIMIT),
    replayLikeCustomEventData: [...replayLikeCustomEventData].slice(0, BUTTON_HANDLER_LIMIT),
    targetCandidates: PROBE_RUNTIME_STATE.interactionTrace.candidates.slice(0, INTERACTION_TRACE_LIMIT),
  };
};

const traceUiReplayHandlers = (options = {}) => {
  const { gameWindow } = findGameWindow(window);
  const traceState = PROBE_RUNTIME_STATE.interactionTrace;
  const captureAllClicks = options?.captureAllClicks !== false;
  const captureWindowMs = Number.isFinite(options?.captureWindowMs)
    ? Math.max(1, Number(options.captureWindowMs))
    : INTERACTION_TRACE_WINDOW_MS;

  traceState.captureAllClicks = captureAllClicks;
  traceState.captureWindowMs = captureWindowMs;

  if (traceState.installedAt) {
    const traced = getInteractionTraceCandidates();
    return {
      buttonTouchPatchSource: traceState.buttonTouchPatchSource,
      candidateCount: traced.interactionTraceCandidates.length,
      candidates: traced.interactionTraceCandidates,
      captureAllClicks: traceState.captureAllClicks,
      captureWindowMs: traceState.captureWindowMs,
      emitEventsPatchSource: traceState.emitEventsPatchSource,
      emitEventsPatched: traceState.emitEventsPatched,
      emitEventsSupported: traceState.emitEventsSupported,
      installedAt: traceState.installedAt,
      lastClickContext: traced.lastClickContext,
      buttonTouchPatched: traceState.buttonTouchPatched,
      buttonTouchSupported: traceState.buttonTouchSupported,
    };
  }

  traceState.installedAt = Date.now();

  const eventHandlerApi = gameWindow?.cc?.Component?.EventHandler;
  if (typeof eventHandlerApi?.emitEvents === "function") {
    const originalEmitEvents = eventHandlerApi.emitEvents;
    traceState.emitEventsSupported = true;
    traceState.emitEventsPatchSource = "cc.Component.EventHandler.emitEvents";
    eventHandlerApi.emitEvents = function patchedEmitEvents(eventHandlers, ...args) {
      try {
        const scene = gameWindow?.cc?.director?.getScene?.() || null;
        const sceneIndex = createSceneNodeIndex(scene);
        const clickContext = getActiveInteractionClickContext();
        for (const eventHandler of Array.isArray(eventHandlers) ? eventHandlers : []) {
          const handlerName = String(eventHandler?.handler || "").trim();
          if (!handlerName) {
            continue;
          }
          const targetNode = eventHandler?.target || null;
          const targetNodePath = getNodePathFromIndex(targetNode, sceneIndex);
          const targetNodeName = String(targetNode?.name || "");
          const componentName = String(eventHandler?.component || "");
          const customEventData = String(eventHandler?.customEventData || "").trim();
          const replayContextTexts = getReplayUiContextMatches([
            clickContext?.replayContextTexts || [],
            clickContext?.clickedNodeLabelTexts || [],
            clickContext?.clickedNodePath,
            clickContext?.clickedNodeName,
            targetNodePath,
            targetNodeName,
            componentName,
            handlerName,
            customEventData,
          ], BUTTON_HANDLER_LIMIT);
          const replayLike = clickContext?.captureAllClicks === true
            ? replayContextTexts.length > 0
              || Boolean(clickContext?.clickedNodePath)
            : replayContextTexts.length > 0;
          if (!replayLike) {
            continue;
          }
          if (clickContext) {
            if (!clickContext.clickedCustomEventData && customEventData) {
              clickContext.clickedCustomEventData = customEventData;
            }
            clickContext.replayContextTexts = toNormalizedTextList([
              clickContext.replayContextTexts,
              targetNodePath,
              targetNodeName,
              componentName,
              handlerName,
              customEventData,
            ], BUTTON_HANDLER_LIMIT);
            clickContext.buttonText = pickPreferredReplayUiText(clickContext.replayContextTexts);
            clickContext.expiresAt = Date.now() + traceState.captureWindowMs;
            appendInteractionClickHandler(clickContext, {
              componentName: componentName || null,
              customEventData: customEventData || null,
              handlerName,
              targetNodeName: targetNodeName || null,
              targetNodePath,
              timestamp: Date.now(),
            });
          }

          const candidate = buildEventHandlerCandidate({
            buttonText: pickPreferredReplayUiText([
              clickContext?.buttonText,
              replayContextTexts,
            ]),
            buttonTexts: clickContext?.clickedNodeLabelTexts || [],
            clickedCustomEventData: clickContext?.clickedCustomEventData || customEventData || null,
            clickedNodeLabelTexts: clickContext?.clickedNodeLabelTexts || [],
            clickedNodeName: clickContext?.clickedNodeName || null,
            clickedNodePath: clickContext?.clickedNodePath || null,
            customEventData,
            handlerName,
            replayContextTexts,
            sceneIndex,
            source: "interaction-trace",
            targetComponentName: componentName,
            targetNode,
            targetNodePath,
            timestamp: Date.now(),
          });
          pushInteractionTraceCandidate(candidate);
        }
      } catch {
        // Ignore trace instrumentation failures.
      }
      return originalEmitEvents.call(this, eventHandlers, ...args);
    };
    traceState.emitEventsPatched = true;
    traceState.emitEventsRestore = () => {
      eventHandlerApi.emitEvents = originalEmitEvents;
    };
  }

  const buttonPrototype = gameWindow?.cc?.Button?.prototype;
  const buttonTouchMethodName = typeof buttonPrototype?._onTouchEnded === "function"
    ? "_onTouchEnded"
    : typeof buttonPrototype?.onTouchEnded === "function"
      ? "onTouchEnded"
      : null;
  if (buttonTouchMethodName) {
    const originalOnTouchEnded = buttonPrototype[buttonTouchMethodName];
    traceState.buttonTouchSupported = true;
    traceState.buttonTouchPatchSource = `cc.Button.prototype.${buttonTouchMethodName}`;
    buttonPrototype[buttonTouchMethodName] = function patchedButtonTouchEnded(...args) {
      try {
        const scene = gameWindow?.cc?.director?.getScene?.() || null;
        const sceneIndex = createSceneNodeIndex(scene);
        const node = this?.node || null;
        const clickContext = buildInteractionClickContext({
          captureAllClicks: traceState.captureAllClicks,
          captureWindowMs: traceState.captureWindowMs,
          node,
          sceneIndex,
        });
        if (traceState.captureAllClicks || clickContext.replayContextTexts.length > 0) {
          setInteractionClickContext(clickContext);
        } else {
          traceState.activeClickContext = null;
        }
      } catch {
        traceState.activeClickContext = null;
      }
      return originalOnTouchEnded.apply(this, args);
    };
    traceState.buttonTouchPatched = true;
    traceState.buttonTouchRestore = () => {
      buttonPrototype[buttonTouchMethodName] = originalOnTouchEnded;
    };
  }

  const traced = getInteractionTraceCandidates();
  return {
    buttonTouchPatchSource: traceState.buttonTouchPatchSource,
    candidateCount: traced.interactionTraceCandidates.length,
    candidates: traced.interactionTraceCandidates,
    captureAllClicks: traceState.captureAllClicks,
    captureWindowMs: traceState.captureWindowMs,
    emitEventsPatchSource: traceState.emitEventsPatchSource,
    emitEventsPatched: traceState.emitEventsPatched,
    emitEventsSupported: traceState.emitEventsSupported,
    installedAt: traceState.installedAt,
    lastClickContext: traced.lastClickContext,
    buttonTouchPatched: traceState.buttonTouchPatched,
    buttonTouchSupported: traceState.buttonTouchSupported,
  };
};

const scanSceneForReplayCandidates = (gameWindow) => {
  const scene = gameWindow?.cc?.director?.getScene?.() || null;
  const sceneNodeMatches = [];
  const sceneComponentMatches = [];
  const playMethodCandidates = [];
  const replayLikeNodeContexts = [];
  const targetCandidates = [];
  const seenTargets = new Set();
  const sceneIndex = createSceneNodeIndex(scene);

  if (!scene) {
    return {
      playMethodCandidates,
      replayLikeNodeContexts,
      scene: null,
      sceneComponentMatches,
      sceneNodeMatches,
      targetCandidates,
    };
  }

  for (const record of sceneIndex.records) {
    const node = record.node;
    const nodeName = record.nodeName;
    const nodePath = record.nodePath;
    const nodeTexts = extractNodeLabelTexts(node);
    const nodeReplayContextTexts = getReplayUiContextMatches([
      nodeName,
      nodePath,
      nodeTexts,
    ], BUTTON_HANDLER_LIMIT);
    const nodeContextMatched = nodeReplayContextTexts.length > 0;
    if ((matchesReplayKeyword(nodeName) || nodeReplayContextTexts.length > 0) && sceneNodeMatches.length < MATCH_LIMIT) {
      sceneNodeMatches.push({
        nodeName,
        nodePath,
        nodeTexts: nodeReplayContextTexts,
      });
    }
    if (nodeContextMatched && replayLikeNodeContexts.length < MATCH_LIMIT) {
      replayLikeNodeContexts.push(`${nodePath} :: ${nodeReplayContextTexts.slice(0, 3).join(" | ")}`);
    }

    for (const component of getSceneNodeComponents(node)) {
      if (!component) {
        continue;
      }

      const componentName = getObjectName(component) || "AnonymousComponent";
      const componentNameMatched = matchesReplayKeyword(componentName);
      const componentContextMatched = matchesReplayUiContextText(componentName);
      const { methodMatches, propertyMatches } = collectReplayMemberMatches(component);
      const contextHandlerMatches = (
        nodeContextMatched || componentContextMatched
      )
        ? collectContextHandlerMatches(component)
        : [];

      if (
        !componentNameMatched
        && !componentContextMatched
        && methodMatches.length === 0
        && contextHandlerMatches.length === 0
        && propertyMatches.length === 0
      ) {
        continue;
      }

      if (sceneComponentMatches.length < MATCH_LIMIT) {
        sceneComponentMatches.push({
          componentName,
          componentNameMatched,
          methodMatches,
          nodeName,
          nodePath,
          propertyMatches,
        });
      }
      if (
        (nodeContextMatched || componentContextMatched)
        && replayLikeNodeContexts.length < MATCH_LIMIT
      ) {
        replayLikeNodeContexts.push(`${nodePath}#${componentName}`);
      }

      const discoveredMethodNames = [...new Set([
        ...methodMatches,
        ...contextHandlerMatches,
      ])];

      for (const methodName of discoveredMethodNames) {
        if (targetCandidates.length >= MATCH_LIMIT) {
          break;
        }

        const method = component?.[methodName];
        if (typeof method !== "function") {
          continue;
        }

        const label = `${nodePath}#${componentName}.${methodName}`;
        if (seenTargets.has(label)) {
          continue;
        }

        seenTargets.add(label);
        const source = methodMatches.includes(methodName)
          ? "scene-component"
          : "scene-context-handler";
        playMethodCandidates.push({
          arity: method.length,
          componentName,
          functionSourceSnippet: toFunctionSourceSnippet(method),
          label,
          methodName,
          nodeName,
          nodePath,
          source,
        });
        targetCandidates.push(createTargetCandidate({
          buttonTexts: nodeTexts,
          componentName,
          fn: method,
          buttonText: null,
          customEventData: null,
          invoke: (payload, playOptions = {}) => component[methodName].call(component, payload, playOptions),
          label,
          methodName,
          nodeName,
          nodePath,
          replayContextTexts: [
            nodeReplayContextTexts,
            componentName,
          ],
          source,
        }));
      }
    }
  }

  return {
    playMethodCandidates,
    replayLikeNodeContexts: [...new Set(replayLikeNodeContexts)].slice(0, MATCH_LIMIT),
    scene: scene?.name || null,
    sceneComponentMatches,
    sceneNodeMatches,
    targetCandidates,
  };
};

const isValidTargetCandidate = (candidate) =>
  Boolean(candidate && typeof candidate.invoke === "function");

const getCandidateReplayContextTexts = (candidate) =>
  toNormalizedTextList([
    candidate?.buttonText,
    candidate?.buttonTexts,
    candidate?.clickedCustomEventData,
    candidate?.clickedNodeLabelTexts,
    candidate?.clickedNodeName,
    candidate?.clickedNodePath,
    candidate?.customEventData,
    candidate?.nodeName,
    candidate?.nodePath,
    candidate?.handlerComponentName,
    candidate?.handlerTargetNodePath,
    candidate?.componentName,
    candidate?.replayContextTexts,
  ], BUTTON_HANDLER_LIMIT);

const hasStrongSceneContextCandidate = (candidate, why = []) =>
  candidate?.source === "scene-context-handler"
  && (
    why.includes("uiText:replay-zh")
    || why.includes("context:replay-ui")
    || why.includes("buttonText:replay")
    || why.includes("customEventData:replay")
    || why.includes("nodePath:replay/playback")
    || why.includes("componentName:replay/playback")
  );

const hasQualifiedDiscoveryEntry = (entry) =>
  Boolean(
    entry
    && (
      entry.candidate?.source === "interaction-trace"
      || entry.candidate?.source === "button-click-event"
      || hasStrongSceneContextCandidate(entry.candidate, entry.why)
    ),
  );

const scoreProductionReplayTarget = (candidate, payloadShape = null) => {
  let score = 0;
  const why = [];
  const positiveSignals = [];
  const buttonText = String(candidate?.buttonText || "");
  const methodName = String(candidate?.methodName || "");
  const componentName = String(candidate?.componentName || "");
  const customEventData = String(candidate?.customEventData || "");
  const replayContextTexts = getCandidateReplayContextTexts(candidate);
  const nodeLabel = `${candidate?.nodeName || ""} ${candidate?.nodePath || ""}`;
  const functionSourceSnippet = String(candidate?.functionSourceSnippet || "");
  const ownerLabel = `${candidate?.ownerKey || ""} ${candidate?.label || ""}`;
  const targetLooksGetterLike = isGetterLikeMethodName(methodName);
  const targetLooksMetadataLike = isMetadataLikeMethodName(methodName)
    || looksLikeMetadataSourceSnippet(functionSourceSnippet);
  const methodHasReplaySignal = hasReplaySignalText(methodName);
  const methodHasPlaySignal = hasPlaySignalText(methodName);
  const functionHasReplaySignal = hasReplaySignalText(functionSourceSnippet);
  const componentHasReplaySignal = hasReplaySignalText(componentName);
  const nodeHasReplaySignal = hasReplaySignalText(nodeLabel);
  const chineseReplayUiContextMatched = replayContextTexts.some(matchesChineseReplayUiContextText);
  const methodHasNegativeSignal = matchesNegativePlaySignal(methodName);
  const functionHasNegativeSignal = matchesNegativePlaySignal(functionSourceSnippet);
  const contextHasNegativeSignal = matchesNegativePlaySignal(
    `${componentName} ${nodeLabel} ${ownerLabel} ${buttonText} ${customEventData} ${replayContextTexts.join(" ")}`,
  );
  const replayUiContextMatched = replayContextTexts.some(matchesReplayUiContextText);
  const hasBattleContext = [
    hasBattleContextText(methodName),
    hasBattleContextText(componentName),
    hasBattleContextText(nodeLabel),
    hasPayloadFieldSignal(functionSourceSnippet),
  ].some(Boolean);
  const payloadAffinity = scoreReplayPayloadAffinity(candidate, payloadShape);
  const hasPositivePlayEvidence = [
    functionHasReplaySignal,
    componentHasReplaySignal,
    nodeHasReplaySignal,
    replayUiContextMatched,
    chineseReplayUiContextMatched,
    candidate?.source === "interaction-trace",
    candidate?.source === "button-click-event",
    candidate?.source === "scene-context-handler",
    payloadAffinity.looksReplayPayloadAffinity,
  ].some(Boolean);
  const hasWeakPlaySignal = methodHasPlaySignal
    || candidate?.arity === 1
    || candidate?.arity === 2
    || candidate?.source === "scene-component";
  const negativeServiceTarget
    = !methodHasReplaySignal
      && !functionHasReplaySignal
      && !componentHasReplaySignal
      && !nodeHasReplaySignal
      && (
        methodHasNegativeSignal
        || functionHasNegativeSignal
        || contextHasNegativeSignal
      );
  const globalEntityServiceTarget = /(?:^|\/)Global Entity(?:\/|$)/i.test(nodeLabel)
    && (
      methodHasNegativeSignal
      || functionHasNegativeSignal
      || contextHasNegativeSignal
    );
  const explicitlyBlacklisted = REPLAY_BLACKLISTED_METHODS.has(methodName)
    || negativeServiceTarget
    || globalEntityServiceTarget;
  const targetBlacklisted = explicitlyBlacklisted || targetLooksGetterLike;

  if (methodHasReplaySignal) {
    score += 60;
    why.push("methodName:replay/playback");
    positiveSignals.push("methodName");
  } else if (methodHasPlaySignal) {
    score += 2;
  } else if (hasBattleContextText(methodName)) {
    score += 2;
    why.push("methodName:battle/fight/pvp");
  }

  if (functionHasReplaySignal) {
    score += 24;
    why.push("functionSource:replay/playback");
    positiveSignals.push("functionSource");
  }

  if (componentHasReplaySignal) {
    score += 6;
    why.push("componentName:replay/playback");
    positiveSignals.push("componentName");
  }

  if (nodeHasReplaySignal) {
    score += 4;
    why.push("nodePath:replay/playback");
    positiveSignals.push("nodePath");
  }

  if (chineseReplayUiContextMatched) {
    score += 34;
    why.push("uiText:replay-zh");
    positiveSignals.push("uiText:replay-zh");
  }

  if (replayUiContextMatched) {
    score += 18;
    why.push("context:replay-ui");
    positiveSignals.push("context:replay-ui");
  }

  if (matchesReplayUiContextText(buttonText)) {
    score += 24;
    why.push("buttonText:replay");
    positiveSignals.push("buttonText:replay");
  }

  if (matchesReplayUiContextText(customEventData)) {
    score += 20;
    why.push("customEventData:replay");
    positiveSignals.push("customEventData:replay");
  }

  if (hasBattleContext && payloadAffinity.looksReplayPayloadAffinity) {
    score += payloadAffinity.score;
    why.push("battle-context+payload-affinity");
    why.push(...payloadAffinity.why);
    positiveSignals.push("battle-context+payload-affinity");
  }

  if (candidate?.arity === 1 || candidate?.arity === 2) {
    score += 8;
    why.push(`arity:${candidate.arity}`);
  } else if (candidate?.arity === 0 || candidate?.arity >= 3) {
    score -= 8;
    why.push(`arity:${candidate.arity ?? "unknown"}:less-like-payload-options`);
  }

  if (candidate?.source === "interaction-trace") {
    score += 96;
    why.push("source:interaction-trace");
    positiveSignals.push("source:interaction-trace");
  } else if (candidate?.source === "button-click-event") {
    score += 78;
    why.push("source:button-click-event");
    positiveSignals.push("source:button-click-event");
  } else if (candidate?.source === "scene-context-handler") {
    score += 42;
    why.push("source:scene-context-handler");
    positiveSignals.push("source:scene-context-handler");
  } else if (candidate?.source === "global-object") {
    score += 12;
    why.push("source:global-object");
  } else if (candidate?.source === "global-function") {
    score += 8;
    why.push("source:global-function");
  } else if (candidate?.source === "scene-component") {
    score += 4;
    why.push("source:scene-component");
  }

  if (explicitlyBlacklisted) {
    score -= 160;
    why.push(
      REPLAY_BLACKLISTED_METHODS.has(methodName)
        ? "methodName:blacklisted"
        : globalEntityServiceTarget
          ? "globalEntity:service-target"
        : "negativeSignal:blacklisted-service-target",
    );
  }

  if (targetLooksGetterLike) {
    score -= 90;
    why.push("methodName:getter-like");
  }

  if (targetLooksMetadataLike) {
    score -= 50;
    why.push("methodName:metadata-like");
  }

  if (methodHasNegativeSignal) {
    score -= 120;
    why.push("negativeSignal:methodName");
  }

  if (functionHasNegativeSignal) {
    score -= 80;
    why.push("negativeSignal:functionSource");
  }

  if (contextHasNegativeSignal) {
    score -= 60;
    why.push("negativeSignal:context");
  }

  if (looksLikeMetadataSourceSnippet(functionSourceSnippet)) {
    score -= 40;
    why.push("functionSource:return-version/config/state");
  } else if (looksLikePureGetterSourceSnippet(functionSourceSnippet) && !hasPositivePlayEvidence) {
    score -= 24;
    why.push("functionSource:pure-getter");
  }

  if (GENERIC_OWNER_RE.test(ownerLabel)) {
    score -= 20;
    why.push("generic-owner-penalty");
  }

  let rejectedReason = null;
  if (explicitlyBlacklisted) {
    rejectedReason = REPLAY_BLACKLISTED_METHODS.has(methodName)
      ? "method-name-blacklisted"
      : "negative-service-target";
  } else if (targetLooksGetterLike) {
    rejectedReason = "getter-like-method";
  } else if (targetLooksMetadataLike && !hasPositivePlayEvidence) {
    rejectedReason = "metadata-like-method";
  } else if (hasBattleContext && !payloadAffinity.looksReplayPayloadAffinity && !hasReplaySpecificReason(why)) {
    rejectedReason = "battle-context-without-payload-affinity";
  } else if (!hasReplaySpecificReason(why)) {
    rejectedReason = hasWeakPlaySignal
      ? "missing-replay-specific-reason"
      : "missing-play-like-evidence";
  } else if (why.length === 0) {
    rejectedReason = "play-target-why-empty";
  } else if (score < PRODUCTION_TARGET_CONFIDENCE_THRESHOLD) {
    rejectedReason = "score-below-minimum-playable-score";
  }

  return {
    hasPositivePlayEvidence: positiveSignals.length > 0,
    rejectedReason,
    score,
    targetBlacklisted,
    targetLooksGetterLike,
    targetLooksMetadataLike,
    why,
  };
};

const sortRankedTargetEntries = (left, right) => {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const sourceDiff = (DISCOVERY_SOURCE_PRIORITY[right.candidate.source] || 0)
    - (DISCOVERY_SOURCE_PRIORITY[left.candidate.source] || 0);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  return String(left.candidate.label || "").localeCompare(String(right.candidate.label || ""));
};

const deriveSceneScanBlockedReason = (gameWindow, scene) => {
  if (scene) {
    return null;
  }
  return typeof gameWindow?.cc?.director?.getScene === "function"
    ? "scene-null"
    : "cc-director-missing";
};

const getProductionReplaySelectionStatus = (entry) => {
  if (!entry) {
    return "bridge-exposed-but-play-target-missing";
  }
  if (entry.targetBlacklisted) {
    return "bridge-target-blacklisted";
  }
  if (entry.rejectedReason === "battle-context-without-payload-affinity") {
    return "bridge-target-selected-but-not-playlike";
  }
  if (entry.rejectedReason) {
    return "bridge-target-low-confidence";
  }
  return "bridge-ready";
};

const getProductionReplayTargetGateDetail = (resolution = {}) => {
  if (!resolution.selectedTarget) {
    return "The production replay bridge is exposed, but no stable play target was resolved from globals or the Game scene.";
  }

  switch (resolution.bridgeStatus) {
    case "target-discovery-empty-after-blacklist":
      return "Replay candidate discovery only found rejected or blacklisted service handlers, so the production bridge still has no playable target after discovery.";
    case "candidate-space-too-narrow":
      return "Replay candidate discovery is still too narrow: the current scan only found static service handlers and did not reach replay-like UI handlers, button click events, or interaction traces.";
    case "bridge-target-blacklisted":
      return `Selected target ${resolution.playTargetLabel || "(unknown)"} was rejected because it is getter-like or belongs to an error/audio/video/ad/effect service path, so it must not be used as a replay play target.`;
    case "bridge-target-selected-but-not-playlike":
      return `Selected target ${resolution.playTargetLabel || "(unknown)"} has battle/fight/pvp context, but it still lacks replay-specific evidence or payload affinity strong enough to be treated as a replay play target.`;
    case "bridge-target-low-confidence":
      return `Selected target ${resolution.playTargetLabel || "(unknown)"} only has weak play-like reasons and did not meet the minimum playable score ${resolution.minimumPlayableScore}.`;
    default:
      return null;
  }
};

const buildProductionReplayResolution = (
  gameWindow,
  {
    mode = "instant",
    payloadShape = null,
  } = {},
) => {
  const globalCandidates = collectReplayGlobalCandidates(gameWindow);
  const sceneCandidates = scanSceneForReplayCandidates(gameWindow);
  const buttonCandidates = scanButtonClickEventCandidates(gameWindow, {
    includeAllHandlersInReplayContext: true,
  });
  const interactionTrace = getInteractionTraceCandidates();
  const targetCandidates = [
    ...interactionTrace.targetCandidates,
    ...buttonCandidates.targetCandidates,
    ...sceneCandidates.targetCandidates,
    ...globalCandidates.targetCandidates,
  ];

  const rankedEntries = targetCandidates
    .filter(isValidTargetCandidate)
    .map((candidate) => {
      const score = scoreProductionReplayTarget(candidate, payloadShape);
      return {
        candidate,
        hasPositivePlayEvidence: score.hasPositivePlayEvidence,
        rejectedReason: score.rejectedReason,
        score: score.score,
        targetBlacklisted: score.targetBlacklisted,
        targetLooksGetterLike: score.targetLooksGetterLike,
        targetLooksMetadataLike: score.targetLooksMetadataLike,
        why: score.why,
      };
    })
    .sort(sortRankedTargetEntries);

  const playableEntries = rankedEntries.filter((entry) => !entry.targetBlacklisted && !entry.rejectedReason);
  const playTargetEntry = rankedEntries[0] || null;
  const hasQualifiedDiscoverySource = rankedEntries.some(hasQualifiedDiscoveryEntry);
  const candidateDiscoverySources = sortDiscoverySources(
    targetCandidates.map((candidate) => candidate.source),
  );
  const replayLikeNodeContexts = [...new Set([
    ...(sceneCandidates.replayLikeNodeContexts || []),
    ...(buttonCandidates.replayLikeNodeContexts || []),
    interactionTrace.lastClickContext?.clickedNodePath
      ? `${interactionTrace.lastClickContext.clickedNodePath} :: ${(interactionTrace.lastClickContext.clickedNodeLabelTexts || []).slice(0, 3).join(" | ")}`
      : null,
  ].filter(Boolean))];
  const replayLikeButtonTexts = [
    ...new Set([
      ...(buttonCandidates.replayLikeButtonTexts || []),
      ...(interactionTrace.replayLikeButtonTexts || []),
      ...(interactionTrace.lastClickContext?.clickedNodeLabelTexts || []).filter(matchesReplayUiContextText),
    ]),
  ];
  const replayLikeCustomEventData = [
    ...new Set([
      ...(buttonCandidates.replayLikeCustomEventData || []),
      ...(interactionTrace.replayLikeCustomEventData || []),
      matchesReplayUiContextText(interactionTrace.lastClickContext?.clickedCustomEventData)
        ? interactionTrace.lastClickContext?.clickedCustomEventData
        : null,
    ]),
  ].filter(Boolean);
  const serviceLikeCandidatesOnly = rankedEntries.length > 0
    && rankedEntries.every((entry) => {
      const candidateLabel = `${entry.candidate?.nodePath || ""} ${entry.candidate?.methodName || ""} ${entry.candidate?.componentName || ""}`;
      return /(?:^|\/)Global Entity(?:\/|$)/i.test(String(entry.candidate?.nodePath || ""))
        || matchesNegativePlaySignal(candidateLabel);
    });
  const candidateSpaceTooNarrow = playableEntries.length === 0
    && rankedEntries.length > 0
    && !candidateDiscoverySources.some((source) => DISCOVERY_RICH_SOURCES.has(source))
    && replayLikeNodeContexts.length === 0
    && replayLikeButtonTexts.length === 0
    && replayLikeCustomEventData.length === 0
    && serviceLikeCandidatesOnly;
  const discoveryEmptyAfterBlacklist = playableEntries.length === 0
    && rankedEntries.length > 0
    && rankedEntries.every((entry) => entry.targetBlacklisted || entry.rejectedReason);
  const bridgeStatus = discoveryEmptyAfterBlacklist
    ? "target-discovery-empty-after-blacklist"
    : candidateSpaceTooNarrow
      ? "candidate-space-too-narrow"
      : getProductionReplaySelectionStatus(playTargetEntry);
  const rankedTargets = rankedEntries
    .slice(0, RANKED_TARGET_LIMIT)
    .map(({ candidate, rejectedReason, score, targetBlacklisted, targetLooksGetterLike, targetLooksMetadataLike, why }) => ({
      arity: candidate.arity,
      buttonText: candidate.buttonText || null,
      componentName: candidate.componentName,
      customEventData: candidate.customEventData || null,
      functionSourceSnippet: candidate.functionSourceSnippet,
      label: candidate.label,
      methodName: candidate.methodName,
      nodePath: candidate.nodePath,
      rejectedReason,
      score,
      source: candidate.source,
      targetBlacklisted,
      targetLooksGetterLike,
      targetLooksMetadataLike,
      why,
    }));

  const globalCandidateCount = globalCandidates.targetCandidates.filter(isValidTargetCandidate).length;
  const sceneCandidateCount = sceneCandidates.targetCandidates.filter(isValidTargetCandidate).length;
  const targetDiscoverySummary = {
    buttonHandlerCandidateCount: buttonCandidates.buttonHandlerCandidates.length,
    candidateDiscoverySources,
    candidateSpaceTooNarrow,
    discoveryEmptyAfterBlacklist,
    hasQualifiedDiscoverySource,
    interactionTraceCandidateCount: interactionTrace.interactionTraceCandidates.length,
    lastClickContext: interactionTrace.lastClickContext,
    playableCandidateCount: playableEntries.length,
    rankedCandidateCount: rankedEntries.length,
    replayLikeButtonTextCount: replayLikeButtonTexts.length,
    replayLikeCustomEventDataCount: replayLikeCustomEventData.length,
    replayLikeNodeContextCount: replayLikeNodeContexts.length,
    status: bridgeStatus,
  };

  return {
    availableGlobals: globalCandidates.availableGlobals,
    buttonHandlerCandidates: buttonCandidates.buttonHandlerCandidates,
    bridgeStatus,
    candidateDiscoverySources,
    candidateSpaceTooNarrow,
    discoveryEmptyAfterBlacklist,
    globalCandidateCount,
    hasQualifiedDiscoverySource,
    interactionTraceCandidates: interactionTrace.interactionTraceCandidates,
    lastClickContext: interactionTrace.lastClickContext,
    minimumPlayableScore: PRODUCTION_TARGET_CONFIDENCE_THRESHOLD,
    mode,
    payloadShapeKey: getPayloadShapeKey(payloadShape),
    playMethodCandidates: [
      ...globalCandidates.playMethodCandidates,
      ...sceneCandidates.playMethodCandidates,
    ].slice(0, MATCH_LIMIT),
    playTarget: bridgeStatus === "bridge-ready" ? playTargetEntry?.candidate || null : null,
    playTargetLabel: playTargetEntry?.candidate?.label || null,
    playTargetScore: playTargetEntry?.score ?? null,
    playTargetSource: playTargetEntry?.candidate?.source || null,
    playTargetWhy: playTargetEntry?.why || [],
    rankedTargets,
    replayLikeButtonTexts,
    replayLikeCustomEventData,
    replayLikeNodeContexts,
    sceneCandidateCount,
    scene: sceneCandidates.scene,
    sceneScanBlockedReason: deriveSceneScanBlockedReason(gameWindow, sceneCandidates.scene),
    sceneComponentMatches: sceneCandidates.sceneComponentMatches,
    sceneNodeMatches: sceneCandidates.sceneNodeMatches,
    selectedTarget: playTargetEntry?.candidate || null,
    targetBlacklisted: playTargetEntry?.targetBlacklisted === true,
    targetDiscoverySummary,
    targetLooksGetterLike: playTargetEntry?.targetLooksGetterLike === true,
    targetLooksMetadataLike: playTargetEntry?.targetLooksMetadataLike === true,
    targetRejectedReason: playTargetEntry?.rejectedReason || null,
  };
};

const resolveProductionReplayPlayTarget = (
  gameWindow,
  {
    mode = "instant",
    payloadShape = null,
  } = {},
) => {
  const payloadShapeKey = getPayloadShapeKey(payloadShape);
  if (
    mode === "stabilized"
    && PROBE_RUNTIME_STATE.lastStabilizedResolution
    && PROBE_RUNTIME_STATE.lastStabilizedResolution.payloadShapeKey === payloadShapeKey
  ) {
    return PROBE_RUNTIME_STATE.lastStabilizedResolution;
  }

  const resolution = buildProductionReplayResolution(gameWindow, {
    mode,
    payloadShape,
  });
  if (mode === "instant") {
    PROBE_RUNTIME_STATE.lastInstantResolution = resolution;
  }
  return resolution;
};

const getDefaultReplayPayload = () =>
  window.__REPLAY_DATA__ ?? window.__xyzwReplayData ?? null;

const waitForProductionRuntimeSignal = async (gameWindow) => {
  const startedAt = Date.now();
  let attempts = 0;
  let status = "timeout-no-scene";

  updateRuntimeBootState(findGameWindow(window).gameWindow || gameWindow, { phase: "wait-start" });

  while (Date.now() - startedAt < PRODUCTION_RUNTIME_WAIT_TIMEOUT_MS) {
    attempts += 1;
    const observedGameWindow = findGameWindow(window).gameWindow || gameWindow;
    const bootState = updateRuntimeBootState(observedGameWindow, { phase: "wait-loop" });
    if (bootState.scene) {
      status = "scene-ready";
      break;
    }
    if (bootState.hasGameCanvas || bootState.visibleCanvasCount > 0) {
      status = "canvas-ready-without-scene";
      break;
    }
    await sleep(PRODUCTION_RUNTIME_WAIT_INTERVAL_MS);
  }

  const finalGameWindow = findGameWindow(window).gameWindow || gameWindow;
  const finalBootState = updateRuntimeBootState(finalGameWindow, { phase: "wait-finished" });
  PROBE_RUNTIME_STATE.runtimeBootWaitResult = {
    attempts,
    hasGameCanvas: finalBootState.hasGameCanvas,
    scene: finalBootState.scene,
    status,
    visibleCanvasCount: finalBootState.visibleCanvasCount,
    waitedMs: Date.now() - startedAt,
  };
  PROBE_RUNTIME_STATE.lastInstantResolution = buildProductionReplayResolution(finalGameWindow, {
    mode: "instant",
  });

  await sleep(STABILIZED_RESCAN_DELAY_MS);
  const stabilizedGameWindow = findGameWindow(window).gameWindow || finalGameWindow;
  updateRuntimeBootState(stabilizedGameWindow, { phase: "stabilized-rescan" });
  PROBE_RUNTIME_STATE.lastStabilizedResolution = buildProductionReplayResolution(stabilizedGameWindow, {
    mode: "stabilized",
  });

  return PROBE_RUNTIME_STATE.runtimeBootWaitResult;
};

const ensureProductionRuntimeProbeReady = async (gameWindow) => {
  if (!PROBE_RUNTIME_STATE.runtimeBootPromise) {
    PROBE_RUNTIME_STATE.runtimeBootPromise = waitForProductionRuntimeSignal(gameWindow)
      .catch((error) => {
        const message = error?.message || String(error);
        PROBE_RUNTIME_STATE.runtimeBootWaitResult = {
          attempts: 0,
          errorMessage: message,
          hasGameCanvas: false,
          scene: null,
          status: "wait-error",
          visibleCanvasCount: 0,
          waitedMs: 0,
        };
        return PROBE_RUNTIME_STATE.runtimeBootWaitResult;
      });
  }

  await PROBE_RUNTIME_STATE.runtimeBootPromise;
  return PROBE_RUNTIME_STATE;
};

const getVisualProbeCapabilities = (gameWindow) => ({
  canvas: typeof window?.document?.querySelectorAll === "function",
  sceneScan: typeof gameWindow?.cc?.director?.getScene === "function",
  showBattleLoading: "not-found(optional)",
});

const getSceneNodeSummary = (scene) => {
  const summary = [];
  const keywordNodeMatches = [];

  if (!scene) {
    return {
      keywordNodeMatches,
      sceneNodeSummary: summary,
    };
  }

  const queue = [{
    node: scene,
    path: scene?.name || "Game",
  }];
  const seenNodes = new Set();

  while (queue.length > 0 && summary.length < VISUAL_NODE_LIMIT) {
    const current = queue.shift();
    const node = current?.node || null;
    if (!node || seenNodes.has(node)) {
      continue;
    }
    seenNodes.add(node);

    const nodeName = String(node?.name || "(anonymous)");
    const nodePath = current?.path || nodeName;
    const componentNames = getSceneNodeComponents(node)
      .map((component) => getObjectName(component))
      .filter(Boolean)
      .slice(0, 6);
    const signature = componentNames.length > 0
      ? `${nodePath}#${componentNames.join(",")}`
      : nodePath;

    summary.push(signature);

    if (
      matchesReplayKeyword(nodeName)
      || componentNames.some((entry) => matchesReplayKeyword(entry))
    ) {
      keywordNodeMatches.push(signature);
    }

    for (const child of getSceneNodeChildren(node)) {
      const childName = String(child?.name || "(anonymous)");
      queue.push({
        node: child,
        path: `${nodePath}/${childName}`,
      });
    }
  }

  return {
    keywordNodeMatches: keywordNodeMatches.slice(0, VISUAL_NODE_LIMIT),
    sceneNodeSummary: summary,
  };
};

const isCanvasVisible = (canvas) => {
  if (!canvas || typeof canvas.getBoundingClientRect !== "function") {
    return false;
  }

  const rect = canvas.getBoundingClientRect();
  const style = window.getComputedStyle(canvas);
  return rect.width > 0
    && rect.height > 0
    && style.display !== "none"
    && style.visibility !== "hidden"
    && Number(style.opacity || 1) > 0;
};

const summarizeCanvas = (canvas, index) => ({
  className: String(canvas?.className || ""),
  height: canvas?.height ?? null,
  id: canvas?.id || null,
  index,
  visible: isCanvasVisible(canvas),
  width: canvas?.width ?? null,
});

const snapshotVisualState = (gameWindow) => {
  const scene = gameWindow?.cc?.director?.getScene?.() || null;
  const canvases = Array.from(window?.document?.querySelectorAll?.("canvas") || []);
  const visibleCanvases = canvases
    .map(summarizeCanvas)
    .filter((entry) => entry.visible)
    .slice(0, 10);
  const sceneSummary = getSceneNodeSummary(scene);

  return {
    canvasCount: canvases.length,
    hasGameCanvas: Boolean(gameWindow?.cc?.game?.canvas),
    keywordNodeMatches: sceneSummary.keywordNodeMatches,
    scene: scene?.name || null,
    sceneNodeSummary: sceneSummary.sceneNodeSummary,
    visibleCanvases,
  };
};

const sleep = (ms) =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

const toStableListKey = (value) =>
  JSON.stringify(value || []);

const deriveVisualChange = (before, after300, after1200) => {
  const reasons = [];
  const beforeKeywordSet = new Set(before?.keywordNodeMatches || []);

  const compareSnapshot = (label, snapshot) => {
    if (!snapshot) {
      return;
    }

    if (snapshot.scene !== before?.scene) {
      reasons.push(`${label}:scene:${before?.scene || "null"}->${snapshot.scene || "null"}`);
    }

    if (Boolean(snapshot.hasGameCanvas) !== Boolean(before?.hasGameCanvas)) {
      reasons.push(`${label}:hasGameCanvas:${Boolean(before?.hasGameCanvas)}->${Boolean(snapshot.hasGameCanvas)}`);
    }

    if (snapshot.canvasCount !== before?.canvasCount) {
      reasons.push(`${label}:canvasCount:${before?.canvasCount || 0}->${snapshot.canvasCount}`);
    }

    if (toStableListKey(snapshot.visibleCanvases) !== toStableListKey(before?.visibleCanvases)) {
      reasons.push(`${label}:visibleCanvases:changed`);
    }

    if (toStableListKey(snapshot.sceneNodeSummary) !== toStableListKey(before?.sceneNodeSummary)) {
      reasons.push(`${label}:sceneNodeSummary:changed`);
    }

    const newKeywordMatches = (snapshot.keywordNodeMatches || [])
      .filter((entry) => !beforeKeywordSet.has(entry));
    if (newKeywordMatches.length > 0) {
      reasons.push(`${label}:newKeywordMatches:${newKeywordMatches.slice(0, 5).join(", ")}`);
    }
  };

  compareSnapshot("after300", after300);
  compareSnapshot("after1200", after1200);

  return {
    visualChanged: reasons.length > 0,
    visualChangeReasons: reasons,
  };
};

const compressVisualSnapshot = (snapshot) => ({
  canvasCount: snapshot?.canvasCount ?? 0,
  hasGameCanvas: Boolean(snapshot?.hasGameCanvas),
  keywordNodeMatchCount: snapshot?.keywordNodeMatches?.length || 0,
  scene: snapshot?.scene || null,
  sceneNodeCount: snapshot?.sceneNodeSummary?.length || 0,
  visibleCanvasCount: snapshot?.visibleCanvases?.length || 0,
});

const buildVisualPostCheck = ({
  after300 = null,
  after1200 = null,
  before = null,
  debugVisualProbe = false,
  extra = {},
  visualChangeReasons = [],
  visualChanged = false,
} = {}) => {
  if (debugVisualProbe) {
    return {
      after300,
      after1200,
      before,
      ...extra,
      visualChangeReasons,
      visualChanged,
    };
  }

  return {
    after300: after300 ? compressVisualSnapshot(after300) : null,
    after1200: after1200 ? compressVisualSnapshot(after1200) : null,
    before: before ? compressVisualSnapshot(before) : null,
    ...extra,
    visualChangeReasons,
    visualChanged,
  };
};

const selectProductionReplayResolution = (instantResolution, stabilizedResolution) => {
  if (stabilizedResolution) {
    return {
      playTargetSelectionPhase: "stabilized",
      selectedResolution: stabilizedResolution,
    };
  }

  return {
    playTargetSelectionPhase: "instant",
    selectedResolution: instantResolution,
  };
};

const shouldBlockPayloadForDiscoveryRisk = (resolution) =>
  Boolean(
    resolution?.scene != null
    && resolution?.hasQualifiedDiscoverySource !== true
    && (
      (resolution?.rankedTargets?.length || 0) > 0
      || resolution?.candidateSpaceTooNarrow
      || resolution?.discoveryEmptyAfterBlacklist
    ),
  );

const derivePrimaryRisk = ({
  payloadShapeAfter = null,
  resolution,
  status = null,
  visualChanged = null,
} = {}) => {
  if (!resolution?.selectedTarget) {
    return resolution?.scene == null
      ? "runtime-not-ready-for-scene-scan"
      : "target-discovery-empty";
  }

  if (
    resolution?.bridgeStatus === "target-discovery-empty-after-blacklist"
    || resolution?.bridgeStatus === "candidate-space-too-narrow"
    || resolution?.candidateSpaceTooNarrow
    || resolution?.discoveryEmptyAfterBlacklist
  ) {
    return "candidate-discovery-risk";
  }

  if (!resolution?.playTarget) {
    return "target-selection-risk";
  }

  if (
    payloadShapeAfter
    && (
      payloadShapeAfter.kind === "unknown"
      || payloadShapeAfter.hasMapId !== true
      || payloadShapeAfter.hasBattleResult !== true
    )
  ) {
    return "payload-shape-risk";
  }

  if (
    status === "played-via-production-bridge-but-no-visual-change"
    || visualChanged === false
  ) {
    return "visual-side-effect-missing";
  }

  return null;
};

const inspect = () => {
  const { gameWindow, source } = findGameWindow(window);
  const loaderInfo = detectLoaderFamily(gameWindow);
  updateRuntimeBootState(gameWindow, { phase: "inspect" });
  const payloadShapeDefault = inspectPayloadShape(getDefaultReplayPayload());
  const instantResolution = resolveProductionReplayPlayTarget(gameWindow, {
    mode: "instant",
    payloadShape: payloadShapeDefault,
  });
  const stabilizedResolution = resolveProductionReplayPlayTarget(gameWindow, {
    mode: "stabilized",
    payloadShape: payloadShapeDefault,
  });
  const selection = selectProductionReplayResolution(
    instantResolution,
    stabilizedResolution,
  );
  const resolution = selection.selectedResolution;
  return {
    interactionTraceCandidates: resolution.interactionTraceCandidates,
    buttonHandlerCandidates: resolution.buttonHandlerCandidates,
    lastClickContext: resolution.lastClickContext,
    replayLikeButtonTexts: resolution.replayLikeButtonTexts,
    replayLikeCustomEventData: resolution.replayLikeCustomEventData,
    candidateDiscoverySources: resolution.candidateDiscoverySources,
    bridgeStatus: resolution.bridgeStatus,
    candidateSpaceTooNarrow: resolution.candidateSpaceTooNarrow,
    targetDiscoverySummary: resolution.targetDiscoverySummary,
    primaryRisk: derivePrimaryRisk({
      payloadShapeAfter: payloadShapeDefault,
      resolution,
    }),
    availableGlobals: resolution.availableGlobals,
    currentAssetPath: loaderInfo.suspectedBundlePath,
    gameWindowSource: source,
    incompatibleProbes:
      loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC
        ? [...SOURCE_MODULE_IDS]
        : [],
    loaderFamily: loaderInfo.loaderFamily,
    loaderFamilyEvidence: loaderInfo.evidence,
    minimumPlayableScore: resolution.minimumPlayableScore,
    payloadShapeDefault,
    playMethodCandidates: resolution.playMethodCandidates,
    playTargetLabel: resolution.playTargetLabel,
    playTargetScore: resolution.playTargetScore,
    playTargetSelectionPhase: selection.playTargetSelectionPhase,
    playTargetSource: resolution.playTargetSource,
    playTargetWhy: resolution.playTargetWhy,
    targetBlacklisted: resolution.targetBlacklisted,
    targetDiscoverySummary: resolution.targetDiscoverySummary,
    targetLooksGetterLike: resolution.targetLooksGetterLike,
    targetLooksMetadataLike: resolution.targetLooksMetadataLike,
    targetRejectedReason: resolution.targetRejectedReason,
    probeCompatibility: "compatible-probe",
    probeFamily: PROBE_FAMILIES.PRODUCTION,
    rankedTargets: resolution.rankedTargets,
    replayLikeNodeContexts: resolution.replayLikeNodeContexts,
    rankedTargetsInstant: instantResolution.rankedTargets,
    rankedTargetsStabilized: stabilizedResolution?.rankedTargets || [],
    requireFingerprint: loaderInfo.requireFingerprint,
    runtimeBootState: PROBE_RUNTIME_STATE.runtimeBootState,
    runtimeBootWaitResult: PROBE_RUNTIME_STATE.runtimeBootWaitResult,
    scene: resolution.scene,
    sceneCandidateCount: resolution.sceneCandidateCount,
    sceneScanBlockedReason: resolution.sceneScanBlockedReason,
    sceneComponentMatches: resolution.sceneComponentMatches,
    sceneNodeMatches: resolution.sceneNodeMatches,
    scriptUrls: loaderInfo.scriptUrls,
    sourceIdProbes:
      loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC
        ? buildSourceIdProbeMismatchMap(loaderInfo.loaderFamily)
        : {},
    suspectedBundlePath: loaderInfo.suspectedBundlePath,
    performanceUrls: loaderInfo.performanceUrls,
    globalCandidateCount: resolution.globalCandidateCount,
    visualProbeCapabilities: getVisualProbeCapabilities(gameWindow),
  };
};

const play = async (
  rawOrWrappedData = getDefaultReplayPayload(),
  options = {},
) => {
  const { gameWindow } = findGameWindow(window);
  const loaderInfo = detectLoaderFamily(gameWindow);

  if (loaderInfo.loaderFamily === LOADER_FAMILIES.PUBLIC) {
    await ensureProductionRuntimeProbeReady(gameWindow);
    updateRuntimeBootState(gameWindow, { phase: "play" });
    const payloadShapeBefore = inspectPayloadShape(rawOrWrappedData);
    const instantResolution = resolveProductionReplayPlayTarget(gameWindow, {
      mode: "instant",
      payloadShape: payloadShapeBefore,
    });
    const stabilizedResolution = resolveProductionReplayPlayTarget(gameWindow, {
      mode: "stabilized",
      payloadShape: payloadShapeBefore,
    });
    const selection = selectProductionReplayResolution(
      instantResolution,
      stabilizedResolution,
    );
    const resolution = selection.selectedResolution;
    const before = snapshotVisualState(gameWindow);

    if (shouldBlockPayloadForDiscoveryRisk(resolution)) {
      return {
        ok: false,
        status: "target-discovery-empty-after-blacklist",
        buttonHandlerCandidates: resolution.buttonHandlerCandidates,
        candidateDiscoverySources: resolution.candidateDiscoverySources,
        candidateSpaceTooNarrow: resolution.candidateSpaceTooNarrow,
        loaderFamily: loaderInfo.loaderFamily,
        detail: getProductionReplayTargetGateDetail({
          ...resolution,
          bridgeStatus: "target-discovery-empty-after-blacklist",
        }),
        interactionTraceCandidates: resolution.interactionTraceCandidates,
        lastClickContext: resolution.lastClickContext,
        optionsMerge: null,
        payloadShapeAfter: null,
        payloadShapeBefore,
        playTargetLabel: resolution.playTargetLabel,
        playTargetScore: resolution.playTargetScore,
        playTargetSelectionPhase: selection.playTargetSelectionPhase,
        playTargetSource: resolution.playTargetSource,
        playTargetWhy: resolution.playTargetWhy,
        targetBlacklisted: resolution.targetBlacklisted,
        targetDiscoverySummary: {
          ...resolution.targetDiscoverySummary,
          status: "target-discovery-empty-after-blacklist",
        },
        targetLooksGetterLike: resolution.targetLooksGetterLike,
        targetLooksMetadataLike: resolution.targetLooksMetadataLike,
        targetRejectedReason: resolution.targetRejectedReason,
        minimumPlayableScore: resolution.minimumPlayableScore,
        primaryRisk: "candidate-discovery-risk",
        rankedTargets: resolution.rankedTargets,
        replayLikeButtonTexts: resolution.replayLikeButtonTexts,
        replayLikeCustomEventData: resolution.replayLikeCustomEventData,
        replayLikeNodeContexts: resolution.replayLikeNodeContexts,
        rankedTargetsInstant: instantResolution.rankedTargets,
        rankedTargetsStabilized: stabilizedResolution?.rankedTargets || [],
        runtimeBootState: PROBE_RUNTIME_STATE.runtimeBootState,
        runtimeBootWaitResult: PROBE_RUNTIME_STATE.runtimeBootWaitResult,
        sceneCandidateCount: resolution.sceneCandidateCount,
        sceneScanBlockedReason: resolution.sceneScanBlockedReason,
        globalCandidateCount: resolution.globalCandidateCount,
        visualPostCheck: buildVisualPostCheck({
          before,
          debugVisualProbe: options.debugVisualProbe === true,
          extra: {
            skipped: "no-playable-target-after-discovery",
          },
          visualChangeReasons: ["no-playable-target-after-discovery"],
          visualChanged: false,
        }),
      };
    }

    if (!resolution.selectedTarget) {
      return {
        ok: false,
        status: "bridge-exposed-but-play-target-missing",
        buttonHandlerCandidates: resolution.buttonHandlerCandidates,
        candidateDiscoverySources: resolution.candidateDiscoverySources,
        candidateSpaceTooNarrow: resolution.candidateSpaceTooNarrow,
        loaderFamily: loaderInfo.loaderFamily,
        detail: getProductionReplayTargetGateDetail(resolution),
        interactionTraceCandidates: resolution.interactionTraceCandidates,
        lastClickContext: resolution.lastClickContext,
        optionsMerge: null,
        payloadShapeAfter: null,
        payloadShapeBefore,
        playTargetLabel: null,
        playTargetScore: null,
        playTargetSelectionPhase: selection.playTargetSelectionPhase,
        playTargetSource: null,
        playTargetWhy: [],
        targetBlacklisted: false,
        targetDiscoverySummary: resolution.targetDiscoverySummary,
        targetLooksGetterLike: false,
        targetLooksMetadataLike: false,
        targetRejectedReason: null,
        minimumPlayableScore: resolution.minimumPlayableScore,
        primaryRisk: derivePrimaryRisk({
          payloadShapeAfter: null,
          resolution,
        }),
        rankedTargets: resolution.rankedTargets,
        replayLikeButtonTexts: resolution.replayLikeButtonTexts,
        replayLikeCustomEventData: resolution.replayLikeCustomEventData,
        replayLikeNodeContexts: resolution.replayLikeNodeContexts,
        rankedTargetsInstant: instantResolution.rankedTargets,
        rankedTargetsStabilized: stabilizedResolution?.rankedTargets || [],
        runtimeBootState: PROBE_RUNTIME_STATE.runtimeBootState,
        runtimeBootWaitResult: PROBE_RUNTIME_STATE.runtimeBootWaitResult,
        sceneCandidateCount: resolution.sceneCandidateCount,
        sceneScanBlockedReason: resolution.sceneScanBlockedReason,
        globalCandidateCount: resolution.globalCandidateCount,
        visualPostCheck: buildVisualPostCheck({
          before,
          debugVisualProbe: options.debugVisualProbe === true,
          extra: {
            skipped: "no-play-target",
          },
          visualChangeReasons: ["no-play-target"],
          visualChanged: false,
        }),
      };
    }

    if (!resolution.playTarget) {
      const discoverySkipped = (
        resolution.bridgeStatus === "target-discovery-empty-after-blacklist"
        || resolution.bridgeStatus === "candidate-space-too-narrow"
      );
      const skipped = discoverySkipped
        ? "no-playable-target-after-discovery"
        : resolution.targetBlacklisted
          ? "target-blacklisted"
          : resolution.bridgeStatus === "bridge-target-selected-but-not-playlike"
            ? "target-selected-but-not-playlike"
            : "target-low-confidence";
      return {
        ok: false,
        status: resolution.bridgeStatus,
        buttonHandlerCandidates: resolution.buttonHandlerCandidates,
        candidateDiscoverySources: resolution.candidateDiscoverySources,
        candidateSpaceTooNarrow: resolution.candidateSpaceTooNarrow,
        loaderFamily: loaderInfo.loaderFamily,
        detail: getProductionReplayTargetGateDetail(resolution),
        interactionTraceCandidates: resolution.interactionTraceCandidates,
        lastClickContext: resolution.lastClickContext,
        optionsMerge: null,
        payloadShapeAfter: null,
        payloadShapeBefore,
        playTargetLabel: resolution.playTargetLabel,
        playTargetScore: resolution.playTargetScore,
        playTargetSelectionPhase: selection.playTargetSelectionPhase,
        playTargetSource: resolution.playTargetSource,
        playTargetWhy: resolution.playTargetWhy,
        targetBlacklisted: resolution.targetBlacklisted,
        targetDiscoverySummary: resolution.targetDiscoverySummary,
        targetLooksGetterLike: resolution.targetLooksGetterLike,
        targetLooksMetadataLike: resolution.targetLooksMetadataLike,
        targetRejectedReason: resolution.targetRejectedReason,
        minimumPlayableScore: resolution.minimumPlayableScore,
        primaryRisk: derivePrimaryRisk({
          payloadShapeAfter: null,
          resolution,
        }),
        rankedTargets: resolution.rankedTargets,
        replayLikeButtonTexts: resolution.replayLikeButtonTexts,
        replayLikeCustomEventData: resolution.replayLikeCustomEventData,
        replayLikeNodeContexts: resolution.replayLikeNodeContexts,
        rankedTargetsInstant: instantResolution.rankedTargets,
        rankedTargetsStabilized: stabilizedResolution?.rankedTargets || [],
        runtimeBootState: PROBE_RUNTIME_STATE.runtimeBootState,
        runtimeBootWaitResult: PROBE_RUNTIME_STATE.runtimeBootWaitResult,
        sceneCandidateCount: resolution.sceneCandidateCount,
        sceneScanBlockedReason: resolution.sceneScanBlockedReason,
        globalCandidateCount: resolution.globalCandidateCount,
        visualPostCheck: buildVisualPostCheck({
          before,
          debugVisualProbe: options.debugVisualProbe === true,
          extra: {
            skipped,
          },
          visualChangeReasons: [skipped],
          visualChanged: false,
        }),
      };
    }

    const preparedPayload = prepareProductionReplayPayload(rawOrWrappedData, options);
    const payloadShapeAfter = inspectPayloadShape(preparedPayload.payload);

    try {
      const result = await Promise.resolve(
        resolution.playTarget.invoke(preparedPayload.payload, options),
      );
      await sleep(300);
      const after300 = snapshotVisualState(gameWindow);
      await sleep(900);
      const after1200 = snapshotVisualState(gameWindow);
      const visualChange = deriveVisualChange(before, after300, after1200);
      const status = visualChange.visualChanged
        ? "played-via-production-bridge-and-visual-changed"
        : "played-via-production-bridge-but-no-visual-change";

      return {
        ok: true,
        status,
        buttonHandlerCandidates: resolution.buttonHandlerCandidates,
        candidateDiscoverySources: resolution.candidateDiscoverySources,
        candidateSpaceTooNarrow: resolution.candidateSpaceTooNarrow,
        interactionTraceCandidates: resolution.interactionTraceCandidates,
        lastClickContext: resolution.lastClickContext,
        loaderFamily: loaderInfo.loaderFamily,
        optionsMerge: preparedPayload.optionsMerge,
        payloadShapeAfter,
        payloadShapeBefore,
        playTargetLabel: resolution.playTargetLabel,
        playTargetScore: resolution.playTargetScore,
        playTargetSelectionPhase: selection.playTargetSelectionPhase,
        playTargetSource: resolution.playTargetSource,
        playTargetWhy: resolution.playTargetWhy,
        targetBlacklisted: resolution.targetBlacklisted,
        targetDiscoverySummary: resolution.targetDiscoverySummary,
        targetLooksGetterLike: resolution.targetLooksGetterLike,
        targetLooksMetadataLike: resolution.targetLooksMetadataLike,
        targetRejectedReason: resolution.targetRejectedReason,
        minimumPlayableScore: resolution.minimumPlayableScore,
        rankedTargets: resolution.rankedTargets,
        replayLikeButtonTexts: resolution.replayLikeButtonTexts,
        replayLikeCustomEventData: resolution.replayLikeCustomEventData,
        replayLikeNodeContexts: resolution.replayLikeNodeContexts,
        rankedTargetsInstant: instantResolution.rankedTargets,
        rankedTargetsStabilized: stabilizedResolution?.rankedTargets || [],
        result,
        runtimeBootState: PROBE_RUNTIME_STATE.runtimeBootState,
        runtimeBootWaitResult: PROBE_RUNTIME_STATE.runtimeBootWaitResult,
        sceneCandidateCount: resolution.sceneCandidateCount,
        sceneScanBlockedReason: resolution.sceneScanBlockedReason,
        globalCandidateCount: resolution.globalCandidateCount,
        visualPostCheck: buildVisualPostCheck({
          after300,
          after1200,
          before,
          debugVisualProbe: options.debugVisualProbe === true,
          visualChangeReasons: visualChange.visualChangeReasons,
          visualChanged: visualChange.visualChanged,
        }),
        primaryRisk: derivePrimaryRisk({
          payloadShapeAfter,
          resolution,
          status,
          visualChanged: visualChange.visualChanged,
        }),
      };
    } catch (error) {
      return {
        ok: false,
        status: "bridge-play-target-threw",
        buttonHandlerCandidates: resolution.buttonHandlerCandidates,
        candidateDiscoverySources: resolution.candidateDiscoverySources,
        candidateSpaceTooNarrow: resolution.candidateSpaceTooNarrow,
        interactionTraceCandidates: resolution.interactionTraceCandidates,
        lastClickContext: resolution.lastClickContext,
        loaderFamily: loaderInfo.loaderFamily,
        errorMessage: error?.message || String(error),
        optionsMerge: preparedPayload.optionsMerge,
        payloadShapeAfter,
        payloadShapeBefore,
        playTargetLabel: resolution.playTargetLabel,
        playTargetScore: resolution.playTargetScore,
        playTargetSelectionPhase: selection.playTargetSelectionPhase,
        playTargetSource: resolution.playTargetSource,
        playTargetWhy: resolution.playTargetWhy,
        targetBlacklisted: resolution.targetBlacklisted,
        targetDiscoverySummary: resolution.targetDiscoverySummary,
        targetLooksGetterLike: resolution.targetLooksGetterLike,
        targetLooksMetadataLike: resolution.targetLooksMetadataLike,
        targetRejectedReason: resolution.targetRejectedReason,
        minimumPlayableScore: resolution.minimumPlayableScore,
        primaryRisk: derivePrimaryRisk({
          payloadShapeAfter,
          resolution,
        }),
        rankedTargets: resolution.rankedTargets,
        replayLikeButtonTexts: resolution.replayLikeButtonTexts,
        replayLikeCustomEventData: resolution.replayLikeCustomEventData,
        replayLikeNodeContexts: resolution.replayLikeNodeContexts,
        rankedTargetsInstant: instantResolution.rankedTargets,
        rankedTargetsStabilized: stabilizedResolution?.rankedTargets || [],
        runtimeBootState: PROBE_RUNTIME_STATE.runtimeBootState,
        runtimeBootWaitResult: PROBE_RUNTIME_STATE.runtimeBootWaitResult,
        sceneCandidateCount: resolution.sceneCandidateCount,
        sceneScanBlockedReason: resolution.sceneScanBlockedReason,
        globalCandidateCount: resolution.globalCandidateCount,
        stackTop: String(error?.stack || "")
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)[1] || null,
        visualPostCheck: buildVisualPostCheck({
          before,
          debugVisualProbe: options.debugVisualProbe === true,
          extra: {
            skipped: "invoke-threw-before-post-check",
          },
          visualChangeReasons: ["invoke-threw-before-post-check"],
          visualChanged: false,
        }),
      };
    }
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
      stackTop: String(error?.stack || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)[1] || null,
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

let probePanel = null;

const ensureProbePanel = () => {
  if (probePanel) {
    return probePanel;
  }

  const host = document.getElementById("runtime-probe-host") || document.body;
  const panel = document.createElement("div");
  panel.className = "runtime-probe-panel";
  panel.innerHTML = `
    <div class="runtime-probe-actions">
      <button type="button" data-action="inspect">Inspect</button>
      <button type="button" data-action="play">Play window.__REPLAY_DATA__</button>
    </div>
    <pre class="runtime-probe-output" data-output="main">Waiting for bridge...</pre>
    <div class="runtime-probe-console">
      <code>window.__xyzwReplayBridge.inspect()</code>
      <code>await window.__xyzwReplayBridge.play(window.__REPLAY_DATA__)</code>
      <code>await window.__xyzwReplayBridge.play(window.__REPLAY_DATA__, { debugVisualProbe: true })</code>
      <code>window.__xyzwReplayBridge.traceUiReplayHandlers({ captureAllClicks: true })</code>
    </div>
  `;
  host.appendChild(panel);
  probePanel = panel;
  return probePanel;
};

const renderProbeOutput = (value, label) => {
  const panel = ensureProbePanel();
  const output = panel.querySelector('[data-output="main"]');
  if (!output) {
    return;
  }
  output.textContent = `${label}\n${JSON.stringify(value, null, 2)}`;
};

const attachProbeUiHandlers = (bridge) => {
  const panel = ensureProbePanel();
  const inspectButton = panel.querySelector('[data-action="inspect"]');
  const playButton = panel.querySelector('[data-action="play"]');

  inspectButton?.addEventListener("click", () => {
    const result = bridge.inspect();
    console.log("[xyzw replay] inspect()", result);
    renderProbeOutput(result, "inspect()");
  });

  playButton?.addEventListener("click", async () => {
    const result = await bridge.play(window.__REPLAY_DATA__, {
      debugVisualProbe: true,
    });
    console.log("[xyzw replay] play(window.__REPLAY_DATA__)", result);
    renderProbeOutput(result, "await play(window.__REPLAY_DATA__)");
  });
};

const attachBridge = async () => {
  await ensureRuntimeLoaded();
  PROBE_RUNTIME_STATE.attachedAt = Date.now();
  const bridge = {
    __xyzwReplayBridgeReady: true,
    inspect,
    play,
    traceUiReplayHandlers,
  };
  window.__xyzwReplayBridge = bridge;
  window.__xyzwReplay = bridge;
  const initialGameWindow = findGameWindow(window).gameWindow || window;
  updateRuntimeBootState(initialGameWindow, { phase: "attach" });
  PROBE_RUNTIME_STATE.runtimeBootPromise = waitForProductionRuntimeSignal(initialGameWindow)
    .catch((error) => {
      PROBE_RUNTIME_STATE.runtimeBootWaitResult = {
        attempts: 0,
        errorMessage: error?.message || String(error),
        hasGameCanvas: false,
        scene: null,
        status: "wait-error",
        visibleCanvasCount: 0,
        waitedMs: 0,
      };
      return PROBE_RUNTIME_STATE.runtimeBootWaitResult;
    });
  attachProbeUiHandlers(bridge);
  const result = inspect();
  console.log("[xyzw replay] public replay bridge attached", result);
  renderProbeOutput(result, "inspect() auto-run");
  return bridge;
};

window.__xyzwReplayBridgeReadyPromise = attachBridge();
