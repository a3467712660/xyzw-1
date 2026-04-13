/* eslint-disable test/no-import-node-test */
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import jiti from "jiti";

const srcRoot = fileURLToPath(new URL("../../src", import.meta.url));
const loadModule = jiti(import.meta.url, {
  interopDefault: true,
  alias: {
    "@": srcRoot,
  },
});

test("createConnectionMonitor start/stop is idempotent", async (t) => {
  const originalSetInterval = globalThis.setInterval;
  const originalClearInterval = globalThis.clearInterval;
  const originalConsoleError = console.error;
  const intervalHandles = [];
  const clearedHandles = [];

  console.error = () => {};
  globalThis.setInterval = (callback, ms) => {
    const handle = {
      callback,
      ms,
      unref() {},
    };
    intervalHandles.push(handle);
    return handle;
  };
  globalThis.clearInterval = (handle) => {
    clearedHandles.push(handle);
  };

  t.after(() => {
    globalThis.setInterval = originalSetInterval;
    globalThis.clearInterval = originalClearInterval;
    console.error = originalConsoleError;
  });

  const { createConnectionMonitor } = loadModule(
    "../../src/services/token/tokenMaintenanceService.ts",
  );

  const monitor = createConnectionMonitor({
    wsConnections: { value: {} },
    connectionLocks: { value: {} },
    activeConnections: { value: {} },
    closeWebSocketConnectionAsync: async () => {},
    clearCrossTabConnectionState: () => {},
    logger: {
      warn: () => {},
      debug: () => {},
      info: () => {},
    },
  });

  assert.equal(monitor.isMonitoring(), false);

  monitor.startMonitoring();
  monitor.startMonitoring();

  assert.equal(intervalHandles.length, 1);
  assert.equal(intervalHandles[0]?.ms, 10000);
  assert.equal(monitor.isMonitoring(), true);

  monitor.stopMonitoring();
  monitor.stopMonitoring();

  assert.equal(clearedHandles.length, 1);
  assert.equal(clearedHandles[0], intervalHandles[0]);
  assert.equal(monitor.isMonitoring(), false);

  monitor.startMonitoring();
  assert.equal(intervalHandles.length, 2);
  assert.equal(monitor.isMonitoring(), true);
});
