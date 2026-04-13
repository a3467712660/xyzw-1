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

const normalizeLineupId = (value) => Number(value || 0) || null;

export const getLineupFishInfoByArtifactId = (
  artifactId,
  artifactBooks,
  fishMap,
) => {
  const normalizedArtifactId = normalizeLineupId(artifactId);
  if (!normalizedArtifactId) {
    return null;
  }

  for (const [fishId, book] of Object.entries(artifactBooks || {})) {
    if (normalizeLineupId(book?.artifactId) !== normalizedArtifactId) {
      continue;
    }

    const fishData = fishMap?.[fishId];
    if (!fishData) {
      return null;
    }

    return {
      artifactId: normalizedArtifactId,
      fishId: normalizeLineupId(fishId),
      name: fishData.name,
      star: Number(book?.claimedStar || 0) || 0,
    };
  }

  return null;
};

export const getLineupFishNameById = (fishId, fishMap) => {
  const normalizedFishId = normalizeLineupId(fishId);
  if (!normalizedFishId) {
    return null;
  }

  return fishMap?.[normalizedFishId]?.name || `鱼灵${normalizedFishId}`;
};

export const getLineupPearlSkillNameById = (skillId, pearlSkillMap) => {
  const normalizedSkillId = normalizeLineupId(skillId);
  if (!normalizedSkillId) {
    return null;
  }

  return pearlSkillMap?.[normalizedSkillId]?.name || null;
};

export const getLineupSlotColors = (slotMap, colorMap) => {
  if (!slotMap) {
    return null;
  }

  const colors = Object.values(slotMap).reduce((result, slot) => {
    const colorId = normalizeLineupId(slot?.colorId);
    if (colorId) {
      result.push(colorMap?.[colorId]?.value || "white");
    }
    return result;
  }, []);

  return colors.length > 0 ? colors : null;
};

export const getLineupPearlDataByArtifactId = (artifactId, pearlRecords) => {
  const normalizedArtifactId = normalizeLineupId(artifactId);
  if (!normalizedArtifactId) {
    return null;
  }

  for (const pearlData of Object.values(pearlRecords || {})) {
    if (normalizeLineupId(pearlData?.artifactId) === normalizedArtifactId) {
      return pearlData;
    }
  }

  return null;
};

export const getLineupPearlSkillNameByArtifactId = (
  artifactId,
  pearlRecords,
  pearlSkillMap,
) => {
  const pearlData = getLineupPearlDataByArtifactId(artifactId, pearlRecords);
  return getLineupPearlSkillNameById(pearlData?.skillId, pearlSkillMap);
};

export const getLineupSlotColorsByArtifactId = (
  artifactId,
  pearlRecords,
  colorMap,
) => {
  const pearlData = getLineupPearlDataByArtifactId(artifactId, pearlRecords);
  return getLineupSlotColors(pearlData?.slotMap, colorMap);
};
