import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeBundleExternalModuleCoverage,
  classifyRuntimeLoadFailure,
  createScopedReplayVm2Shim,
  ensureReplayBundleVersionContainers,
  ensureReplayAuxiliaryBundlesLoaded,
  installReplayAssetRequestObserver,
  installReplayBattleStartProbe,
  installReplayBundleResolverPatch,
  installReplayPrivacyGuard,
  installReplayPromiseUtilShim,
  installReplayResourceManagerGuard,
  installReplayPageExitGuard,
  installReplayMissingModuleShims,
  installReplayManifestShim,
  probeGameSceneAssets,
  resolveReplayAuxiliaryModuleRegistration,
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

  globalThis.window = {
    HTMLElement: MockHTMLElement,
    clearTimeout,
    requestAnimationFrame(callback) {
      return setTimeout(callback, 0);
    },
    setTimeout,
  };
  globalThis.HTMLElement = MockHTMLElement;

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

test("fight pvp replay runtime bridge surfaces live mapId failure metadata from snapshot records", async () => {
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
    mapIdResolveReason: "pvp-map-conf-unavailable",
    dressPvpMapUsedId: 7001,
    selfRoleContextSource: "refreshed-role_getroleinfo",
    runtimeRoleAvailable: false,
    battleInputAvailable: false,
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
        consts: {},
      }),
      waitForRuntimeReadyForReplay: async () => ({
        ok: true,
        sceneName: "Game",
      }),
    },
  });

  assert.equal(session.ok, false);
  assert.equal(session.reason, "replay-start-failed");
  assert.equal(session.diagnostics.mapIdResolveReason, "pvp-map-conf-unavailable");
  assert.equal(session.diagnostics.dressPvpMapUsedId, 7001);
  assert.equal(session.diagnostics.selfRoleContextSource, "refreshed-role_getroleinfo");
  assert.equal(session.diagnostics.runtimeRoleAvailable, false);
  assert.equal(session.diagnostics.battleInputAvailable, false);

  delete globalThis.window;
  delete globalThis.HTMLElement;
});
