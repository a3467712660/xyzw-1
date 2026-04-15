import {
  isHostAllowed,
  LOOPBACK_HOST_ALLOWLIST,
} from "../../utils/hostAllowlist.js";

export const XYZW_RUNTIME_VARIANTS = Object.freeze({
  DEFAULT: "default",
  REPLAY_BROWSER: "replay-browser",
});

export const XYZW_RUNTIME_SCRIPT_URLS = Object.freeze({
  [XYZW_RUNTIME_VARIANTS.DEFAULT]: [
    "/xyzw/cocos2d-js-min.js",
    "/xyzw/game-defines.js",
    "/xyzw/index.js",
  ],
  [XYZW_RUNTIME_VARIANTS.REPLAY_BROWSER]: [
    "/xyzw/cocos2d-js-min.js",
    "/xyzw/game-defines.browser.js",
    "/xyzw/index.js",
  ],
});

const XYZW_RUNTIME_SCRIPT_ATTR = "data-xyzw-runtime";
const XYZW_RUNTIME_VARIANT_ATTR = "data-xyzw-runtime-variant";
const xyzwRuntimeLoadPromises = new Map();
const BUILTIN_RUNTIME_ALLOWED_HOSTS = Object.freeze([
  "xyzw.xq5007.fun",
]);
const DEFAULT_RUNTIME_ALLOWED_HOSTS = Object.freeze([
  ...LOOPBACK_HOST_ALLOWLIST,
  ...BUILTIN_RUNTIME_ALLOWED_HOSTS,
]);

const getBrowserWindow = () => {
  if (typeof window === "undefined") {
    throw new TypeError("XYZW runtime can only be loaded in the browser.");
  }

  return window;
};

export const ensureRuntimeHostAllowed = (
  host = getBrowserWindow().location?.hostname,
  allowedHosts = import.meta?.env?.VITE_XYZW_RUNTIME_ALLOWED_HOSTS,
  fallbackHosts = DEFAULT_RUNTIME_ALLOWED_HOSTS,
) => {
  const normalizedHost = String(host || "").trim().toLowerCase();
  if (!normalizedHost) {
    throw new Error("XYZW runtime host is missing.");
  }

  if (isHostAllowed(normalizedHost, allowedHosts, fallbackHosts)) {
    return normalizedHost;
  }

  throw new Error(`Current host is not allowed for XYZW runtime: ${normalizedHost}`);
};

export const getRuntimeVariantScriptUrls = (
  variant = XYZW_RUNTIME_VARIANTS.DEFAULT,
) => {
  const urls = XYZW_RUNTIME_SCRIPT_URLS[variant];
  if (!urls) {
    throw new Error(`Unsupported XYZW runtime variant: ${variant}`);
  }
  return urls;
};

export const getRuntimeVariantDefinesUrl = (
  variant = XYZW_RUNTIME_VARIANTS.DEFAULT,
) => getRuntimeVariantScriptUrls(variant)[1];

export const getRuntimeExpectedPlatform = (
  variant = XYZW_RUNTIME_VARIANTS.DEFAULT,
) =>
  variant === XYZW_RUNTIME_VARIANTS.REPLAY_BROWSER ? "web" : null;

export const loadRuntimeScript = (
  src,
  targetDocument = getBrowserWindow().document,
  { variant = XYZW_RUNTIME_VARIANTS.DEFAULT } = {},
) =>
  new Promise((resolve, reject) => {
    const existing = targetDocument.querySelector(
      `script[${XYZW_RUNTIME_SCRIPT_ATTR}="${src}"][${XYZW_RUNTIME_VARIANT_ATTR}="${variant}"]`,
    );
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }

      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error(`Failed to load runtime script: ${src}`)),
        { once: true },
      );
      return;
    }

    const script = targetDocument.createElement("script");
    script.defer = true;
    script.src = src;
    script.setAttribute(XYZW_RUNTIME_SCRIPT_ATTR, src);
    script.setAttribute(XYZW_RUNTIME_VARIANT_ATTR, variant);
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true },
    );
    script.addEventListener(
      "error",
      () => reject(new Error(`Failed to load runtime script: ${src}`)),
      { once: true },
    );
    targetDocument.head.appendChild(script);
  });

export const ensureXyzwRuntimeLoaded = async ({
  variant = XYZW_RUNTIME_VARIANTS.DEFAULT,
  runtimeWindow = getBrowserWindow(),
  targetDocument = runtimeWindow.document,
} = {}) => {
  ensureRuntimeHostAllowed(runtimeWindow.location?.hostname);
  const expectedPlatform = getRuntimeExpectedPlatform(variant);
  const currentPlatform = String(runtimeWindow.PLATFORM || "").trim();
  const hasRuntimeRequire = typeof runtimeWindow.__require === "function";

  if (hasRuntimeRequire && (!expectedPlatform || currentPlatform === expectedPlatform)) {
    return runtimeWindow.__require;
  }

  if (!xyzwRuntimeLoadPromises.has(variant)) {
    xyzwRuntimeLoadPromises.set(
      variant,
      (async () => {
        const urlsToLoad = hasRuntimeRequire
          ? [getRuntimeVariantDefinesUrl(variant)]
          : getRuntimeVariantScriptUrls(variant);

        for (const scriptUrl of urlsToLoad) {
          await loadRuntimeScript(scriptUrl, targetDocument, { variant });
        }

        if (typeof runtimeWindow.__require !== "function") {
          throw new TypeError("XYZW runtime require is unavailable after script load.");
        }

        return runtimeWindow.__require;
      })().catch((error) => {
        xyzwRuntimeLoadPromises.delete(variant);
        throw error;
      }),
    );
  }

  return xyzwRuntimeLoadPromises.get(variant);
};

export const __resetXyzwRuntimeLoaderForTests = () => {
  xyzwRuntimeLoadPromises.clear();
};
