import {
  resolveFightPvpMapId,
  resolveFightPvpMapIdFromLiveContext,
} from "./fightPvpReplayMapIdResolver.js";

export const FIGHT_PVP_REPLAY_SOURCE = "fight-pvp-live";
export const FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME = "切磋系统";
export const FIGHT_PVP_REPLAY_DEFAULT_START_TIP_STAGE = "开始切磋";

export const toFiniteNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const toPositiveNumber = (value, fallback = null) => {
  const num = toFiniteNumber(value, fallback);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

export const toNonEmptyString = (...values) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
};

const toPlainObject = (value) =>
  value && typeof value === "object" ? value : null;

const clonePlainObject = (value) => {
  const source = toPlainObject(value);
  return source ? { ...source } : null;
};

const cloneJsonValue = (value) => {
  if (value === undefined) {
    return null;
  }
  if (value === null) {
    return null;
  }
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch {
      // Fall through to JSON clone.
    }
  }

  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return clonePlainObject(value) || value;
  }
};

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

export const getFightPvpReplayBattleVersion = (replay) =>
  toPositiveNumber(
    replay?.battleVersion,
    toPositiveNumber(replay?.battleData?.version, null),
  );

export const resolveFightPvpReplayMapId = (options = {}) =>
  resolveFightPvpMapId(options);

export const resolveFightPvpReplayRuntimeLabels = ({
  stageNameStr = "",
  startTipTopName = "",
  startTipStage = "",
  runtimeLabels = null,
} = {}) => {
  const providedLabels = toPlainObject(runtimeLabels) || {};
  const resolvedStageNameStr = toNonEmptyString(
    stageNameStr,
    providedLabels.stageNameStr,
    providedLabels.stageName,
    FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME,
  );

  return {
    stageNameStr: resolvedStageNameStr,
    startTipTopName: toNonEmptyString(
      startTipTopName,
      providedLabels.startTipTopName,
      providedLabels.topName,
      resolvedStageNameStr,
      FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME,
    ),
    startTipStage: toNonEmptyString(
      startTipStage,
      providedLabels.startTipStage,
      providedLabels.stageAction,
      FIGHT_PVP_REPLAY_DEFAULT_START_TIP_STAGE,
    ),
  };
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
      existingSnapshot?.pvpMapId,
      toPositiveNumber(
        selfRoleRaw?.role?.pvpMapId,
        toPositiveNumber(
          selfRoleRaw?.roleInfo?.pvpMapId,
          toPositiveNumber(
            tokenStoreRoleInfo?.role?.pvpMapId,
            toPositiveNumber(
              tokenStoreRoleInfo?.pvpMapId,
              mapResolution?.pvpMapId,
            ),
          ),
        ),
      ),
    ),
    dressPvpMapUsedId: toPositiveNumber(
      existingSnapshot?.dressPvpMapUsedId,
      mapResolution?.dressPvpMapUsedId,
    ),
    dressPvpMapMapId: toPositiveNumber(
      existingSnapshot?.dressPvpMapMapId,
      mapResolution?.dressPvpMapMapId,
    ),
  };

  if (
    !snapshot.roleId
    && !snapshot.pvpMapId
    && !snapshot.dressPvpMapUsedId
    && !snapshot.dressPvpMapMapId
  ) {
    return null;
  }

  return snapshot;
};

const buildFightPvpReplayContext = ({
  existingContext = null,
  mapResolution = null,
} = {}) => {
  const context = {
    pvpMapId: toPositiveNumber(
      existingContext?.pvpMapId,
      mapResolution?.pvpMapId,
    ),
    dressPvpMapUsedId: toPositiveNumber(
      existingContext?.dressPvpMapUsedId,
      mapResolution?.dressPvpMapUsedId,
    ),
    dressPvpMapMapId: toPositiveNumber(
      existingContext?.dressPvpMapMapId,
      mapResolution?.dressPvpMapMapId,
    ),
  };

  if (!context.pvpMapId && !context.dressPvpMapUsedId && !context.dressPvpMapMapId) {
    return null;
  }

  return context;
};

const normalizeFightPvpReplayMeta = ({
  meta = null,
  mapResolution = null,
} = {}) => {
  const nextMeta = {
    ...(cloneJsonValue(meta) || {}),
    mapIdDiagnostics: cloneJsonValue(mapResolution?.diagnostics) || {
      tried: [],
      values: {},
      availableValues: {},
    },
  };

  if (mapResolution?.fixtureMapFallbackUsed) {
    nextMeta.fixtureMapFallbackUsed = true;
  }

  return nextMeta;
};

export function normalizeFightPvpReplayPayload({
  battleData,
  battleResult,
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
  stageNameStr = "",
  startTipTopName = "",
  startTipStage = "",
  runtimeLabels = null,
  runtimeOptionsSnapshot = null,
  mapResolution = null,
  liveContext = null,
} = {}) {
  const safeBattleData = toPlainObject(battleData);
  const normalizedCreatedAt = normalizeReplayTimestamp(
    createdAt
    ?? safeBattleData?.createdAt
    ?? safeBattleData?.time
    ?? safeBattleData?.battleTime,
  );

  const normalizedBattleResult = toPlainObject(battleResult)
    || toPlainObject(safeBattleData?.result);
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
  const battleVersion = getFightPvpReplayBattleVersion({
    battleVersion: safeBattleData?.version,
    battleData: safeBattleData,
  });
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
  const resolvedRuntimeLabels = resolveFightPvpReplayRuntimeLabels({
    stageNameStr,
    startTipTopName,
    startTipStage,
    runtimeLabels,
  });
  const tokenStoreRoleInfo = liveContext?.tokenStoreRoleInfo || roleInfo || null;
  const resolvedMapId = mapResolution?.ok !== undefined
    ? mapResolution
    : (
        selfRoleRaw || tokenStoreRoleInfo
          ? resolveFightPvpMapIdFromLiveContext({
              mapId,
              pvpMapId,
              selfRoleRaw,
              tokenStoreRoleInfo,
              liveContext,
            })
          : resolveFightPvpMapId({
              replay: {
                source,
                battleData: safeBattleData,
                mapId,
                pvpMapId,
                mapIdSource,
                pvpMapIdSource,
                meta,
                context,
                selfRoleSnapshot,
              },
              liveContext,
            })
      );
  const normalizedSelfRoleSnapshot = buildFightPvpReplaySelfRoleSnapshot({
    existingSnapshot: selfRoleSnapshot,
    selfRoleRaw,
    tokenStoreRoleInfo,
    mapResolution: resolvedMapId,
  });
  const normalizedContext = buildFightPvpReplayContext({
    existingContext: context,
    mapResolution: resolvedMapId,
  });

  return {
    replayId,
    createdAt: normalizedCreatedAt,
    tokenId: toNonEmptyString(tokenId),
    source: toNonEmptyString(source, FIGHT_PVP_REPLAY_SOURCE),
    battleVersion,
    battleId,
    battleData: safeBattleData,
    battleResult: normalizedBattleResult,
    left,
    right,
    targetId: normalizedTargetId,
    targetName: normalizedTargetName,
    mapId: resolvedMapId.mapId,
    pvpMapId: resolvedMapId.pvpMapId,
    mapIdSource: toNonEmptyString(resolvedMapId.mapIdSource, mapIdSource) || null,
    pvpMapIdSource: toNonEmptyString(resolvedMapId.pvpMapIdSource, pvpMapIdSource) || null,
    selfRoleSnapshot: normalizedSelfRoleSnapshot,
    context: normalizedContext,
    backfilledAt: normalizeOptionalReplayTimestamp(backfilledAt),
    meta: normalizeFightPvpReplayMeta({
      meta,
      mapResolution: resolvedMapId,
    }),
    stageNameStr: resolvedRuntimeLabels.stageNameStr,
    startTipTopName: resolvedRuntimeLabels.startTipTopName,
    startTipStage: resolvedRuntimeLabels.startTipStage,
    runtimeOptionsSnapshot: resolveFightPvpReplayRuntimeOptionsSnapshot({
      runtimeOptionsSnapshot,
      targetId: normalizedTargetId,
      targetName: normalizedTargetName,
      right,
    }),
  };
}
