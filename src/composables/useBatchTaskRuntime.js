import { createBatchTaskDeps } from "./createBatchTaskDeps.js";
import { BATCH_TASK_MODULE_GROUPS } from "./batchTaskModuleRegistry.js";
import { useBatchExecutionRunner } from "./useBatchExecutionRunner.js";
import { useBatchTaskHandlers } from "./useBatchTaskHandlers.js";
import { useBatchTaskModules } from "./useBatchTaskModules.js";
import { useQuickTaskExecutor } from "./useQuickTaskExecutor.js";
import { useScheduledTaskExecutor } from "./useScheduledTaskExecutor.js";

function resolveRuntimeDependencies(overrides = {}) {
  return {
    createBatchTaskDeps:
      overrides.createBatchTaskDeps || createBatchTaskDeps,
    useBatchExecutionRunner:
      overrides.useBatchExecutionRunner || useBatchExecutionRunner,
    useBatchTaskHandlers:
      overrides.useBatchTaskHandlers || useBatchTaskHandlers,
    useBatchTaskModules:
      overrides.useBatchTaskModules || useBatchTaskModules,
    useQuickTaskExecutor:
      overrides.useQuickTaskExecutor || useQuickTaskExecutor,
    useScheduledTaskExecutor:
      overrides.useScheduledTaskExecutor || useScheduledTaskExecutor,
  };
}

export function useBatchTaskRuntime({
  DailyTaskRunner,
  addLog,
  autoScrollLog,
  availableTasks,
  batchSettings,
  calculateMonthProgress,
  canClaim,
  connectionQueue,
  currentRunningTokenId,
  currentSettings,
  ensureConnection,
  getTodayStartSec,
  giftQuantity,
  gradeLabel,
  helperSettings,
  isCarActivityOpen,
  isRunning,
  isTodayAvailable,
  isWeirdTowerActivityOpen,
  isarenaActivityOpen,
  isbaokuActivityOpen,
  ismengjingActivityOpen,
  loadSettings,
  logContainer,
  logs,
  message,
  nextTick,
  normalizeCars,
  pickArenaTargetId,
  recipientIdInput,
  recipientInfo,
  releaseConnectionSlot,
  securityPassword,
  selectedTokens,
  shouldSendCar,
  shouldStop,
  tokenStatus,
  tokenStore,
  tokens,
}, overrides = {}) {
  const runtimeDeps = resolveRuntimeDependencies(overrides);
  const taskHandlers = {};
  const taskModuleHandlerNames = [
    ...new Set(
      BATCH_TASK_MODULE_GROUPS.flatMap((group) => group.handlerNames || []),
    ),
  ];

  const { executeScheduledTask } = runtimeDeps.useScheduledTaskExecutor({
    addLog,
    availableTasks,
    isCarActivityOpen,
    isWeirdTowerActivityOpen,
    isarenaActivityOpen,
    isbaokuActivityOpen,
    ismengjingActivityOpen,
    selectedTokens,
    shouldStop,
    taskHandlers,
    tokenStore,
    tokens,
  });

  const taskDeps = runtimeDeps.createBatchTaskDeps({
    addLog,
    autoScrollLog,
    batchSettings,
    calculateMonthProgress,
    canClaim,
    connectionQueue,
    currentRunningTokenId,
    currentSettings,
    ensureConnection,
    getTodayStartSec,
    giftQuantity,
    gradeLabel,
    helperSettings,
    isRunning,
    isTodayAvailable,
    loadSettings,
    logContainer,
    logs,
    message,
    nextTick,
    normalizeCars,
    pickArenaTargetId,
    recipientIdInput,
    recipientInfo,
    releaseConnectionSlot,
    securityPassword,
    selectedTokens,
    shouldSendCar,
    shouldStop,
    tokenStatus,
    tokenStore,
    tokens,
  });

  const taskModules = runtimeDeps.useBatchTaskModules(taskDeps);
  const resolvedTaskModuleHandlers = taskModuleHandlerNames.reduce((acc, handlerName) => {
    acc[handlerName] = taskModules[handlerName];
    return acc;
  }, {});

  const { startBatch, stopBatch } = runtimeDeps.useBatchExecutionRunner({
    DailyTaskRunner,
    addLog,
    batchSettings,
    connectionQueue,
    currentRunningTokenId,
    ensureConnection,
    isRunning,
    message,
    releaseConnectionSlot,
    selectedTokens,
    shouldStop,
    tokenStatus,
    tokenStore,
    tokens,
  });

  Object.assign(
    taskHandlers,
    runtimeDeps.useBatchTaskHandlers({
      startBatch,
      ...resolvedTaskModuleHandlers,
    }).taskHandlers,
  );

  const quickTaskExecutor = runtimeDeps.useQuickTaskExecutor({
    batchArenaStandalone: taskModules.batchArenaStandalone,
    batchSettings,
    batcharenafight: taskModules.batcharenafight,
    legion_storebuygoods: taskModules.legion_storebuygoods,
    selectedTokens,
    startBatch,
    taskHandlers,
    tokens,
  });

  return {
    ...taskModules,
    ...quickTaskExecutor,
    executeScheduledTask,
    startBatch,
    stopBatch,
    taskHandlers,
  };
}
