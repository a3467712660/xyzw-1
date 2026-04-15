import { getFightPvpReplayBattleVersion } from "./fightPvpReplayNormalizer.js";

const toPositiveNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : null;
};

export const FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS = {
  EMPTY_REPLAY: "empty-replay",
  MISSING_REPLAY_VERSION: "missing-replay-version",
  MISSING_SELECTED_TOKEN: "missing-selected-token",
  VERSION_UNAVAILABLE: "version-unavailable",
  VERSION_MISMATCH: "version-mismatch",
  OK: "ok",
};

export async function guardFightPvpReplayVersion({
  replay,
  tokenStore,
  selectedToken,
} = {}) {
  const replayBattleVersion = getFightPvpReplayBattleVersion(replay);
  if (!replay || typeof replay !== "object") {
    return {
      ok: false,
      reason: FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.EMPTY_REPLAY,
      currentBattleVersion: null,
      replayBattleVersion,
      message: "回放数据为空，无法开始回放。",
    };
  }

  if (!replayBattleVersion) {
    return {
      ok: false,
      reason: FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.MISSING_REPLAY_VERSION,
      currentBattleVersion: null,
      replayBattleVersion,
      message: "该回放缺少 battleVersion，当前无法校验兼容性。",
    };
  }

  let currentBattleVersion = toPositiveNumber(
    tokenStore?.getBattleVersion?.(),
  );
  const selectedTokenId = String(selectedToken?.id || "").trim();

  if (!currentBattleVersion && selectedTokenId) {
    try {
      currentBattleVersion = toPositiveNumber(
        await tokenStore?.ensureBattleVersion?.(selectedTokenId),
      );
    } catch (error) {
      return {
        ok: false,
        reason: FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.VERSION_UNAVAILABLE,
        currentBattleVersion,
        replayBattleVersion,
        message: error?.message || "无法获取当前 battleVersion。",
      };
    }
  }

  if (!currentBattleVersion && !selectedTokenId) {
    return {
      ok: false,
      reason: FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.MISSING_SELECTED_TOKEN,
      currentBattleVersion,
      replayBattleVersion,
      message: "当前未选择角色，无法校验回放版本。",
    };
  }

  if (!currentBattleVersion) {
    return {
      ok: false,
      reason: FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.VERSION_UNAVAILABLE,
      currentBattleVersion,
      replayBattleVersion,
      message: "未能获取当前角色的 battleVersion。",
    };
  }

  if (currentBattleVersion !== replayBattleVersion) {
    return {
      ok: false,
      reason: FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.VERSION_MISMATCH,
      currentBattleVersion,
      replayBattleVersion,
      message: `当前 battleVersion 为 ${currentBattleVersion}，回放版本为 ${replayBattleVersion}，版本不一致，无法播放该回放。`,
    };
  }

  return {
    ok: true,
    reason: FIGHT_PVP_REPLAY_VERSION_GUARD_REASONS.OK,
    currentBattleVersion,
    replayBattleVersion,
    message: "",
  };
}
