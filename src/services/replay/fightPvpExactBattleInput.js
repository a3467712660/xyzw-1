export const FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME = "切磋系统";
export const FIGHT_PVP_REPLAY_DEFAULT_START_TIP_STAGE = "开始切磋";

export const toPlainObject = (value) =>
  value && typeof value === "object" ? value : null;

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

export const cloneJsonValue = (value) => {
  if (value === undefined || value === null) {
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
    if (Array.isArray(value)) {
      return value.slice();
    }
    if (value && typeof value === "object") {
      return { ...value };
    }
    return value;
  }
};

const isMapEntriesArray = (value) =>
  Array.isArray(value)
  && value.every(
    (item) => Array.isArray(item) && item.length >= 2,
  );

const normalizeOptionsEntries = (options) => {
  if (options instanceof Map) {
    return [...options.entries()].map(([key, value]) => [key, cloneJsonValue(value)]);
  }

  if (isMapEntriesArray(options)) {
    return options.map(([key, value]) => [key, cloneJsonValue(value)]);
  }

  if (options && typeof options === "object") {
    return Object.entries(options).map(([key, value]) => [key, cloneJsonValue(value)]);
  }

  return [];
};

export const restoreFightPvpBattleInputOptionsMap = (options) =>
  new Map(normalizeOptionsEntries(options));

export const createFightPvpReplaySafeBattleEnd = () => (
  battleInput,
  battleResult,
  uiProxy,
) => {
  try {
    uiProxy?.close?.();
  } catch (error) {
    console.warn("[FightPvp replay battleEnd]", error);
  }

  return {
    replayOnly: true,
    battleVersion: getFightPvpReplayBattleVersion(battleInput),
    isWin: battleResult?.isWin ?? battleInput?.battleResult?.isWin ?? null,
  };
};

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

export const createFightPvpExactBattleInput = (
  input,
  {
    battleEnd = null,
    mutate = false,
  } = {},
) => {
  const source = toPlainObject(input) || {};
  const target = mutate ? source : { ...source };
  const battleData = toPlainObject(target.battleData);
  const battleResult = toPlainObject(target.battleResult)
    || toPlainObject(battleData?.result);
  const runtimeLabels = resolveFightPvpReplayRuntimeLabels({
    stageNameStr: target.stageNameStr,
    startTipTopName: target.startTipTopName,
    startTipStage: target.startTipStage,
  });

  target.battleData = battleData;
  target.battleResult = battleResult;
  target.mapId = toPositiveNumber(target.mapId, null);
  target.mapIdSource = toNonEmptyString(target.mapIdSource) || null;
  target.mapIdResolveReason = toNonEmptyString(target.mapIdResolveReason) || null;
  target.runtimeRoleAvailable = typeof target.runtimeRoleAvailable === "boolean"
    ? target.runtimeRoleAvailable
    : null;
  target.runtimeRolePath = toNonEmptyString(target.runtimeRolePath) || null;
  target.stageNameStr = runtimeLabels.stageNameStr;
  target.startTipTopName = runtimeLabels.startTipTopName;
  target.startTipStage = runtimeLabels.startTipStage;

  if (target.options instanceof Map) {
    if (!mutate) {
      target.options = new Map(target.options);
    }
  } else {
    target.options = restoreFightPvpBattleInputOptionsMap(target.options);
  }

  if (typeof target.battleEnd !== "function") {
    target.battleEnd = typeof battleEnd === "function"
      ? battleEnd
      : createFightPvpReplaySafeBattleEnd();
  }

  return target;
};

export const buildFightPvpBattleInputData = createFightPvpExactBattleInput;

export const serializeFightPvpBattleInputSnapshot = (
  battleInput,
  {
    metadata = null,
    diagnostics = null,
  } = {},
) => {
  const runtimeInput = createFightPvpExactBattleInput(battleInput);
  if (!runtimeInput?.battleData) {
    return null;
  }

  return {
    battleData: cloneJsonValue(runtimeInput.battleData),
    battleResult: cloneJsonValue(runtimeInput.battleResult),
    mapId: toPositiveNumber(runtimeInput.mapId, null),
    mapIdSource: toNonEmptyString(runtimeInput.mapIdSource) || null,
    mapIdResolveReason: toNonEmptyString(runtimeInput.mapIdResolveReason) || null,
    runtimeRoleAvailable: typeof runtimeInput.runtimeRoleAvailable === "boolean"
      ? runtimeInput.runtimeRoleAvailable
      : null,
    runtimeRolePath: toNonEmptyString(runtimeInput.runtimeRolePath) || null,
    stageNameStr: runtimeInput.stageNameStr,
    startTipTopName: runtimeInput.startTipTopName,
    startTipStage: runtimeInput.startTipStage,
    optionsEntries: normalizeOptionsEntries(runtimeInput.options),
    battleVersion: getFightPvpReplayBattleVersion(runtimeInput),
    metadata: cloneJsonValue(metadata),
    diagnostics: cloneJsonValue(diagnostics),
  };
};

export const createFightPvpBattleInputSnapshot = serializeFightPvpBattleInputSnapshot;

export const rehydrateFightPvpBattleInputSnapshot = (
  snapshot,
  { battleEnd = null } = {},
) => {
  const source = toPlainObject(snapshot);
  if (!source?.battleData) {
    return null;
  }

  return createFightPvpExactBattleInput({
    battleData: cloneJsonValue(source.battleData),
    battleResult: cloneJsonValue(source.battleResult),
    mapId: source.mapId,
    mapIdSource: source.mapIdSource,
    mapIdResolveReason: source.mapIdResolveReason,
    runtimeRoleAvailable: typeof source.runtimeRoleAvailable === "boolean"
      ? source.runtimeRoleAvailable
      : null,
    runtimeRolePath: source.runtimeRolePath,
    stageNameStr: source.stageNameStr,
    startTipTopName: source.startTipTopName,
    startTipStage: source.startTipStage,
    options: source.optionsEntries,
    battleEnd,
  });
};

const getCollectionSize = (collection) => {
  if (Array.isArray(collection)) {
    return collection.length;
  }
  if (collection && typeof collection === "object") {
    return Object.keys(collection).length;
  }
  return 0;
};

export const getFightPvpReplayBattleVersion = (value) =>
  toPositiveNumber(
    value?.battleVersion,
    toPositiveNumber(
      value?.battleInputSnapshot?.battleVersion,
      toPositiveNumber(
        value?.exactBattleInputData?.battleData?.version,
        toPositiveNumber(
          value?.battleInputData?.battleData?.version,
          toPositiveNumber(
            value?.battleData?.version,
            toPositiveNumber(
              value?.battleResult?.battleVersion,
              null,
            ),
          ),
        ),
      ),
    ),
  );

export const getFightPvpBattleInputMissingFields = (battleInput) => {
  const missingRuntimeFields = [];

  if (!battleInput?.battleData) {
    missingRuntimeFields.push("battleData");
  }
  if (!battleInput?.battleResult) {
    missingRuntimeFields.push("battleResult");
  }
  if (!Number.isFinite(Number(battleInput?.mapId)) || Number(battleInput.mapId) <= 0) {
    missingRuntimeFields.push("mapId");
  }
  if (!Number.isFinite(Number(battleInput?.battleData?.mode))) {
    missingRuntimeFields.push("battleData.mode");
  }

  return missingRuntimeFields;
};

export const buildFightPvpBattleInputMissingMessage = (missingRuntimeFields = []) => {
  if (!Array.isArray(missingRuntimeFields) || missingRuntimeFields.length === 0) {
    return "";
  }

  return missingRuntimeFields.includes("mapId")
    ? `无法确定本场切磋地图，当前回放无法播放。缺少字段：${missingRuntimeFields.join(", ")}。`
    : `该历史回放缺少必要字段，当前无法播放。缺少字段：${missingRuntimeFields.join(", ")}。`;
};

export const summarizeFightPvpBattleInput = (
  battleInput,
  {
    missingRuntimeFields = [],
    sourceType = null,
    battleInputSource = null,
    mapIdSource = null,
    pvpMapIdSource = null,
    fixtureMapFallbackUsed = false,
    runtimeRoleMapId = null,
    runtimeRoleAvailable = null,
    runtimeRolePath = null,
    mapIdResolveReason = null,
    engineReplayEntrypoint = null,
  } = {},
) => ({
  battleVersion: getFightPvpReplayBattleVersion(battleInput),
  mapId: battleInput?.mapId ?? null,
  battleMode: toFiniteNumber(battleInput?.battleData?.mode, null),
  stageNameStr: toNonEmptyString(
    battleInput?.stageNameStr,
    FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME,
  ),
  startTipTopName: toNonEmptyString(
    battleInput?.startTipTopName,
    FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME,
  ),
  startTipStage: toNonEmptyString(
    battleInput?.startTipStage,
    FIGHT_PVP_REPLAY_DEFAULT_START_TIP_STAGE,
  ),
  leftTeamSize: getCollectionSize(battleInput?.battleData?.leftTeam?.team),
  rightTeamSize: getCollectionSize(battleInput?.battleData?.rightTeam?.team),
  hasTargetRole: Boolean(battleInput?.options?.get?.("targetRole")),
  selfScore: toFiniteNumber(battleInput?.options?.get?.("selfScore"), null),
  oppoScore: toFiniteNumber(battleInput?.options?.get?.("oppoScore"), null),
  optionsKeys: battleInput?.options instanceof Map
    ? [...battleInput.options.keys()].map((key) => String(key))
    : [],
  sourceType: toNonEmptyString(sourceType) || null,
  battleInputSource: toNonEmptyString(battleInputSource, sourceType) || null,
  mapIdSource: toNonEmptyString(mapIdSource) || null,
  pvpMapIdSource: toNonEmptyString(pvpMapIdSource) || null,
  mapIdResolveReason: toNonEmptyString(
    mapIdResolveReason,
    battleInput?.mapIdResolveReason,
  ) || null,
  fixtureMapFallbackUsed: Boolean(fixtureMapFallbackUsed),
  runtimeRoleMapId: toPositiveNumber(runtimeRoleMapId, null),
  runtimeRoleAvailable: typeof runtimeRoleAvailable === "boolean"
    ? runtimeRoleAvailable
    : (
        typeof battleInput?.runtimeRoleAvailable === "boolean"
          ? battleInput.runtimeRoleAvailable
          : null
      ),
  runtimeRolePath: toNonEmptyString(
    runtimeRolePath,
    battleInput?.runtimeRolePath,
  ) || null,
  engineReplayEntrypoint: toNonEmptyString(engineReplayEntrypoint) || null,
  missingRuntimeFields: [...missingRuntimeFields],
});
