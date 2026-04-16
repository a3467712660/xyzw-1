import {
  FIGHT_PVP_REPLAY_DEFAULT_STAGE_NAME,
  FIGHT_PVP_REPLAY_DEFAULT_START_TIP_STAGE,
  getFightPvpReplayBattleVersion,
  resolveFightPvpReplayMapId,
  resolveFightPvpReplayRuntimeLabels,
  resolveFightPvpReplayRuntimeOptionsSnapshot,
  toFiniteNumber,
  toNonEmptyString,
} from "./fightPvpReplayNormalizer.js";

const cloneBattleTeamMember = (member) =>
  member && typeof member === "object" ? { ...member } : member;

const normalizeBattleTeamCollection = (collection) => {
  if (Array.isArray(collection)) {
    return collection.map(cloneBattleTeamMember);
  }

  if (collection && typeof collection === "object") {
    return Object.values(collection).map(cloneBattleTeamMember);
  }

  return [];
};

const normalizeBattleSideForRuntime = (side) => {
  const source = side && typeof side === "object" ? side : {};
  return {
    ...source,
    team: normalizeBattleTeamCollection(source.team),
  };
};

const normalizeBattleDataForRuntime = (battleData, battleResult) => {
  const source = battleData && typeof battleData === "object" ? battleData : null;
  if (!source) {
    return null;
  }

  return {
    ...source,
    leftTeam: normalizeBattleSideForRuntime(source.leftTeam),
    rightTeam: normalizeBattleSideForRuntime(source.rightTeam),
    result:
      (battleResult && typeof battleResult === "object" ? battleResult : null)
      || source.result
      || null,
  };
};

const createReplaySafeBattleEnd = () => (battleInput, battleResult, uiProxy) => {
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

const buildRuntimeOptionsMap = ({ replay, modules } = {}) => {
  const snapshot = resolveFightPvpReplayRuntimeOptionsSnapshot({
    runtimeOptionsSnapshot: replay?.runtimeOptionsSnapshot,
    targetId: replay?.targetId,
    targetName: replay?.targetName,
    right: replay?.right,
  });
  const options = new Map();

  if (snapshot.targetRole) {
    options.set("targetRole", snapshot.targetRole);
  }
  if (snapshot.selfScore !== null) {
    options.set("selfScore", snapshot.selfScore);
  }
  if (snapshot.oppoScore !== null) {
    options.set("oppoScore", snapshot.oppoScore);
  }

  const replayFlagKeys = [
    modules?.consts?.ModelConst?.BATTLE_REPLAY,
    "BATTLE_REPLAY",
    "battleReplay",
    "isReplay",
  ].filter((value) => value !== null && value !== undefined && value !== "");

  for (const key of replayFlagKeys) {
    options.set(key, snapshot.replayFlag);
  }

  return options;
};

export const summarizeFightPvpReplayBattleInput = (
  battleInput,
  { missingRuntimeFields = [] } = {},
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
  leftTeamSize: Array.isArray(battleInput?.battleData?.leftTeam?.team)
    ? battleInput.battleData.leftTeam.team.length
    : 0,
  rightTeamSize: Array.isArray(battleInput?.battleData?.rightTeam?.team)
    ? battleInput.battleData.rightTeam.team.length
    : 0,
  hasTargetRole: Boolean(battleInput?.options?.get?.("targetRole")),
  selfScore: toFiniteNumber(battleInput?.options?.get?.("selfScore"), null),
  oppoScore: toFiniteNumber(battleInput?.options?.get?.("oppoScore"), null),
  missingRuntimeFields: [...missingRuntimeFields],
});

export const buildFightPvpReplayBattleInput = (
  replay,
  { modules } = {},
) => {
  const battleResult = (
    replay?.battleResult && typeof replay.battleResult === "object"
      ? replay.battleResult
      : replay?.battleData?.result
  ) || null;
  const battleData = normalizeBattleDataForRuntime(replay?.battleData, battleResult);
  const runtimeLabels = resolveFightPvpReplayRuntimeLabels({
    stageNameStr: replay?.stageNameStr,
    startTipTopName: replay?.startTipTopName,
    startTipStage: replay?.startTipStage,
  });
  const battleInput = {
    battleData,
    battleResult,
    mapId: resolveFightPvpReplayMapId({
      mapId: replay?.mapId,
      battleData,
      selfRoleRaw: replay?.selfRoleRaw,
      roleInfo: replay?.roleInfo,
      leftContext: replay?.left,
    }),
    stageNameStr: runtimeLabels.stageNameStr,
    startTipTopName: runtimeLabels.startTipTopName,
    startTipStage: runtimeLabels.startTipStage,
    battleEnd: createReplaySafeBattleEnd(),
    options: buildRuntimeOptionsMap({ replay, modules }),
  };

  const missingRuntimeFields = [];
  if (!battleInput.battleData) {
    missingRuntimeFields.push("battleData");
  }
  if (!battleInput.battleResult) {
    missingRuntimeFields.push("battleResult");
  }
  if (!Number.isFinite(Number(battleInput.mapId)) || Number(battleInput.mapId) <= 0) {
    missingRuntimeFields.push("mapId");
  }
  if (!Number.isFinite(Number(battleInput?.battleData?.mode))) {
    missingRuntimeFields.push("battleData.mode");
  }

  const replayInputSummary = summarizeFightPvpReplayBattleInput(battleInput, {
    missingRuntimeFields,
  });

  return {
    ok: missingRuntimeFields.length === 0,
    battleInput,
    missingRuntimeFields,
    replayInputSummary,
    message:
      missingRuntimeFields.length > 0
        ? `回放缺少 runtime 必需字段：${missingRuntimeFields.join(", ")}。`
        : "",
  };
};
