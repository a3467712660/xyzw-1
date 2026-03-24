import { useAuthStore } from "@/stores/auth";
import { useTokenStore } from "@/stores/tokenStore";
import { isNowInLegionWarTime } from "@/utils/clubBattleUtils";
import {
  canAccessAdminCenter,
  getDefaultAuthenticatedPath,
  hasGameFeatureAccess,
} from "@/utils/accessScope";
import { APP_TITLE, mergeMatchedMeta } from "./meta";

let guardsInstalled = false;

export const setupRouterGuards = (router) => {
  if (guardsInstalled)
    return;

  router.beforeEach(async (to) => {
    const authStore = useAuthStore();
    const tokenStore = useTokenStore();
    await authStore.initializeAuth();

    const mergedMeta = mergeMatchedMeta(to.matched);
    document.title = mergedMeta.title
      ? `${mergedMeta.title} - ${APP_TITLE}`
      : APP_TITLE;

    if (to.name === "LegionWar" && !isNowInLegionWarTime()) {
      return getDefaultAuthenticatedPath(authStore.user);
    }

    if (mergedMeta.requiresAuth && !authStore.isAuthenticated) {
      return {
        path: "/login",
        query: { redirect: to.fullPath },
      };
    }

    if (mergedMeta.requiresAdmin && !canAccessAdminCenter(authStore.user)) {
      return authStore.user?.isAdmin
        ? { path: "/admin/profile", query: { adminMfaRequired: "1" } }
        : getDefaultAuthenticatedPath(authStore.user);
    }

    if (mergedMeta.requiresGameAccess && !hasGameFeatureAccess(authStore.user)) {
      return "/admin/task-control";
    }

    if (
      authStore.isAuthenticated
      && (to.name === "GameFeatures" || to.name === "TaskControl")
      && !tokenStore.hasUsableWorkbenchToken
    ) {
      return "/tokens";
    }

    if (
      authStore.isAuthenticated
      && (to.path === "/login" || to.path === "/register" || to.path === "/forgot-password")
    ) {
      return getDefaultAuthenticatedPath(authStore.user);
    }

    if (to.path === "/" && authStore.isAuthenticated) {
      return getDefaultAuthenticatedPath(authStore.user);
    }

    return true;
  });

  guardsInstalled = true;
};
