import { isHostAllowed } from "@/utils/hostAllowlist";

export const XYZW_RUNTIME_SCRIPT_URLS = [
  "/xyzw/cocos2d-js-min.js",
  "/xyzw/game-defines.js",
  "/xyzw/index.js",
];

const XYZW_RUNTIME_SCRIPT_ATTR = "data-xyzw-runtime";
let xyzwRuntimeLoadPromise = null;

const getBrowserWindow = () => {
  if (typeof window === "undefined") {
    throw new TypeError("XYZW runtime can only be loaded in the browser.");
  }

  return window;
};

export const ensureRuntimeHostAllowed = (
  host = getBrowserWindow().location?.hostname,
  allowedHosts = import.meta.env.VITE_XYZW_RUNTIME_ALLOWED_HOSTS,
) => {
  const normalizedHost = String(host || "").trim().toLowerCase();
  if (!normalizedHost) {
    throw new Error("XYZW runtime host is missing.");
  }

  if (isHostAllowed(normalizedHost, allowedHosts)) {
    return normalizedHost;
  }

  throw new Error(`Current host is not allowed for XYZW runtime: ${normalizedHost}`);
};

export const loadRuntimeScript = (src, targetDocument = getBrowserWindow().document) =>
  new Promise((resolve, reject) => {
    const existing = targetDocument.querySelector(
      `script[${XYZW_RUNTIME_SCRIPT_ATTR}="${src}"]`,
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

export const ensureXyzwRuntimeLoaded = async () => {
  const runtimeWindow = getBrowserWindow();
  ensureRuntimeHostAllowed(runtimeWindow.location?.hostname);

  if (typeof runtimeWindow.__require === "function") {
    return runtimeWindow.__require;
  }

  if (!xyzwRuntimeLoadPromise) {
    xyzwRuntimeLoadPromise = (async () => {
      for (const scriptUrl of XYZW_RUNTIME_SCRIPT_URLS) {
        await loadRuntimeScript(scriptUrl, runtimeWindow.document);
      }
      return runtimeWindow.__require;
    })().catch((error) => {
      xyzwRuntimeLoadPromise = null;
      throw error;
    });
  }

  return xyzwRuntimeLoadPromise;
};
