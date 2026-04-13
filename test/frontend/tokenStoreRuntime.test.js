/* eslint-disable test/no-import-node-test */
import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

const loadModule = jiti(import.meta.url, { interopDefault: true });
const { createTokenStoreRuntimeCoordinator } = loadModule(
  "../../src/services/token/tokenStoreRuntime.ts",
);

test("token store runtime keeps monitor and listener setup idempotent for the same user", async () => {
  const coordinator = createTokenStoreRuntimeCoordinator();
  const events = [];

  const setupFor = (userId) => ({ registerCleanup }) => {
    events.push(`setup:${userId}`);
    events.push(`monitor:start:${userId}`);
    registerCleanup(() => {
      events.push(`monitor:stop:${userId}`);
    });
    events.push(`listener:start:${userId}`);
    registerCleanup(() => {
      events.push(`listener:stop:${userId}`);
    });
  };

  await coordinator.initialize({
    userId: "user-a",
    setup: setupFor("user-a"),
  });
  await coordinator.initialize({
    userId: "user-a",
    setup: setupFor("user-a-duplicate"),
  });

  assert.equal(coordinator.isInitialized(), true);
  assert.equal(coordinator.getInitializedUserId(), "user-a");
  assert.deepEqual(events, [
    "setup:user-a",
    "monitor:start:user-a",
    "listener:start:user-a",
  ]);
});

test("token store runtime disposes old monitor and listener before reinitializing another user", async () => {
  const coordinator = createTokenStoreRuntimeCoordinator();
  const events = [];

  const setupFor = (userId) => ({ registerCleanup }) => {
    events.push(`setup:${userId}`);
    events.push(`monitor:start:${userId}`);
    registerCleanup(() => {
      events.push(`monitor:stop:${userId}`);
    });
    events.push(`listener:start:${userId}`);
    registerCleanup(() => {
      events.push(`listener:stop:${userId}`);
    });
  };

  await coordinator.initialize({
    userId: "user-a",
    setup: setupFor("user-a"),
  });
  await coordinator.initialize({
    userId: "user-b",
    setup: setupFor("user-b"),
  });

  assert.deepEqual(events, [
    "setup:user-a",
    "monitor:start:user-a",
    "listener:start:user-a",
    "listener:stop:user-a",
    "monitor:stop:user-a",
    "setup:user-b",
    "monitor:start:user-b",
    "listener:start:user-b",
  ]);
  assert.equal(coordinator.getInitializedUserId(), "user-b");
});

test("token store runtime rolls back partial setup failures and allows retry", async () => {
  const coordinator = createTokenStoreRuntimeCoordinator();
  const events = [];

  await assert.rejects(
    coordinator.initialize({
      userId: "user-a",
      setup: ({ registerCleanup }) => {
        events.push("setup:fail");
        registerCleanup(() => {
          events.push("listener:stop:fail");
        });
        throw new Error("setup failed");
      },
    }),
    /setup failed/,
  );

  assert.equal(coordinator.isInitialized(), false);

  await coordinator.initialize({
    userId: "user-a",
    setup: ({ registerCleanup }) => {
      events.push("setup:retry");
      registerCleanup(() => {
        events.push("listener:stop:retry");
      });
    },
  });

  assert.deepEqual(events, [
    "setup:fail",
    "listener:stop:fail",
    "setup:retry",
  ]);
  assert.equal(coordinator.isInitialized(), true);
});
