import { sortArenaTargetsByWinRatePreference } from "../../../composables/useArenaPvpTargeting.js";
import {
  formatArenaRankLabel,
  formatArenaScoreDelta,
  getArenaAvatarFallbackText,
  getArenaScoreDeltaClass,
} from "./arenaPvpFormatters.js";

const normalizePreferredWinRate = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return null;
  }

  return Math.trunc(numeric);
};

const inferArenaRecordWinState = (record) => {
  if (typeof record?.isWin === "boolean") {
    return record.isWin;
  }

  const scoreDelta = Number(record?.scoreDelta);
  if (Number.isFinite(scoreDelta) && scoreDelta !== 0) {
    return scoreDelta > 0;
  }

  return null;
};

const appendArenaRecordStats = (map, key, isWin) => {
  const normalizedKey = String(key || "").trim();
  if (!normalizedKey) {
    return;
  }

  const previous = map.get(normalizedKey) || { losses: 0, total: 0, wins: 0 };
  map.set(normalizedKey, {
    losses: previous.losses + (isWin ? 0 : 1),
    total: previous.total + 1,
    wins: previous.wins + (isWin ? 1 : 0),
  });
};

const buildArenaRecordStatsLookups = (arenaRecords = []) => {
  const byName = new Map();
  const byRoleId = new Map();

  for (const record of arenaRecords || []) {
    const isWin = inferArenaRecordWinState(record);
    if (isWin === null) {
      continue;
    }

    appendArenaRecordStats(byRoleId, record?.roleId, isWin);
    appendArenaRecordStats(byName, record?.name, isWin);
  }

  return { byName, byRoleId };
};

const resolveArenaTargetStats = (target = {}, targetWinStats = {}, recordLookups = null) => {
  const roleIdKey = String(target?.roleId || target?.id || "").trim();
  const nameKey = String(target?.name || "").trim();
  const recordStats =
    recordLookups?.byRoleId?.get(roleIdKey)
    || recordLookups?.byName?.get(nameKey)
    || null;
  const stats = recordStats?.total > 0 ? recordStats : targetWinStats?.[roleIdKey];
  const total = Math.max(0, Number(stats?.total || 0));
  const wins = Math.max(0, Number(stats?.wins || 0));
  const losses = Math.max(0, Number(stats?.losses || total - wins));
  const known = total > 0;
  const rateValue = known ? (wins / total) * 100 : null;

  return {
    known,
    losses,
    rateText: known ? rateValue.toFixed(0) : "-",
    rateValue,
    total,
    wins,
  };
};

const normalizeRecentRunRecord = (record = {}) => ({
  ...record,
  avatarText: getArenaAvatarFallbackText(record?.name),
  scoreDeltaClass: getArenaScoreDeltaClass(record?.scoreDelta),
  scoreDeltaText: formatArenaScoreDelta(record?.scoreDelta, "-"),
});

export const buildArenaManualTargetOptions = (
  rankList = [],
  arenaRecords = [],
  {
    dashText = "-",
    formatRecordSourceOption = (name) => `${name} (record source)`,
  } = {},
) => {
  const rankTargets = (rankList || []).map((item) => ({
    label: `${item?.name || item?.roleId || dashText} (${item?.roleId || dashText})`,
    value: String(item?.roleId || ""),
  }));
  const recordTargets = (arenaRecords || [])
    .map((item) => {
      const name = String(item?.name || "").trim();
      return {
        label: formatRecordSourceOption(name || dashText),
        value: name ? `name:${name}` : "",
      };
    })
    .filter((item) => item.value);

  return [...rankTargets, ...recordTargets]
    .filter((item) => item.value)
    .filter(
      (item, index, list) => list.findIndex((candidate) => candidate.value === item.value) === index,
    )
    .slice(0, 200);
};

export const buildArenaManualLineupEntries = (
  manualLineupMap = {},
  unknownText = "Unknown",
) =>
  Object.entries(manualLineupMap || {})
    .map(([key, lineupType]) => ({
      key,
      lineupType: String(lineupType || unknownText),
    }))
    .sort((left, right) => left.key.localeCompare(right.key))
    .slice(0, 30);

export const buildArenaRecordWinRateSummary = (arenaRecords = []) => {
  const records = (arenaRecords || []).filter((item) => inferArenaRecordWinState(item) !== null);
  const total = records.length;
  const wins = records.filter((item) => inferArenaRecordWinState(item) === true).length;
  const losses = records.filter((item) => inferArenaRecordWinState(item) === false).length;
  const rate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";

  return { losses, rate, total, wins };
};

export const buildArenaRecordOpponentRateViews = (
  arenaRecords = [],
  unknownPlayerText = "Unknown Player",
) => {
  const grouped = new Map();

  for (const item of arenaRecords || []) {
    const isWin = inferArenaRecordWinState(item);
    if (isWin === null) {
      continue;
    }

    const name = String(item?.name || "").trim() || unknownPlayerText;
    const previous = grouped.get(name) || { losses: 0, name, total: 0, wins: 0 };
    previous.total += 1;
    previous.wins += isWin ? 1 : 0;
    previous.losses += isWin ? 0 : 1;
    grouped.set(name, previous);
  }

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      rate: item.total > 0 ? ((item.wins / item.total) * 100).toFixed(0) : "0",
    }))
    .sort((left, right) => right.total - left.total)
    .slice(0, 8);
};

export const buildArenaTargetListView = ({
  arenaRecords = [],
  isSkippedLineupType = () => false,
  limit = 6,
  myRoleId = "",
  preferredWinRate = null,
  rankList = [],
  targetWinStats = {},
  unknownText = "Unknown",
} = {}) => {
  const preferredThreshold = normalizePreferredWinRate(preferredWinRate);
  const recordLookups = buildArenaRecordStatsLookups(arenaRecords);
  const skippedTargets = [];
  const availableTargets = [];

  for (const item of rankList || []) {
    const roleId = String(item?.roleId || item?.id || "").trim();
    if (!roleId || roleId === String(myRoleId || "").trim()) {
      continue;
    }

    const target = {
      headImg: item?.headImg || "",
      id: roleId,
      lineupType: String(item?.lineupType || unknownText).trim() || unknownText,
      name: item?.name || unknownText,
      powerText: item?.powerText || "-",
      rank: item?.rank,
      roleId,
      score: item?.score,
    };

    if (isSkippedLineupType(target.lineupType)) {
      skippedTargets.push({
        ...target,
        avatarText: getArenaAvatarFallbackText(target.name),
        rankLabel: formatArenaRankLabel(target.rank, "-"),
      });
      continue;
    }

    availableTargets.push(target);
  }

  const sortedTargets = sortArenaTargetsByWinRatePreference(
    availableTargets,
    targetWinStats,
    preferredThreshold,
    arenaRecords,
  );

  const recommendedTargets = sortedTargets.slice(0, limit).map((item) => {
    const stats = resolveArenaTargetStats(item, targetWinStats, recordLookups);
    return {
      ...item,
      avatarText: getArenaAvatarFallbackText(item.name),
      detailText: stats.known ? `${stats.wins}/${stats.total}` : "-",
      isBelowPreferredRate:
        preferredThreshold !== null
        && stats.known
        && Number(stats.rateValue) < preferredThreshold,
      isKnownRate: stats.known,
      isPreferredRateMatched:
        preferredThreshold === null
        || !stats.known
        || Number(stats.rateValue) >= preferredThreshold,
      losses: stats.losses,
      rankLabel: formatArenaRankLabel(item.rank, "-"),
      rateText: stats.rateText,
      total: stats.total,
      wins: stats.wins,
    };
  });

  return {
    preferredThreshold,
    recommendedTargets,
    skippedTargets: skippedTargets.slice(0, limit),
    skippedTotal: skippedTargets.length,
  };
};

export const buildArenaBattleRunResultView = ({
  arenaRecords = [],
  endedAt = 0,
  maxRecords = 8,
  plannedCount = 0,
  previousRecordIds = [],
  startedAt = 0,
} = {}) => {
  const previousIds = new Set(previousRecordIds || []);
  const hasRunContext = Number(startedAt) > 0;
  const windowStart = Number(startedAt || 0) - 1000;
  const windowEnd = Number(endedAt || 0) > 0 ? Number(endedAt || 0) + 5 * 1000 : Number.MAX_SAFE_INTEGER;

  const recentRecords = (arenaRecords || [])
    .filter((record) => {
      const recordId = String(record?.id || "");
      const createdAt = Number(record?.createdAt || 0);
      const isWithinWindow =
        hasRunContext
        && Number.isFinite(createdAt)
        && createdAt >= windowStart
        && createdAt <= windowEnd;
      if (!isWithinWindow) {
        return false;
      }

      if (!recordId || previousIds.size === 0) {
        return true;
      }

      return !previousIds.has(recordId);
    })
    .sort((left, right) => Number(right?.createdAt || 0) - Number(left?.createdAt || 0));

  const wins = recentRecords.filter((item) => inferArenaRecordWinState(item) === true).length;
  const losses = recentRecords.filter((item) => inferArenaRecordWinState(item) === false).length;
  const executedCount = recentRecords.length;
  const winRateText = executedCount > 0 ? ((wins / executedCount) * 100).toFixed(1) : "0.0";
  const scoreDeltaTotal = recentRecords.reduce((sum, item) => {
    const numeric = Number(item?.scoreDelta);
    return Number.isFinite(numeric) ? sum + Math.trunc(numeric) : sum;
  }, 0);

  return {
    endedAt: Number(endedAt || 0),
    executedCount,
    hasRecords: recentRecords.length > 0,
    hasRunContext,
    losses,
    plannedCount: Math.max(0, Number(plannedCount || 0)),
    recentRecords: recentRecords.slice(0, maxRecords).map(normalizeRecentRunRecord),
    scoreDeltaClass: getArenaScoreDeltaClass(scoreDeltaTotal),
    scoreDeltaText: formatArenaScoreDelta(scoreDeltaTotal, "0"),
    scoreDeltaTotal,
    startedAt: Number(startedAt || 0),
    winRateText,
    wins,
  };
};
