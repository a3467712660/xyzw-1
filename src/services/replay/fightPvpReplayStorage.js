import {
  normalizeFightPvpReplayPayload,
} from "./fightPvpReplayNormalizer.js";
import {
  resolveFightPvpMapIdFromReplay,
} from "./fightPvpReplayMapIdResolver.js";
import { buildPvpMapDressSnapshot } from "./fightPvpReplayDressSnapshot.js";

export const MAX_FIGHT_PVP_REPLAYS = 20;
export const FIGHT_PVP_REPLAY_LIVE_CONTEXT_REFRESH_TIMEOUT_MS = 2500;

const getStorage = () => {
  if (typeof globalThis === "undefined") {
    return null;
  }

  return globalThis.localStorage || null;
};

const toStorageSegment = (value, fallback) => {
  const text = String(value ?? "").trim();
  return text || fallback;
};

const toTimestamp = (value) => {
  const time = Date.parse(String(value ?? ""));
  return Number.isFinite(time) ? time : 0;
};

const dedupeReplayKey = (replay) =>
  String(replay?.replayId || replay?.battleId || "").trim();

const hasPersistedReplayMapId = (value) => {
  const mapId = Number(value?.mapId);
  return Number.isFinite(mapId) && mapId > 0;
};

const toComparablePositiveNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

const toComparableText = (value) => {
  const text = String(value ?? "").trim();
  return text || null;
};

const getTokenStoreGameData = (tokenStore) => {
  const gameData = tokenStore?.gameData;
  if (gameData?.value && typeof gameData.value === "object") {
    return gameData.value;
  }
  return gameData && typeof gameData === "object" ? gameData : null;
};

export const buildFightPvpReplayLiveContext = ({
  tokenStore = null,
  tokenStoreRoleInfo = null,
} = {}) => {
  const resolvedRoleInfo = tokenStoreRoleInfo || getTokenStoreGameData(tokenStore)?.roleInfo || null;
  if (!resolvedRoleInfo) {
    return null;
  }

  return {
    tokenStoreRoleInfo: resolvedRoleInfo,
  };
};

export const refreshFightPvpReplayLiveContext = async ({
  tokenStore = null,
  tokenId = "",
  timeout = FIGHT_PVP_REPLAY_LIVE_CONTEXT_REFRESH_TIMEOUT_MS,
} = {}) => {
  const fallbackContext = buildFightPvpReplayLiveContext({ tokenStore });
  const normalizedTokenId = String(tokenId || tokenStore?.selectedToken?.id || "").trim();
  if (!normalizedTokenId) {
    return fallbackContext;
  }

  const wsStatus = tokenStore?.getWebSocketStatus?.(normalizedTokenId);
  if (wsStatus && wsStatus !== "connected") {
    return fallbackContext;
  }

  if (typeof tokenStore?.sendMessageWithPromise !== "function") {
    return fallbackContext;
  }

  try {
    const roleInfo = await tokenStore.sendMessageWithPromise(
      normalizedTokenId,
      "role_getroleinfo",
      {},
      timeout,
    );
    if (!roleInfo) {
      return buildFightPvpReplayLiveContext({ tokenStore });
    }

    const gameData = getTokenStoreGameData(tokenStore);
    if (gameData) {
      gameData.roleInfo = roleInfo;
      if ("lastUpdated" in gameData) {
        gameData.lastUpdated = new Date().toISOString();
      }
    }

    return buildFightPvpReplayLiveContext({
      tokenStore,
      tokenStoreRoleInfo: roleInfo,
    });
  } catch {
    return buildFightPvpReplayLiveContext({ tokenStore });
  }
};

const pickReplayMapFieldSnapshot = (value) => ({
  mapId: toComparablePositiveNumber(value?.mapId),
  pvpMapId: toComparablePositiveNumber(value?.pvpMapId),
  mapIdSource: toComparableText(value?.mapIdSource),
  pvpMapIdSource: toComparableText(value?.pvpMapIdSource),
  selfRoleSnapshot: {
    pvpMapId: toComparablePositiveNumber(value?.selfRoleSnapshot?.pvpMapId),
    dressPvpMapUsedId: toComparablePositiveNumber(value?.selfRoleSnapshot?.dressPvpMapUsedId),
    dressPvpMapMapId: toComparablePositiveNumber(value?.selfRoleSnapshot?.dressPvpMapMapId),
    dress: buildPvpMapDressSnapshot(value?.selfRoleSnapshot?.dress),
  },
  context: {
    pvpMapId: toComparablePositiveNumber(value?.context?.pvpMapId),
    dressPvpMapUsedId: toComparablePositiveNumber(value?.context?.dressPvpMapUsedId),
    dressPvpMapMapId: toComparablePositiveNumber(value?.context?.dressPvpMapMapId),
    dress: buildPvpMapDressSnapshot(value?.context?.dress),
  },
});

const didReplayMapFieldsChange = (before, after) =>
  JSON.stringify(pickReplayMapFieldSnapshot(before))
  !== JSON.stringify(pickReplayMapFieldSnapshot(after));

const sanitizeFightPvpReplay = (value, { liveContext = null } = {}) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const shouldBackfillMapId = !hasPersistedReplayMapId(value);
  const mapResolution = resolveFightPvpMapIdFromReplay({
    replay: value,
    liveContext,
  });
  const didBackfillMapId = shouldBackfillMapId && mapResolution.ok;
  const normalized = normalizeFightPvpReplayPayload({
    battleData: value?.battleData,
    battleResult: value?.battleResult,
    tokenId: value?.tokenId,
    targetId: value?.targetId,
    targetName: value?.targetName,
    createdAt: value?.createdAt,
    source: value?.source,
    leftContext: value?.left,
    rightContext: value?.right,
    mapId: value?.mapId,
    pvpMapId: value?.pvpMapId,
    mapIdSource: value?.mapIdSource,
    pvpMapIdSource: value?.pvpMapIdSource,
    selfRoleSnapshot: value?.selfRoleSnapshot,
    context: value?.context,
    meta: value?.meta,
    backfilledAt: didBackfillMapId ? new Date().toISOString() : value?.backfilledAt,
    stageNameStr: value?.stageNameStr,
    startTipTopName: value?.startTipTopName,
    startTipStage: value?.startTipStage,
    runtimeOptionsSnapshot: value?.runtimeOptionsSnapshot,
    mapResolution,
    liveContext,
  });

  if (!normalized?.battleId || !normalized?.battleData) {
    return null;
  }

  return {
    normalized,
    didBackfillMapId,
    didRepairMapFields: didReplayMapFieldsChange(value, normalized),
  };
};

const sanitizeFightPvpReplays = (records, { liveContext = null } = {}) => {
  if (!Array.isArray(records)) {
    return {
      records: [],
      didBackfillMapId: false,
      didRepairMapFields: false,
    };
  }

  const deduped = new Map();
  let didBackfillMapId = false;
  let didRepairMapFields = false;
  for (const item of records) {
    const sanitized = sanitizeFightPvpReplay(item, { liveContext });
    const normalized = sanitized?.normalized || null;
    if (!normalized) {
      continue;
    }

    didBackfillMapId = didBackfillMapId || sanitized.didBackfillMapId === true;
    didRepairMapFields = didRepairMapFields || sanitized.didRepairMapFields === true;
    const dedupeKey = dedupeReplayKey(normalized);
    if (!dedupeKey) {
      continue;
    }

    const existing = deduped.get(dedupeKey);
    if (!existing || toTimestamp(normalized.createdAt) >= toTimestamp(existing.createdAt)) {
      deduped.set(dedupeKey, normalized);
    }
  }

  return {
    records: [...deduped.values()]
      .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
      .slice(0, MAX_FIGHT_PVP_REPLAYS),
    didBackfillMapId,
    didRepairMapFields,
  };
};

const writeFightPvpReplayRecords = (
  storageKey,
  records,
  { liveContext = null } = {},
) => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const sanitized = sanitizeFightPvpReplays(records, { liveContext });
  const queue = sanitized.records.slice();
  while (queue.length >= 0) {
    try {
      storage.setItem(storageKey, JSON.stringify(queue));
      return queue;
    } catch (error) {
      if (queue.length === 0) {
        throw error;
      }
      queue.pop();
    }
  }

  return [];
};

export const buildFightPvpReplayStorageKey = ({ userId, tokenId } = {}) =>
  `fight_pvp_replays_v1:${toStorageSegment(userId, "guest")}:${toStorageSegment(tokenId, "unknown-token")}`;

export const loadFightPvpReplays = ({ userId, tokenId, liveContext = null } = {}) => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const storageKey = buildFightPvpReplayStorageKey({ userId, tokenId });
  const raw = storage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    const sanitized = sanitizeFightPvpReplays(JSON.parse(raw), {
      liveContext,
    });
    if (sanitized.didRepairMapFields) {
      writeFightPvpReplayRecords(storageKey, sanitized.records, {
        liveContext,
      });
    }
    return sanitized.records;
  } catch {
    return [];
  }
};

export const saveFightPvpReplays = ({
  userId,
  tokenId,
  records,
  liveContext = null,
} = {}) => {
  const storageKey = buildFightPvpReplayStorageKey({ userId, tokenId });
  return writeFightPvpReplayRecords(storageKey, records, { liveContext });
};

export const appendFightPvpReplay = ({
  userId,
  tokenId,
  replay,
  liveContext = null,
} = {}) => {
  const current = loadFightPvpReplays({ userId, tokenId, liveContext });
  const incoming = Array.isArray(replay) ? replay : [replay];
  return saveFightPvpReplays({
    userId,
    tokenId,
    records: [...incoming, ...current],
    liveContext,
  });
};

export const removeFightPvpReplay = ({ userId, tokenId, replayId } = {}) => {
  const current = loadFightPvpReplays({ userId, tokenId });
  return saveFightPvpReplays({
    userId,
    tokenId,
    records: current.filter((item) => dedupeReplayKey(item) !== String(replayId || "").trim()),
  });
};

export const clearFightPvpReplays = ({ userId, tokenId } = {}) => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  storage.removeItem(buildFightPvpReplayStorageKey({ userId, tokenId }));
  return [];
};
