export const ACCESS_SCOPE_FULL = "full";
export const ACCESS_SCOPE_TASK_CONTROL_ONLY = "task_control_only";

export const normalizeAccessScope = (value) =>
  String(value || "").trim() === ACCESS_SCOPE_TASK_CONTROL_ONLY
    ? ACCESS_SCOPE_TASK_CONTROL_ONLY
    : ACCESS_SCOPE_FULL;

export const hasGameFeatureAccess = (scope) =>
  normalizeAccessScope(scope) === ACCESS_SCOPE_FULL;
