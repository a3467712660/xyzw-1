import {
  formatLineupFishCaption,
  getLineupHeroDisplayName,
} from "./lineupFormatters.js";

export const resolveLineupDisplayHeroName = (heroId, getHeroName) =>
  getLineupHeroDisplayName(
    typeof getHeroName === "function" ? getHeroName(heroId) : "",
    heroId,
  );

export const getLineupDisplayAvatarText = (heroName, maxLength = 1) => {
  const normalizedName = String(heroName || "").trim();
  if (!normalizedName) {
    return "?";
  }

  return normalizedName.substring(0, maxLength) || "?";
};

export const getLineupWeaponLabel = (weaponId, weaponMap = {}) => {
  if (weaponId === undefined || weaponId === null) {
    return "";
  }

  return weaponMap?.[weaponId] || String(weaponId);
};

export const buildSavedLineupActionState = (lineup = {}, currentTeamId = 1) => ({
  canApply: Number(lineup?.teamId || 0) === Number(currentTeamId || 0),
  hasTech:
    !!lineup?.legionResearch && Object.keys(lineup.legionResearch).length > 0,
  isApplying: Boolean(lineup?.applying),
});

export const buildLineupHeroFishCaption = (
  hero = {},
  { getFishNameById, getPearlSkillNameById } = {},
) =>
  formatLineupFishCaption(
    typeof getFishNameById === "function" ? getFishNameById(hero?.fishId) : "",
    typeof getPearlSkillNameById === "function"
      ? getPearlSkillNameById(hero?.skillId)
      : "",
  );

export const buildLineupHeroStatGroups = (hero = {}, formatPower) => {
  const formatValue = (value) =>
    typeof formatPower === "function" ? formatPower(value) : String(value || 0);

  const primary = [];
  const secondary = [];

  if (hero?.power) {
    primary.push({
      className: "stat-power",
      text: `战力${formatValue(hero.power)}`,
    });
  }
  if (hero?.speed) {
    primary.push({
      className: "stat-speed",
      text: `速度${hero.speed}`,
    });
  }
  if (hero?.attack) {
    secondary.push({
      className: "stat-attack",
      text: `攻击${formatValue(hero.attack)}`,
    });
  }
  if (hero?.hp) {
    secondary.push({
      className: "stat-hp",
      text: `血量${formatValue(hero.hp)}`,
    });
  }

  return { primary, secondary };
};

export const buildLineupHeroCardView = (
  hero = {},
  {
    formatLevel,
    formatPower,
    getFishNameById,
    getHeroAvatar,
    getHeroName,
    getPearlSkillNameById,
    getSlotColors,
  } = {},
) => {
  const heroName = resolveLineupDisplayHeroName(hero?.heroId, getHeroName);
  const levelValue =
    typeof formatLevel === "function" ? formatLevel(hero?.level) : hero?.level;
  const slotColors =
    typeof getSlotColors === "function" ? getSlotColors(hero?.slotMap) || [] : [];

  return {
    avatar:
      typeof getHeroAvatar === "function" ? getHeroAvatar(hero?.heroId) || "" : "",
    avatarText: getLineupDisplayAvatarText(heroName, 1),
    fishCaption: buildLineupHeroFishCaption(hero, {
      getFishNameById,
      getPearlSkillNameById,
    }),
    levelText: hero?.level ? `Lv.${levelValue}` : "",
    name: heroName,
    slotColors,
    stats: buildLineupHeroStatGroups(hero, formatPower),
  };
};
