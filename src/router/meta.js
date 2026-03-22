export const APP_TITLE = "XYZW 游戏管理系统";

const defaultRouteMeta = Object.freeze({
  requiresAuth: false,
  requiresAdmin: false,
  requiresGameAccess: false,
  title: "",
  layout: "default",
  hidden: false,
});

export const withRouteMeta = (meta = {}) => ({
  ...defaultRouteMeta,
  ...meta,
});

export const mergeMatchedMeta = (matched = []) =>
  matched.reduce((acc, record) => ({ ...acc, ...(record.meta || {}) }), {
    ...defaultRouteMeta,
  });
