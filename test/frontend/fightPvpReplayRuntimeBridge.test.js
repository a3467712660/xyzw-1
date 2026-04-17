import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeBundleExternalModuleCoverage,
  buildProductionReplayBridge,
  classifyRuntimeLoadFailure,
  collectReplayGlobalCandidates,
  createScopedReplayVm2Shim,
  ensureReplayBundleVersionContainers,
  ensureReplayAuxiliaryBundlesLoaded,
  exposeReplayConsoleHelpers,
  installReplayAssetRequestObserver,
  installReplayBattleStartProbe,
  installReplayBundleResolverPatch,
  installReplayPageExitGuard,
  installReplayMissingModuleShims,
  installReplayManifestShim,
  installReplayPrivacyGuard,
  installReplayPromiseUtilShim,
  installReplayResourceManagerGuard,
  installReplaySceneStageObserver,
  inspectLoaderFamily,
  inspectBundleState,
  detectLoaderFamily,
  detectXyzwRuntimeLayer,
  findReplayGameWindow,
  getReplaySource,
  ensureReplayInputData,
  ensureXyzwGameBundleReady,
  waitForBattleModulesReady,
  locateReplayEntrypoint,
  looksLikeBattleInput,
  probeRequireExport,
  probeRequireError,
  probeGameSceneAssets,
  requireModule,
  resolveProductionReplayPlayTarget,
  resolveExport,
  resolveReplayAuxiliaryModuleRegistration,
  safeRequireModule,
  scanSceneForReplayCandidates,
  startFightPvpReplayRuntime,
  toAbsoluteBundleRequestTarget,
  waitForRuntimeReadyForReplay,
} from "../../src/services/replay/fightPvpReplayRuntimeBridge.js";
import {
  buildFightPvpBattleInputData,
  createFightPvpBattleInputSnapshot,
} from "../../src/services/replay/fightPvpBattleInputSnapshot.js";
import {
  createFightPvpRealReplayFixture,
  createFightPvpRuntimeRoleReplayFixture,
} from "../fixtures/replay/fightPvpRealReplayFixture.js";

const createReplayBattleInput = ({
  battleVersion = 123,
  mapId = 110001,
  mode = 7,
  selfScore = 10,
  oppoScore = 8,
} = {}) =>
  buildFightPvpBattleInputData({
    battleData: {
      id: `battle-${battleVersion}-${mode}`,
      version: battleVersion,
      mode,
      leftTeam: {
        roleId: "self-1",
        name: "我方",
        team: [{ heroId: 1001 }],
      },
      rightTeam: {
        roleId: "target-1",
        name: "对手",
        team: [{ heroId: 2001 }],
      },
      result: {
        isWin: true,
      },
    },
    battleResult: {
      isWin: true,
    },
    mapId,
    stageNameStr: "切磋系统",
    startTipTopName: "切磋系统",
    startTipStage: "开始切磋",
    options: new Map([
      ["targetRole", { roleId: "target-1", name: "对手" }],
      ["selfScore", selfScore],
      ["oppoScore", oppoScore],
    ]),
  });

const createSnapshotReplayRecord = ({
  battleInputData = createReplayBattleInput(),
  ...overrides
} = {}) => ({
  battleVersion: battleInputData.battleData.version,
  mapId: battleInputData.mapId,
  mapIdSource: "test.mapId",
  pvpMapIdSource: "test.mapId",
  battleInputSnapshot: createFightPvpBattleInputSnapshot(battleInputData),
  ...overrides,
});

const createPublicLoaderWindow = ({
  bridge = null,
  extra = {},
  globals = {},
  scene = null,
} = {}) => ({
  __require() {
    return {};
  },
  __xyzwReplayBridge: bridge,
  cc: {
    director: {
      getScene() {
        return scene;
      },
    },
  },
  document: {
    querySelectorAll() {
      return [];
    },
    scripts: [{ src: "http://localhost/xyzw/index.js" }],
  },
  performance: {
    getEntriesByType() {
      return [{ name: "http://localhost/xyzw/index.js" }];
    },
  },
  setTimeout,
  ...globals,
  ...extra,
});

test.afterEach(() => {
  delete globalThis.window;
  delete globalThis.__require;
  delete globalThis.HTMLElement;
  delete globalThis.document;
  delete globalThis.__REPLAY_DATA__;
  delete globalThis.__xyzwReplayData;
});

test("fight pvp replay locator finds the current window when window.__require is available", () => {
  const runtimeWindow = {
    __require() {
      return null;
    },
    document: {
      querySelectorAll() {
        return [];
      },
    },
  };

  const result = findReplayGameWindow(runtimeWindow);

  assert.equal(result.gameWindow, runtimeWindow);
  assert.equal(result.source, "window");
  assert.equal(result.status, "present");
});

test("fight pvp replay locator falls back to iframe game window when current window has no loader", () => {
  const iframeWindow = {
    __require() {
      return null;
    },
  };
  const runtimeWindow = {
    document: {
      querySelectorAll() {
        return [{ contentWindow: iframeWindow }];
      },
    },
  };

  const result = findReplayGameWindow(runtimeWindow);

  assert.equal(result.gameWindow, iframeWindow);
  assert.equal(result.source, "iframe[0]");
  assert.equal(result.status, "wrong-window");
});

test("fight pvp replay locator reports no-require when neither window nor iframe exposes __require", () => {
  const runtimeWindow = {
    document: {
      querySelectorAll() {
        return [{ contentWindow: {} }];
      },
    },
  };

  const result = findReplayGameWindow(runtimeWindow);

  assert.equal(result.gameWindow, null);
  assert.equal(result.source, null);
  assert.equal(result.status, "no-require");
});

test("fight pvp replay requireModule reports wrong-window when game window is missing", () => {
  const result = requireModule(null, "BattleUIManager");

  assert.equal(result.ok, false);
  assert.equal(result.status, "wrong-window");
});

test("fight pvp replay requireModule reports wrong-loader when __require is unavailable", () => {
  const result = requireModule({}, "BattleUIManager");

  assert.equal(result.ok, false);
  assert.equal(result.status, "wrong-loader");
});

test("fight pvp replay requireModule reports wrong-loader when canonical module id is still missing from launcher-only __require", () => {
  const result = requireModule({
    __require() {
      throw new Error("Cannot find module 'BattleUIManager'");
    },
    document: {
      scripts: [],
    },
    performance: {
      getEntriesByType() {
        return [];
      },
    },
  }, "BattleUIManager");

  assert.equal(result.ok, false);
  assert.equal(result.status, "wrong-loader");
  assert.equal(
    result.detail,
    "launcher/main loader is live, but no stable replay bridge has been confirmed yet.",
  );
  assert.equal(result.errorMessage, "Cannot find module 'BattleUIManager'");
});

test("fight pvp replay requireModule reports wrong-module-id for legacy EnterOSSState module lookups", () => {
  const result = requireModule({
    __require() {
      throw new Error("Cannot find module 'EnterOSSState'");
    },
  }, "EnterOSSState");

  assert.equal(result.ok, false);
  assert.equal(result.status, "wrong-module-id");
});

test("fight pvp replay requireModule reports module-id-family-mismatch on the public loader family", () => {
  const runtimeWindow = {
    __require() {
      throw new Error("Cannot find module 'BattleUIManager'");
    },
    document: {
      scripts: [{ src: "http://localhost/xyzw/index.js" }],
    },
    performance: {
      getEntriesByType() {
        return [{ name: "http://localhost/xyzw/index.js" }];
      },
    },
  };

  const result = requireModule(runtimeWindow, "BattleUIManager");

  assert.equal(result.ok, false);
  assert.equal(result.status, "module-id-family-mismatch");
  assert.equal(
    result.errorMessage,
    "BattleUIManager is a source-era probe and is incompatible with public-xyzw-loader.",
  );
});

test("fight pvp replay requireModule reports require-exec-error and preserves the thrown error", () => {
  const runtimeWindow = {
    __require() {
      throw new TypeError("Cannot read properties of undefined (reading 'scene')");
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
  };

  const result = requireModule(runtimeWindow, "BattleUIManager");

  assert.equal(result.ok, false);
  assert.equal(result.status, "require-exec-error");
  assert.equal(result.errorName, "TypeError");
  assert.equal(result.errorMessage, "Cannot read properties of undefined (reading 'scene')");
  assert.equal(typeof result.stackTop, "string");
});

test("fight pvp replay resolveExport reports wrong-export-path when a property segment is missing", () => {
  const result = resolveExport(
    {
      BattleUIManager: {},
    },
    ["BattleUIManager", "instance", "showBattleReplayUI"],
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, "wrong-export-path");
});

test("fight pvp replay resolveExport reports not-callable when the final export is not a function", () => {
  const result = resolveExport(
    {
      SHOW_BATTLE_REPLAY_UI: true,
    },
    ["SHOW_BATTLE_REPLAY_UI"],
  );

  assert.equal(result.ok, false);
  assert.equal(result.status, "not-callable");
});

test("fight pvp replay resolveExport reports present when the final export is callable", () => {
  const result = resolveExport(
    {
      SHOW_BATTLE_REPLAY_UI() {},
    },
    ["SHOW_BATTLE_REPLAY_UI"],
  );

  assert.equal(result.ok, true);
  assert.equal(result.status, "present");
});

test("fight pvp replay probeRequireExport executes window.__require(moduleId) before resolving exports", () => {
  let requireCalls = 0;
  const result = probeRequireExport({
    __require(name) {
      requireCalls += 1;
      if (name === "BattleUIManager") {
        return {
          SHOW_BATTLE_REPLAY_UI() {},
        };
      }
      throw new Error(`Cannot find module '${name}'`);
    },
  }, "BattleUIManager", ["SHOW_BATTLE_REPLAY_UI"]);

  assert.equal(requireCalls, 1);
  assert.equal(result.ok, true);
  assert.equal(result.status, "present");
});

test("fight pvp replay probeRequireExport never reports wrong-export-path when window.__require(moduleId) itself fails", () => {
  const result = probeRequireExport({
    __require() {
      throw new Error("Cannot find module 'BattleUIManager'");
    },
    document: {
      scripts: [],
    },
    performance: {
      getEntriesByType() {
        return [];
      },
    },
  }, "BattleUIManager", ["SHOW_BATTLE_REPLAY_UI"]);

  assert.equal(result.ok, false);
  assert.equal(result.status, "wrong-loader");
});

test("fight pvp replay detectXyzwRuntimeLayer distinguishes source/public loader families and bridge states", () => {
  const launcherReadyWindow = {
    __require() {
      throw new Error("Cannot find module 'BattleUIManager'");
    },
    document: {
      scripts: [],
    },
    performance: {
      getEntriesByType() {
        return [];
      },
    },
  };
  const bundleRequestedWindow = {
    __require(name) {
      throw new Error(`Cannot find module '${name}'`);
    },
    cc: {
      director: {
        getScene() {
          return null;
        },
      },
    },
  };
  const bundleLoadedWindow = {
    __require(name) {
      throw new Error(`Cannot find module '${name}'`);
    },
    cc: {
      director: {
        getScene() {
          return null;
        },
      },
    },
  };
  const sceneAssetWindow = {
    __require(name) {
      throw new Error(`Cannot find module '${name}'`);
    },
    cc: {
      director: {
        getScene() {
          return null;
        },
      },
    },
  };
  const runningWindow = {
    __require(name) {
      throw new Error(`Cannot find module '${name}'`);
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
  };
  const readyWindow = {
    __require(name) {
      if (name === "BattleUIManager") {
        return {
          SHOW_BATTLE_REPLAY_UI() {},
        };
      }
      return {};
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
  };
  const publicLoaderWindow = {
    __require(name) {
      throw new Error(`Cannot find module '${name}'`);
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
    document: {
      scripts: [{ src: "http://localhost/xyzw/index.js" }],
    },
    performance: {
      getEntriesByType() {
        return [{ name: "http://localhost/xyzw/index.js" }];
      },
    },
  };
  const publicBridgeReadyWindow = {
    ...publicLoaderWindow,
    __xyzwReplayBridge: {
      __xyzwReplayBridgeReady: true,
      inspect() {
        return {};
      },
      play() {
        return { ok: true };
      },
    },
  };
  const execErrorWindow = {
    __require() {
      throw new TypeError("Cannot read properties of undefined (reading 'scene')");
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
  };

  launcherReadyWindow.__xyzwReplayRuntimeLayerState = {
    nextId: 0,
    bundleEvents: [],
    loadBundleCalls: [],
    pendingBundlePromises: new Map(),
    pendingSceneAssetPromises: new Map(),
    runSceneCalls: [],
    scriptEvents: [],
    tryLoadAssetCalls: [],
  };
  bundleRequestedWindow.__xyzwReplayRuntimeLayerState = {
    ...launcherReadyWindow.__xyzwReplayRuntimeLayerState,
    loadBundleCalls: [{
      at: Date.now(),
      bundleName: "game",
      phase: "requested",
      resolved: false,
      ok: null,
      source: "test",
      target: "game",
    }],
  };
  bundleLoadedWindow.__xyzwReplayRuntimeLayerState = {
    ...launcherReadyWindow.__xyzwReplayRuntimeLayerState,
    loadBundleCalls: [{
      at: Date.now(),
      bundleName: "game",
      phase: "resolved",
      resolved: true,
      ok: true,
      source: "test",
      target: "game",
    }],
  };
  sceneAssetWindow.__xyzwReplayRuntimeLayerState = {
    ...launcherReadyWindow.__xyzwReplayRuntimeLayerState,
    loadBundleCalls: [{
      at: Date.now(),
      bundleName: "game",
      phase: "resolved",
      resolved: true,
      ok: true,
      source: "test",
      target: "game",
    }],
    tryLoadAssetCalls: [{
      at: Date.now(),
      bundleName: "game",
      path: "scenes/Game",
      phase: "resolved",
      resolved: true,
      ok: true,
      source: "test",
    }],
  };
  runningWindow.__xyzwReplayRuntimeLayerState = {
    ...sceneAssetWindow.__xyzwReplayRuntimeLayerState,
    runSceneCalls: [{
      at: Date.now(),
      sceneName: "Game",
      source: "test",
    }],
  };
  readyWindow.__xyzwReplayRuntimeLayerState = {
    ...runningWindow.__xyzwReplayRuntimeLayerState,
  };
  publicLoaderWindow.__xyzwReplayRuntimeLayerState = {
    ...runningWindow.__xyzwReplayRuntimeLayerState,
    launcherRequireRef: function launcherReq() {},
  };
  execErrorWindow.__xyzwReplayRuntimeLayerState = {
    ...runningWindow.__xyzwReplayRuntimeLayerState,
  };

  assert.equal(detectXyzwRuntimeLayer(null).layer, "no-window");
  assert.equal(detectXyzwRuntimeLayer({}).layer, "no-require");
  assert.equal(detectXyzwRuntimeLayer(launcherReadyWindow).layer, "launcher-ready");
  assert.equal(detectXyzwRuntimeLayer(bundleRequestedWindow).layer, "launcher-ready");
  assert.equal(detectXyzwRuntimeLayer(bundleLoadedWindow).layer, "launcher-ready");
  assert.equal(detectXyzwRuntimeLayer(sceneAssetWindow).layer, "launcher-ready");
  assert.equal(detectXyzwRuntimeLayer(runningWindow).layer, "game-scene-running");
  assert.equal(detectLoaderFamily(publicLoaderWindow).loaderFamily, "public-xyzw-loader");
  assert.equal(detectXyzwRuntimeLayer(publicLoaderWindow).layer, "loader-family-mismatch");
  assert.equal(
    detectXyzwRuntimeLayer(publicLoaderWindow, { probeFamily: "production-id-probes" }).layer,
    "bridge-not-exposed",
  );
  assert.equal(
    detectXyzwRuntimeLayer(publicBridgeReadyWindow, { probeFamily: "production-id-probes" }).layer,
    "battle-modules-ready",
  );
  assert.equal(detectXyzwRuntimeLayer(execErrorWindow).layer, "require-exec-error");
  assert.equal(detectXyzwRuntimeLayer(readyWindow).layer, "battle-modules-ready");
});

test("fight pvp replay inspectBundleState inspects current window and same-origin iframes", () => {
  const launcherRequire = function launcherRequire(name) {
    throw new Error(`Cannot find module '${name}'`);
  };
  const iframeWindow = {
    __require() {
      return {};
    },
    document: {
      scripts: [{ src: "http://localhost/assets/game/index.js" }],
    },
    performance: {
      getEntriesByType() {
        return [{ name: "http://localhost/assets/game/index.js" }];
      },
    },
  };
  const runtimeWindow = {
    __require: launcherRequire,
    document: {
      querySelectorAll() {
        return [{ contentWindow: iframeWindow }];
      },
      scripts: [],
    },
    performance: {
      getEntriesByType() {
        return [];
      },
    },
    __xyzwReplayRuntimeLayerState: {
      launcherRequireRef: launcherRequire,
      nextId: 0,
      bundleEvents: [],
      loadBundleCalls: [],
      pendingBundlePromises: new Map(),
      pendingSceneAssetPromises: new Map(),
      runSceneCalls: [],
      scriptEvents: [],
      tryLoadAssetCalls: [],
    },
  };

  const result = inspectBundleState(runtimeWindow);

  assert.equal(result.currentWindowLabel, "window");
  assert.equal(result.windows.length, 2);
  assert.equal(result.windows[0].layer, "launcher-ready");
  assert.equal(result.windows[1].windowLabel, "iframe[0]");
  assert.equal(result.windows[1].layer, "launcher-ready");
  assert.equal(result.scene, null);
  assert.equal(result.requireSwap, false);
  assert.equal(result.sameRequireRef, true);
  assert.equal(result.sameRequireSource, true);
  assert.equal(result.loaderFamily, "unknown-loader");
  assert.equal(result.launcherRequireFingerprint?.name, "launcherRequire");
  assert.equal(result.liveRequireFingerprint?.name, "launcherRequire");
  assert.equal(
    result.canonicalModuleChecks.BattleUIManager.errorMessage,
    "Cannot find module 'BattleUIManager'",
  );
  assert.equal(typeof result.canonicalModuleChecks.BattleUIManager.stackTop, "string");
});

test("fight pvp replay inspectLoaderFamily reports public loader evidence and incompatible source probes", () => {
  const runtimeWindow = {
    __require() {
      return {};
    },
    document: {
      querySelectorAll() {
        return [];
      },
      scripts: [{ src: "http://localhost/xyzw/index.js" }],
    },
    performance: {
      getEntriesByType() {
        return [{ name: "http://localhost/xyzw/index.js" }];
      },
    },
  };

  const result = inspectLoaderFamily(runtimeWindow, {
    probeFamily: "production-id-probes",
  });

  assert.equal(result.loaderFamily, "public-xyzw-loader");
  assert.equal(result.currentAssetPath, "/xyzw/index.js");
  assert.equal(result.probeFamily, "production-id-probes");
  assert.equal(result.incompatibleProbes.includes("BattleUIManager"), true);
});

test("fight pvp replay probeRequireError preserves exact error message and stack top", () => {
  const runtimeWindow = {
    __require() {
      throw new TypeError("Cannot read properties of undefined (reading 'battle')");
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
  };

  const result = probeRequireError(runtimeWindow);

  assert.equal(result.BattleUIManager.status, "require-exec-error");
  assert.equal(
    result.BattleUIManager.errorMessage,
    "Cannot read properties of undefined (reading 'battle')",
  );
  assert.equal(typeof result.BattleUIManager.stackTop, "string");
});

test("fight pvp replay probeRequireError marks source-era ids as incompatible on the public loader family", () => {
  const runtimeWindow = {
    __require() {
      throw new Error("Cannot find module 'BattleUIManager'");
    },
    document: {
      scripts: [{ src: "http://localhost/xyzw/index.js" }],
    },
    performance: {
      getEntriesByType() {
        return [{ name: "http://localhost/xyzw/index.js" }];
      },
    },
  };

  const result = probeRequireError(runtimeWindow);

  assert.equal(result.BattleUIManager.status, "module-id-family-mismatch");
  assert.equal(result["enter-oss"].status, "module-id-family-mismatch");
  assert.equal(result.BattleKitCrossSite.status, "module-id-family-mismatch");
});

test("fight pvp replay waitForBattleModulesReady retries until the battle modules are ready", async () => {
  let calls = 0;
  const runtimeWindow = {
    __require(name) {
      calls += 1;
      if (name === "BattleUIManager" && calls >= 3) {
        return {
          SHOW_BATTLE_REPLAY_UI() {},
        };
      }
      throw new Error(`Cannot find module '${name}'`);
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
    setTimeout,
  };

  const result = await waitForBattleModulesReady({
    gameWindow: runtimeWindow,
    runtimeWindow,
    timeoutMs: 10,
    intervalMs: 1,
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "battle-modules-ready");
  assert.equal(result.attempts > 0, true);
});

test("fight pvp replay waitForBattleModulesReady returns launcher-ready when BattleUIManager never becomes available and no game bundle was requested", async () => {
  const runtimeWindow = {
    __require() {
      throw new Error("Cannot find module 'BattleUIManager'");
    },
    document: {
      scripts: [],
    },
    performance: {
      getEntriesByType() {
        return [];
      },
    },
    setTimeout,
  };

  const result = await waitForBattleModulesReady({
    gameWindow: runtimeWindow,
    runtimeWindow,
    timeoutMs: 2,
    intervalMs: 1,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "launcher-ready");
});

test("fight pvp replay waitForBattleModulesReady returns loader-family-mismatch immediately on the public loader family", async () => {
  const runtimeWindow = {
    __require() {
      throw new Error("Cannot find module 'BattleUIManager'");
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
    document: {
      scripts: [{ src: "http://localhost/xyzw/index.js" }],
    },
    performance: {
      getEntriesByType() {
        return [{ name: "http://localhost/xyzw/index.js" }];
      },
    },
    setTimeout,
  };

  const result = await waitForBattleModulesReady({
    gameWindow: runtimeWindow,
    runtimeWindow,
    timeoutMs: 2,
    intervalMs: 1,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "loader-family-mismatch");
  assert.equal(result.attempts, 0);
});

test("fight pvp replay waitForBattleModulesReady returns bridge-not-exposed immediately on the public loader family when using production probes", async () => {
  const runtimeWindow = createPublicLoaderWindow();

  const result = await waitForBattleModulesReady({
    gameWindow: runtimeWindow,
    runtimeWindow,
    timeoutMs: 2,
    intervalMs: 1,
    probeFamily: "production-id-probes",
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "bridge-not-exposed");
  assert.equal(result.attempts, 0);
});

test("fight pvp replay waitForBattleModulesReady returns battle-modules-ready immediately when a production bridge is exposed", async () => {
  const runtimeWindow = createPublicLoaderWindow({
    bridge: {
      __xyzwReplayBridgeReady: true,
      inspect() {
        return {};
      },
      play() {
        return { ok: true };
      },
    },
  });

  const result = await waitForBattleModulesReady({
    gameWindow: runtimeWindow,
    runtimeWindow,
    timeoutMs: 2,
    intervalMs: 1,
    probeFamily: "production-id-probes",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "battle-modules-ready");
  assert.equal(result.gameBundleReadySource, "window.__xyzwReplayBridge");
  assert.equal(result.attempts, 0);
});

test("fight pvp replay waitForBattleModulesReady returns require-exec-error immediately when the live loader throws a real runtime error", async () => {
  const runtimeWindow = {
    __require() {
      throw new TypeError("Cannot read properties of undefined (reading 'battle')");
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
    setTimeout,
  };

  const result = await waitForBattleModulesReady({
    gameWindow: runtimeWindow,
    runtimeWindow,
    timeoutMs: 2,
    intervalMs: 1,
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "require-exec-error");
  assert.equal(result.error, "Cannot read properties of undefined (reading 'battle')");
  assert.equal(result.attempts, 0);
});

test("fight pvp replay exposes only inspectBundleState and probeRequireError before battle modules are ready", () => {
  globalThis.window = {
    __require() {
      throw new Error("Cannot find module 'BattleUIManager'");
    },
    document: {
      querySelectorAll() {
        return [];
      },
      scripts: [],
    },
    performance: {
      getEntriesByType() {
        return [];
      },
    },
    setTimeout,
  };

  const runtimeLayerInfo = detectXyzwRuntimeLayer(globalThis.window, {
    windowLabel: "window",
  });
  const { helper, dispose } = exposeReplayConsoleHelpers(globalThis.window, {
    runtimeLayerInfo,
  });

  assert.equal(typeof helper?.inspectBundleState, "function");
  assert.equal(typeof helper?.probeRequireError, "function");
  assert.equal(typeof helper?.inspect, "undefined");
  assert.equal(typeof helper?.showReplay, "undefined");
  assert.equal(typeof helper?.showReplayDirect, "undefined");
  assert.equal(typeof helper?.waitForBattleModulesReady, "undefined");
  assert.equal(typeof helper?.tryCrossSitePlayback, "undefined");

  dispose();
});

test("fight pvp replay helper req getter always returns the live __require after a loader swap", async () => {
  const launcherReq = function launcherReq() {
    throw new Error("Cannot find module 'BattleUIManager'");
  };
  const freshReq = function freshReq(name) {
    if (name === "BattleUIManager") {
      return {
        SHOW_BATTLE_REPLAY_UI() {},
      };
    }
    return {};
  };
  globalThis.window = {
    __require: launcherReq,
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
    },
    document: {
      querySelectorAll() {
        return [];
      },
      scripts: [],
    },
    performance: {
      getEntriesByType() {
        return [];
      },
    },
    setTimeout,
  };

  const { helper, dispose } = exposeReplayConsoleHelpers(globalThis.window, {
    runtimeLayerInfo: detectXyzwRuntimeLayer(globalThis.window, {
      windowLabel: "window",
    }),
  });
  globalThis.window.__require = freshReq;

  assert.equal(helper.req, freshReq);
  assert.equal(helper.req === launcherReq, false);
  const probeResult = helper.probeRequireError();
  assert.equal(probeResult.BattleUIManager.status, "present");
  assert.equal(typeof helper.waitForBattleModulesReady, "undefined");

  dispose();
});

test("fight pvp replay scanSceneForReplayCandidates collects replay-related scene nodes and component methods", () => {
  class BattleReplayPanel {
    showBattleReplay() {}
  }

  const scene = {
    name: "Game",
    children: [{
      name: "BattleStage",
      children: [],
      _components: [new BattleReplayPanel()],
    }],
    _components: [],
  };

  const result = scanSceneForReplayCandidates({
    cc: {
      director: {
        getScene() {
          return scene;
        },
      },
    },
  });

  assert.equal(result.scene, "Game");
  assert.equal(result.sceneNodeMatches[0].nodeName, "BattleStage");
  assert.equal(result.sceneComponentMatches[0].componentName, "BattleReplayPanel");
  assert.equal(result.playMethodCandidates[0].methodName, "showBattleReplay");
});

test("fight pvp replay scanSceneForReplayCandidates widens discovery to scene-context handlers", () => {
  class ReplayBattlePanel {
    openPanel() {}
    refreshPreview() {}
  }

  const scene = {
    name: "Game",
    children: [{
      name: "战报中心",
      children: [],
      _components: [new ReplayBattlePanel()],
    }],
    _components: [],
  };

  const result = scanSceneForReplayCandidates({
    cc: {
      director: {
        getScene() {
          return scene;
        },
      },
    },
  });

  const openPanelCandidate = result.playMethodCandidates.find((candidate) => candidate.methodName === "openPanel");
  assert.ok(openPanelCandidate);
  assert.equal(openPanelCandidate.source, "scene-context-handler");
  assert.equal(result.replayLikeNodeContexts.includes("Game/战报中心"), true);
});

test("fight pvp replay resolveProductionReplayPlayTarget prefers global candidates before scene components", () => {
  class ScenePanel {
    play() {}
  }

  const runtimeWindow = createPublicLoaderWindow({
    globals: {
      BattleReplayController: {
        showBattleReplay() {},
      },
    },
    scene: {
      name: "Game",
      children: [{
        name: "GenericSceneRoot",
        children: [],
        _components: [new ScenePanel()],
      }],
      _components: [],
    },
  });
  globalThis.window = runtimeWindow;

  const result = resolveProductionReplayPlayTarget(runtimeWindow, {
    runtimeWindow,
  });

  assert.equal(result.playTargetSource, "global-object");
  assert.equal(result.playTargetLabel, "gameWindow.BattleReplayController.showBattleReplay");
});

test("fight pvp replay resolveProductionReplayPlayTarget blacklists getter-like metadata methods", () => {
  const runtimeWindow = createPublicLoaderWindow({
    globals: {
      BattleVersionController: {
        getBattleVersion() {
          return 321;
        },
      },
    },
  });
  globalThis.window = runtimeWindow;

  const result = resolveProductionReplayPlayTarget(runtimeWindow, {
    runtimeWindow,
  });

  assert.equal(result.bridgeStatus, "target-discovery-empty-after-blacklist");
  assert.equal(result.playTarget, null);
  assert.equal(result.playTargetLabel, "gameWindow.BattleVersionController.getBattleVersion");
  assert.equal(result.targetBlacklisted, true);
  assert.equal(result.targetLooksGetterLike, true);
  assert.equal(result.targetLooksMetadataLike, true);
  assert.equal(result.targetRejectedReason, "method-name-blacklisted");
  assert.equal(result.rankedTargets[0].targetBlacklisted, true);
  assert.equal(result.rankedTargets[0].rejectedReason, "method-name-blacklisted");
});

test("fight pvp replay resolveProductionReplayPlayTarget blacklists obvious error/audio/ad/effect play helpers", () => {
  class GlobalAudioServices {
    _dealPlayErr() {}
    playMusic() {}
    playVideoAd() {}
    playEffect() {}
    playEffect2() {}
  }

  const runtimeWindow = createPublicLoaderWindow({
    scene: {
      name: "Game",
      children: [{
        name: "Global Entity",
        children: [],
        _components: [new GlobalAudioServices()],
      }],
      _components: [],
    },
  });
  globalThis.window = runtimeWindow;

  const result = resolveProductionReplayPlayTarget(runtimeWindow, {
    runtimeWindow,
    payloadShape: {
      kind: "raw",
      hasBattleData: true,
      hasBattleResult: true,
      hasMapId: true,
    },
  });

  assert.equal(result.playTarget, null);
  assert.equal(result.bridgeStatus, "candidate-space-too-narrow");
  assert.equal(result.playTargetLabel, "Game/Global Entity#GlobalAudioServices._dealPlayErr");
  assert.equal(result.candidateSpaceTooNarrow, true);
  for (const methodName of ["_dealPlayErr", "playMusic", "playVideoAd", "playEffect", "playEffect2"]) {
    const entry = result.rankedTargets.find((candidate) => candidate.methodName === methodName);
    assert.ok(entry, `${methodName} should be present in ranked targets`);
    assert.equal(entry.targetBlacklisted, true);
  }
});

test("fight pvp replay collectReplayGlobalCandidates finds public replay globals and callable methods", () => {
  const runtimeWindow = createPublicLoaderWindow({
    globals: {
      BattleReplayController: {
        showBattleReplay() {},
        battleInfo: true,
      },
    },
  });
  globalThis.window = runtimeWindow;

  const result = collectReplayGlobalCandidates(runtimeWindow, {
    runtimeWindow,
  });

  assert.equal(result.availableGlobals[0].key, "BattleReplayController");
  assert.equal(result.availableGlobals[0].methodMatches.includes("showBattleReplay"), true);
  assert.equal(result.playMethodCandidates[0].label, "gameWindow.BattleReplayController.showBattleReplay");
});

test("fight pvp replay buildProductionReplayBridge discovers replay button click handlers", () => {
  const playCalls = [];
  class ReplayPanel {
    openPanel(payload, customEventData) {
      playCalls.push({ customEventData, payload });
      return customEventData;
    }
  }

  const replayNode = {
    name: "ReplayRoot",
    children: [],
    _components: [new ReplayPanel()],
  };
  const buttonNode = {
    name: "ButtonRoot",
    children: [],
    _components: [
      {
        clickEvents: [{
          component: "ReplayPanel",
          customEventData: "battle-replay",
          handler: "openPanel",
          target: replayNode,
        }],
      },
      {
        string: "回放",
      },
    ],
  };
  const runtimeWindow = createPublicLoaderWindow({
    scene: {
      name: "Game",
      children: [buttonNode, replayNode],
      _components: [],
    },
  });
  globalThis.window = runtimeWindow;

  const bridge = buildProductionReplayBridge(runtimeWindow, {
    gameWindowSource: "window",
    runtimeWindow,
  });

  const inspectResult = bridge.inspect();
  const playResult = bridge.play({
    battleInputData: {
      battleData: { result: { isWin: true } },
      mapId: 110001,
    },
  });

  assert.equal(inspectResult.candidateDiscoverySources.includes("button-click-event"), true);
  assert.equal(inspectResult.buttonHandlerCandidates[0].handlerName, "openPanel");
  assert.equal(inspectResult.replayLikeButtonTexts.includes("回放"), true);
  assert.equal(playResult.ok, true);
  assert.equal(playResult.playTargetSource, "button-click-event");
  assert.equal(playCalls[0].customEventData, "battle-replay");
});

test("fight pvp replay buildProductionReplayBridge prioritizes interaction trace handlers over service methods", () => {
  class MockButton {
    _onTouchEnded() {}
  }

  const playCalls = [];
  class ReplayPanel {
    openPanel(payload, customEventData) {
      playCalls.push({ customEventData, payload });
      return customEventData;
    }
  }
  class GlobalEntityServices {
    _dealPlayErr() {}
    playMusic() {}
  }

  const replayNode = {
    name: "ReplayRoot",
    children: [],
    _components: [new ReplayPanel()],
  };
  const buttonNode = {
    name: "回放按钮",
    children: [],
    _components: [],
  };
  const buttonComponent = new MockButton();
  buttonComponent.node = buttonNode;
  buttonComponent.clickEvents = [{
    component: "ReplayPanel",
    customEventData: "回放",
    handler: "openPanel",
    target: replayNode,
  }];
  buttonNode._components = [buttonComponent, { string: "回放" }];
  const scene = {
    name: "Game",
    children: [
      buttonNode,
      replayNode,
      {
        name: "Global Entity",
        children: [],
        _components: [new GlobalEntityServices()],
      },
    ],
    _components: [],
  };
  const runtimeWindow = createPublicLoaderWindow({
    extra: {
      cc: {
        Button: MockButton,
        Component: {
          EventHandler: {
            emitEvents() {
              return true;
            },
          },
        },
        director: {
          getScene() {
            return scene;
          },
        },
      },
    },
  });
  globalThis.window = runtimeWindow;

  const bridge = buildProductionReplayBridge(runtimeWindow, {
    gameWindowSource: "window",
    runtimeWindow,
  });
  const traceState = bridge.traceUiReplayHandlers();
  runtimeWindow.cc.Button.prototype._onTouchEnded.call(buttonComponent);
  runtimeWindow.cc.Component.EventHandler.emitEvents(buttonComponent.clickEvents);

  const inspectResult = bridge.inspect();

  assert.equal(traceState.emitEventsPatched, true);
  assert.equal(inspectResult.candidateDiscoverySources.includes("interaction-trace"), true);
  assert.equal(inspectResult.interactionTraceCandidates.length > 0, true);
  assert.equal(inspectResult.playTargetSource, "interaction-trace");
});

test("fight pvp replay buildProductionReplayBridge inspect returns scanner output and play uses the resolved production target", () => {
  const playCalls = [];
  const runtimeWindow = createPublicLoaderWindow({
    globals: {
      BattleReplayController: {
        showBattleReplay(payload) {
          playCalls.push(payload);
          return "played";
        },
      },
    },
  });
  globalThis.window = runtimeWindow;

  const bridge = buildProductionReplayBridge(runtimeWindow, {
    gameWindowSource: "window",
    runtimeWindow,
  });

  const inspectResult = bridge.inspect();
  const playResult = bridge.play({
    battleInputData: {
      battleData: { result: { isWin: true } },
      mapId: 110001,
    },
  });

  assert.equal(inspectResult.loaderFamily, "public-xyzw-loader");
  assert.equal(inspectResult.bridgeStatus, "bridge-ready");
  assert.equal(inspectResult.playTargetLabel, "gameWindow.BattleReplayController.showBattleReplay");
  assert.equal(inspectResult.targetRejectedReason, null);
  assert.equal(inspectResult.minimumPlayableScore, 60);
  assert.equal(inspectResult.playTargetScore >= inspectResult.minimumPlayableScore, true);
  assert.equal(playResult.ok, true);
  assert.equal(playResult.status, "played-via-production-bridge");
  assert.equal(playCalls[0].mapId, 110001);
  assert.equal(playCalls[0].battleResult.isWin, true);
});

test("fight pvp replay buildProductionReplayBridge rejects getter-like production targets before payload handling", () => {
  let invoked = false;
  const runtimeWindow = createPublicLoaderWindow({
    globals: {
      BattleVersionController: {
        getBattleVersion() {
          invoked = true;
          return 123;
        },
      },
    },
  });
  globalThis.window = runtimeWindow;

  const bridge = buildProductionReplayBridge(runtimeWindow, {
    gameWindowSource: "window",
    runtimeWindow,
  });

  const playResult = bridge.play({
    battleInputData: {
      battleData: { result: { isWin: true } },
      mapId: 110001,
    },
  });

  assert.equal(invoked, false);
  assert.equal(playResult.ok, false);
  assert.equal(playResult.status, "target-discovery-empty-after-blacklist");
  assert.equal(playResult.primaryRisk, "candidate-discovery-risk");
  assert.equal(playResult.targetBlacklisted, true);
  assert.equal(playResult.targetRejectedReason, "method-name-blacklisted");
  assert.equal(playResult.visualPostCheck.skipped, "no-playable-target-after-discovery");
  assert.equal(playResult.payloadShapeAfter, null);
});

test("fight pvp replay buildProductionReplayBridge rejects battle-only targets without play evidence", () => {
  let invoked = false;
  const runtimeWindow = createPublicLoaderWindow({
    globals: {
      BattleInfoController: {
        showBattleInfo(payload) {
          invoked = true;
          return payload;
        },
      },
    },
  });
  globalThis.window = runtimeWindow;

  const bridge = buildProductionReplayBridge(runtimeWindow, {
    gameWindowSource: "window",
    runtimeWindow,
  });

  const playResult = bridge.play({
    battleInputData: {
      battleData: { result: { isWin: true } },
      mapId: 110001,
    },
  });

  assert.equal(invoked, false);
  assert.equal(playResult.ok, false);
  assert.equal(playResult.status, "target-discovery-empty-after-blacklist");
  assert.equal(playResult.primaryRisk, "candidate-discovery-risk");
  assert.equal(playResult.targetRejectedReason, "battle-context-without-payload-affinity");
  assert.equal(playResult.visualPostCheck.skipped, "no-playable-target-after-discovery");
});

test("fight pvp replay buildProductionReplayBridge rejects weak scene play targets below confidence gate", () => {
  let invoked = false;
  const runtimeWindow = createPublicLoaderWindow({
    scene: {
      name: "Game",
      children: [{
        name: "GenericRoot",
        children: [],
        _components: [{
          play(payload) {
            invoked = true;
            return payload;
          },
        }],
      }],
      _components: [],
    },
  });
  globalThis.window = runtimeWindow;

  const bridge = buildProductionReplayBridge(runtimeWindow, {
    gameWindowSource: "window",
    runtimeWindow,
  });

  const playResult = bridge.play({
    battleInputData: {
      battleData: { result: { isWin: true } },
      mapId: 110001,
    },
  });

  assert.equal(invoked, false);
  assert.equal(playResult.ok, false);
  assert.equal(playResult.status, "target-discovery-empty-after-blacklist");
  assert.equal(playResult.primaryRisk, "candidate-discovery-risk");
  assert.equal(playResult.targetRejectedReason, "missing-replay-specific-reason");
  assert.equal(playResult.visualPostCheck.skipped, "no-playable-target-after-discovery");
});

test("fight pvp replay buildProductionReplayBridge allows battle-context plus payload-affinity targets", () => {
  let invokedPayload = null;
  class BattleStageController {
    play(payload) {
      invokedPayload = payload;
      return payload.mapId ?? payload?.battleData?.result?.isWin ?? null;
    }
  }

  const defaultReplayPayload = {
    battleInputData: {
      battleData: { result: { isWin: true } },
      mapId: 110001,
    },
  };
  const runtimeWindow = createPublicLoaderWindow({
    extra: {
      __REPLAY_DATA__: defaultReplayPayload,
    },
    scene: {
      name: "Game",
      children: [{
        name: "BattleStage",
        children: [],
        _components: [new BattleStageController()],
      }],
      _components: [],
    },
  });
  globalThis.window = runtimeWindow;

  const bridge = buildProductionReplayBridge(runtimeWindow, {
    gameWindowSource: "window",
    runtimeWindow,
  });

  const inspectResult = bridge.inspect();
  const playResult = bridge.play({
    battleInputData: {
      battleData: { result: { isWin: true } },
      mapId: 110001,
    },
  });

  assert.equal(inspectResult.bridgeStatus, "bridge-ready");
  assert.equal(inspectResult.playTargetWhy.includes("battle-context+payload-affinity"), true);
  assert.equal(playResult.ok, true);
  assert.equal(playResult.status, "played-via-production-bridge");
  assert.equal(invokedPayload.mapId, 110001);
});

test("fight pvp replay buildProductionReplayBridge returns bridge-exposed-but-play-target-missing when no production target is available", () => {
  const runtimeWindow = createPublicLoaderWindow();
  globalThis.window = runtimeWindow;

  const bridge = buildProductionReplayBridge(runtimeWindow, {
    gameWindowSource: "window",
    runtimeWindow,
  });

  const inspectResult = bridge.inspect();
  const playResult = bridge.play({
    battleData: {
      result: { isWin: true },
    },
  });

  assert.equal(inspectResult.bridgeStatus, "bridge-exposed-but-play-target-missing");
  assert.equal(playResult.ok, false);
  assert.equal(playResult.status, "bridge-exposed-but-play-target-missing");
  assert.equal(Array.isArray(playResult.playMethodCandidates), true);
});

test("fight pvp replay looksLikeBattleInput detects normalized battle input data", () => {
  const battleInput = createReplayBattleInput();

  assert.equal(looksLikeBattleInput(battleInput), true);
  assert.equal(looksLikeBattleInput({ battleData: {} }), false);
});

test("fight pvp replay getReplaySource prefers game window replay globals before current window fallbacks", () => {
  globalThis.window = {
    __REPLAY_DATA__: { from: "window" },
    __xyzwReplayData: { from: "window-fallback" },
  };

  const result = getReplaySource({
    __REPLAY_DATA__: { from: "game-window" },
  });

  assert.deepEqual(result, { from: "game-window" });
});

test("fight pvp replay ensureReplayInputData reuses normalized battleInputData and preserves non-plain options types", () => {
  const battleInput = createReplayBattleInput();
  const gameWindow = {
    __require() {
      throw new Error("should not require enter-oss for normalized battle input");
    },
  };

  const prepared = ensureReplayInputData(
    battleInput,
    gameWindow,
    { fromProbe: true },
  );

  assert.equal(prepared, battleInput);
  assert.equal(prepared.battleResult?.isWin, true);
  assert.equal(prepared.mapId, 110001);
  assert.equal(prepared.options instanceof Map, true);
  assert.deepEqual(prepared.__replayProbeOptions, { fromProbe: true });
});

test("fight pvp replay ensureReplayInputData normalizes wrapped replay payloads through enter-oss", () => {
  const rawBattleData = {
    mode: 32,
    result: { isWin: true },
  };
  const wrappedSource = {
    battleData: rawBattleData,
    mapId: 40001,
    stageNameStr: "切磋系统",
    startTipTopName: "切磋系统",
    startTipStage: "开始切磋",
    showRightPower: true,
  };
  const gameWindow = {
    __require(name) {
      if (name === "enter-oss") {
        return {
          EnterOSSState: class {
            getBattleDataByOSS(source) {
              return source.battleData;
            }

            createBattleInputData(battleData, battleResult) {
              return {
                battleData: {
                  ...battleData,
                  leftTeam: { team: new Map([[0, { heroId: 1001 }]]) },
                  rightTeam: { team: new Map([[0, { heroId: 2001 }]]) },
                },
                battleResult,
                options: {},
              };
            }
          },
        };
      }
      throw new Error(`Cannot find module '${name}'`);
    },
  };

  const prepared = ensureReplayInputData(wrappedSource, gameWindow, {
    replayProbe: true,
  });

  assert.equal(looksLikeBattleInput(prepared), true);
  assert.equal(prepared.mapId, 40001);
  assert.equal(prepared.stageNameStr, "切磋系统");
  assert.equal(prepared.startTipTopName, "切磋系统");
  assert.equal(prepared.startTipStage, "开始切磋");
  assert.equal(prepared.showRightPower, true);
  assert.equal(prepared.battleResult?.isWin, true);
  assert.equal(prepared.options.replayProbe, true);
});

test("fight pvp replay ensureReplayInputData throws a readable error when getBattleDataByOSS returns null", () => {
  const gameWindow = {
    __require(name) {
      if (name === "enter-oss") {
        return {
          EnterOSSState: class {
            getBattleDataByOSS() {
              return null;
            }

            createBattleInputData() {
              throw new Error("should not be called");
            }
          },
        };
      }
      throw new Error(`Cannot find module '${name}'`);
    },
  };

  assert.throws(
    () => ensureReplayInputData({ lastBattleData: null }, gameWindow),
    /getBattleDataByOSS returned null: expected raw battleData \/ \{battleData\} \/ \{fightRoleBase,lastBattleData\}/,
  );
});

test("fight pvp replay locator uses the explicit production bridge before source-era module probes", () => {
  const playCalls = [];
  const runtimeWindow = createPublicLoaderWindow({
    globals: {
      BattleReplayController: {
        showBattleReplay(payload) {
          playCalls.push(payload);
          return "played";
        },
      },
    },
  });
  globalThis.window = runtimeWindow;

  const bridge = buildProductionReplayBridge(runtimeWindow, {
    gameWindowSource: "window",
    runtimeWindow,
  });
  runtimeWindow.__xyzwReplayBridge = bridge;
  runtimeWindow.__xyzwReplay = bridge;

  const diagnostics = {};
  const entrypoint = locateReplayEntrypoint({ diagnostics });

  assert.equal(entrypoint?.label, "gameWindow.__xyzwReplayBridge.play");
  const result = entrypoint.invoke({
    battleData: {
      result: { isWin: true },
    },
  });
  assert.equal(result.status, "played-via-production-bridge");
  assert.equal(playCalls.length, 1);
  assert.equal(diagnostics.battleUiManagerModuleStatus, "module-id-family-mismatch");
  assert.equal(diagnostics.bridgeStatus, "bridge-ready");
  assert.equal(diagnostics.playTargetLabel, "gameWindow.BattleReplayController.showBattleReplay");
});

test("fight pvp replay locator prioritizes window.__require BattleUIManager SHOW_BATTLE_REPLAY_UI", () => {
  const invokeCalls = [];
  globalThis.window = {
    __require(name) {
      if (name === "BattleUIManager") {
        return {
          SHOW_BATTLE_REPLAY_UI(payload) {
            invokeCalls.push(payload);
          },
        };
      }
      if (name === "enter-oss") {
        return {};
      }
      if (name === "BattleKitCrossSite") {
        return {};
      }
      throw new Error(`Cannot find module '${name}'`);
    },
  };

  const diagnostics = {};
  const entrypoint = locateReplayEntrypoint({ diagnostics });

  assert.equal(
    entrypoint?.label,
    "window.__require(\"BattleUIManager\").SHOW_BATTLE_REPLAY_UI",
  );
  entrypoint.invoke({ replay: true });
  assert.deepEqual(invokeCalls, [{ replay: true }]);
  assert.equal(diagnostics.replayGameWindowStatus, "present");
  assert.equal(diagnostics.battleUiManagerModuleStatus, "present");
});

test("fight pvp replay locator uses iframe loader and marks wrong-window when only iframe has game modules", () => {
  const invokeCalls = [];
  const iframeWindow = {
    __require(name) {
      if (name === "BattleUIManager") {
        return {
          SHOW_BATTLE_REPLAY_UI(payload) {
            invokeCalls.push(payload);
          },
        };
      }
      if (name === "enter-oss") {
        return {};
      }
      if (name === "BattleKitCrossSite") {
        return {};
      }
      throw new Error(`Cannot find module '${name}'`);
    },
  };
  globalThis.window = {
    document: {
      querySelectorAll() {
        return [{ contentWindow: iframeWindow }];
      },
    },
  };

  const diagnostics = {};
  const entrypoint = locateReplayEntrypoint({ diagnostics });

  assert.equal(
    entrypoint?.label,
    "iframe[0].contentWindow.__require(\"BattleUIManager\").SHOW_BATTLE_REPLAY_UI",
  );
  entrypoint.invoke({ replay: "iframe" });
  assert.deepEqual(invokeCalls, [{ replay: "iframe" }]);
  assert.equal(diagnostics.replayGameWindowStatus, "wrong-window");
  assert.equal(diagnostics.replayGameWindowSource, "iframe[0]");
});

test("fight pvp replay locator reports no-require on all formal candidates when no game loader exists", () => {
  globalThis.window = {
    document: {
      querySelectorAll() {
        return [];
      },
    },
  };

  const diagnostics = {};
  const entrypoint = locateReplayEntrypoint({ diagnostics });

  assert.equal(entrypoint, null);
  assert.equal(diagnostics.replayGameWindowStatus, "no-require");
  assert.ok(
    diagnostics.replayEntrypointCandidates.every((entry) => entry.status === "no-require"),
  );
});

test("fight pvp replay locator reports not-callable when export exists but is not a function", () => {
  globalThis.window = {
    __require(name) {
      if (name === "BattleUIManager") {
        return {
          SHOW_BATTLE_REPLAY_UI: true,
        };
      }
      if (name === "enter-oss") {
        return {};
      }
      if (name === "BattleKitCrossSite") {
        return {};
      }
      throw new Error(`Cannot find module '${name}'`);
    },
  };

  const diagnostics = {};
  const entrypoint = locateReplayEntrypoint({ diagnostics });

  assert.equal(entrypoint, null);
  assert.equal(diagnostics.replayEntrypointCandidates[0].status, "not-callable");
});

test("fight pvp replay locator uses enter-oss with the correct module id and records legacy wrong-module-id debug", () => {
  globalThis.window = {
    __require(name) {
      if (name === "BattleUIManager") {
        return {};
      }
      if (name === "enter-oss") {
        return {
          EnterOSSState: class {
            showBattleViewWithData() {}
          },
        };
      }
      if (name === "BattleKitCrossSite") {
        return {};
      }
      throw new Error(`Cannot find module '${name}'`);
    },
  };

  const diagnostics = {};
  const entrypoint = locateReplayEntrypoint({ diagnostics });

  assert.equal(
    entrypoint?.label,
    "window.__require(\"enter-oss\").EnterOSSState.prototype.showBattleViewWithData",
  );
  assert.equal(
    diagnostics.replayEntrypointRequireDebug.find(
      (entry) => entry.label === "require(\"EnterOSSState\")",
    )?.status,
    "wrong-module-id",
  );
});

test("fight pvp replay locator uses BattleKitCrossSite singleton path and records legacy wrong-export-path debug", () => {
  const battleKitInstance = {
    _stage: 0,
    _isApplicationLoaded: false,
    _initBattleData: null,
    _inputData: null,
    tryRaisePlayback() {
      return this._stage;
    },
  };

  globalThis.window = {
    __require(name) {
      if (name === "BattleUIManager") {
        return {};
      }
      if (name === "enter-oss") {
        return {};
      }
      if (name === "BattleKitCrossSite") {
        return {
          BattleKitCrossSite: {
            instance: battleKitInstance,
          },
        };
      }
      throw new Error(`Cannot find module '${name}'`);
    },
  };

  const diagnostics = {};
  const entrypoint = locateReplayEntrypoint({ diagnostics });

  assert.equal(
    entrypoint?.label,
    "window.__require(\"BattleKitCrossSite\").BattleKitCrossSite.instance.tryRaisePlayback",
  );
  entrypoint.invoke({ replay: "debug" });
  assert.equal(battleKitInstance._stage, 2);
  assert.equal(
    diagnostics.replayEntrypointRequireDebug.find(
      (entry) => entry.label === "window.BattleKitCrossSite.instance.tryRaisePlayback",
    )?.status,
    "wrong-export-path",
  );
});

test("fight pvp replay safeRequireModule distinguishes missing modules from thrown requires", () => {
  const missing = safeRequireModule(
    () => {
      throw new Error("Cannot find module 'BattleUIManager'");
    },
    "BattleUIManager",
  );
  const threw = safeRequireModule(
    () => {
      throw new Error("Permission denied");
    },
    "BattleUIManager",
  );

  assert.equal(missing.ok, false);
  assert.equal(missing.errorType, "module-missing");
  assert.equal(missing.missing, true);
  assert.equal(threw.ok, false);
  assert.equal(threw.errorType, "require-threw");
  assert.equal(threw.missing, false);
});

test("fight pvp replay runtime bridge initializes missing bundle version containers", () => {
  const runtimeWindow = {
    cc: {
      assetManager: {
        downloader: {
          bundleVers: null,
        },
      },
    },
    ccInternalRemoteBundles: null,
  };
  const modules = {
    ResourceManager: {
      ResourceManager: {
        _instance: {
          bundleVersions: null,
        },
      },
    },
  };
  const diagnostics = { steps: [] };

  ensureReplayBundleVersionContainers({
    runtimeWindow,
    modules,
    diagnostics,
  });

  assert.deepEqual(runtimeWindow.cc.assetManager.downloader.bundleVers, {});
  assert.deepEqual(
    modules.ResourceManager.ResourceManager._instance.bundleVersions,
    {},
  );
  assert.deepEqual(runtimeWindow.ccInternalRemoteBundles, {});
  assert.ok(
    diagnostics.steps.includes("init-downloader-bundle-vers"),
  );
});

test("fight pvp replay runtime bridge rewrites local bundle targets to root absolute assets urls", () => {
  const runtimeWindow = {
    location: {
      origin: "https://xyzw.xq5007.fun",
    },
    cc: {
      path: {
        basename(value) {
          return String(value).split("/").filter(Boolean).at(-1) || "";
        },
      },
    },
  };

  assert.equal(
    toAbsoluteBundleRequestTarget("game", runtimeWindow),
    "https://xyzw.xq5007.fun/assets/game",
  );
  assert.equal(
    toAbsoluteBundleRequestTarget("/assets/game", runtimeWindow),
    "https://xyzw.xq5007.fun/assets/game",
  );
});

test("fight pvp replay runtime bridge installs replay-only shims for decimal modules", () => {
  const runtimeWindow = {
    __require(name) {
      throw new Error(`unhandled:${name}`);
    },
  };
  const diagnostics = { steps: [] };

  const shim = installReplayMissingModuleShims({
    runtimeWindow,
    diagnostics,
  });

  const decimalModule = runtimeWindow.__require("../../extras/libs/decimal/decimal");
  const decimalNumberModule = runtimeWindow.__require("decimal-number");

  assert.equal(typeof decimalModule.Decimal, "function");
  assert.equal(decimalModule.Decimal.prototype.toFixed.call({ _value: 1.23 }, 1), "1.2");
  assert.equal(decimalNumberModule.DecimalNumber.ZERO, 0);
  assert.equal(decimalNumberModule.DecimalNumber.create("3.5"), 3.5);
  assert.equal(decimalNumberModule.DecimalNumber.toFixed(1.239, 2), 1.23);

  shim.dispose();
  assert.throws(() => runtimeWindow.__require("decimal-number"), /unhandled/);
});

test("fight pvp replay runtime bridge installs a scoped VM2 shim for obfuscated auxiliary bundles", () => {
  const runtimeWindow = {};

  const shim = createScopedReplayVm2Shim({
    runtimeWindow,
  });

  assert.equal(
    runtimeWindow.VM2_INTERNAL_STATE_DO_NOT_USE_OR_PROGRAM_WILL_FAIL.handleException("boom"),
    "boom",
  );

  shim.dispose();
  assert.equal(
    "VM2_INTERNAL_STATE_DO_NOT_USE_OR_PROGRAM_WILL_FAIL" in runtimeWindow,
    false,
  );
});

test("fight pvp replay runtime bridge resolves auxiliary module aliases when bare names are unavailable", () => {
  const seen = [];
  const resolution = resolveReplayAuxiliaryModuleRegistration({
    moduleName: "LanguageExt",
    runtimeRequire(name) {
      seen.push(name);
      if (name === "../../../config/extensions/LanguageExt") {
        return {
          LanguageExt: {},
        };
      }
      throw new Error(`Cannot find module '${name}'`);
    },
  });

  assert.equal(resolution.ok, true);
  assert.equal(
    resolution.resolvedName,
    "../../../config/extensions/LanguageExt",
  );
  assert.ok(seen.includes("LanguageExt"));
  assert.ok(seen.includes("../../../config/extensions/LanguageExt"));
});

test("fight pvp replay runtime bridge auxiliary bundle cleanup ignores non-configurable globals", async () => {
  const headScripts = [];
  const targetDocument = {
    head: {
      appendChild(script) {
        headScripts.push(script);
        Object.defineProperty(runtimeWindow, "nonConfigurableAuxKey", {
          configurable: false,
          enumerable: true,
          value: "aux",
          writable: true,
        });
        runtimeWindow.__require = (name) => {
          if (name === "ConfigsExt") {
            return { ConfigsExt: {} };
          }
          throw new Error(`Cannot find module '${name}'`);
        };
        script.dataset.loaded = "true";
        script.onload?.();
        return script;
      },
    },
    createElement() {
      return {
        dataset: {},
        remove() {},
        addEventListener(type, handler) {
          if (type === "load") {
            this.onload = handler;
          }
          if (type === "error") {
            this.onerror = handler;
          }
        },
        setAttribute() {},
      };
    },
    querySelector() {
      return null;
    },
  };
  const runtimeWindow = {
    document: targetDocument,
    __require(name) {
      throw new Error(`unhandled:${name}`);
    },
  };
  const diagnostics = { steps: [] };

  const auxiliary = await ensureReplayAuxiliaryBundlesLoaded({
    runtimeWindow,
    targetDocument,
    diagnostics,
    scriptUrls: ["/assets/main/index.js"],
    requiredModules: ["ConfigsExt"],
  });

  assert.equal(auxiliary.dispose(), undefined);
  assert.equal(runtimeWindow.nonConfigurableAuxKey, "aux");
});

test("fight pvp replay runtime bridge installs a replay-local manifest shim", async () => {
  class MockPlatformManager {
    async manifest() {
      throw new Error("should be replaced");
    }
  }

  const modules = {
    PlatformManager: {
      PlatformManager: MockPlatformManager,
    },
  };
  const diagnostics = { steps: [] };
  const shim = installReplayManifestShim({
    modules,
    replay: {
      battleVersion: 240495,
      battleData: {
        version: 240495,
      },
    },
    diagnostics,
  });

  const instance = new MockPlatformManager();
  const manifest = await instance.manifest();

  assert.equal(instance._battleVersion, 240495);
  assert.equal(manifest.rawData.battleVersion, 240495);
  assert.equal(manifest.rawData.isLast, true);
  assert.ok(diagnostics.steps.includes("replay-manifest-called"));

  shim.dispose();
  await assert.rejects(instance.manifest(), /should be replaced/);
});

test("fight pvp replay runtime bridge blocks page exit and restart inside replay session", () => {
  class MockPlatformManager {
    exitGame() {
      throw new Error("should be blocked");
    }
  }

  const runtimeWindow = {
    cc: {
      game: {
        restart() {
          throw new Error("should be blocked");
        },
      },
    },
  };
  const diagnostics = { steps: [] };
  const guard = installReplayPageExitGuard({
    modules: {
      PlatformManager: {
        PlatformManager: MockPlatformManager,
      },
    },
    runtimeWindow,
    diagnostics,
  });

  const platformManager = new MockPlatformManager();
  assert.equal(platformManager.exitGame("replay"), null);
  runtimeWindow.cc.game.restart();
  assert.ok(diagnostics.steps.includes("blocked-platform-exit-game"));
  assert.ok(diagnostics.steps.includes("blocked-cc-game-restart"));

  guard.dispose();
  assert.throws(() => platformManager.exitGame(), /should be blocked/);
});

test("fight pvp replay runtime bridge bypasses privacy checks inside replay session", async () => {
  class MockGameLoginState {
    async begin() {
      throw new Error("should not login");
    }

    async _checkShowPrivacy() {
      throw new Error("should be blocked");
    }
  }

  const diagnostics = { steps: [] };
  const guard = installReplayPrivacyGuard({
    runtimeWindow: {
      __require(name) {
        if (name === "game-login") {
          return {
            GameLoginState: MockGameLoginState,
          };
        }
        throw new Error(`unexpected:${name}`);
      },
    },
    diagnostics,
  });

  const loginState = new MockGameLoginState();
  await assert.doesNotReject(loginState._checkShowPrivacy());
  await assert.doesNotReject(loginState.begin());
  assert.ok(diagnostics.steps.includes("blocked-game-login-privacy-check"));
  assert.ok(diagnostics.steps.includes("blocked-game-login-begin"));

  guard.dispose();
  await assert.rejects(loginState._checkShowPrivacy(), /should be blocked/);
  await assert.rejects(loginState.begin(), /should not login/);
});

test("fight pvp replay runtime bridge blocks user auth and privacy policy ui modules in shipped runtime shape", async () => {
  class MockUserAuth {
    constructor() {
      this.node = {
        active: true,
      };
      this.deferred = {
        resolveCalled: false,
        resolve: () => {
          this.deferred.resolveCalled = true;
        },
      };
    }

    onLoad() {
      throw new Error("should not mount auth ui");
    }

    showAuth() {
      throw new Error("should not show auth ui");
    }
  }

  class MockPrivacyPolicy {
    constructor() {
      this.node = {
        active: true,
      };
      this.labelPolicy = null;
    }

    onLoad() {
      throw new Error("should not fetch privacy text");
    }
  }

  const setGlobalCalls = [];
  const diagnostics = { steps: [] };
  const guard = installReplayPrivacyGuard({
    runtimeWindow: {
      __require(name) {
        if (name === "UserAuth") {
          return {
            UserAuth: MockUserAuth,
          };
        }
        if (name === "UserAgreementAndPrivacyPolicy") {
          return {
            UserAgreementAndPrivacyPolicy: MockPrivacyPolicy,
          };
        }
        if (name === "GlobalVarManager") {
          return {
            GlobalVarManager: {
              _instance: {
                set() {},
              },
            },
            SET_GLOBAL(key, value) {
              setGlobalCalls.push([key, value]);
            },
          };
        }
        if (name === "types-common") {
          return {
            GlobalVarKey: {
              UserAuthDeferred: "UserAuthDeferred",
              UserAgreementPrefab: "UserAgreementPrefab",
              PrivacyPolicyPrefab: "PrivacyPolicyPrefab",
            },
          };
        }
        throw new Error(`unexpected:${name}`);
      },
    },
    diagnostics,
  });

  const userAuth = new MockUserAuth();
  const privacyPolicy = new MockPrivacyPolicy();

  assert.doesNotThrow(() => userAuth.onLoad());
  assert.doesNotThrow(() => userAuth.showAuth(true));
  assert.doesNotThrow(() => privacyPolicy.onLoad());

  assert.equal(userAuth.node.active, false);
  assert.equal(userAuth.deferred, null);
  assert.equal(privacyPolicy.node.active, false);
  assert.ok(diagnostics.steps.includes("blocked-user-auth-onload"));
  assert.ok(diagnostics.steps.includes("blocked-user-auth-show-auth"));
  assert.ok(diagnostics.steps.includes("blocked-privacy-policy-onload"));
  assert.ok(
    setGlobalCalls.some(([key, value]) =>
      key === "UserAuthDeferred" && typeof value?.then === "function",
    ),
  );
  assert.ok(
    setGlobalCalls.some(([key, value]) =>
      key === "UserAgreementPrefab" && value === null,
    ),
  );
  assert.ok(
    setGlobalCalls.some(([key, value]) =>
      key === "PrivacyPolicyPrefab" && value === null,
    ),
  );

  guard.dispose();

  assert.throws(() => new MockUserAuth().onLoad(), /should not mount auth ui/);
  assert.throws(() => new MockUserAuth().showAuth(), /should not show auth ui/);
  assert.throws(() => new MockPrivacyPolicy().onLoad(), /should not fetch privacy text/);
});

test("fight pvp replay runtime bridge replaces PromiseUtil.wait with browser timers during replay", async () => {
  const diagnostics = { steps: [] };
  const promiseUtilModule = {
    default: {
      wait() {
        throw new Error("should be replaced");
      },
    },
  };
  const runtimeWindow = {
    __require(name) {
      if (name === "PromiseUtil") {
        return promiseUtilModule;
      }
      throw new Error(`unexpected:${name}`);
    },
    setTimeout,
  };
  const originalWait = promiseUtilModule.default.wait;
  const shim = installReplayPromiseUtilShim({
    runtimeWindow,
    diagnostics,
  });

  assert.notEqual(promiseUtilModule.default.wait, originalWait);
  await assert.doesNotReject(() => promiseUtilModule.default.wait(0));
  assert.ok(diagnostics.steps.includes("shim-promise-util-wait"));

  shim.dispose();
  assert.throws(() => promiseUtilModule.default.wait(0), /should be replaced/);
});

test("fight pvp replay runtime bridge guards resource manager bundle maps before loadBundle", async () => {
  class MockResourceManager {
    async loadBundle(bundleName) {
      return {
        bundleName,
        bundlePromisesType: typeof this._bundlePromises,
        fguiPromisesType: typeof this._fguiPromises,
      };
    }
  }

  const runtimeWindow = {
    cc: {
      js: {
        createMap() {
          return Object.create(null);
        },
      },
    },
  };
  const diagnostics = { steps: [] };
  const guard = installReplayResourceManagerGuard({
    modules: {
      ResourceManager: {
        ResourceManager: MockResourceManager,
      },
    },
    runtimeWindow,
    diagnostics,
  });

  const resourceManager = new MockResourceManager();
  resourceManager._bundlePromises = null;
  resourceManager._fguiPromises = null;
  resourceManager.bundleVersions = null;

  const result = await resourceManager.loadBundle("TEST_REMOTE_MODULE");

  assert.equal(result.bundleName, "TEST_REMOTE_MODULE");
  assert.equal(result.bundlePromisesType, "object");
  assert.equal(result.fguiPromisesType, "object");
  assert.deepEqual(resourceManager.bundleVersions, {});
  assert.ok(diagnostics.steps.includes("init-resource-bundle-promises"));
  assert.ok(diagnostics.steps.includes("init-resource-fgui-promises"));

  guard.dispose();
});

test("fight pvp replay runtime bridge observes TRY_LOAD_ASSET and runScene handoff stages", async () => {
  const resourceManagerModule = {
    TRY_LOAD_ASSET(bundleName, path) {
      return Promise.resolve({ bundleName, path, name: "Game" });
    },
  };
  const runtimeWindow = {
    cc: {
      director: {
        currentScene: null,
        getScene() {
          return this.currentScene;
        },
        runScene(scene) {
          this.currentScene = scene;
          return scene;
        },
      },
    },
    __require(name) {
      if (name === "BattleUIManager") {
        return {
          SHOW_BATTLE_REPLAY_UI() {},
        };
      }
      return {};
    },
  };
  const diagnostics = { steps: [] };
  const observer = installReplaySceneStageObserver({
    modules: {
      ResourceManager: resourceManagerModule,
    },
    runtimeWindow,
    diagnostics,
  });

  await resourceManagerModule.TRY_LOAD_ASSET("game", "scenes/Game", class SceneAsset {});
  runtimeWindow.cc.director.runScene({ name: "Game" });

  const snapshot = inspectBundleState(runtimeWindow).currentWindow.details;
  assert.equal(snapshot.gameSceneAssetLoaded, true);
  assert.equal(snapshot.gameSceneRunning, true);
  assert.equal(snapshot.tryLoadAssetCalls.length, 2);
  assert.equal(snapshot.tryLoadAssetCalls.at(-1).ok, true);
  assert.equal(snapshot.runSceneCalls.at(-1).sceneName, "Game");

  observer.dispose();
});

test("fight pvp replay runtime bridge patches assetManager loadBundle and bundle downloader to root absolute bundle urls", () => {
  const seenTargets = [];
  const runtimeWindow = {
    location: {
      origin: "https://xyzw.xq5007.fun",
      href: "https://xyzw.xq5007.fun/admin/orders",
    },
    cc: {
      path: {
        basename(value) {
          return String(value).split("/").filter(Boolean).at(-1) || "";
        },
      },
      assetManager: {
        loadBundle(target, ...args) {
          seenTargets.push(["loadBundle", target, ...args]);
          return target;
        },
        downloader: {
          _downloaders: {
            bundle(target, options, callback) {
              seenTargets.push(["bundle", target, options, callback]);
              return target;
            },
          },
        },
      },
    },
  };
  const diagnostics = { steps: [] };
  const patch = installReplayBundleResolverPatch({
    runtimeWindow,
    diagnostics,
  });

  runtimeWindow.cc.assetManager.loadBundle("TEST_REMOTE_MODULE", "extra");
  runtimeWindow.cc.assetManager.downloader._downloaders.bundle(
    "main",
    { version: "1" },
    () => {},
  );

  assert.deepEqual(seenTargets[0].slice(0, 3), [
    "loadBundle",
    "https://xyzw.xq5007.fun/assets/TEST_REMOTE_MODULE",
    "extra",
  ]);
  assert.equal(
    seenTargets[1][1],
    "https://xyzw.xq5007.fun/assets/main",
  );
  assert.ok(diagnostics.steps.includes("patch-local-bundle-target"));
  assert.deepEqual(diagnostics.patchedBundleTargets, [
    "https://xyzw.xq5007.fun/assets/TEST_REMOTE_MODULE",
    "https://xyzw.xq5007.fun/assets/main",
  ]);

  patch.dispose();

  const restoredLoadResult = runtimeWindow.cc.assetManager.loadBundle("TEST_REMOTE_MODULE");
  const restoredDownloaderResult = runtimeWindow.cc.assetManager.downloader._downloaders.bundle("main");
  assert.equal(restoredLoadResult, "TEST_REMOTE_MODULE");
  assert.equal(restoredDownloaderResult, "main");
});

test("fight pvp replay runtime bridge reports missing external modules from incomplete game bundle", () => {
  const coverage = analyzeBundleExternalModuleCoverage({
    gameBundleSource: `
      window.__require = function(){};
      ({ "KnownLocal": [function(){}], "GameLoading": [function(e){ e("../../extras/libs/decimal/decimal"); e("../../extras/config/extensions/LanguageExt"); }, {
        "../../extras/libs/decimal/decimal": void 0,
        "../../extras/config/extensions/LanguageExt": void 0,
        "./KnownLocal": "KnownLocal"
      }] });
    `,
    launcherBundleSource: `
      window.__require = function(){};
      ({ "LanguageExt": [function(){}] });
    `,
    supplementalBundleSources: [
      `
        window.__require = function(){};
        ({ "decimal-number": [function(){}] });
      `,
    ],
    allowedModules: ["decimal", "../../extras/libs/decimal/decimal"],
  });

  assert.deepEqual(coverage.missingModules, []);

  const incompleteCoverage = analyzeBundleExternalModuleCoverage({
    gameBundleSource: `
      window.__require = function(){};
      ({ "GameLoading": [function(e){ e("../../extras/libs/decimal/decimal"); e("../../extras/config/extensions/LanguageExt"); }, {
        "../../extras/libs/decimal/decimal": void 0,
        "../../extras/config/extensions/LanguageExt": void 0
      }] });
    `,
    launcherBundleSource: `window.__require = function(){};`,
    allowedModules: ["decimal", "../../extras/libs/decimal/decimal"],
  });

  assert.deepEqual(incompleteCoverage.missingModules, [
    {
      raw: "../../extras/config/extensions/LanguageExt",
      base: "LanguageExt",
    },
  ]);
});

test("fight pvp replay runtime bridge observes asset requests and restores fetch after dispose", async () => {
  const originalFetch = async (input) => {
    const url = String(input);
    if (url.includes("html-fallback")) {
      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            return name === "content-type" ? "text/html; charset=utf-8" : "";
          },
        },
      };
    }
    if (url.includes("missing")) {
      return {
        ok: false,
        status: 404,
        headers: {
          get(name) {
            return name === "content-type" ? "application/json" : "";
          },
        },
      };
    }
    if (url.includes("pending")) {
      return new Promise(() => {});
    }
    return {
      ok: true,
      status: 200,
      headers: {
        get(name) {
          return name === "content-type" ? "application/json" : "";
        },
      },
    };
  };
  const runtimeWindow = {
    fetch: originalFetch,
    location: {
      href: "https://xyzw.xq5007.fun/replay-runtime-probe.html",
    },
  };
  const diagnostics = {};

  const observer = installReplayAssetRequestObserver({
    runtimeWindow,
    diagnostics,
  });

  await runtimeWindow.fetch("https://xyzw.xq5007.fun/assets/game/import/missing.json");
  await runtimeWindow.fetch("https://xyzw.xq5007.fun/assets/game/import/html-fallback.json");
  void runtimeWindow.fetch("https://xyzw.xq5007.fun/assets/main/pending.bin");

  assert.equal(diagnostics.firstFailedAssetRequest.pathname, "/assets/game/import/missing.json");
  assert.equal(
    diagnostics.firstHtmlFallbackAssetRequest.pathname,
    "/assets/game/import/html-fallback.json",
  );
  assert.equal(diagnostics.firstPendingAssetRequest.pathname, "/assets/main/pending.bin");
  assert.equal(Array.isArray(diagnostics.assetRequestLog), true);
  assert.equal(diagnostics.assetRequestLog.length, 3);

  observer.dispose();
  assert.equal(runtimeWindow.fetch, originalFetch);
});

test("fight pvp replay runtime bridge probes the real Game scene import asset and reports the first missing path", async () => {
  const diagnostics = {};
  const runtimeWindow = {
    fetch: async (url) => {
      if (String(url).includes("/assets/game/config.json")) {
        return {
          ok: true,
          status: 200,
          clone() {
            return {
              async json() {
                return {
                  uuids: ["unused-0", "unused-1", "unused-2", "unused-3", "73788c49-686e-46bd-b737-8f681d06f0be"],
                  scenes: {
                    "db://assets/game/scenes/Game.fire": 4,
                  },
                  versions: {
                    import: [4, "42ab3"],
                  },
                };
              },
            };
          },
          headers: {
            get(name) {
              return name === "content-type" ? "application/json" : "";
            },
          },
        };
      }
      return {
        ok: false,
        status: 404,
        headers: {
          get(name) {
            return name === "content-type" ? "application/json" : "";
          },
        },
      };
    },
    location: {
      href: "https://xyzw.xq5007.fun/replay-runtime-probe.html",
    },
  };

  const probe = await probeGameSceneAssets({
    diagnostics,
    runtimeWindow,
  });
  const failure = classifyRuntimeLoadFailure({
    stateId: "LoadGameScene",
    diagnostics,
    timedOut: false,
  });

  assert.equal(probe[1].stage, "scene-record");
  assert.equal(
    probe[1].pathname,
    "/assets/game/import/73/73788c49-686e-46bd-b737-8f681d06f0be.42ab3.json",
  );
  assert.equal(probe[2].stage, "scene-import");
  assert.equal(probe[2].ok, false);
  assert.equal(
    diagnostics.firstMissingAsset,
    "/assets/game/import/73/73788c49-686e-46bd-b737-8f681d06f0be.42ab3.json",
  );
  assert.match(failure.message, /Game scene 依赖资源加载失败/);
  assert.match(failure.message, /73788c49-686e-46bd-b737-8f681d06f0be/);
});

test("fight pvp replay runtime bridge keeps waiting while LoadGameScene is still loading within timeout budget", async () => {
  let now = 0;
  const runtimeWindow = {
    cc: {
      director: {
        getScene() {
          return {
            name:
              now >= 300
                ? "Game"
                : now >= 100
                  ? "SomeOtherScene"
                  : "FightPvpReplayBootstrap",
          };
        },
      },
      game: {
        _prepared: true,
        _rendererInitialized: true,
      },
    },
    setTimeout(callback) {
      now += 100;
      callback();
    },
  };
  const modules = {
    Game: {
      Game: {
        _instance: {
          stateMachine: {
            current: {
              get stateId() {
                return now >= 300 ? "GameRunning" : "LoadGameScene";
              },
            },
          },
        },
      },
    },
    Launcher: {
      Launcher: {
        _instance: {},
      },
    },
    PlatformManager: {
      PlatformManager: {
        _instance: {
          getBattleVersion() {
            return 0;
          },
        },
      },
    },
  };
  const diagnostics = {};

  const result = await waitForRuntimeReadyForReplay({
    modules,
    diagnostics,
    runtimeWindow,
    bootstrapSceneName: "FightPvpReplayBootstrap",
    timeoutMs: 35000,
    intervalMs: 0,
    getNow: () => now,
  });

  assert.equal(result.ok, true);
  assert.equal(result.sceneName, "Game");
  assert.ok(diagnostics.gameStateHistory.includes("LoadGameScene"));
});

test("fight pvp replay runtime bridge does not treat a non-bootstrap scene as success when LoadingError is observed", async () => {
  const runtimeWindow = {
    cc: {
      director: {
        getScene() {
          return {
            name: "SomeOtherScene",
          };
        },
      },
      game: {
        _prepared: true,
        _rendererInitialized: true,
      },
    },
    setTimeout(callback) {
      callback();
    },
  };
  const modules = {
    Game: {
      Game: {
        _instance: {
          stateMachine: {
            current: {
              stateId: "LoadingError",
            },
          },
        },
      },
    },
    Launcher: {
      Launcher: {
        _instance: {},
      },
    },
    PlatformManager: {
      PlatformManager: {
        _instance: {
          getBattleVersion() {
            return 0;
          },
        },
      },
    },
  };
  const diagnostics = {
    loadingErrorReason: "scene import missing",
  };

  const result = await waitForRuntimeReadyForReplay({
    modules,
    diagnostics,
    runtimeWindow,
    bootstrapSceneName: "FightPvpReplayBootstrap",
    timeoutMs: 35000,
    intervalMs: 0,
    getNow: () => 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.sceneName, "SomeOtherScene");
  assert.equal(result.stateId, "LoadingError");
  assert.match(result.message, /LoadingError/);
  assert.match(result.message, /scene import missing/);
});

test("fight pvp replay runtime bridge fails immediately when LoadingError is observed", async () => {
  const runtimeWindow = {
    cc: {
      director: {
        getScene() {
          return {
            name: "FightPvpReplayBootstrap",
          };
        },
      },
      game: {
        _prepared: true,
        _rendererInitialized: true,
      },
    },
    setTimeout(callback) {
      callback();
    },
  };
  const modules = {
    Game: {
      Game: {
        _instance: {
          stateMachine: {
            current: {
              stateId: "LoadingError",
            },
          },
        },
      },
    },
    Launcher: {
      Launcher: {
        _instance: {},
      },
    },
    PlatformManager: {
      PlatformManager: {
        _instance: {
          getBattleVersion() {
            return 0;
          },
        },
      },
    },
  };
  const diagnostics = {
    loadingErrorReason: "scene import missing",
  };

  const result = await waitForRuntimeReadyForReplay({
    modules,
    diagnostics,
    runtimeWindow,
    bootstrapSceneName: "FightPvpReplayBootstrap",
    timeoutMs: 35000,
    intervalMs: 0,
    getNow: () => 0,
  });

  assert.equal(result.ok, false);
  assert.equal(result.stateId, "LoadingError");
  assert.match(result.message, /LoadingError/);
  assert.match(result.message, /scene import missing/);
});

test("fight pvp replay runtime bridge probes showBattleLoading replay start signal", async () => {
  class MockBattleUIManager {}

  MockBattleUIManager.prototype.showBattleLoading = function showBattleLoading(...args) {
    this.lastArgs = args;
    return args;
  };

  const diagnostics = { steps: [] };
  const probe = installReplayBattleStartProbe({
    modules: {
      BattleUIManager: {
        BattleUIManager: MockBattleUIManager,
      },
    },
    runtimeWindow: {
      clearTimeout,
      setTimeout,
    },
    diagnostics,
  });

  const instance = new MockBattleUIManager();
  instance.showBattleLoading(
    { name: "CommonBattleTeamPanel" },
    { name: "NormalSwitchLoading" },
    {
      mapId: 110001,
      battleData: {
        mode: 7,
      },
    },
    true,
  );

  const result = await probe.waitForSignal({ timeoutMs: 50 });

  assert.equal(result.ok, true);
  assert.equal(result.panel, "CommonBattleTeamPanel");
  assert.equal(result.isReplay, true);
  assert.equal(result.mapId, 110001);
  assert.equal(result.battleMode, 7);
  assert.equal(diagnostics.replayStartSignal, true);
  assert.equal(diagnostics.replayStartPanel, "CommonBattleTeamPanel");
  probe.dispose();
});

test("fight pvp replay runtime bridge returns ok true when replay entrypoint starts successfully", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  const helperDispatches = [];
  let enterOssShowBattleViewWithDataCalls = 0;
  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout() {},
    __require(name) {
      if (name === "BattleUIManager") {
        return {
          SHOW_BATTLE_REPLAY_UI(payload, options) {
            helperDispatches.push({ payload, options });
          },
        };
      }
      if (name === "enter-oss") {
        return {
          EnterOSSState: class {
            getBattleDataByOSS(source) {
              return source?.battleData ?? source?.lastBattleData ?? null;
            }

            createBattleInputData(battleData, battleResult) {
              const inputData = createReplayBattleInput({
                mapId: 10001,
                mode: battleData?.mode ?? 7,
              });
              inputData.battleResult = battleResult;
              return inputData;
            }

            showBattleViewWithData() {
              enterOssShowBattleViewWithDataCalls += 1;
            }
          },
        };
      }
      if (name === "BattleKitCrossSite") {
        return {
          BattleKitCrossSite: {
            instance: {
              tryRaisePlayback() {},
            },
          },
        };
      }
      throw new Error(`Cannot find module '${name}'`);
    },
    requestAnimationFrame(callback) {
      callback();
      return 1;
    },
    setTimeout(callback) {
      callback();
      return 1;
    },
    cc: {
      director: {
        getScene() {
          return { name: "Game" };
        },
      },
      game: {
        canvas: {},
      },
    },
  };
  globalThis.HTMLElement = MockHTMLElement;
  globalThis.window.__REPLAY_DATA__ = {
    battleData: {
      mode: 32,
      result: { isWin: true },
    },
  };

  const battleInputData = createReplayBattleInput();
  const hostElement = new MockHTMLElement();
  const session = await startFightPvpReplayRuntime({
    replay: {
      battleVersion: 123,
      mapId: 110001,
      mapIdSource: "test.mapId",
      pvpMapIdSource: "test.mapId",
      battleInputData,
      battleInputSnapshot: createFightPvpBattleInputSnapshot(
        createReplayBattleInput({
          battleVersion: 123,
          mapId: 999999,
          selfScore: 99,
        }),
      ),
    },
    hostElement,
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createWxShim: () => ({
        dispose() {},
      }),
      installLoadingErrorObserver: () => ({
        dispose() {},
      }),
      installReplayAssetRequestObserver: () => ({
        dispose() {},
      }),
      installMissingModuleShims: () => ({
        dispose() {},
        providedAliases: new Set(),
      }),
      installReplayPrivacyGuard: () => ({
        dispose() {},
      }),
      installManifestShim: () => ({
        dispose() {},
      }),
      installPageExitGuard: () => ({
        dispose() {},
      }),
      installResourceManagerGuard: () => ({
        dispose() {},
      }),
      installBundleResolverPatch: () => ({
        dispose() {},
      }),
      installReplayPromiseUtilShim: () => ({
        dispose() {},
      }),
      ensureBundleVersionContainers() {},
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      ensureRuntimeBooted: async () => {},
      ensureRuntimeLoaded: async () => {},
      createVm2Shim: () => ({
        dispose() {},
      }),
      ensureAuxiliaryBundlesLoaded: async () => ({
        dispose() {},
      }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => ({
          ok: true,
          panel: "CommonBattleTeamPanel",
          isReplay: true,
          mapId: 110001,
          battleMode: 7,
        }),
      }),
      locateReplayEntrypoint: () => ({
        label: "mock-entrypoint",
        invoke() {},
        gameWindow: globalThis.window,
      }),
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      readRuntimeModules: () => ({}),
      startReplayEntrypoint: async ({ battleInput }) => {
        assert.equal("replay" in battleInput, false);
        assert.equal(battleInput.mapId, 110001);
        assert.equal(battleInput.startTipStage, "开始切磋");
        assert.equal(battleInput.options.get("selfScore"), 10);
        return { ok: true, entrypoint: "mock-entrypoint" };
      },
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, true);
  assert.equal(session.reason, "ok");
  assert.equal(session.diagnostics.sourceType, "live-memory-battle-input");
  assert.equal(session.diagnostics.battleInputSource, "live-memory-battle-input");
  assert.equal(session.diagnostics.engineReplayEntrypoint, "mock-entrypoint");
  const inspectResult = await globalThis.window.__xyzwReplay.inspect();
  assert.equal(typeof globalThis.window.__xyzwReplay?.inspect, "function");
  assert.equal(typeof globalThis.window.__xyzwReplay?.inspectBundleState, "function");
  assert.equal(typeof globalThis.window.__xyzwReplay?.showReplay, "function");
  assert.equal(typeof globalThis.window.__xyzwReplay?.showReplayDirect, "function");
  assert.equal(typeof globalThis.window.__xyzwReplay?.showReplayViaEnterOSS, "function");
  assert.equal(typeof globalThis.window.__xyzwReplay?.tryCrossSitePlayback, "function");
  assert.equal(typeof globalThis.window.__xyzwReplay?.probeRequireError, "function");
  assert.equal(typeof globalThis.window.__xyzwReplay?.waitForBattleModulesReady, "undefined");
  assert.equal(Array.isArray(inspectResult.replayEntrypointCandidates), true);
  assert.equal(inspectResult.hasGameWindow, true);
  assert.equal(inspectResult.hasRequire, true);
  assert.equal(inspectResult.runtimeStage, "battle-modules-ready");
  assert.equal(inspectResult.replayData.isWrapped, true);
  assert.equal(inspectResult.replayData.isBattleInputLike, false);
  globalThis.window.__xyzwReplay.showReplay(battleInputData, { fromManual: true });
  globalThis.window.__xyzwReplay.showReplayDirect({
    battleData: {
      mode: 32,
      result: { isWin: true },
    },
    mapId: 40001,
    stageNameStr: "切磋系统",
  }, { fromDirect: true });
  assert.equal(helperDispatches.length, 2);
  assert.equal(helperDispatches[0].payload, battleInputData);
  assert.equal(helperDispatches[1].payload.mapId, 40001);
  assert.equal(helperDispatches[1].payload.battleResult.isWin, true);
  assert.equal(enterOssShowBattleViewWithDataCalls, 0);
  globalThis.window.__xyzwReplay.showReplayViaEnterOSS({
    battleData: {
      mode: 32,
      result: { isWin: true },
    },
  });
  assert.equal(enterOssShowBattleViewWithDataCalls, 1);
  assert.equal(session.diagnostics.replayStartSignal, true);
  assert.equal(session.diagnostics.replayStartPanel, "CommonBattleTeamPanel");
  session.dispose();

  delete globalThis.window;
  delete globalThis.HTMLElement;
});

test("fight pvp replay runtime bridge accepts the real fight_startpvp fixture through the success path", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    setTimeout,
  };
  globalThis.HTMLElement = MockHTMLElement;

  const realReplay = createFightPvpRealReplayFixture();
  const session = await startFightPvpReplayRuntime({
    replay: realReplay,
    hostElement: new MockHTMLElement(),
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createWxShim: () => ({
        dispose() {},
      }),
      ensureBundleVersionContainers() {},
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      ensureRuntimeBooted: async () => {},
      ensureRuntimeLoaded: async () => {},
      createVm2Shim: () => ({
        dispose() {},
      }),
      ensureAuxiliaryBundlesLoaded: async () => ({
        dispose() {},
      }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => ({
          ok: true,
          panel: "CommonBattleTeamPanel",
          isReplay: true,
          mapId: 110001,
          battleMode: 32,
        }),
      }),
      locateReplayEntrypoint: () => ({
        label: "mock-entrypoint",
        invoke() {},
      }),
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      readRuntimeModules: () => ({ consts: {} }),
      startReplayEntrypoint: async ({ battleInput }) => {
        assert.equal(battleInput.battleData.mode, 32);
        assert.equal(battleInput.mapId, 110001);
        assert.equal(battleInput.battleResult.isWin, true);
        assert.equal(
          battleInput.options.get("targetRole")?.roleId,
          String(realReplay.battleInputSnapshot.battleData.rightTeam.roleId),
        );
        return { ok: true, entrypoint: "mock-entrypoint" };
      },
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, true);
  assert.equal(session.reason, "ok");
  assert.deepEqual(session.diagnostics.missingRuntimeFields, []);
  assert.equal(session.diagnostics.battleInputSummary.battleMode, 32);
  assert.equal(session.diagnostics.battleInputSummary.mapId, 110001);
  assert.equal(session.diagnostics.battleInputSummary.sourceType, "persisted-battle-input-snapshot");
  assert.equal(session.diagnostics.battleInputSource, "persisted-battle-input-snapshot");
  assert.equal(session.diagnostics.engineReplayEntrypoint, "mock-entrypoint");
  assert.equal(session.diagnostics.mapIdSource, "fixture.110001");
  assert.equal(session.diagnostics.fixtureMapFallbackUsed, true);
  assert.equal(session.diagnostics.replayStartSignal, true);

  delete globalThis.window;
  delete globalThis.HTMLElement;
});

test("fight pvp replay runtime bridge surfaces runtime self-role mapId diagnostics for persisted snapshot records", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    setTimeout,
  };
  globalThis.HTMLElement = MockHTMLElement;

  const runtimeReplay = createFightPvpRuntimeRoleReplayFixture();

  const session = await startFightPvpReplayRuntime({
    replay: runtimeReplay,
    hostElement: new MockHTMLElement(),
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createWxShim: () => ({
        dispose() {},
      }),
      ensureBundleVersionContainers() {},
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      ensureRuntimeBooted: async () => {},
      ensureRuntimeLoaded: async () => {},
      createVm2Shim: () => ({
        dispose() {},
      }),
      ensureAuxiliaryBundlesLoaded: async () => ({
        dispose() {},
      }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => ({
          ok: true,
          event: {
            isReplay: true,
            mapId: 40001,
            mode: 32,
          },
        }),
      }),
      locateReplayEntrypoint: () => ({
        label: "mock-entrypoint",
        invoke() {},
      }),
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      readRuntimeModules: () => ({ consts: {} }),
      startReplayEntrypoint: async ({ battleInput }) => {
        assert.equal(battleInput.mapId, 40001);
        assert.equal(battleInput.mapIdSource, "runtime.ROLE.pvpMapId");
        assert.equal(battleInput.runtimeRolePath, "runtime.ROLE");
        return { ok: true, entrypoint: "mock-entrypoint" };
      },
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, true);
  assert.equal(session.reason, "ok");
  assert.equal(session.diagnostics.mapId, 40001);
  assert.equal(session.diagnostics.mapIdSource, "runtime.ROLE.pvpMapId");
  assert.equal(session.diagnostics.runtimeRolePath, "runtime.ROLE");
  assert.equal(session.diagnostics.runtimeRoleAvailable, true);
  assert.equal(session.diagnostics.runtimeRoleMapId, 40001);
  assert.equal(session.diagnostics.battleInputSummary.mapId, 40001);
  assert.equal(session.diagnostics.battleInputSummary.mapIdSource, "runtime.ROLE.pvpMapId");
  assert.equal(session.diagnostics.battleInputSummary.runtimeRolePath, "runtime.ROLE");

  delete globalThis.window;
  delete globalThis.HTMLElement;
});

test("fight pvp replay runtime bridge installs privacy guard before runtime boot", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    setTimeout,
  };
  globalThis.HTMLElement = MockHTMLElement;

  const callOrder = [];
  const session = await startFightPvpReplayRuntime({
    replay: createSnapshotReplayRecord(),
    hostElement: new MockHTMLElement(),
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createVm2Shim: () => ({ dispose() {} }),
      createWxShim: () => ({ dispose() {} }),
      ensureRuntimeLoaded: async () => {},
      ensureAuxiliaryBundlesLoaded: async () => ({ dispose() {} }),
      installLoadingErrorObserver: () => ({ dispose() {} }),
      installReplayAssetRequestObserver: () => ({ dispose() {} }),
      installMissingModuleShims: () => ({ dispose() {}, providedAliases: new Set() }),
      readRuntimeModules: () => ({}),
      installReplayPrivacyGuard: () => {
        callOrder.push("privacy");
        return { dispose() {} };
      },
      installManifestShim: () => ({ dispose() {} }),
      installPageExitGuard: () => ({ dispose() {} }),
      installResourceManagerGuard: () => ({ dispose() {} }),
      ensureBundleVersionContainers() {},
      installBundleResolverPatch: () => ({ dispose() {} }),
      ensureRuntimeBooted: async () => {
        callOrder.push("boot");
      },
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      inspectGameBundleModuleCoverage: async () => ({ missingModules: [] }),
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
      installReplayPromiseUtilShim: () => ({ dispose() {} }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => ({
          ok: true,
          panel: "CommonBattleTeamPanel",
          isReplay: true,
          mapId: 110001,
          battleMode: 7,
        }),
      }),
      locateReplayEntrypoint: () => ({
        label: "mock-entrypoint",
      }),
      startReplayEntrypoint: async () => ({
        ok: true,
        entrypoint: "mock-entrypoint",
      }),
    },
  });

  assert.equal(session.ok, true);
  assert.deepEqual(callOrder, ["privacy", "boot"]);

  delete globalThis.window;
  delete globalThis.HTMLElement;
});

test("fight pvp replay runtime bridge fails fast when the production bridge reports a missing play target", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    setTimeout,
  };
  globalThis.HTMLElement = MockHTMLElement;

  let replayProbeWaitCalled = false;
  const session = await startFightPvpReplayRuntime({
    replay: createSnapshotReplayRecord(),
    hostElement: new MockHTMLElement(),
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createWxShim: () => ({
        dispose() {},
      }),
      ensureBundleVersionContainers() {},
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      ensureRuntimeBooted: async () => {},
      ensureRuntimeLoaded: async () => {},
      createVm2Shim: () => ({
        dispose() {},
      }),
      ensureAuxiliaryBundlesLoaded: async () => ({
        dispose() {},
      }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => {
          replayProbeWaitCalled = true;
          return { ok: true };
        },
      }),
      locateReplayEntrypoint: () => ({
        label: "window.__xyzwReplayBridge.play",
        invoke() {
          return {
            ok: false,
            status: "bridge-exposed-but-play-target-missing",
            detail: "no production play target",
          };
        },
      }),
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      readRuntimeModules: () => ({ consts: {} }),
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, false);
  assert.equal(session.reason, "replay-start-failed");
  assert.match(session.message, /production replay bridge 已暴露/);
  assert.equal(session.diagnostics.replayEntrypointInvokeStatus, "bridge-exposed-but-play-target-missing");
  assert.equal(replayProbeWaitCalled, false);

  delete globalThis.window;
  delete globalThis.HTMLElement;
});

test("fight pvp replay runtime bridge surfaces candidate-space-too-narrow without regressing to payload risk", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    setTimeout,
  };
  globalThis.HTMLElement = MockHTMLElement;

  const session = await startFightPvpReplayRuntime({
    replay: createSnapshotReplayRecord(),
    hostElement: new MockHTMLElement(),
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createWxShim: () => ({
        dispose() {},
      }),
      ensureBundleVersionContainers() {},
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      ensureRuntimeBooted: async () => {},
      ensureRuntimeLoaded: async () => {},
      createVm2Shim: () => ({
        dispose() {},
      }),
      ensureAuxiliaryBundlesLoaded: async () => ({
        dispose() {},
      }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => ({ ok: true }),
      }),
      locateReplayEntrypoint: () => ({
        label: "window.__xyzwReplayBridge.play",
        invoke() {
          return {
            buttonHandlerCandidates: [],
            candidateDiscoverySources: ["scene-component"],
            candidateSpaceTooNarrow: true,
            interactionTraceCandidates: [],
            ok: false,
            payloadShapeAfter: null,
            primaryRisk: "candidate-discovery-risk",
            status: "candidate-space-too-narrow",
            targetDiscoverySummary: {
              status: "candidate-space-too-narrow",
            },
            visualPostCheck: {
              skipped: "no-playable-target-after-discovery",
            },
          };
        },
      }),
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      readRuntimeModules: () => ({ consts: {} }),
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, false);
  assert.equal(session.reason, "replay-start-failed");
  assert.match(session.message, /candidate-space-too-narrow|候选发现空间过窄/);
  assert.doesNotMatch(session.message, /payload-shape-risk/);

  delete globalThis.window;
  delete globalThis.HTMLElement;
});

test("fight pvp replay runtime bridge marks old production summary output as stale-probe-assets-or-summary", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  const runtimeWindow = createPublicLoaderWindow({
    bridge: {
      inspect() {
        return {
          bridgeStatus: "played-via-production-bridge",
        };
      },
      play() {
        return {
          ok: true,
          status: "played-via-production-bridge",
          visualPostCheck: {
            skipped: "service-bridge-no-visual-probe",
          },
        };
      },
    },
  });
  runtimeWindow.HTMLElement = MockHTMLElement;
  runtimeWindow.clearTimeout = clearTimeout;
  runtimeWindow.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  runtimeWindow.setTimeout = setTimeout;
  globalThis.window = runtimeWindow;
  globalThis.HTMLElement = MockHTMLElement;

  const session = await startFightPvpReplayRuntime({
    replay: createSnapshotReplayRecord(),
    hostElement: new MockHTMLElement(),
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createWxShim: () => ({
        dispose() {},
      }),
      ensureBundleVersionContainers() {},
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      ensureRuntimeBooted: async () => {},
      ensureRuntimeLoaded: async () => {},
      createVm2Shim: () => ({
        dispose() {},
      }),
      ensureAuxiliaryBundlesLoaded: async () => ({
        dispose() {},
      }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => ({ ok: true }),
      }),
      inspectBundleState: () => ({
        currentWindow: {
          details: {
            canonicalModuleChecks: {},
            loaderFamily: "public-xyzw-loader",
            loaderFamilyEvidence: { publicEvidence: ["document:/xyzw/index.js"], srcEvidence: [] },
            suspectedBundlePath: "/xyzw/index.js",
          },
        },
      }),
      locateReplayEntrypoint: ({ diagnostics }) => {
        diagnostics.loaderFamily = "public-xyzw-loader";
        diagnostics.bridgeStatus = "played-via-production-bridge";
        diagnostics.bridgeSource = "gameWindow.__xyzwReplayBridge";
        diagnostics.replayEntrypointInvokeStatus = "played-via-production-bridge";
        diagnostics.playTargetLabel = "Game/Global Entity#t._dealPlayErr";
        diagnostics.playTargetScore = null;
        diagnostics.playTargetWhy = [];
        diagnostics.visualPostCheck = {
          skipped: "service-bridge-no-visual-probe",
        };
        return null;
      },
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      readRuntimeModules: () => ({ consts: {} }),
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, false);
  assert.equal(session.reason, "replay-start-failed");
  assert.match(session.message, /stale-probe-assets-or-summary/);
  assert.match(session.message, /public\/replay-runtime-probe\.js/);

  delete globalThis.window;
  delete globalThis.HTMLElement;
});

test("fight pvp replay runtime bridge fails when replay entrypoint does not trigger replay-start probe", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    setTimeout,
  };
  globalThis.HTMLElement = MockHTMLElement;

  const session = await startFightPvpReplayRuntime({
    replay: createSnapshotReplayRecord(),
    hostElement: new MockHTMLElement(),
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createWxShim: () => ({
        dispose() {},
      }),
      ensureBundleVersionContainers() {},
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      ensureRuntimeBooted: async () => {},
      ensureRuntimeLoaded: async () => {},
      createVm2Shim: () => ({
        dispose() {},
      }),
      ensureAuxiliaryBundlesLoaded: async () => ({
        dispose() {},
      }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => ({
          ok: false,
          message: "已调用回放入口，但未观测到 showBattleLoading(..., true, ...) 启动信号。",
        }),
      }),
      locateReplayEntrypoint: () => ({
        label: "mock-entrypoint",
        invoke() {},
      }),
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      readRuntimeModules: () => ({}),
      startReplayEntrypoint: async ({ battleInput }) => {
        assert.equal("replay" in battleInput, false);
        return { ok: true, entrypoint: "mock-entrypoint" };
      },
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, false);
  assert.equal(session.reason, "replay-start-failed");
  assert.match(session.message, /showBattleLoading/);

  delete globalThis.window;
  delete globalThis.HTMLElement;
});

test("fight pvp replay runtime bridge reports readable legacy-field failures without guessing mapId", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    setTimeout,
  };
  globalThis.HTMLElement = MockHTMLElement;

  const session = await startFightPvpReplayRuntime({
    replay: {
      replayId: "legacy-missing-fields",
      battleId: "legacy-missing-fields",
      battleVersion: 240495,
      stageNameStr: "切磋系统",
      startTipTopName: "切磋系统",
      startTipStage: "开始切磋",
      battleData: {
        id: "legacy-missing-fields",
        version: 240495,
        leftTeam: {
          roleId: "left-role",
          name: "我方",
          team: [{ heroId: 1001 }],
        },
        rightTeam: {
          roleId: "right-role",
          name: "敌方",
          team: [{ heroId: 2001 }],
        },
        result: {
          isWin: true,
        },
      },
      battleResult: {
        isWin: true,
      },
    },
    hostElement: new MockHTMLElement(),
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createWxShim: () => ({
        dispose() {},
      }),
      ensureBundleVersionContainers() {},
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      ensureRuntimeBooted: async () => {},
      ensureRuntimeLoaded: async () => {},
      createVm2Shim: () => ({
        dispose() {},
      }),
      ensureAuxiliaryBundlesLoaded: async () => ({
        dispose() {},
      }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => ({ ok: false }),
      }),
      locateReplayEntrypoint: () => ({
        label: "mock-entrypoint",
        invoke() {},
      }),
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      readRuntimeModules: () => ({
        consts: {
          ModelConst: {
            BATTLE_REPLAY: "BATTLE_REPLAY",
          },
        },
      }),
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, false);
  assert.equal(session.reason, "replay-start-failed");
  assert.deepEqual(session.diagnostics.missingRuntimeFields, [
    "mapId",
    "battleData.mode",
  ]);
  assert.equal(session.diagnostics.mapIdSource, null);
  assert.equal(session.diagnostics.pvpMapIdSource, null);
  assert.deepEqual(session.diagnostics.availableValues, {});
  assert.match(session.message, /无法确定本场切磋地图/);
  assert.match(session.message, /mapId/);
  assert.match(session.message, /battleData\.mode/);

  delete globalThis.window;
  delete globalThis.HTMLElement;
});

test("fight pvp replay runtime bridge falls back to default 40001 for snapshot records without mapId", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    setTimeout,
  };
  globalThis.HTMLElement = MockHTMLElement;

  const snapshotRecord = createSnapshotReplayRecord({
    battleInputData: createReplayBattleInput({
      mapId: null,
    }),
    mapId: null,
    mapIdSource: null,
    pvpMapIdSource: null,
    mapIdResolveReason: "battle-input-mapId-not-written",
    dressPvpMapUsedId: null,
    selfRoleContextSource: "window.ROLE",
    runtimeRoleAvailable: true,
    runtimeRolePath: "runtime.ROLE",
    battleInputAvailable: true,
  });

  const session = await startFightPvpReplayRuntime({
    replay: snapshotRecord,
    hostElement: new MockHTMLElement(),
    runtimeAdapter: {
      createCanvasHost: () => ({
        canvas: { id: "replay-canvas", width: 960, height: 540 },
        viewport: {},
      }),
      createWxShim: () => ({
        dispose() {},
      }),
      ensureBundleVersionContainers() {},
      ensureReplayBootstrapScene: async () => ({
        bootstrapSceneName: "Bootstrap",
        cleanup() {},
      }),
      ensureRuntimeBooted: async () => {},
      ensureRuntimeLoaded: async () => {},
      createVm2Shim: () => ({
        dispose() {},
      }),
      ensureAuxiliaryBundlesLoaded: async () => ({
        dispose() {},
      }),
      installReplayBattleStartProbe: () => ({
        dispose() {},
        waitForSignal: async () => ({
          ok: true,
          event: {
            isReplay: true,
            mapId: 40001,
            mode: 7,
          },
        }),
      }),
      locateReplayEntrypoint: () => ({
        label: "mock-entrypoint",
        invoke() {},
      }),
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      probeGameSceneAssets: async () => [],
      readRuntimeModules: () => ({
        consts: {},
      }),
      startReplayEntrypoint: async ({ battleInput }) => {
        assert.equal(battleInput.mapId, 40001);
        assert.equal(battleInput.mapIdSource, "fallback.defaultMapId.40001");
        return { ok: true, entrypoint: "mock-entrypoint" };
      },
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, true);
  assert.equal(session.reason, "ok");
  assert.equal(session.diagnostics.mapId, 40001);
  assert.equal(session.diagnostics.mapIdSource, "fallback.defaultMapId.40001");
  assert.equal(session.diagnostics.mapIdResolveReason, "battle-input-mapId-not-written");
  assert.equal(session.diagnostics.dressPvpMapUsedId, null);
  assert.equal(session.diagnostics.selfRoleContextSource, "window.ROLE");
  assert.equal(session.diagnostics.runtimeRoleAvailable, true);
  assert.equal(session.diagnostics.runtimeRolePath, "runtime.ROLE");
  assert.equal(session.diagnostics.battleInputAvailable, true);
  assert.equal(session.diagnostics.battleInputSummary.mapId, 40001);
  assert.equal(session.diagnostics.battleInputSummary.mapIdSource, "fallback.defaultMapId.40001");

  delete globalThis.window;
  delete globalThis.HTMLElement;
});
