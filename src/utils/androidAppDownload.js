const ABSOLUTE_HTTP_URL_RE = /^https?:\/\//i;
const RELATIVE_DOWNLOAD_URL_RE = /^(\/|\.\/|\.\.\/)/;

export function getAndroidAppDownloadConfig(env = {}) {
  const rawUrl = typeof env?.VITE_ANDROID_APP_DOWNLOAD_URL === "string"
    ? env.VITE_ANDROID_APP_DOWNLOAD_URL.trim()
    : "";
  const isConfigured
    = ABSOLUTE_HTTP_URL_RE.test(rawUrl) || RELATIVE_DOWNLOAD_URL_RE.test(rawUrl);

  return {
    isConfigured,
    downloadUrl: isConfigured ? rawUrl : "",
    isExternal: ABSOLUTE_HTTP_URL_RE.test(rawUrl),
  };
}
