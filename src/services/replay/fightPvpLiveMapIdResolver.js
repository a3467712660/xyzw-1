import { extractPvpMapDressUsedId } from "./fightPvpReplayDressSnapshot.js";

const FALLBACK_PVP_MAP_DRESS_TYPE = 6;
const PVP_MAP_DRESS_TYPE_KEYS = Object.freeze([
  FALLBACK_PVP_MAP_DRESS_TYPE,
  String(FALLBACK_PVP_MAP_DRESS_TYPE),
  "pvpMap",
  "PVPMap",
  "PVP_MAP",
  "pvp_map",
]);
const PVP_MAP_CONF_MODULE_NAMES = Object.freeze([
  "Configs",
  "data-index",
  "ConfigsExt",
  "consts",
  "../../../../../launcher/config/Configs",
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

const getGlobalRequire = () => {
  if (typeof globalThis === "undefined") {
    return null;
  }

  return typeof globalThis.__require === "function"
    ? globalThis.__require
    : null;
};

const getPvpMapConfLookup = (configsLike = null) => {
  const configCandidate = configsLike?.PVPMapConf
    || configsLike?.default?.PVPMapConf
    || configsLike?.Configs?.PVPMapConf
    || null;
  if (configCandidate?.getById) {
    return configCandidate;
  }

  const globalLookup = globalThis?.PVPMapConf;
  if (globalLookup?.getById) {
    return globalLookup;
  }

  const requireFn = getGlobalRequire();
  if (!requireFn) {
    return null;
  }

  for (const moduleName of PVP_MAP_CONF_MODULE_NAMES) {
    try {
      const requiredModule = requireFn(moduleName);
      const moduleCandidate = requiredModule?.PVPMapConf
        || requiredModule?.default?.PVPMapConf
        || null;
      if (moduleCandidate?.getById) {
        return moduleCandidate;
      }
    } catch {
      // Ignore runtime-only require failures.
    }
  }

  return null;
};

const resolveDressTypeKeys = (configsLike = null) => {
  const keys = new Set(PVP_MAP_DRESS_TYPE_KEYS);
  const runtimeDressType = configsLike?.EMDressType
    || configsLike?.default?.EMDressType
    || null;
  const runtimeValue = runtimeDressType?.pvpMap;
  if (runtimeValue !== undefined && runtimeValue !== null && runtimeValue !== "") {
    keys.add(runtimeValue);
    keys.add(String(runtimeValue));
  }

  const requireFn = getGlobalRequire();
  if (!requireFn) {
    return [...keys];
  }

  for (const moduleName of PVP_MAP_CONF_MODULE_NAMES) {
    try {
      const requiredModule = requireFn(moduleName);
      const dressEnum = requiredModule?.EMDressType
        || requiredModule?.default?.EMDressType
        || null;
      const candidateValue = dressEnum?.pvpMap;
      if (candidateValue !== undefined && candidateValue !== null && candidateValue !== "") {
        keys.add(candidateValue);
        keys.add(String(candidateValue));
      }
    } catch {
      // Ignore runtime-only require failures.
    }
  }

  return [...keys];
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

const buildLiveMapIdResult = ({
  ok = false,
  mapId = null,
  pvpMapId = null,
  source = null,
  reason = null,
  dressPvpMapUsedId = null,
  selfRoleContextSource = null,
} = {}) => ({
  ok: Boolean(ok),
  mapId: toPositiveNumber(mapId, null),
  pvpMapId: toPositiveNumber(pvpMapId, null),
  source: toNonEmptyString(source) || null,
  reason: toNonEmptyString(reason) || null,
  dressPvpMapUsedId: toPositiveNumber(dressPvpMapUsedId, null),
  selfRoleContextSource: toNonEmptyString(selfRoleContextSource) || null,
});

const buildRoleCandidates = (roleLike) => {
  const source = toPlainObject(roleLike);
  if (!source) {
    return [];
  }

  return [
    {
      path: "selfRole.role.pvpMapId",
      value: source?.role?.pvpMapId,
    },
    {
      path: "selfRole.roleInfo.role.pvpMapId",
      value: source?.roleInfo?.role?.pvpMapId,
    },
    {
      path: "selfRole.roleInfo.pvpMapId",
      value: source?.roleInfo?.pvpMapId,
    },
    {
      path: "selfRole.pvpMapId",
      value: source?.pvpMapId,
    },
  ];
};

const buildDressCandidates = (roleLike) => {
  const source = toPlainObject(roleLike);
  if (!source) {
    return [];
  }

  return [
    {
      path: "selfRole.role.dress",
      value: source?.role?.dress,
    },
    {
      path: "selfRole.roleInfo.role.dress",
      value: source?.roleInfo?.role?.dress,
    },
    {
      path: "selfRole.roleInfo.dress",
      value: source?.roleInfo?.dress,
    },
    {
      path: "selfRole.dress",
      value: source?.dress,
    },
  ].filter((item) => item.value);
};

export const resolveFightPvpMapIdFromLiveRole = (
  roleLike,
  configsLike = null,
) => {
  const source = toPlainObject(roleLike);
  if (!source) {
    return buildLiveMapIdResult({
      reason: "missing-self-role",
    });
  }

  for (const candidate of buildRoleCandidates(source)) {
    const resolvedPvpMapId = toPositiveNumber(candidate.value, null);
    if (!resolvedPvpMapId) {
      continue;
    }

    return buildLiveMapIdResult({
      ok: true,
      mapId: resolvedPvpMapId,
      pvpMapId: resolvedPvpMapId,
      source: candidate.path,
    });
  }

  const dressCandidates = buildDressCandidates(source);
  if (dressCandidates.length === 0) {
    return buildLiveMapIdResult({
      reason: "missing-dress",
    });
  }

  const dressTypeKeys = resolveDressTypeKeys(configsLike);
  let firstDressUsedId = null;

  for (const candidate of dressCandidates) {
    const fallbackUsedId = extractPvpMapDressUsedId(candidate.value);
    for (const typeKey of dressTypeKeys) {
      const entry = getDressEntryFromCollection(candidate.value, typeKey);
      const usedId = toPositiveNumber(
        getDressEntryUsedId(entry),
        fallbackUsedId,
      );
      if (!usedId) {
        continue;
      }

      firstDressUsedId = usedId;
      const pvpMapConf = getPvpMapConfLookup(configsLike);
      if (!pvpMapConf?.getById) {
        return buildLiveMapIdResult({
          reason: "missing-pvp-map-conf",
          dressPvpMapUsedId: usedId,
        });
      }

      const pvpMapConfig = pvpMapConf.getById(usedId);
      const mapId = toPositiveNumber(pvpMapConfig?.mapId, null);
      if (!mapId) {
        return buildLiveMapIdResult({
          reason: "missing-pvp-map-conf-map-id",
          dressPvpMapUsedId: usedId,
        });
      }

      return buildLiveMapIdResult({
        ok: true,
        mapId,
        pvpMapId: mapId,
        source: "selfRole.dress:PVPMapConf",
        dressPvpMapUsedId: usedId,
      });
    }
  }

  return buildLiveMapIdResult({
    reason: firstDressUsedId ? "missing-pvp-map-conf-map-id" : "missing-dress-used",
    dressPvpMapUsedId: firstDressUsedId,
  });
};

export const resolveFightPvpMapIdFromLiveContext = (context = {}) => {
  const candidates = [
    {
      selfRoleContextSource: "selfRoleRaw",
      value: context?.selfRoleRaw,
    },
    {
      selfRoleContextSource: "selectedTokenRoleInfo",
      value: context?.selectedTokenRoleInfo,
    },
    {
      selfRoleContextSource: "tokenStore.gameData.roleInfo",
      value: context?.tokenStoreRoleInfo,
    },
    {
      selfRoleContextSource: "liveContext.tokenStoreRoleInfo",
      value: context?.liveContext?.tokenStoreRoleInfo,
    },
  ];

  let firstFailure = null;
  for (const candidate of candidates) {
    const resolved = resolveFightPvpMapIdFromLiveRole(
      candidate.value,
      context?.configsLike,
    );
    if (resolved.ok) {
      return {
        ...resolved,
        selfRoleContextSource: candidate.selfRoleContextSource,
      };
    }

    if (
      !firstFailure
      || firstFailure.reason === "missing-self-role"
    ) {
      firstFailure = {
        ...resolved,
        selfRoleContextSource: candidate.value
          ? candidate.selfRoleContextSource
          : firstFailure?.selfRoleContextSource || null,
      };
    }
  }

  return firstFailure || buildLiveMapIdResult({
    reason: "missing-self-role",
  });
};

export const ensureFightPvpSelfRoleContext = async ({
  tokenStore,
  selectedToken,
  backendClient: _backendClient,
} = {}) => {
  const selectedTokenId = String(
    selectedToken?.id || tokenStore?.selectedToken?.id || "",
  ).trim();
  const selectedTokenRoleInfo = tokenStore?.selectedTokenRoleInfo || null;
  const tokenStoreRoleInfo = tokenStore?.gameData?.roleInfo
    || tokenStore?.gameData?.value?.roleInfo
    || null;

  if (selectedTokenRoleInfo) {
    return {
      ok: true,
      roleInfo: selectedTokenRoleInfo,
      refreshed: false,
      reason: null,
      selfRoleContextSource: "selectedTokenRoleInfo",
    };
  }

  if (tokenStoreRoleInfo) {
    return {
      ok: true,
      roleInfo: tokenStoreRoleInfo,
      refreshed: false,
      reason: null,
      selfRoleContextSource: "tokenStore.gameData.roleInfo",
    };
  }

  if (!selectedTokenId || typeof tokenStore?.sendGetRoleInfo !== "function") {
    return {
      ok: false,
      roleInfo: null,
      refreshed: false,
      reason: "missing-self-role",
      selfRoleContextSource: null,
    };
  }

  try {
    const roleInfo = await tokenStore.sendGetRoleInfo(selectedTokenId);
    if (!roleInfo) {
      return {
        ok: false,
        roleInfo: null,
        refreshed: true,
        reason: "missing-self-role-after-refresh",
        selfRoleContextSource: "refreshed-role_getroleinfo",
      };
    }

    return {
      ok: true,
      roleInfo,
      refreshed: true,
      reason: null,
      selfRoleContextSource: "refreshed-role_getroleinfo",
    };
  } catch {
    return {
      ok: false,
      roleInfo: null,
      refreshed: true,
      reason: "missing-self-role-after-refresh",
      selfRoleContextSource: "refreshed-role_getroleinfo",
    };
  }
};

export const getFightPvpLiveMapIdReasonMessageKey = (reason) => {
  switch (reason) {
    case "missing-self-role":
      return "fightPvpCard.replay.mapIdReasons.missingSelfRole";
    case "missing-self-role-after-refresh":
      return "fightPvpCard.replay.mapIdReasons.missingSelfRoleAfterRefresh";
    case "missing-dress":
      return "fightPvpCard.replay.mapIdReasons.missingDress";
    case "missing-dress-used":
      return "fightPvpCard.replay.mapIdReasons.missingDressUsed";
    case "missing-pvp-map-conf":
      return "fightPvpCard.replay.mapIdReasons.missingPvpMapConf";
    case "missing-pvp-map-conf-map-id":
      return "fightPvpCard.replay.mapIdReasons.missingPvpMapConfMapId";
    case "missing-pvp-map-id":
    default:
      return "fightPvpCard.replay.mapIdReasons.missingPvpMapId";
  }
};
