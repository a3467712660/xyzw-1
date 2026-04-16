import {
  normalizeFightPvpReplayPayload,
} from "./fightPvpReplayNormalizer.js";

export const MAX_FIGHT_PVP_REPLAYS = 20;

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

const sanitizeFightPvpReplay = (value) => {
  if (!value || typeof value !== "object") {
    return null;
  }

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
    stageNameStr: value?.stageNameStr,
    startTipTopName: value?.startTipTopName,
    startTipStage: value?.startTipStage,
    runtimeOptionsSnapshot: value?.runtimeOptionsSnapshot,
  });

  if (!normalized?.battleId || !normalized?.battleData) {
    return null;
  }

  return normalized;
};

const sanitizeFightPvpReplays = (records) => {
  if (!Array.isArray(records)) {
    return [];
  }

  const deduped = new Map();
  for (const item of records) {
    const normalized = sanitizeFightPvpReplay(item);
    if (!normalized) {
      continue;
    }
    const dedupeKey = dedupeReplayKey(normalized);
    if (!dedupeKey) {
      continue;
    }

    const existing = deduped.get(dedupeKey);
    if (!existing || toTimestamp(normalized.createdAt) >= toTimestamp(existing.createdAt)) {
      deduped.set(dedupeKey, normalized);
    }
  }

  return [...deduped.values()]
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .slice(0, MAX_FIGHT_PVP_REPLAYS);
};

const writeFightPvpReplayRecords = (storageKey, records) => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const sanitized = sanitizeFightPvpReplays(records);
  const queue = sanitized.slice();
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

export const loadFightPvpReplays = ({ userId, tokenId } = {}) => {
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
    return sanitizeFightPvpReplays(JSON.parse(raw));
  } catch {
    return [];
  }
};

export const saveFightPvpReplays = ({ userId, tokenId, records } = {}) => {
  const storageKey = buildFightPvpReplayStorageKey({ userId, tokenId });
  return writeFightPvpReplayRecords(storageKey, records);
};

export const appendFightPvpReplay = ({ userId, tokenId, replay } = {}) => {
  const current = loadFightPvpReplays({ userId, tokenId });
  const incoming = Array.isArray(replay) ? replay : [replay];
  return saveFightPvpReplays({
    userId,
    tokenId,
    records: [...incoming, ...current],
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
