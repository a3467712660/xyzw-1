import { createBatchTaskModulesFromRegistry } from "./batchTaskModuleRegistry.js";

export function useBatchTaskModules(deps) {
  return createBatchTaskModulesFromRegistry(deps);
}
