import assert from "node:assert/strict";
import test from "node:test";

import {
  __resetXyzwRuntimeLoaderForTests,
  XYZW_RUNTIME_VARIANTS,
  ensureXyzwRuntimeLoaded,
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
