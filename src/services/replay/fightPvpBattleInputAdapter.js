import {
  buildFightPvpBattleInputData,
  buildFightPvpBattleInputMissingMessage,
  getFightPvpBattleInputMissingFields,
  resolveFightPvpReplayRuntimeLabels,
  summarizeFightPvpBattleInput,
} from "./fightPvpBattleInputSnapshot.js";
import {
  createFightPvpReplayRecordFromBattleInput,
  FIGHT_PVP_REPLAY_SOURCE,
  resolveFightPvpReplayRuntimeOptionsSnapshot,
} from "./fightPvpReplayNormalizer.js";
import {
  explainFightPvpMapIdResolution,
  resolveFightPvpMapIdFromReplay,
} from "./fightPvpReplayMapIdResolver.js";

export const isLegacyFightPvpReplayPayload = (value) =>
  Boolean(
    value
    && typeof value === "object"
    && !value.battleInputData
    && !value.battleInputSnapshot
    && value.battleData,
  );

const buildLegacyRuntimeOptionsMap = (legacyReplay) => {
  const snapshot = resolveFightPvpReplayRuntimeOptionsSnapshot({
    runtimeOptionsSnapshot: legacyReplay?.runtimeOptionsSnapshot,
    targetId: legacyReplay?.targetId,
    targetName: legacyReplay?.targetName,
    right: legacyReplay?.right,
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

  return options;
};

export const convertLegacyFightPvpReplayPayload = (
  legacyReplay,
  { liveContext = null } = {},
) => {
  if (!isLegacyFightPvpReplayPayload(legacyReplay)) {
    return {
      ok: false,
      record: null,
      message: "旧回放记录不包含可迁移的 battleData。",
      missingRuntimeFields: ["battleData"],
      mapIdResolution: null,
      resolutionExplanation: null,
    };
  }

  const mapIdResolution = resolveFightPvpMapIdFromReplay({
    replay: legacyReplay,
    liveContext,
  });
  const runtimeLabels = resolveFightPvpReplayRuntimeLabels({
    stageNameStr: legacyReplay?.stageNameStr,
    startTipTopName: legacyReplay?.startTipTopName,
    startTipStage: legacyReplay?.startTipStage,
  });
  const battleInputData = buildFightPvpBattleInputData({
    battleData: legacyReplay?.battleData,
    battleResult: legacyReplay?.battleResult,
    mapId: mapIdResolution.mapId,
    stageNameStr: runtimeLabels.stageNameStr,
    startTipTopName: runtimeLabels.startTipTopName,
    startTipStage: runtimeLabels.startTipStage,
    options: buildLegacyRuntimeOptionsMap(legacyReplay),
  });

  const record = createFightPvpReplayRecordFromBattleInput({
    battleInputData,
    tokenId: legacyReplay?.tokenId,
    targetId: legacyReplay?.targetId,
    targetName: legacyReplay?.targetName,
    createdAt: legacyReplay?.createdAt,
    source: legacyReplay?.source || FIGHT_PVP_REPLAY_SOURCE,
    leftContext: legacyReplay?.left,
    rightContext: legacyReplay?.right,
    mapId: legacyReplay?.mapId,
    pvpMapId: legacyReplay?.pvpMapId,
    mapIdSource: legacyReplay?.mapIdSource,
    pvpMapIdSource: legacyReplay?.pvpMapIdSource,
    selfRoleSnapshot: legacyReplay?.selfRoleSnapshot,
    context: legacyReplay?.context,
    meta: legacyReplay?.meta,
    backfilledAt:
      !legacyReplay?.mapId && mapIdResolution?.ok
        ? new Date().toISOString()
        : legacyReplay?.backfilledAt,
    mapResolution: mapIdResolution,
    liveContext,
  });
  const resolutionExplanation = explainFightPvpMapIdResolution({
    replay: legacyReplay,
    liveContext,
  });

  return {
    ok: Boolean(record?.isPlayable),
    record: record
      ? {
          ...record,
          battleInputData: null,
          sourceType: "legacy-payload",
          battleInputSummary: summarizeFightPvpBattleInput(battleInputData, {
            missingRuntimeFields: record?.missingRuntimeFields || [],
            sourceType: "legacy-payload",
            mapIdSource: record?.mapIdSource,
            pvpMapIdSource: record?.pvpMapIdSource,
            fixtureMapFallbackUsed: Boolean(mapIdResolution?.fixtureMapFallbackUsed),
          }),
        }
      : null,
    message:
      record?.disabledReason
      || buildFightPvpBattleInputMissingMessage(
        getFightPvpBattleInputMissingFields(battleInputData),
      ),
    missingRuntimeFields: record?.missingRuntimeFields
      || getFightPvpBattleInputMissingFields(battleInputData),
    mapIdResolution,
    resolutionExplanation,
  };
};
