export const FIGHT_PVP_REPLAY_SOURCE = "fight-pvp-live";

const toFiniteNumber = (value, fallback = null) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toPositiveNumber = (value, fallback = null) => {
  const num = toFiniteNumber(value, fallback);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

const toNonEmptyString = (...values) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
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

const normalizeReplaySide = (side, fallback = {}) => {
  const merged = {
    ...(fallback && typeof fallback === "object" ? fallback : null),
    ...(side && typeof side === "object" ? side : null),
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

export function normalizeFightPvpReplayPayload({
  battleData,
  tokenId = "",
  targetId = "",
  targetName = "",
  source = FIGHT_PVP_REPLAY_SOURCE,
  createdAt,
  leftContext = null,
  rightContext = null,
} = {}) {
  const safeBattleData = battleData && typeof battleData === "object"
    ? battleData
    : null;
  const normalizedCreatedAt = normalizeReplayTimestamp(
    createdAt
    ?? safeBattleData?.createdAt
    ?? safeBattleData?.time
    ?? safeBattleData?.battleTime,
  );

  const battleResult = safeBattleData?.result && typeof safeBattleData.result === "object"
    ? safeBattleData.result
    : null;
  const left = normalizeReplaySide(safeBattleData?.leftTeam, leftContext);
  const right = normalizeReplaySide(safeBattleData?.rightTeam, rightContext);
  const normalizedTargetId = toNonEmptyString(
    targetId,
    right?.roleId,
    battleResult?.accept?.roleId,
  );
  const normalizedTargetName = toNonEmptyString(
    targetName,
    right?.name,
    battleResult?.accept?.name,
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

  return {
    replayId,
    createdAt: normalizedCreatedAt,
    tokenId: toNonEmptyString(tokenId),
    source: toNonEmptyString(source, FIGHT_PVP_REPLAY_SOURCE),
    battleVersion,
    battleId,
    battleData: safeBattleData,
    battleResult,
    left,
    right,
    targetId: normalizedTargetId,
    targetName: normalizedTargetName,
  };
}
