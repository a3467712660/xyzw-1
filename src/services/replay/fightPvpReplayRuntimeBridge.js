import {
  ensureXyzwRuntimeLoaded,
  XYZW_RUNTIME_VARIANTS,
} from "./xyzwRuntimeLoader.js";

const BOOT_TIMEOUT_MS = 2500;
const BOOTSTRAP_TIMEOUT_MS = 7000;
const POLL_INTERVAL_MS = 50;
const BOOTSTRAP_SCENE_NAME = "FightPvpReplayBootstrap";
const GAME_SCENE_NAME = "Game";

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
      loadError: waitError ? toErrorMessage(waitError) : null,
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
    createWxShim: createScopedReplayWxShim,
    ensureRuntimeBooted,
    ensureRuntimeLoaded: ensureXyzwRuntimeLoaded,
    ensureBundleVersionContainers: ensureReplayBundleVersionContainers,
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

    diagnostics.steps.push("read-runtime-modules");
    const modules = adapter.readRuntimeModules();
    diagnostics.runtimeSnapshotBeforeBoot = getRuntimeSnapshot(modules);

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

    const bundleAssetProbe = await adapter.probeGameBundleAssets({
      modules,
      diagnostics,
    });

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
