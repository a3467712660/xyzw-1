const TOKEN_VIEW_MODE_KEY = "tokenViewMode";
const TOKEN_SORT_CONFIG_KEY = "tokenSortConfig";

const DEFAULT_SORT_CONFIG = {
  field: "createdAt",
  direction: "asc",
};

const getStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
};

export const getTokenViewMode = () => {
  const storage = getStorage();
  return storage?.getItem(TOKEN_VIEW_MODE_KEY) || "list";
};

export const setTokenViewMode = (viewMode) => {
  const storage = getStorage();
  storage?.setItem(TOKEN_VIEW_MODE_KEY, String(viewMode || "list"));
};

export const getTokenSortConfig = () => {
  const storage = getStorage();
  const rawValue = storage?.getItem(TOKEN_SORT_CONFIG_KEY);
  if (!rawValue) {
    return { ...DEFAULT_SORT_CONFIG };
  }

  try {
    const parsed = JSON.parse(rawValue);
    return {
      field: parsed?.field || DEFAULT_SORT_CONFIG.field,
      direction: parsed?.direction === "desc" ? "desc" : "asc",
    };
  } catch {
    return { ...DEFAULT_SORT_CONFIG };
  }
};

export const setTokenSortConfig = (sortConfig) => {
  const storage = getStorage();
  storage?.setItem(
    TOKEN_SORT_CONFIG_KEY,
    JSON.stringify({
      field: sortConfig?.field || DEFAULT_SORT_CONFIG.field,
      direction: sortConfig?.direction === "desc" ? "desc" : "asc",
    }),
  );
};

export const getBooleanPreference = (key, defaultValue = false) => {
  const storage = getStorage();
  const value = storage?.getItem(String(key || ""));
  if (value == null) {
    return defaultValue;
  }
  return value === "true";
};

export const setBooleanPreference = (key, value) => {
  const storage = getStorage();
  storage?.setItem(String(key || ""), value ? "true" : "false");
};
