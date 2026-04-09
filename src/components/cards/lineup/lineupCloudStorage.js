export const STORAGE_KEY = "saved_lineups";
export const APPLY_METRICS_STORAGE_KEY_PREFIX = "saved_lineup_apply_metrics_v1";
export const LINEUP_CLOUD_PREF_PREFIX = "lineup.saved";

export const buildLineupStorageKey = (tokenId = "") =>
  tokenId ? `${STORAGE_KEY}_${tokenId}` : "";

export const buildLineupCloudPrefKey = (tokenId = "") =>
  tokenId ? `${LINEUP_CLOUD_PREF_PREFIX}:${tokenId}` : "";

export const buildApplyMetricsStorageKey = (tokenId = "") =>
  tokenId ? `${APPLY_METRICS_STORAGE_KEY_PREFIX}_${tokenId}` : "";

export const normalizeApplyDurationMetrics = (rawValue) => {
  if (!rawValue || typeof rawValue !== "object") {
    return {};
  }

  const normalized = {};
  for (const [lineupId, durations] of Object.entries(rawValue)) {
    const key = String(lineupId || "").trim();
    if (!key || !Array.isArray(durations)) continue;
    const cleaned = durations
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0)
      .slice(-10);
    if (cleaned.length > 0) {
      normalized[key] = cleaned;
    }
  }

  return normalized;
};

export const readApplyDurationMetrics = (tokenId = "") => {
  const storageKey = buildApplyMetricsStorageKey(tokenId);
  if (!storageKey) return {};

  try {
    const rawValue = localStorage.getItem(storageKey);
    if (!rawValue) return {};
    return normalizeApplyDurationMetrics(JSON.parse(rawValue));
  } catch (error) {
    console.warn("读取阵容应用耗时历史失败，已回退为空:", error?.message || error);
    return {};
  }
};

export const writeApplyDurationMetrics = (tokenId, metrics) => {
  const storageKey = buildApplyMetricsStorageKey(tokenId);
  if (!storageKey) return;
  localStorage.setItem(
    storageKey,
    JSON.stringify(normalizeApplyDurationMetrics(metrics)),
  );
};

export const getAverageApplyDurationMs = (lineupId, tokenId = "") => {
  const key = String(lineupId || "").trim();
  if (!key) return 0;
  const metrics = readApplyDurationMetrics(tokenId);
  const durations = metrics[key] || [];
  if (!Array.isArray(durations) || durations.length === 0) return 0;
  const total = durations.reduce((sum, value) => sum + Number(value || 0), 0);
  return Math.round(total / durations.length);
};

export const recordApplyDurationMetric = (lineupId, durationMs, tokenId = "") => {
  const key = String(lineupId || "").trim();
  const duration = Number(durationMs);
  if (!key || !Number.isFinite(duration) || duration <= 0 || !tokenId) return;

  const metrics = readApplyDurationMetrics(tokenId);
  const nextDurations = [...(metrics[key] || []), duration].slice(-10);
  metrics[key] = nextDurations;
  writeApplyDurationMetrics(tokenId, metrics);
};
