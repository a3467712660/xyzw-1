import { ref } from "vue";
import { APP_THEME_STORAGE_KEY } from "@/constants/ui";

const THEME_MODES = new Set(["light", "dark", "auto"]);
const isDark = ref(false);
const themeMode = ref("auto");
let mediaQueryList = null;
let mediaQueryHandler = null;

const normalizeThemeMode = (value) => {
  const text = String(value || "").trim();
  return THEME_MODES.has(text) ? text : "auto";
};

const canUseDom = () => typeof window !== "undefined" && typeof document !== "undefined";

const resolveSystemDark = () => {
  if (!canUseDom() || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
};

const getResolvedDark = () => {
  if (themeMode.value === "dark") {
    return true;
  }
  if (themeMode.value === "light") {
    return false;
  }
  return resolveSystemDark();
};

const syncDomTheme = () => {
  if (!canUseDom()) {
    return;
  }

  const nextIsDark = getResolvedDark();
  isDark.value = nextIsDark;

  const html = document.documentElement;
  const body = document.body;

  if (nextIsDark) {
    html.classList.add("dark");
    html.setAttribute("data-theme", "dark");
    if (body) {
      body.classList.add("dark");
      body.setAttribute("data-theme", "dark");
    }
  } else {
    html.classList.remove("dark");
    html.removeAttribute("data-theme");
    if (body) {
      body.classList.remove("dark");
      body.removeAttribute("data-theme");
    }
  }

  window.dispatchEvent(
    new CustomEvent("theme-change", {
      detail: {
        isDark: nextIsDark,
        mode: themeMode.value,
      },
    }),
  );
};

const readStoredThemeMode = () => {
  if (!canUseDom()) {
    return "auto";
  }
  return normalizeThemeMode(localStorage.getItem(APP_THEME_STORAGE_KEY));
};

const persistThemeMode = () => {
  if (!canUseDom()) {
    return;
  }
  localStorage.setItem(APP_THEME_STORAGE_KEY, themeMode.value);
};

const applyThemeMode = (mode, options = {}) => {
  const { persist = true } = options;
  themeMode.value = normalizeThemeMode(mode);
  if (persist) {
    persistThemeMode();
  }
  syncDomTheme();
};

const initTheme = () => {
  themeMode.value = readStoredThemeMode();
  syncDomTheme();
};

const initializeThemeState = () => {
  initTheme();
};

const updateReactiveState = () => {
  if (!canUseDom()) {
    isDark.value = false;
    return;
  }
  const currentIsDark =
    document.documentElement.classList.contains("dark")
    || document.documentElement.getAttribute("data-theme") === "dark";
  isDark.value = currentIsDark;
};

const setThemeMode = (mode) => applyThemeMode(mode);
const setDarkTheme = () => applyThemeMode("dark");
const setLightTheme = () => applyThemeMode("light");
const setAutoTheme = () => applyThemeMode("auto");

const toggleTheme = () => {
  applyThemeMode(isDark.value ? "light" : "dark");
};

const setupSystemThemeListener = () => {
  if (!canUseDom() || typeof window.matchMedia !== "function") {
    return;
  }

  if (!mediaQueryList) {
    mediaQueryList = window.matchMedia("(prefers-color-scheme: dark)");
  }

  if (mediaQueryHandler) {
    return;
  }

  mediaQueryHandler = () => {
    if (themeMode.value === "auto") {
      syncDomTheme();
    }
  };

  if (typeof mediaQueryList.addEventListener === "function") {
    mediaQueryList.addEventListener("change", mediaQueryHandler);
  } else if (typeof mediaQueryList.addListener === "function") {
    mediaQueryList.addListener(mediaQueryHandler);
  }
};

const cleanupSystemThemeListener = () => {
  if (!mediaQueryList || !mediaQueryHandler) {
    return;
  }

  if (typeof mediaQueryList.removeEventListener === "function") {
    mediaQueryList.removeEventListener("change", mediaQueryHandler);
  } else if (typeof mediaQueryList.removeListener === "function") {
    mediaQueryList.removeListener(mediaQueryHandler);
  }

  mediaQueryHandler = null;
};

const getCurrentTheme = () => (isDark.value ? "dark" : "light");
const getThemeMode = () => themeMode.value;

export function useTheme() {
  return {
    isDark,
    themeMode,
    initTheme,
    initializeThemeState,
    updateReactiveState,
    setThemeMode,
    setDarkTheme,
    setLightTheme,
    setAutoTheme,
    toggleTheme,
    setupSystemThemeListener,
    cleanupSystemThemeListener,
    getCurrentTheme,
    getThemeMode,
  };
}
