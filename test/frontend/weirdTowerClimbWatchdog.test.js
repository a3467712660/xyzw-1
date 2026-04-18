import assert from "node:assert/strict";
import test from "node:test";

import { createWeirdTowerClimbWatchdog } from "../../src/utils/weirdTowerClimbWatchdog.js";

test("weird tower climb watchdog refresh clears the previous timeout and rearms progress timeout", () => {
  const scheduled = [];
  let timeoutTriggered = 0;

  const watchdog = createWeirdTowerClimbWatchdog({
    timeoutMs: 60000,
    onTimeout: () => {
      timeoutTriggered++;
    },
    setTimeoutFn: (callback, delayMs) => {
      const handle = {
        callback,
        cleared: false,
        delayMs,
      };
      scheduled.push(handle);
      return handle;
    },
    clearTimeoutFn: (handle) => {
      handle.cleared = true;
    },
  });

  watchdog.refresh();
  watchdog.refresh();

  assert.equal(scheduled.length, 2);
  assert.equal(scheduled[0].cleared, true);
  assert.equal(scheduled[1].cleared, false);
  assert.equal(scheduled[1].delayMs, 60000);

  scheduled[1].callback();
  assert.equal(timeoutTriggered, 1);
});

test("weird tower climb watchdog clear cancels the active timeout", () => {
  const scheduled = [];
  const watchdog = createWeirdTowerClimbWatchdog({
    onTimeout: () => {},
    setTimeoutFn: (callback, delayMs) => {
      const handle = {
        callback,
        cleared: false,
        delayMs,
      };
      scheduled.push(handle);
      return handle;
    },
    clearTimeoutFn: (handle) => {
      handle.cleared = true;
    },
  });

  watchdog.refresh();
  watchdog.clear();

  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].cleared, true);
});
