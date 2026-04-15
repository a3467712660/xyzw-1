import {
  ensureXyzwRuntimeLoaded,
  XYZW_RUNTIME_VARIANTS,
} from "./xyzwRuntimeLoader.js";

const BOOT_TIMEOUT_MS = 2500;
const BOOTSTRAP_TIMEOUT_MS = 7000;
const POLL_INTERVAL_MS = 50;
const BOOTSTRAP_SCENE_NAME = "FightPvpReplayBootstrap";
const GAME_SCENE_NAME = "Game";
const REPLAY_AUXILIARY_SCRIPT_ATTR = "data-fight-pvp-replay-aux-script";
const REPLAY_AUXILIARY_SCRIPT_URLS = Object.freeze([
  "/assets/main/index.js",
  "/assets/TEST_REMOTE_MODULE/index.js",
]);
const REPLAY_AUXILIARY_REQUIRED_MODULES = Object.freeze([
  "ConfigsExt",
  "decimal",
  "decimal-number",
  "LanguageExt",
  "consts",
  "data-index",
  "random-lcg",
  "@jimu/basis",
  "@jimu/ecs",
  "@o4e/core",
  "@o4e/cc-mobx",
  "ts-md5",
  "@o4e/bon",
]);
const REPLAY_AUXILIARY_SOURCE_URLS = Object.freeze([
  "/xyzw/index.js",
  "/assets/main/index.js",
  "/assets/TEST_REMOTE_MODULE/index.js",
]);
const REPLAY_VM2_SHIM_KEY = "VM2_INTERNAL_STATE_DO_NOT_USE_OR_PROGRAM_WILL_FAIL";

const toErrorMessage = (error, fallback) =>
  error?.message || String(error || fallback || "Unknown error");

const getRuntimeWindow = () => {
  if (typeof window === "undefined") {
    throw new TypeError("Replay runtime is only available in the browser.");
  }
  return window;
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
      delete runtimeWindow[key];
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
    for (const moduleName of requiredModules) {
      try {
        runtimeWindow.__require(moduleName);
        resolvedModules.push(moduleName);
      } catch (error) {
        throw new Error(
          `Replay auxiliary bundles did not register required module "${moduleName}": ${toErrorMessage(error)}`,
        );
      }
    }

    diagnostics.replayAuxiliaryModules = resolvedModules;
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

const safeRequireModule = (runtimeRequire, name) => {
  try {
    return runtimeRequire(name);
  } catch (error) {
    return null;
  }
};

const resolveReplayBattleVersion = (replay) => {
  for (const candidate of [
    replay?.battleVersion,
    replay?.battleData?.version,
    replay?.battleResult?.battleVersion,
  ]) {
    const parsed = Number(candidate);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return 0;
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
    Game: safeRequireModule(runtimeRequire, "Game"),
    GlobalVarManager: safeRequireModule(runtimeRequire, "GlobalVarManager"),
    Launcher: safeRequireModule(runtimeRequire, "Launcher"),
    PlatformManager: safeRequireModule(runtimeRequire, "PlatformManager"),
    ResourceManager: safeRequireModule(runtimeRequire, "ResourceManager"),
  };
};

const readCurrentGameState = (modules) =>
  modules?.Game?.Game?._instance?.stateMachine?.current?.stateId ?? null;

const getRuntimeSnapshot = (modules) => {
  const runtimeWindow = getRuntimeWindow();
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
  const downloader = runtimeWindow.cc?.assetManager?.downloader;
  const bundleDownloaders = downloader?._downloaders;
  const originalBundleDownloader = bundleDownloaders?.bundle;

  if (!bundleDownloaders || typeof originalBundleDownloader !== "function") {
    return {
      dispose() {},
    };
  }

  const patchedBundleDownloader = function patchedBundleDownloader(
    target,
    options,
    callback,
  ) {
    const nextTarget = toAbsoluteBundleRequestTarget(target, runtimeWindow);
    if (nextTarget !== target) {
      diagnostics?.steps?.push?.("patch-local-bundle-target");
    }
    return originalBundleDownloader.call(this, nextTarget, options, callback);
  };

  bundleDownloaders.bundle = patchedBundleDownloader;

  return {
    dispose() {
      if (bundleDownloaders.bundle === patchedBundleDownloader) {
        bundleDownloaders.bundle = originalBundleDownloader;
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
      cache: "no-store",
      credentials: "same-origin",
      method: "GET",
    }).then((response) => response.text()),
    ...sourceUrls.map((sourceUrl) => (
      runtimeWindow.fetch(new URL(sourceUrl, runtimeWindow.location.origin).toString(), {
        cache: "no-store",
        credentials: "same-origin",
        method: "GET",
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

const probeGameBundleAssets = async ({ diagnostics } = {}) => {
  const runtimeWindow = getRuntimeWindow();
  const targets = buildBundleAssetProbeTargets();

  diagnostics?.steps?.push?.("probe-game-bundle-assets");

  const results = await Promise.all(
    targets.map(async (pathname) => {
      const url = new URL(pathname, runtimeWindow.location.href).toString();
      const expectedContentType = pathname.endsWith(".json")
        ? "application/json"
        : "javascript";
      try {
        const response = await runtimeWindow.fetch(url, {
          cache: "no-store",
          credentials: "same-origin",
          method: "GET",
        });
        const contentType = response.headers.get("content-type") || "";
        return {
          ok:
            response.ok
            && contentType.toLowerCase().includes(expectedContentType)
            && !contentType.toLowerCase().includes("text/html"),
          contentType,
          expectedContentType,
          pathname,
          status: response.status,
          url,
        };
      } catch (error) {
        return {
          ok: false,
          expectedContentType,
          pathname,
          status: 0,
          url,
          error: toErrorMessage(error, "Failed to fetch bundle asset."),
        };
      }
    }),
  );

  diagnostics.bundleAssetProbe = results;
  return results;
};

const buildMissingGameBundleMessage = ({
  bundleAssetProbe,
  runtimeState,
  loadError,
} = {}) => {
  const missingAssets = Array.isArray(bundleAssetProbe)
    ? bundleAssetProbe.filter((entry) => !entry.ok)
    : [];

  if (missingAssets.length > 0) {
    const details = missingAssets
      .map((entry) => `${entry.pathname} (${entry.status || entry.error || "missing"})`)
      .join(", ");
    return `浏览器模式运行时已完成 Cocos boot，并进入 ${runtimeState || "LoadGameScene"}，但缺少 game bundle 资源：${details}。`;
  }

  if (loadError) {
    return `浏览器模式运行时已进入 ${runtimeState || "LoadGameScene"}，但加载 game bundle 失败：${loadError}。`;
  }

  return `浏览器模式运行时已进入 ${runtimeState || "LoadGameScene"}，但仍未进入 Game scene。`;
};

const waitForRuntimeReadyForReplay = async ({
  modules,
  diagnostics,
  bootstrapSceneName = BOOTSTRAP_SCENE_NAME,
  bundleAssetProbe,
} = {}) => {
  const runtimeWindow = getRuntimeWindow();
  const stateHistory = [];
  const seenStates = new Set();

  const collectState = () => {
    const stateId = readCurrentGameState(modules);
    if (stateId && !seenStates.has(stateId)) {
      seenStates.add(stateId);
      stateHistory.push(stateId);
    }
  };

  let waitError = null;
  let result = null;
  try {
    result = await waitForValue({
      read: () => {
        collectState();
        const sceneName = runtimeWindow.cc?.director?.getScene?.()?.name ?? null;
        const stateId = readCurrentGameState(modules);
        if (sceneName && sceneName !== bootstrapSceneName) {
          return {
            ok: true,
            sceneName,
            stateId,
          };
        }
        if (stateId === "LoadingError") {
          return {
            ok: false,
            sceneName,
            stateId,
          };
        }
        return null;
      },
      onTick: collectState,
      runtimeWindow,
      timeoutMs: BOOTSTRAP_TIMEOUT_MS,
      timeoutMessage:
        "Launcher/Game startup timed out before entering Game scene or LoadingError.",
    });
  } catch (error) {
    waitError = error;
  }

  diagnostics.gameStateHistory = stateHistory;
  diagnostics.runtimeSnapshotAfterLauncher = getRuntimeSnapshot(modules);

  if (result?.ok) {
    return result;
  }

  return {
    ok: false,
    stateId: result?.stateId || readCurrentGameState(modules),
    sceneName: result?.sceneName || runtimeWindow.cc?.director?.getScene?.()?.name || null,
    message: buildMissingGameBundleMessage({
      bundleAssetProbe,
      runtimeState: result?.stateId || readCurrentGameState(modules),
      loadError:
        diagnostics?.loadingErrorReason
        || (waitError ? toErrorMessage(waitError) : null),
    }),
  };
};

const adaptFightPvpReplayPayloadForRuntime = (replay) => ({
  replay,
  battleData: replay?.battleData || null,
  battleResult: replay?.battleResult || replay?.battleData?.result || null,
  battleVersion: replay?.battleVersion || replay?.battleData?.version || null,
});

const locateReplayEntrypoint = ({ diagnostics } = {}) => {
  const runtimeWindow = getRuntimeWindow();
  const runtimeRequire = runtimeWindow.__require;
  const scannedCandidates = [];

  const registerCandidate = (label, value, invoke) => {
    const found = Boolean(value && typeof invoke === "function");
    scannedCandidates.push({ label, found });
    if (!found) {
      return null;
    }
    return { label, invoke };
  };

  const globalCandidates = [
    registerCandidate(
      "window.showBattleReplayUI",
      runtimeWindow.showBattleReplayUI,
      typeof runtimeWindow.showBattleReplayUI === "function"
        ? (payload) => runtimeWindow.showBattleReplayUI(payload)
        : null,
    ),
    registerCandidate(
      "window.SHOW_BATTLE_REPLAY_UI",
      runtimeWindow.SHOW_BATTLE_REPLAY_UI,
      typeof runtimeWindow.SHOW_BATTLE_REPLAY_UI === "function"
        ? (payload) => runtimeWindow.SHOW_BATTLE_REPLAY_UI(payload)
        : null,
    ),
    registerCandidate(
      "window.BattleUIManager.showBattleReplayUI",
      runtimeWindow.BattleUIManager?.showBattleReplayUI,
      typeof runtimeWindow.BattleUIManager?.showBattleReplayUI === "function"
        ? (payload) => runtimeWindow.BattleUIManager.showBattleReplayUI(payload)
        : null,
    ),
  ];

  const requireCandidates = [
    "BattleUIManager",
    "SHOW_BATTLE_REPLAY_UI",
    "showBattleReplayUI",
    "battleReplay",
    "BattleReplay",
    "PlaybackMemoryMode",
  ].map((name) => {
    if (typeof runtimeRequire !== "function") {
      scannedCandidates.push({ label: `require:${name}`, found: false });
      return null;
    }
    const mod = safeRequireModule(runtimeRequire, name);
    return (
      registerCandidate(
        `require:${name}.showBattleReplayUI`,
        mod?.showBattleReplayUI,
        typeof mod?.showBattleReplayUI === "function"
          ? (payload) => mod.showBattleReplayUI(payload)
          : null,
      )
      || registerCandidate(
        `require:${name}.SHOW_BATTLE_REPLAY_UI`,
        mod?.SHOW_BATTLE_REPLAY_UI,
        typeof mod?.SHOW_BATTLE_REPLAY_UI === "function"
          ? (payload) => mod.SHOW_BATTLE_REPLAY_UI(payload)
          : null,
      )
      || registerCandidate(
        `require:${name}.BattleUIManager.showBattleReplayUI`,
        mod?.BattleUIManager?.showBattleReplayUI,
        typeof mod?.BattleUIManager?.showBattleReplayUI === "function"
          ? (payload) => mod.BattleUIManager.showBattleReplayUI(payload)
          : null,
      )
      || registerCandidate(
        `require:${name}.default`,
        mod?.default,
        typeof mod?.default === "function" && /replay/i.test(name)
          ? (payload) => mod.default(payload)
          : null,
      )
    );
  });

  diagnostics.replayEntrypointCandidates = scannedCandidates;
  return [...globalCandidates, ...requireCandidates].find(Boolean) || null;
};

const startReplayEntrypoint = async ({ entrypoint, replay, diagnostics } = {}) => {
  const payload = adaptFightPvpReplayPayloadForRuntime(replay);
  diagnostics.replayPayloadKeys = Object.keys(payload).sort();
  await Promise.resolve(entrypoint.invoke(payload));
  return {
    ok: true,
    entrypoint: entrypoint.label,
  };
};

export const startFightPvpReplayRuntime = async ({
  replay,
  hostElement,
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
    ensureRuntimeBooted,
    ensureRuntimeLoaded: ensureXyzwRuntimeLoaded,
    ensureAuxiliaryBundlesLoaded: ensureReplayAuxiliaryBundlesLoaded,
    ensureBundleVersionContainers: ensureReplayBundleVersionContainers,
    installLoadingErrorObserver: installReplayLoadingErrorObserver,
    installManifestShim: installReplayManifestShim,
    installPageExitGuard: installReplayPageExitGuard,
    installResourceManagerGuard: installReplayResourceManagerGuard,
    installBundleResolverPatch: installReplayBundleResolverPatch,
    installMissingModuleShims: installReplayMissingModuleShims,
    inspectGameBundleModuleCoverage: inspectReplayGameBundleModuleCoverage,
    ensureReplayBootstrapScene,
    locateReplayEntrypoint,
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

    if (!replay?.battleData) {
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

    diagnostics.steps.push("install-bundle-resolver-patch");
    const bundleResolverPatch = adapter.installBundleResolverPatch({
      diagnostics,
    });
    cleanups.push(() => bundleResolverPatch.dispose?.());

    const bundleAssetProbe = await adapter.probeGameBundleAssets({
      modules,
      diagnostics,
    });

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
      bundleAssetProbe,
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

    diagnostics.steps.push("locate-replay-entrypoint");
    const replayEntrypoint = adapter.locateReplayEntrypoint({
      modules,
      diagnostics,
    });

    if (!replayEntrypoint) {
      const scanned = diagnostics.replayEntrypointCandidates || [];
      const scannedSummary = scanned.length > 0
        ? scanned.map((entry) => `${entry.label}:${entry.found ? "found" : "missing"}`).join(", ")
        : "none";
      return {
        ok: false,
        reason: "replay-start-failed",
        message: `运行时已进入 ${runtimeReady.sceneName || GAME_SCENE_NAME}，但未找到 battle replay 启动入口。已检查：${scannedSummary}。`,
        diagnostics,
        dispose,
      };
    }

    diagnostics.steps.push("start-replay-entrypoint");
    const replayStartResult = await adapter.startReplayEntrypoint({
      entrypoint: replayEntrypoint,
      replay,
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
