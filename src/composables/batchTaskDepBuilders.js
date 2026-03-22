function createDelayConfig(batchSettings) {
  return {
    command: batchSettings.commandDelay,
    task: batchSettings.taskDelay,
    action: batchSettings.actionDelay,
    battle: batchSettings.battleDelay,
    refresh: batchSettings.refreshDelay,
    long: batchSettings.longDelay,
  };
}

export function createSharedBatchTaskDeps(params) {
  const {
    addLog,
    autoScrollLog,
    batchSettings,
    connectionQueue,
    currentRunningTokenId,
    ensureConnection,
    isRunning,
    logContainer,
    logs,
    message,
    nextTick,
    releaseConnectionSlot,
    selectedTokens,
    shouldStop,
    tokenStatus,
    tokenStore,
    tokens,
  } = params;

  return {
    addLog,
    autoScrollLog,
    batchSettings,
    connectionQueue,
    currentRunningTokenId,
    delayConfig: createDelayConfig(batchSettings),
    ensureConnection,
    isRunning,
    logContainer,
    logs,
    message,
    nextTick,
    releaseConnectionSlot,
    selectedTokens,
    shouldStop,
    tokenStatus,
    tokenStore,
    tokens,
  };
}

export function createDailyBatchTaskDeps(sharedDeps, params) {
  const { helperSettings } = params;

  return {
    ...sharedDeps,
    helperSettings,
  };
}

export function createCombatBatchTaskDeps(sharedDeps, params) {
  const {
    calculateMonthProgress,
    currentSettings,
    getTodayStartSec,
    isTodayAvailable,
    loadSettings,
    pickArenaTargetId,
  } = params;

  return {
    ...sharedDeps,
    calculateMonthProgress,
    currentSettings,
    getTodayStartSec,
    isTodayAvailable,
    loadSettings,
    pickArenaTargetId,
  };
}

export function createResourceBatchTaskDeps(sharedDeps, params) {
  const {
    canClaim,
    giftQuantity,
    gradeLabel,
    helperSettings,
    normalizeCars,
    recipientIdInput,
    recipientInfo,
    securityPassword,
    shouldSendCar,
  } = params;

  return {
    ...sharedDeps,
    canClaim,
    giftQuantity,
    gradeLabel,
    helperSettings,
    normalizeCars,
    recipientIdInput,
    recipientInfo,
    securityPassword,
    shouldSendCar,
  };
}
