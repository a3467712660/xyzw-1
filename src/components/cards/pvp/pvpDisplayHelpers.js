import { legacycolor, LINEUP_RULES } from "../../../utils/HeroList.js";

export const resolveFightPvpLineupTagColor = (
  lineupType,
  lineupRules = LINEUP_RULES,
) => {
  const rule = (lineupRules || []).find((item) => item.name === lineupType);
  return rule?.colorProps || { color: "#595959", textColor: "#fff" };
};

export const resolveFightPvpLegacyBadge = (
  legacy,
  legacyColorMap = legacycolor,
  fallbackText = "未知",
) => ({
  color: legacyColorMap?.[legacy]?.value || "",
  text: legacyColorMap?.[legacy]?.name || fallbackText,
});

export const getFightPvpAvatarText = (name, maxLength = 2) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    return "?";
  }
  return normalizedName.substring(0, maxLength) || "?";
};

export const buildFightPvpResultSummary = (fightNum, fightResult = {}) => {
  const total = Math.max(Number(fightNum) || 0, 0);
  const winCount = Math.max(Number(fightResult?.winCount) || 0, 0);
  const lossCount = Math.max(total - winCount, 0);
  const totalHeroes = total > 0 ? total * 5 : 0;
  const ourTotalDieHeroCount = Math.max(
    Number(fightResult?.ourTotalDieHeroCount) || 0,
    0,
  );
  const enemyTotalDieHeroCount = Math.max(
    Number(fightResult?.enemyTotalDieHeroCount) || 0,
    0,
  );

  const toPercent = (value, divisor) =>
    divisor > 0 ? `${((value / divisor) * 100).toFixed(2)}%` : "0.00%";

  return {
    enemyDieRateText: toPercent(enemyTotalDieHeroCount, totalHeroes),
    lossCount,
    ourDieRateText: toPercent(ourTotalDieHeroCount, totalHeroes),
    total,
    winCount,
    winRateText: toPercent(winCount, total),
  };
};
