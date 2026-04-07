/* eslint-disable test/no-import-node-test */
import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import jiti from "jiti";

globalThis.window = globalThis.window || {};
const localStorageStub = {
  getItem: () => null,
  removeItem: () => {},
  setItem: () => {},
};
Object.defineProperty(globalThis, "localStorage", {
  configurable: true,
  value: localStorageStub,
});
globalThis.window.localStorage = localStorageStub;

const loadModule = jiti(import.meta.url, {
  alias: {
    "@": path.resolve(process.cwd(), "src"),
  },
  interopDefault: true,
});
const {
  CommandRegistry,
  registerDefaultCommands,
} = loadModule("../../src/utils/xyzwWebSocket.js");

test("registerDefaultCommands includes arena_getbattlerecord", () => {
  const registry = registerDefaultCommands(
    new CommandRegistry(
      {
        bon: {
          encode: (payload) => payload,
        },
      },
      null,
    ),
  );

  const packet = registry.build("arena_getbattlerecord", 1, 2, { page: 3 });

  assert.equal(packet.cmd, "arena_getbattlerecord");
  assert.equal(packet.ack, 1);
  assert.equal(packet.seq, 2);
  assert.deepEqual(packet.body, { page: 3 });
});
