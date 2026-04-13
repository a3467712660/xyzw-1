import { ref } from "vue";

export const LINEUP_STORE_VERSION = 2;

export const createLineupId = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export const toNullableNumber = (value) => {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const parseEquipmentQuenchMap = (quenchMap) => {
  const normalizedMap = normalizeEquipmentQuenchMap(quenchMap);
  if (!normalizedMap) {
    return [];
  }

  return Object.entries(normalizedMap)
    .sort(([left], [right]) => Number(left) - Number(right))
    .map(([slotId, slot]) => ({
      slotId: Number(slotId),
      attrId: toNullableNumber(slot.attrId),
      attrNum: toNullableNumber(slot.attrNum) ?? 0,
      colorId: toNullableNumber(slot.colorId) ?? 0,
      isLocked: Boolean(slot.isLocked),
    }));
};

const getEquipmentQuenchCollectionScore = (slots) => {
  if (!Array.isArray(slots) || slots.length === 0) {
    return 0;
  }
  const colorScore = slots.filter(
    (slot) => (toNullableNumber(slot.colorId) ?? 0) > 0,
  ).length;
  return colorScore * 10 + slots.length;
};

const normalizeEquipmentQuenchSlot = (slot) => {
  if (!slot || typeof slot !== "object") {
    return null;
  }

  const attrId = toNullableNumber(slot.attrId);
  const attrNum = toNullableNumber(slot.attrNum) ?? 0;
  const colorId = toNullableNumber(slot.colorId) ?? 0;
  const isLocked = Boolean(slot.isLocked || slot.locked);

  if (attrId == null && attrNum <= 0 && colorId <= 0 && !isLocked) {
    return null;
  }

  return {
    attrId,
    attrNum,
    colorId,
    isLocked,
  };
};

const normalizeEquipmentQuenchMap = (quenchMap) => {
  if (!quenchMap || typeof quenchMap !== "object") {
    return null;
  }

  const normalized = {};
  for (const [slotId, slot] of Object.entries(quenchMap)) {
    const normalizedSlot = normalizeEquipmentQuenchSlot(slot);
    if (!normalizedSlot) {
      continue;
    }
    normalized[String(slotId)] = normalizedSlot;
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const getEffectiveEquipmentQuenchMap = (equip) => {
  if (!equip || typeof equip !== "object") {
    return null;
  }

  const primary = normalizeEquipmentQuenchMap(equip.quenches);
  const secondary = normalizeEquipmentQuenchMap(equip.quenches2);
  const curQuenchId = Number(equip.curQuenchId || 0);

  if (curQuenchId === 2 && secondary) {
    return secondary;
  }
  if ((curQuenchId === 1 || curQuenchId === 0) && primary) {
    return primary;
  }
  if (primary && !secondary) {
    return primary;
  }
  if (secondary && !primary) {
    return secondary;
  }
  if (!primary && !secondary) {
    return null;
  }

  const primarySlots = parseEquipmentQuenchMap(primary);
  const secondarySlots = parseEquipmentQuenchMap(secondary);
  return getEquipmentQuenchCollectionScore(primarySlots) >=
    getEquipmentQuenchCollectionScore(secondarySlots)
    ? primary
    : secondary;
};

export const normalizeHeroEquipmentSnapshot = (equipment) => {
  if (!equipment || typeof equipment !== "object") {
    return null;
  }

  const normalized = {};
  for (const [partId, part] of Object.entries(equipment)) {
    if (!part || typeof part !== "object") {
      continue;
    }

    const normalizedPart = {};
    const level = toNullableNumber(part.level) ?? 0;
    const quenchTimes = toNullableNumber(part.quenchTimes) ?? 0;
    const quenchAttackExt = toNullableNumber(part.quenchAttackExt) ?? 0;
    const quenchDefenseExt = toNullableNumber(part.quenchDefenseExt) ?? 0;
    const quenchHpExt = toNullableNumber(part.quenchHpExt) ?? 0;
    const quenches = getEffectiveEquipmentQuenchMap(part);

    if (level > 0) normalizedPart.level = level;
    if (quenchTimes > 0) normalizedPart.quenchTimes = quenchTimes;
    if (quenchAttackExt > 0) normalizedPart.quenchAttackExt = quenchAttackExt;
    if (quenchDefenseExt > 0) normalizedPart.quenchDefenseExt = quenchDefenseExt;
    if (quenchHpExt > 0) normalizedPart.quenchHpExt = quenchHpExt;
    if (quenches) normalizedPart.quenches = quenches;

    if (Object.keys(normalizedPart).length > 0) {
      normalized[String(partId)] = normalizedPart;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : null;
};

const getLineupItemUpdatedAt = (lineup) => {
  const ts = Number(lineup?.updatedAt || lineup?.savedAt || 0);
  return Number.isFinite(ts) && ts > 0 ? ts : 0;
};

const getLineupCollectionUpdatedAt = (lineups = []) =>
  lineups.reduce(
    (max, lineup) => Math.max(max, getLineupItemUpdatedAt(lineup)),
    0,
  );

export const normalizeSavedHero = (hero, index = 0) => {
  if (!hero || typeof hero !== "object") {
    return null;
  }
  const heroId = Number(hero.heroId || 0);
  if (!heroId) {
    return null;
  }
  return {
    ...hero,
    position: toNullableNumber(hero.position) ?? index,
    heroId,
    level: toNullableNumber(hero.level),
    attachmentUid: toNullableNumber(hero.attachmentUid),
    fishId: toNullableNumber(hero.fishId),
    pearlId: toNullableNumber(hero.pearlId),
    skillId: toNullableNumber(hero.skillId),
    power: toNullableNumber(hero.power),
    attack: toNullableNumber(hero.attack),
    hp: toNullableNumber(hero.hp),
    speed: toNullableNumber(hero.speed),
    slotMap:
      hero.slotMap && typeof hero.slotMap === "object" ? hero.slotMap : null,
    equipment: normalizeHeroEquipmentSnapshot(hero.equipment),
  };
};

export const normalizeSavedLineup = (lineup, index = 0) => {
  if (!lineup || typeof lineup !== "object") {
    return null;
  }
  const teamId = Number(lineup.teamId || 0) || 1;
  const heroes = Array.isArray(lineup.heroes)
    ? lineup.heroes
        .map((hero, heroIndex) => normalizeSavedHero(hero, heroIndex))
        .filter(Boolean)
    : [];
  const name = String(lineup.name || "").trim() || `阵容${teamId}-${index + 1}`;
  return {
    ...lineup,
    id: String(lineup.id || createLineupId()),
    name,
    heroes,
    teamId,
    savedAt: getLineupItemUpdatedAt(lineup) || Date.now(),
    updatedAt: getLineupItemUpdatedAt(lineup) || Date.now(),
    applying: false,
    legionResearch:
      lineup.legionResearch && typeof lineup.legionResearch === "object"
        ? lineup.legionResearch
        : {},
    weaponId:
      lineup.weaponId === undefined ? null : toNullableNumber(lineup.weaponId),
  };
};

const normalizeSavedLineups = (lineups) =>
  (Array.isArray(lineups) ? lineups : [])
    .map((lineup, index) => normalizeSavedLineup(lineup, index))
    .filter(Boolean)
    .sort((a, b) => getLineupItemUpdatedAt(b) - getLineupItemUpdatedAt(a));

export const normalizeSavedLineupStore = (rawValue) => {
  const rawLineups = Array.isArray(rawValue)
    ? rawValue
    : Array.isArray(rawValue?.lineups)
      ? rawValue.lineups
      : [];
  const lineups = normalizeSavedLineups(rawLineups);
  const fallbackUpdatedAt = getLineupCollectionUpdatedAt(lineups);
  const rawUpdatedAt = Number(rawValue?.updatedAt || rawValue?.savedAt || 0);
  const updatedAt =
    Number.isFinite(rawUpdatedAt) && rawUpdatedAt > 0
      ? rawUpdatedAt
      : fallbackUpdatedAt;
  return {
    version:
      Number(rawValue?.version || LINEUP_STORE_VERSION) || LINEUP_STORE_VERSION,
    updatedAt,
    lineups,
  };
};

export const buildSavedLineupStore = (
  lineups = [],
  updatedAt = Date.now(),
) => ({
  version: LINEUP_STORE_VERSION,
  updatedAt: Number(updatedAt) > 0 ? Number(updatedAt) : Date.now(),
  lineups: normalizeSavedLineups(lineups),
});

export const mergeSavedLineupStores = (localStore, remoteStore) => {
  const mergedById = new Map();
  for (const lineup of [
    ...(localStore?.lineups || []),
    ...(remoteStore?.lineups || []),
  ]) {
    const key = String(lineup?.id || "");
    if (!key) {
      continue;
    }
    const normalized = normalizeSavedLineup(lineup);
    const previous = mergedById.get(key);
    if (
      !previous ||
      getLineupItemUpdatedAt(normalized) >= getLineupItemUpdatedAt(previous)
    ) {
      mergedById.set(key, normalized);
    }
  }
  return buildSavedLineupStore(
    Array.from(mergedById.values()),
    Math.max(
      Number(localStore?.updatedAt || 0),
      Number(remoteStore?.updatedAt || 0),
      getLineupCollectionUpdatedAt(Array.from(mergedById.values())),
    ),
  );
};

export const useSavedLineupStorage = ({
  api,
  authStore,
  getSelectedTokenId,
  message,
  savedLineups,
  buildLineupCloudPrefKey,
  buildLineupStorageKey,
}) => {
  const lineupCloudLoading = ref(false);
  const lineupCloudSyncing = ref(false);
  let lineupCloudTimer = null;
  let savedLineupsLoadSeq = 0;

  const clearLineupCloudTimer = () => {
    if (lineupCloudTimer) {
      clearTimeout(lineupCloudTimer);
      lineupCloudTimer = null;
    }
  };

  const writeSavedLineupStoreToLocal = (tokenId, store) => {
    const storageKey = buildLineupStorageKey(tokenId);
    if (!storageKey) {
      return;
    }
    localStorage.setItem(
      storageKey,
      JSON.stringify(normalizeSavedLineupStore(store)),
    );
  };

  const readSavedLineupStoreFromLocal = (tokenId) => {
    const storageKey = buildLineupStorageKey(tokenId);
    if (!storageKey) {
      return buildSavedLineupStore([], 0);
    }
    try {
      const data = localStorage.getItem(storageKey);
      if (!data) {
        return buildSavedLineupStore([], 0);
      }
      return normalizeSavedLineupStore(JSON.parse(data));
    } catch (error) {
      console.warn(
        "读取本地已保存阵容失败，已回退为空列表:",
        error?.message || error,
      );
      return buildSavedLineupStore([], 0);
    }
  };

  const readSavedLineupStoreFromCloud = async (tokenId) => {
    const prefKey = buildLineupCloudPrefKey(tokenId);
    if (!prefKey) {
      return buildSavedLineupStore([], 0);
    }
    const res = await api.user.getPreference(prefKey);
    const rawValue = res?.data?.value;
    if (rawValue == null) {
      return buildSavedLineupStore([], 0);
    }
    const parsed =
      typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    return normalizeSavedLineupStore(parsed);
  };

  const pushSavedLineupsToCloud = async (
    tokenId = getSelectedTokenId(),
    store = buildSavedLineupStore(savedLineups.value),
  ) => {
    if (!authStore.isAuthenticated || !tokenId) {
      return false;
    }
    await api.user.setPreference(buildLineupCloudPrefKey(tokenId), store);
    return true;
  };

  const applySavedLineupStore = (store, tokenId = getSelectedTokenId()) => {
    const normalizedStore = normalizeSavedLineupStore(store);
    savedLineups.value = normalizedStore.lineups;
    if (tokenId) {
      writeSavedLineupStoreToLocal(tokenId, normalizedStore);
    }
    return normalizedStore;
  };

  const scheduleSavedLineupsCloudSync = (
    tokenId = getSelectedTokenId(),
    store = buildSavedLineupStore(savedLineups.value),
  ) => {
    if (!authStore.isAuthenticated || !tokenId) {
      return;
    }
    clearLineupCloudTimer();
    const payload = normalizeSavedLineupStore(store);
    lineupCloudTimer = setTimeout(async () => {
      lineupCloudTimer = null;
      if (tokenId !== getSelectedTokenId()) {
        return;
      }
      lineupCloudSyncing.value = true;
      try {
        await pushSavedLineupsToCloud(tokenId, payload);
      } catch (error) {
        console.warn("同步已保存阵容到服务器失败:", error?.message || error);
      } finally {
        lineupCloudSyncing.value = false;
      }
    }, 300);
  };

  const persistSavedLineups = ({ updatedAt = Date.now(), syncCloud = true } = {}) => {
    const tokenId = getSelectedTokenId();
    if (!tokenId) {
      return buildSavedLineupStore([], 0);
    }
    const store = buildSavedLineupStore(savedLineups.value, updatedAt);
    savedLineups.value = store.lineups;
    writeSavedLineupStoreToLocal(tokenId, store);
    if (syncCloud) {
      scheduleSavedLineupsCloudSync(tokenId, store);
    }
    return store;
  };

  const loadSavedLineups = async ({ silent = true } = {}) => {
    let currentSeq = 0;
    try {
      const tokenId = getSelectedTokenId();
      savedLineupsLoadSeq += 1;
      currentSeq = savedLineupsLoadSeq;

      if (!tokenId) {
        savedLineups.value = [];
        return;
      }

      const localStore = readSavedLineupStoreFromLocal(tokenId);
      savedLineups.value = localStore.lineups;

      if (!authStore.isAuthenticated) {
        return;
      }

      lineupCloudLoading.value = true;
      const remoteStore = await readSavedLineupStoreFromCloud(tokenId);
      if (currentSeq !== savedLineupsLoadSeq || tokenId !== getSelectedTokenId()) {
        return;
      }

      let resolvedStore = localStore;
      let shouldPushLocal = false;

      if (remoteStore.lineups.length === 0) {
        shouldPushLocal = localStore.lineups.length > 0;
      } else if (localStore.lineups.length === 0) {
        resolvedStore = remoteStore;
      } else if (remoteStore.updatedAt > localStore.updatedAt) {
        resolvedStore = remoteStore;
      } else if (localStore.updatedAt > remoteStore.updatedAt) {
        shouldPushLocal = true;
      } else {
        resolvedStore = mergeSavedLineupStores(localStore, remoteStore);
        shouldPushLocal =
          JSON.stringify(resolvedStore.lineups) !==
          JSON.stringify(remoteStore.lineups);
      }

      const localChanged =
        JSON.stringify(resolvedStore.lineups) !==
          JSON.stringify(localStore.lineups) ||
        Number(resolvedStore.updatedAt || 0) !==
          Number(localStore.updatedAt || 0);

      if (localChanged) {
        applySavedLineupStore(resolvedStore, tokenId);
        if (!silent && remoteStore.updatedAt >= localStore.updatedAt) {
          message.success("已从服务器同步已保存阵容");
        }
      }

      if (shouldPushLocal) {
        await pushSavedLineupsToCloud(tokenId, resolvedStore);
      }
    } catch (error) {
      console.error("加载保存的阵容失败:", error);
      if (!getSelectedTokenId()) {
        savedLineups.value = [];
      }
      if (!silent) {
        message.error(`读取服务器阵容失败: ${error?.message || error}`);
      }
    } finally {
      if (currentSeq === 0 || currentSeq === savedLineupsLoadSeq) {
        lineupCloudLoading.value = false;
      }
    }
  };

  return {
    clearLineupCloudTimer,
    lineupCloudLoading,
    lineupCloudSyncing,
    loadSavedLineups,
    persistSavedLineups,
    pushSavedLineupsToCloud,
  };
};
