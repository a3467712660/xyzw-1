import {
  buildFightPvpBattleInputData,
  buildFightPvpBattleInputMissingMessage,
  cloneJsonValue,
  createFightPvpBattleInputSnapshot,
  FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME,
  FIGHT_PVP_REPLAY_DEFAULT_START_TIP_STAGE,
  getFightPvpBattleInputMissingFields,
  getFightPvpReplayBattleVersion,
  resolveFightPvpReplayRuntimeLabels,
  summarizeFightPvpBattleInput,
  toFiniteNumber,
  toNonEmptyString,
  toPlainObject,
  toPositiveNumber,
} from "./fightPvpBattleInputSnapshot.js";
import { buildPvpMapDressSnapshot } from "./fightPvpReplayDressSnapshot.js";

export {
  buildFightPvpBattleInputData,
  buildFightPvpBattleInputMissingMessage,
  createFightPvpBattleInputSnapshot,
  FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME,
  FIGHT_PVP_REPLAY_DEFAULT_START_TIP_STAGE,
  getFightPvpBattleInputMissingFields,
  getFightPvpReplayBattleVersion,
  resolveFightPvpReplayRuntimeLabels,
  summarizeFightPvpBattleInput,
  toFiniteNumber,
  toNonEmptyString,
  toPositiveNumber,
} from "./fightPvpBattleInputSnapshot.js";

export const FIGHT_PVP_REPLAY_SOURCE = "fight-pvp-live";

const isLegacyDressUsedPvpMapIdLeak = ({
  pvpMapId = null,
  dressPvpMapUsedId = null,
  dressPvpMapMapId = null,
} = {}) => {
  const resolvedPvpMapId = toPositiveNumber(pvpMapId, null);
  const resolvedDressUsedId = toPositiveNumber(dressPvpMapUsedId, null);
  const resolvedDressMapId = toPositiveNumber(dressPvpMapMapId, null);
  return Boolean(
    resolvedPvpMapId
    && resolvedDressUsedId
    && resolvedPvpMapId === resolvedDressUsedId
    && !resolvedDressMapId,
  );
};

const sanitizePersistedPvpMapId = ({
  pvpMapId = null,
  dressPvpMapUsedId = null,
  dressPvpMapMapId = null,
} = {}) => (
  isLegacyDressUsedPvpMapIdLeak({
    pvpMapId,
    dressPvpMapUsedId,
    dressPvpMapMapId,
  })
    ? null
    : toPositiveNumber(pvpMapId, null)
);

const normalizeReplayTimestamp = (value) => {
  if (typeof value === "string" && value.trim()) {
    const time = Date.parse(value);
    if (Number.isFinite(time)) {
      return new Date(time).toISOString();
    }
  }

  if (Number.isFinite(Number(value))) {
    const time = Number(value);
    if (time > 0) {
      return new Date(time).toISOString();
    }
  }

  return new Date().toISOString();
};

const normalizeOptionalReplayTimestamp = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  return normalizeReplayTimestamp(value);
};

const clonePlainObject = (value) => {
  const source = toPlainObject(value);
  return source ? { ...source } : null;
};

const extractPvpMapDressSnapshot = ({
  existingDress = null,
  selfRoleRaw = null,
  tokenStoreRoleInfo = null,
  dressPvpMapUsedId = null,
} = {}) => {
  const dressSnapshot = buildPvpMapDressSnapshot(existingDress)
    || buildPvpMapDressSnapshot(selfRoleRaw?.role?.dress)
    || buildPvpMapDressSnapshot(selfRoleRaw?.roleInfo?.dress)
    || buildPvpMapDressSnapshot(tokenStoreRoleInfo?.role?.dress)
    || buildPvpMapDressSnapshot(tokenStoreRoleInfo?.dress)
    || buildPvpMapDressSnapshot(dressPvpMapUsedId);

  return dressSnapshot || null;
};

export const normalizeReplaySide = (side, fallback = {}) => {
  const merged = {
    ...(toPlainObject(fallback) || null),
    ...(toPlainObject(side) || null),
  };

  return {
    roleId: toNonEmptyString(
      merged?.roleId,
      merged?.role?.roleId,
      merged?.id,
      merged?.uid,
      merged?.playerId,
    ),
    name: toNonEmptyString(
      merged?.name,
      merged?.role?.name,
      merged?.roleName,
      merged?.nickname,
      merged?.nickName,
    ),
    headImg: toNonEmptyString(
      merged?.headImg,
      merged?.role?.headImg,
      merged?.avatar,
      merged?.head,
    ),
    power: toPositiveNumber(
      merged?.power,
      toPositiveNumber(merged?.role?.power, 0),
    ) || 0,
  };
};

const collectHeroIds = (collection) => {
  const source = collection && typeof collection === "object"
    ? Object.values(collection)
    : [];

  return source
    .map((item) => toNonEmptyString(item?.heroId, item?.id))
    .filter(Boolean)
    .slice(0, 5)
    .join(",");
};

const buildFallbackBattleId = ({
  battleData,
  tokenId,
  targetId,
  createdAt,
  left,
  right,
}) => {
  const parts = [
    toNonEmptyString(tokenId, "unknown-token"),
    toNonEmptyString(targetId, right?.roleId, "unknown-target"),
    toNonEmptyString(left?.roleId, "unknown-left"),
    toNonEmptyString(right?.roleId, "unknown-right"),
    String(toPositiveNumber(battleData?.version, 0) || 0),
    String(toPositiveNumber(battleData?.result?.round, 0) || 0),
    String(toPositiveNumber(battleData?.result?.totalFrame, 0) || 0),
    battleData?.result?.isWin ? "win" : "loss",
    collectHeroIds(battleData?.leftTeam?.team),
    collectHeroIds(battleData?.rightTeam?.team),
    toNonEmptyString(createdAt),
  ];

  const stableText = parts.join("|");
  let hash = 5381;
  for (let i = 0; i < stableText.length; i += 1) {
    hash = ((hash << 5) + hash) ^ stableText.charCodeAt(i);
  }

  return `fight-pvp-${Math.abs(hash >>> 0).toString(16)}`;
};

export const resolveFightPvpReplayRuntimeOptionsSnapshot = ({
  runtimeOptionsSnapshot = null,
  targetId = "",
  targetName = "",
  right = null,
} = {}) => {
  const snapshot = toPlainObject(runtimeOptionsSnapshot) || {};
  const targetRole = clonePlainObject(snapshot.targetRole)
    || (() => {
      const roleId = toNonEmptyString(targetId, right?.roleId);
      const name = toNonEmptyString(targetName, right?.name);
      const headImg = toNonEmptyString(right?.headImg);
      if (!roleId && !name && !headImg) {
        return null;
      }
      return {
        roleId,
        name,
        headImg,
      };
    })();

  return {
    targetRole,
    selfScore: toFiniteNumber(snapshot.selfScore, null),
    oppoScore: toFiniteNumber(snapshot.oppoScore, null),
    replayFlag: snapshot.replayFlag !== false,
  };
};

const buildFightPvpReplaySelfRoleSnapshot = ({
  existingSnapshot = null,
  selfRoleRaw = null,
  tokenStoreRoleInfo = null,
  mapResolution = null,
} = {}) => {
  const dressPvpMapUsedId = toPositiveNumber(
    existingSnapshot?.dressPvpMapUsedId,
    mapResolution?.dressPvpMapUsedId,
  );
  const dressPvpMapMapId = toPositiveNumber(
    existingSnapshot?.dressPvpMapMapId,
    mapResolution?.dressPvpMapMapId,
  );
  const existingPvpMapId = sanitizePersistedPvpMapId({
    pvpMapId: existingSnapshot?.pvpMapId,
    dressPvpMapUsedId,
    dressPvpMapMapId,
  });
  const snapshot = {
    roleId: toNonEmptyString(
      existingSnapshot?.roleId,
      selfRoleRaw?.role?.roleId,
      selfRoleRaw?.roleInfo?.roleId,
      selfRoleRaw?.role?.roleid,
      selfRoleRaw?.roleInfo?.roleid,
      tokenStoreRoleInfo?.role?.roleId,
      tokenStoreRoleInfo?.roleId,
      tokenStoreRoleInfo?.role?.roleid,
    ),
    pvpMapId: toPositiveNumber(
      existingPvpMapId,
      mapResolution?.pvpMapId,
    ),
    dressPvpMapUsedId,
    dressPvpMapMapId,
    dress: extractPvpMapDressSnapshot({
      existingDress: existingSnapshot?.dress,
      selfRoleRaw,
      tokenStoreRoleInfo,
      dressPvpMapUsedId,
    }),
  };

  if (
    !snapshot.roleId
    && !snapshot.pvpMapId
    && !snapshot.dressPvpMapUsedId
    && !snapshot.dressPvpMapMapId
    && !snapshot.dress
  ) {
    return null;
  }

  return snapshot;
};

const buildFightPvpReplayContext = ({
  existingContext = null,
  selfRoleRaw = null,
  tokenStoreRoleInfo = null,
  mapResolution = null,
} = {}) => {
  const dressPvpMapUsedId = toPositiveNumber(
    existingContext?.dressPvpMapUsedId,
    mapResolution?.dressPvpMapUsedId,
  );
  const dressPvpMapMapId = toPositiveNumber(
    existingContext?.dressPvpMapMapId,
    mapResolution?.dressPvpMapMapId,
  );
  const existingPvpMapId = sanitizePersistedPvpMapId({
    pvpMapId: existingContext?.pvpMapId,
    dressPvpMapUsedId,
    dressPvpMapMapId,
  });
  const context = {
    pvpMapId: toPositiveNumber(
      existingPvpMapId,
      mapResolution?.pvpMapId,
    ),
    dressPvpMapUsedId,
    dressPvpMapMapId,
    dress: extractPvpMapDressSnapshot({
      existingDress: existingContext?.dress,
      selfRoleRaw,
      tokenStoreRoleInfo,
      dressPvpMapUsedId,
    }),
  };

  if (
    !context.pvpMapId
    && !context.dressPvpMapUsedId
    && !context.dressPvpMapMapId
    && !context.dress
  ) {
    return null;
  }

  return context;
};

const normalizeFightPvpReplayMeta = ({
  meta = null,
  mapResolution = null,
} = {}) => {
  const nextMeta = cloneJsonValue(meta) || {};

  if (mapResolution?.diagnostics) {
    nextMeta.mapIdDiagnostics = cloneJsonValue(mapResolution.diagnostics);
  } else if (!nextMeta.mapIdDiagnostics) {
    nextMeta.mapIdDiagnostics = {
      tried: [],
      values: {},
      availableValues: {},
    };
  }

  if (mapResolution?.fixtureMapFallbackUsed) {
    nextMeta.fixtureMapFallbackUsed = true;
  }

  return nextMeta;
};

const buildFightPvpReplaySourceType = (record) => {
  if (record?.battleInputData) {
    return "battle-input-data";
  }
  if (record?.battleInputSnapshot) {
    return "battle-input-snapshot";
  }
  return "unknown";
};

export const createFightPvpReplayRecordFromBattleInput = ({
  battleInputData,
  tokenId = "",
  targetId = "",
  targetName = "",
  source = FIGHT_PVP_REPLAY_SOURCE,
  createdAt,
  leftContext = null,
  rightContext = null,
  mapId = null,
  pvpMapId = null,
  mapIdSource = null,
  pvpMapIdSource = null,
  selfRoleRaw = null,
  roleInfo = null,
  selfRoleSnapshot = null,
  context = null,
  meta = null,
  backfilledAt = null,
  mapResolution = null,
  liveContext = null,
} = {}) => {
  const runtimeInput = buildFightPvpBattleInputData(battleInputData, {
    mutate: true,
  });
  const safeBattleData = runtimeInput?.battleData;
  const normalizedBattleResult = runtimeInput?.battleResult;
  const normalizedCreatedAt = normalizeReplayTimestamp(
    createdAt
    ?? safeBattleData?.createdAt
    ?? safeBattleData?.time
    ?? safeBattleData?.battleTime,
  );
  const left = normalizeReplaySide(safeBattleData?.leftTeam, leftContext);
  const right = normalizeReplaySide(safeBattleData?.rightTeam, rightContext);
  const normalizedTargetId = toNonEmptyString(
    targetId,
    right?.roleId,
    normalizedBattleResult?.accept?.roleId,
  );
  const normalizedTargetName = toNonEmptyString(
    targetName,
    right?.name,
    normalizedBattleResult?.accept?.name,
  );
  const battleVersion = getFightPvpReplayBattleVersion(runtimeInput);
  const battleId = toNonEmptyString(safeBattleData?.id)
    || buildFallbackBattleId({
      battleData: safeBattleData,
      tokenId,
      targetId: normalizedTargetId,
      createdAt: normalizedCreatedAt,
      left,
      right,
    });
  const replayId = `${toNonEmptyString(source, FIGHT_PVP_REPLAY_SOURCE)}:${battleId}`;
  const tokenStoreRoleInfo = liveContext?.tokenStoreRoleInfo || roleInfo || null;
  const normalizedMapId = toPositiveNumber(runtimeInput?.mapId, toPositiveNumber(mapId, null));
  const normalizedPvpMapId = toPositiveNumber(
    mapResolution?.pvpMapId,
    toPositiveNumber(pvpMapId, normalizedMapId),
  );
  const normalizedMapIdSource = normalizedMapId
    ? (toNonEmptyString(mapResolution?.mapIdSource, mapIdSource) || null)
    : null;
  const normalizedPvpMapIdSource = normalizedPvpMapId
    ? (
        toNonEmptyString(
          mapResolution?.pvpMapIdSource,
          mapResolution?.mapIdSource,
          pvpMapIdSource,
          mapIdSource,
        ) || null
      )
    : null;
  const normalizedSelfRoleSnapshot = buildFightPvpReplaySelfRoleSnapshot({
    existingSnapshot: selfRoleSnapshot,
    selfRoleRaw,
    tokenStoreRoleInfo,
    mapResolution,
  });
  const normalizedContext = buildFightPvpReplayContext({
    existingContext: context,
    selfRoleRaw,
    tokenStoreRoleInfo,
    mapResolution,
  });
  const battleInputSnapshot = createFightPvpBattleInputSnapshot(runtimeInput);
  const missingRuntimeFields = getFightPvpBattleInputMissingFields(runtimeInput);
  const disabledReason = buildFightPvpBattleInputMissingMessage(missingRuntimeFields);

  return {
    replayId,
    createdAt: normalizedCreatedAt,
    tokenId: toNonEmptyString(tokenId),
    source: toNonEmptyString(source, FIGHT_PVP_REPLAY_SOURCE),
    battleVersion,
    battleId,
    battleResult: cloneJsonValue(normalizedBattleResult),
    left,
    right,
    targetId: normalizedTargetId,
    targetName: normalizedTargetName,
    mapId: normalizedMapId,
    pvpMapId: normalizedPvpMapId,
    mapIdSource: normalizedMapIdSource,
    pvpMapIdSource: normalizedPvpMapIdSource,
    selfRoleSnapshot: normalizedSelfRoleSnapshot,
    context: normalizedContext,
    backfilledAt: normalizeOptionalReplayTimestamp(backfilledAt),
    meta: normalizeFightPvpReplayMeta({
      meta,
      mapResolution,
    }),
    stageNameStr: runtimeInput?.stageNameStr || FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME,
    startTipTopName: runtimeInput?.startTipTopName || FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME,
    startTipStage: runtimeInput?.startTipStage || FIGHT_PVP_REPLAY_DEFAULT_START_TIP_STAGE,
    battleInputData: runtimeInput,
    battleInputSnapshot,
    isPlayable: missingRuntimeFields.length === 0,
    disabledReason,
    sourceType: buildFightPvpReplaySourceType({
      battleInputData: runtimeInput,
      battleInputSnapshot,
    }),
    missingRuntimeFields,
    battleInputSummary: summarizeFightPvpBattleInput(runtimeInput, {
      missingRuntimeFields,
      sourceType: "battle-input-data",
      mapIdSource: normalizedMapIdSource,
      pvpMapIdSource: normalizedPvpMapIdSource,
      fixtureMapFallbackUsed: Boolean(mapResolution?.fixtureMapFallbackUsed),
    }),
  };
};
