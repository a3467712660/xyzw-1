const MAX_LOOKAHEAD_MINUTES = 60 * 24 * 366;

export function useTaskControlNextRun({
  locale,
  matchesCronExpression,
  t,
  tableRefreshKey,
  validateCronExpression,
}) {
  const nextRunCache = new Map();
  let nextRunRefreshTimer = null;

  const minuteKey = (date = new Date()) =>
    `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;

  const getHourlyIntervalFromCron = (expr = "") => {
    const parts = String(expr || "").trim().split(/\s+/);
    if (parts.length !== 5)
      return null;
    const [m, h, d, mo, w] = parts;
    if (m !== "0" || d !== "*" || mo !== "*" || w !== "*")
      return null;
    if (!h.startsWith("*/"))
      return null;
    const interval = Number(h.slice(2));
    if (!Number.isInteger(interval) || interval < 1 || interval > 23)
      return null;
    return interval;
  };

  const refreshNextRunNow = (nextRunNow) => {
    nextRunNow.value = Date.now();
    nextRunCache.clear();
    tableRefreshKey.value += 1;
  };

  const formatNextRunDate = (date) =>
    date.toLocaleString(locale.value, {
      hour12: false,
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const findNextRunDate = (cronExpr, nowTs) => {
    const valid = validateCronExpression(cronExpr);
    if (!valid.valid)
      return null;
    const baseDate = new Date(nowTs);
    baseDate.setSeconds(0, 0);
    const nowMinute = minuteKey(baseDate);
    const cacheKey = `${cronExpr}|${nowMinute}`;
    if (nextRunCache.has(cacheKey))
      return nextRunCache.get(cacheKey);

    const probe = new Date(baseDate.getTime() + 60 * 1000);
    for (let i = 0; i < MAX_LOOKAHEAD_MINUTES; i += 1) {
      if (matchesCronExpression(cronExpr, probe)) {
        nextRunCache.set(cacheKey, new Date(probe));
        return new Date(probe);
      }
      probe.setMinutes(probe.getMinutes() + 1);
    }
    nextRunCache.set(cacheKey, null);
    return null;
  };

  const resolveIntervalNextRunDate = (row, nowTs) => {
    const intervalHours = getHourlyIntervalFromCron(row?.cronExpr);
    if (!intervalHours)
      return null;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const lastRunTs = Number(new Date(row?.lastRunAt || "").getTime());
    if (!Number.isFinite(lastRunTs) || lastRunTs <= 0)
      return null;
    let nextTs = lastRunTs + intervalMs;
    while (nextTs <= nowTs) {
      nextTs += intervalMs;
    }
    return new Date(nextTs);
  };

  const isIntervalDueNow = (row, nowTs) => {
    const intervalHours = getHourlyIntervalFromCron(row?.cronExpr);
    if (!intervalHours)
      return false;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const lastRunTs = Number(new Date(row?.lastRunAt || "").getTime());
    if (!Number.isFinite(lastRunTs) || lastRunTs <= 0)
      return false;
    return lastRunTs + intervalMs <= nowTs;
  };

  const getNextRunText = (row, nextRunNow) => {
    const nowTs = typeof nextRunNow === "number"
      ? nextRunNow
      : Number(nextRunNow?.value ?? nextRunNow ?? Date.now());
    if (!row?.enabled)
      return t("taskControl.messages.closed");
    const intervalNextDate = resolveIntervalNextRunDate(row, nowTs);
    if (intervalNextDate)
      return formatNextRunDate(intervalNextDate);
    const nextDate = findNextRunDate(row.cronExpr, nowTs);
    if (!nextDate)
      return t("taskControl.messages.unmatched");
    return formatNextRunDate(nextDate);
  };

  const startNextRunTicker = (nextRunNow) => {
    if (nextRunRefreshTimer)
      window.clearInterval(nextRunRefreshTimer);
    nextRunRefreshTimer = window.setInterval(() => {
      refreshNextRunNow(nextRunNow);
    }, 30000);
  };

  const stopNextRunTicker = () => {
    if (!nextRunRefreshTimer)
      return;
    window.clearInterval(nextRunRefreshTimer);
    nextRunRefreshTimer = null;
  };

  return {
    findNextRunDate,
    getHourlyIntervalFromCron,
    getNextRunText,
    isIntervalDueNow,
    minuteKey,
    refreshNextRunNow,
    resolveIntervalNextRunDate,
    startNextRunTicker,
    stopNextRunTicker,
  };
}
