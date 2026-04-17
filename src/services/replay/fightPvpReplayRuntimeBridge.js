import {
  ensureXyzwRuntimeLoaded,
  XYZW_RUNTIME_VARIANTS,
} from "./xyzwRuntimeLoader.js";
import {
  detectLoaderFamily as detectLoaderFamilyShared,
  detectXyzwRuntimeLayer as detectXyzwRuntimeLayerShared,
  ensureXyzwGameBundleReady as ensureXyzwGameBundleReadyShared,
  getLiveRequire,
  inspectBundleState as inspectBundleStateShared,
  inspectLoaderFamily as inspectLoaderFamilyShared,
  probeXyzwRuntimeModule,
  recordXyzwBundleEvent,
  recordXyzwRunSceneCall,
  recordXyzwRuntimeScriptEvent,
  rememberLauncherRequireRef,
  trackXyzwBundlePromise,
  trackXyzwTryLoadAssetPromise,
  waitForBattleModulesReady as waitForBattleModulesReadyShared,
} from "./xyzwReplayRuntimeLayer.js";
import {
  convertLegacyFightPvpReplayPayload,
  isLegacyFightPvpReplayPayload,
} from "./fightPvpBattleInputAdapter.js";
import {
  buildFightPvpBattleInputMissingMessage,
  createFightPvpExactBattleInput,
  getFightPvpBattleInputMissingFields,
  getFightPvpReplayBattleVersion,
  rehydrateFightPvpBattleInputSnapshot,
  summarizeFightPvpBattleInput,
} from "./fightPvpExactBattleInput.js";
import {
  FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID,
  FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID_SOURCE,
} from "./fightPvpRuntimeRoleMapIdResolver.js";

const BOOT_TIMEOUT_MS = 2500;
const GAME_SCENE_LOAD_TIMEOUT_MS = 35000;
const POLL_INTERVAL_MS = 50;
const REPLAY_START_TIMEOUT_MS = 2500;
const BOOTSTRAP_SCENE_NAME = "FightPvpReplayBootstrap";
const GAME_SCENE_NAME = "Game";
const REPLAY_AUXILIARY_SCRIPT_ATTR = "data-fight-pvp-replay-aux-script";
const REPLAY_PROBE_REQUEST_HEADER = "x-fight-pvp-replay-probe";
const REPLAY_OBSERVED_ASSET_PREFIXES = Object.freeze([
  "/assets/game/",
  "/assets/main/",
  "/assets/internal/",
  "/assets/TEST_REMOTE_MODULE/",
]);
const REPLAY_AUXILIARY_SCRIPT_URLS = Object.freeze([
  "/assets/main/index.js",
  "/assets/TEST_REMOTE_MODULE/index.js",
]);
const REPLAY_AUXILIARY_REQUIRED_MODULES = Object.freeze([
  "ConfigsExt",
  "@jimu/basis",
  "@jimu/ecs",
  "@o4e/core",
  "@o4e/cc-mobx",
  "ts-md5",
  "@o4e/bon",
]);
const REPLAY_AUXILIARY_MODULE_ALIASES = Object.freeze({
  "ConfigsExt": [
    "../../../launcher/config/ConfigsExt",
    "../../../../../launcher/config/ConfigsExt",
  ],
  "LanguageExt": [
    "../../../config/extensions/LanguageExt",
    "../../../../config/extensions/LanguageExt",
    "../../../../../config/extensions/LanguageExt",
    "../../../extras/config/extensions/LanguageExt",
    "../../../../extras/config/extensions/LanguageExt",
    "../../../../../extras/config/extensions/LanguageExt",
  ],
  "consts": [
    "../consts/consts",
    "../../../consts/consts",
    "../../../extras/consts/consts",
    "../../../../extras/consts/consts",
    "../../../../../extras/consts/consts",
  ],
  "data-index": [
    "../orange/generated/data-index",
    "../../orange/generated/data-index",
    "../../../orange/generated/data-index",
    "../../../../orange/generated/data-index",
    "../../../../../orange/generated/data-index",
    "../../../extras/orange/generated/data-index",
    "../../../../extras/orange/generated/data-index",
    "../../../../../extras/orange/generated/data-index",
  ],
  "random-lcg": [
    "../random/random-lcg",
    "../../random/random-lcg",
    "../../../random/random-lcg",
    "../../../../random/random-lcg",
    "../../../../../random/random-lcg",
    "../../../extras/battle/basis/random/random-lcg",
    "../../../../extras/battle/basis/random/random-lcg",
    "../../../../../extras/battle/basis/random/random-lcg",
  ],
});
const REPLAY_AUXILIARY_SOURCE_URLS = Object.freeze([
  "/xyzw/index.js",
  "/assets/main/index.js",
  "/assets/TEST_REMOTE_MODULE/index.js",
]);
const REPLAY_VM2_SHIM_KEY = "VM2_INTERNAL_STATE_DO_NOT_USE_OR_PROGRAM_WILL_FAIL";

const toErrorMessage = (error, fallback) =>
  error?.message || String(error || fallback || "Unknown error");

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

const toSafeModuleKeys = (value) => {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return [];
  }

  try {
    return Object.keys(value).slice(0, 40);
  } catch {
    return [];
  }
};

const isMissingModuleError = (message) =>
  /cannot find module|module not found|cannot find/i.test(String(message || ""));

const readRequireResultModule = (result) =>
  result?.ok ? result.module : null;

const getReplayAuxiliaryModuleCandidates = (moduleName) => {
  const normalizedName = String(moduleName || "").trim();
  const candidates = new Set();
  if (normalizedName) {
    candidates.add(normalizedName);
  }
  for (const alias of REPLAY_AUXILIARY_MODULE_ALIASES[normalizedName] || []) {
    if (alias) {
      candidates.add(alias);
    }
  }
  return [...candidates];
};

export const resolveReplayAuxiliaryModuleRegistration = ({
  runtimeRequire,
  moduleName,
} = {}) => {
  const candidates = getReplayAuxiliaryModuleCandidates(moduleName);
  let lastError = null;

  if (typeof runtimeRequire !== "function") {
    return {
      ok: false,
      candidates,
      error: new TypeError("XYZW runtime require is unavailable."),
      resolvedName: null,
      value: null,
    };
  }

  for (const candidate of candidates) {
    try {
      return {
        ok: true,
        candidates,
        error: null,
        resolvedName: candidate,
        value: runtimeRequire(candidate),
      };
    } catch (error) {
      lastError = error;
    }
  }

  return {
    ok: false,
    candidates,
    error: lastError,
    resolvedName: null,
    value: null,
  };
};

const getRuntimeWindow = () => {
  if (typeof window === "undefined") {
    throw new TypeError("Replay runtime is only available in the browser.");
  }
  return window;
};

const formatReplayGameWindowSourceLabel = (source) =>
  !source || source === "window"
    ? "window"
    : `${source}.contentWindow`;

const formatReplayRequireCallLabel = (source, moduleId) =>
  `${formatReplayGameWindowSourceLabel(source)}.__require("${moduleId}")`;

const formatReplayEntrypointLabel = (source, moduleId, propertyPath) =>
  `${formatReplayRequireCallLabel(source, moduleId)}.${propertyPath}`;

const REPLAY_GAME_BUNDLE_READY_ATTEMPTS = 30;
const REPLAY_GAME_BUNDLE_READY_INTERVAL_MS = 100;
const REPLAY_GAME_BUNDLE_READY_MODULE_ID = "BattleUIManager";
const REPLAY_LOADER_NOT_READY_DETAIL
  = "current window.__require is not exposing the canonical battle modules yet";
const REPLAY_CANONICAL_MODULE_IDS = Object.freeze([
  "BattleUIManager",
  "enter-oss",
  "BattleKitCrossSite",
]);
const REPLAY_CANONICAL_MODULE_ID_SET = new Set(REPLAY_CANONICAL_MODULE_IDS);
const REPLAY_LOADER_FAMILIES = Object.freeze({
  SRC: "src-xyzw-loader",
  PUBLIC: "public-xyzw-loader",
  UNKNOWN: "unknown-loader",
});
const REPLAY_PROBE_FAMILIES = Object.freeze({
  SOURCE: "source-id-probes",
  PRODUCTION: "production-id-probes",
});

export const detectXyzwRuntimeLayer = detectXyzwRuntimeLayerShared;
export const detectLoaderFamily = detectLoaderFamilyShared;
export const inspectBundleState = inspectBundleStateShared;
export const inspectLoaderFamily = inspectLoaderFamilyShared;
export const ensureXyzwGameBundleReady = ensureXyzwGameBundleReadyShared;
export const waitForBattleModulesReady = waitForBattleModulesReadyShared;

const buildRuntimeLayerDetail = (runtimeLayerInfo) => {
  switch (runtimeLayerInfo?.layer) {
    case "launcher-ready":
      return "launcher/main loader is live, but no stable replay bridge has been confirmed yet.";
    case "game-scene-running":
      return "Game scene handoff is complete, but the runtime still needs a compatible replay probe family or bridge.";
    case "loader-family-mismatch":
      return "The live loader family does not match the current probe family, so source-era module ids are incompatible here.";
    case "module-id-family-mismatch":
      return "The requested source-era module id is incompatible with the current loader family.";
    case "bridge-not-exposed":
      return "The production/public loader is live, but no stable replay bridge has been exposed yet.";
    case "require-exec-error":
      return "window.__require(moduleId) reached the live loader, but module execution threw a real runtime exception.";
    case "battle-modules-ready":
      return runtimeLayerInfo?.details?.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
        ? "A production/public replay bridge is exposed and can be used as the replay entrypoint."
        : "The source-era battle modules are available and the replay entrypoint can be called.";
    case "no-require":
      return "gameWindow.__require is unavailable.";
    case "no-window":
      return "game window is unavailable.";
    default:
      return REPLAY_LOADER_NOT_READY_DETAIL;
  }
};

const REPLAY_PRODUCTION_BRIDGE_STATE_KEY = "__xyzwReplayProductionBridgeState";
const GENERIC_OWNER_RE = /(?:^|\.)(?:window|self|top|parent|frames|document)(?:\.|$)/i;
const REPLAY_PRODUCTION_GLOBAL_KEY_LIMIT = 240;
const REPLAY_PRODUCTION_MATCH_LIMIT = 40;
const REPLAY_PRODUCTION_MEMBER_LIMIT = 12;
const REPLAY_PRODUCTION_SUMMARY_TARGET_LIMIT = 10;
const REPLAY_PRODUCTION_MINIMUM_PLAYABLE_SCORE = 60;
const REPLAY_PRODUCTION_GETTER_PREFIXES = new Set([
  "get",
  "set",
  "is",
  "has",
  "can",
  "should",
]);
const REPLAY_PRODUCTION_POSITIVE_SIGNAL_WORDS = new Set([
  "play",
  "replay",
  "playback",
]);
const REPLAY_PRODUCTION_REPLAY_SIGNAL_WORDS = new Set([
  "replay",
  "playback",
]);
const REPLAY_PRODUCTION_CONTEXT_WORDS = new Set([
  "battle",
  "fight",
  "pvp",
]);
const REPLAY_PRODUCTION_METADATA_WORDS = new Set([
  "version",
  "config",
  "state",
  "status",
  "meta",
  "metadata",
]);
const REPLAY_PRODUCTION_NEGATIVE_SIGNAL_WORDS = new Set([
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
const REPLAY_PRODUCTION_BLACKLISTED_METHODS = new Set([
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
const REPLAY_PRODUCTION_REPLAY_SPECIFIC_REASONS = new Set([
  "methodName:replay/playback",
  "functionSource:replay/playback",
  "componentName:replay/playback",
  "nodePath:replay/playback",
  "battle-context+payload-affinity",
  "source:interaction-trace",
  "source:button-click-event",
  "source:scene-context-handler",
  "context:replay-ui",
  "buttonText:replay",
  "customEventData:replay",
]);
const REPLAY_PRODUCTION_UI_CONTEXT_RE = /replay|playback|battle|fight|pvp|回放|战报|录像|对战|战斗|记录|战绩|详情|查看|历史|播放|重播/i;
const REPLAY_PRODUCTION_CONTEXT_HANDLER_NAME_PREFIXES = Object.freeze([
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
const REPLAY_PRODUCTION_DISCOVERY_SOURCE_PRIORITY = Object.freeze({
  "interaction-trace": 6,
  "button-click-event": 5,
  "scene-context-handler": 4,
  "global-object": 3,
  "global-function": 2,
  "scene-component": 1,
});
const REPLAY_PRODUCTION_DISCOVERY_RICH_SOURCES = new Set([
  "scene-context-handler",
  "button-click-event",
  "interaction-trace",
]);
const REPLAY_PRODUCTION_INTERACTION_TRACE_LIMIT = 20;
const REPLAY_PRODUCTION_BUTTON_HANDLER_LIMIT = 20;

const sortProductionDiscoverySources = (sources = []) =>
  [...new Set(Array.isArray(sources) ? sources.filter(Boolean) : [])]
    .sort((left, right) => {
      const priorityDiff = (REPLAY_PRODUCTION_DISCOVERY_SOURCE_PRIORITY[right] || 0)
        - (REPLAY_PRODUCTION_DISCOVERY_SOURCE_PRIORITY[left] || 0);
      if (priorityDiff !== 0) {
        return priorityDiff;
      }
      return String(left).localeCompare(String(right));
    });

const isReplayObjectLike = (value) =>
  Boolean(value) && (typeof value === "object" || typeof value === "function");

const hasIdentifierWord = (value, words) =>
  toIdentifierWords(value).some((entry) => {
    const normalized = entry.replace(/\d+$/g, "");
    return words.has(entry) || words.has(normalized);
  });

const hasReplaySignalText = (value) =>
  hasIdentifierWord(value, REPLAY_PRODUCTION_REPLAY_SIGNAL_WORDS);

const hasPlaySignalText = (value) =>
  hasIdentifierWord(value, REPLAY_PRODUCTION_POSITIVE_SIGNAL_WORDS);

const hasBattleContextText = (value) =>
  hasIdentifierWord(value, REPLAY_PRODUCTION_CONTEXT_WORDS);

const matchesNegativePlaySignal = (value) =>
  hasIdentifierWord(value, REPLAY_PRODUCTION_NEGATIVE_SIGNAL_WORDS);

const matchesProductionReplayUiContextText = (value) =>
  REPLAY_PRODUCTION_UI_CONTEXT_RE.test(String(value || "").trim());

const matchesProductionReplayKeyword = (value) =>
  hasPlaySignalText(value) || hasBattleContextText(value) || matchesProductionReplayUiContextText(value);

const matchesProductionContextHandlerName = (name) => {
  const normalized = String(name || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toLowerCase();
  return REPLAY_PRODUCTION_CONTEXT_HANDLER_NAME_PREFIXES.some((prefix) =>
    normalized === prefix || normalized.startsWith(prefix));
};

const isGetterLikeMethodName = (name) => {
  const words = toIdentifierWords(name);
  return words.length > 0 && REPLAY_PRODUCTION_GETTER_PREFIXES.has(words[0]);
};

const isMetadataLikeMethodName = (name) =>
  hasIdentifierWord(name, REPLAY_PRODUCTION_METADATA_WORDS);

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
  why.some((entry) => REPLAY_PRODUCTION_REPLAY_SPECIFIC_REASONS.has(entry));

const getReplayObjectName = (value) => {
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

const getReplayStackTop = (error) =>
  String(error?.stack || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)[1] || null;

const getProductionReplayBridgeState = (
  gameWindow,
  runtimeWindow = getRuntimeWindow(),
) => {
  const owner = isReplayObjectLike(gameWindow) ? gameWindow : runtimeWindow;
  const existing = owner?.[REPLAY_PRODUCTION_BRIDGE_STATE_KEY];
  if (existing && typeof existing === "object") {
    return existing;
  }
  const state = {
    interactionTrace: {
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
      lastButtonTouchContext: null,
    },
    lastInspect: null,
    playTarget: null,
  };
  Object.defineProperty(owner, REPLAY_PRODUCTION_BRIDGE_STATE_KEY, {
    configurable: true,
    enumerable: false,
    writable: true,
    value: state,
  });
  return state;
};

const visitReplayMemberHolder = (holder, names, methodSet, propertySet) => {
  if (!holder || !Array.isArray(names)) {
    return;
  }

  for (const name of names) {
    if (name === "constructor" || !matchesProductionReplayKeyword(name)) {
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
  if (!isReplayObjectLike(value)) {
    return {
      methodMatches: [],
      propertyMatches: [],
    };
  }

  const methodSet = new Set();
  const propertySet = new Set();

  try {
    visitReplayMemberHolder(
      value,
      Object.keys(value).slice(0, REPLAY_PRODUCTION_GLOBAL_KEY_LIMIT),
      methodSet,
      propertySet,
    );
  } catch {
    // Ignore dynamic host objects that throw during key enumeration.
  }

  const prototype = Object.getPrototypeOf(value);
  if (
    prototype
    && prototype !== Object.prototype
    && prototype !== Function.prototype
  ) {
    try {
      visitReplayMemberHolder(
        prototype,
        Object.getOwnPropertyNames(prototype).slice(0, REPLAY_PRODUCTION_GLOBAL_KEY_LIMIT),
        methodSet,
        propertySet,
      );
    } catch {
      // Ignore inaccessible prototype chains.
    }
  }

  return {
    methodMatches: [...methodSet].slice(0, REPLAY_PRODUCTION_MEMBER_LIMIT),
    propertyMatches: [...propertySet].slice(0, REPLAY_PRODUCTION_MEMBER_LIMIT),
  };
};

const visitProductionContextHandlerHolder = (holder, names, methodSet) => {
  if (!holder || !Array.isArray(names)) {
    return;
  }

  for (const name of names) {
    if (name === "constructor" || !matchesProductionContextHandlerName(name)) {
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

const collectProductionContextHandlerMatches = (value) => {
  if (!isReplayObjectLike(value)) {
    return [];
  }

  const methodSet = new Set();
  try {
    visitProductionContextHandlerHolder(
      value,
      Object.keys(value).slice(0, REPLAY_PRODUCTION_GLOBAL_KEY_LIMIT),
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
      visitProductionContextHandlerHolder(
        prototype,
        Object.getOwnPropertyNames(prototype).slice(0, REPLAY_PRODUCTION_GLOBAL_KEY_LIMIT),
        methodSet,
      );
    } catch {
      // Ignore inaccessible prototypes.
    }
  }

  return [...methodSet].slice(0, REPLAY_PRODUCTION_MEMBER_LIMIT);
};

const createProductionReplayTargetCandidate = ({
  buttonText = null,
  label,
  source,
  customEventData = null,
  fn = null,
  invoke,
  methodName = null,
  nodeName = null,
  nodePath = null,
  componentName = null,
  ownerKey = null,
} = {}) => ({
  arity: typeof fn === "function" ? fn.length : null,
  buttonText,
  componentName,
  customEventData,
  functionSourceSnippet: toFunctionSourceSnippet(fn),
  invoke,
  label,
  methodName,
  nodeName,
  nodePath,
  ownerKey,
  source,
});

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

const createProductionSceneNodeIndex = (scene) => {
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
    path: scene?.name || GAME_SCENE_NAME,
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
    const nodePath = current?.path || nodeName || GAME_SCENE_NAME;
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

const getProductionNodePathFromIndex = (node, sceneIndex) => {
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
  return parentSegments.length > 0 ? parentSegments.reverse().join("/") : null;
};

const collectProductionNodeTextCandidates = (node) => {
  const textSet = new Set();

  const addText = (value) => {
    const text = String(value || "").trim();
    if (text) {
      textSet.add(text);
    }
  };

  addText(node?.labelString);
  addText(node?.text);
  addText(node?._string);

  for (const component of getSceneNodeComponents(node)) {
    addText(component?.string);
    addText(component?._string);
    addText(component?.text);
    addText(component?.title);
    addText(component?.content);
    addText(component?.buttonText);
    addText(component?.label);
  }

  return [...textSet].slice(0, 6);
};

const findProductionComponentByName = (node, componentName, handlerName = null) => {
  const components = getSceneNodeComponents(node);
  const normalizeName = (value) =>
    String(value || "")
      .replace(/[^A-Za-z0-9]/g, "")
      .toLowerCase();
  const normalizedExpected = normalizeName(componentName);

  if (normalizedExpected) {
    const exactMatch = components.find((component) =>
      normalizeName(getReplayObjectName(component)) === normalizedExpected
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

const summarizeProductionReplayHandlerCandidate = (candidate, extra = {}) => ({
  buttonText: candidate?.buttonText || null,
  componentName: candidate?.componentName || null,
  customEventData: candidate?.customEventData || null,
  label: candidate?.label || null,
  methodName: candidate?.methodName || null,
  nodePath: candidate?.nodePath || null,
  source: candidate?.source || null,
  ...extra,
});

const buildProductionEventHandlerCandidate = ({
  buttonText = null,
  customEventData = null,
  handlerName = null,
  sceneIndex = null,
  source = "button-click-event",
  targetNode = null,
} = {}) => {
  const resolvedComponent = findProductionComponentByName(targetNode, null, handlerName);
  if (!resolvedComponent || typeof resolvedComponent?.[handlerName] !== "function") {
    return null;
  }

  const resolvedComponentName = getReplayObjectName(resolvedComponent) || "AnonymousComponent";
  const nodePath = getProductionNodePathFromIndex(targetNode, sceneIndex) || String(targetNode?.name || "(anonymous)");
  const method = resolvedComponent[handlerName];

  return createProductionReplayTargetCandidate({
    buttonText,
    componentName: resolvedComponentName,
    customEventData,
    fn: method,
    invoke: (payload, options = {}) =>
      resolvedComponent[handlerName].call(
        resolvedComponent,
        payload,
        options?.customEventData ?? customEventData ?? null,
      ),
    label: `${nodePath}#${resolvedComponentName}.${handlerName}`,
    methodName: handlerName,
    nodeName: String(targetNode?.name || ""),
    nodePath,
    source,
  });
};

const scanButtonClickEventCandidates = (gameWindow) => {
  const scene = gameWindow?.cc?.director?.getScene?.() || null;
  const sceneIndex = createProductionSceneNodeIndex(scene);
  const buttonHandlerCandidates = [];
  const replayLikeButtonTexts = new Set();
  const replayLikeCustomEventData = new Set();
  const targetCandidates = [];
  const seenLabels = new Set();

  for (const record of sceneIndex.records) {
    const node = record.node;
    const nodePath = record.nodePath;
    const nodeTexts = collectProductionNodeTextCandidates(node);
    const matchedButtonTexts = nodeTexts.filter(matchesProductionReplayUiContextText);
    matchedButtonTexts.forEach((entry) => replayLikeButtonTexts.add(entry));

    for (const component of getSceneNodeComponents(node)) {
      const clickEvents = Array.isArray(component?.clickEvents) ? component.clickEvents : null;
      if (!clickEvents || clickEvents.length === 0) {
        continue;
      }

      for (const clickEvent of clickEvents) {
        const handlerName = String(clickEvent?.handler || "").trim();
        if (!handlerName) {
          continue;
        }

        const customEventData = String(clickEvent?.customEventData || "").trim();
        if (matchesProductionReplayUiContextText(customEventData)) {
          replayLikeCustomEventData.add(customEventData);
        }
        const targetNode = clickEvent?.target || null;
        const targetNodePath = getProductionNodePathFromIndex(targetNode, sceneIndex);
        const componentName = String(clickEvent?.component || "");
        const replayLike = [
          nodePath,
          targetNodePath,
          componentName,
          handlerName,
          customEventData,
          ...matchedButtonTexts,
        ].some(matchesProductionReplayUiContextText);
        if (!replayLike) {
          continue;
        }

        const candidate = buildProductionEventHandlerCandidate({
          buttonText: matchedButtonTexts[0] || nodeTexts[0] || null,
          customEventData,
          handlerName,
          sceneIndex,
          source: "button-click-event",
          targetNode,
        });
        if (candidate && !seenLabels.has(candidate.label)) {
          seenLabels.add(candidate.label);
          targetCandidates.push(candidate);
        }

        if (buttonHandlerCandidates.length < REPLAY_PRODUCTION_BUTTON_HANDLER_LIMIT) {
          buttonHandlerCandidates.push({
            buttonText: matchedButtonTexts[0] || nodeTexts[0] || null,
            componentName: componentName || null,
            customEventData: customEventData || null,
            handlerName,
            nodePath,
            targetNodePath,
          });
        }
      }
    }
  }

  return {
    buttonHandlerCandidates,
    replayLikeButtonTexts: [...replayLikeButtonTexts].slice(0, REPLAY_PRODUCTION_BUTTON_HANDLER_LIMIT),
    replayLikeCustomEventData: [...replayLikeCustomEventData].slice(0, REPLAY_PRODUCTION_BUTTON_HANDLER_LIMIT),
    targetCandidates,
  };
};

const pushProductionInteractionTraceCandidate = (state, candidate) => {
  if (!candidate || state.candidates.some((entry) => entry.label === candidate.label)) {
    return;
  }
  state.candidates.push(candidate);
  if (state.candidates.length > REPLAY_PRODUCTION_INTERACTION_TRACE_LIMIT) {
    state.candidates.splice(0, state.candidates.length - REPLAY_PRODUCTION_INTERACTION_TRACE_LIMIT);
  }
};

const getProductionInteractionTraceCandidates = (state) => {
  const replayLikeButtonTexts = new Set();
  const replayLikeCustomEventData = new Set();
  const interactionTraceCandidates = state.candidates.map((candidate) => {
    if (matchesProductionReplayUiContextText(candidate?.buttonText)) {
      replayLikeButtonTexts.add(String(candidate.buttonText));
    }
    if (matchesProductionReplayUiContextText(candidate?.customEventData)) {
      replayLikeCustomEventData.add(String(candidate.customEventData));
    }
    return summarizeProductionReplayHandlerCandidate(candidate);
  });

  return {
    interactionTraceCandidates,
    replayLikeButtonTexts: [...replayLikeButtonTexts],
    replayLikeCustomEventData: [...replayLikeCustomEventData],
    targetCandidates: state.candidates.slice(0, REPLAY_PRODUCTION_INTERACTION_TRACE_LIMIT),
  };
};

const installProductionReplayInteractionTrace = (gameWindow, runtimeWindow = getRuntimeWindow()) => {
  const state = getProductionReplayBridgeState(gameWindow, runtimeWindow).interactionTrace;
  if (state.installedAt) {
    const traced = getProductionInteractionTraceCandidates(state);
    return {
      candidateCount: traced.interactionTraceCandidates.length,
      candidates: traced.interactionTraceCandidates,
      emitEventsPatched: state.emitEventsPatched,
      emitEventsSupported: state.emitEventsSupported,
      installedAt: state.installedAt,
      buttonTouchPatched: state.buttonTouchPatched,
      buttonTouchSupported: state.buttonTouchSupported,
    };
  }

  state.installedAt = Date.now();

  const eventHandlerApi = gameWindow?.cc?.Component?.EventHandler;
  if (typeof eventHandlerApi?.emitEvents === "function") {
    const originalEmitEvents = eventHandlerApi.emitEvents;
    state.emitEventsSupported = true;
    state.emitEventsPatchSource = "cc.Component.EventHandler.emitEvents";
    eventHandlerApi.emitEvents = function patchedEmitEvents(eventHandlers, ...args) {
      try {
        const scene = gameWindow?.cc?.director?.getScene?.() || null;
        const sceneIndex = createProductionSceneNodeIndex(scene);
        const buttonContext = state.lastButtonTouchContext;
        for (const eventHandler of Array.isArray(eventHandlers) ? eventHandlers : []) {
          const handlerName = String(eventHandler?.handler || "").trim();
          const targetNode = eventHandler?.target || null;
          const targetNodePath = getProductionNodePathFromIndex(targetNode, sceneIndex);
          const componentName = String(eventHandler?.component || "");
          const customEventData = String(eventHandler?.customEventData || "").trim();
          const replayLike = [
            buttonContext?.nodePath,
            buttonContext?.buttonText,
            targetNodePath,
            componentName,
            handlerName,
            customEventData,
          ].some(matchesProductionReplayUiContextText);
          if (!replayLike) {
            continue;
          }

          const candidate = buildProductionEventHandlerCandidate({
            buttonText: buttonContext?.buttonText || null,
            customEventData,
            handlerName,
            sceneIndex,
            source: "interaction-trace",
            targetNode,
          });
          pushProductionInteractionTraceCandidate(state, candidate);
        }
      } catch {
        // Ignore trace instrumentation failures.
      }
      return originalEmitEvents.call(this, eventHandlers, ...args);
    };
    state.emitEventsPatched = true;
    state.emitEventsRestore = () => {
      eventHandlerApi.emitEvents = originalEmitEvents;
    };
  }

  const buttonPrototype = gameWindow?.cc?.Button?.prototype;
  if (typeof buttonPrototype?._onTouchEnded === "function") {
    const originalOnTouchEnded = buttonPrototype._onTouchEnded;
    state.buttonTouchSupported = true;
    state.buttonTouchPatchSource = "cc.Button.prototype._onTouchEnded";
    buttonPrototype._onTouchEnded = function patchedButtonTouchEnded(...args) {
      try {
        const scene = gameWindow?.cc?.director?.getScene?.() || null;
        const sceneIndex = createProductionSceneNodeIndex(scene);
        const node = this?.node || null;
        const buttonTexts = collectProductionNodeTextCandidates(node);
        state.lastButtonTouchContext = {
          buttonText: buttonTexts.find(matchesProductionReplayUiContextText) || buttonTexts[0] || null,
          nodePath: getProductionNodePathFromIndex(node, sceneIndex),
        };
      } catch {
        state.lastButtonTouchContext = null;
      }
      return originalOnTouchEnded.apply(this, args);
    };
    state.buttonTouchPatched = true;
    state.buttonTouchRestore = () => {
      buttonPrototype._onTouchEnded = originalOnTouchEnded;
    };
  }

  const traced = getProductionInteractionTraceCandidates(state);
  return {
    candidateCount: traced.interactionTraceCandidates.length,
    candidates: traced.interactionTraceCandidates,
    emitEventsPatched: state.emitEventsPatched,
    emitEventsSupported: state.emitEventsSupported,
    installedAt: state.installedAt,
    buttonTouchPatched: state.buttonTouchPatched,
    buttonTouchSupported: state.buttonTouchSupported,
  };
};

const createSourceIdProbeMismatchMap = (loaderFamily) =>
  Object.fromEntries(
    REPLAY_CANONICAL_MODULE_IDS.map((moduleId) => [
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

const unwrapProductionReplayPayload = (value) => {
  if (!value || typeof value !== "object") {
    return value;
  }

  const unwrapped = value?.battleInputData
    || value?.battleInputSnapshot
    || value;

  if (!unwrapped || typeof unwrapped !== "object") {
    return value;
  }

  if (unwrapped.battleResult == null && unwrapped?.battleData?.result != null) {
    unwrapped.battleResult = unwrapped.battleData.result;
  }
  return unwrapped;
};

const inspectProductionReplayPayloadShape = (value) => {
  const battleData = value?.battleData
    || value?.battleInputData?.battleData
    || value?.battleInputSnapshot?.battleData
    || value?.lastBattleData
    || value?.fightRoleBase?.lastBattleData
    || null;
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
  };
};

const buildProductionReplayRankedTargets = (resolution = {}) =>
  (resolution.rankedTargets || [])
    .slice(0, REPLAY_PRODUCTION_SUMMARY_TARGET_LIMIT)
    .map((entry) => ({
      arity: entry.arity ?? null,
      componentName: entry.componentName || null,
      functionSourceSnippet: entry.functionSourceSnippet || "",
      label: entry.label || null,
      methodName: entry.methodName || null,
      nodePath: entry.nodePath || null,
      rejectedReason: entry.rejectedReason || null,
      score: entry.score ?? null,
      source: entry.source || null,
      targetBlacklisted: entry.targetBlacklisted === true,
      targetLooksGetterLike: entry.targetLooksGetterLike === true,
      targetLooksMetadataLike: entry.targetLooksMetadataLike === true,
      why: Array.isArray(entry.why) ? entry.why : [],
    }));

const getProductionReplayPrimaryRisk = ({
  payloadShapeAfter = null,
  resolution = {},
} = {}) => {
  if (!resolution.selectedTarget) {
    return resolution.scene == null
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

  if (!resolution.playTarget) {
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

  return null;
};

const getProductionReplayVisualProbeCapabilities = () => ({
  showBattleLoading: "not-found(optional)",
});

export const collectReplayGlobalCandidates = (
  gameWindow,
  {
    runtimeWindow = getRuntimeWindow(),
  } = {},
) => {
  const availableGlobals = [];
  const playMethodCandidates = [];
  const targetCandidates = [];
  const seenRoots = new Set();
  const seenGlobals = new Set();
  const seenTargets = new Set();
  const roots = [];

  const addRoot = (holder, source) => {
    if (!isReplayObjectLike(holder) || seenRoots.has(holder)) {
      return;
    }
    seenRoots.add(holder);
    roots.push({ holder, source });
  };

  addRoot(gameWindow, "gameWindow");
  addRoot(runtimeWindow, "window");
  addRoot(globalThis, "globalThis");

  for (const root of roots) {
    let keys = [];
    try {
      keys = Object.keys(root.holder).slice(0, REPLAY_PRODUCTION_GLOBAL_KEY_LIMIT);
    } catch {
      keys = [];
    }

    for (const key of keys) {
      if (
        key === "__xyzwReplayBridge"
        || key === "__xyzwReplay"
        || key === REPLAY_PRODUCTION_BRIDGE_STATE_KEY
      ) {
        continue;
      }

      let value = null;
      try {
        value = root.holder[key];
      } catch {
        value = null;
      }

      const keyMatches = matchesProductionReplayKeyword(key);
      const { methodMatches, propertyMatches } = collectReplayMemberMatches(value);

      if (!keyMatches && methodMatches.length === 0 && propertyMatches.length === 0) {
        continue;
      }

      const globalKey = `${root.source}:${key}`;
      if (!seenGlobals.has(globalKey) && availableGlobals.length < REPLAY_PRODUCTION_MATCH_LIMIT) {
        seenGlobals.add(globalKey);
        availableGlobals.push({
          key,
          keyMatched: keyMatches,
          methodMatches,
          objectType: getReplayObjectName(value),
          propertyMatches,
          source: root.source,
          type: typeof value,
        });
      }

      if (
        typeof value === "function"
        && keyMatches
        && targetCandidates.length < REPLAY_PRODUCTION_MATCH_LIMIT
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
          targetCandidates.push(createProductionReplayTargetCandidate({
            fn: value,
            label,
            source: "global-function",
            ownerKey: key,
            methodName: key,
            invoke: (payload, options = {}) => value.call(root.holder, payload, options),
          }));
        }
      }

      if (!isReplayObjectLike(value)) {
        continue;
      }

      for (const methodName of methodMatches) {
        if (targetCandidates.length >= REPLAY_PRODUCTION_MATCH_LIMIT) {
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
        targetCandidates.push(createProductionReplayTargetCandidate({
          fn: method,
          label,
          source: "global-object",
          ownerKey: key,
          methodName,
          invoke: (payload, options = {}) => value[methodName].call(value, payload, options),
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

export const scanSceneForReplayCandidates = (gameWindow) => {
  const scene = gameWindow?.cc?.director?.getScene?.() || null;
  const sceneNodeMatches = [];
  const sceneComponentMatches = [];
  const playMethodCandidates = [];
  const replayLikeNodeContexts = [];
  const targetCandidates = [];
  const seenTargets = new Set();
  const sceneIndex = createProductionSceneNodeIndex(scene);

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
    const nodeContextMatched = matchesProductionReplayUiContextText(nodeName)
      || matchesProductionReplayUiContextText(nodePath);

    if (
      matchesProductionReplayKeyword(nodeName)
      && sceneNodeMatches.length < REPLAY_PRODUCTION_MATCH_LIMIT
    ) {
      sceneNodeMatches.push({
        nodeName,
        nodePath,
      });
    }
    if (nodeContextMatched && replayLikeNodeContexts.length < REPLAY_PRODUCTION_MATCH_LIMIT) {
      replayLikeNodeContexts.push(nodePath);
    }

    for (const component of getSceneNodeComponents(node)) {
      if (!component) {
        continue;
      }

      const componentName = getReplayObjectName(component) || "AnonymousComponent";
      const componentNameMatched = matchesProductionReplayKeyword(componentName);
      const componentContextMatched = matchesProductionReplayUiContextText(componentName);
      const { methodMatches, propertyMatches } = collectReplayMemberMatches(component);
      const contextHandlerMatches = (
        nodeContextMatched || componentContextMatched
      )
        ? collectProductionContextHandlerMatches(component)
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

      if (sceneComponentMatches.length < REPLAY_PRODUCTION_MATCH_LIMIT) {
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
        && replayLikeNodeContexts.length < REPLAY_PRODUCTION_MATCH_LIMIT
      ) {
        replayLikeNodeContexts.push(`${nodePath}#${componentName}`);
      }

      const discoveredMethodNames = [...new Set([
        ...methodMatches,
        ...contextHandlerMatches,
      ])];

      for (const methodName of discoveredMethodNames) {
        if (targetCandidates.length >= REPLAY_PRODUCTION_MATCH_LIMIT) {
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
        targetCandidates.push(createProductionReplayTargetCandidate({
          componentName,
          buttonText: null,
          customEventData: null,
          fn: method,
          label,
          methodName,
          nodeName,
          nodePath,
          source,
          invoke: (payload, options = {}) => component[methodName].call(component, payload, options),
        }));
      }
    }
  }

  return {
    playMethodCandidates,
    replayLikeNodeContexts: [...new Set(replayLikeNodeContexts)].slice(0, REPLAY_PRODUCTION_MATCH_LIMIT),
    scene: scene?.name || null,
    sceneComponentMatches,
    sceneNodeMatches,
    targetCandidates,
  };
};

const isValidProductionReplayTarget = (target) =>
  Boolean(target && typeof target.invoke === "function");

const scoreProductionReplayTarget = (candidate, payloadShape = null) => {
  let score = 0;
  const why = [];
  const positiveSignals = [];
  const buttonText = String(candidate?.buttonText || "");
  const methodName = String(candidate?.methodName || "");
  const componentName = String(candidate?.componentName || "");
  const customEventData = String(candidate?.customEventData || "");
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
  const methodHasNegativeSignal = matchesNegativePlaySignal(methodName);
  const functionHasNegativeSignal = matchesNegativePlaySignal(functionSourceSnippet);
  const contextHasNegativeSignal = matchesNegativePlaySignal(
    `${componentName} ${nodeLabel} ${ownerLabel} ${buttonText} ${customEventData}`,
  );
  const replayUiContextMatched = [
    componentName,
    nodeLabel,
    buttonText,
    customEventData,
  ].some(matchesProductionReplayUiContextText);
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
    methodHasPlaySignal,
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
  const explicitlyBlacklisted = REPLAY_PRODUCTION_BLACKLISTED_METHODS.has(methodName)
    || negativeServiceTarget
    || globalEntityServiceTarget;
  const targetBlacklisted = explicitlyBlacklisted || targetLooksGetterLike;

  if (methodHasReplaySignal) {
    score += 60;
    why.push("methodName:replay/playback");
    positiveSignals.push("methodName");
  } else if (methodHasPlaySignal) {
    score += 8;
    why.push("methodName:play");
    positiveSignals.push("methodName");
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

  if (replayUiContextMatched) {
    score += 18;
    why.push("context:replay-ui");
    positiveSignals.push("context:replay-ui");
  }

  if (matchesProductionReplayUiContextText(buttonText)) {
    score += 30;
    why.push("buttonText:replay");
    positiveSignals.push("buttonText:replay");
  }

  if (matchesProductionReplayUiContextText(customEventData)) {
    score += 24;
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
    why.push(`arity:${candidate?.arity ?? "unknown"}:less-like-payload-options`);
  }

  if (candidate?.source === "interaction-trace") {
    score += 90;
    why.push("source:interaction-trace");
    positiveSignals.push("source:interaction-trace");
  } else if (candidate?.source === "button-click-event") {
    score += 72;
    why.push("source:button-click-event");
    positiveSignals.push("source:button-click-event");
  } else if (candidate?.source === "scene-context-handler") {
    score += 36;
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
      REPLAY_PRODUCTION_BLACKLISTED_METHODS.has(methodName)
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
    rejectedReason = REPLAY_PRODUCTION_BLACKLISTED_METHODS.has(methodName)
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
  } else if (score < REPLAY_PRODUCTION_MINIMUM_PLAYABLE_SCORE) {
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

const sortProductionReplayEntries = (left, right) => {
  if (right.score !== left.score) {
    return right.score - left.score;
  }

  const sourceDiff = (REPLAY_PRODUCTION_DISCOVERY_SOURCE_PRIORITY[right.candidate.source] || 0)
    - (REPLAY_PRODUCTION_DISCOVERY_SOURCE_PRIORITY[left.candidate.source] || 0);
  if (sourceDiff !== 0) {
    return sourceDiff;
  }

  return String(left.candidate.label || "").localeCompare(String(right.candidate.label || ""));
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

export const resolveProductionReplayPlayTarget = (
  gameWindow,
  {
    payloadShape = null,
    runtimeWindow = getRuntimeWindow(),
  } = {},
) => {
  const state = getProductionReplayBridgeState(gameWindow, runtimeWindow);
  const globalCandidates = collectReplayGlobalCandidates(gameWindow, { runtimeWindow });
  const sceneCandidates = scanSceneForReplayCandidates(gameWindow);
  const buttonCandidates = scanButtonClickEventCandidates(gameWindow);
  const interactionTrace = getProductionInteractionTraceCandidates(state.interactionTrace);
  const candidateTargets = [
    ...interactionTrace.targetCandidates,
    ...buttonCandidates.targetCandidates,
    ...sceneCandidates.targetCandidates,
    ...globalCandidates.targetCandidates,
  ];
  const rankedEntries = candidateTargets
    .filter(isValidProductionReplayTarget)
    .map((candidate) => ({
      candidate,
      ...scoreProductionReplayTarget(candidate, payloadShape),
    }))
    .sort(sortProductionReplayEntries);
  const playableEntries = rankedEntries.filter((entry) => !entry.targetBlacklisted && !entry.rejectedReason);
  const selectedTargetEntry = rankedEntries[0] || null;
  const candidateDiscoverySources = sortProductionDiscoverySources(
    candidateTargets.map((candidate) => candidate.source),
  );
  const replayLikeNodeContexts = [...new Set(sceneCandidates.replayLikeNodeContexts || [])];
  const replayLikeButtonTexts = [
    ...new Set([
      ...(buttonCandidates.replayLikeButtonTexts || []),
      ...(interactionTrace.replayLikeButtonTexts || []),
    ]),
  ];
  const replayLikeCustomEventData = [
    ...new Set([
      ...(buttonCandidates.replayLikeCustomEventData || []),
      ...(interactionTrace.replayLikeCustomEventData || []),
    ]),
  ];
  const serviceLikeCandidatesOnly = rankedEntries.length > 0
    && rankedEntries.every((entry) => {
      const candidateLabel = `${entry.candidate?.nodePath || ""} ${entry.candidate?.methodName || ""} ${entry.candidate?.componentName || ""}`;
      return /(?:^|\/)Global Entity(?:\/|$)/i.test(String(entry.candidate?.nodePath || ""))
        || matchesNegativePlaySignal(candidateLabel);
    });
  const candidateSpaceTooNarrow = playableEntries.length === 0
    && rankedEntries.length > 0
    && !candidateDiscoverySources.some((source) => REPLAY_PRODUCTION_DISCOVERY_RICH_SOURCES.has(source))
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
      : getProductionReplaySelectionStatus(selectedTargetEntry);
  const playTarget = bridgeStatus === "bridge-ready"
    ? selectedTargetEntry?.candidate || null
    : null;
  const rankedTargets = rankedEntries
    .slice(0, REPLAY_PRODUCTION_SUMMARY_TARGET_LIMIT)
    .map((entry) => ({
      arity: entry.candidate.arity ?? null,
      buttonText: entry.candidate.buttonText || null,
      componentName: entry.candidate.componentName || null,
      customEventData: entry.candidate.customEventData || null,
      functionSourceSnippet: entry.candidate.functionSourceSnippet || "",
      label: entry.candidate.label,
      methodName: entry.candidate.methodName || null,
      nodePath: entry.candidate.nodePath || null,
      rejectedReason: entry.rejectedReason || null,
      score: entry.score,
      source: entry.candidate.source || null,
      targetBlacklisted: entry.targetBlacklisted === true,
      targetLooksGetterLike: entry.targetLooksGetterLike === true,
      targetLooksMetadataLike: entry.targetLooksMetadataLike === true,
      why: entry.why,
    }));

  const targetDiscoverySummary = {
    buttonHandlerCandidateCount: buttonCandidates.buttonHandlerCandidates.length,
    candidateDiscoverySources,
    candidateSpaceTooNarrow,
    discoveryEmptyAfterBlacklist,
    interactionTraceCandidateCount: interactionTrace.interactionTraceCandidates.length,
    playableCandidateCount: playableEntries.length,
    rankedCandidateCount: rankedEntries.length,
    replayLikeButtonTextCount: replayLikeButtonTexts.length,
    replayLikeCustomEventDataCount: replayLikeCustomEventData.length,
    replayLikeNodeContextCount: replayLikeNodeContexts.length,
    status: bridgeStatus,
  };

  state.playTarget = playTarget;

  return {
    availableGlobals: globalCandidates.availableGlobals,
    buttonHandlerCandidates: buttonCandidates.buttonHandlerCandidates,
    bridgeStatus,
    candidateDiscoverySources,
    candidateSpaceTooNarrow,
    discoveryEmptyAfterBlacklist,
    interactionTraceCandidates: interactionTrace.interactionTraceCandidates,
    minimumPlayableScore: REPLAY_PRODUCTION_MINIMUM_PLAYABLE_SCORE,
    playMethodCandidates: [
      ...globalCandidates.playMethodCandidates,
      ...sceneCandidates.playMethodCandidates,
    ].slice(0, REPLAY_PRODUCTION_MATCH_LIMIT),
    playTarget,
    playTargetLabel: selectedTargetEntry?.candidate?.label || null,
    playTargetScore: selectedTargetEntry?.score ?? null,
    playTargetSource: selectedTargetEntry?.candidate?.source || null,
    playTargetWhy: selectedTargetEntry?.why || [],
    rankedTargets,
    replayLikeButtonTexts,
    replayLikeCustomEventData,
    replayLikeNodeContexts,
    scene: sceneCandidates.scene,
    sceneComponentMatches: sceneCandidates.sceneComponentMatches,
    sceneNodeMatches: sceneCandidates.sceneNodeMatches,
    selectedTarget: selectedTargetEntry?.candidate || null,
    targetBlacklisted: selectedTargetEntry?.targetBlacklisted === true,
    targetDiscoverySummary,
    targetLooksGetterLike: selectedTargetEntry?.targetLooksGetterLike === true,
    targetLooksMetadataLike: selectedTargetEntry?.targetLooksMetadataLike === true,
    targetRejectedReason: selectedTargetEntry?.rejectedReason || null,
  };
};

export const buildProductionReplayBridge = (
  gameWindow,
  {
    gameWindowSource = null,
    runtimeWindow = getRuntimeWindow(),
  } = {},
) => {
  const loaderFamilyInfo = detectReplayLoaderFamily(gameWindow);
  const state = getProductionReplayBridgeState(gameWindow, runtimeWindow);

  const inspect = () => {
    const payloadShapeDefault = inspectProductionReplayPayloadShape(getReplaySource(gameWindow));
    const resolution = resolveProductionReplayPlayTarget(gameWindow, {
      payloadShape: payloadShapeDefault,
      runtimeWindow,
    });
    const result = {
      interactionTraceCandidates: resolution.interactionTraceCandidates,
      buttonHandlerCandidates: resolution.buttonHandlerCandidates,
      replayLikeButtonTexts: resolution.replayLikeButtonTexts,
      replayLikeCustomEventData: resolution.replayLikeCustomEventData,
      candidateDiscoverySources: resolution.candidateDiscoverySources,
      bridgeStatus: resolution.bridgeStatus,
      candidateSpaceTooNarrow: resolution.candidateSpaceTooNarrow,
      targetDiscoverySummary: resolution.targetDiscoverySummary,
      primaryRisk: getProductionReplayPrimaryRisk({
        payloadShapeAfter: payloadShapeDefault,
        resolution,
      }),
      availableGlobals: resolution.availableGlobals,
      currentAssetPath: loaderFamilyInfo.suspectedBundlePath,
      gameWindowSource,
      incompatibleProbes:
        loaderFamilyInfo.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
          ? [...REPLAY_CANONICAL_MODULE_IDS]
          : [],
      loaderFamily: loaderFamilyInfo.loaderFamily,
      loaderFamilyEvidence: loaderFamilyInfo.evidence,
      minimumPlayableScore: resolution.minimumPlayableScore,
      payloadShapeDefault,
      playMethodCandidates: resolution.playMethodCandidates,
      playTargetLabel: resolution.playTargetLabel,
      playTargetScore: resolution.playTargetScore,
      playTargetSource: resolution.playTargetSource,
      playTargetWhy: resolution.playTargetWhy,
      probeCompatibility: "compatible-probe",
      probeFamily: REPLAY_PROBE_FAMILIES.PRODUCTION,
      rankedTargets: buildProductionReplayRankedTargets(resolution),
      replayLikeNodeContexts: resolution.replayLikeNodeContexts,
      requireFingerprint: loaderFamilyInfo.requireFingerprint,
      scene: resolution.scene,
      sceneComponentMatches: resolution.sceneComponentMatches,
      sceneNodeMatches: resolution.sceneNodeMatches,
      scriptUrls: loaderFamilyInfo.scriptUrls,
      sourceIdProbes: createSourceIdProbeMismatchMap(loaderFamilyInfo.loaderFamily),
      suspectedBundlePath: loaderFamilyInfo.suspectedBundlePath,
      targetBlacklisted: resolution.targetBlacklisted,
      targetLooksGetterLike: resolution.targetLooksGetterLike,
      targetLooksMetadataLike: resolution.targetLooksMetadataLike,
      targetRejectedReason: resolution.targetRejectedReason,
      performanceUrls: loaderFamilyInfo.performanceUrls,
      visualProbeCapabilities: getProductionReplayVisualProbeCapabilities(),
    };
    state.lastInspect = result;
    return result;
  };

  const play = (rawOrWrappedData = getReplaySource(gameWindow), options = {}) => {
    const payloadShapeBefore = inspectProductionReplayPayloadShape(rawOrWrappedData);
    const resolution = resolveProductionReplayPlayTarget(gameWindow, {
      payloadShape: payloadShapeBefore,
      runtimeWindow,
    });
    const baseFields = {
      buttonHandlerCandidates: resolution.buttonHandlerCandidates,
      candidateDiscoverySources: resolution.candidateDiscoverySources,
      candidateSpaceTooNarrow: resolution.candidateSpaceTooNarrow,
      interactionTraceCandidates: resolution.interactionTraceCandidates,
      minimumPlayableScore: resolution.minimumPlayableScore,
      payloadShapeAfter: null,
      payloadShapeBefore,
      playTargetScore: resolution.playTargetScore,
      playTargetWhy: resolution.playTargetWhy,
      primaryRisk: getProductionReplayPrimaryRisk({
        payloadShapeAfter: null,
        resolution,
      }),
      rankedTargets: buildProductionReplayRankedTargets(resolution),
      replayLikeButtonTexts: resolution.replayLikeButtonTexts,
      replayLikeCustomEventData: resolution.replayLikeCustomEventData,
      replayLikeNodeContexts: resolution.replayLikeNodeContexts,
      targetBlacklisted: resolution.targetBlacklisted,
      targetDiscoverySummary: resolution.targetDiscoverySummary,
      targetLooksGetterLike: resolution.targetLooksGetterLike,
      targetLooksMetadataLike: resolution.targetLooksMetadataLike,
      targetRejectedReason: resolution.targetRejectedReason,
      visualPostCheck: {
        skipped: "service-bridge-no-visual-probe",
      },
      visualProbeCapabilities: getProductionReplayVisualProbeCapabilities(),
    };

    if (!resolution.selectedTarget) {
      return {
        ok: false,
        status: "bridge-exposed-but-play-target-missing",
        loaderFamily: loaderFamilyInfo.loaderFamily,
        detail: getProductionReplayTargetGateDetail(resolution),
        playMethodCandidates: resolution.playMethodCandidates,
        playTargetLabel: null,
        playTargetSource: null,
        ...baseFields,
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
        detail: getProductionReplayTargetGateDetail(resolution),
        loaderFamily: loaderFamilyInfo.loaderFamily,
        playMethodCandidates: resolution.playMethodCandidates,
        playTargetLabel: resolution.playTargetLabel,
        playTargetSource: resolution.playTargetSource,
        ...baseFields,
        visualPostCheck: {
          skipped,
        },
      };
    }

    const prepared = unwrapProductionReplayPayload(rawOrWrappedData);
    const payloadShapeAfter = inspectProductionReplayPayloadShape(prepared);

    try {
      const result = resolution.playTarget.invoke(prepared, options);
      return {
        ok: true,
        status: "played-via-production-bridge",
        loaderFamily: loaderFamilyInfo.loaderFamily,
        playTargetLabel: resolution.playTargetLabel,
        playTargetSource: resolution.playTargetSource,
        result,
        ...baseFields,
        payloadShapeAfter,
        primaryRisk: getProductionReplayPrimaryRisk({
          payloadShapeAfter,
          resolution,
        }),
      };
    } catch (error) {
      return {
        ok: false,
        status: "bridge-play-target-threw",
        loaderFamily: loaderFamilyInfo.loaderFamily,
        errorMessage: toErrorMessage(error, "Production replay bridge play target threw."),
        playTargetLabel: resolution.playTargetLabel,
        playTargetSource: resolution.playTargetSource,
        stackTop: getReplayStackTop(error),
        ...baseFields,
        payloadShapeAfter,
        primaryRisk: getProductionReplayPrimaryRisk({
          payloadShapeAfter,
          resolution,
        }),
      };
    }
  };

  return {
    __xyzwReplayBridgeReady: true,
    inspect,
    play,
    traceUiReplayHandlers() {
      return installProductionReplayInteractionTrace(gameWindow, runtimeWindow);
    },
  };
};
const REPLAY_ENTRYPOINT_PROBE_CONFIGS = Object.freeze([
  {
    kind: "require-export",
    moduleId: "BattleUIManager",
    exportPath: Object.freeze(["SHOW_BATTLE_REPLAY_UI"]),
  },
  {
    kind: "require-export",
    moduleId: "BattleUIManager",
    exportPath: Object.freeze(["BattleUIManager", "instance", "showBattleReplayUI"]),
  },
  {
    kind: "require-export",
    moduleId: "enter-oss",
    exportPath: Object.freeze(["EnterOSSState", "prototype", "showBattleViewWithData"]),
  },
  {
    kind: "require-export",
    moduleId: "BattleKitCrossSite",
    exportPath: Object.freeze(["BattleKitCrossSite", "instance", "tryRaisePlayback"]),
  },
]);
const REPLAY_LEGACY_DEBUG_ITEMS = Object.freeze([
  {
    label: "require(\"BattleUIManager\")",
    moduleId: "BattleUIManager",
    status: "wrong-loader",
    detail:
      "游戏 bundle 模块应通过真实游戏 window 的 window.__require(...) 访问，而不是普通 require(...)。",
  },
  {
    label: "require(\"EnterOSSState\")",
    moduleId: "EnterOSSState",
    status: "wrong-module-id",
    detail: "EnterOSSState 不是 module id；正确 module id 是 enter-oss。",
  },
  {
    label: "require(\"BattleKitCrossSite\").instance.tryRaisePlayback",
    moduleId: "BattleKitCrossSite",
    status: "wrong-export-path",
    detail:
      "BattleKitCrossSite 的正确路径是 BattleKitCrossSite.BattleKitCrossSite.instance.tryRaisePlayback。",
  },
  {
    label: "window.BattleKitCrossSite.instance.tryRaisePlayback",
    moduleId: "BattleKitCrossSite",
    status: "wrong-export-path",
    detail:
      "BattleKitCrossSite 不是挂在 window.BattleKitCrossSite.instance 上，而是 bundle 模块导出 BattleKitCrossSite.BattleKitCrossSite.instance。",
  },
]);

export const findGameWindow = (rootWindow = null) => {
  const runtimeWindow = rootWindow || getRuntimeWindow();

  if (typeof runtimeWindow?.__require === "function") {
    return {
      gameWindow: runtimeWindow,
      source: "window",
      status: "present",
      error: null,
      checkedIframes: [],
    };
  }

  const checkedIframes = [];
  const iframes = Array.from(
    runtimeWindow?.document?.querySelectorAll?.("iframe") || [],
  );
  for (let index = 0; index < iframes.length; index += 1) {
    const source = `iframe[${index}]`;
    checkedIframes.push(source);
    try {
      const iframeWindow = iframes[index]?.contentWindow || null;
      if (typeof iframeWindow?.__require === "function") {
        return {
          gameWindow: iframeWindow,
          source,
          status: "wrong-window",
          error: null,
          checkedIframes,
        };
      }
    } catch {
      // Ignore cross-origin or detached iframe access; only same-origin runtime iframes are usable here.
    }
  }

  return {
    gameWindow: null,
    source: null,
    status: "no-require",
    error: "No game window with window.__require(...) was found.",
    checkedIframes,
  };
};

export const findReplayGameWindow = findGameWindow;

export const getReplaySource = (gameWindow) => {
  const runtimeWindow = getRuntimeWindow();
  return (
    gameWindow?.__REPLAY_DATA__
    ?? runtimeWindow.__REPLAY_DATA__
    ?? gameWindow?.__xyzwReplayData
    ?? runtimeWindow.__xyzwReplayData
    ?? null
  );
};

export const looksLikeBattleInput = (source) =>
  Boolean(
    source?.battleData
    && typeof source?.mapId !== "undefined"
    && (
      typeof source?.battleData?.leftTeam?.team?.get === "function"
      || typeof source?.battleData?.leftTeam?.team?.forEach === "function"
    )
    && (
      typeof source?.battleData?.rightTeam?.team?.get === "function"
      || typeof source?.battleData?.rightTeam?.team?.forEach === "function"
    ),
  );

const isPlainReplayOptionsObject = (value) =>
  Object.prototype.toString.call(value) === "[object Object]";

const mergeReplayProbeOptions = (target, options) => {
  if (!options || Object.keys(options).length === 0) {
    return;
  }

  if (!target.options) {
    target.options = options;
    return;
  }

  if (isPlainReplayOptionsObject(target.options)) {
    Object.assign(target.options, options);
    return;
  }

  target.__replayProbeOptions = options;
};

const applyReplayInputPassthroughFields = (inputData, source) => {
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
    if (source && source[key] != null) {
      inputData[key] = source[key];
    }
  }
};

export const ensureReplayInputData = (source, gameWindow, options = {}) => {
  if (!gameWindow) {
    throw new Error("No game window with __require found");
  }

  const req = getLiveRequire(gameWindow);

  if (looksLikeBattleInput(source)) {
    const prepared = source;
    prepared.battleResult ??= prepared.battleData?.result;
    prepared.mapId ??= 10001;
    mergeReplayProbeOptions(prepared, options);
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
  applyReplayInputPassthroughFields(inputData, source);
  inputData.mapId ??= 10001;
  inputData.battleResult ??= inputData.battleData?.result;
  mergeReplayProbeOptions(inputData, options);
  return inputData;
};

const wait = (runtimeWindow, ms) =>
  new Promise((resolve) => runtimeWindow.setTimeout(resolve, ms));

const waitForNextFrame = (runtimeWindow) =>
  new Promise((resolve) => {
    if (typeof runtimeWindow.requestAnimationFrame === "function") {
      runtimeWindow.requestAnimationFrame(() => resolve());
      return;
    }
    runtimeWindow.setTimeout(resolve, 16);
  });

const isAbsoluteUrlLike = (value) =>
  /^(?:[a-z]+:)?\/\//i.test(String(value || "").trim());

const toFiniteNumber = (value) => {
  if (value && typeof value === "object" && typeof value.valueOf === "function") {
    const primitive = value.valueOf();
    const parsed = Number(primitive);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const createDecimalModuleShim = (runtimeWindow = getRuntimeWindow()) => {
  class ReplayDecimal {
    constructor(value = 0) {
      this._value = toFiniteNumber(value);
    }

    add(value) {
      return new ReplayDecimal(this._value + toFiniteNumber(value));
    }

    ceil() {
      return new ReplayDecimal(Math.ceil(this._value));
    }

    div(value) {
      const divisor = toFiniteNumber(value);
      return new ReplayDecimal(divisor === 0 ? 0 : this._value / divisor);
    }

    eq(value) {
      return this._value === toFiniteNumber(value);
    }

    floor() {
      return new ReplayDecimal(Math.floor(this._value));
    }

    gt(value) {
      return this._value > toFiniteNumber(value);
    }

    gte(value) {
      return this._value >= toFiniteNumber(value);
    }

    lt(value) {
      return this._value < toFiniteNumber(value);
    }

    lte(value) {
      return this._value <= toFiniteNumber(value);
    }

    minus(value) {
      return new ReplayDecimal(this._value - toFiniteNumber(value));
    }

    mul(value) {
      return new ReplayDecimal(this._value * toFiniteNumber(value));
    }

    plus(value) {
      return this.add(value);
    }

    round() {
      return new ReplayDecimal(Math.round(this._value));
    }

    sub(value) {
      return this.minus(value);
    }

    times(value) {
      return this.mul(value);
    }

    toDecimalPlaces(places = 0) {
      const factor = 10 ** Math.max(0, Number(places) || 0);
      return new ReplayDecimal(Math.round(this._value * factor) / factor);
    }

    toFixed(places = 0) {
      return this._value.toFixed(Math.max(0, Number(places) || 0));
    }

    toJSON() {
      return this._value;
    }

    toNumber() {
      return this._value;
    }

    toString() {
      return String(this._value);
    }

    valueOf() {
      return this._value;
    }

    static clone() {
      return ReplayDecimal;
    }

    static set() {
      return ReplayDecimal;
    }
  }

  runtimeWindow.Decimal = runtimeWindow.Decimal || ReplayDecimal;
  return {
    Decimal: runtimeWindow.Decimal,
    default: runtimeWindow.Decimal,
  };
};

const createDecimalNumberModuleShim = () => {
  const roundTo = (value, places = 0) => {
    const factor = 10 ** Math.max(0, Number(places) || 0);
    return Math.floor(toFiniteNumber(value) * factor) / factor;
  };

  return {
    DecimalNumber: {
      ZERO: 0,
      create(value) {
        return toFiniteNumber(value);
      },
      toFixed(value, places = 0) {
        return roundTo(value, places);
      },
    },
  };
};

const BUNDLE_DEFINED_MODULE_RE = /(["']?)([@\w.$/-]+)\1:\s*\[function/g;
const BUNDLE_EXTERNAL_MODULE_RE = /"([^"]+)":\s*void 0/g;

const getBundleModuleBasename = (value) =>
  String(value || "")
    .split("/")
    .filter(Boolean)
    .at(-1)
  || String(value || "");

export const analyzeBundleExternalModuleCoverage = ({
  gameBundleSource,
  launcherBundleSource,
  supplementalBundleSources = [],
  allowedModules = [],
} = {}) => {
  const collectDefinedModules = (source) => {
    const definedModules = new Set();
    for (const match of (source || "").matchAll(BUNDLE_DEFINED_MODULE_RE)) {
      definedModules.add(match[2]);
    }
    return definedModules;
  };

  const allowed = new Set(
    Array.from(allowedModules || [])
      .filter(Boolean)
      .flatMap((value) => [String(value), getBundleModuleBasename(value)]),
  );
  const gameDefinedModules = collectDefinedModules(gameBundleSource);
  const launcherDefinedModules = collectDefinedModules(launcherBundleSource);
  const supplementalDefinedModules = new Set();
  for (const source of supplementalBundleSources || []) {
    for (const name of collectDefinedModules(source)) {
      supplementalDefinedModules.add(name);
    }
  }
  const missingModules = [];

  for (const match of (gameBundleSource || "").matchAll(BUNDLE_EXTERNAL_MODULE_RE)) {
    const raw = match[1];
    const base = getBundleModuleBasename(raw);
    if (
      allowed.has(raw)
      || allowed.has(base)
      || gameDefinedModules.has(raw)
      || gameDefinedModules.has(base)
      || launcherDefinedModules.has(raw)
      || launcherDefinedModules.has(base)
      || supplementalDefinedModules.has(raw)
      || supplementalDefinedModules.has(base)
    ) {
      continue;
    }
    missingModules.push({ raw, base });
  }

  return {
    missingModules,
  };
};

export const toAbsoluteBundleRequestTarget = (
  target,
  runtimeWindow = getRuntimeWindow(),
) => {
  const normalized = String(target || "").trim();
  if (!normalized) {
    return normalized;
  }
  if (isAbsoluteUrlLike(normalized)) {
    return normalized;
  }

  const bundleName = runtimeWindow.cc?.path?.basename?.(normalized)
    || normalized.split("/").filter(Boolean).at(-1)
    || normalized;
  return new URL(`/assets/${bundleName}`, runtimeWindow.location.origin).toString();
};

const normalizeTrackedBundleName = (
  target,
  runtimeWindow = getRuntimeWindow(),
) => {
  const normalized = String(target || "").trim();
  if (!normalized) {
    return "";
  }
  try {
    const absoluteUrl = new URL(normalized, runtimeWindow.location.origin);
    const assetMatch = absoluteUrl.pathname.match(/\/assets\/([^/]+)/);
    if (assetMatch?.[1]) {
      return assetMatch[1];
    }
    const parts = absoluteUrl.pathname.split("/").filter(Boolean);
    return parts.at(-1) || normalized;
  } catch {
    const assetMatch = normalized.match(/\/assets\/([^/]+)/);
    if (assetMatch?.[1]) {
      return assetMatch[1];
    }
    return normalized.split("/").filter(Boolean).at(-1) || normalized;
  }
};

const buildReplayProbeRequestInit = (init = {}) => {
  const headers = new Headers(init?.headers || {});
  headers.set(REPLAY_PROBE_REQUEST_HEADER, "1");
  return {
    cache: "no-store",
    credentials: "same-origin",
    method: "GET",
    ...init,
    headers,
  };
};

const toAbsoluteAssetRequestUrl = (target, runtimeWindow = getRuntimeWindow()) => {
  const raw = typeof target === "string"
    ? target
    : (
        target?.url
        || target?.href
        || ""
      );
  if (!raw) {
    return "";
  }
  try {
    return new URL(raw, runtimeWindow.location.href).toString();
  } catch {
    return String(raw);
  }
};

const isObservedReplayAssetUrl = (target, runtimeWindow = getRuntimeWindow()) => {
  const absoluteUrl = toAbsoluteAssetRequestUrl(target, runtimeWindow);
  if (!absoluteUrl) {
    return false;
  }
  try {
    const pathname = new URL(absoluteUrl).pathname;
    return REPLAY_OBSERVED_ASSET_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  } catch {
    return false;
  }
};

const isHtmlFallbackContentType = (contentType = "") =>
  String(contentType || "").toLowerCase().includes("text/html");

const snapshotAssetRequestEntry = (entry) => ({
  transport: entry?.transport || null,
  url: entry?.url || null,
  pathname: entry?.pathname || null,
  method: entry?.method || null,
  status: Number(entry?.status) || 0,
  contentType: entry?.contentType || null,
  state: entry?.state || null,
  error: entry?.error || null,
});

const buildVersionLookup = (pairs = []) => {
  const versionLookup = new Map();
  if (!Array.isArray(pairs)) {
    return versionLookup;
  }
  for (let index = 0; index < pairs.length; index += 2) {
    versionLookup.set(Number(pairs[index]), String(pairs[index + 1] || ""));
  }
  return versionLookup;
};

const decodeCompactAssetUuid = (uuid = "") => {
  const normalizedUuid = String(uuid || "").trim();
  if (normalizedUuid.length !== 22) {
    return normalizedUuid;
  }

  const base64Values = new Uint8Array(123);
  const base64Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let index = 0; index < base64Chars.length; index += 1) {
    base64Values[base64Chars.charCodeAt(index)] = index;
  }

  const hexChars = "0123456789abcdef";
  let hex = normalizedUuid.slice(0, 2);
  for (let index = 2; index < normalizedUuid.length; index += 2) {
    const lhs = base64Values[normalizedUuid.charCodeAt(index)];
    const rhs = base64Values[normalizedUuid.charCodeAt(index + 1)];
    hex += hexChars[lhs >> 2];
    hex += hexChars[((lhs & 3) << 2) | (rhs >> 4)];
    hex += hexChars[rhs & 15];
  }

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

const buildImportAssetPath = ({
  bundleName = "game",
  uuid = "",
  version = "",
} = {}) => {
  const normalizedUuid = decodeCompactAssetUuid(uuid);
  if (!normalizedUuid) {
    return "";
  }
  const normalizedVersion = String(version || "").trim();
  const suffix = normalizedVersion ? `.${normalizedVersion}` : "";
  return `/assets/${bundleName}/import/${normalizedUuid.slice(0, 2)}/${normalizedUuid}${suffix}.json`;
};

const findFirstProbeFailure = (probeEntries = []) =>
  Array.isArray(probeEntries)
    ? probeEntries.find((entry) => entry && entry.ok === false) || null
    : null;

const loadReplayAuxiliaryScript = (
  src,
  targetDocument = getRuntimeWindow().document,
  runtimeWindow = getRuntimeWindow(),
) =>
  new Promise((resolve, reject) => {
    const existing = targetDocument.querySelector(
      `script[${REPLAY_AUXILIARY_SCRIPT_ATTR}="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") {
        recordXyzwRuntimeScriptEvent({
          runtimeWindow,
          src,
          status: "loaded",
          source: "replay-auxiliary-loader",
        });
        resolve(existing);
        return;
      }
      existing.addEventListener("load", () => resolve(existing), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load replay auxiliary script: ${src}`)),
        { once: true },
      );
      return;
    }

    const script = targetDocument.createElement("script");
    script.async = false;
    script.defer = true;
    script.src = src;
    script.crossOrigin = "anonymous";
    script.setAttribute(REPLAY_AUXILIARY_SCRIPT_ATTR, src);
    recordXyzwRuntimeScriptEvent({
      runtimeWindow,
      src,
      status: "requested",
      source: "replay-auxiliary-loader",
    });
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        recordXyzwRuntimeScriptEvent({
          runtimeWindow,
          src,
          status: "loaded",
          source: "replay-auxiliary-loader",
        });
        resolve(script);
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      (event) => {
        recordXyzwRuntimeScriptEvent({
          runtimeWindow,
          src,
          status: "error",
          source: "replay-auxiliary-loader",
          error: event?.error || new Error(`Failed to load replay auxiliary script: ${src}`),
        });
        reject(new Error(`Failed to load replay auxiliary script: ${src}`));
      },
      { once: true },
    );
    targetDocument.head.appendChild(script);
  });

export const createScopedReplayVm2Shim = ({
  runtimeWindow = getRuntimeWindow(),
} = {}) => {
  const hadPreviousValue = Object.prototype.hasOwnProperty.call(
    runtimeWindow,
    REPLAY_VM2_SHIM_KEY,
  );
  const previousValue = runtimeWindow[REPLAY_VM2_SHIM_KEY];

  runtimeWindow[REPLAY_VM2_SHIM_KEY] = {
    handleException(error) {
      return error;
    },
  };

  return {
    dispose() {
      if (hadPreviousValue) {
        runtimeWindow[REPLAY_VM2_SHIM_KEY] = previousValue;
        return;
      }
      delete runtimeWindow[REPLAY_VM2_SHIM_KEY];
    },
  };
};

export const ensureReplayAuxiliaryBundlesLoaded = async ({
  runtimeWindow = getRuntimeWindow(),
  targetDocument = runtimeWindow.document,
  diagnostics,
  scriptUrls = REPLAY_AUXILIARY_SCRIPT_URLS,
  requiredModules = REPLAY_AUXILIARY_REQUIRED_MODULES,
} = {}) => {
  const previousRequire = runtimeWindow.__require;
  const previousWindowKeys = new Set(Object.getOwnPropertyNames(runtimeWindow));
  const loadedScripts = [];

  const rollback = () => {
    if (runtimeWindow.__require !== previousRequire) {
      runtimeWindow.__require = previousRequire;
    }
    for (const key of Object.getOwnPropertyNames(runtimeWindow)) {
      if (previousWindowKeys.has(key)) {
        continue;
      }
      try {
        delete runtimeWindow[key];
      } catch {
        // Some auxiliary bundles expose non-configurable globals; keep cleanup best-effort.
      }
    }
    for (const scriptElement of loadedScripts.reverse()) {
      scriptElement.remove?.();
    }
  };

  try {
    for (const scriptUrl of scriptUrls) {
      diagnostics?.steps?.push?.(`load-auxiliary-script:${scriptUrl}`);
      const scriptElement = await loadReplayAuxiliaryScript(
        scriptUrl,
        targetDocument,
        runtimeWindow,
      );
      loadedScripts.push(scriptElement);
    }

    const resolvedModules = [];
    const replayAuxiliaryModuleResolutions = {};
    for (const moduleName of requiredModules) {
      const resolution = resolveReplayAuxiliaryModuleRegistration({
        runtimeRequire: runtimeWindow.__require,
        moduleName,
      });
      if (!resolution.ok) {
        throw new Error(
          `Replay auxiliary bundles did not register required module "${moduleName}" via any known alias (${resolution.candidates.join(", ")}): ${toErrorMessage(resolution.error)}`,
        );
      }
      resolvedModules.push(moduleName);
      replayAuxiliaryModuleResolutions[moduleName] = resolution.resolvedName;
    }

    diagnostics.replayAuxiliaryModules = resolvedModules;
    diagnostics.replayAuxiliaryModuleResolutions = replayAuxiliaryModuleResolutions;
    diagnostics.replayAuxiliaryScripts = [...scriptUrls];

    return {
      dispose() {
        rollback();
      },
    };
  } catch (error) {
    rollback();
    throw error;
  }
};

export const installReplayAssetRequestObserver = ({
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const requestLog = [];
  diagnostics.assetRequestLog = requestLog;
  diagnostics.firstFailedAssetRequest = null;
  diagnostics.firstHtmlFallbackAssetRequest = null;
  diagnostics.firstPendingAssetRequest = null;

  let requestId = 0;

  const refreshFirstPendingAssetRequest = () => {
    const pendingEntry = requestLog.find((entry) => entry.state === "pending") || null;
    diagnostics.firstPendingAssetRequest = pendingEntry
      ? snapshotAssetRequestEntry(pendingEntry)
      : null;
  };

  const registerEntry = ({
    transport,
    url,
    method = "GET",
  }) => {
    const entry = {
      id: ++requestId,
      transport,
      url,
      pathname: (() => {
        try {
          return new URL(url).pathname;
        } catch {
          return url;
        }
      })(),
      method,
      state: "pending",
      status: 0,
      contentType: null,
      error: null,
    };
    requestLog.push(entry);
    refreshFirstPendingAssetRequest();
    return entry;
  };

  const finalizeEntry = (entry, updates = {}) => {
    if (!entry || entry.state !== "pending") {
      return;
    }

    Object.assign(entry, updates);

    if (entry.state === "failed" && !diagnostics.firstFailedAssetRequest) {
      diagnostics.firstFailedAssetRequest = snapshotAssetRequestEntry(entry);
    }
    if (entry.state === "html-fallback" && !diagnostics.firstHtmlFallbackAssetRequest) {
      diagnostics.firstHtmlFallbackAssetRequest = snapshotAssetRequestEntry(entry);
    }

    refreshFirstPendingAssetRequest();
  };

  const originalFetch = typeof runtimeWindow.fetch === "function"
    ? runtimeWindow.fetch
    : null;
  if (originalFetch) {
    runtimeWindow.fetch = async function observedReplayAssetFetch(input, init) {
      const requestUrl = toAbsoluteAssetRequestUrl(input, runtimeWindow);
      const mergedHeaders = new Headers(
        init?.headers
        || (typeof input === "object" && input?.headers)
        || undefined,
      );
      if (
        !isObservedReplayAssetUrl(requestUrl, runtimeWindow)
        || mergedHeaders.get(REPLAY_PROBE_REQUEST_HEADER) === "1"
      ) {
        return originalFetch.call(runtimeWindow, input, init);
      }

      const method = String(
        init?.method
        || (typeof input === "object" && input?.method)
        || "GET",
      ).toUpperCase();
      const entry = registerEntry({
        transport: "fetch",
        url: requestUrl,
        method,
      });

      try {
        const response = await originalFetch.call(runtimeWindow, input, init);
        const contentType = response.headers.get("content-type") || "";
        finalizeEntry(entry, {
          state:
            response.ok && !isHtmlFallbackContentType(contentType)
              ? "ok"
              : (
                  response.ok && isHtmlFallbackContentType(contentType)
                    ? "html-fallback"
                    : "failed"
                ),
          status: response.status,
          contentType,
        });
        return response;
      } catch (error) {
        finalizeEntry(entry, {
          state: "failed",
          error: toErrorMessage(error, "Fetch failed."),
        });
        throw error;
      }
    };
  }

  const OriginalXMLHttpRequest = runtimeWindow.XMLHttpRequest;
  if (typeof OriginalXMLHttpRequest === "function") {
    const WrappedXMLHttpRequest = function WrappedXMLHttpRequest() {
      const xhr = new OriginalXMLHttpRequest();
      let trackedUrl = "";
      let trackedMethod = "GET";
      let trackedEntry = null;

      const finalizeTrackedEntry = (fallbackError = null) => {
        if (!trackedEntry) {
          return;
        }
        const contentType = xhr.getResponseHeader?.("content-type") || "";
        finalizeEntry(trackedEntry, {
          state:
            xhr.status >= 200 && xhr.status < 400 && !isHtmlFallbackContentType(contentType)
              ? "ok"
              : (
                  xhr.status >= 200 && xhr.status < 400 && isHtmlFallbackContentType(contentType)
                    ? "html-fallback"
                    : "failed"
                ),
          status: xhr.status || 0,
          contentType,
          error: fallbackError,
        });
      };

      const originalOpen = xhr.open;
      xhr.open = function observedReplayAssetOpen(method, url, ...rest) {
        trackedMethod = String(method || "GET").toUpperCase();
        trackedUrl = toAbsoluteAssetRequestUrl(url, runtimeWindow);
        return originalOpen.call(this, method, url, ...rest);
      };

      const originalSend = xhr.send;
      xhr.send = function observedReplayAssetSend(...args) {
        if (isObservedReplayAssetUrl(trackedUrl, runtimeWindow)) {
          trackedEntry = registerEntry({
            transport: "xhr",
            url: trackedUrl,
            method: trackedMethod,
          });
          xhr.addEventListener?.("loadend", () => finalizeTrackedEntry(), { once: true });
          xhr.addEventListener?.(
            "error",
            () => finalizeTrackedEntry("XMLHttpRequest failed."),
            { once: true },
          );
          xhr.addEventListener?.(
            "abort",
            () => finalizeTrackedEntry("XMLHttpRequest aborted."),
            { once: true },
          );
        }
        return originalSend.apply(this, args);
      };

      return xhr;
    };

    for (const constantName of [
      "UNSENT",
      "OPENED",
      "HEADERS_RECEIVED",
      "LOADING",
      "DONE",
    ]) {
      if (constantName in OriginalXMLHttpRequest) {
        WrappedXMLHttpRequest[constantName] = OriginalXMLHttpRequest[constantName];
      }
    }
    WrappedXMLHttpRequest.prototype = OriginalXMLHttpRequest.prototype;
    runtimeWindow.XMLHttpRequest = WrappedXMLHttpRequest;
  }

  return {
    dispose() {
      if (originalFetch && runtimeWindow.fetch !== originalFetch) {
        runtimeWindow.fetch = originalFetch;
      }
      if (typeof OriginalXMLHttpRequest === "function") {
        runtimeWindow.XMLHttpRequest = OriginalXMLHttpRequest;
      }
    },
  };
};

const waitForValue = async ({
  read,
  runtimeWindow,
  timeoutMs,
  intervalMs = POLL_INTERVAL_MS,
  onTick,
  timeoutMessage,
} = {}) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    onTick?.();
    const value = await read();
    if (value) {
      return value;
    }
    await wait(runtimeWindow, intervalMs);
  }
  onTick?.();
  throw new Error(timeoutMessage || "Timed out while waiting for runtime.");
};

const isHostElement = (hostElement) => {
  const runtimeWindow = getRuntimeWindow();
  const HTMLElementCtor = runtimeWindow.HTMLElement || globalThis.HTMLElement;
  if (typeof HTMLElementCtor === "function") {
    return hostElement instanceof HTMLElementCtor;
  }
  return Boolean(hostElement && typeof hostElement === "object");
};

const createCanvasHost = (hostElement) => {
  const runtimeWindow = getRuntimeWindow();
  hostElement.innerHTML = "";

  const viewport = runtimeWindow.document.createElement("div");
  viewport.className = "fight-pvp-replay-runtime-viewport";

  const canvas = runtimeWindow.document.createElement("canvas");
  canvas.id = `fight-pvp-replay-canvas-${Date.now().toString(16)}`;
  canvas.className = "fight-pvp-replay-runtime-canvas";
  canvas.tabIndex = 99;
  canvas.width = Math.max(hostElement.clientWidth || 0, 960);
  canvas.height = Math.max(hostElement.clientHeight || 0, 540);

  viewport.appendChild(canvas);
  hostElement.appendChild(viewport);

  return { canvas, viewport };
};

const createScopedReplayWxShim = ({ canvas, accessLog }) => {
  const runtimeWindow = getRuntimeWindow();
  const previousWx = runtimeWindow.wx;
  const previousSharedCanvas = runtimeWindow.sharedCanvas;
  const storage = runtimeWindow.localStorage || null;

  const systemInfo = {
    platform: "browser",
    model: "browser",
    pixelRatio: runtimeWindow.devicePixelRatio || 1,
    windowWidth: runtimeWindow.innerWidth || canvas.width || 960,
    windowHeight: runtimeWindow.innerHeight || canvas.height || 540,
    screenWidth: runtimeWindow.innerWidth || canvas.width || 960,
    screenHeight: runtimeWindow.innerHeight || canvas.height || 540,
    language: "zh_CN",
    version: "0.0.0",
    system: runtimeWindow.navigator?.userAgent || "browser",
  };

  const callLog = (name, details = null) => {
    accessLog.push({
      name,
      ...(details ? { details } : null),
    });
  };

  const noop = (name, result) => (...args) => {
    callLog(name, { argTypes: args.map((arg) => typeof arg) });
    return result;
  };

  const showModal = (options = {}) => {
    callLog("showModal", {
      title: String(options?.title || ""),
    });
    const payload = {
      cancel: true,
      confirm: false,
      content: options?.content || "",
    };
    options?.success?.(payload);
    options?.complete?.(payload);
    return Promise.resolve(payload);
  };

  const wxShim = new Proxy({
    env: {
      USER_DATA_PATH: "",
    },
    showModal,
    getSystemInfoSync: () => {
      callLog("getSystemInfoSync");
      return { ...systemInfo };
    },
    getSystemInfo: ({ success, complete } = {}) => {
      callLog("getSystemInfo");
      const payload = { ...systemInfo };
      success?.(payload);
      complete?.(payload);
    },
    createCanvas: () => {
      callLog("createCanvas");
      return canvas;
    },
    createImage: () => {
      callLog("createImage");
      return new Image();
    },
    getSharedCanvas: () => {
      callLog("getSharedCanvas");
      return canvas;
    },
    getOpenDataContext: () => {
      callLog("getOpenDataContext");
      return {
        canvas,
        postMessage() {},
      };
    },
    getStorageSync: (key) => {
      callLog("getStorageSync", { key: String(key || "") });
      return storage?.getItem?.(String(key || "")) || "";
    },
    setStorageSync: (key, value) => {
      callLog("setStorageSync", { key: String(key || "") });
      storage?.setItem?.(String(key || ""), String(value ?? ""));
    },
    removeStorageSync: (key) => {
      callLog("removeStorageSync", { key: String(key || "") });
      storage?.removeItem?.(String(key || ""));
    },
    getFileSystemManager: () => {
      callLog("getFileSystemManager");
      return {
        accessSync() {
          return false;
        },
        mkdirSync() {},
        readFileSync() {
          return "";
        },
        statSync() {
          return { size: 0 };
        },
        writeFileSync() {},
      };
    },
    getLaunchOptionsSync: () => {
      callLog("getLaunchOptionsSync");
      return {};
    },
    getMenuButtonBoundingClientRect: () => {
      callLog("getMenuButtonBoundingClientRect");
      return {
        width: 0,
        height: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      };
    },
    onShow: noop("onShow"),
    offShow: noop("offShow"),
    onHide: noop("onHide"),
    offHide: noop("offHide"),
    onMemoryWarning: noop("onMemoryWarning"),
    offMemoryWarning: noop("offMemoryWarning"),
    requestAnimationFrame: runtimeWindow.requestAnimationFrame.bind(runtimeWindow),
    cancelAnimationFrame: runtimeWindow.cancelAnimationFrame.bind(runtimeWindow),
    canIUse: () => false,
  }, {
    get(target, prop, receiver) {
      if (prop in target) {
        return Reflect.get(target, prop, receiver);
      }
      if (typeof prop === "symbol") {
        return undefined;
      }
      return noop(String(prop));
    },
    has() {
      return true;
    },
  });

  runtimeWindow.wx = wxShim;
  runtimeWindow.sharedCanvas = canvas;

  return {
    dispose() {
      if (previousWx === undefined) {
        delete runtimeWindow.wx;
      } else {
        runtimeWindow.wx = previousWx;
      }

      if (previousSharedCanvas === undefined) {
        delete runtimeWindow.sharedCanvas;
      } else {
        runtimeWindow.sharedCanvas = previousSharedCanvas;
      }
    },
  };
};

export const safeRequireModule = (runtimeRequire, name) => {
  if (typeof runtimeRequire !== "function") {
    return {
      ok: false,
      module: null,
      keys: [],
      error: "Replay runtime require is unavailable.",
      errorType: "require-unavailable",
      missing: false,
    };
  }

  try {
    const module = runtimeRequire(name);
    return {
      ok: true,
      module,
      keys: toSafeModuleKeys(module),
      error: null,
      errorType: null,
      missing: module == null,
    };
  } catch (error) {
    const message = toErrorMessage(error, `Failed to require module "${name}".`);
    const missing = isMissingModuleError(message);
    return {
      ok: false,
      module: null,
      keys: [],
      error: message,
      errorType: missing ? "module-missing" : "require-threw",
      missing,
    };
  }
};

const resolveReplayBattleVersion = (replay) =>
  getFightPvpReplayBattleVersion(replay) || 0;

const buildReplayMapResolutionFromRecord = (replay) => {
  const resolvedMapId
    = replay?.mapId
      ?? replay?.battleInputSnapshot?.mapId
      ?? replay?.exactBattleInputData?.mapId
      ?? replay?.battleInputData?.mapId
      ?? null;
  const resolvedMapIdSource
    = replay?.mapIdSource
      ?? replay?.battleInputSnapshot?.mapIdSource
      ?? replay?.exactBattleInputData?.mapIdSource
      ?? replay?.battleInputData?.mapIdSource
      ?? null;
  const runtimeRoleAvailable = typeof replay?.runtimeRoleAvailable === "boolean"
    ? replay.runtimeRoleAvailable
    : typeof replay?.battleInputSnapshot?.runtimeRoleAvailable === "boolean"
      ? replay.battleInputSnapshot.runtimeRoleAvailable
      : typeof replay?.exactBattleInputData?.runtimeRoleAvailable === "boolean"
        ? replay.exactBattleInputData.runtimeRoleAvailable
        : typeof replay?.battleInputData?.runtimeRoleAvailable === "boolean"
          ? replay.battleInputData.runtimeRoleAvailable
          : false;
  const mapId = resolvedMapId ?? FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID;
  const mapIdSource = resolvedMapIdSource || FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID_SOURCE;

  return {
    mapId,
    pvpMapId: replay?.pvpMapId ?? replay?.mapId ?? replay?.battleInputSnapshot?.mapId ?? null,
    mapIdSource,
    pvpMapIdSource:
      replay?.pvpMapIdSource
      ?? replay?.battleInputSnapshot?.mapIdSource
      ?? replay?.exactBattleInputData?.mapIdSource
      ?? replay?.battleInputData?.mapIdSource
      ?? mapIdSource
      ?? null,
    mapIdResolveReason:
      replay?.mapIdResolveReason
      ?? replay?.battleInputSnapshot?.mapIdResolveReason
      ?? replay?.exactBattleInputData?.mapIdResolveReason
      ?? replay?.battleInputData?.mapIdResolveReason
      ?? null,
    dressPvpMapUsedId: replay?.dressPvpMapUsedId ?? null,
    runtimeRoleMapId:
      replay?.runtimeRoleMapId
      ?? (
        runtimeRoleAvailable && typeof mapIdSource === "string" && mapIdSource.startsWith("runtime.")
          ? mapId
          : null
      ),
    runtimeRolePath:
      replay?.runtimeRolePath
      ?? replay?.battleInputSnapshot?.runtimeRolePath
      ?? replay?.exactBattleInputData?.runtimeRolePath
      ?? replay?.battleInputData?.runtimeRolePath
      ?? null,
    selfRoleContextSource: replay?.selfRoleContextSource ?? null,
    runtimeRoleAvailable,
    battleInputAvailable: typeof replay?.battleInputAvailable === "boolean"
      ? replay.battleInputAvailable
      : Boolean(replay?.exactBattleInputData || replay?.battleInputData || replay?.battleInputSnapshot),
    fixtureMapFallbackUsed: Boolean(
      replay?.meta?.fixtureMapFallback
      || replay?.meta?.fixtureMapFallbackUsed,
    ),
    diagnostics: replay?.meta?.mapIdDiagnostics || null,
  };
};

const applyResolvedMapIdToBattleInput = ({
  battleInput = null,
  mapIdResolution = null,
} = {}) => {
  if (
    !battleInput
    || (
      Number.isFinite(Number(battleInput?.mapId))
      && Number(battleInput.mapId) > 0
    )
  ) {
    return battleInput;
  }

  battleInput.mapId = mapIdResolution?.mapId ?? FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID;
  battleInput.mapIdSource = mapIdResolution?.mapIdSource || FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID_SOURCE;
  battleInput.mapIdResolveReason = mapIdResolution?.mapIdResolveReason || null;
  if (typeof battleInput.runtimeRoleAvailable !== "boolean" && typeof mapIdResolution?.runtimeRoleAvailable === "boolean") {
    battleInput.runtimeRoleAvailable = mapIdResolution.runtimeRoleAvailable;
  }
  battleInput.runtimeRolePath = battleInput.runtimeRolePath || mapIdResolution?.runtimeRolePath || null;
  return battleInput;
};

const resolveReplayRuntimeBattleInput = ({
  replay,
  liveContext = null,
} = {}) => {
  const finalize = ({
    battleInput,
    sourceType,
    mapIdResolution = null,
    resolutionExplanation = null,
    message = "",
  } = {}) => {
    const missingRuntimeFields = battleInput
      ? getFightPvpBattleInputMissingFields(battleInput)
      : ["battleInputData"];
    const finalMessage = message || buildFightPvpBattleInputMissingMessage(missingRuntimeFields);

    return {
      ok: battleInput !== null && missingRuntimeFields.length === 0,
      battleInput,
      sourceType,
      battleInputSource: sourceType,
      missingRuntimeFields,
      battleInputSummary: battleInput
        ? summarizeFightPvpBattleInput(battleInput, {
            missingRuntimeFields,
            sourceType,
            battleInputSource: sourceType,
            mapIdSource: mapIdResolution?.mapIdSource,
            pvpMapIdSource: mapIdResolution?.pvpMapIdSource,
            mapIdResolveReason: mapIdResolution?.mapIdResolveReason,
            runtimeRoleMapId: mapIdResolution?.runtimeRoleMapId,
            runtimeRoleAvailable: mapIdResolution?.runtimeRoleAvailable,
            runtimeRolePath: mapIdResolution?.runtimeRolePath,
            fixtureMapFallbackUsed: Boolean(mapIdResolution?.fixtureMapFallbackUsed),
          })
        : null,
      mapIdResolution,
      resolutionExplanation,
      message: finalMessage,
    };
  };

  if (replay?.exactBattleInputData || replay?.battleInputData) {
    const mapIdResolution = buildReplayMapResolutionFromRecord(replay);
    const battleInput = createFightPvpExactBattleInput(
      replay?.exactBattleInputData || replay?.battleInputData,
      {
        mutate: true,
      },
    );
    applyResolvedMapIdToBattleInput({
      battleInput,
      mapIdResolution,
    });
    return finalize({
      battleInput,
      sourceType: "live-memory-battle-input",
      mapIdResolution,
    });
  }

  if (replay?.battleInputSnapshot) {
    const mapIdResolution = buildReplayMapResolutionFromRecord(replay);
    const battleInput = rehydrateFightPvpBattleInputSnapshot(
      replay.battleInputSnapshot,
    );
    applyResolvedMapIdToBattleInput({
      battleInput,
      mapIdResolution,
    });
    return finalize({
      battleInput,
      sourceType: "persisted-battle-input-snapshot",
      mapIdResolution,
    });
  }

  if (isLegacyFightPvpReplayPayload(replay)) {
    const legacyResult = convertLegacyFightPvpReplayPayload(replay, {
      liveContext,
    });
    const battleInput = legacyResult?.record?.battleInputSnapshot
      ? rehydrateFightPvpBattleInputSnapshot(
          legacyResult.record.battleInputSnapshot,
        )
      : null;

    return finalize({
      battleInput,
      sourceType: "legacy-adapted-replay",
      mapIdResolution: legacyResult?.mapIdResolution || buildReplayMapResolutionFromRecord(replay),
      resolutionExplanation: legacyResult?.resolutionExplanation || null,
      message: legacyResult?.message || "",
    });
  }

  return finalize({
    battleInput: null,
    sourceType: "unknown",
    mapIdResolution: buildReplayMapResolutionFromRecord(replay),
    message: "回放数据为空，无法启动运行时。",
  });
};

export const installReplayManifestShim = ({
  modules,
  replay,
  diagnostics,
} = {}) => {
  const platformManagerPrototype = modules?.PlatformManager?.PlatformManager?.prototype;
  if (!platformManagerPrototype || typeof platformManagerPrototype.manifest !== "function") {
    return {
      dispose() {},
    };
  }

  const battleVersion = resolveReplayBattleVersion(replay);
  const previousManifest = platformManagerPrototype.manifest;

  const replayManifest = async function replayManifest() {
    diagnostics?.steps?.push?.("replay-manifest-called");
    if (battleVersion > 0) {
      this._battleVersion = battleVersion;
    }
    return {
      rawData: {
        battleVersion,
        bundleVers: {},
        config: {},
        isLast: true,
        serverUrl: "",
      },
    };
  };

  platformManagerPrototype.manifest = replayManifest;

  return {
    dispose() {
      if (platformManagerPrototype.manifest === replayManifest) {
        platformManagerPrototype.manifest = previousManifest;
      }
    },
  };
};

export const installReplayPageExitGuard = ({
  modules,
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const platformManagerPrototype = modules?.PlatformManager?.PlatformManager?.prototype;
  const previousExitGame = platformManagerPrototype?.exitGame;
  const previousRestart = runtimeWindow.cc?.game?.restart;

  const guardedExitGame = function guardedExitGame(reason = null) {
    diagnostics?.steps?.push?.("blocked-platform-exit-game");
    diagnostics.replayBlockedExitReason = reason;
    return null;
  };

  if (platformManagerPrototype && typeof previousExitGame === "function") {
    platformManagerPrototype.exitGame = guardedExitGame;
  }

  if (runtimeWindow.cc?.game && typeof previousRestart === "function") {
    runtimeWindow.cc.game.restart = () => {
      diagnostics?.steps?.push?.("blocked-cc-game-restart");
    };
  }

  return {
    dispose() {
      if (platformManagerPrototype?.exitGame === guardedExitGame) {
        platformManagerPrototype.exitGame = previousExitGame;
      }
      if (runtimeWindow.cc?.game?.restart && previousRestart) {
        runtimeWindow.cc.game.restart = previousRestart;
      }
    },
  };
};

export const installReplayPrivacyGuard = ({
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const runtimeRequire = runtimeWindow.__require;
  const readModule = (...names) => {
    if (typeof runtimeRequire !== "function") {
      return null;
    }
    for (const name of names) {
      const moduleValue = readRequireResultModule(
        safeRequireModule(runtimeRequire, name),
      );
      if (moduleValue) {
        return moduleValue;
      }
    }
    return null;
  };

  const gameLoginModule = readModule("game-login");
  const gameLoginPrototype = gameLoginModule?.GameLoginState?.prototype;
  const previousCheckShowPrivacy = gameLoginPrototype?._checkShowPrivacy;
  const previousBegin = gameLoginPrototype?.begin;
  const userAuthModule = readModule("UserAuth");
  const userAuthPrototype = userAuthModule?.UserAuth?.prototype;
  const previousUserAuthOnLoad = userAuthPrototype?.onLoad;
  const previousUserAuthShowAuth = userAuthPrototype?.showAuth;
  const privacyPolicyModule = readModule("UserAgreementAndPrivacyPolicy");
  const privacyPolicyPrototype =
    privacyPolicyModule?.UserAgreementAndPrivacyPolicy?.prototype;
  const previousPrivacyPolicyOnLoad = privacyPolicyPrototype?.onLoad;
  const globalVarModule = readModule("GlobalVarManager");
  const globalVarKeyModule = readModule("types-common");
  const setGlobal = globalVarModule?.SET_GLOBAL;
  const globalVarKey = globalVarKeyModule?.GlobalVarKey || {};

  if (
    !gameLoginPrototype
    && !userAuthPrototype
    && !privacyPolicyPrototype
  ) {
    return {
      dispose() {},
    };
  }

  const resolvePrivacyGlobals = () => {
    const globalVarManagerInstance = globalVarModule?.GlobalVarManager?._instance;
    if (
      typeof setGlobal !== "function"
      || !globalVarManagerInstance
      || typeof globalVarManagerInstance.set !== "function"
    ) {
      return;
    }

    if (globalVarKey.UserAuthDeferred) {
      setGlobal(globalVarKey.UserAuthDeferred, Promise.resolve());
    }
    if (globalVarKey.UserAgreementPrefab) {
      setGlobal(globalVarKey.UserAgreementPrefab, null);
    }
    if (globalVarKey.PrivacyPolicyPrefab) {
      setGlobal(globalVarKey.PrivacyPolicyPrefab, null);
    }
  };

  const guardedCheckShowPrivacy = async function guardedCheckShowPrivacy() {
    diagnostics?.steps?.push?.("blocked-game-login-privacy-check");
    resolvePrivacyGlobals();
    return null;
  };
  const guardedBegin = async function guardedBegin() {
    diagnostics?.steps?.push?.("blocked-game-login-begin");
    resolvePrivacyGlobals();
    return null;
  };
  const guardedUserAuthShowAuth = function guardedUserAuthShowAuth() {
    diagnostics?.steps?.push?.("blocked-user-auth-show-auth");
    if (this?.deferred?.resolve) {
      this.deferred.resolve();
    }
    this.deferred = null;
    if (this?.node) {
      this.node.active = false;
    }
    resolvePrivacyGlobals();
    return null;
  };
  const guardedUserAuthOnLoad = function guardedUserAuthOnLoad() {
    diagnostics?.steps?.push?.("blocked-user-auth-onload");
    return guardedUserAuthShowAuth.call(this, false);
  };
  const guardedPrivacyPolicyOnLoad = function guardedPrivacyPolicyOnLoad() {
    diagnostics?.steps?.push?.("blocked-privacy-policy-onload");
    if (this?.node) {
      this.node.active = false;
    }
    return null;
  };

  if (typeof previousCheckShowPrivacy === "function") {
    gameLoginPrototype._checkShowPrivacy = guardedCheckShowPrivacy;
  }
  if (typeof previousBegin === "function") {
    gameLoginPrototype.begin = guardedBegin;
  }
  if (typeof previousUserAuthOnLoad === "function") {
    userAuthPrototype.onLoad = guardedUserAuthOnLoad;
  }
  if (typeof previousUserAuthShowAuth === "function") {
    userAuthPrototype.showAuth = guardedUserAuthShowAuth;
  }
  if (typeof previousPrivacyPolicyOnLoad === "function") {
    privacyPolicyPrototype.onLoad = guardedPrivacyPolicyOnLoad;
  }

  resolvePrivacyGlobals();

  return {
    dispose() {
      if (
        typeof previousCheckShowPrivacy === "function"
        && gameLoginPrototype._checkShowPrivacy === guardedCheckShowPrivacy
      ) {
        gameLoginPrototype._checkShowPrivacy = previousCheckShowPrivacy;
      }
      if (
        typeof previousBegin === "function"
        && gameLoginPrototype.begin === guardedBegin
      ) {
        gameLoginPrototype.begin = previousBegin;
      }
      if (
        typeof previousUserAuthOnLoad === "function"
        && userAuthPrototype?.onLoad === guardedUserAuthOnLoad
      ) {
        userAuthPrototype.onLoad = previousUserAuthOnLoad;
      }
      if (
        typeof previousUserAuthShowAuth === "function"
        && userAuthPrototype?.showAuth === guardedUserAuthShowAuth
      ) {
        userAuthPrototype.showAuth = previousUserAuthShowAuth;
      }
      if (
        typeof previousPrivacyPolicyOnLoad === "function"
        && privacyPolicyPrototype?.onLoad === guardedPrivacyPolicyOnLoad
      ) {
        privacyPolicyPrototype.onLoad = previousPrivacyPolicyOnLoad;
      }
    },
  };
};

export const installReplayPromiseUtilShim = ({
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const runtimeRequire = runtimeWindow.__require;
  const promiseUtilModule = typeof runtimeRequire === "function"
    ? readRequireResultModule(safeRequireModule(runtimeRequire, "PromiseUtil"))
    : null;
  const promiseUtil = promiseUtilModule?.default || promiseUtilModule;
  const previousWait = promiseUtil?.wait;
  if (!promiseUtil || typeof previousWait !== "function") {
    return {
      dispose() {},
    };
  }

  const guardedWait = function guardedWait(seconds = 0) {
    diagnostics?.steps?.push?.("shim-promise-util-wait");
    const delayMs = Math.max(0, Number(seconds) || 0) * 1000;
    return new Promise((resolve) => runtimeWindow.setTimeout(resolve, delayMs));
  };

  promiseUtil.wait = guardedWait;

  return {
    dispose() {
      if (promiseUtil.wait === guardedWait) {
        promiseUtil.wait = previousWait;
      }
    },
  };
};

export const installReplayLoadingErrorObserver = ({
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const loadErrorPrototype = runtimeWindow.__require?.("load-error")?.LoadErrorState?.prototype;
  if (!loadErrorPrototype || typeof loadErrorPrototype.onEnter !== "function") {
    return {
      dispose() {},
    };
  }

  const previousOnEnter = loadErrorPrototype.onEnter;
  const observedOnEnter = async function observedOnEnter(previousState, reason, ...args) {
    diagnostics.loadingErrorReason = toErrorMessage(reason, "Unknown loading error.");
    diagnostics.loadingErrorDetail = {
      message: diagnostics.loadingErrorReason,
      stack: reason?.stack || null,
      type: reason?.constructor?.name || typeof reason,
    };
    diagnostics.steps?.push?.("observe-loading-error");
    return previousOnEnter.call(this, previousState, reason, ...args);
  };

  loadErrorPrototype.onEnter = observedOnEnter;

  return {
    dispose() {
      if (loadErrorPrototype.onEnter === observedOnEnter) {
        loadErrorPrototype.onEnter = previousOnEnter;
      }
    },
  };
};

export const installReplayResourceManagerGuard = ({
  modules,
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const resourceManagerPrototype = modules?.ResourceManager?.ResourceManager?.prototype;
  if (!resourceManagerPrototype || typeof resourceManagerPrototype.loadBundle !== "function") {
    return {
      dispose() {},
    };
  }

  const previousLoadBundle = resourceManagerPrototype.loadBundle;
  const createMap = runtimeWindow.cc?.js?.createMap?.bind(runtimeWindow.cc.js)
    || (() => Object.create(null));

  const guardedLoadBundle = function guardedLoadBundle(...args) {
    const trackedTarget = args[0];
    const trackedBundleName = normalizeTrackedBundleName(trackedTarget, runtimeWindow);
    if (!this._bundlePromises || typeof this._bundlePromises !== "object") {
      this._bundlePromises = createMap();
      diagnostics?.steps?.push?.("init-resource-bundle-promises");
    }
    if (!this._fguiPromises || typeof this._fguiPromises !== "object") {
      this._fguiPromises = createMap();
      diagnostics?.steps?.push?.("init-resource-fgui-promises");
    }
    if (!this.bundleVersions || typeof this.bundleVersions !== "object") {
      this.bundleVersions = {};
      diagnostics?.steps?.push?.("init-resource-bundle-versions");
    }
    return trackXyzwBundlePromise({
      runtimeWindow,
      bundleName: trackedBundleName,
      source: "ResourceManager.loadBundle",
      target: trackedTarget,
      result: previousLoadBundle.apply(this, args),
    });
  };

  resourceManagerPrototype.loadBundle = guardedLoadBundle;

  return {
    dispose() {
      if (resourceManagerPrototype.loadBundle === guardedLoadBundle) {
        resourceManagerPrototype.loadBundle = previousLoadBundle;
      }
    },
  };
};

export const installReplaySceneStageObserver = ({
  modules,
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const cleanupFns = [];
  const tryLoadAssetTargets = [
    {
      holder: modules?.ResourceManager,
      key: "TRY_LOAD_ASSET",
      source: "ResourceManager.TRY_LOAD_ASSET",
    },
    {
      holder: modules?.ResourceManager?.default,
      key: "TRY_LOAD_ASSET",
      source: "ResourceManager.default.TRY_LOAD_ASSET",
    },
  ];

  for (const target of tryLoadAssetTargets) {
    const previous = target.holder?.[target.key];
    if (typeof previous !== "function") {
      continue;
    }
    const wrapped = function wrappedTryLoadAsset(bundleName, path, assetType, ...args) {
      diagnostics?.steps?.push?.(`observe-try-load-asset:${bundleName}:${path}`);
      return trackXyzwTryLoadAssetPromise({
        runtimeWindow,
        bundleName,
        path,
        assetType,
        source: target.source,
        result: previous.call(this, bundleName, path, assetType, ...args),
      });
    };
    target.holder[target.key] = wrapped;
    cleanupFns.push(() => {
      if (target.holder?.[target.key] === wrapped) {
        target.holder[target.key] = previous;
      }
    });
  }

  const director = runtimeWindow.cc?.director;
  const previousRunScene = director?.runScene;
  if (typeof previousRunScene === "function") {
    const wrappedRunScene = function wrappedRunScene(scene, ...args) {
      const sceneName = scene?.name || null;
      diagnostics?.steps?.push?.(`observe-run-scene:${sceneName || "unknown"}`);
      recordXyzwRunSceneCall({
        runtimeWindow,
        sceneName,
        source: "cc.director.runScene",
      });
      return previousRunScene.call(this, scene, ...args);
    };
    director.runScene = wrappedRunScene;
    cleanupFns.push(() => {
      if (director.runScene === wrappedRunScene) {
        director.runScene = previousRunScene;
      }
    });
  }

  return {
    dispose() {
      while (cleanupFns.length > 0) {
        cleanupFns.pop()?.();
      }
    },
  };
};

const readRuntimeModules = () => {
  const runtimeWindow = getRuntimeWindow();
  const runtimeRequire = runtimeWindow.__require;
  if (typeof runtimeRequire !== "function") {
    throw new TypeError("XYZW runtime require is unavailable.");
  }

  return {
    BattleUIManager: readRequireResultModule(safeRequireModule(runtimeRequire, "BattleUIManager")),
    Game: readRequireResultModule(safeRequireModule(runtimeRequire, "Game")),
    GlobalVarManager: readRequireResultModule(safeRequireModule(runtimeRequire, "GlobalVarManager")),
    Launcher: readRequireResultModule(safeRequireModule(runtimeRequire, "Launcher")),
    PlatformManager: readRequireResultModule(safeRequireModule(runtimeRequire, "PlatformManager")),
    ResourceManager: readRequireResultModule(safeRequireModule(runtimeRequire, "ResourceManager")),
    consts: readRequireResultModule(safeRequireModule(runtimeRequire, "consts")),
  };
};

const readCurrentGameState = (modules) =>
  modules?.Game?.Game?._instance?.stateMachine?.current?.stateId ?? null;

const getRuntimeSnapshot = (
  modules,
  runtimeWindow = getRuntimeWindow(),
) => {
  return {
    hasCc: typeof runtimeWindow.cc !== "undefined",
    runtimePlatform: runtimeWindow.PLATFORM || null,
    sceneName: runtimeWindow.cc?.director?.getScene?.()?.name ?? null,
    hasCanvasInstance: Boolean(runtimeWindow.cc?.Canvas?.instance),
    gamePrepared: runtimeWindow.cc?.game?._prepared ?? null,
    gameRendererInitialized: runtimeWindow.cc?.game?._rendererInitialized ?? null,
    currentGameState: readCurrentGameState(modules),
    launcherReady: Boolean(modules?.Launcher?.Launcher?._instance),
    battleVersionFromPlatformManager:
      modules?.PlatformManager?.PlatformManager?._instance?.getBattleVersion?.() ?? null,
  };
};

const ensureRuntimeBooted = async ({ canvas }) => {
  const runtimeWindow = getRuntimeWindow();
  const runtimeGame = runtimeWindow.cc?.game;
  if (!runtimeGame) {
    throw new Error("Cocos game runtime is unavailable.");
  }

  if (runtimeGame._prepared && runtimeGame._rendererInitialized) {
    return;
  }

  await new Promise((resolve, reject) => {
    let settled = false;
    const timer = runtimeWindow.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error("Runtime boot timed out before the renderer became ready."));
    }, BOOT_TIMEOUT_MS);

    const finalize = (callback) => {
      if (settled) {
        return;
      }
      runtimeWindow.clearTimeout(timer);
      settled = true;
      callback();
    };

    try {
      runtimeGame.run({
        id: canvas.id,
        debugMode: 0,
        showFPS: false,
        frameRate: 60,
        renderMode: 0,
        groupList: ["default"],
        collisionMatrix: [[true]],
        registerSystemEvent: false,
      }, () => finalize(resolve));
    } catch (error) {
      runtimeWindow.clearTimeout(timer);
      reject(error);
    }
  });

  await waitForValue({
    read: () => {
      const game = runtimeWindow.cc?.game;
      return game?._prepared && game?._rendererInitialized ? true : null;
    },
    runtimeWindow,
    timeoutMs: BOOT_TIMEOUT_MS,
    timeoutMessage: "Runtime boot callback completed, but renderer is still unavailable.",
  });
};

const buildLoadingDescAsset = (runtimeCc) => {
  const asset = new runtimeCc.JsonAsset();
  asset.json = {};
  return asset;
};

const ensureReplayBootstrapScene = async ({ canvas, modules, diagnostics }) => {
  const runtimeWindow = getRuntimeWindow();
  const runtimeCc = runtimeWindow.cc;
  const currentScene = runtimeCc?.director?.getScene?.();
  if (currentScene) {
    return {
      created: false,
      scene: currentScene,
      bootstrapSceneName: currentScene.name || null,
      cleanup() {},
    };
  }

  if (!modules?.Game?.Game || !modules?.Launcher?.Launcher) {
    throw new Error("Launcher/Game runtime modules are unavailable for bootstrap.");
  }

  diagnostics.steps.push("create-bootstrap-scene");

  const bootstrapScene = new runtimeCc.Scene();
  bootstrapScene.name = BOOTSTRAP_SCENE_NAME;

  const canvasNode = new runtimeCc.Node("Canvas");
  bootstrapScene.addChild(canvasNode);
  const canvasComponent = canvasNode.addComponent(runtimeCc.Canvas);
  canvasComponent.designResolution = runtimeCc.size(canvas.width || 960, canvas.height || 540);
  canvasComponent.fitHeight = true;
  canvasComponent.fitWidth = true;

  const containerNode = new runtimeCc.Node("container");
  canvasNode.addChild(containerNode);

  const cleanNode = new runtimeCc.Node("clean");
  cleanNode.active = false;
  containerNode.addChild(cleanNode);

  const codeVersionNode = new runtimeCc.Node("codeVersion");
  canvasNode.addChild(codeVersionNode);
  const codeVersionLabel = codeVersionNode.addComponent(runtimeCc.Label);

  runtimeCc.director.runScene(bootstrapScene);
  await waitForNextFrame(runtimeWindow);

  const gameNode = new runtimeCc.Node("FightPvpReplayGameRoot");
  bootstrapScene.addChild(gameNode);
  gameNode.addComponent(modules.Game.Game);
  await waitForNextFrame(runtimeWindow);

  const launcherNode = new runtimeCc.Node("FightPvpReplayLauncherRoot");
  launcherNode.active = false;
  canvasNode.addChild(launcherNode);
  const launcherWidget = launcherNode.addComponent(runtimeCc.Widget);
  const launcherComponent = launcherNode.addComponent(modules.Launcher.Launcher);
  launcherComponent.container = containerNode;
  launcherComponent.codeVersion = codeVersionLabel;
  launcherComponent.loadingDesc = buildLoadingDescAsset(runtimeCc);
  launcherComponent.ccCanvas = canvasComponent;
  launcherComponent.ccWidget = launcherWidget;
  launcherNode.active = true;
  await waitForNextFrame(runtimeWindow);

  await waitForValue({
    read: () => (
      modules?.Game?.Game?._instance && modules?.Launcher?.Launcher?._instance
        ? true
        : null
    ),
    runtimeWindow,
    timeoutMs: BOOT_TIMEOUT_MS,
    timeoutMessage: "Bootstrap scene was created, but Launcher/Game instances did not initialize.",
  });

  return {
    created: true,
    scene: bootstrapScene,
    canvasNode,
    gameNode,
    launcherNode,
    bootstrapSceneName: BOOTSTRAP_SCENE_NAME,
    cleanup() {
      const entityNode = runtimeCc.sys?.entityNode1;
      if (entityNode?.isValid) {
        entityNode.destroy();
        runtimeCc.sys.entityNode1 = null;
      }
      if (launcherNode?.isValid) {
        launcherNode.destroy();
      }
      if (gameNode?.isValid) {
        gameNode.destroy();
      }
      if (
        runtimeCc.director?.getScene?.()?.name === BOOTSTRAP_SCENE_NAME
      ) {
        const teardownScene = new runtimeCc.Scene();
        teardownScene.name = "FightPvpReplayDisposed";
        runtimeCc.director.runScene(teardownScene);
      }
    },
  };
};

export const ensureReplayBundleVersionContainers = ({
  runtimeWindow = getRuntimeWindow(),
  modules,
  diagnostics,
} = {}) => {
  const downloader = runtimeWindow.cc?.assetManager?.downloader;
  if (downloader && (!downloader.bundleVers || typeof downloader.bundleVers !== "object")) {
    downloader.bundleVers = {};
    diagnostics?.steps?.push?.("init-downloader-bundle-vers");
  }

  const resourceManager = modules?.ResourceManager?.ResourceManager?._instance;
  if (
    resourceManager
    && (!resourceManager.bundleVersions || typeof resourceManager.bundleVersions !== "object")
  ) {
    resourceManager.bundleVersions = {};
    diagnostics?.steps?.push?.("init-resource-bundle-versions");
  }

  if (
    !runtimeWindow.ccInternalRemoteBundles
    || typeof runtimeWindow.ccInternalRemoteBundles !== "object"
  ) {
    runtimeWindow.ccInternalRemoteBundles = {};
    diagnostics?.steps?.push?.("init-remote-bundle-map");
  }
};

export const installReplayBundleResolverPatch = ({
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const assetManager = runtimeWindow.cc?.assetManager;
  const downloader = runtimeWindow.cc?.assetManager?.downloader;
  const bundleDownloaders = downloader?._downloaders;
  const originalBundleDownloader = bundleDownloaders?.bundle;
  const originalLoadBundle = assetManager?.loadBundle;

  if (
    (!bundleDownloaders || typeof originalBundleDownloader !== "function")
    && typeof originalLoadBundle !== "function"
  ) {
    return {
      dispose() {},
    };
  }

  const patchedTargets = new Set();
  const normalizeBundleTarget = (target) => {
    const nextTarget = toAbsoluteBundleRequestTarget(target, runtimeWindow);
    if (nextTarget !== target && !patchedTargets.has(nextTarget)) {
      patchedTargets.add(nextTarget);
      diagnostics?.steps?.push?.("patch-local-bundle-target");
      diagnostics.patchedBundleTargets = [
        ...(diagnostics.patchedBundleTargets || []),
        nextTarget,
      ];
    }
    return nextTarget;
  };

  const patchedBundleDownloader = function patchedBundleDownloader(
    target,
    options,
    callback,
  ) {
    const nextTarget = normalizeBundleTarget(target);
    const trackedBundleName = normalizeTrackedBundleName(nextTarget, runtimeWindow);
    recordXyzwBundleEvent({
      runtimeWindow,
      bundleName: trackedBundleName,
      status: "requested",
      source: "assetManager.downloader.bundle",
      target: nextTarget,
    });
    return originalBundleDownloader.call(
      this,
      nextTarget,
      options,
      (...callbackArgs) => {
        const callbackError = callbackArgs[0];
        recordXyzwBundleEvent({
          runtimeWindow,
          bundleName: trackedBundleName,
          status: callbackError ? "rejected" : "resolved",
          source: "assetManager.downloader.bundle",
          target: nextTarget,
          error: callbackError || null,
        });
        return callback?.(...callbackArgs);
      },
    );
  };

  if (bundleDownloaders && typeof originalBundleDownloader === "function") {
    bundleDownloaders.bundle = patchedBundleDownloader;
  }

  const patchedLoadBundle = function patchedLoadBundle(target, ...args) {
    const nextTarget = normalizeBundleTarget(target);
    const trackedBundleName = normalizeTrackedBundleName(nextTarget, runtimeWindow);
    return trackXyzwBundlePromise({
      runtimeWindow,
      bundleName: trackedBundleName,
      source: "assetManager.loadBundle",
      target: nextTarget,
      result: originalLoadBundle.call(this, nextTarget, ...args),
    });
  };

  if (assetManager && typeof originalLoadBundle === "function") {
    assetManager.loadBundle = patchedLoadBundle;
  }

  return {
    dispose() {
      if (bundleDownloaders?.bundle === patchedBundleDownloader) {
        bundleDownloaders.bundle = originalBundleDownloader;
      }
      if (assetManager?.loadBundle === patchedLoadBundle) {
        assetManager.loadBundle = originalLoadBundle;
      }
    },
  };
};

export const installReplayMissingModuleShims = ({
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const decimalModuleShim = createDecimalModuleShim(runtimeWindow);
  const providedAliases = new Set([
    "../../extras/libs/decimal/decimal",
    "decimal",
  ]);
  const moduleMap = new Map([
    ["../../extras/libs/decimal/decimal", decimalModuleShim],
    ["decimal", decimalModuleShim],
  ]);

  const decimalNumberShim = createDecimalNumberModuleShim();
  for (const alias of [
    "../../../../../extras/battle/basis/number/decimal-number",
    "../../../../extras/battle/basis/number/decimal-number",
    "../../../extras/battle/basis/number/decimal-number",
    "decimal-number",
  ]) {
    providedAliases.add(alias);
    moduleMap.set(alias, decimalNumberShim);
  }

  const previousRequire = runtimeWindow.__require;
  if (typeof previousRequire !== "function") {
    return {
      dispose() {},
    };
  }

  const shimmedRequire = (name, ...rest) => {
    if (moduleMap.has(name)) {
      diagnostics?.steps?.push?.(`shim-module:${name}`);
      return moduleMap.get(name);
    }
    return previousRequire(name, ...rest);
  };

  runtimeWindow.__require = shimmedRequire;

  return {
    providedAliases,
    dispose() {
      if (runtimeWindow.__require === shimmedRequire) {
        runtimeWindow.__require = previousRequire;
      }
    },
  };
};

export const inspectReplayGameBundleModuleCoverage = async ({
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
  sourceUrls = REPLAY_AUXILIARY_SOURCE_URLS,
  allowedModules = [],
} = {}) => {
  const gameBundleUrl = new URL("/assets/game/index.js", runtimeWindow.location.origin).toString();
  const [gameBundleSource, ...supplementalBundleSources] = await Promise.all([
    runtimeWindow.fetch(gameBundleUrl, {
      ...buildReplayProbeRequestInit(),
    }).then((response) => response.text()),
    ...sourceUrls.map((sourceUrl) => (
      runtimeWindow.fetch(new URL(sourceUrl, runtimeWindow.location.origin).toString(), {
        ...buildReplayProbeRequestInit(),
      }).then((response) => response.text())
    )),
  ]);

  const coverage = analyzeBundleExternalModuleCoverage({
    gameBundleSource,
    launcherBundleSource: supplementalBundleSources[0] || "",
    supplementalBundleSources: supplementalBundleSources.slice(1),
    allowedModules,
  });
  diagnostics.gameBundleModuleCoverage = {
    missingCount: coverage.missingModules.length,
    sample: coverage.missingModules.slice(0, 20),
  };
  return coverage;
};

const buildIncompleteGameBundleMessage = (coverage) => {
  const missingModules = coverage?.missingModules || [];
  if (missingModules.length === 0) {
    return "当前 game bundle 缺少必要 external modules。";
  }
  const sample = missingModules
    .slice(0, 12)
    .map((entry) => entry.base)
    .join(", ");
  return `当前 game bundle 不完整，缺少 ${missingModules.length} 个 external modules，例如：${sample}。`;
};

const buildBundleAssetProbeTargets = ({
  runtimeWindow = getRuntimeWindow(),
  bundleName = "game",
} = {}) => {
  const version = runtimeWindow.cc?.assetManager?.downloader?.bundleVers?.[bundleName] || "";
  const suffix = version ? `.${version}` : "";
  return [
    `/assets/${bundleName}/config${suffix}.json`,
    `/assets/${bundleName}/index${suffix}.js`,
  ];
};

const probeReplayAsset = async ({
  pathname,
  expectedContentType,
  parseJson = false,
  runtimeWindow = getRuntimeWindow(),
} = {}) => {
  const url = new URL(pathname, runtimeWindow.location.href).toString();
  try {
    const response = await runtimeWindow.fetch(url, buildReplayProbeRequestInit());
    const contentType = response.headers.get("content-type") || "";
    const htmlFallback = isHtmlFallbackContentType(contentType);
    let json = null;
    if (parseJson && response.ok && !htmlFallback) {
      try {
        json = await response.clone().json();
      } catch {
        json = null;
      }
    }
    return {
      ok:
        response.ok
        && contentType.toLowerCase().includes(String(expectedContentType || "").toLowerCase())
        && !htmlFallback
        && (!parseJson || Boolean(json)),
      contentType,
      expectedContentType,
      htmlFallback,
      json,
      pathname,
      status: response.status,
      url,
    };
  } catch (error) {
    return {
      ok: false,
      contentType: "",
      expectedContentType,
      htmlFallback: false,
      json: null,
      pathname,
      status: 0,
      url,
      error: toErrorMessage(error, "Failed to fetch asset."),
    };
  }
};

const syncProbeFailureDiagnostics = (diagnostics) => {
  const firstProbeFailure = findFirstProbeFailure([
    ...(diagnostics?.bundleAssetProbe || []),
    ...(diagnostics?.sceneAssetProbe || []),
  ]);
  if (!firstProbeFailure) {
    return;
  }
  if (!diagnostics.firstMissingAsset) {
    diagnostics.firstMissingAsset = firstProbeFailure.pathname || firstProbeFailure.scenePath || null;
  }
  const hasBadContentType = Boolean(
    firstProbeFailure.contentType
    && (
      firstProbeFailure.htmlFallback
      || !String(firstProbeFailure.contentType).toLowerCase().includes(
        String(firstProbeFailure.expectedContentType || "").toLowerCase(),
      )
    ),
  );
  if (!diagnostics.firstBadContentType && hasBadContentType) {
    diagnostics.firstBadContentType = {
      pathname: firstProbeFailure.pathname || null,
      contentType: firstProbeFailure.contentType,
      expectedContentType: firstProbeFailure.expectedContentType || null,
    };
  }
};

const probeGameBundleAssets = async ({ diagnostics } = {}) => {
  const runtimeWindow = getRuntimeWindow();
  const targets = buildBundleAssetProbeTargets();

  diagnostics?.steps?.push?.("probe-game-bundle-assets");

  const results = await Promise.all(
    targets.map((pathname) => probeReplayAsset({
      pathname,
      expectedContentType: pathname.endsWith(".json")
        ? "application/json"
        : "javascript",
      runtimeWindow,
    })),
  );

  diagnostics.bundleAssetProbe = results;
  syncProbeFailureDiagnostics(diagnostics);
  return results;
};

export const probeGameSceneAssets = async ({
  diagnostics,
  runtimeWindow = getRuntimeWindow(),
  scenePath = "db://assets/game/scenes/Game.fire",
} = {}) => {
  diagnostics?.steps?.push?.("probe-game-scene-assets");
  const sceneAssetProbe = [];
  const [configPathname] = buildBundleAssetProbeTargets({
    runtimeWindow,
    bundleName: "game",
  });

  const configProbe = await probeReplayAsset({
    pathname: configPathname,
    expectedContentType: "application/json",
    parseJson: true,
    runtimeWindow,
  });
  sceneAssetProbe.push({
    stage: "config",
    ok: configProbe.ok,
    pathname: configProbe.pathname,
    status: configProbe.status,
    htmlFallback: configProbe.htmlFallback,
    contentType: configProbe.contentType,
    expectedContentType: configProbe.expectedContentType,
    error: configProbe.error || null,
  });

  if (!configProbe.ok || !configProbe.json) {
    diagnostics.sceneAssetProbe = sceneAssetProbe;
    syncProbeFailureDiagnostics(diagnostics);
    return sceneAssetProbe;
  }

  const configJson = configProbe.json || {};
  const sceneIndex = Number(configJson.scenes?.[scenePath]);
  const sceneUuid = Number.isFinite(sceneIndex)
    ? String(configJson.uuids?.[sceneIndex] || "")
    : "";
  const importVersion = buildVersionLookup(configJson.versions?.import).get(sceneIndex) || "";
  const sceneImportPath = buildImportAssetPath({
    bundleName: "game",
    uuid: sceneUuid,
    version: importVersion,
  });

  sceneAssetProbe.push({
    stage: "scene-record",
    ok: Number.isFinite(sceneIndex) && Boolean(sceneUuid) && Boolean(sceneImportPath),
    scenePath,
    sceneIndex: Number.isFinite(sceneIndex) ? sceneIndex : null,
    sceneUuid: sceneUuid || null,
    importVersion: importVersion || null,
    pathname: sceneImportPath || null,
    error:
      !Number.isFinite(sceneIndex)
        ? "scene-record-missing"
        : (
            !sceneUuid
              ? "scene-uuid-missing"
              : (!sceneImportPath ? "scene-import-path-missing" : null)
          ),
  });

  if (!(Number.isFinite(sceneIndex) && sceneUuid && sceneImportPath)) {
    diagnostics.sceneAssetProbe = sceneAssetProbe;
    syncProbeFailureDiagnostics(diagnostics);
    return sceneAssetProbe;
  }

  const sceneImportProbe = await probeReplayAsset({
    pathname: sceneImportPath,
    expectedContentType: "application/json",
    runtimeWindow,
  });
  sceneAssetProbe.push({
    stage: "scene-import",
    ok: sceneImportProbe.ok,
    scenePath,
    sceneIndex,
    sceneUuid,
    importVersion: importVersion || null,
    pathname: sceneImportProbe.pathname,
    status: sceneImportProbe.status,
    htmlFallback: sceneImportProbe.htmlFallback,
    contentType: sceneImportProbe.contentType,
    expectedContentType: sceneImportProbe.expectedContentType,
    error: sceneImportProbe.error || null,
  });

  diagnostics.sceneAssetProbe = sceneAssetProbe;
  syncProbeFailureDiagnostics(diagnostics);
  return sceneAssetProbe;
};

const describeProbeFailure = (entry, fallbackLabel) => {
  const target = entry?.pathname || entry?.scenePath || fallbackLabel;
  const detail = entry?.htmlFallback
    ? "HTML fallback"
    : (
        entry?.contentType
        && !String(entry.contentType).toLowerCase().includes(
          String(entry.expectedContentType || "").toLowerCase(),
        )
          ? `content-type ${entry.contentType}`
          : (
              entry?.status
                ? `HTTP ${entry.status}`
                : (entry?.error || entry?.contentType || "unknown error")
            )
      );
  return {
    target,
    detail,
  };
};

export const classifyRuntimeLoadFailure = ({
  stateId = null,
  sceneName = null,
  diagnostics = null,
  timedOut = false,
} = {}) => {
  if (stateId === "LoadingError" || diagnostics?.loadingErrorReason) {
    return {
      kind: "loading-error",
      message: `浏览器模式运行时进入 LoadingError：${diagnostics?.loadingErrorReason || "Unknown loading error."}`,
    };
  }

  const topLevelFailure = findFirstProbeFailure(diagnostics?.bundleAssetProbe);
  if (topLevelFailure) {
    const { target, detail } = describeProbeFailure(topLevelFailure, "/assets/game");
    return {
      kind: "bundle-asset-failed",
      message: `顶层 game bundle 资源缺失或不可用：${target} (${detail})。`,
    };
  }

  const sceneFailure = findFirstProbeFailure(diagnostics?.sceneAssetProbe);
  if (sceneFailure) {
    if (sceneFailure.stage === "scene-record") {
      return {
        kind: "scene-record-missing",
        message: `Game scene 配置缺失：${sceneFailure.scenePath || "db://assets/game/scenes/Game.fire"}。`,
      };
    }
    const { target, detail } = describeProbeFailure(
      sceneFailure,
      "/assets/game/import/",
    );
    return {
      kind: "scene-asset-failed",
      message: `Game scene 依赖资源加载失败：${target} (${detail})。`,
    };
  }

  if (diagnostics?.firstHtmlFallbackAssetRequest) {
    const firstHtmlFallbackAssetRequest = diagnostics.firstHtmlFallbackAssetRequest;
    return {
      kind: "asset-html-fallback",
      message: `Game scene 依赖资源返回了 HTML fallback：${firstHtmlFallbackAssetRequest.pathname || firstHtmlFallbackAssetRequest.url}。`,
    };
  }

  if (diagnostics?.firstFailedAssetRequest) {
    const firstFailedAssetRequest = diagnostics.firstFailedAssetRequest;
    return {
      kind: "asset-request-failed",
      message: `Game scene 依赖资源加载失败：${firstFailedAssetRequest.pathname || firstFailedAssetRequest.url} (${firstFailedAssetRequest.status || firstFailedAssetRequest.error || "unknown error"})。`,
    };
  }

  if (!timedOut) {
    return null;
  }

  if (stateId === "LoadGameScene") {
    const pendingPath = diagnostics?.firstPendingAssetRequest?.pathname
      || diagnostics?.firstPendingAssetRequest?.url
      || null;
    return {
      kind: "scene-load-timeout",
      message: pendingPath
        ? `Game scene 加载超过 bridge 等待窗口，但尚未收到明确 LoadingError；请优先查看首个 pending/failed asset diagnostics。首个 pending asset：${pendingPath}。`
        : "Game scene 加载超过 bridge 等待窗口，但尚未收到明确 LoadingError；请优先查看首个 pending/failed asset diagnostics。",
    };
  }

  return {
    kind: "runtime-load-timeout",
    message: `浏览器模式运行时在 ${stateId || sceneName || "unknown state"} 停留过久，且尚未拿到明确失败信号。`,
  };
};

const isRuntimeReadySceneForReplay = ({
  sceneName = null,
} = {}) => sceneName === GAME_SCENE_NAME;

export const waitForRuntimeReadyForReplay = async ({
  modules,
  diagnostics,
  runtimeWindow = getRuntimeWindow(),
  bootstrapSceneName = BOOTSTRAP_SCENE_NAME,
  timeoutMs = GAME_SCENE_LOAD_TIMEOUT_MS,
  intervalMs = POLL_INTERVAL_MS,
  getNow = Date.now,
} = {}) => {
  const stateHistory = [];
  const seenStates = new Set();

  const collectState = () => {
    const stateId = readCurrentGameState(modules);
    if (stateId && !seenStates.has(stateId)) {
      seenStates.add(stateId);
      stateHistory.push(stateId);
    }
  };

  diagnostics.runtimeSceneTimeoutMs = timeoutMs;
  const startedAt = getNow();

  while (true) {
    collectState();
    const sceneName = runtimeWindow.cc?.director?.getScene?.()?.name ?? null;
    const stateId = readCurrentGameState(modules);

    diagnostics.gameStateHistory = stateHistory;
    diagnostics.runtimeSnapshotAfterLauncher = getRuntimeSnapshot(modules, runtimeWindow);

    const explicitFailure = classifyRuntimeLoadFailure({
      stateId,
      sceneName,
      diagnostics,
      timedOut: false,
    });
    if (explicitFailure) {
      return {
        ok: false,
        stateId,
        sceneName,
        message: explicitFailure.message,
      };
    }

    if (isRuntimeReadySceneForReplay({ sceneName })) {
      return {
        ok: true,
        sceneName,
        stateId,
      };
    }

    if (getNow() - startedAt >= timeoutMs) {
      const timeoutFailure = classifyRuntimeLoadFailure({
        stateId,
        sceneName,
        diagnostics,
        timedOut: true,
      });
      return {
        ok: false,
        stateId,
        sceneName,
        message:
          timeoutFailure?.message
          || "浏览器模式运行时仍在加载 Game scene，尚未拿到明确失败信号。",
      };
    }

    await wait(runtimeWindow, intervalMs);
  }
};

const describeReplayStartPanel = (value) => {
  if (!value) {
    return null;
  }
  if (typeof value === "string") {
    return value;
  }
  return value.__classname__ || value.panelName || value.name || value.constructor?.name || String(value);
};

export const installReplayBattleStartProbe = ({
  modules,
  runtimeWindow = getRuntimeWindow(),
  diagnostics,
} = {}) => {
  const runtimeRequire = runtimeWindow.__require;
  const battleUIManagerModule = modules?.BattleUIManager
    || (typeof runtimeRequire === "function"
      ? readRequireResultModule(safeRequireModule(runtimeRequire, "BattleUIManager"))
      : null);
  let replayStartEvent = null;
  diagnostics.replayStartSignal = false;
  diagnostics.replayStartPanel = null;
  diagnostics.replayStartIsReplay = null;
  diagnostics.replayStartMapId = null;
  diagnostics.replayStartBattleMode = null;

  const restoreCallbacks = [];
  const recordReplayStartEvent = (event) => {
    diagnostics.replayStartObservedCalls = [
      ...(diagnostics.replayStartObservedCalls || []),
      event,
    ];
    if (!event.isReplay) {
      return;
    }
    replayStartEvent = event;
    diagnostics.replayStartSignal = true;
    diagnostics.replayStartPanel = event.panel;
    diagnostics.replayStartIsReplay = event.isReplay;
    diagnostics.replayStartMapId = event.mapId;
    diagnostics.replayStartBattleMode = event.battleMode;
  };

  const patchShowBattleLoading = (target, label) => {
    const previousShowBattleLoading = target?.showBattleLoading;
    if (!target || typeof previousShowBattleLoading !== "function") {
      return false;
    }

    const patchedShowBattleLoading = function patchedShowBattleLoading(...args) {
      const [panel, _loadingPanel, battleInput, isReplay] = args;
      recordReplayStartEvent({
        label,
        panel: describeReplayStartPanel(panel),
        isReplay: isReplay === true,
        mapId: battleInput?.mapId ?? null,
        battleMode: battleInput?.battleData?.mode ?? null,
      });
      return previousShowBattleLoading.apply(this, args);
    };

    target.showBattleLoading = patchedShowBattleLoading;
    restoreCallbacks.push(() => {
      if (target.showBattleLoading === patchedShowBattleLoading) {
        target.showBattleLoading = previousShowBattleLoading;
      }
    });
    return true;
  };

  const hasProbe = (
    patchShowBattleLoading(
      battleUIManagerModule?.BattleUIManager?.prototype,
      "BattleUIManager.prototype.showBattleLoading",
    )
    || patchShowBattleLoading(
      battleUIManagerModule,
      "BattleUIManager.showBattleLoading",
    )
    || patchShowBattleLoading(
      runtimeWindow.BattleUIManager,
      "window.BattleUIManager.showBattleLoading",
    )
  );

  return {
    async waitForSignal({ timeoutMs = REPLAY_START_TIMEOUT_MS } = {}) {
      if (replayStartEvent) {
        return {
          ok: true,
          ...replayStartEvent,
        };
      }

      if (!hasProbe) {
        return {
          ok: false,
          message: "运行时未找到 showBattleLoading 探针挂载点。",
        };
      }

      try {
        await waitForValue({
          read: () => replayStartEvent,
          runtimeWindow,
          timeoutMs,
          timeoutMessage: "Replay start probe timed out.",
        });
      } catch {
        return {
          ok: false,
          message: "已调用回放入口，但未观测到 showBattleLoading(..., true, ...) 启动信号。",
        };
      }

      return replayStartEvent
        ? {
            ok: true,
            ...replayStartEvent,
          }
        : {
            ok: false,
            message: "回放启动探针未返回有效事件。",
          };
    },
    dispose() {
      while (restoreCallbacks.length > 0) {
        restoreCallbacks.pop()?.();
      }
    },
  };
};

const toReplayExportPathLabel = (exportPathArr = []) => exportPathArr.join(".");

const buildReplayEntrypointLabel = (source, moduleId, exportPathArr) =>
  formatReplayEntrypointLabel(source || "window", moduleId, toReplayExportPathLabel(exportPathArr));

const getModuleCheckError = (moduleCheck) =>
  moduleCheck?.errorMessage || moduleCheck?.error || null;

const getFirstCanonicalRequireExecError = (moduleChecks = {}) => {
  for (const moduleId of REPLAY_CANONICAL_MODULE_IDS) {
    const moduleCheck = moduleChecks?.[moduleId];
    if (moduleCheck?.status === "require-threw") {
      return {
        moduleId,
        ...moduleCheck,
      };
    }
  }
  return null;
};

const getMissingCanonicalModuleIds = (moduleChecks = {}) =>
  REPLAY_CANONICAL_MODULE_IDS.filter((moduleId) => moduleChecks?.[moduleId]?.missing === true);

const formatRequireFingerprintSummary = (fingerprint) =>
  fingerprint
    ? `${fingerprint.name || "anonymous"}#${fingerprint.length}`
    : "-";

const formatReplaySummaryFieldValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
};

const hasOwnReplaySummaryField = (value, key) =>
  Boolean(value) && Object.prototype.hasOwnProperty.call(value, key);

const hasModernPublicReplayBridgeSummaryFields = (diagnostics) =>
  Boolean(
    diagnostics
    && [
      "primaryRisk",
      "rankedTargets",
      "minimumPlayableScore",
      "targetRejectedReason",
      "targetBlacklisted",
      "targetLooksGetterLike",
      "targetLooksMetadataLike",
      "visualPostCheck",
    ].every((key) => hasOwnReplaySummaryField(diagnostics, key)),
  );

const classifyPublicReplayBridgeSummaryStaleness = (diagnostics) => {
  if (diagnostics?.loaderFamily !== REPLAY_LOADER_FAMILIES.PUBLIC) {
    return null;
  }

  const status = diagnostics?.replayEntrypointInvokeStatus || diagnostics?.bridgeStatus || null;
  const hasLegacyStyleSignals = status === "played-via-production-bridge"
    || (
      (diagnostics?.playTargetScore == null || diagnostics?.playTargetScore === "-")
      && Array.isArray(diagnostics?.playTargetWhy)
      && diagnostics.playTargetWhy.length === 0
      && diagnostics?.visualPostCheck?.skipped != null
    )
    || diagnostics?.visualPostCheck?.skipped === "service-bridge-no-visual-probe"
    || !hasModernPublicReplayBridgeSummaryFields(diagnostics)
    || !hasOwnReplaySummaryField(diagnostics, "minimumPlayableScore")
    || !hasOwnReplaySummaryField(diagnostics, "targetRejectedReason")
    || !hasOwnReplaySummaryField(diagnostics, "targetBlacklisted")
    || !hasOwnReplaySummaryField(diagnostics, "targetLooksGetterLike")
    || !hasOwnReplaySummaryField(diagnostics, "targetLooksMetadataLike")
    || !hasOwnReplaySummaryField(diagnostics, "visualPostCheck");
  if (hasLegacyStyleSignals) {
    return "stale-probe-assets-or-summary";
  }

  const hasBridgeSignal = Boolean(
    diagnostics?.bridgeStatus
    || diagnostics?.bridgeSource
    || diagnostics?.replayEntrypointInvokeStatus
    || String(diagnostics?.replayEntrypoint || "").includes("__xyzwReplayBridge"),
  );

  if (hasBridgeSignal && !hasModernPublicReplayBridgeSummaryFields(diagnostics)) {
    return "stale-probe-assets-or-summary";
  }

  return null;
};

const getPublicReplaySummaryStatus = (diagnostics) => {
  const explicitStatus = diagnostics?.replayEntrypointInvokeStatus || diagnostics?.bridgeStatus || null;
  if (
    [
      "bridge-play-target-threw",
      "bridge-exposed-but-play-target-missing",
      "target-discovery-empty-after-blacklist",
      "candidate-space-too-narrow",
      "bridge-target-blacklisted",
      "bridge-target-low-confidence",
      "bridge-target-selected-but-not-playlike",
      "played-via-production-bridge-but-no-visual-change",
      "played-via-production-bridge-and-visual-changed",
    ].includes(explicitStatus)
  ) {
    return explicitStatus;
  }

  const hasProductionBridgeSignal = Boolean(
    diagnostics?.playTargetLabel
    || String(diagnostics?.replayEntrypoint || "").includes("__xyzwReplayBridge")
    || String(diagnostics?.bridgeSource || "").includes("__xyzwReplayBridge"),
  );

  if (hasProductionBridgeSignal && diagnostics?.replayStartSignal === false) {
    return "played-via-production-bridge-but-no-visual-change";
  }

  if (hasProductionBridgeSignal && diagnostics?.replayStartSignal === true) {
    return "played-via-production-bridge-and-visual-changed";
  }

  return explicitStatus;
};

const buildPublicReplaySummaryDetail = (diagnostics) => {
  const rankedTargets = Array.isArray(diagnostics?.rankedTargets)
    ? diagnostics.rankedTargets.slice(0, REPLAY_PRODUCTION_SUMMARY_TARGET_LIMIT)
    : [];
  return [
    `loaderFamily=${formatReplaySummaryFieldValue(diagnostics?.loaderFamily)}`,
    `bridgeStatus=${formatReplaySummaryFieldValue(diagnostics?.bridgeStatus)}`,
    `primaryRisk=${formatReplaySummaryFieldValue(diagnostics?.primaryRisk)}`,
    `playTargetLabel=${formatReplaySummaryFieldValue(diagnostics?.playTargetLabel)}`,
    `playTargetScore=${formatReplaySummaryFieldValue(diagnostics?.playTargetScore)}`,
    `playTargetWhy=${formatReplaySummaryFieldValue(diagnostics?.playTargetWhy)}`,
    `targetRejectedReason=${formatReplaySummaryFieldValue(diagnostics?.targetRejectedReason)}`,
    `targetBlacklisted=${formatReplaySummaryFieldValue(diagnostics?.targetBlacklisted)}`,
    `targetLooksGetterLike=${formatReplaySummaryFieldValue(diagnostics?.targetLooksGetterLike)}`,
    `targetLooksMetadataLike=${formatReplaySummaryFieldValue(diagnostics?.targetLooksMetadataLike)}`,
    `minimumPlayableScore=${formatReplaySummaryFieldValue(diagnostics?.minimumPlayableScore)}`,
    `candidateDiscoverySources=${formatReplaySummaryFieldValue(diagnostics?.candidateDiscoverySources ?? [])}`,
    `candidateSpaceTooNarrow=${formatReplaySummaryFieldValue(diagnostics?.candidateSpaceTooNarrow)}`,
    `buttonHandlerCandidates=${formatReplaySummaryFieldValue(diagnostics?.buttonHandlerCandidates ?? [])}`,
    `interactionTraceCandidates=${formatReplaySummaryFieldValue(diagnostics?.interactionTraceCandidates ?? [])}`,
    `targetDiscoverySummary=${formatReplaySummaryFieldValue(diagnostics?.targetDiscoverySummary ?? null)}`,
    `rankedTargets=${formatReplaySummaryFieldValue(rankedTargets)}`,
    `payloadShapeBefore=${formatReplaySummaryFieldValue(diagnostics?.payloadShapeBefore ?? diagnostics?.payloadShapeDefault ?? null)}`,
    `payloadShapeAfter=${formatReplaySummaryFieldValue(diagnostics?.payloadShapeAfter ?? null)}`,
    `visualPostCheck=${formatReplaySummaryFieldValue(diagnostics?.visualPostCheck ?? null)}`,
    `showBattleLoading=${formatReplaySummaryFieldValue(diagnostics?.visualProbeCapabilities?.showBattleLoading)}`,
    `runtimeStage=${formatReplaySummaryFieldValue(diagnostics?.runtimeStage)}`,
    `scene=${formatReplaySummaryFieldValue(diagnostics?.sceneName || diagnostics?.scene || null)}`,
    `suspectedBundlePath=${formatReplaySummaryFieldValue(diagnostics?.suspectedBundlePath)}`,
  ].join("；");
};

const buildPublicReplayBridgeFailureLead = (diagnostics) => {
  const staleReason = classifyPublicReplayBridgeSummaryStaleness(diagnostics);
  if (staleReason === "stale-probe-assets-or-summary") {
    return "当前页面未消费最新 public/replay-runtime-probe.js，或外层 summarizer 仍在使用旧状态映射；当前应归类为 stale-probe-assets-or-summary。";
  }

  const status = getPublicReplaySummaryStatus(diagnostics);
  const riskLeadMap = {
    "candidate-discovery-risk": "当前主风险是 candidate-discovery-risk，应优先扩展 replay UI 相关的候选发现空间，而不是继续围绕 payload 或 showBattleLoading 下结论。",
    "target-selection-risk": "当前主风险是 target-selection-risk，应优先复核 playTargetScore/Why 与 rankedTargets，判断是否选错了 production target。",
    "payload-shape-risk": "当前主风险是 payload-shape-risk，应优先比对 payloadShapeBefore/After，确认 production bridge 下游收到的输入形状是否正确。",
    "visual-side-effect-missing": "当前主风险是 visual-side-effect-missing，应优先检查 visualPostCheck，判断目标调用后是否完全没有画面级 side effect。",
    "runtime-not-ready-for-scene-scan": "当前主风险是 runtime-not-ready-for-scene-scan：runtime 还没有进入可扫描的 scene，不应再把 blank-screen 归因为 showBattleLoading 或 source-era 入口。",
    "target-discovery-empty": "当前主风险是 target-discovery-empty：scene/global 扫描结果仍为空，更像是 production target 尚未挂出或发现规则过窄。",
  };
  const statusLeadMap = {
    "bridge-play-target-threw": "运行时已进入 Game，并已加载 production replay bridge。当前 bridge 已解析到播放目标，但目标调用本身抛出了运行时异常。",
    "bridge-exposed-but-play-target-missing": "运行时已进入 Game，并已加载 production replay bridge，但当前还没有解析到稳定的 production 播放目标。",
    "target-discovery-empty-after-blacklist": "运行时已进入 Game，并已加载 production replay bridge。当前候选空间只发现了被 blacklist 或拒绝的 handler，discovery 后仍然没有可播放 target。",
    "candidate-space-too-narrow": "运行时已进入 Game，并已加载 production replay bridge。当前候选发现空间过窄，只发现了静态 service handlers，尚未触达 replay-like UI handlers、按钮 clickEvents 或真实交互链。",
    "bridge-target-blacklisted": "运行时已进入 Game，并已解析到一个候选 target，但它明显属于 getter 或 error/audio/video/ad/effect 服务路径，当前不会被当作可播放 target 调用。",
    "bridge-target-low-confidence": "运行时已进入 Game，并已解析到一个候选 target，但它只有弱 play 信号，没有足够的 replay-specific 理由，当前不会触发 invoke。",
    "bridge-target-selected-but-not-playlike": "运行时已进入 Game，并已解析到一个候选 target，但它虽然带 battle/fight/pvp 上下文，仍缺少 payload affinity 或 replay-specific 证据，当前不会触发 invoke。",
    "played-via-production-bridge-but-no-visual-change": "运行时已进入 Game，并已调用 production replay bridge，但当前没有观测到可靠的画面级变化。",
    "played-via-production-bridge-and-visual-changed": "运行时已进入 Game，并已调用 production replay bridge，且当前已观测到画面级变化。",
  };
  const lead = statusLeadMap[status]
    || "运行时已进入 Game，并已加载 production replay bridge。showBattleLoading 未找到仅为可选 visual probe，不构成主失败原因。";
  const riskLead = riskLeadMap[diagnostics?.primaryRisk] || "";
  return [lead, riskLead].filter(Boolean).join(" ");
};

const buildPublicReplayBridgeFailureMessage = (diagnostics) => {
  const detail = buildPublicReplaySummaryDetail(diagnostics);
  return `${buildPublicReplayBridgeFailureLead(diagnostics)} ${detail}`.trim();
};

const detectReplayLoaderFamily = (gameWindow) =>
  detectLoaderFamilyShared(gameWindow);

const inspectReplayLoaderFamily = (
  rootWindow = null,
  {
    probeFamily = REPLAY_PROBE_FAMILIES.PRODUCTION,
  } = {},
) => inspectLoaderFamilyShared(rootWindow, { probeFamily });

const findExposedReplayBridge = (
  runtimeWindow = getRuntimeWindow(),
  gameWindow = runtimeWindow,
) => {
  const bridgeCandidates = [
    {
      label: "gameWindow.__xyzwReplayBridge",
      value: gameWindow?.__xyzwReplayBridge || null,
    },
    {
      label: "window.__xyzwReplayBridge",
      value: runtimeWindow?.__xyzwReplayBridge || null,
    },
    {
      label: "gameWindow.__xyzwReplay",
      value: gameWindow?.__xyzwReplay || null,
    },
    {
      label: "window.__xyzwReplay",
      value: runtimeWindow?.__xyzwReplay || null,
    },
  ];
  const matched = bridgeCandidates.find((entry) =>
    entry.value
    && entry.value.__xyzwReplayBridgeReady === true
    && (typeof entry.value.inspect === "function" || typeof entry.value.play === "function"),
  ) || null;

  return {
    bridge: matched?.value || null,
    hasInspect: typeof matched?.value?.inspect === "function",
    hasPlay: typeof matched?.value?.play === "function",
    source: matched?.label || null,
    status: matched ? "present" : "bridge-not-exposed",
  };
};

const createBridgeNotExposedResult = ({
  loaderFamily,
  bridgeSource = null,
} = {}) => ({
  ok: false,
  status: "bridge-not-exposed",
  value: null,
  detail: `The ${loaderFamily || REPLAY_LOADER_FAMILIES.PUBLIC} runtime has no stable replay bridge exposed yet.`,
  bridgeSource,
});

export const requireModule = (gameWindow, moduleId) => {
  if (!gameWindow) {
    return {
      ok: false,
      status: "wrong-window",
      moduleId,
      value: null,
      error: null,
      errorName: null,
      errorMessage: null,
      stackTop: null,
      detail: "game window is unavailable.",
    };
  }

  if (typeof gameWindow?.__require !== "function") {
    return {
      ok: false,
      status: "wrong-loader",
      moduleId,
      value: null,
      error: null,
      errorName: null,
      errorMessage: null,
      stackTop: null,
      detail: "gameWindow.__require is unavailable.",
    };
  }

  if (!REPLAY_CANONICAL_MODULE_ID_SET.has(moduleId)) {
    return {
      ok: false,
      status: "wrong-module-id",
      moduleId,
      value: null,
      error: null,
      errorName: null,
      errorMessage: null,
      stackTop: null,
      detail: `${moduleId} is not a valid replay probe module id.`,
    };
  }

  const loaderFamilyInfo = detectReplayLoaderFamily(gameWindow);
  if (loaderFamilyInfo.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC) {
    return {
      ok: false,
      status: "module-id-family-mismatch",
      moduleId,
      value: null,
      error: null,
      errorName: null,
      errorMessage: `${moduleId} is a source-era probe and is incompatible with ${loaderFamilyInfo.loaderFamily}.`,
      stackTop: null,
      detail: "The current live loader belongs to the public/xyzw family, so source-era module ids must not be used here.",
    };
  }

  const moduleProbe = probeXyzwRuntimeModule(gameWindow, moduleId);
  if (moduleProbe.ok) {
    return {
      ok: true,
      status: "present",
      moduleId,
      value: moduleProbe.value,
      error: null,
      errorName: null,
      errorMessage: null,
      stackTop: null,
      detail: null,
    };
  }

  const runtimeLayerInfo = detectXyzwRuntimeLayerShared(gameWindow, {
    windowLabel: "window",
    probeFamily: REPLAY_PROBE_FAMILIES.SOURCE,
  });
  const moduleChecks
    = runtimeLayerInfo.details?.canonicalModuleChecks
      || runtimeLayerInfo.details?.moduleChecks
      || {};
  const moduleCheck = moduleChecks?.[moduleId] || null;
  const status = moduleProbe.missing
    ? "wrong-loader"
    : "require-exec-error";
  const errorMessage = moduleProbe.errorMessage || moduleProbe.error || getModuleCheckError(moduleCheck);
  const errorName = moduleProbe.errorName || moduleCheck?.errorName || null;
  const stackTop = moduleProbe.stackTop || moduleCheck?.stackTop || null;

  return {
    ok: false,
    status,
    moduleId,
    value: null,
    error: errorMessage,
    errorName,
    errorMessage,
    stackTop,
    detail:
      buildRuntimeLayerDetail(runtimeLayerInfo),
  };
};

export const resolveExport = (obj, exportPathArr) => {
  const exportPath = Array.isArray(exportPathArr) ? [...exportPathArr] : [];
  let current = obj;

  for (const segment of exportPath) {
    if (
      current == null
      || !(
        (typeof current === "object" || typeof current === "function")
        && segment in current
      )
    ) {
      return {
        ok: false,
        status: "wrong-export-path",
        value: null,
        error: null,
        detail: `missing export segment "${segment}" while resolving ${toReplayExportPathLabel(exportPath)}.`,
      };
    }
    current = current[segment];
  }

  if (typeof current !== "function") {
    return {
      ok: false,
      status: "not-callable",
      value: current,
      error: null,
      detail: `${toReplayExportPathLabel(exportPath)} resolved to ${typeof current}, not a function.`,
    };
  }

  return {
    ok: true,
    status: "present",
    value: current,
    error: null,
    detail: null,
  };
};

export const probeRequireExport = (gameWindow, moduleId, exportPathArr) => {
  const moduleResult = requireModule(gameWindow, moduleId);
  if (!moduleResult.ok) {
    return {
      ok: false,
      status: moduleResult.status,
      moduleId,
      exportPath: [...(exportPathArr || [])],
      moduleResult,
      exportResult: null,
      value: null,
      error: moduleResult.errorMessage || moduleResult.error,
      errorMessage: moduleResult.errorMessage || moduleResult.error,
      stackTop: moduleResult.stackTop || null,
      detail: moduleResult.detail,
    };
  }

  const exportResult = resolveExport(moduleResult.value, exportPathArr);
  return {
    ok: exportResult.ok,
    status: exportResult.status,
    moduleId,
    exportPath: [...(exportPathArr || [])],
    moduleResult,
    exportResult,
    value: exportResult.value,
    error: exportResult.error,
    errorMessage: exportResult.error,
    stackTop: null,
    detail: exportResult.detail,
  };
};

export const probeRequireError = (gameWindow) => {
  const result = Object.fromEntries(
    REPLAY_CANONICAL_MODULE_IDS.map((moduleId) => [
      moduleId,
      requireModule(gameWindow, moduleId),
    ]),
  );
  console.log("[xyzw replay] probeRequireError", result);
  return result;
};

export const waitForReplayGameBundleReady = async ({
  gameWindow,
  runtimeWindow = gameWindow || getRuntimeWindow(),
  attempts = REPLAY_GAME_BUNDLE_READY_ATTEMPTS,
  intervalMs = REPLAY_GAME_BUNDLE_READY_INTERVAL_MS,
} = {}) =>
  ensureXyzwGameBundleReadyShared({
    gameWindow,
    runtimeWindow,
    timeoutMs: attempts * intervalMs,
    intervalMs,
    windowLabel: "window",
  });

const createBattleKitCrossSiteReplayInvoker = (moduleValue) => {
  const instance = moduleValue?.BattleKitCrossSite?.instance || null;
  if (!instance || typeof instance.tryRaisePlayback !== "function") {
    return null;
  }

  return (payload) => {
    instance._inputData = payload;
    instance._initBattleData = instance._initBattleData || { replayOnly: true };
    instance._stage = 2;
    instance._isApplicationLoaded = true;
    return instance.tryRaisePlayback(true);
  };
};

const createReplayEntrypointInvoker = (gameWindow, moduleId, exportPathArr) => {
  if (
    moduleId === "BattleUIManager"
    && exportPathArr.length === 1
    && exportPathArr[0] === "SHOW_BATTLE_REPLAY_UI"
  ) {
    return (payload) => getLiveRequire(gameWindow)("BattleUIManager").SHOW_BATTLE_REPLAY_UI(payload);
  }

  if (
    moduleId === "BattleUIManager"
    && exportPathArr.length === 3
    && exportPathArr[0] === "BattleUIManager"
    && exportPathArr[1] === "instance"
    && exportPathArr[2] === "showBattleReplayUI"
  ) {
    return (payload) => getLiveRequire(gameWindow)("BattleUIManager").BattleUIManager.instance.showBattleReplayUI(payload);
  }

  if (
    moduleId === "enter-oss"
    && exportPathArr.length === 3
    && exportPathArr[0] === "EnterOSSState"
    && exportPathArr[1] === "prototype"
    && exportPathArr[2] === "showBattleViewWithData"
  ) {
    return (payload) => {
      const { EnterOSSState } = getLiveRequire(gameWindow)("enter-oss");
      return new EnterOSSState().showBattleViewWithData(payload);
    };
  }

  if (
    moduleId === "BattleKitCrossSite"
    && exportPathArr.length === 3
    && exportPathArr[0] === "BattleKitCrossSite"
    && exportPathArr[1] === "instance"
    && exportPathArr[2] === "tryRaisePlayback"
  ) {
    return (payload) => {
      const moduleValue = getLiveRequire(gameWindow)("BattleKitCrossSite");
      const invoker = createBattleKitCrossSiteReplayInvoker(moduleValue);
      if (typeof invoker !== "function") {
        throw new TypeError("BattleKitCrossSite replay invoker is unavailable from the live require.");
      }
      return invoker(payload);
    };
  }

  return null;
};

const buildReplayProbeReport = ({
  gameWindow,
  gameWindowInfo,
  diagnostics = {},
} = {}) => {
  const runtimeWindow = getRuntimeWindow();
  const resolvedGameWindowInfo = gameWindowInfo || findReplayGameWindow(runtimeWindow);
  const resolvedGameWindow = gameWindow || resolvedGameWindowInfo.gameWindow || null;
  const source = resolvedGameWindowInfo.source || null;
  const loaderLabel = formatReplayGameWindowSourceLabel(source || "window");
  const loaderFamilyInfo = detectReplayLoaderFamily(resolvedGameWindow);
  const probeFamily = loaderFamilyInfo.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
    ? REPLAY_PROBE_FAMILIES.PRODUCTION
    : REPLAY_PROBE_FAMILIES.SOURCE;
  const runtimeLayerInfo = detectXyzwRuntimeLayerShared(resolvedGameWindow, {
    windowLabel: loaderLabel,
    probeFamily,
  });
  const bundleState = inspectBundleStateShared(runtimeWindow, { probeFamily });
  const loaderInspection = inspectReplayLoaderFamily(runtimeWindow, { probeFamily });
  const bridgeInfo = findExposedReplayBridge(runtimeWindow, resolvedGameWindow);
  const bridgeInspection = loaderFamilyInfo.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
    && bridgeInfo.hasInspect
    ? (() => {
        try {
          return bridgeInfo.bridge.inspect();
        } catch (error) {
          return {
            bridgeStatus: "bridge-inspect-threw",
            bridgeTargetError: toErrorMessage(error, "Production bridge inspect failed."),
            bridgeTargetStackTop: getReplayStackTop(error),
          };
        }
      })()
    : null;
  const candidates = [];
  const requireDebug = [];
  const seenModuleIds = new Set();

  diagnostics.replayEntrypointCandidates = candidates;
  diagnostics.replayEntrypointRequireDebug = requireDebug;
  diagnostics.replayGameWindowSource = source;
  diagnostics.replayGameWindowStatus = resolvedGameWindowInfo.status || "no-require";
  diagnostics.loaderFamily = runtimeLayerInfo.details?.loaderFamily || loaderFamilyInfo.loaderFamily;
  diagnostics.loaderFamilyEvidence = runtimeLayerInfo.details?.loaderFamilyEvidence || loaderFamilyInfo.evidence;
  diagnostics.probeFamily = probeFamily;
  diagnostics.probeCompatibility = runtimeLayerInfo.details?.probeCompatibility ?? loaderInspection.probeCompatibility ?? "compatible-probe";
  diagnostics.bridgeExposure = Boolean(bridgeInfo.bridge);
  diagnostics.bridgeStatus = bridgeInspection?.bridgeStatus || bridgeInfo.status;
  diagnostics.bridgeSource = bridgeInfo.source || null;
  diagnostics.runtimeLayer = runtimeLayerInfo.layer;
  diagnostics.runtimeStage = runtimeLayerInfo.layer;
  diagnostics.bundleState = bundleState;
  diagnostics.scene = runtimeLayerInfo.details?.scene ?? runtimeLayerInfo.details?.sceneName ?? null;
  diagnostics.sceneName = runtimeLayerInfo.details?.sceneName ?? null;
  diagnostics.gameBundleRequested = Boolean(runtimeLayerInfo.details?.gameBundleRequested);
  diagnostics.gameBundleLoaded = Boolean(runtimeLayerInfo.details?.gameBundleLoaded);
  diagnostics.gameSceneAssetLoaded = Boolean(runtimeLayerInfo.details?.gameSceneAssetLoaded);
  diagnostics.gameSceneRunning = Boolean(runtimeLayerInfo.details?.gameSceneRunning);
  diagnostics.battleModulesReady = Boolean(runtimeLayerInfo.details?.battleModulesReady);
  diagnostics.sameRequireSource = runtimeLayerInfo.details?.sameRequireSource ?? null;
  diagnostics.sameRequireRef = runtimeLayerInfo.details?.sameRequireRef ?? null;
  diagnostics.hasRequireSwap = Boolean(runtimeLayerInfo.details?.hasRequireSwap);
  diagnostics.requireSwap = Boolean(runtimeLayerInfo.details?.requireSwap);
  diagnostics.requireFunctionName = runtimeLayerInfo.details?.requireFunctionName ?? null;
  diagnostics.launcherRequireFingerprint = runtimeLayerInfo.details?.launcherRequireFingerprint ?? null;
  diagnostics.launcherRequireFunctionName = runtimeLayerInfo.details?.launcherRequireFunctionName ?? null;
  diagnostics.liveRequireFingerprint = runtimeLayerInfo.details?.liveRequireFingerprint ?? null;
  diagnostics.loadBundleCalls = runtimeLayerInfo.details?.loadBundleCalls || [];
  diagnostics.tryLoadAssetCalls = runtimeLayerInfo.details?.tryLoadAssetCalls || [];
  diagnostics.runSceneCalls = runtimeLayerInfo.details?.runSceneCalls || [];
  diagnostics.gameScriptInDocument = Boolean(runtimeLayerInfo.details?.gameScriptInDocument);
  diagnostics.gameScriptInPerformance = Boolean(runtimeLayerInfo.details?.gameScriptInPerformance);
  diagnostics.moduleChecks = runtimeLayerInfo.details?.canonicalModuleChecks || runtimeLayerInfo.details?.moduleChecks || {};
  diagnostics.incompatibleProbes = runtimeLayerInfo.details?.incompatibleProbes || [];
  diagnostics.suspectedBundlePath = runtimeLayerInfo.details?.suspectedBundlePath ?? loaderFamilyInfo.suspectedBundlePath ?? null;
  diagnostics.fallbackEntrypointUsed = false;
  diagnostics.fallbackEntrypointReason = null;
  diagnostics.enterOssAvailableButRejected = false;
  diagnostics.battleKitAvailableButRejected = false;
  diagnostics.availableGlobals = bridgeInspection?.availableGlobals || [];
  diagnostics.sceneNodeMatches = bridgeInspection?.sceneNodeMatches || [];
  diagnostics.sceneComponentMatches = bridgeInspection?.sceneComponentMatches || [];
  diagnostics.playMethodCandidates = bridgeInspection?.playMethodCandidates || [];
  diagnostics.playTargetLabel = bridgeInspection?.playTargetLabel || null;
  diagnostics.playTargetSource = bridgeInspection?.playTargetSource || null;

  const currentWindowLoaderStatus = typeof runtimeWindow?.__require === "function"
    ? "present"
    : diagnostics.replayGameWindowStatus === "wrong-window"
      ? "wrong-window"
      : "no-require";
  requireDebug.push({
    label: "window.__require",
    moduleId: null,
    source: "window",
    status: currentWindowLoaderStatus,
    detail:
      currentWindowLoaderStatus === "wrong-window"
        ? `当前页面没有 window.__require，已切换到 ${loaderLabel}.__require。`
        : currentWindowLoaderStatus === "no-require"
          ? "当前页面和可见 iframe 中都没有可用的 window.__require。"
          : null,
    error: null,
    errorMessage: null,
    keys: [],
    launcherRequireFingerprint: bundleState.launcherRequireFingerprint || null,
    liveRequireFingerprint: bundleState.liveRequireFingerprint || null,
    sameRequireSource: bundleState.sameRequireSource ?? null,
    stackTop: null,
  });
  if (diagnostics.replayGameWindowStatus === "wrong-window" && source) {
    requireDebug.push({
      label: `${loaderLabel}.__require`,
      moduleId: null,
      source,
      status: "present",
      detail: null,
      error: null,
      errorMessage: null,
      keys: [],
      launcherRequireFingerprint: runtimeLayerInfo.details?.launcherRequireFingerprint ?? null,
      liveRequireFingerprint: runtimeLayerInfo.details?.liveRequireFingerprint ?? null,
      sameRequireSource: runtimeLayerInfo.details?.sameRequireSource ?? null,
      stackTop: null,
    });
  }

  let resolvedEntrypoint = null;
  let battleUiManagerModuleStatus = diagnostics.replayGameWindowStatus;
  let battleUiManagerModuleFound = false;

  if (loaderFamilyInfo.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC) {
    requireDebug.push({
      label: bridgeInfo.source || "window.__xyzwReplayBridge",
      moduleId: null,
      source,
      status: bridgeInspection?.bridgeStatus || bridgeInfo.status,
      detail: bridgeInfo.hasPlay
        ? bridgeInspection?.playTargetLabel
          ? `A production/public replay bridge is exposed via ${bridgeInspection.playTargetLabel}.`
          : "A production/public replay bridge is exposed, but a stable play target has not been resolved yet."
        : "No stable production/public replay bridge is currently exposed.",
      error: null,
      errorMessage: null,
      keys: [],
      stackTop: null,
    });
    for (const moduleId of REPLAY_CANONICAL_MODULE_IDS) {
      const moduleResult = requireModule(resolvedGameWindow, moduleId);
      requireDebug.push({
        label: formatReplayRequireCallLabel(source || "window", moduleId),
        moduleId,
        source,
        status: moduleResult.status,
        detail: moduleResult.detail,
        error: moduleResult.errorMessage || moduleResult.error || null,
        errorMessage: moduleResult.errorMessage || moduleResult.error || null,
        keys: [],
        stackTop: moduleResult.stackTop || null,
      });
    }
    battleUiManagerModuleStatus = "module-id-family-mismatch";
    battleUiManagerModuleFound = false;
    const bridgeCandidate = {
      kind: "bridge",
      moduleId: null,
      exportPath: [],
      label: bridgeInfo.source
        ? `${bridgeInfo.source}.play`
        : "window.__xyzwReplayBridge.play",
      status: bridgeInfo.hasPlay
        ? bridgeInspection?.bridgeStatus || "present"
        : "bridge-not-exposed",
      detail: bridgeInfo.hasPlay
        ? bridgeInspection?.playTargetLabel
          ? `A production/public replay bridge was discovered via ${bridgeInspection.playTargetLabel}.`
          : "A production/public replay bridge was discovered, but it has not resolved a stable play target yet."
        : "The current loader family is public-xyzw-loader, but no stable replay bridge has been exposed yet.",
      found: bridgeInfo.hasPlay,
      stackTop: null,
    };
    candidates.push(bridgeCandidate);
    if (bridgeInfo.hasPlay && bridgeInfo.bridge) {
      resolvedEntrypoint = {
        label: bridgeCandidate.label,
        invoke: (payload) => bridgeInfo.bridge.play(payload),
        gameWindow: resolvedGameWindow,
        source: bridgeInfo.source || source,
        kind: "bridge",
        moduleId: null,
        exportPath: [],
      };
    }
  } else {
    for (const probeConfig of REPLAY_ENTRYPOINT_PROBE_CONFIGS) {
      const probeResult = probeRequireExport(
        resolvedGameWindow,
        probeConfig.moduleId,
        probeConfig.exportPath,
      );
      const moduleResult = probeResult.moduleResult || null;
      if (!seenModuleIds.has(probeConfig.moduleId)) {
        seenModuleIds.add(probeConfig.moduleId);
        requireDebug.push({
          label: formatReplayRequireCallLabel(source || "window", probeConfig.moduleId),
          moduleId: probeConfig.moduleId,
          source,
          status:
            diagnostics.replayGameWindowStatus === "no-require"
              ? "no-require"
              : moduleResult?.status || probeResult.status,
          detail: moduleResult?.detail || probeResult.detail || null,
          error: moduleResult?.errorMessage || moduleResult?.error || probeResult.errorMessage || probeResult.error || null,
          errorMessage: moduleResult?.errorMessage || moduleResult?.error || probeResult.errorMessage || probeResult.error || null,
          keys: moduleResult?.ok ? toSafeModuleKeys(moduleResult.value) : [],
          stackTop: moduleResult?.stackTop || probeResult.stackTop || null,
        });
      }

      if (probeConfig.moduleId === "BattleUIManager") {
        battleUiManagerModuleStatus = moduleResult?.status || probeResult.status;
        battleUiManagerModuleFound = Boolean(moduleResult?.ok);
      }

      const status = diagnostics.replayGameWindowStatus === "no-require"
        ? "no-require"
        : probeResult.status;
      const candidate = {
        kind: probeConfig.kind,
        moduleId: probeConfig.moduleId,
        exportPath: [...probeConfig.exportPath],
        label: buildReplayEntrypointLabel(source || "window", probeConfig.moduleId, probeConfig.exportPath),
        status,
        detail:
          probeResult.detail
          || moduleResult?.detail
          || probeResult.errorMessage
          || probeResult.error
          || moduleResult?.errorMessage
          || moduleResult?.error
          || null,
        found: status === "present",
        stackTop: probeResult.stackTop || moduleResult?.stackTop || null,
      };
      candidates.push(candidate);

      if (!resolvedEntrypoint && candidate.found) {
        resolvedEntrypoint = {
          label: candidate.label,
          invoke: createReplayEntrypointInvoker(
            resolvedGameWindow,
            probeConfig.moduleId,
            probeConfig.exportPath,
          ),
          gameWindow: resolvedGameWindow,
          source,
          kind: probeConfig.kind,
          moduleId: probeConfig.moduleId,
          exportPath: [...probeConfig.exportPath],
        };
        if (typeof resolvedEntrypoint.invoke !== "function") {
          candidate.status = "not-callable";
          candidate.detail = `${toReplayExportPathLabel(probeConfig.exportPath)} resolved, but no invoke adapter is available.`;
          candidate.found = false;
          resolvedEntrypoint = null;
        }
      }
    }
  }

  for (const legacyItem of REPLAY_LEGACY_DEBUG_ITEMS) {
    requireDebug.push({
      label: legacyItem.label,
      moduleId: legacyItem.moduleId,
      source: "legacy-probe",
      status: legacyItem.status,
      detail: legacyItem.detail,
      error: null,
      errorMessage: null,
      keys: [],
      stackTop: null,
    });
  }

  diagnostics.battleUiManagerModuleStatus = battleUiManagerModuleStatus;
  diagnostics.battleUiManagerModuleFound = battleUiManagerModuleFound;

  return {
    entrypoint: resolvedEntrypoint,
    candidates,
    requireDebug,
  };
};

const inspectReplayEntrypoints = async (gameWindow = null) => {
  const runtimeWindow = getRuntimeWindow();
  const discoveredGameWindowInfo = findGameWindow(runtimeWindow);
  const resolvedGameWindowInfo = discoveredGameWindowInfo.gameWindow
    ? discoveredGameWindowInfo
    : gameWindow
      ? {
          gameWindow,
          source: runtimeWindow === gameWindow ? "window" : "bound-window",
          status: runtimeWindow === gameWindow ? "present" : "wrong-window",
          error: null,
          checkedIframes: [],
        }
      : discoveredGameWindowInfo;
  const resolvedGameWindow = resolvedGameWindowInfo.gameWindow || gameWindow || null;
  const loaderFamilyInfo = detectReplayLoaderFamily(resolvedGameWindow);
  const probeFamily = loaderFamilyInfo.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
    ? REPLAY_PROBE_FAMILIES.PRODUCTION
    : REPLAY_PROBE_FAMILIES.SOURCE;
  const bundleReadyInfo = await waitForBattleModulesReadyShared({
    gameWindow: resolvedGameWindow,
    runtimeWindow: resolvedGameWindow || runtimeWindow,
    probeFamily,
    windowLabel: formatReplayGameWindowSourceLabel(
      resolvedGameWindowInfo.source || (runtimeWindow === resolvedGameWindow ? "window" : "bound-window"),
    ),
  });
  const diagnostics = {
    replayGameBundleReady: bundleReadyInfo.ok,
    replayGameBundleReadyAttempts: bundleReadyInfo.attempts ?? 0,
    replayGameBundleReadyError: bundleReadyInfo.error || null,
    replayGameBundleReadySource: bundleReadyInfo.gameBundleReadySource || null,
    runtimeLayer: bundleReadyInfo.layer || null,
    runtimeStage: bundleReadyInfo.layer || null,
  };
  const { entrypoint } = buildReplayProbeReport({
    gameWindow: resolvedGameWindow,
    gameWindowInfo: resolvedGameWindowInfo,
    diagnostics,
  });

  return {
    ...diagnostics,
    replayEntrypoint: entrypoint?.label || null,
    engineReplayEntrypoint: entrypoint?.label || null,
  };
};

const inspectReplayRuntimeInputs = (gameWindow) => {
  const replayData = getReplaySource(gameWindow);
  const modules = {
    BattleUIManager: requireModule(gameWindow, "BattleUIManager"),
    enterOss: requireModule(gameWindow, "enter-oss"),
    battleKit: requireModule(gameWindow, "BattleKitCrossSite"),
  };

  const battleUIManager = modules.BattleUIManager.ok ? modules.BattleUIManager.value : null;
  const enterOss = modules.enterOss.ok ? modules.enterOss.value : null;
  const battleKit = modules.battleKit.ok ? modules.battleKit.value : null;

  return {
    hasGameWindow: Boolean(gameWindow),
    hasRequire: typeof gameWindow?.__require === "function",
    BattleUIManagerKeys: Object.keys(battleUIManager || {}),
    EnterOSSKeys: Object.keys(enterOss || {}),
    BattleKitCrossSiteKeys: Object.keys(battleKit || {}),
    showReplayType: typeof battleUIManager?.SHOW_BATTLE_REPLAY_UI,
    enterOSSCtorType: typeof enterOss?.EnterOSSState,
    enterOSSGetBattleDataByOSSType: typeof enterOss?.EnterOSSState?.prototype?.getBattleDataByOSS,
    enterOSSCreateBattleInputDataType:
      typeof enterOss?.EnterOSSState?.prototype?.createBattleInputData,
    crossSiteTryRaisePlaybackType:
      typeof battleKit?.BattleKitCrossSite?.instance?.tryRaisePlayback,
    replayData: replayData
      ? {
          isWrapped: Boolean(replayData?.battleData || replayData?.lastBattleData),
          isBattleInputLike: looksLikeBattleInput(replayData),
          mapId: replayData?.mapId,
          leftTeamGetType: typeof replayData?.battleData?.leftTeam?.team?.get,
          leftTeamForEachType: typeof replayData?.battleData?.leftTeam?.team?.forEach,
          rightTeamGetType: typeof replayData?.battleData?.rightTeam?.team?.get,
          rightTeamForEachType: typeof replayData?.battleData?.rightTeam?.team?.forEach,
        }
      : null,
  };
};

const scheduleReplayPostCheck = (gameWindow, prepared, logger = console.log) => {
  const runtimeWindow = gameWindow || getRuntimeWindow();
  runtimeWindow.setTimeout(() => {
    try {
      logger("[xyzw replay] post-check", {
        scene: runtimeWindow.cc?.director?.getScene?.()?.name,
        canvas: Boolean(runtimeWindow.cc?.game?.canvas),
        mapId: prepared?.mapId,
        mode: prepared?.battleData?.mode,
        leftTeamGetType: typeof prepared?.battleData?.leftTeam?.team?.get,
        rightTeamGetType: typeof prepared?.battleData?.rightTeam?.team?.get,
        leftTeamForEachType: typeof prepared?.battleData?.leftTeam?.team?.forEach,
        rightTeamForEachType: typeof prepared?.battleData?.rightTeam?.team?.forEach,
      });
    } catch (error) {
      console.warn("[xyzw replay] post-check failed", error);
    }
  }, 1200);
};

const createReplayConsoleHelpers = (gameWindow, {
  runtimeLayerInfo = detectXyzwRuntimeLayerShared(gameWindow, { windowLabel: "window" }),
  limited = false,
} = {}) => {
  const defineLiveRequireGetter = (helperTarget) => {
    Object.defineProperty(helperTarget, "req", {
      enumerable: true,
      get() {
        return getLiveRequire(gameWindow);
      },
    });
    return helperTarget;
  };
  const baseHelper = {
    inspectBundleState() {
      const probeFamily = runtimeLayerInfo?.details?.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
        ? REPLAY_PROBE_FAMILIES.PRODUCTION
        : REPLAY_PROBE_FAMILIES.SOURCE;
      const result = inspectBundleStateShared(getRuntimeWindow(), { probeFamily });
      console.log("[xyzw replay] inspectBundleState", result);
      baseHelper.result = result;
      return result;
    },
    inspectLoaderFamily() {
      const probeFamily = runtimeLayerInfo?.details?.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
        ? REPLAY_PROBE_FAMILIES.PRODUCTION
        : REPLAY_PROBE_FAMILIES.SOURCE;
      const result = inspectLoaderFamilyShared(getRuntimeWindow(), { probeFamily });
      console.log("[xyzw replay] inspectLoaderFamily", result);
      baseHelper.result = result;
      return result;
    },
    probeRequireError() {
      const result = probeRequireError(gameWindow);
      baseHelper.result = result;
      return result;
    },
    result: runtimeLayerInfo,
  };

  if (runtimeLayerInfo?.details?.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC) {
    const runtimeWindow = getRuntimeWindow();
    const productionBridge = buildProductionReplayBridge(gameWindow, {
      gameWindowSource: runtimeWindow === gameWindow ? "window" : "bound-window",
      runtimeWindow,
    });
    const helper = defineLiveRequireGetter({
      ...baseHelper,
      inspect() {
        const result = {
          ...productionBridge.inspect(),
          bundleState: baseHelper.inspectBundleState(),
          loaderInspection: baseHelper.inspectLoaderFamily(),
        };
        console.log("[xyzw replay] inspect", result);
        helper.result = result;
        return result;
      },
      play(rawOrWrappedData = getReplaySource(gameWindow), options = {}) {
        const result = productionBridge.play(rawOrWrappedData, options);
        if (!result?.ok) {
          console.warn("[xyzw replay] play via production bridge failed", result);
        }
        helper.result = result;
        return result;
      },
    });
    helper.__xyzwReplayDiagnosticHelper = true;
    helper.__xyzwReplayBridgeReady = true;
    return helper;
  }

  if (limited || runtimeLayerInfo?.layer !== "battle-modules-ready") {
    const helper = defineLiveRequireGetter(baseHelper);
    helper.__xyzwReplayDiagnosticHelper = true;
    helper.__xyzwReplayBridgeReady = false;
    return helper;
  }

  const helper = defineLiveRequireGetter({
    ...baseHelper,
    async inspect() {
      const result = {
        ...(await inspectReplayEntrypoints(gameWindow)),
        ...inspectReplayRuntimeInputs(gameWindow),
        bundleState: inspectBundleStateShared(getRuntimeWindow()),
        runtimeLayer: detectXyzwRuntimeLayerShared(gameWindow, { windowLabel: "window" }).layer,
        runtimeStage: detectXyzwRuntimeLayerShared(gameWindow, { windowLabel: "window" }).layer,
      };
      console.log("[xyzw replay] inspect", result);
      helper.result = result;
      return result;
    },
    showReplay(inputDataOrRaw = getReplaySource(gameWindow), options = {}) {
      const prepared = ensureReplayInputData(inputDataOrRaw, gameWindow, options);
      console.log("[xyzw replay] dispatch showReplay", {
        mapId: prepared?.mapId,
        mode: prepared?.battleData?.mode,
      });
      const ret = getLiveRequire(gameWindow)("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared, options);
      scheduleReplayPostCheck(gameWindow, prepared);
      helper.lastPrepared = prepared;
      return ret;
    },
    showReplayDirect(rawOrWrappedBattleData = getReplaySource(gameWindow), options = {}) {
      const prepared = ensureReplayInputData(rawOrWrappedBattleData, gameWindow, options);
      console.log("[xyzw replay] dispatch showReplayDirect", {
        mapId: prepared?.mapId,
        mode: prepared?.battleData?.mode,
      });
      const ret = getLiveRequire(gameWindow)("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared, options);
      scheduleReplayPostCheck(gameWindow, prepared);
      helper.lastPrepared = prepared;
      return ret;
    },
    showReplayViaEnterOSS(rawOrWrappedBattleData = getReplaySource(gameWindow)) {
      const { EnterOSSState } = getLiveRequire(gameWindow)("enter-oss");
      return new EnterOSSState().showBattleViewWithData(rawOrWrappedBattleData);
    },
    tryCrossSitePlayback(force = true) {
      const ret = getLiveRequire(gameWindow)("BattleKitCrossSite").BattleKitCrossSite.instance.tryRaisePlayback(force);
      console.log("[xyzw replay] tryCrossSitePlayback", { force, ret });
      return ret;
    },
  });
  helper.__xyzwReplayDiagnosticHelper = true;
  helper.__xyzwReplayBridgeReady = true;

  return helper;
};

export const exposeReplayConsoleHelpers = (gameWindow, {
  runtimeLayerInfo = detectXyzwRuntimeLayerShared(gameWindow, { windowLabel: "window" }),
} = {}) => {
  if (!gameWindow || typeof gameWindow.__require !== "function") {
    return {
      helper: null,
      result: null,
      dispose() {},
    };
  }

  const runtimeWindow = getRuntimeWindow();
  rememberLauncherRequireRef(gameWindow);
  const helper = createReplayConsoleHelpers(gameWindow, {
    runtimeLayerInfo,
    limited: runtimeLayerInfo?.layer !== "battle-modules-ready",
  });
  const previousGameWindowHelper = gameWindow.__xyzwReplay;
  const previousGameWindowBridge = gameWindow.__xyzwReplayBridge;
  const previousWindowHelper = runtimeWindow.__xyzwReplay;
  const previousWindowBridge = runtimeWindow.__xyzwReplayBridge;
  const previousWindowGameWindow = runtimeWindow.__xyzwReplayGameWindow;

  gameWindow.__xyzwReplay = helper;
  if (!previousGameWindowBridge || previousGameWindowBridge.__xyzwReplayDiagnosticHelper === true) {
    gameWindow.__xyzwReplayBridge = helper;
  }
  runtimeWindow.__xyzwReplay = helper;
  if (!previousWindowBridge || previousWindowBridge.__xyzwReplayDiagnosticHelper === true) {
    runtimeWindow.__xyzwReplayBridge = helper;
  }
  if (runtimeWindow !== gameWindow) {
    runtimeWindow.__xyzwReplayGameWindow = gameWindow;
  } else {
    delete runtimeWindow.__xyzwReplayGameWindow;
  }

  return {
    helper,
    result: helper.result,
    dispose() {
      if (previousGameWindowHelper === undefined) {
        delete gameWindow.__xyzwReplay;
      } else {
        gameWindow.__xyzwReplay = previousGameWindowHelper;
      }
      if (previousGameWindowBridge === undefined) {
        delete gameWindow.__xyzwReplayBridge;
      } else {
        gameWindow.__xyzwReplayBridge = previousGameWindowBridge;
      }

      if (previousWindowHelper === undefined) {
        delete runtimeWindow.__xyzwReplay;
      } else {
        runtimeWindow.__xyzwReplay = previousWindowHelper;
      }
      if (previousWindowBridge === undefined) {
        delete runtimeWindow.__xyzwReplayBridge;
      } else {
        runtimeWindow.__xyzwReplayBridge = previousWindowBridge;
      }

      if (runtimeWindow !== gameWindow) {
        if (previousWindowGameWindow === undefined) {
          delete runtimeWindow.__xyzwReplayGameWindow;
        } else {
          runtimeWindow.__xyzwReplayGameWindow = previousWindowGameWindow;
        }
      }
    },
  };
};

export const locateReplayEntrypoint = ({
  diagnostics = {},
  allowDebugFallbackEntrypoints = false,
  gameWindowInfo = null,
} = {}) => {
  const runtimeWindow = getRuntimeWindow();
  const resolvedGameWindowInfo = gameWindowInfo || findReplayGameWindow(runtimeWindow);
  const { entrypoint } = buildReplayProbeReport({
    gameWindow: resolvedGameWindowInfo.gameWindow || null,
    gameWindowInfo: resolvedGameWindowInfo,
    diagnostics,
  });

  if (allowDebugFallbackEntrypoints) {
    diagnostics.fallbackEntrypointReason = "legacy-flag-ignored";
  }

  return entrypoint;
};

const buildReplayEntrypointFailureMessage = (entrypoint, result) => {
  const detail = result?.detail || result?.errorMessage || result?.error || "";

  if (result?.status === "bridge-exposed-but-play-target-missing") {
    return detail
      ? `production replay bridge 已暴露，但当前还没有解析到稳定的播放目标。${detail}`
      : "production replay bridge 已暴露，但当前还没有解析到稳定的播放目标。";
  }

  if (result?.status === "target-discovery-empty-after-blacklist") {
    return detail
      ? `production replay bridge 的 discovery 只找到了被 blacklist 或拒绝的 handler，因此当前仍没有可播放 target（target-discovery-empty-after-blacklist）。${detail}`
      : "production replay bridge 的 discovery 只找到了被 blacklist 或拒绝的 handler，因此当前仍没有可播放 target（target-discovery-empty-after-blacklist）。";
  }

  if (result?.status === "candidate-space-too-narrow") {
    return detail
      ? `production replay bridge 当前候选发现空间过窄，只发现了 service handlers，还没有发现 replay-like UI handlers 或真实交互链（candidate-space-too-narrow）。${detail}`
      : "production replay bridge 当前候选发现空间过窄，只发现了 service handlers，还没有发现 replay-like UI handlers 或真实交互链（candidate-space-too-narrow）。";
  }

  if (result?.status === "bridge-target-blacklisted") {
    return detail
      ? `production replay bridge 当前命中了黑名单 target，因此不会调用。${detail}`
      : "production replay bridge 当前命中了黑名单 target，因此不会调用。";
  }

  if (result?.status === "bridge-target-selected-but-not-playlike") {
    return detail
      ? `production replay bridge 当前选中的 target 缺少 replay-specific 证据或 payload affinity，因此不会调用。${detail}`
      : "production replay bridge 当前选中的 target 缺少 replay-specific 证据或 payload affinity，因此不会调用。";
  }

  if (result?.status === "bridge-target-low-confidence") {
    return detail
      ? `production replay bridge 当前选中的 target 只有弱 play 信号，置信度不足，因此不会调用。${detail}`
      : "production replay bridge 当前选中的 target 只有弱 play 信号，置信度不足，因此不会调用。";
  }

  if (result?.status === "bridge-play-target-threw") {
    return detail
      ? `production replay bridge 已解析到播放目标，但调用时抛出了运行时异常。${detail}`
      : "production replay bridge 已解析到播放目标，但调用时抛出了运行时异常。";
  }

  return detail || `已定位回放入口 ${entrypoint?.label || "unknown"}，但调用失败。`;
};

const normalizePublicReplayBridgeResult = (diagnostics, result) => {
  if (diagnostics?.loaderFamily !== REPLAY_LOADER_FAMILIES.PUBLIC || !result || typeof result !== "object") {
    return;
  }

  diagnostics.visualProbeCapabilities = {
    ...(diagnostics.visualProbeCapabilities && typeof diagnostics.visualProbeCapabilities === "object"
      ? diagnostics.visualProbeCapabilities
      : {}),
    ...(result.visualProbeCapabilities && typeof result.visualProbeCapabilities === "object"
      ? result.visualProbeCapabilities
      : {}),
  };
  diagnostics.visualProbeCapabilities.showBattleLoading ??= "not-found(optional)";

  if (typeof result.status === "string" && result.status) {
    diagnostics.replayEntrypointInvokeStatus = result.status;
    diagnostics.bridgeStatus = result.status;
  }
  if (typeof result.playTargetLabel === "string" || result.playTargetLabel === null) {
    diagnostics.playTargetLabel = result.playTargetLabel;
  }
  if (typeof result.playTargetSource === "string" || result.playTargetSource === null) {
    diagnostics.playTargetSource = result.playTargetSource;
  }
  if ("playTargetScore" in result) {
    diagnostics.playTargetScore = result.playTargetScore ?? null;
  }
  if (Array.isArray(result.playTargetWhy)) {
    diagnostics.playTargetWhy = result.playTargetWhy;
  }
  if (Array.isArray(result.rankedTargets)) {
    diagnostics.rankedTargets = result.rankedTargets;
  }
  if (Array.isArray(result.buttonHandlerCandidates)) {
    diagnostics.buttonHandlerCandidates = result.buttonHandlerCandidates;
  }
  if (Array.isArray(result.interactionTraceCandidates)) {
    diagnostics.interactionTraceCandidates = result.interactionTraceCandidates;
  }
  if (Array.isArray(result.replayLikeButtonTexts)) {
    diagnostics.replayLikeButtonTexts = result.replayLikeButtonTexts;
  }
  if (Array.isArray(result.replayLikeCustomEventData)) {
    diagnostics.replayLikeCustomEventData = result.replayLikeCustomEventData;
  }
  if (Array.isArray(result.replayLikeNodeContexts)) {
    diagnostics.replayLikeNodeContexts = result.replayLikeNodeContexts;
  }
  if (Array.isArray(result.candidateDiscoverySources)) {
    diagnostics.candidateDiscoverySources = result.candidateDiscoverySources;
  }
  if ("candidateSpaceTooNarrow" in result) {
    diagnostics.candidateSpaceTooNarrow = result.candidateSpaceTooNarrow === true;
  }
  if (result.targetDiscoverySummary && typeof result.targetDiscoverySummary === "object") {
    diagnostics.targetDiscoverySummary = result.targetDiscoverySummary;
  }
  if (typeof result.minimumPlayableScore === "number") {
    diagnostics.minimumPlayableScore = result.minimumPlayableScore;
  }
  if (typeof result.targetRejectedReason === "string" || result.targetRejectedReason === null) {
    diagnostics.targetRejectedReason = result.targetRejectedReason;
  }
  if ("targetBlacklisted" in result) {
    diagnostics.targetBlacklisted = result.targetBlacklisted === true;
  }
  if ("targetLooksGetterLike" in result) {
    diagnostics.targetLooksGetterLike = result.targetLooksGetterLike === true;
  }
  if ("targetLooksMetadataLike" in result) {
    diagnostics.targetLooksMetadataLike = result.targetLooksMetadataLike === true;
  }
  if (result.payloadShapeBefore) {
    diagnostics.payloadShapeBefore = result.payloadShapeBefore;
  }
  if (result.payloadShapeAfter) {
    diagnostics.payloadShapeAfter = result.payloadShapeAfter;
  }
  if (result.visualPostCheck) {
    diagnostics.visualPostCheck = result.visualPostCheck;
  }
  if (typeof result.primaryRisk === "string" && result.primaryRisk) {
    diagnostics.primaryRisk = result.primaryRisk;
  }
};

const startReplayEntrypoint = async ({
  entrypoint,
  battleInput,
  diagnostics,
} = {}) => {
  diagnostics.replayPayloadKeys = Object.keys(battleInput || {}).sort();
  const result = await Promise.resolve(entrypoint.invoke(battleInput));
  diagnostics.replayEntrypointInvokeResult = result || null;
  normalizePublicReplayBridgeResult(diagnostics, result);

  if (result && typeof result === "object" && result.ok === false) {
    diagnostics.replayEntrypointInvokeStatus = result.status || diagnostics.replayEntrypointInvokeStatus || null;
    diagnostics.bridgeStatus = result.status || diagnostics.bridgeStatus;
    diagnostics.playTargetLabel = result.playTargetLabel || diagnostics.playTargetLabel || null;
    diagnostics.playTargetSource = result.playTargetSource || diagnostics.playTargetSource || null;
    diagnostics.playMethodCandidates = result.playMethodCandidates || diagnostics.playMethodCandidates || [];
    return {
      ok: false,
      entrypoint: entrypoint.label,
      message: buildReplayEntrypointFailureMessage(entrypoint, result),
      status: result.status || "entrypoint-invoke-failed",
    };
  }

  return {
    ok: true,
    entrypoint: entrypoint.label,
    result,
  };
};

export const startFightPvpReplayRuntime = async ({
  replay,
  hostElement,
  liveContext = null,
  allowDebugFallbackEntrypoints = false,
  runtimeAdapter = {},
} = {}) => {
  const diagnostics = {
    steps: [],
    wxAccessLog: [],
  };
  const cleanups = [];

  const adapter = {
    createCanvasHost,
    createVm2Shim: createScopedReplayVm2Shim,
    createWxShim: createScopedReplayWxShim,
    installReplayAssetRequestObserver,
    ensureRuntimeBooted,
    ensureRuntimeLoaded: ensureXyzwRuntimeLoaded,
    ensureAuxiliaryBundlesLoaded: ensureReplayAuxiliaryBundlesLoaded,
    ensureBundleVersionContainers: ensureReplayBundleVersionContainers,
    installLoadingErrorObserver: installReplayLoadingErrorObserver,
    installManifestShim: installReplayManifestShim,
    installPageExitGuard: installReplayPageExitGuard,
    installResourceManagerGuard: installReplayResourceManagerGuard,
    installBundleResolverPatch: installReplayBundleResolverPatch,
    installReplayPrivacyGuard,
    installReplayPromiseUtilShim,
    installReplayBattleStartProbe,
    installReplaySceneStageObserver,
    installMissingModuleShims: installReplayMissingModuleShims,
    inspectGameBundleModuleCoverage: inspectReplayGameBundleModuleCoverage,
    inspectBundleState,
    inspectLoaderFamily,
    probeRequireError,
    probeGameSceneAssets,
    ensureReplayBootstrapScene,
    detectLoaderFamily,
    detectXyzwRuntimeLayer,
    ensureXyzwGameBundleReady,
    waitForBattleModulesReady,
    findReplayGameWindow,
    locateReplayEntrypoint,
    exposeReplayConsoleHelpers,
    probeGameBundleAssets,
    readRuntimeModules,
    startReplayEntrypoint,
    waitForRuntimeReadyForReplay,
    ...runtimeAdapter,
  };

  const dispose = () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      try {
        cleanup?.();
      } catch (error) {
        console.warn("[FightPvp replay dispose]", error);
      }
    }
  };

  try {
    if (!isHostElement(hostElement)) {
      throw new TypeError("Replay host container is not ready.");
    }

    if (
      !replay?.battleInputData
      && !replay?.battleInputSnapshot
      && !isLegacyFightPvpReplayPayload(replay)
    ) {
      return {
        ok: false,
        reason: "empty-payload",
        message: "回放数据为空，无法启动运行时。",
        diagnostics,
        dispose,
      };
    }

    diagnostics.steps.push("ensure-runtime-loaded");
    await adapter.ensureRuntimeLoaded({
      variant: XYZW_RUNTIME_VARIANTS.REPLAY_BROWSER,
    });
    rememberLauncherRequireRef(getRuntimeWindow());

    diagnostics.steps.push("install-vm2-shim");
    const vm2Shim = adapter.createVm2Shim();
    cleanups.push(() => vm2Shim.dispose?.());

    diagnostics.steps.push("load-auxiliary-bundles");
    const auxiliaryBundles = await adapter.ensureAuxiliaryBundlesLoaded({
      diagnostics,
    });
    cleanups.push(() => auxiliaryBundles.dispose?.());

    diagnostics.steps.push("install-loading-error-observer");
    const loadingErrorObserver = adapter.installLoadingErrorObserver({
      diagnostics,
    });
    cleanups.push(() => loadingErrorObserver.dispose?.());

    const { canvas } = adapter.createCanvasHost(hostElement);
    cleanups.push(() => {
      hostElement.innerHTML = "";
    });

    diagnostics.steps.push("install-asset-request-observer");
    const assetRequestObserver = adapter.installReplayAssetRequestObserver({
      diagnostics,
    });
    cleanups.push(() => assetRequestObserver.dispose?.());

    diagnostics.steps.push("install-wx-shim");
    const wxShim = adapter.createWxShim({
      canvas,
      accessLog: diagnostics.wxAccessLog,
    });
    cleanups.push(() => wxShim.dispose?.());

    diagnostics.steps.push("install-missing-module-shims");
    const missingModuleShims = adapter.installMissingModuleShims({
      diagnostics,
    });
    cleanups.push(() => missingModuleShims.dispose?.());

    diagnostics.steps.push("read-runtime-modules");
    const modules = adapter.readRuntimeModules();
    diagnostics.runtimeSnapshotBeforeBoot = getRuntimeSnapshot(modules);

    diagnostics.steps.push("install-replay-privacy-guard");
    const replayPrivacyGuard = adapter.installReplayPrivacyGuard({
      diagnostics,
    });
    cleanups.push(() => replayPrivacyGuard.dispose?.());

    diagnostics.steps.push("install-manifest-shim");
    const manifestShim = adapter.installManifestShim({
      modules,
      replay,
      diagnostics,
    });
    cleanups.push(() => manifestShim.dispose?.());

    diagnostics.steps.push("install-page-exit-guard");
    const pageExitGuard = adapter.installPageExitGuard({
      modules,
      diagnostics,
    });
    cleanups.push(() => pageExitGuard.dispose?.());

    diagnostics.steps.push("install-resource-manager-guard");
    const resourceManagerGuard = adapter.installResourceManagerGuard({
      modules,
      diagnostics,
    });
    cleanups.push(() => resourceManagerGuard.dispose?.());

    diagnostics.steps.push("install-scene-stage-observer");
    const sceneStageObserver = adapter.installReplaySceneStageObserver({
      modules,
      diagnostics,
    });
    cleanups.push(() => sceneStageObserver.dispose?.());

    diagnostics.steps.push("ensure-bundle-version-containers-preboot");
    adapter.ensureBundleVersionContainers({
      modules,
      diagnostics,
    });

    diagnostics.steps.push("install-bundle-resolver-patch-preboot");
    const bundleResolverPatch = adapter.installBundleResolverPatch({
      diagnostics,
    });
    cleanups.push(() => bundleResolverPatch.dispose?.());

    diagnostics.steps.push("ensure-runtime-booted");
    await adapter.ensureRuntimeBooted({ canvas, diagnostics });
    diagnostics.runtimeSnapshotAfterBoot = getRuntimeSnapshot(modules);

    diagnostics.steps.push("ensure-replay-bootstrap-scene");
    const bootstrapArtifacts = await adapter.ensureReplayBootstrapScene({
      canvas,
      modules,
      diagnostics,
    });
    cleanups.push(() => bootstrapArtifacts.cleanup?.());

    diagnostics.steps.push("ensure-bundle-version-containers");
    adapter.ensureBundleVersionContainers({
      modules,
      diagnostics,
    });

    await adapter.probeGameBundleAssets({
      modules,
      diagnostics,
    });
    await adapter.probeGameSceneAssets({
      diagnostics,
    });
    const staticRuntimeFailure = classifyRuntimeLoadFailure({
      stateId: readCurrentGameState(modules),
      sceneName: getRuntimeSnapshot(modules).sceneName,
      diagnostics,
      timedOut: false,
    });
    if (staticRuntimeFailure) {
      return {
        ok: false,
        reason: "runtime-load-failed",
        message: staticRuntimeFailure.message,
        diagnostics,
        dispose,
      };
    }

    diagnostics.steps.push("inspect-game-bundle-module-coverage");
    const gameBundleCoverage = await adapter.inspectGameBundleModuleCoverage({
      diagnostics,
      allowedModules: [
        ...Array.from(missingModuleShims.providedAliases || []),
        ...REPLAY_AUXILIARY_REQUIRED_MODULES,
      ],
    });
    if (gameBundleCoverage?.missingModules?.length > 0) {
      return {
        ok: false,
        reason: "runtime-load-failed",
        message: buildIncompleteGameBundleMessage(gameBundleCoverage),
        diagnostics,
        dispose,
      };
    }

    diagnostics.steps.push("wait-for-runtime-ready");
    const runtimeReady = await adapter.waitForRuntimeReadyForReplay({
      modules,
      diagnostics,
      bootstrapSceneName: bootstrapArtifacts.bootstrapSceneName,
    });

    if (!runtimeReady?.ok) {
      return {
        ok: false,
        reason: "runtime-load-failed",
        message: runtimeReady?.message || "运行时未能进入 Game scene。",
        diagnostics,
        dispose,
      };
    }

    diagnostics.steps.push("install-replay-promise-util-shim");
    const replayPromiseUtilShim = adapter.installReplayPromiseUtilShim({
      diagnostics,
    });
    cleanups.push(() => replayPromiseUtilShim.dispose?.());

    diagnostics.steps.push("build-replay-battle-input");
    const replayBattleInputResult = resolveReplayRuntimeBattleInput({
      replay,
      liveContext,
    });
    diagnostics.sourceType = replayBattleInputResult.sourceType;
    diagnostics.battleInputSource = replayBattleInputResult.battleInputSource;
    diagnostics.battleInputSummary = replayBattleInputResult.battleInputSummary;
    diagnostics.mapId = replayBattleInputResult.mapIdResolution?.mapId
      ?? replayBattleInputResult.battleInputSummary?.mapId
      ?? null;
    diagnostics.missingRuntimeFields = replayBattleInputResult.missingRuntimeFields;
    diagnostics.mapIdSource = replayBattleInputResult.mapIdResolution?.mapIdSource ?? null;
    diagnostics.pvpMapIdSource = replayBattleInputResult.mapIdResolution?.pvpMapIdSource ?? null;
    diagnostics.mapIdResolveReason = replayBattleInputResult.mapIdResolution?.mapIdResolveReason ?? null;
    diagnostics.dressPvpMapUsedId = replayBattleInputResult.mapIdResolution?.dressPvpMapUsedId ?? null;
    diagnostics.runtimeRoleMapId = replayBattleInputResult.mapIdResolution?.runtimeRoleMapId ?? null;
    diagnostics.runtimeRolePath = replayBattleInputResult.mapIdResolution?.runtimeRolePath ?? null;
    diagnostics.selfRoleContextSource = replayBattleInputResult.mapIdResolution?.selfRoleContextSource ?? null;
    diagnostics.runtimeRoleAvailable = replayBattleInputResult.mapIdResolution?.runtimeRoleAvailable ?? false;
    diagnostics.battleInputAvailable = replayBattleInputResult.mapIdResolution?.battleInputAvailable ?? false;
    diagnostics.fixtureMapFallbackUsed = Boolean(
      replayBattleInputResult.mapIdResolution?.fixtureMapFallbackUsed,
    );
    diagnostics.mapIdDiagnostics = replayBattleInputResult.mapIdResolution?.diagnostics || null;
    diagnostics.availableValues
      = replayBattleInputResult.mapIdResolution?.diagnostics?.availableValues || {};

    if (!replayBattleInputResult.ok) {
      return {
        ok: false,
        reason: "replay-start-failed",
        message:
          replayBattleInputResult.message
          || "回放 battle input 不完整，无法启动运行时回放。",
        diagnostics,
        dispose,
      };
    }

    diagnostics.steps.push("install-replay-start-probe");
    const replayStartProbe = adapter.installReplayBattleStartProbe({
      modules,
      diagnostics,
    });
    cleanups.push(() => replayStartProbe.dispose?.());

    diagnostics.steps.push("find-replay-game-window");
    const replayGameWindowInfo = adapter.findReplayGameWindow();
    diagnostics.replayGameWindowSource = replayGameWindowInfo.source || null;
    diagnostics.replayGameWindowStatus = replayGameWindowInfo.status || "no-require";

    const initialLoaderFamilyInfo = adapter.detectLoaderFamily(
      replayGameWindowInfo.gameWindow || null,
    );
    const replayProbeFamily = initialLoaderFamilyInfo.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
      ? REPLAY_PROBE_FAMILIES.PRODUCTION
      : REPLAY_PROBE_FAMILIES.SOURCE;
    diagnostics.loaderFamily = initialLoaderFamilyInfo.loaderFamily;
    diagnostics.loaderFamilyEvidence = initialLoaderFamilyInfo.evidence;
    diagnostics.suspectedBundlePath = initialLoaderFamilyInfo.suspectedBundlePath || null;
    diagnostics.probeFamily = replayProbeFamily;
    diagnostics.steps.push("inspect-replay-bundle-state");
    diagnostics.bundleState = adapter.inspectBundleState(
      getRuntimeWindow(),
      { probeFamily: replayProbeFamily },
    );
    diagnostics.loaderInspection = adapter.inspectLoaderFamily(
      getRuntimeWindow(),
      { probeFamily: replayProbeFamily },
    );

    diagnostics.steps.push("detect-runtime-layer");
    const initialRuntimeLayerInfo = adapter.detectXyzwRuntimeLayer(
      replayGameWindowInfo.gameWindow || null,
      {
        probeFamily: replayProbeFamily,
        windowLabel: formatReplayGameWindowSourceLabel(replayGameWindowInfo.source || "window"),
      },
    );
    diagnostics.runtimeLayer = initialRuntimeLayerInfo.layer;
    diagnostics.runtimeStage = initialRuntimeLayerInfo.layer;
    diagnostics.scene = initialRuntimeLayerInfo.details?.scene ?? initialRuntimeLayerInfo.details?.sceneName ?? null;
    diagnostics.sceneName = initialRuntimeLayerInfo.details?.sceneName ?? null;
    diagnostics.gameBundleRequested = Boolean(initialRuntimeLayerInfo.details?.gameBundleRequested);
    diagnostics.gameBundleLoaded = Boolean(initialRuntimeLayerInfo.details?.gameBundleLoaded);
    diagnostics.gameSceneAssetLoaded = Boolean(initialRuntimeLayerInfo.details?.gameSceneAssetLoaded);
    diagnostics.gameSceneRunning = Boolean(initialRuntimeLayerInfo.details?.gameSceneRunning);
    diagnostics.battleModulesReady = Boolean(initialRuntimeLayerInfo.details?.battleModulesReady);
    diagnostics.bridgeExposure = Boolean(
      findExposedReplayBridge(getRuntimeWindow(), replayGameWindowInfo.gameWindow || null).bridge,
    );
    diagnostics.bridgeStatus = findExposedReplayBridge(
      getRuntimeWindow(),
      replayGameWindowInfo.gameWindow || null,
    ).status;
    diagnostics.bridgeSource = findExposedReplayBridge(
      getRuntimeWindow(),
      replayGameWindowInfo.gameWindow || null,
    ).source || null;
    diagnostics.probeCompatibility = initialRuntimeLayerInfo.details?.probeCompatibility ?? diagnostics.probeCompatibility ?? "compatible-probe";
    diagnostics.incompatibleProbes = initialRuntimeLayerInfo.details?.incompatibleProbes || [];
    diagnostics.sameRequireSource = initialRuntimeLayerInfo.details?.sameRequireSource ?? null;
    diagnostics.sameRequireRef = initialRuntimeLayerInfo.details?.sameRequireRef ?? null;
    diagnostics.hasRequireSwap = Boolean(initialRuntimeLayerInfo.details?.hasRequireSwap);
    diagnostics.requireSwap = Boolean(initialRuntimeLayerInfo.details?.requireSwap);
    diagnostics.requireFunctionName = initialRuntimeLayerInfo.details?.requireFunctionName ?? null;
    diagnostics.launcherRequireFingerprint = initialRuntimeLayerInfo.details?.launcherRequireFingerprint ?? null;
    diagnostics.launcherRequireFunctionName = initialRuntimeLayerInfo.details?.launcherRequireFunctionName ?? null;
    diagnostics.liveRequireFingerprint = initialRuntimeLayerInfo.details?.liveRequireFingerprint ?? null;
    diagnostics.loadBundleCalls = initialRuntimeLayerInfo.details?.loadBundleCalls || [];
    diagnostics.tryLoadAssetCalls = initialRuntimeLayerInfo.details?.tryLoadAssetCalls || [];
    diagnostics.runSceneCalls = initialRuntimeLayerInfo.details?.runSceneCalls || [];
    diagnostics.gameScriptInDocument = Boolean(initialRuntimeLayerInfo.details?.gameScriptInDocument);
    diagnostics.gameScriptInPerformance = Boolean(initialRuntimeLayerInfo.details?.gameScriptInPerformance);
    diagnostics.moduleChecks = initialRuntimeLayerInfo.details?.canonicalModuleChecks || initialRuntimeLayerInfo.details?.moduleChecks || {};

    if (replayGameWindowInfo.gameWindow) {
      const replayConsoleHelpers = adapter.exposeReplayConsoleHelpers(
        replayGameWindowInfo.gameWindow,
        {
          runtimeLayerInfo: initialRuntimeLayerInfo,
        },
      );
      diagnostics.replayConsoleHelperExposed = Boolean(replayConsoleHelpers.helper);
      diagnostics.replayConsoleHelperResult = replayConsoleHelpers.result;
      cleanups.push(() => replayConsoleHelpers.dispose?.());
    }

    diagnostics.steps.push("wait-for-compatible-replay-probe");
    const replayGameBundleReady = await adapter.waitForBattleModulesReady({
      gameWindow: replayGameWindowInfo.gameWindow || null,
      runtimeWindow: getRuntimeWindow(),
      probeFamily: replayProbeFamily,
      windowLabel: formatReplayGameWindowSourceLabel(replayGameWindowInfo.source || "window"),
    });
    diagnostics.replayGameBundleReady = replayGameBundleReady.ok;
    diagnostics.replayGameBundleReadyAttempts = replayGameBundleReady.attempts ?? 0;
    diagnostics.replayGameBundleReadyError = replayGameBundleReady.error || null;
    diagnostics.replayGameBundleReadySource = replayGameBundleReady.gameBundleReadySource || null;
    diagnostics.runtimeLayer = replayGameBundleReady.layer || diagnostics.runtimeLayer;
    diagnostics.runtimeStage = replayGameBundleReady.layer || diagnostics.runtimeStage;
    diagnostics.scene = replayGameBundleReady.details?.scene ?? diagnostics.scene;
    diagnostics.sceneName = replayGameBundleReady.details?.sceneName ?? diagnostics.sceneName;
    diagnostics.gameBundleRequested = Boolean(replayGameBundleReady.details?.gameBundleRequested);
    diagnostics.gameBundleLoaded = Boolean(replayGameBundleReady.details?.gameBundleLoaded);
    diagnostics.gameSceneAssetLoaded = Boolean(replayGameBundleReady.details?.gameSceneAssetLoaded);
    diagnostics.gameSceneRunning = Boolean(replayGameBundleReady.details?.gameSceneRunning);
    diagnostics.battleModulesReady = Boolean(replayGameBundleReady.details?.battleModulesReady);
    diagnostics.probeCompatibility = replayGameBundleReady.details?.probeCompatibility ?? diagnostics.probeCompatibility;
    diagnostics.incompatibleProbes = replayGameBundleReady.details?.incompatibleProbes || diagnostics.incompatibleProbes;
    diagnostics.sameRequireSource = replayGameBundleReady.details?.sameRequireSource ?? diagnostics.sameRequireSource;
    diagnostics.sameRequireRef = replayGameBundleReady.details?.sameRequireRef ?? diagnostics.sameRequireRef;
    diagnostics.hasRequireSwap = Boolean(replayGameBundleReady.details?.hasRequireSwap);
    diagnostics.requireSwap = Boolean(replayGameBundleReady.details?.requireSwap);
    diagnostics.requireFunctionName = replayGameBundleReady.details?.requireFunctionName ?? diagnostics.requireFunctionName;
    diagnostics.launcherRequireFingerprint = replayGameBundleReady.details?.launcherRequireFingerprint ?? diagnostics.launcherRequireFingerprint;
    diagnostics.launcherRequireFunctionName = replayGameBundleReady.details?.launcherRequireFunctionName ?? diagnostics.launcherRequireFunctionName;
    diagnostics.liveRequireFingerprint = replayGameBundleReady.details?.liveRequireFingerprint ?? diagnostics.liveRequireFingerprint;
    diagnostics.loadBundleCalls = replayGameBundleReady.details?.loadBundleCalls || diagnostics.loadBundleCalls;
    diagnostics.tryLoadAssetCalls = replayGameBundleReady.details?.tryLoadAssetCalls || diagnostics.tryLoadAssetCalls;
    diagnostics.runSceneCalls = replayGameBundleReady.details?.runSceneCalls || diagnostics.runSceneCalls;
    diagnostics.gameScriptInDocument = Boolean(replayGameBundleReady.details?.gameScriptInDocument);
    diagnostics.gameScriptInPerformance = Boolean(replayGameBundleReady.details?.gameScriptInPerformance);
    diagnostics.moduleChecks = replayGameBundleReady.details?.canonicalModuleChecks || replayGameBundleReady.details?.moduleChecks || diagnostics.moduleChecks;
    diagnostics.loaderFamily = replayGameBundleReady.details?.loaderFamily || diagnostics.loaderFamily;
    diagnostics.loaderFamilyEvidence = replayGameBundleReady.details?.loaderFamilyEvidence || diagnostics.loaderFamilyEvidence;
    diagnostics.suspectedBundlePath = replayGameBundleReady.details?.suspectedBundlePath || diagnostics.suspectedBundlePath;
    diagnostics.bundleState = adapter.inspectBundleState(
      getRuntimeWindow(),
      { probeFamily: replayProbeFamily },
    );
    const replayBridgeInfo = findExposedReplayBridge(
      getRuntimeWindow(),
      replayGameWindowInfo.gameWindow || null,
    );
    diagnostics.bridgeExposure = Boolean(replayBridgeInfo.bridge);
    diagnostics.bridgeStatus = replayBridgeInfo.status;
    diagnostics.bridgeSource = replayBridgeInfo.source || null;

    diagnostics.steps.push("locate-replay-entrypoint");
    const replayEntrypoint = adapter.locateReplayEntrypoint({
      modules,
      diagnostics,
      allowDebugFallbackEntrypoints,
      gameWindowInfo: replayGameWindowInfo,
    });

    if (!replayEntrypoint) {
      const scanned = diagnostics.replayEntrypointCandidates || [];
      const scannedSummary = scanned.length > 0
        ? scanned.map((entry) => `${entry.label}:${entry.status || "unknown"}`).join(", ")
        : "none";
      const requireSummary = Array.isArray(diagnostics.replayEntrypointRequireDebug)
        ? diagnostics.replayEntrypointRequireDebug
            .map((entry) => `${entry.label}:${entry.status || "unknown"}`)
            .join(", ")
        : "none";
      const moduleChecks = diagnostics.moduleChecks || {};
      const missingCanonicalModuleIds = getMissingCanonicalModuleIds(moduleChecks);
      const allCanonicalMissing = missingCanonicalModuleIds.length === REPLAY_CANONICAL_MODULE_IDS.length;
      const firstRequireExecError = getFirstCanonicalRequireExecError(moduleChecks);
      const canonicalSummary = REPLAY_CANONICAL_MODULE_IDS.map((moduleId) => {
        const moduleCheck = moduleChecks?.[moduleId] || {};
        const suffix = moduleCheck.errorMessage
          ? `(${moduleCheck.errorMessage}${moduleCheck.stackTop ? ` @ ${moduleCheck.stackTop}` : ""})`
          : "";
        return `${moduleId}:${moduleCheck.status || "unknown"}${suffix}`;
      }).join(", ");
      const sceneLabel = diagnostics.sceneName || diagnostics.scene || GAME_SCENE_NAME;
      const detail = `已检查：gameWindow=${diagnostics.replayGameWindowStatus || "unknown"}@${diagnostics.replayGameWindowSource || "window"}；loaderFamily=${diagnostics.loaderFamily || REPLAY_LOADER_FAMILIES.UNKNOWN}；probeFamily=${diagnostics.probeFamily || "-"}；probeCompatibility=${diagnostics.probeCompatibility || "-"}；bridgeStatus=${diagnostics.bridgeStatus || "-"}@${diagnostics.bridgeSource || "-"}；runtimeStage=${diagnostics.runtimeStage || "unknown"}；scene=${sceneLabel || "-"}；suspectedBundlePath=${diagnostics.suspectedBundlePath || "-"}；requireSwap=${diagnostics.requireSwap ? "yes" : "no"}；sameRequireRef=${diagnostics.sameRequireRef ?? "-"}；sameRequireSource=${diagnostics.sameRequireSource ?? "-"}；requireFn=${diagnostics.requireFunctionName || "-"}；launcherRequireFn=${diagnostics.launcherRequireFunctionName || "-"}；launcherRequireFp=${formatRequireFingerprintSummary(diagnostics.launcherRequireFingerprint)}；liveRequireFp=${formatRequireFingerprintSummary(diagnostics.liveRequireFingerprint)}；bundleReady=${diagnostics.replayGameBundleReady ? "yes" : "no"}(${diagnostics.replayGameBundleReadyAttempts ?? 0}, source=${diagnostics.replayGameBundleReadySource || "-"})；gameScript=document:${diagnostics.gameScriptInDocument ? "yes" : "no"}/performance:${diagnostics.gameScriptInPerformance ? "yes" : "no"}；modules=${canonicalSummary}；entrypoints=${scannedSummary}；debug=${requireSummary}。`;
      const message = diagnostics.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
        ? buildPublicReplayBridgeFailureMessage(diagnostics)
        : diagnostics.replayGameBundleReady === false
        ? diagnostics.runtimeStage === "loader-family-mismatch"
          || diagnostics.probeCompatibility === "incompatible-probe"
          || (
            diagnostics.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
            && allCanonicalMissing
          )
          ? `运行时已进入 ${sceneLabel}，并已找到候选 window。当前 live loader 属于 production/public family，source-era 的 BattleUIManager/enter-oss/BattleKitCrossSite probes 与该 loader 不兼容；当前状态应归类为 loader-family-mismatch。${detail}`
          : diagnostics.runtimeStage === "bridge-not-exposed"
            || (
              diagnostics.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
              && diagnostics.bridgeStatus !== "present"
            )
            ? `运行时已进入 ${sceneLabel}，并已识别为 production/public loader，但尚未发现稳定的 replay bridge；因此当前状态应归类为 bridge-not-exposed，而不是等待 BattleUIManager 注册。${detail}`
          : diagnostics.runtimeStage === "require-exec-error" || firstRequireExecError
            ? `运行时已进入 ${sceneLabel}，并已找到候选 window。当前更像是 require-exec-error：${firstRequireExecError?.moduleId || REPLAY_GAME_BUNDLE_READY_MODULE_ID} -> ${firstRequireExecError?.errorMessage || diagnostics.replayGameBundleReadyError || "unknown error"}${firstRequireExecError?.stackTop ? ` @ ${firstRequireExecError.stackTop}` : ""}。${detail}`
            : `运行时已进入 ${sceneLabel}，并已找到候选 window。当前 replay 诊断已切到 loader-family-aware 模型，不会再把 scene=Game 解释为后续等待 battle modules 注册。${detail}`
        : diagnostics.loaderFamily === REPLAY_LOADER_FAMILIES.PUBLIC
          ? `运行时已进入 ${sceneLabel}，并已识别为 production/public loader。当前 replay 入口通过显式 bridge 暴露；若仍未能调用，则剩余问题在于 bridge 的 play() 实现或 bridge 下游的 production hook。${detail}`
          : `运行时已进入 ${sceneLabel}，并已找到真实游戏 window。BattleUIManager 已可从 live require 直接解析；若仍未能定位回放入口，则剩余问题在于目标导出路径不存在或末端不可调用。${detail}`;
      return {
        ok: false,
        reason: "replay-start-failed",
        message,
        diagnostics,
        dispose,
      };
    }

    if (replayEntrypoint.gameWindow) {
      const replayConsoleHelpers = adapter.exposeReplayConsoleHelpers(
        replayEntrypoint.gameWindow,
        {
          runtimeLayerInfo: {
            layer: "battle-modules-ready",
            details: replayGameBundleReady.details || initialRuntimeLayerInfo.details,
          },
        },
      );
      diagnostics.replayConsoleHelperExposed = Boolean(replayConsoleHelpers.helper);
      diagnostics.replayConsoleHelperResult = replayConsoleHelpers.result;
      cleanups.push(() => replayConsoleHelpers.dispose?.());
    }

    diagnostics.steps.push("start-replay-entrypoint");
    const replayStartResult = await adapter.startReplayEntrypoint({
      entrypoint: replayEntrypoint,
      battleInput: replayBattleInputResult.battleInput,
      modules,
      diagnostics,
    });

    if (!replayStartResult?.ok) {
      return {
        ok: false,
        reason: "replay-start-failed",
        message:
          replayStartResult?.message
          || `已定位回放入口 ${replayEntrypoint.label}，但启动失败。`,
        diagnostics,
        dispose,
      };
    }

    diagnostics.replayEntrypoint = replayStartResult.entrypoint || replayEntrypoint.label;
    diagnostics.engineReplayEntrypoint = diagnostics.replayEntrypoint;
    if (diagnostics.battleInputSummary) {
      diagnostics.battleInputSummary.engineReplayEntrypoint = diagnostics.engineReplayEntrypoint;
      diagnostics.battleInputSummary.runtimeRoleMapId = diagnostics.runtimeRoleMapId ?? null;
    }

    diagnostics.steps.push("wait-for-replay-start-signal");
    const replayStartSignal = await replayStartProbe.waitForSignal?.({
      timeoutMs: REPLAY_START_TIMEOUT_MS,
    });

    if (!replayStartSignal?.ok) {
      return {
        ok: false,
        reason: "replay-start-failed",
        message:
          replayStartSignal?.message
          || `已定位回放入口 ${replayEntrypoint.label}，但未观测到真实回放启动信号。`,
        diagnostics,
        dispose,
      };
    }

    diagnostics.replayStartSignal = true;
    diagnostics.replayStartPanel = replayStartSignal.panel ?? diagnostics.replayStartPanel ?? null;
    diagnostics.replayStartIsReplay = replayStartSignal.isReplay ?? diagnostics.replayStartIsReplay ?? null;
    diagnostics.replayStartMapId = replayStartSignal.mapId ?? diagnostics.replayStartMapId ?? null;
    diagnostics.replayStartBattleMode = replayStartSignal.battleMode ?? diagnostics.replayStartBattleMode ?? null;

    return {
      ok: true,
      reason: "ok",
      message: "",
      diagnostics,
      dispose,
    };
  } catch (error) {
    diagnostics.error = toErrorMessage(error, "Failed to boot replay runtime.");
    return {
      ok: false,
      reason: "runtime-load-failed",
      message: diagnostics.error,
      diagnostics,
      dispose,
    };
  }
};
