const DEFAULT_WEIRD_TOWER_CLIMB_TIMEOUT_MS = 60000;

export const createWeirdTowerClimbWatchdog = ({
  timeoutMs = DEFAULT_WEIRD_TOWER_CLIMB_TIMEOUT_MS,
  onTimeout,
  setTimeoutFn = globalThis.setTimeout,
  clearTimeoutFn = globalThis.clearTimeout,
} = {}) => {
  let timeoutHandle = null;

  const clear = () => {
    if (timeoutHandle != null) {
      clearTimeoutFn(timeoutHandle);
      timeoutHandle = null;
    }
  };

  const refresh = () => {
    clear();
    timeoutHandle = setTimeoutFn(() => {
      timeoutHandle = null;
      onTimeout?.();
    }, timeoutMs);
    return timeoutHandle;
  };

  return {
    clear,
    refresh,
  };
};

export const WEIRD_TOWER_CLIMB_TIMEOUT_MS = DEFAULT_WEIRD_TOWER_CLIMB_TIMEOUT_MS;
