export const ACCESS_SCOPE_FULL = "full";
export const ACCESS_SCOPE_TASK_CONTROL_ONLY = "task_control_only";

export const normalizeAccessScope = (scope) =>
  String(scope || "").trim() === ACCESS_SCOPE_TASK_CONTROL_ONLY
    ? ACCESS_SCOPE_TASK_CONTROL_ONLY
    : ACCESS_SCOPE_FULL;

export const hasGameFeatureAccess = (user) =>
  normalizeAccessScope(user?.accessScope) === ACCESS_SCOPE_FULL;

export const getDefaultAuthenticatedPath = (user) =>
  hasGameFeatureAccess(user) ? "/admin/dashboard" : "/admin/task-control";
