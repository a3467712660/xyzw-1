export const formatFightPvpUpdatedAt = (updatedAt, localeValue) => {
  const date = new Date(Number(updatedAt) || Date.now());
  try {
    return localeValue ? date.toLocaleString(localeValue) : date.toLocaleString();
  } catch {
    return date.toLocaleString();
  }
};

export const formatFightPvpPower = (power) => {
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

const normalizeFightPvpColorText = (value) => {
  const text = String(value || "").trim().toLowerCase();
  if (text === "red" || text === "红色" || text === "红") return 6;
  if (text === "orange" || text === "橙色" || text === "橙") return 5;
  if (text === "purple" || text === "紫色" || text === "紫") return 4;
  if (text === "blue" || text === "蓝色" || text === "蓝") return 3;
  if (text === "green" || text === "绿色" || text === "绿") return 2;
  if (text === "white" || text === "白色" || text === "白") return 1;
  return 0;
};

const toFightPvpNumericLevel = (value) => {
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) {
    return numeric;
  }
  return normalizeFightPvpColorText(value);
};

export const getFightPvpQuenchColorLevel = (quench) => {
  const extractColorLevelDeep = (node, depth = 0) => {
    if (node == null || depth > 2) {
      return 0;
    }

    if (typeof node === "number" || typeof node === "string") {
      return toFightPvpNumericLevel(node);
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const level = extractColorLevelDeep(item, depth + 1);
        if (level > 0) {
          return level;
        }
      }
      return 0;
    }

    if (typeof node !== "object") {
      return 0;
    }

    const direct = toFightPvpNumericLevel(
      node?.colorId
      ?? node?.color
      ?? node?.attrColorId
      ?? node?.slotColorId
      ?? node?.quality
      ?? node?.quenchColorId
      ?? node?.attr?.colorId
      ?? node?.attr?.color
      ?? 0,
    );
    if (direct > 0) {
      return direct;
    }

    for (const [key, value] of Object.entries(node)) {
      const lowerKey = String(key).toLowerCase();
      if (
        lowerKey.includes("color")
        || lowerKey.includes("quality")
        || lowerKey.includes("grade")
        || lowerKey.includes("rank")
      ) {
        const level = extractColorLevelDeep(value, depth + 1);
        if (level > 0) {
          return level;
        }
      }
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        const level = extractColorLevelDeep(value, depth + 1);
        if (level > 0) {
          return level;
        }
      }
    }

    return 0;
  };

  if (typeof quench === "number" || typeof quench === "string") {
    return toFightPvpNumericLevel(quench);
  }

  return extractColorLevelDeep(quench);
};

const toFightPvpNonEmptyMap = (value) =>
  value && typeof value === "object" && Object.keys(value).length ? value : null;

export const parseFightPvpQuenchCollection = (value) => {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined && item !== null);
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text || (text[0] !== "{" && text[0] !== "[")) {
      return [];
    }
    try {
      return parseFightPvpQuenchCollection(JSON.parse(text));
    } catch {
      return [];
    }
  }

  if (typeof value === "object") {
    return Object.values(value).filter((item) => item !== undefined && item !== null);
  }

  return [];
};

const detectFightPvpQuenchPalette = (levels) => {
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

const getFightPvpQuenchCollectionScore = (slots) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return 0;
  }
  const colorScore = slots.filter((slot) => getFightPvpQuenchColorLevel(slot) > 0).length;
  return colorScore * 10 + slots.length;
};

export const getFightPvpEffectiveQuenchMap = (equip) => {
  if (!equip || typeof equip !== "object") {
    return null;
  }

  const primary = toFightPvpNonEmptyMap(equip.quenches);
  const secondary = toFightPvpNonEmptyMap(equip.quenches2);
  const currentQuenchId = Number(equip.curQuenchId || 0);

  if (currentQuenchId === 2 && secondary) return secondary;
  if ((currentQuenchId === 1 || currentQuenchId === 0) && primary) return primary;
  if (primary && !secondary) return primary;
  if (secondary && !primary) return secondary;
  if (!primary && !secondary) return null;

  const primarySlots = parseFightPvpQuenchCollection(primary);
  const secondarySlots = parseFightPvpQuenchCollection(secondary);
  return getFightPvpQuenchCollectionScore(primarySlots)
    >= getFightPvpQuenchCollectionScore(secondarySlots)
    ? primary
    : secondary;
};

export const getFightPvpEquipmentPalette = (equipment) => {
  const levels = [];
  for (const equip of Object.values(equipment || {})) {
    const quenchMap = getFightPvpEffectiveQuenchMap(equip);
    if (!quenchMap) {
      continue;
    }
    for (const slot of parseFightPvpQuenchCollection(quenchMap)) {
      const level = getFightPvpQuenchColorLevel(slot);
      if (level > 0) {
        levels.push(level);
      }
    }
  }
  return detectFightPvpQuenchPalette(levels);
};

export const getFightPvpEquipmentQuenchSlots = (heroEquipment, index) => {
  const equip = Object.values(heroEquipment || {})[index];
  return parseFightPvpQuenchCollection(getFightPvpEffectiveQuenchMap(equip));
};

export const isFightPvpRedQuenchSlot = (slot, heroEquipment) => {
  const level = getFightPvpQuenchColorLevel(slot);
  const palette = getFightPvpEquipmentPalette(heroEquipment || {});
  return level >= palette.redThreshold;
};

export const isFightPvpOrangeQuenchSlot = (slot, heroEquipment) => {
  const level = getFightPvpQuenchColorLevel(slot);
  const palette = getFightPvpEquipmentPalette(heroEquipment || {});
  return level === palette.orangeLevel;
};

export const countFightPvpPearlOrangeSlots = (slotMap) => {
  if (!Array.isArray(slotMap)) {
    return 0;
  }
  return slotMap.reduce(
    (count, slot) => count + (Number(slot?.colorId || 0) === 5 ? 1 : 0),
    0,
  );
};
