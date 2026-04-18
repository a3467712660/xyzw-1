const normalizeTowerId = (towerId = 0) => {
  const normalized = Number(towerId);
  if (!Number.isFinite(normalized) || normalized < 0) {
    return 0;
  }
  return Math.floor(normalized);
};

const getWeirdTowerState = (towerInfo = null) => {
  if (towerInfo?.evoTower) {
    return towerInfo.evoTower;
  }
  return towerInfo || {};
};

const waitForDelay = (delayMs) =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export const getWeirdTowerFightFloor = (preFightTowerId = 0) => {
  return (normalizeTowerId(preFightTowerId) % 10) + 1;
};

export const getWeirdTowerClearedChapter = (preFightTowerId = 0) => {
  return Math.floor(normalizeTowerId(preFightTowerId) / 10) + 1;
};

export const getWeirdTowerCompletedChapter = (towerId = 0) => {
  return Math.floor(normalizeTowerId(towerId) / 10);
};

export const didWeirdTowerFightWin = (fightResult) => {
  if (fightResult?.winList?.[0] === true) {
    return true;
  }
  if (fightResult?.battleData?.result?.isWin === true) {
    return true;
  }
  if (fightResult?.result?.isWin === true) {
    return true;
  }

  const acceptCurHp = fightResult?.battleData?.result?.accept?.ext?.curHP;
  if (typeof acceptCurHp === "number") {
    return acceptCurHp <= 0;
  }

  return false;
};

export const resolveWeirdTowerChapterReward = ({
  fightResult,
  preFightTowerId = 0,
} = {}) => {
  const didWin = didWeirdTowerFightWin(fightResult);
  if (!didWin || getWeirdTowerFightFloor(preFightTowerId) !== 10) {
    return {
      chapter: null,
      shouldClaim: false,
    };
  }

  return {
    chapter: getWeirdTowerClearedChapter(preFightTowerId),
    shouldClaim: true,
  };
};

export const resolveWeirdTowerPendingRewardChapter = ({
  rewardTowerId = 0,
  towerId = 0,
} = {}) => {
  const completedChapter = getWeirdTowerCompletedChapter(towerId);
  const claimedChapter = normalizeTowerId(rewardTowerId);

  if (completedChapter <= 0 || claimedChapter >= completedChapter) {
    return null;
  }

  return completedChapter;
};

export const isWeirdTowerRewardClaimed = (
  towerInfo = null,
  chapter = 0,
) => {
  const targetChapter = normalizeTowerId(chapter);
  if (targetChapter <= 0) {
    return false;
  }

  return normalizeTowerId(getWeirdTowerState(towerInfo)?.rewardTowerId) >= targetChapter;
};

export const isWeirdTowerRewardClaimRetryable = (error) => {
  const errorMessage = error?.message || "";
  return errorMessage.includes("12200020");
};

export const claimWeirdTowerChapterReward = async ({
  chapter,
  getTowerInfo,
  claimReward,
  wait = waitForDelay,
  maxAttempts = 6,
} = {}) => {
  const targetChapter = normalizeTowerId(chapter);

  if (targetChapter <= 0) {
    return null;
  }
  if (typeof getTowerInfo !== "function" || typeof claimReward !== "function") {
    throw new TypeError("claimWeirdTowerChapterReward requires getTowerInfo and claimReward");
  }

  let lastError = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const latestTowerInfo = await getTowerInfo().catch(() => null);
    if (isWeirdTowerRewardClaimed(latestTowerInfo, targetChapter)) {
      return targetChapter;
    }

    const pendingChapter = resolveWeirdTowerPendingRewardChapter(
      getWeirdTowerState(latestTowerInfo),
    );

    if (pendingChapter == null || pendingChapter < targetChapter) {
      await wait(300);
      continue;
    }

    try {
      const claimResult = await claimReward();
      if (isWeirdTowerRewardClaimed(claimResult, targetChapter)) {
        return targetChapter;
      }
      lastError = null;
    } catch (error) {
      lastError = error;
      const refreshedTowerInfo = await getTowerInfo().catch(() => null);
      if (isWeirdTowerRewardClaimed(refreshedTowerInfo, targetChapter)) {
        return targetChapter;
      }

      const refreshedPendingChapter = resolveWeirdTowerPendingRewardChapter(
        getWeirdTowerState(refreshedTowerInfo),
      );

      if (
        !isWeirdTowerRewardClaimRetryable(error)
        && (refreshedPendingChapter == null || refreshedPendingChapter < targetChapter)
      ) {
        throw error;
      }
    }

    await wait(150);
  }

  if (lastError) {
    throw lastError;
  }

  throw new Error(`怪异塔章节奖励领取超时: 第${targetChapter}章`);
};
