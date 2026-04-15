import { ensureXyzwRuntimeLoaded } from "./xyzwRuntimeLoader.js";

const BOOT_TIMEOUT_MS = 2500;

const toErrorMessage = (error, fallback) =>
  error?.message || String(error || fallback || "Unknown error");

const getRuntimeWindow = () => {
  if (typeof window === "undefined") {
    throw new TypeError("Replay runtime is only available in the browser.");
  }
  return window;
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

const createWxShim = ({ canvas, accessLog }) => {
  const runtimeWindow = getRuntimeWindow();
  const previousWx = runtimeWindow.wx;
  const previousSharedCanvas = runtimeWindow.sharedCanvas;
  const storage = runtimeWindow.localStorage || null;

  const systemInfo = {
    platform: "browser",
    model: "browser",
    pixelRatio: runtimeWindow.devicePixelRatio || 1,
    windowWidth: runtimeWindow.innerWidth,
    windowHeight: runtimeWindow.innerHeight,
    screenWidth: runtimeWindow.innerWidth,
    screenHeight: runtimeWindow.innerHeight,
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
    options?.success?.({
      cancel: true,
      confirm: false,
      content: options?.content || "",
    });
    options?.complete?.();
    return Promise.resolve({
      cancel: true,
      confirm: false,
    });
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
      success?.({ ...systemInfo });
      complete?.({ ...systemInfo });
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
    createInnerAudioContext: () => {
      callLog("createInnerAudioContext");
      return {
        autoplay: false,
        loop: false,
        src: "",
        play() {},
        pause() {},
        stop() {},
        destroy() {},
        onCanplay() {},
        onEnded() {},
        onError() {},
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
    getNetworkType: ({ success, complete } = {}) => {
      callLog("getNetworkType");
      const payload = { networkType: "wifi" };
      success?.(payload);
      complete?.(payload);
    },
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

const readRuntimeModules = () => {
  const runtimeWindow = getRuntimeWindow();
  const runtimeRequire = runtimeWindow.__require;
  if (typeof runtimeRequire !== "function") {
    throw new TypeError("XYZW runtime require is unavailable.");
  }

  return {
    Game: runtimeRequire("Game"),
    GlobalSignal: runtimeRequire("GlobalSignal"),
    Launcher: runtimeRequire("Launcher"),
    PlatformManager: runtimeRequire("PlatformManager"),
  };
};

const getRuntimeSnapshot = (modules) => {
  const runtimeWindow = getRuntimeWindow();
  return {
    hasCc: typeof runtimeWindow.cc !== "undefined",
    sceneName: runtimeWindow.cc?.director?.getScene?.()?.name ?? null,
    hasCanvasInstance: Boolean(runtimeWindow.cc?.Canvas?.instance),
    gamePrepared: runtimeWindow.cc?.game?._prepared ?? null,
    gameRendererInitialized: runtimeWindow.cc?.game?._rendererInitialized ?? null,
    battleVersionFromPlatformManager:
      modules?.PlatformManager?.PlatformManager?.instance?.getBattleVersion?.() ?? null,
  };
};

const ensureRuntimeBooted = async ({ canvas }) => {
  const runtimeWindow = getRuntimeWindow();
  const runtimeGame = runtimeWindow.cc?.game;
  if (!runtimeGame) {
    throw new Error("Cocos game runtime is unavailable.");
  }

  if (runtimeWindow.cc?.director?.getScene?.()) {
    return;
  }

  await new Promise((resolve, reject) => {
    let settled = false;
    const timer = runtimeWindow.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new Error("Runtime boot timed out before a scene became available."));
    }, BOOT_TIMEOUT_MS);

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
      }, () => {
        if (settled) {
          return;
        }
        runtimeWindow.clearTimeout(timer);
        settled = true;
        resolve();
      });
    } catch (error) {
      runtimeWindow.clearTimeout(timer);
      reject(error);
    }
  });
};

export const startFightPvpReplayRuntime = async ({
  replay,
  hostElement,
} = {}) => {
  const diagnostics = {
    steps: [],
    wxAccessLog: [],
  };
  const cleanups = [];

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
    if (!(hostElement instanceof HTMLElement)) {
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
    await ensureXyzwRuntimeLoaded();

    const { canvas } = createCanvasHost(hostElement);
    cleanups.push(() => {
      hostElement.innerHTML = "";
    });

    diagnostics.steps.push("install-wx-shim");
    const wxShim = createWxShim({
      canvas,
      accessLog: diagnostics.wxAccessLog,
    });
    cleanups.push(() => wxShim.dispose());

    diagnostics.steps.push("read-runtime-modules");
    const modules = readRuntimeModules();
    diagnostics.runtimeSnapshotBeforeBoot = getRuntimeSnapshot(modules);

    diagnostics.steps.push("ensure-runtime-booted");
    await ensureRuntimeBooted({ canvas });
    diagnostics.runtimeSnapshotAfterBoot = getRuntimeSnapshot(modules);

    const launcherInstance = modules?.Launcher?.Launcher?.instance;
    const gameInstance = modules?.Game?.Game?.instance;
    if (!launcherInstance || !gameInstance) {
      return {
        ok: false,
        reason: "replay-start-failed",
        message: "运行时已加载，但当前仍未定位到可用的回放启动入口。",
        diagnostics,
        dispose,
      };
    }

    return {
      ok: false,
      reason: "replay-start-failed",
      message: "运行时已进入可访问状态，但 battle replay 的启动桥接仍未找到。",
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
