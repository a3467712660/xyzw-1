const FALLBACK_PVP_MAP_DRESS_TYPE = 6;

const PVP_MAP_DRESS_TYPE_KEYS = Object.freeze([
  FALLBACK_PVP_MAP_DRESS_TYPE,
  String(FALLBACK_PVP_MAP_DRESS_TYPE),
  "pvpMap",
  "PVPMap",
  "PVP_MAP",
  "pvp_map",
]);

const toPlainObject = (value) =>
  value && typeof value === "object" ? value : null;

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

const getDressEntryFromCollection = (collection, typeKey) => {
  if (!collection) {
    return null;
  }

  if (collection instanceof Map) {
    return collection.get(typeKey) || null;
  }

  if (typeof collection.get === "function") {
    try {
      const entry = collection.get(typeKey);
      if (entry) {
        return entry;
      }
    } catch {
      // Ignore custom map-like getter failures.
    }
  }

  const source = toPlainObject(collection);
  if (!source) {
    return null;
  }

  if (source[typeKey]) {
    return source[typeKey];
  }
  if (source[String(typeKey)]) {
    return source[String(typeKey)];
  }
  if (source.pvpMap) {
    return source.pvpMap;
  }

  for (const value of Object.values(source)) {
    const entry = toPlainObject(value);
    if (!entry) {
      continue;
    }
    const entryType = toNonEmptyString(entry.type, entry.dressType, entry.key, entry.name);
    if (entryType && entryType === String(typeKey)) {
      return entry;
    }
  }

  return null;
};

const getDressEntryUsedId = (entry) =>
  toPositiveNumber(
    entry?.used,
    toPositiveNumber(
      entry?.itemId,
      toPositiveNumber(
        entry?.id,
        toPositiveNumber(entry?.value, null),
      ),
    ),
  );

export const extractPvpMapDressUsedId = (collection) => {
  for (const typeKey of PVP_MAP_DRESS_TYPE_KEYS) {
    const entry = getDressEntryFromCollection(collection, typeKey);
    const usedId = getDressEntryUsedId(entry);
    if (usedId) {
      return usedId;
    }
  }

  return null;
};

export const buildPvpMapDressSnapshot = (sourceOrUsedId) => {
  const usedId = toPositiveNumber(
    sourceOrUsedId,
    extractPvpMapDressUsedId(sourceOrUsedId),
  );
  if (!usedId) {
    return null;
  }

  return {
    pvpMap: {
      used: usedId,
    },
  };
};
