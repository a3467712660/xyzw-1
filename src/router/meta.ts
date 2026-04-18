export const APP_TITLE = "XYZW 游戏管理系统";

export interface RouteMetaConfig {
  requiresAuth?: boolean;
  requiresAdmin?: boolean;
  requiresGameAccess?: boolean;
  title?: string;
  layout?: string;
  hidden?: boolean;
}

const defaultRouteMeta: Required<RouteMetaConfig> = Object.freeze({
  requiresAuth: false,
  requiresAdmin: false,
  requiresGameAccess: false,
  title: "",
  layout: "default",
  hidden: false,
});

export const withRouteMeta = (meta: RouteMetaConfig = {}) => ({
  ...defaultRouteMeta,
  ...meta,
});

export const mergeMatchedMeta = (matched: Array<{ meta?: RouteMetaConfig }> = []) =>
  matched.reduce<Required<RouteMetaConfig>>(
    (acc, record) => ({ ...acc, ...(record.meta || {}) }),
    { ...defaultRouteMeta },
  );
