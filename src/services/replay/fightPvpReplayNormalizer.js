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

export const resolveFightPvpReplayMapId = ({
  mapId,
  battleData,
  selfRoleRaw,
  roleInfo,
  leftContext,
} = {}) =>
  toPositiveNumber(
    mapId,
    toPositiveNumber(
      battleData?.mapId,
      toPositiveNumber(
        selfRoleRaw?.role?.pvpMapId,
        toPositiveNumber(
          selfRoleRaw?.roleInfo?.pvpMapId,
          toPositiveNumber(
            roleInfo?.role?.pvpMapId,
            toPositiveNumber(
              roleInfo?.pvpMapId,
              toPositiveNumber(
                leftContext?.role?.pvpMapId,
                toPositiveNumber(
                  leftContext?.roleInfo?.pvpMapId,
                  toPositiveNumber(leftContext?.pvpMapId, null),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );

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
  selfRoleRaw = null,
  roleInfo = null,
  stageNameStr = "",
  startTipTopName = "",
  startTipStage = "",
  runtimeLabels = null,
  runtimeOptionsSnapshot = null,
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
    mapId: resolveFightPvpReplayMapId({
      mapId,
      battleData: safeBattleData,
      selfRoleRaw,
      roleInfo,
      leftContext,
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
