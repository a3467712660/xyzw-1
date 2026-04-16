import { readFightPvpRuntimeMapIdContext } from "./fightPvpRuntimeMapIdBridge.js";

export const FIGHT_PVP_RUNTIME_MAP_ID_REASONS = Object.freeze({
  RUNTIME_SELF_ROLE_UNAVAILABLE: "runtime-self-role-unavailable",
  RUNTIME_ROLE_MISSING_PVP_MAP_ID: "runtime-role-missing-pvp-map-id",
  BATTLE_INPUT_MAP_ID_MISSING_BEFORE_SNAPSHOT: "battle-input-map-id-missing-before-snapshot",
  ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID: "role-payload-missing-explicit-pvp-map-id",
  DRESS_AMBIGUOUS: "dress-ambiguous",
  PVP_MAP_CONF_UNAVAILABLE: "pvp-map-conf-unavailable",
  PVP_MAP_CONF_MAP_ID_MISSING: "pvp-map-conf-map-id-missing",
});

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

const uniquePush = (list, value) => {
  if (!Array.isArray(list) || !value) {
    return;
  }
  if (!list.includes(value)) {
    list.push(value);
  }
};

const toDiagnosticValue = (value, depth = 0) => {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  const valueType = typeof value;
  if (valueType === "string" || valueType === "number" || valueType === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    if (depth >= 1) {
      return {
        type: "array",
        length: value.length,
      };
    }
    return value.slice(0, 6).map((item) => toDiagnosticValue(item, depth + 1));
  }

  if (value instanceof Map) {
    return {
      type: "Map",
      size: value.size,
      keys: [...value.keys()].slice(0, 6),
    };
  }

  if (valueType === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }

  if (valueType === "object") {
    const source = toPlainObject(value) || {};
    const keys = Object.keys(source);
    const picked = {};
    const preferredKeys = [
      "roleId",
      "roleid",
      "type",
      "dressType",
      "used",
      "itemId",
      "mapId",
      "pvpMapId",
      "name",
    ];

    for (const key of preferredKeys) {
      if (key in source) {
        picked[key] = toDiagnosticValue(source[key], depth + 1);
      }
    }

    if (Object.keys(picked).length > 0) {
      return picked;
    }

    return {
      type: "object",
      keys: keys.slice(0, 8),
    };
  }

  return String(value);
};

const createDiagnostics = () => ({
  tried: [],
  values: {},
  availableValues: {},
});

const recordCandidate = (diagnostics, path, rawValue) => {
  if (!diagnostics || !path) {
    return;
  }

  uniquePush(diagnostics.tried, path);
  const diagnosticValue = toDiagnosticValue(rawValue);
  diagnostics.values[path] = diagnosticValue;

  const positiveValue = toPositiveNumber(rawValue, null);
  const hasContent
    = positiveValue !== null
      || (typeof rawValue === "string" && rawValue.trim())
      || rawValue === true;
  if (hasContent) {
    diagnostics.availableValues[path] = diagnosticValue;
  }
};

const mergeDiagnostics = (target, source) => {
  if (!target || !source) {
    return;
  }

  for (const item of source.tried || []) {
    uniquePush(target.tried, item);
  }
  Object.assign(target.values, source.values || {});
  Object.assign(target.availableValues, source.availableValues || {});
};

const buildRuntimeMapIdResult = ({
  ok = false,
  mapId = null,
  pvpMapId = null,
  source = null,
  reason = null,
  dressPvpMapUsedId = null,
  dressPvpMapMapId = null,
  selfRoleContextSource = null,
  runtimeRoleAvailable = false,
  battleInputAvailable = false,
  diagnostics = null,
} = {}) => ({
  ok: Boolean(ok),
  mapId: toPositiveNumber(mapId, null),
  pvpMapId: toPositiveNumber(pvpMapId, toPositiveNumber(mapId, null)),
  source: toNonEmptyString(source) || null,
  mapIdSource: toNonEmptyString(source) || null,
  pvpMapIdSource: toNonEmptyString(source) || null,
  reason: toNonEmptyString(reason) || null,
  mapIdResolveReason: toNonEmptyString(reason) || null,
  dressPvpMapUsedId: toPositiveNumber(dressPvpMapUsedId, null),
  dressPvpMapMapId: toPositiveNumber(dressPvpMapMapId, null),
  selfRoleContextSource: toNonEmptyString(selfRoleContextSource) || null,
  runtimeRoleAvailable: Boolean(runtimeRoleAvailable),
  battleInputAvailable: Boolean(battleInputAvailable),
  diagnostics: diagnostics || createDiagnostics(),
});

const resolvePvpMapConfLookup = (configsLike = null) => {
  const resolvedPvpMapConf = configsLike?.PVPMapConf
    || configsLike?.default?.PVPMapConf
    || configsLike?.Configs?.PVPMapConf
    || globalThis?.PVPMapConf
    || null;

  return resolvedPvpMapConf?.getById ? resolvedPvpMapConf : null;
};

const resolveDressTypeValue = (configsLike = null) => {
  const explicitDressType = configsLike?.EMDressType?.pvpMap
    ?? configsLike?.default?.EMDressType?.pvpMap
    ?? configsLike?.Configs?.EMDressType?.pvpMap;
  if (explicitDressType !== undefined && explicitDressType !== null && explicitDressType !== "") {
    return explicitDressType;
  }

  const globalDressType = globalThis?.EMDressType?.pvpMap;
  if (globalDressType !== undefined && globalDressType !== null && globalDressType !== "") {
    return globalDressType;
  }

  return null;
};

const getDressEntryFromCollection = (collection, typeKey) => {
  if (!collection) {
    return null;
  }

  if (collection instanceof Map) {
    return collection.get(typeKey) || collection.get(String(typeKey)) || null;
  }

  if (typeof collection.get === "function") {
    try {
      const entry = collection.get(typeKey) || collection.get(String(typeKey));
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

const hasNamedPvpMapEntry = (collection) => {
  if (!collection) {
    return false;
  }

  if (collection instanceof Map) {
    return collection.has("pvpMap") || collection.has("PVPMap");
  }

  if (typeof collection.get === "function") {
    try {
      if (collection.get("pvpMap") || collection.get("PVPMap")) {
        return true;
      }
    } catch {
      // Ignore custom map-like getter failures.
    }
  }

  const source = toPlainObject(collection);
  if (!source) {
    return false;
  }

  if (source.pvpMap || source.PVPMap) {
    return true;
  }

  return Object.values(source).some((value) => {
    const entry = toPlainObject(value);
    if (!entry) {
      return false;
    }
    const entryType = toNonEmptyString(entry.type, entry.dressType, entry.key, entry.name);
    return entryType === "pvpMap" || entryType === "PVPMap";
  });
};

const resolveDressTypeKeys = ({
  dressCollections = [],
  configsLike = null,
  diagnostics = null,
  diagnosticPrefix = "dress",
} = {}) => {
  const explicitDressType = resolveDressTypeValue(configsLike);
  recordCandidate(diagnostics, `${diagnosticPrefix}.EMDressType.pvpMap`, explicitDressType);

  if (explicitDressType !== null) {
    return {
      ambiguous: false,
      keys: [explicitDressType, String(explicitDressType), "pvpMap", "PVPMap"],
      source: "EMDressType.pvpMap",
    };
  }

  if (dressCollections.some((collection) => hasNamedPvpMapEntry(collection))) {
    recordCandidate(diagnostics, `${diagnosticPrefix}.namedEntry`, "pvpMap");
    return {
      ambiguous: false,
      keys: ["pvpMap", "PVPMap"],
      source: "dress.pvpMap",
    };
  }

  return {
    ambiguous: dressCollections.length > 0,
    keys: [],
    source: null,
  };
};

const resolveRolePvpMapCandidates = (roleLike, basePath) => {
  const source = toPlainObject(roleLike);
  if (!source) {
    return [];
  }

  return [
    {
      path: `${basePath}.role.pvpMapId`,
      value: source?.role?.pvpMapId,
    },
    {
      path: `${basePath}.roleInfo.role.pvpMapId`,
      value: source?.roleInfo?.role?.pvpMapId,
    },
    {
      path: `${basePath}.roleInfo.pvpMapId`,
      value: source?.roleInfo?.pvpMapId,
    },
    {
      path: `${basePath}.pvpMapId`,
      value: source?.pvpMapId,
    },
  ];
};

const resolveRoleDressCandidates = (roleLike, basePath) => {
  const source = toPlainObject(roleLike);
  if (!source) {
    return [];
  }

  return [
    {
      path: `${basePath}.role.dress`,
      value: source?.role?.dress,
    },
    {
      path: `${basePath}.roleInfo.role.dress`,
      value: source?.roleInfo?.role?.dress,
    },
    {
      path: `${basePath}.roleInfo.dress`,
      value: source?.roleInfo?.dress,
    },
    {
      path: `${basePath}.dress`,
      value: source?.dress,
    },
  ].filter((item) => item.value);
};

const selectBestFailure = (currentFailure, nextFailure) => {
  if (!nextFailure) {
    return currentFailure;
  }

  if (!currentFailure) {
    return nextFailure;
  }

  const priority = {
    [FIGHT_PVP_RUNTIME_MAP_ID_REASONS.DRESS_AMBIGUOUS]: 60,
    [FIGHT_PVP_RUNTIME_MAP_ID_REASONS.PVP_MAP_CONF_UNAVAILABLE]: 55,
    [FIGHT_PVP_RUNTIME_MAP_ID_REASONS.PVP_MAP_CONF_MAP_ID_MISSING]: 50,
    [FIGHT_PVP_RUNTIME_MAP_ID_REASONS.ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID]: 40,
    [FIGHT_PVP_RUNTIME_MAP_ID_REASONS.BATTLE_INPUT_MAP_ID_MISSING_BEFORE_SNAPSHOT]: 30,
    [FIGHT_PVP_RUNTIME_MAP_ID_REASONS.RUNTIME_ROLE_MISSING_PVP_MAP_ID]: 20,
    [FIGHT_PVP_RUNTIME_MAP_ID_REASONS.RUNTIME_SELF_ROLE_UNAVAILABLE]: 10,
  };

  return (priority[nextFailure.reason] || 0) >= (priority[currentFailure.reason] || 0)
    ? nextFailure
    : currentFailure;
};

export const resolveFightPvpMapIdFromRuntimeContext = ({
  runtimeContext = null,
} = {}) => {
  const diagnostics = createDiagnostics();
  const resolvedRuntimeContext = runtimeContext || readFightPvpRuntimeMapIdContext();
  const runtimeRole = resolvedRuntimeContext?.runtimeRole || resolvedRuntimeContext?.role || null;
  recordCandidate(diagnostics, "runtime.roleSource", resolvedRuntimeContext?.runtimeRoleSource || null);

  if (!runtimeRole) {
    return buildRuntimeMapIdResult({
      reason: FIGHT_PVP_RUNTIME_MAP_ID_REASONS.RUNTIME_SELF_ROLE_UNAVAILABLE,
      runtimeRoleAvailable: false,
      selfRoleContextSource: resolvedRuntimeContext?.runtimeRoleSource || null,
      diagnostics,
    });
  }

  const candidates = [
    {
      path: "runtime.ROLE.pvpMapId",
      value: runtimeRole?.pvpMapId,
    },
    {
      path: "runtime.ROLE.role.pvpMapId",
      value: runtimeRole?.role?.pvpMapId,
    },
    {
      path: "runtime.ROLE.roleInfo.pvpMapId",
      value: runtimeRole?.roleInfo?.pvpMapId,
    },
  ];

  for (const candidate of candidates) {
    recordCandidate(diagnostics, candidate.path, candidate.value);
    const mapId = toPositiveNumber(candidate.value, null);
    if (!mapId) {
      continue;
    }

    return buildRuntimeMapIdResult({
      ok: true,
      mapId,
      pvpMapId: mapId,
      source: candidate.path,
      runtimeRoleAvailable: true,
      selfRoleContextSource: resolvedRuntimeContext?.runtimeRoleSource || "runtime-role",
      diagnostics,
    });
  }

  return buildRuntimeMapIdResult({
    reason: FIGHT_PVP_RUNTIME_MAP_ID_REASONS.RUNTIME_ROLE_MISSING_PVP_MAP_ID,
    runtimeRoleAvailable: true,
    selfRoleContextSource: resolvedRuntimeContext?.runtimeRoleSource || "runtime-role",
    diagnostics,
  });
};

export const resolveFightPvpMapIdFromBattleInput = ({
  battleInput = null,
} = {}) => {
  const diagnostics = createDiagnostics();
  const source = toPlainObject(battleInput);
  const candidates = [
    {
      path: "battleInput.battleInputData.mapId",
      value: source?.battleInputData?.mapId,
      available: Boolean(source?.battleInputData),
    },
    {
      path: "battleInput.battleInputSnapshot.mapId",
      value: source?.battleInputSnapshot?.mapId,
      available: Boolean(source?.battleInputSnapshot),
    },
    {
      path: "battleInput.battleInputCandidate.mapId",
      value: source?.battleInputCandidate?.mapId,
      available: Boolean(source?.battleInputCandidate),
    },
    {
      path: "battleInput.mapId",
      value: source?.mapId,
      available: Boolean(
        source?.battleEnd
        || source?.options
        || source?.stageNameStr
        || source?.startTipStage,
      ),
    },
  ];

  let battleInputAvailable = false;
  for (const candidate of candidates) {
    if (!candidate.available) {
      continue;
    }

    battleInputAvailable = true;
    recordCandidate(diagnostics, candidate.path, candidate.value);
    const mapId = toPositiveNumber(candidate.value, null);
    if (!mapId) {
      continue;
    }

    return buildRuntimeMapIdResult({
      ok: true,
      mapId,
      pvpMapId: mapId,
      source: candidate.path,
      battleInputAvailable: true,
      diagnostics,
    });
  }

  return buildRuntimeMapIdResult({
    reason: battleInputAvailable
      ? FIGHT_PVP_RUNTIME_MAP_ID_REASONS.BATTLE_INPUT_MAP_ID_MISSING_BEFORE_SNAPSHOT
      : null,
    battleInputAvailable,
    diagnostics,
  });
};

export const resolveFightPvpMapIdFromRolePayload = ({
  rolePayload = null,
  configsLike = null,
  selfRoleContextSource = null,
  diagnosticBasePath = "selfRolePayload",
} = {}) => {
  const diagnostics = createDiagnostics();
  const source = toPlainObject(rolePayload);
  if (!source) {
    return buildRuntimeMapIdResult({
      reason: FIGHT_PVP_RUNTIME_MAP_ID_REASONS.RUNTIME_SELF_ROLE_UNAVAILABLE,
      selfRoleContextSource,
      diagnostics,
    });
  }

  for (const candidate of resolveRolePvpMapCandidates(source, diagnosticBasePath)) {
    recordCandidate(diagnostics, candidate.path, candidate.value);
    const mapId = toPositiveNumber(candidate.value, null);
    if (!mapId) {
      continue;
    }

    return buildRuntimeMapIdResult({
      ok: true,
      mapId,
      pvpMapId: mapId,
      source: candidate.path,
      selfRoleContextSource,
      diagnostics,
    });
  }

  const dressCandidates = resolveRoleDressCandidates(source, diagnosticBasePath);
  const dressCollections = dressCandidates.map((candidate) => candidate.value);
  const dressTypeResolution = resolveDressTypeKeys({
    dressCollections,
    configsLike,
    diagnostics,
    diagnosticPrefix: `${diagnosticBasePath}.dress`,
  });

  if (dressCandidates.length === 0) {
    return buildRuntimeMapIdResult({
      reason: FIGHT_PVP_RUNTIME_MAP_ID_REASONS.ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID,
      selfRoleContextSource,
      diagnostics,
    });
  }

  if (dressTypeResolution.ambiguous) {
    return buildRuntimeMapIdResult({
      reason: FIGHT_PVP_RUNTIME_MAP_ID_REASONS.DRESS_AMBIGUOUS,
      selfRoleContextSource,
      diagnostics,
    });
  }

  let firstUsedId = null;
  for (const candidate of dressCandidates) {
    recordCandidate(diagnostics, candidate.path, candidate.value);

    for (const typeKey of dressTypeResolution.keys) {
      const entry = getDressEntryFromCollection(candidate.value, typeKey);
      recordCandidate(diagnostics, `${candidate.path}.${String(typeKey)}`, entry);
      const usedId = getDressEntryUsedId(entry);
      if (!usedId) {
        continue;
      }

      firstUsedId = usedId;
      const pvpMapConf = resolvePvpMapConfLookup(configsLike);
      recordCandidate(diagnostics, `${candidate.path}.PVPMapConf.available`, Boolean(pvpMapConf));
      if (!pvpMapConf?.getById) {
        return buildRuntimeMapIdResult({
          reason: FIGHT_PVP_RUNTIME_MAP_ID_REASONS.PVP_MAP_CONF_UNAVAILABLE,
          dressPvpMapUsedId: usedId,
          selfRoleContextSource,
          diagnostics,
        });
      }

      const pvpMapConfig = pvpMapConf.getById(usedId);
      const mapId = toPositiveNumber(pvpMapConfig?.mapId, null);
      recordCandidate(diagnostics, `${candidate.path}.PVPMapConf[${usedId}].mapId`, pvpMapConfig?.mapId);
      if (!mapId) {
        return buildRuntimeMapIdResult({
          reason: FIGHT_PVP_RUNTIME_MAP_ID_REASONS.PVP_MAP_CONF_MAP_ID_MISSING,
          dressPvpMapUsedId: usedId,
          selfRoleContextSource,
          diagnostics,
        });
      }

      return buildRuntimeMapIdResult({
        ok: true,
        mapId,
        pvpMapId: mapId,
        source: `${candidate.path}.PVPMapConf.mapId`,
        dressPvpMapUsedId: usedId,
        dressPvpMapMapId: mapId,
        selfRoleContextSource,
        diagnostics,
      });
    }
  }

  return buildRuntimeMapIdResult({
    reason: firstUsedId
      ? FIGHT_PVP_RUNTIME_MAP_ID_REASONS.PVP_MAP_CONF_MAP_ID_MISSING
      : FIGHT_PVP_RUNTIME_MAP_ID_REASONS.ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID,
    dressPvpMapUsedId: firstUsedId,
    selfRoleContextSource,
    diagnostics,
  });
};

export const resolveFightPvpMapIdForLiveCapture = ({
  runtimeContext = null,
  battleInput = null,
  selfRoleRaw = null,
  selectedTokenRoleInfo = null,
  tokenStoreRoleInfo = null,
  configsLike = null,
} = {}) => {
  const mergedDiagnostics = createDiagnostics();
  const resolvedRuntimeContext = runtimeContext || readFightPvpRuntimeMapIdContext();
  const runtimeResult = resolveFightPvpMapIdFromRuntimeContext({
    runtimeContext: resolvedRuntimeContext,
  });
  mergeDiagnostics(mergedDiagnostics, runtimeResult.diagnostics);
  if (runtimeResult.ok) {
    return {
      ...runtimeResult,
      battleInputAvailable: false,
      diagnostics: mergedDiagnostics,
    };
  }

  const battleInputResult = resolveFightPvpMapIdFromBattleInput({
    battleInput,
  });
  mergeDiagnostics(mergedDiagnostics, battleInputResult.diagnostics);
  if (battleInputResult.ok) {
    return {
      ...battleInputResult,
      runtimeRoleAvailable: runtimeResult.runtimeRoleAvailable,
      selfRoleContextSource: runtimeResult.selfRoleContextSource,
      diagnostics: mergedDiagnostics,
    };
  }

  const effectiveConfigsLike = configsLike || resolvedRuntimeContext?.configsLike || null;
  const roleCandidates = [
    {
      value: selfRoleRaw,
      source: "selfRoleRaw",
      path: "selfRoleRaw",
    },
    {
      value: selectedTokenRoleInfo,
      source: "selectedTokenRoleInfo",
      path: "selectedTokenRoleInfo",
    },
    {
      value: tokenStoreRoleInfo,
      source: "tokenStore.gameData.roleInfo",
      path: "tokenStore.gameData.roleInfo",
    },
  ];

  let roleFailure = null;
  for (const candidate of roleCandidates) {
    if (!candidate.value) {
      continue;
    }

    const roleResult = resolveFightPvpMapIdFromRolePayload({
      rolePayload: candidate.value,
      configsLike: effectiveConfigsLike,
      selfRoleContextSource: candidate.source,
      diagnosticBasePath: candidate.path,
    });
    mergeDiagnostics(mergedDiagnostics, roleResult.diagnostics);

    if (roleResult.ok) {
      return {
        ...roleResult,
        runtimeRoleAvailable: runtimeResult.runtimeRoleAvailable,
        battleInputAvailable: battleInputResult.battleInputAvailable,
        diagnostics: mergedDiagnostics,
      };
    }

    roleFailure = selectBestFailure(roleFailure, roleResult);
  }

  const finalFailure = selectBestFailure(
    selectBestFailure(runtimeResult, battleInputResult.reason ? battleInputResult : null),
    roleFailure,
  ) || runtimeResult;

  return {
    ...finalFailure,
    runtimeRoleAvailable: runtimeResult.runtimeRoleAvailable,
    battleInputAvailable: battleInputResult.battleInputAvailable,
    diagnostics: mergedDiagnostics,
  };
};

export const getFightPvpRuntimeMapIdReasonMessageKey = (reason) => {
  switch (reason) {
    case FIGHT_PVP_RUNTIME_MAP_ID_REASONS.RUNTIME_SELF_ROLE_UNAVAILABLE:
    case "missing-self-role":
    case "missing-self-role-after-refresh":
      return "fightPvpCard.replay.mapIdReasons.runtimeSelfRoleUnavailable";
    case FIGHT_PVP_RUNTIME_MAP_ID_REASONS.RUNTIME_ROLE_MISSING_PVP_MAP_ID:
    case "missing-pvp-map-id":
      return "fightPvpCard.replay.mapIdReasons.runtimeRoleMissingPvpMapId";
    case FIGHT_PVP_RUNTIME_MAP_ID_REASONS.BATTLE_INPUT_MAP_ID_MISSING_BEFORE_SNAPSHOT:
      return "fightPvpCard.replay.mapIdReasons.battleInputMapIdMissingBeforeSnapshot";
    case FIGHT_PVP_RUNTIME_MAP_ID_REASONS.ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID:
    case "missing-dress":
    case "missing-dress-used":
      return "fightPvpCard.replay.mapIdReasons.rolePayloadMissingExplicitPvpMapId";
    case FIGHT_PVP_RUNTIME_MAP_ID_REASONS.DRESS_AMBIGUOUS:
      return "fightPvpCard.replay.mapIdReasons.dressAmbiguous";
    case FIGHT_PVP_RUNTIME_MAP_ID_REASONS.PVP_MAP_CONF_UNAVAILABLE:
    case "missing-pvp-map-conf":
      return "fightPvpCard.replay.mapIdReasons.pvpMapConfUnavailable";
    case FIGHT_PVP_RUNTIME_MAP_ID_REASONS.PVP_MAP_CONF_MAP_ID_MISSING:
    case "missing-pvp-map-conf-map-id":
      return "fightPvpCard.replay.mapIdReasons.pvpMapConfMapIdMissing";
    default:
      return "fightPvpCard.replay.mapIdReasons.rolePayloadMissingExplicitPvpMapId";
  }
};
