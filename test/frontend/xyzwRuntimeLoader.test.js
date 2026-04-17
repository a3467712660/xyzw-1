import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetXyzwRuntimeLoaderForTests,
  ensureRuntimeHostAllowed,
  ensureXyzwRuntimeLoaded,
  XYZW_RUNTIME_VARIANTS,
} from "../../src/services/replay/xyzwRuntimeLoader.js";

const createStubRuntimeWindow = () => {
  const scripts = new Map();
  const appended = [];

  const document = {
    head: {
      appendChild(script) {
        const key = `${script.attributes["data-xyzw-runtime"]}::${script.attributes["data-xyzw-runtime-variant"]}`;
        scripts.set(key, script);
        appended.push(script.src);
        if (script.src === "/xyzw/index.js") {
          runtimeWindow.__require = () => ({});
        }
        queueMicrotask(() => {
          script.dataset.loaded = "true";
          script.listeners.load?.();
        });
      },
    },
    createElement() {
      return {
        attributes: {},
        dataset: {},
        listeners: {},
        addEventListener(type, handler) {
          this.listeners[type] = handler;
        },
        setAttribute(name, value) {
          this.attributes[name] = value;
        },
      };
    },
    querySelector(selector) {
      const srcMatch = selector.match(/data-xyzw-runtime="([^"]+)"/);
      const variantMatch = selector.match(/data-xyzw-runtime-variant="([^"]+)"/);
      if (!srcMatch || !variantMatch) {
        return null;
      }
      return scripts.get(`${srcMatch[1]}::${variantMatch[1]}`) || null;
    },
  };

  const runtimeWindow = {
    document,
    location: {
      hostname: "localhost",
    },
  };

  return {
    appended,
    runtimeWindow,
  };
};

test.afterEach(() => {
  __resetXyzwRuntimeLoaderForTests();
});

test("xyzw runtime loader loads replay browser defines without affecting default variant keys", async () => {
  const { appended, runtimeWindow } = createStubRuntimeWindow();

  await ensureXyzwRuntimeLoaded({
    variant: XYZW_RUNTIME_VARIANTS.REPLAY_BROWSER,
    runtimeWindow,
    targetDocument: runtimeWindow.document,
  });

  assert.deepEqual(appended, [
    "/xyzw/cocos2d-js-min.js",
    "/xyzw/game-defines.browser.js",
    "/xyzw/index.js",
  ]);
});

test("xyzw runtime loader does not treat launcher-only __require as replay-browser ready", async () => {
  const { appended, runtimeWindow } = createStubRuntimeWindow();
  runtimeWindow.__require = () => {
    throw new Error("Cannot find module 'BattleUIManager'");
  };
  runtimeWindow.document.scripts = [];
  runtimeWindow.performance = {
    getEntriesByType() {
      return [];
    },
  };

  await ensureXyzwRuntimeLoaded({
    variant: XYZW_RUNTIME_VARIANTS.REPLAY_BROWSER,
    runtimeWindow,
    targetDocument: runtimeWindow.document,
  });

  assert.deepEqual(appended, [
    "/xyzw/cocos2d-js-min.js",
    "/xyzw/game-defines.browser.js",
    "/xyzw/index.js",
  ]);
});

test("xyzw runtime loader reuses replay-browser require only when the game bundle is already ready", async () => {
  const { appended, runtimeWindow } = createStubRuntimeWindow();
  runtimeWindow.PLATFORM = "web";
  runtimeWindow.__require = (name) => {
    if (name === "BattleUIManager") {
      return {
        SHOW_BATTLE_REPLAY_UI() {},
      };
    }
    return {};
  };
  runtimeWindow.document.scripts = [{ src: "http://localhost/assets/game/index.js" }];
  runtimeWindow.performance = {
    getEntriesByType() {
      return [{ name: "http://localhost/assets/game/index.js" }];
    },
  };

  const runtimeRequire = await ensureXyzwRuntimeLoaded({
    variant: XYZW_RUNTIME_VARIANTS.REPLAY_BROWSER,
    runtimeWindow,
    targetDocument: runtimeWindow.document,
  });

  assert.equal(runtimeRequire, runtimeWindow.__require);
  assert.deepEqual(appended, []);
});

test("xyzw runtime loader allows the repo deployment host without requiring ignored local env files", () => {
  assert.equal(
    ensureRuntimeHostAllowed("xyzw.xq5007.fun", ""),
    "xyzw.xq5007.fun",
  );
});
