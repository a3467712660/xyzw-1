import {
  buildFightPvpBattleInputMissingMessage,
  cloneJsonValue,
  createFightPvpExactBattleInput,
  getFightPvpBattleInputMissingFields,
  getFightPvpReplayBattleVersion,
  rehydrateFightPvpBattleInputSnapshot,
  serializeFightPvpBattleInputSnapshot,
  summarizeFightPvpBattleInput,
  toNonEmptyString,
  toPositiveNumber,
} from "./fightPvpExactBattleInput.js";
import {
  createFightPvpReplayRecordFromBattleInput,
  FIGHT_PVP_REPLAY_SOURCE,
  FIGHT_PVP_REPLAY_SOURCE_TYPES,
  normalizeReplaySide,
} from "./fightPvpReplayNormalizer.js";
import {
  convertLegacyFightPvpReplayPayload,
  isLegacyFightPvpReplayPayload,
} from "./fightPvpBattleInputAdapter.js";

export const MAX_FIGHT_PVP_REPLAYS = 20;
export const FIGHT_PVP_REPLAY_LIVE_CONTEXT_REFRESH_TIMEOUT_MS = 2500;

const FIGHT_PVP_REPLAY_STORAGE_VERSION = "v3";
const FIGHT_PVP_PREVIOUS_STORAGE_VERSION = "v2";
const FIGHT_PVP_LEGACY_STORAGE_VERSION = "v1";

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

const dedupeReplayKey = (record) =>
  String(record?.replayId || record?.battleId || "").trim();

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

const buildStorageKey = ({ userId, tokenId, version }) =>
  `fight_pvp_replays_${version}:${toStorageSegment(userId, "guest")}:${toStorageSegment(tokenId, "unknown-token")}`;

export const buildFightPvpReplayStorageKey = ({ userId, tokenId } = {}) =>
  buildStorageKey({
    userId,
    tokenId,
    version: FIGHT_PVP_REPLAY_STORAGE_VERSION,
  });

const buildLegacyFightPvpReplayStorageKey = ({ userId, tokenId } = {}) =>
  buildStorageKey({
    userId,
    tokenId,
    version: FIGHT_PVP_LEGACY_STORAGE_VERSION,
  });

const buildPreviousFightPvpReplayStorageKey = ({ userId, tokenId } = {}) =>
  buildStorageKey({
    userId,
    tokenId,
    version: FIGHT_PVP_PREVIOUS_STORAGE_VERSION,
  });

const parseStoredRecords = (raw) => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const buildUnplayableLegacyRecord = (value, message) => {
  const battleData = value?.battleData;
  const battleResult = value?.battleResult || battleData?.result || null;
  const left = normalizeReplaySide(value?.left, battleData?.leftTeam);
  const right = normalizeReplaySide(value?.right, battleData?.rightTeam);
  const replayId = toNonEmptyString(
    value?.replayId,
    value?.battleId && `${toNonEmptyString(value?.source, FIGHT_PVP_REPLAY_SOURCE)}:${value.battleId}`,
  ) || `legacy-unplayable:${Date.now().toString(16)}`;

  return {
    replayId,
    battleId: toNonEmptyString(value?.battleId, replayId),
    battleVersion: getFightPvpReplayBattleVersion(value),
    tokenId: toNonEmptyString(value?.tokenId),
    source: toNonEmptyString(value?.source, FIGHT_PVP_REPLAY_SOURCE),
    targetId: toNonEmptyString(value?.targetId, right?.roleId),
    targetName: toNonEmptyString(value?.targetName, right?.name),
    createdAt: value?.createdAt || new Date().toISOString(),
    battleResult: cloneJsonValue(battleResult),
    left,
    right,
    mapId: toPositiveNumber(value?.mapId, null),
    pvpMapId: toPositiveNumber(value?.pvpMapId, null),
    mapIdSource: toNonEmptyString(value?.mapIdSource) || null,
    pvpMapIdSource: toNonEmptyString(value?.pvpMapIdSource) || null,
    mapIdResolveReason: toNonEmptyString(value?.mapIdResolveReason) || null,
    dressPvpMapUsedId: toPositiveNumber(value?.dressPvpMapUsedId, null),
    selfRoleContextSource: toNonEmptyString(value?.selfRoleContextSource) || null,
    runtimeRoleAvailable: Boolean(value?.runtimeRoleAvailable),
    runtimeRolePath: toNonEmptyString(value?.runtimeRolePath) || null,
    runtimeRoleMapId: toPositiveNumber(value?.runtimeRoleMapId, null),
    battleInputAvailable: Boolean(value?.battleInputAvailable),
    selfRoleSnapshot: cloneJsonValue(value?.selfRoleSnapshot) || null,
    context: cloneJsonValue(value?.context) || null,
    backfilledAt: value?.backfilledAt || null,
    meta: cloneJsonValue(value?.meta) || {},
    stageNameStr: toNonEmptyString(value?.stageNameStr) || null,
    startTipTopName: toNonEmptyString(value?.startTipTopName) || null,
    startTipStage: toNonEmptyString(value?.startTipStage) || null,
    battleInputSnapshot: cloneJsonValue(value?.battleInputSnapshot) || null,
    exactBattleInputData: null,
    battleInputData: null,
    isPlayable: false,
    disabledReason: message || "旧回放数据结构不完整，当前无法播放。",
    sourceType: value?.battleInputSnapshot
      ? FIGHT_PVP_REPLAY_SOURCE_TYPES.PERSISTED_BATTLE_INPUT_SNAPSHOT
      : FIGHT_PVP_REPLAY_SOURCE_TYPES.LEGACY_ADAPTED_REPLAY,
    battleInputSource: value?.battleInputSnapshot
      ? FIGHT_PVP_REPLAY_SOURCE_TYPES.PERSISTED_BATTLE_INPUT_SNAPSHOT
      : FIGHT_PVP_REPLAY_SOURCE_TYPES.LEGACY_ADAPTED_REPLAY,
    missingRuntimeFields: value?.battleInputSnapshot ? [] : ["battleInputSnapshot"],
    battleInputSummary: null,
  };
};

const normalizeCurrentFightPvpReplayRecord = (
  value,
  { keepRuntimeBattleInput = false } = {},
) => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const directBattleInput = value?.exactBattleInputData
    ? createFightPvpExactBattleInput(value.exactBattleInputData, { mutate: true })
    : (
        value?.battleInputData
          ? createFightPvpExactBattleInput(value.battleInputData, { mutate: true })
          : null
      );
  const battleInputSnapshot = directBattleInput
    ? serializeFightPvpBattleInputSnapshot(directBattleInput, {
        diagnostics: value?.battleInputSnapshot?.diagnostics || value?.meta?.mapIdDiagnostics || null,
      })
    : null;
  const persistedBattleInputSnapshot = battleInputSnapshot
    || (
      value?.battleInputSnapshot
        ? cloneJsonValue(value.battleInputSnapshot)
        : null
    );
  const replayBattleInput = directBattleInput
    || (
      persistedBattleInputSnapshot
        ? rehydrateFightPvpBattleInputSnapshot(persistedBattleInputSnapshot)
        : null
    );

  if (!replayBattleInput) {
    return buildUnplayableLegacyRecord(
      value,
      value?.disabledReason || "旧回放数据结构不完整，当前无法播放。",
    );
  }

  const normalizedRecord = createFightPvpReplayRecordFromBattleInput({
    exactBattleInputData: replayBattleInput,
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
    mapIdResolveReason: value?.mapIdResolveReason,
    dressPvpMapUsedId: value?.dressPvpMapUsedId,
    selfRoleContextSource: value?.selfRoleContextSource,
    runtimeRoleAvailable: value?.runtimeRoleAvailable,
    runtimeRolePath: value?.runtimeRolePath,
    runtimeRoleMapId: value?.runtimeRoleMapId,
    battleInputAvailable: value?.battleInputAvailable,
    selfRoleSnapshot: value?.selfRoleSnapshot,
    context: value?.context,
    meta: value?.meta,
    backfilledAt: value?.backfilledAt,
  });
  const sourceType = value?.sourceType
    || (
      directBattleInput
        ? FIGHT_PVP_REPLAY_SOURCE_TYPES.LIVE_MEMORY_BATTLE_INPUT
        : FIGHT_PVP_REPLAY_SOURCE_TYPES.PERSISTED_BATTLE_INPUT_SNAPSHOT
    );
  const missingRuntimeFields = getFightPvpBattleInputMissingFields(replayBattleInput);
  const disabledReason = missingRuntimeFields.length > 0
    ? buildFightPvpBattleInputMissingMessage(missingRuntimeFields)
    : "";

  return {
    ...normalizedRecord,
    battleInputSnapshot: persistedBattleInputSnapshot || normalizedRecord.battleInputSnapshot,
    exactBattleInputData: keepRuntimeBattleInput
      ? (directBattleInput || replayBattleInput)
      : null,
    battleInputData: keepRuntimeBattleInput
      ? (directBattleInput || replayBattleInput)
      : null,
    isPlayable: missingRuntimeFields.length === 0,
    disabledReason,
    sourceType,
    battleInputSource: sourceType,
    missingRuntimeFields,
    battleInputSummary: summarizeFightPvpBattleInput(replayBattleInput, {
      missingRuntimeFields,
      sourceType,
      battleInputSource: sourceType,
      mapIdSource: normalizedRecord.mapIdSource,
      pvpMapIdSource: normalizedRecord.pvpMapIdSource,
      mapIdResolveReason: normalizedRecord.mapIdResolveReason,
      runtimeRoleMapId: normalizedRecord.runtimeRoleMapId,
      runtimeRoleAvailable: normalizedRecord.runtimeRoleAvailable,
      runtimeRolePath: normalizedRecord.runtimeRolePath,
      fixtureMapFallbackUsed: Boolean(
        normalizedRecord?.meta?.fixtureMapFallback
        || normalizedRecord?.meta?.fixtureMapFallbackUsed,
      ),
    }),
  };
};

const sanitizeCurrentFightPvpReplayRecords = (
  records,
  { keepRuntimeBattleInput = false } = {},
) => {
  if (!Array.isArray(records)) {
    return [];
  }

  const deduped = new Map();
  for (const item of records) {
    const normalized = normalizeCurrentFightPvpReplayRecord(item, {
      keepRuntimeBattleInput,
    });
    const dedupeKey = dedupeReplayKey(normalized);
    if (!normalized || !dedupeKey) {
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

const toStoredCurrentFightPvpReplayRecord = (record) => ({
  replayId: record.replayId,
  battleId: record.battleId,
  battleVersion: record.battleVersion,
  tokenId: record.tokenId,
  source: record.source,
  targetId: record.targetId,
  targetName: record.targetName,
  createdAt: record.createdAt,
  battleResult: cloneJsonValue(record.battleResult),
  left: cloneJsonValue(record.left),
  right: cloneJsonValue(record.right),
  mapId: record.mapId,
  pvpMapId: record.pvpMapId,
  mapIdSource: record.mapIdSource,
  pvpMapIdSource: record.pvpMapIdSource,
  mapIdResolveReason: record.mapIdResolveReason,
  dressPvpMapUsedId: record.dressPvpMapUsedId,
  selfRoleContextSource: record.selfRoleContextSource,
  runtimeRoleAvailable: record.runtimeRoleAvailable,
  runtimeRolePath: record.runtimeRolePath,
  runtimeRoleMapId: record.runtimeRoleMapId,
  battleInputAvailable: record.battleInputAvailable,
  selfRoleSnapshot: cloneJsonValue(record.selfRoleSnapshot),
  context: cloneJsonValue(record.context),
  backfilledAt: record.backfilledAt,
  meta: cloneJsonValue(record.meta),
  stageNameStr: record.stageNameStr,
  startTipTopName: record.startTipTopName,
  startTipStage: record.startTipStage,
  battleInputSnapshot: cloneJsonValue(record.battleInputSnapshot),
  isPlayable: record.isPlayable,
  disabledReason: record.disabledReason,
  sourceType: FIGHT_PVP_REPLAY_SOURCE_TYPES.PERSISTED_BATTLE_INPUT_SNAPSHOT,
  battleInputSource: FIGHT_PVP_REPLAY_SOURCE_TYPES.PERSISTED_BATTLE_INPUT_SNAPSHOT,
});

const writeCurrentFightPvpReplayRecords = (
  storageKey,
  records,
) => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const sanitized = sanitizeCurrentFightPvpReplayRecords(records);
  const storable = sanitized
    .filter((record) => record?.battleInputSnapshot && record?.isPlayable !== false)
    .map(toStoredCurrentFightPvpReplayRecord);
  const queue = storable.slice();

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

const loadStoredCurrentFightPvpReplayRecords = ({
  userId,
  tokenId,
  storageKey = null,
} = {}) => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const raw = storage.getItem(
    storageKey || buildFightPvpReplayStorageKey({ userId, tokenId }),
  );
  return sanitizeCurrentFightPvpReplayRecords(parseStoredRecords(raw));
};

const loadPreviousFightPvpReplayRecords = ({
  userId,
  tokenId,
} = {}) =>
  loadStoredCurrentFightPvpReplayRecords({
    userId,
    tokenId,
    storageKey: buildPreviousFightPvpReplayStorageKey({ userId, tokenId }),
  });

const loadLegacyFightPvpReplayRecords = ({
  userId,
  tokenId,
  liveContext = null,
} = {}) => {
  const storage = getStorage();
  if (!storage) {
    return {
      migratedRecords: [],
      unresolvedRecords: [],
      shouldRewriteCurrentStorage: false,
    };
  }

  const raw = storage.getItem(buildLegacyFightPvpReplayStorageKey({ userId, tokenId }));
  const parsed = parseStoredRecords(raw);
  const migratedRecords = [];
  const unresolvedRecords = [];
  let shouldRewriteCurrentStorage = false;

  for (const item of parsed) {
    if (item?.battleInputSnapshot) {
      const normalized = normalizeCurrentFightPvpReplayRecord(item);
      if (normalized?.isPlayable) {
        migratedRecords.push(normalized);
        shouldRewriteCurrentStorage = true;
      } else if (normalized) {
        unresolvedRecords.push(normalized);
      }
      continue;
    }

    if (isLegacyFightPvpReplayPayload(item)) {
      const migrated = convertLegacyFightPvpReplayPayload(item, {
        liveContext,
      });
      if (migrated.record?.isPlayable) {
        migratedRecords.push(migrated.record);
        shouldRewriteCurrentStorage = true;
      } else {
        unresolvedRecords.push(
          migrated.record
          || buildUnplayableLegacyRecord(
            item,
            migrated.message || "旧回放数据结构不完整，当前无法播放。",
          ),
        );
      }
      continue;
    }

    unresolvedRecords.push(
      buildUnplayableLegacyRecord(
        item,
        "旧回放数据结构不完整，当前无法播放。",
      ),
    );
  }

  return {
    migratedRecords: sanitizeCurrentFightPvpReplayRecords(migratedRecords),
    unresolvedRecords: sanitizeCurrentFightPvpReplayRecords(unresolvedRecords),
    shouldRewriteCurrentStorage,
  };
};

const mergeReplayRecordLists = (...recordGroups) => {
  const deduped = new Map();

  for (const group of recordGroups) {
    for (const item of group || []) {
      const normalized = item?.battleInputSnapshot || item?.battleInputData || item?.exactBattleInputData
        ? normalizeCurrentFightPvpReplayRecord(item, {
            keepRuntimeBattleInput: Boolean(item?.battleInputData || item?.exactBattleInputData),
          })
        : item;
      const dedupeKey = dedupeReplayKey(normalized);
      if (!normalized || !dedupeKey) {
        continue;
      }

      const existing = deduped.get(dedupeKey);
      if (!existing || toTimestamp(normalized.createdAt) >= toTimestamp(existing.createdAt)) {
        deduped.set(dedupeKey, normalized);
      }
    }
  }

  return [...deduped.values()]
    .sort((left, right) => toTimestamp(right.createdAt) - toTimestamp(left.createdAt))
    .slice(0, MAX_FIGHT_PVP_REPLAYS);
};

export const loadFightPvpReplays = ({ userId, tokenId, liveContext = null } = {}) => {
  const currentRecords = loadStoredCurrentFightPvpReplayRecords({
    userId,
    tokenId,
  });
  const previousCurrentRecords = loadPreviousFightPvpReplayRecords({
    userId,
    tokenId,
  });
  const legacyRecords = loadLegacyFightPvpReplayRecords({
    userId,
    tokenId,
    liveContext,
  });

  let effectiveCurrentRecords = currentRecords;
  const shouldRewriteCurrentStorage = previousCurrentRecords.length > 0
    || (legacyRecords.shouldRewriteCurrentStorage && legacyRecords.migratedRecords.length > 0);
  if (shouldRewriteCurrentStorage) {
    const storageKey = buildFightPvpReplayStorageKey({ userId, tokenId });
    writeCurrentFightPvpReplayRecords(
      storageKey,
      mergeReplayRecordLists(
        currentRecords,
        previousCurrentRecords,
        legacyRecords.migratedRecords,
      ),
    );
    effectiveCurrentRecords = loadStoredCurrentFightPvpReplayRecords({
      userId,
      tokenId,
    });
  }

  return mergeReplayRecordLists(
    effectiveCurrentRecords,
    previousCurrentRecords,
    legacyRecords.unresolvedRecords,
  );
};

export const saveFightPvpReplays = ({
  userId,
  tokenId,
  records,
  liveContext = null,
} = {}) => {
  const storageKey = buildFightPvpReplayStorageKey({ userId, tokenId });
  writeCurrentFightPvpReplayRecords(storageKey, records);
  return loadFightPvpReplays({
    userId,
    tokenId,
    liveContext,
  });
};

export const appendFightPvpReplay = ({
  userId,
  tokenId,
  replay,
  liveContext = null,
} = {}) => {
  const current = loadStoredCurrentFightPvpReplayRecords({ userId, tokenId });
  const previousCurrent = loadPreviousFightPvpReplayRecords({ userId, tokenId });
  const incoming = sanitizeCurrentFightPvpReplayRecords(
    Array.isArray(replay) ? replay : [replay],
    { keepRuntimeBattleInput: true },
  );

  return saveFightPvpReplays({
    userId,
    tokenId,
    records: mergeReplayRecordLists(incoming, current, previousCurrent),
    liveContext,
  });
};

export const removeFightPvpReplay = ({ userId, tokenId, replayId } = {}) => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  const normalizedReplayId = String(replayId || "").trim();
  const currentKey = buildFightPvpReplayStorageKey({ userId, tokenId });
  const previousKey = buildPreviousFightPvpReplayStorageKey({ userId, tokenId });
  const legacyKey = buildLegacyFightPvpReplayStorageKey({ userId, tokenId });
  const currentRecords = loadStoredCurrentFightPvpReplayRecords({ userId, tokenId })
    .filter((item) => dedupeReplayKey(item) !== normalizedReplayId);

  writeCurrentFightPvpReplayRecords(currentKey, currentRecords);

  const legacyRaw = parseStoredRecords(storage.getItem(legacyKey)).filter(
    (item) => dedupeReplayKey(item) !== normalizedReplayId,
  );
  storage.setItem(legacyKey, JSON.stringify(legacyRaw));
  const previousRaw = parseStoredRecords(storage.getItem(previousKey)).filter(
    (item) => dedupeReplayKey(item) !== normalizedReplayId,
  );
  storage.setItem(previousKey, JSON.stringify(previousRaw));

  return loadFightPvpReplays({ userId, tokenId });
};

export const clearFightPvpReplays = ({ userId, tokenId } = {}) => {
  const storage = getStorage();
  if (!storage) {
    return [];
  }

  storage.removeItem(buildFightPvpReplayStorageKey({ userId, tokenId }));
  storage.removeItem(buildPreviousFightPvpReplayStorageKey({ userId, tokenId }));
  storage.removeItem(buildLegacyFightPvpReplayStorageKey({ userId, tokenId }));
  return [];
};
