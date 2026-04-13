export const formatLineupPower = (power) => {
  if (!power) {
    return "0";
  }

  if (power >= 100000000) {
    return `${(power / 100000000).toFixed(2)}亿`;
  }

  if (power >= 10000) {
    return `${(power / 10000).toFixed(2)}万`;
  }

  return String(power);
};

export const getLineupHeroDisplayName = (heroName, heroId) => {
  if (heroName && String(heroName).trim()) {
    return String(heroName).trim();
  }

  return heroId ? `武将${heroId}` : "未知武将";
};

export const formatLineupFishCaption = (fishName, pearlSkillName) => {
  const normalizedFishName = String(fishName || "").trim();
  const normalizedPearlSkillName = String(pearlSkillName || "").trim();

  if (!normalizedFishName) {
    return "";
  }

  if (!normalizedPearlSkillName) {
    return normalizedFishName;
  }

  return `${normalizedFishName} ${normalizedPearlSkillName}`;
};
