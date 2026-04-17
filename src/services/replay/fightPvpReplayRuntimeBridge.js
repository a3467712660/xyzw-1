import {
  ensureXyzwRuntimeLoaded,
  XYZW_RUNTIME_VARIANTS,
} from "./xyzwRuntimeLoader.js";
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
  = "current window.__require is still launcher/main bundle or game.js is not ready yet";
const REPLAY_CANONICAL_MODULE_IDS = Object.freeze([
  "BattleUIManager",
  "enter-oss",
  "BattleKitCrossSite",
]);
const REPLAY_CANONICAL_MODULE_ID_SET = new Set(REPLAY_CANONICAL_MODULE_IDS);
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
    status: "wrong-loader",
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

  const req = gameWindow.__require;
  if (typeof req !== "function") {
    throw new TypeError("gameWindow.__require is not a function");
  }

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
) =>
  new Promise((resolve, reject) => {
    const existing = targetDocument.querySelector(
      `script[${REPLAY_AUXILIARY_SCRIPT_ATTR}="${src}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") {
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
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve(script);
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load replay auxiliary script: ${src}`)),
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
      const scriptElement = await loadReplayAuxiliaryScript(scriptUrl, targetDocument);
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
    return previousLoadBundle.apply(this, args);
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
    return originalBundleDownloader.call(this, nextTarget, options, callback);
  };

  if (bundleDownloaders && typeof originalBundleDownloader === "function") {
    bundleDownloaders.bundle = patchedBundleDownloader;
  }

  const patchedLoadBundle = function patchedLoadBundle(target, ...args) {
    return originalLoadBundle.call(this, normalizeBundleTarget(target), ...args);
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

export const requireModule = (gameWindow, moduleId) => {
  if (!gameWindow) {
    return {
      ok: false,
      status: "wrong-window",
      moduleId,
      value: null,
      error: null,
      detail: "game window is unavailable.",
    };
  }

  if (typeof gameWindow.__require !== "function") {
    return {
      ok: false,
      status: "wrong-loader",
      moduleId,
      value: null,
      error: null,
      detail: "gameWindow.__require is unavailable.",
    };
  }

  try {
    const value = gameWindow.__require(moduleId);
    return {
      ok: true,
      status: "present",
      moduleId,
      value,
      error: null,
      detail: null,
    };
  } catch (error) {
    const errorText = toErrorMessage(error, `Failed to require module "${moduleId}".`);
    if (isMissingModuleError(errorText)) {
      return REPLAY_CANONICAL_MODULE_ID_SET.has(moduleId)
        ? {
            ok: false,
            status: "wrong-loader",
            moduleId,
            value: null,
            error: errorText,
            detail: REPLAY_LOADER_NOT_READY_DETAIL,
          }
        : {
            ok: false,
            status: "wrong-module-id",
            moduleId,
            value: null,
            error: errorText,
            detail: `${moduleId} is not a valid replay probe module id.`,
          };
    }

    return REPLAY_CANONICAL_MODULE_ID_SET.has(moduleId)
      ? {
          ok: false,
          status: "wrong-loader",
          moduleId,
          value: null,
          error: errorText,
          detail: REPLAY_LOADER_NOT_READY_DETAIL,
        }
      : {
          ok: false,
          status: "wrong-module-id",
          moduleId,
          value: null,
          error: errorText,
          detail: `${moduleId} is not a valid replay probe module id.`,
        };
  }
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
      error: moduleResult.error,
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
    detail: exportResult.detail,
  };
};

export const waitForReplayGameBundleReady = async ({
  gameWindow,
  runtimeWindow = gameWindow || getRuntimeWindow(),
  attempts = REPLAY_GAME_BUNDLE_READY_ATTEMPTS,
  intervalMs = REPLAY_GAME_BUNDLE_READY_INTERVAL_MS,
  moduleId = REPLAY_GAME_BUNDLE_READY_MODULE_ID,
} = {}) => {
  let lastResult = null;
  if (!gameWindow || typeof gameWindow?.__require !== "function") {
    lastResult = requireModule(gameWindow, moduleId);
    return {
      ...lastResult,
      attempts: 0,
    };
  }

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    lastResult = requireModule(gameWindow, moduleId);
    if (lastResult.ok || lastResult.status !== "wrong-loader") {
      return {
        ...lastResult,
        attempts: attempt,
      };
    }
    if (attempt < attempts) {
      await wait(runtimeWindow, intervalMs);
    }
  }

  return {
    ...lastResult,
    attempts,
  };
};

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

const createReplayEntrypointInvoker = (moduleId, exportPathArr, moduleValue) => {
  if (
    moduleId === "BattleUIManager"
    && exportPathArr.length === 1
    && exportPathArr[0] === "SHOW_BATTLE_REPLAY_UI"
  ) {
    return (payload) => moduleValue.SHOW_BATTLE_REPLAY_UI(payload);
  }

  if (
    moduleId === "BattleUIManager"
    && exportPathArr.length === 3
    && exportPathArr[0] === "BattleUIManager"
    && exportPathArr[1] === "instance"
    && exportPathArr[2] === "showBattleReplayUI"
  ) {
    return (payload) => moduleValue.BattleUIManager.instance.showBattleReplayUI(payload);
  }

  if (
    moduleId === "enter-oss"
    && exportPathArr.length === 3
    && exportPathArr[0] === "EnterOSSState"
    && exportPathArr[1] === "prototype"
    && exportPathArr[2] === "showBattleViewWithData"
  ) {
    return (payload) => new moduleValue.EnterOSSState().showBattleViewWithData(payload);
  }

  if (
    moduleId === "BattleKitCrossSite"
    && exportPathArr.length === 3
    && exportPathArr[0] === "BattleKitCrossSite"
    && exportPathArr[1] === "instance"
    && exportPathArr[2] === "tryRaisePlayback"
  ) {
    return createBattleKitCrossSiteReplayInvoker(moduleValue);
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
  const candidates = [];
  const requireDebug = [];
  const seenModuleIds = new Set();

  diagnostics.replayEntrypointCandidates = candidates;
  diagnostics.replayEntrypointRequireDebug = requireDebug;
  diagnostics.replayGameWindowSource = source;
  diagnostics.replayGameWindowStatus = resolvedGameWindowInfo.status || "wrong-loader";
  diagnostics.fallbackEntrypointUsed = false;
  diagnostics.fallbackEntrypointReason = null;
  diagnostics.enterOssAvailableButRejected = false;
  diagnostics.battleKitAvailableButRejected = false;

  const currentWindowLoaderStatus = typeof runtimeWindow?.__require === "function"
    ? "present"
    : diagnostics.replayGameWindowStatus === "wrong-window"
      ? "wrong-window"
      : "wrong-loader";
  requireDebug.push({
    label: "window.__require",
    moduleId: null,
    source: "window",
    status: currentWindowLoaderStatus,
    detail:
      currentWindowLoaderStatus === "wrong-window"
        ? `当前页面没有 window.__require，已切换到 ${loaderLabel}.__require。`
        : currentWindowLoaderStatus === "wrong-loader"
          ? "当前页面和可见 iframe 中都没有可用的 window.__require。"
          : null,
    error: null,
    keys: [],
  });
  if (diagnostics.replayGameWindowStatus === "wrong-window" && source) {
    requireDebug.push({
      label: `${loaderLabel}.__require`,
      moduleId: null,
      source,
      status: "present",
      detail: null,
      error: null,
      keys: [],
    });
  }

  let resolvedEntrypoint = null;
  let battleUiManagerModuleStatus = diagnostics.replayGameWindowStatus;
  let battleUiManagerModuleFound = false;

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
          diagnostics.replayGameWindowStatus === "wrong-loader"
            ? "wrong-loader"
            : moduleResult?.status || probeResult.status,
        detail: moduleResult?.detail || probeResult.detail || null,
        error: moduleResult?.error || probeResult.error || null,
        keys: moduleResult?.ok ? toSafeModuleKeys(moduleResult.value) : [],
      });
    }

    if (probeConfig.moduleId === "BattleUIManager") {
      battleUiManagerModuleStatus = moduleResult?.status || probeResult.status;
      battleUiManagerModuleFound = Boolean(moduleResult?.ok);
    }

    const status = diagnostics.replayGameWindowStatus === "wrong-loader"
      ? "wrong-loader"
      : probeResult.status;
    const candidate = {
      kind: probeConfig.kind,
      moduleId: probeConfig.moduleId,
      exportPath: [...probeConfig.exportPath],
      label: buildReplayEntrypointLabel(source || "window", probeConfig.moduleId, probeConfig.exportPath),
      status,
      detail: probeResult.detail || moduleResult?.detail || probeResult.error || moduleResult?.error || null,
      found: status === "present",
    };
    candidates.push(candidate);

    if (!resolvedEntrypoint && candidate.found) {
      resolvedEntrypoint = {
        label: candidate.label,
        invoke: createReplayEntrypointInvoker(
          probeConfig.moduleId,
          probeConfig.exportPath,
          moduleResult?.value,
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

  for (const legacyItem of REPLAY_LEGACY_DEBUG_ITEMS) {
    requireDebug.push({
      label: legacyItem.label,
      moduleId: legacyItem.moduleId,
      source: "legacy-probe",
      status: legacyItem.status,
      detail: legacyItem.detail,
      error: null,
      keys: [],
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
  const bundleReadyInfo = await waitForReplayGameBundleReady({
    gameWindow: resolvedGameWindow,
    runtimeWindow: resolvedGameWindow || runtimeWindow,
  });
  const diagnostics = {
    replayGameBundleReady: bundleReadyInfo.ok,
    replayGameBundleReadyAttempts: bundleReadyInfo.attempts ?? 0,
    replayGameBundleReadyError: bundleReadyInfo.error || null,
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

const createReplayConsoleHelpers = (gameWindow) => {
  const helper = {
    req: typeof gameWindow?.__require === "function" ? gameWindow.__require : null,
    result: null,
    async inspect() {
      const result = {
        ...(await inspectReplayEntrypoints(gameWindow)),
        ...inspectReplayRuntimeInputs(gameWindow),
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
      const ret = gameWindow.__require("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared, options);
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
      const ret = gameWindow.__require("BattleUIManager").SHOW_BATTLE_REPLAY_UI(prepared, options);
      scheduleReplayPostCheck(gameWindow, prepared);
      helper.lastPrepared = prepared;
      return ret;
    },
    showReplayViaEnterOSS(rawOrWrappedBattleData = getReplaySource(gameWindow)) {
      const { EnterOSSState } = gameWindow.__require("enter-oss");
      return new EnterOSSState().showBattleViewWithData(rawOrWrappedBattleData);
    },
    tryCrossSitePlayback(force = true) {
      const ret = gameWindow.__require("BattleKitCrossSite").BattleKitCrossSite.instance.tryRaisePlayback(force);
      console.log("[xyzw replay] tryCrossSitePlayback", { force, ret });
      return ret;
    },
  };

  return helper;
};

const exposeReplayConsoleHelpers = (gameWindow) => {
  if (!gameWindow || typeof gameWindow.__require !== "function") {
    return {
      helper: null,
      result: null,
      dispose() {},
    };
  }

  const runtimeWindow = getRuntimeWindow();
  const helper = createReplayConsoleHelpers(gameWindow);
  const previousGameWindowHelper = gameWindow.__xyzwReplay;
  const previousWindowHelper = runtimeWindow.__xyzwReplay;
  const previousWindowGameWindow = runtimeWindow.__xyzwReplayGameWindow;

  gameWindow.__xyzwReplay = helper;
  runtimeWindow.__xyzwReplay = helper;
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

      if (previousWindowHelper === undefined) {
        delete runtimeWindow.__xyzwReplay;
      } else {
        runtimeWindow.__xyzwReplay = previousWindowHelper;
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

const startReplayEntrypoint = async ({
  entrypoint,
  battleInput,
  diagnostics,
} = {}) => {
  diagnostics.replayPayloadKeys = Object.keys(battleInput || {}).sort();
  await Promise.resolve(entrypoint.invoke(battleInput));
  return {
    ok: true,
    entrypoint: entrypoint.label,
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
    installMissingModuleShims: installReplayMissingModuleShims,
    inspectGameBundleModuleCoverage: inspectReplayGameBundleModuleCoverage,
    probeGameSceneAssets,
    ensureReplayBootstrapScene,
    findReplayGameWindow,
    locateReplayEntrypoint,
    exposeReplayConsoleHelpers,
    probeGameBundleAssets,
    readRuntimeModules,
    startReplayEntrypoint,
    waitForReplayGameBundleReady,
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
    diagnostics.replayGameWindowStatus = replayGameWindowInfo.status || "wrong-loader";

    diagnostics.steps.push("wait-for-replay-game-bundle-ready");
    const replayGameBundleReady = await adapter.waitForReplayGameBundleReady({
      gameWindow: replayGameWindowInfo.gameWindow || null,
    });
    diagnostics.replayGameBundleReady = replayGameBundleReady.ok;
    diagnostics.replayGameBundleReadyAttempts = replayGameBundleReady.attempts ?? 0;
    diagnostics.replayGameBundleReadyError = replayGameBundleReady.error || null;

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
      const detail = `已检查：gameWindow=${diagnostics.replayGameWindowStatus || "unknown"}@${diagnostics.replayGameWindowSource || "window"}；bundleReady=${diagnostics.replayGameBundleReady ? "yes" : "no"}(${diagnostics.replayGameBundleReadyAttempts ?? 0})；entrypoints=${scannedSummary}；debug=${requireSummary}。`;
      const message = diagnostics.replayGameBundleReady === false
        ? `运行时已进入 ${runtimeReady.sceneName || GAME_SCENE_NAME}，并已找到真实游戏 window。当前探针已改为真实执行 window.__require(moduleId)，但当前 window.__require 仍可能停留在 launcher/main bundle，或 game.js 尚未 ready，因此 battle replay 入口暂未成功解析。原先的 wrong-export-path 误报来自对调用表达式的字符串化解析，而不是导出路径本身不存在。${detail}`
        : `运行时已进入 ${runtimeReady.sceneName || GAME_SCENE_NAME}，并已找到真实游戏 window。当前探针已真实执行 window.__require(moduleId)；若仍未能解析 battle replay 入口，则剩余问题在于目标导出路径不存在或末端不可调用，而不是调用表达式本身没有执行。${detail}`;
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
