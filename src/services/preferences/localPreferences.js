const getStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
};

export const getStringPreference = (key, defaultValue = "") => {
  const storage = getStorage();
  const value = storage?.getItem(String(key || ""));
  return value == null ? defaultValue : value;
};

export const setStringPreference = (key, value) => {
  const storage = getStorage();
  storage?.setItem(String(key || ""), String(value ?? ""));
};

export const getJsonPreference = (key, defaultValue = null) => {
  const storage = getStorage();
  const rawValue = storage?.getItem(String(key || ""));
  if (!rawValue) {
    return defaultValue;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return defaultValue;
  }
};

export const setJsonPreference = (key, value) => {
  const storage = getStorage();
  storage?.setItem(String(key || ""), JSON.stringify(value ?? null));
};
