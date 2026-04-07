/* eslint-disable test/no-import-node-test */
import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

globalThis.window = globalThis.window || {};

const loadModule = jiti(import.meta.url, { interopDefault: true });
const { Cache } = loadModule("../../src/stores/cache.ts");

test("Cache suppresses console error output when logError is false", async () => {
  const cache = new Cache("test-cache", { timeout: 1000 });
  const originalConsoleError = console.error;
  const consoleCalls = [];
  console.error = (...args) => {
    consoleCalls.push(args);
  };

  try {
    const result = await cache.get(
      "closed-activity",
      async () => {
        throw new Error("服务器错误: 2100010 - 未知错误");
      },
      { logError: false },
    );

    assert.equal(result, undefined);
    assert.equal(consoleCalls.length, 0);
  } finally {
    console.error = originalConsoleError;
  }
});
