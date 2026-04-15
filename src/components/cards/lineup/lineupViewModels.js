import {
  buildLineupHeroFishCaption,
  buildLineupHeroStatGroups,
  getLineupDisplayAvatarText,
  getLineupWeaponLabel,
  resolveLineupDisplayHeroName,
} from "./lineupDisplayHelpers.js";
import { parseEquipmentQuenchMap } from "./useSavedLineupStorage.js";

const toArray = (value) => (Array.isArray(value) ? value : []);

const buildEquipmentParts = (equipment = {}) =>
  Object.entries(equipment || {})
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([partId, part]) => {
      const slots = parseEquipmentQuenchMap(part?.quenches);
      if (slots.length === 0) {
        return null;
      }

      return {
        partId: Number(partId),
        redCount: slots.filter((slot) => Number(slot.colorId) === 6).length,
        slotCount: slots.length,
      };
    })
    .filter(Boolean);

const buildEquipmentSummaryTitle = (parts = []) =>
  parts.length > 0
    ? parts
        .map(
          (part) =>
            `部位${part.partId}: ${part.slotCount}孔${part.redCount > 0 ? ` / ${part.redCount}红` : ""}`,
        )
        .join("；")
    : "";

export const buildSavedLineupMetaView = (
  lineup = {},
  { formatTime, getWeaponLabel } = {},
) => {
  const heroes = toArray(lineup?.heroes);
  const equipmentParts = heroes.flatMap((hero) =>
    buildEquipmentParts(hero?.equipment),
  );
  const hasEquipmentSnapshot = equipmentParts.length > 0;
  const hasFishData = heroes.some((hero) => hero?.pearlId || hero?.fishId);
  const hasTechData =
    !!lineup?.legionResearch && Object.keys(lineup.legionResearch).length > 0;
  const hasWeaponData =
    lineup?.weaponId !== undefined && lineup?.weaponId !== null;

  return {
    equipmentPartCount: equipmentParts.length,
    hasEquipmentSnapshot,
    hasFishData,
    hasTechData,
    hasWeaponData,
    heroes,
    heroCount: heroes.length,
    id: lineup?.id || lineup?.savedAt || lineup?.name || "",
    lineup,
    name: String(lineup?.name || "").trim() || "未命名阵容",
    savedAtText:
      typeof formatTime === "function" ? formatTime(lineup?.savedAt) : "",
    teamId: Number(lineup?.teamId || 0) || 1,
    weaponLabel:
      typeof getWeaponLabel === "function"
        ? getWeaponLabel(lineup?.weaponId)
        : getLineupWeaponLabel(lineup?.weaponId),
  };
};

export const buildLineupHeroStatsView = (
  hero = {},
  { formatLevel, formatPower, getHeroAvatar, getHeroName } = {},
) => {
  const heroName = resolveLineupDisplayHeroName(hero?.heroId, getHeroName);
  const levelValue =
    typeof formatLevel === "function" ? formatLevel(hero?.level) : hero?.level;

  return {
    avatar:
      typeof getHeroAvatar === "function" ? getHeroAvatar(hero?.heroId) || "" : "",
    avatarText: getLineupDisplayAvatarText(heroName, 1),
    levelText: hero?.level ? `Lv.${levelValue}` : "",
    name: heroName,
    stats: buildLineupHeroStatGroups(hero, formatPower),
  };
};

export const buildLineupHeroEquipmentView = (
  hero = {},
  { getFishNameById, getPearlSkillNameById, getSlotColors } = {},
) => {
  const equipmentParts = buildEquipmentParts(hero?.equipment);

  return {
    artifactIdText: hero?.artifactId ? `Artifact#${hero.artifactId}` : "",
    equipmentPartCount: equipmentParts.length,
    equipmentParts,
    equipmentSummaryTitle: buildEquipmentSummaryTitle(equipmentParts),
    fishCaption: buildLineupHeroFishCaption(hero, {
      getFishNameById,
      getPearlSkillNameById,
    }),
    hasEquipmentSnapshot: equipmentParts.length > 0,
    slotColors:
      typeof getSlotColors === "function" ? getSlotColors(hero?.slotMap) || [] : [],
  };
};

export const buildLineupHeroView = (hero = {}, options = {}) => ({
  ...buildLineupHeroStatsView(hero, options),
  ...buildLineupHeroEquipmentView(hero, options),
});
