import {
  normalizeHeroEquipmentSnapshot,
  parseEquipmentQuenchMap,
  toNullableNumber,
} from "./useSavedLineupStorage.js";

export const getEquipmentQuenchColorLevel = (quench) => {
  const normalizeColorText = (value) => {
    const text = String(value || "").trim().toLowerCase();
    if (text === "red" || text === "红色" || text === "红") return 6;
    if (text === "orange" || text === "橙色" || text === "橙") return 5;
    if (text === "purple" || text === "紫色" || text === "紫") return 4;
    if (text === "blue" || text === "蓝色" || text === "蓝") return 3;
    if (text === "green" || text === "绿色" || text === "绿") return 2;
    if (text === "white" || text === "白色" || text === "白") return 1;
    return 0;
  };

  const numericLevel = Number(quench?.colorId ?? quench?.color ?? 0);
  if (Number.isFinite(numericLevel) && numericLevel > 0) {
    return numericLevel;
  }

  return normalizeColorText(quench?.colorId ?? quench?.color ?? "");
};

export const detectEquipmentPalette = (levels) => {
  const normalized = (levels || [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
  const hasLevel5 = normalized.includes(5);
  const hasLevel7OrAbove = normalized.some((item) => item >= 7);

  if (!hasLevel5 && hasLevel7OrAbove) {
    return { orangeLevel: 6, redThreshold: 7 };
  }

  return { orangeLevel: 5, redThreshold: 6 };
};

export const getEquipmentSnapshotPalette = (equipmentSnapshot) => {
  const levels = [];
  for (const part of Object.values(equipmentSnapshot || {})) {
    for (const slot of parseEquipmentQuenchMap(part?.quenches)) {
      const level = getEquipmentQuenchColorLevel(slot);
      if (level > 0) {
        levels.push(level);
      }
    }
  }
  return detectEquipmentPalette(levels);
};

export const getEquipmentPartStats = (part, palette) => {
  const slots = parseEquipmentQuenchMap(part?.quenches);
  const coloredCount = slots.filter((slot) => getEquipmentQuenchColorLevel(slot) > 0).length;
  const redCount = slots.filter(
    (slot) => getEquipmentQuenchColorLevel(slot) >= palette.redThreshold,
  ).length;
  const orangeCount = slots.filter(
    (slot) => getEquipmentQuenchColorLevel(slot) === palette.orangeLevel,
  ).length;
  const bonusValue =
    (toNullableNumber(part?.quenchAttackExt) ?? 0)
    + (toNullableNumber(part?.quenchDefenseExt) ?? 0)
    + (toNullableNumber(part?.quenchHpExt) ?? 0);

  return {
    redCount,
    orangeCount,
    coloredCount,
    bonusValue,
  };
};

export const getEquipmentMatchScore = (targetEquipment, currentEquipment) => {
  const normalizedTarget = normalizeHeroEquipmentSnapshot(targetEquipment);
  const normalizedCurrent = normalizeHeroEquipmentSnapshot(currentEquipment);

  if (!normalizedTarget || !normalizedCurrent) {
    return {
      exact: false,
      redHit: 0,
      orangeHit: 0,
      coloredHit: 0,
      bonusDiff: Number.POSITIVE_INFINITY,
      hasSignal: false,
    };
  }

  if (JSON.stringify(normalizedTarget) === JSON.stringify(normalizedCurrent)) {
    return {
      exact: true,
      redHit: Number.MAX_SAFE_INTEGER,
      orangeHit: Number.MAX_SAFE_INTEGER,
      coloredHit: Number.MAX_SAFE_INTEGER,
      bonusDiff: 0,
      hasSignal: true,
    };
  }

  const targetPalette = getEquipmentSnapshotPalette(normalizedTarget);
  const currentPalette = getEquipmentSnapshotPalette(normalizedCurrent);
  const partIds = new Set([
    ...Object.keys(normalizedTarget || {}),
    ...Object.keys(normalizedCurrent || {}),
  ]);

  let redHit = 0;
  let orangeHit = 0;
  let coloredHit = 0;
  let bonusDiff = 0;

  for (const partId of partIds) {
    const targetPartStats = getEquipmentPartStats(
      normalizedTarget?.[partId],
      targetPalette,
    );
    const currentPartStats = getEquipmentPartStats(
      normalizedCurrent?.[partId],
      currentPalette,
    );

    redHit += Math.min(targetPartStats.redCount, currentPartStats.redCount);
    orangeHit += Math.min(targetPartStats.orangeCount, currentPartStats.orangeCount);
    coloredHit += Math.min(targetPartStats.coloredCount, currentPartStats.coloredCount);
    bonusDiff += Math.abs(targetPartStats.bonusValue - currentPartStats.bonusValue);
  }

  return {
    exact: false,
    redHit,
    orangeHit,
    coloredHit,
    bonusDiff,
    hasSignal:
      redHit > 0
      || orangeHit > 0
      || coloredHit > 0
      || Number.isFinite(bonusDiff),
  };
};

export const getLineupTeamHeroes = (teamInfo) => {
  if (!teamInfo) return [];
  return Object.entries(teamInfo)
    .map(([key, hero]) => ({
      position: hero?.battleTeamSlot ?? Number(key),
      heroId: hero?.heroId || hero?.id,
      artifactId: hero?.artifactId || null,
      attachmentUid: hero?.attachmentUid || null,
    }))
    .filter((hero) => hero.heroId)
    .sort((left, right) => left.position - right.position);
};

export const getLineupSlotCandidates = (heroesInTeam = [], targetHeroes = []) => {
  const positions = [
    ...heroesInTeam.map((hero) => Number(hero.position)),
    ...targetHeroes.map((hero) => Number(hero.position)),
  ].filter((position) => Number.isFinite(position));
  const slotBase = positions.includes(0) ? 0 : 1;
  return Array.from({ length: 5 }, (_, index) => slotBase + index);
};

export const getArtifactIdForTargetHero = (
  targetHero,
  pearlMapData = {},
  artifactBooksData = {},
) => {
  if (targetHero?.fishId != null) {
    const book =
      artifactBooksData[String(targetHero.fishId)]
      || artifactBooksData[targetHero.fishId]
      || null;
    const artifactId = Number(book?.artifactId || 0) || null;
    if (artifactId && artifactId !== -1) {
      return artifactId;
    }
  }

  if (targetHero?.pearlId) {
    const pearlData =
      pearlMapData[String(targetHero.pearlId)]
      || pearlMapData[targetHero.pearlId]
      || null;
    const artifactId = Number(pearlData?.artifactId || 0) || null;
    if (artifactId && artifactId !== -1) {
      return artifactId;
    }
  }

  return null;
};

export const getPearlSkillId = (pearlMapData = {}, pearlId) => {
  if (!pearlId) return null;
  const pearlData = pearlMapData[String(pearlId)] || pearlMapData[pearlId] || null;
  return Number(pearlData?.skillId || 0) || null;
};

export const buildArtifactToHeroMap = (heroesData = {}, teamInfoData = {}) => {
  const result = {};

  for (const teamHero of Object.values(teamInfoData || {})) {
    const heroId = Number(teamHero?.heroId || teamHero?.id || 0) || null;
    const artifactId = Number(teamHero?.artifactId || 0) || null;
    if (heroId && artifactId && artifactId !== -1) {
      result[artifactId] = heroId;
    }
  }

  for (const [heroId, hero] of Object.entries(heroesData || {})) {
    const numericHeroId = Number(heroId || 0) || null;
    const artifactId = Number(hero?.artifactId || 0) || null;
    if (numericHeroId && artifactId && artifactId !== -1 && !result[artifactId]) {
      result[artifactId] = numericHeroId;
    }
  }

  return result;
};

export const getCurrentArtifactIdForTargetHero = (
  targetHero,
  heroesData = {},
  teamInfoData = {},
) => {
  if (!targetHero?.heroId) return null;

  const teamHero =
    teamInfoData?.[targetHero.position]
    || teamInfoData?.[String(targetHero.position)]
    || null;
  if (Number(teamHero?.heroId || teamHero?.id || 0) === Number(targetHero.heroId)) {
    return Number(teamHero?.artifactId || 0) || null;
  }

  const heroData =
    heroesData[String(targetHero.heroId)] || heroesData[targetHero.heroId] || {};
  return Number(heroData?.artifactId || 0) || null;
};

export const isArtifactAssignedToTargetHero = (
  targetHero,
  expectedArtifactId,
  heroesData = {},
  teamInfoData = {},
  artifactToHeroMap = {},
) => {
  const normalizedExpectedArtifactId = Number(expectedArtifactId || 0) || null;
  const currentArtifactId = getCurrentArtifactIdForTargetHero(
    targetHero,
    heroesData,
    teamInfoData,
  );
  if ((currentArtifactId || null) !== (normalizedExpectedArtifactId || null)) {
    return false;
  }
  if (!normalizedExpectedArtifactId) {
    return true;
  }
  const holderId = Number(artifactToHeroMap?.[normalizedExpectedArtifactId] || 0) || null;
  return !holderId || holderId === Number(targetHero?.heroId || 0);
};

export const reviewLineupEquipment = (
  targetHeroes = [],
  heroesData = {},
  resolveHeroName = (heroId) => String(heroId),
) => {
  const mismatched = [];

  for (const targetHero of targetHeroes) {
    const targetEquipment = normalizeHeroEquipmentSnapshot(targetHero?.equipment);
    if (!targetEquipment) {
      continue;
    }

    const heroData =
      heroesData[String(targetHero.heroId)] || heroesData[targetHero.heroId] || {};
    const currentEquipment = normalizeHeroEquipmentSnapshot(heroData?.equipment);

    if (JSON.stringify(currentEquipment) !== JSON.stringify(targetEquipment)) {
      mismatched.push({
        heroId: Number(targetHero.heroId),
        heroName: resolveHeroName(targetHero.heroId),
      });
    }
  }

  return {
    success: mismatched.length === 0,
    mismatched,
  };
};

export const findBestLineupEquipmentHolder = (
  targetHero,
  heroesData = {},
  teamInfoData = {},
) => {
  const targetEquipment = normalizeHeroEquipmentSnapshot(targetHero?.equipment);
  if (!targetEquipment) {
    return null;
  }

  const teamHeroIds = new Set(
    getLineupTeamHeroes(teamInfoData).map((hero) => Number(hero.heroId)),
  );
  const candidates = [];

  for (const [heroId, heroData] of Object.entries(heroesData)) {
    const candidateHeroId = Number(heroId);
    if (!candidateHeroId) continue;
    if (candidateHeroId === Number(targetHero.heroId)) continue;

    const score = getEquipmentMatchScore(targetEquipment, heroData?.equipment);
    if (!score.hasSignal) continue;

    candidates.push({
      ...score,
      heroId: candidateHeroId,
      inTeam: teamHeroIds.has(candidateHeroId),
    });
  }

  candidates.sort((left, right) => {
    if (left.exact !== right.exact) return left.exact ? -1 : 1;
    if (left.redHit !== right.redHit) return right.redHit - left.redHit;
    if (left.orangeHit !== right.orangeHit) return right.orangeHit - left.orangeHit;
    if (left.coloredHit !== right.coloredHit) return right.coloredHit - left.coloredHit;
    if (left.bonusDiff !== right.bonusDiff) return left.bonusDiff - right.bonusDiff;
    if (left.inTeam !== right.inTeam) return left.inTeam ? -1 : 1;
    return left.heroId - right.heroId;
  });

  return candidates[0] || null;
};
