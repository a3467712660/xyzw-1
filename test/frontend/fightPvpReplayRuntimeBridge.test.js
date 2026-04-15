import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeBundleExternalModuleCoverage,
  createScopedReplayVm2Shim,
  ensureReplayBundleVersionContainers,
  installReplayResourceManagerGuard,
  installReplayPageExitGuard,
  installReplayMissingModuleShims,
  installReplayManifestShim,
  startFightPvpReplayRuntime,
  toAbsoluteBundleRequestTarget,
} from "../../src/services/replay/fightPvpReplayRuntimeBridge.js";

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

test("fight pvp replay runtime bridge returns ok true when replay entrypoint starts successfully", async () => {
  class MockHTMLElement {
    constructor() {
      this.innerHTML = "";
      this.clientWidth = 960;
      this.clientHeight = 540;
    }
  }

  globalThis.window = {
    HTMLElement: MockHTMLElement,
  };
  globalThis.HTMLElement = MockHTMLElement;

  const hostElement = new MockHTMLElement();
  const session = await startFightPvpReplayRuntime({
    replay: {
      battleVersion: 123,
      battleData: {
        version: 123,
      },
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
      locateReplayEntrypoint: () => ({
        label: "mock-entrypoint",
        invoke() {},
      }),
      inspectGameBundleModuleCoverage: async () => ({
        missingModules: [],
      }),
      probeGameBundleAssets: async () => [],
      readRuntimeModules: () => ({}),
      startReplayEntrypoint: async ({ replay }) => {
        assert.equal(replay.battleVersion, 123);
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
  session.dispose();

  delete globalThis.window;
  delete globalThis.HTMLElement;
});
