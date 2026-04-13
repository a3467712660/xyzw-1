type RuntimeCleanup = (() => void | Promise<void>) | null | undefined;

const toUserKey = (userId: string | null | undefined) => String(userId || "").trim();

const runCleanups = async (cleanups: RuntimeCleanup[]) => {
  const queued = [...cleanups].reverse();
  for (const cleanup of queued) {
    if (typeof cleanup !== "function") {
      continue;
    }
    await cleanup();
  }
};

export const createTokenStoreRuntimeCoordinator = () => {
  let initPromise: Promise<void> | null = null;
  let isInitialized = false;
  let initializedUserId = "";
  let cleanupFns: RuntimeCleanup[] = [];

  const registerCleanup = (cleanup: RuntimeCleanup) => {
    if (typeof cleanup !== "function") {
      return cleanup;
    }
    cleanupFns.push(cleanup);
    return cleanup;
  };

  const setCleanupFns = (cleanups: RuntimeCleanup[]) => {
    cleanupFns = cleanups.filter((cleanup) => typeof cleanup === "function");
  };

  const clearState = () => {
    isInitialized = false;
    initializedUserId = "";
    cleanupFns = [];
  };

  const dispose = async () => {
    const queued = cleanupFns;
    clearState();
    await runCleanups(queued);
  };

  const initialize = async ({
    userId,
    setup,
  }: {
    userId?: string | null;
    setup: (helpers: {
      registerCleanup: (cleanup: RuntimeCleanup) => RuntimeCleanup;
    }) => void | Promise<void>;
  }) => {
    const normalizedUserId = toUserKey(userId);

    if (initPromise) {
      await initPromise;
    }

    if (isInitialized && initializedUserId === normalizedUserId) {
      return;
    }

    initPromise = (async () => {
      if (isInitialized && initializedUserId !== normalizedUserId) {
        await dispose();
      }

      const localCleanupFns: RuntimeCleanup[] = [];
      const registerLocalCleanup = (cleanup: RuntimeCleanup) => {
        if (typeof cleanup !== "function") {
          return cleanup;
        }
        localCleanupFns.push(cleanup);
        return cleanup;
      };

      try {
        await setup({
          registerCleanup: registerLocalCleanup,
        });
        setCleanupFns(localCleanupFns);
        isInitialized = true;
        initializedUserId = normalizedUserId;
      } catch (error) {
        await runCleanups(localCleanupFns);
        clearState();
        throw error;
      }
    })();

    try {
      await initPromise;
    } finally {
      initPromise = null;
    }
  };

  return {
    initialize,
    dispose,
    isInitialized: () => isInitialized,
    getInitializedUserId: () => initializedUserId,
    hasPendingInit: () => Boolean(initPromise),
    registerCleanup,
  };
};
