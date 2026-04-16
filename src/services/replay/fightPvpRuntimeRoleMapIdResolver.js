import { readFightPvpRuntimeMapIdContext } from "./fightPvpRuntimeMapIdBridge.js";

export const FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID = 40001;
export const FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID_SOURCE = "fallback.defaultMapId.40001";

export const FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS = Object.freeze({
  RUNTIME_ROLE_UNAVAILABLE: "runtime-role-unavailable",
  RUNTIME_ROLE_NO_PVP_MAP_ID: "runtime-role-no-pvpMapId",
  BATTLE_INPUT_MAP_ID_NOT_WRITTEN: "battle-input-mapId-not-written",
  LEGACY_ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID:
    "legacy-role-payload-missing-explicit-pvpMapId",
  LEGACY_DRESS_AMBIGUOUS: "legacy-dress-ambiguous",
  LEGACY_PVP_MAP_CONF_UNAVAILABLE: "legacy-pvp-map-conf-unavailable",
  LEGACY_PVP_MAP_CONF_MAP_ID_MISSING: "legacy-pvp-map-conf-map-id-missing",
});

export const FIGHT_PVP_RUNTIME_MAP_ID_REASONS = Object.freeze({
  RUNTIME_SELF_ROLE_UNAVAILABLE:
    FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.RUNTIME_ROLE_UNAVAILABLE,
  RUNTIME_ROLE_MISSING_PVP_MAP_ID:
    FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.RUNTIME_ROLE_NO_PVP_MAP_ID,
  BATTLE_INPUT_MAP_ID_MISSING_BEFORE_SNAPSHOT:
    FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.BATTLE_INPUT_MAP_ID_NOT_WRITTEN,
  ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID:
    FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID,
  DRESS_AMBIGUOUS:
    FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_DRESS_AMBIGUOUS,
  PVP_MAP_CONF_UNAVAILABLE:
    FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_PVP_MAP_CONF_UNAVAILABLE,
  PVP_MAP_CONF_MAP_ID_MISSING:
    FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_PVP_MAP_CONF_MAP_ID_MISSING,
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

const buildRuntimeRoleMapIdResult = ({
  ok = false,
  mapId = null,
  pvpMapId = null,
  source = null,
  reason = null,
  dressPvpMapUsedId = null,
  dressPvpMapMapId = null,
  runtimeRoleAvailable = false,
  runtimeRolePath = null,
  selfRoleContextSource = null,
  battleInputAvailable = false,
  runtimeRoleMapId = null,
  diagnostics = null,
} = {}) => {
  const resolvedMapId = toPositiveNumber(mapId, null);
  const resolvedSource = toNonEmptyString(source) || null;
  const resolvedRuntimeRolePath = toNonEmptyString(runtimeRolePath) || null;
  const resolvedRuntimeRoleMapId = toPositiveNumber(
    runtimeRoleMapId,
    resolvedSource?.startsWith("runtime.")
      ? resolvedMapId
      : null,
  );

  return {
    ok: Boolean(ok),
    mapId: resolvedMapId,
    pvpMapId: toPositiveNumber(pvpMapId, resolvedMapId),
    source: resolvedSource,
    mapIdSource: resolvedSource,
    pvpMapIdSource: resolvedSource,
    reason: toNonEmptyString(reason) || null,
    mapIdResolveReason: toNonEmptyString(reason) || null,
    dressPvpMapUsedId: toPositiveNumber(dressPvpMapUsedId, null),
    dressPvpMapMapId: toPositiveNumber(dressPvpMapMapId, null),
    runtimeRoleAvailable: Boolean(runtimeRoleAvailable),
    runtimeRolePath: resolvedRuntimeRolePath,
    runtimeRoleMapId: resolvedRuntimeRoleMapId,
    selfRoleContextSource: toNonEmptyString(selfRoleContextSource) || null,
    battleInputAvailable: Boolean(battleInputAvailable),
    diagnostics: diagnostics || createDiagnostics(),
  };
};

const selectBestFailure = (currentFailure, nextFailure) => {
  if (!nextFailure) {
    return currentFailure;
  }

  if (!currentFailure) {
    return nextFailure;
  }

  const priority = {
    [FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.BATTLE_INPUT_MAP_ID_NOT_WRITTEN]: 80,
    [FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.RUNTIME_ROLE_NO_PVP_MAP_ID]: 70,
    [FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.RUNTIME_ROLE_UNAVAILABLE]: 60,
    [FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_DRESS_AMBIGUOUS]: 50,
    [FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_PVP_MAP_CONF_UNAVAILABLE]: 40,
    [FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_PVP_MAP_CONF_MAP_ID_MISSING]: 30,
    [FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID]: 20,
  };

  return (priority[nextFailure.reason] || 0) >= (priority[currentFailure.reason] || 0)
    ? nextFailure
    : currentFailure;
};

const buildDefaultFallbackMapIdResult = ({
  failure = null,
  runtimeRoleAvailable = false,
  runtimeRolePath = null,
  runtimeRoleMapId = null,
  selfRoleContextSource = null,
  battleInputAvailable = false,
  diagnostics = null,
} = {}) => {
  const mergedDiagnostics = diagnostics || createDiagnostics();
  recordCandidate(
    mergedDiagnostics,
    FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID_SOURCE,
    FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID,
  );

  return buildRuntimeRoleMapIdResult({
    ok: true,
    mapId: FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID,
    pvpMapId: FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID,
    source: FIGHT_PVP_DEFAULT_FALLBACK_MAP_ID_SOURCE,
    reason: failure?.reason || null,
    runtimeRoleAvailable,
    runtimeRolePath,
    runtimeRoleMapId,
    selfRoleContextSource,
    battleInputAvailable,
    diagnostics: mergedDiagnostics,
  });
};

const normalizeRuntimeRolePath = (value) => {
  const source = toNonEmptyString(value);
  if (!source) {
    return "runtime.selfRole";
  }

  if (source.includes(".ROLE")) {
    if (source.includes("window.ROLE")) {
      return "runtime.ROLE";
    }
    if (source.includes("ServerData.ROLE") || source.includes("serverData.ROLE")) {
      return "runtime.ServerData.ROLE";
    }
  }

  return source.startsWith("runtime.")
    ? source
    : "runtime.selfRole";
};

const resolveRuntimeRoleCandidates = ({
  runtimeRole = null,
  runtimeRolePath = "runtime.ROLE",
  runtimeRoleSource = null,
} = {}) => {
  const source = toPlainObject(runtimeRole);
  if (!source) {
    return [];
  }

  const normalizedRuntimeRolePath = normalizeRuntimeRolePath(runtimeRolePath || runtimeRoleSource);
  return [
    {
      path: `${normalizedRuntimeRolePath}.pvpMapId`,
      value: source?.pvpMapId,
    },
    {
      path: `${normalizedRuntimeRolePath}.role.pvpMapId`,
      value: source?.role?.pvpMapId,
    },
    {
      path: `${normalizedRuntimeRolePath}.roleInfo.pvpMapId`,
      value: source?.roleInfo?.pvpMapId,
    },
    {
      path: `${normalizedRuntimeRolePath}.roleInfo.role.pvpMapId`,
      value: source?.roleInfo?.role?.pvpMapId,
    },
  ];
};

export const resolveFightPvpMapIdFromRuntimeRole = ({
  runtimeRole = null,
  runtimeRolePath = "runtime.ROLE",
  runtimeRoleSource = null,
} = {}) => {
  const diagnostics = createDiagnostics();
  const source = toPlainObject(runtimeRole);
  const normalizedRuntimeRolePath = normalizeRuntimeRolePath(
    runtimeRolePath || runtimeRoleSource,
  );
  recordCandidate(diagnostics, "runtimeRole.path", normalizedRuntimeRolePath);
  recordCandidate(diagnostics, "runtimeRole.source", runtimeRoleSource);

  if (!source) {
    return buildRuntimeRoleMapIdResult({
      reason: FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.RUNTIME_ROLE_UNAVAILABLE,
      runtimeRoleAvailable: false,
      runtimeRolePath: normalizedRuntimeRolePath,
      selfRoleContextSource: runtimeRoleSource,
      diagnostics,
    });
  }

  for (const candidate of resolveRuntimeRoleCandidates({
    runtimeRole: source,
    runtimeRolePath: normalizedRuntimeRolePath,
    runtimeRoleSource,
  })) {
    recordCandidate(diagnostics, candidate.path, candidate.value);
    const mapId = toPositiveNumber(candidate.value, null);
    if (!mapId) {
      continue;
    }

    return buildRuntimeRoleMapIdResult({
      ok: true,
      mapId,
      pvpMapId: mapId,
      source: candidate.path,
      runtimeRoleAvailable: true,
      runtimeRolePath: normalizedRuntimeRolePath,
      runtimeRoleMapId: mapId,
      selfRoleContextSource: runtimeRoleSource,
      diagnostics,
    });
  }

  return buildRuntimeRoleMapIdResult({
    reason: FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.RUNTIME_ROLE_NO_PVP_MAP_ID,
    runtimeRoleAvailable: true,
    runtimeRolePath: normalizedRuntimeRolePath,
    selfRoleContextSource: runtimeRoleSource,
    diagnostics,
  });
};

const getRuntimeRoot = (runtimeContext = null) =>
  runtimeContext?.runtimeRoot
  || (typeof window !== "undefined" ? window : null)
  || globalThis;

export const resolveFightPvpMapIdFromRuntimeGlobals = ({
  runtimeContext = null,
  runtimeWindow = null,
} = {}) => {
  const mergedDiagnostics = createDiagnostics();
  const runtimeRoot = runtimeWindow || getRuntimeRoot(runtimeContext);
  const directCandidates = [
    {
      role: runtimeRoot?.ROLE,
      runtimeRolePath: "runtime.ROLE",
      runtimeRoleSource: "window.ROLE",
    },
    {
      role: runtimeRoot?.ServerData?.ROLE,
      runtimeRolePath: "runtime.ServerData.ROLE",
      runtimeRoleSource: "window.ServerData.ROLE",
    },
    {
      role: runtimeRoot?.serverData?.ROLE,
      runtimeRolePath: "runtime.ServerData.ROLE",
      runtimeRoleSource: "window.serverData.ROLE",
    },
  ];

  let bestFailure = null;
  for (const candidate of directCandidates) {
    if (!candidate.role) {
      continue;
    }

    const result = resolveFightPvpMapIdFromRuntimeRole({
      runtimeRole: candidate.role,
      runtimeRolePath: candidate.runtimeRolePath,
      runtimeRoleSource: candidate.runtimeRoleSource,
    });
    mergeDiagnostics(mergedDiagnostics, result.diagnostics);
    if (result.ok) {
      return {
        ...result,
        diagnostics: mergedDiagnostics,
      };
    }
    bestFailure = selectBestFailure(bestFailure, result);
  }

  const fallbackRuntimeContext = runtimeContext || readFightPvpRuntimeMapIdContext();
  if (fallbackRuntimeContext?.runtimeRole) {
    const result = resolveFightPvpMapIdFromRuntimeRole({
      runtimeRole: fallbackRuntimeContext.runtimeRole,
      runtimeRolePath: normalizeRuntimeRolePath(
        fallbackRuntimeContext.runtimeRoleSource,
      ),
      runtimeRoleSource: fallbackRuntimeContext.runtimeRoleSource,
    });
    mergeDiagnostics(mergedDiagnostics, result.diagnostics);
    if (result.ok) {
      return {
        ...result,
        diagnostics: mergedDiagnostics,
      };
    }
    bestFailure = selectBestFailure(bestFailure, result);
  }

  return {
    ...(
      bestFailure
      || buildRuntimeRoleMapIdResult({
        reason: FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.RUNTIME_ROLE_UNAVAILABLE,
        runtimeRoleAvailable: false,
        runtimeRolePath: "runtime.ROLE",
        selfRoleContextSource: fallbackRuntimeContext?.runtimeRoleSource || null,
      })
    ),
    diagnostics: mergedDiagnostics,
  };
};

const resolveFightPvpMapIdFromBattleInput = ({
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

    return buildRuntimeRoleMapIdResult({
      ok: true,
      mapId,
      pvpMapId: mapId,
      source: candidate.path,
      battleInputAvailable: true,
      diagnostics,
    });
  }

  return buildRuntimeRoleMapIdResult({
    reason: battleInputAvailable
      ? FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.BATTLE_INPUT_MAP_ID_NOT_WRITTEN
      : null,
    battleInputAvailable,
    diagnostics,
  });
};

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

export const resolveFightPvpMapIdFromRolePayload = ({
  rolePayload = null,
  configsLike = null,
  selfRoleContextSource = null,
  diagnosticBasePath = "selfRolePayload",
} = {}) => {
  const diagnostics = createDiagnostics();
  const source = toPlainObject(rolePayload);
  if (!source) {
    return buildRuntimeRoleMapIdResult({
      reason:
        FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID,
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

    return buildRuntimeRoleMapIdResult({
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
    return buildRuntimeRoleMapIdResult({
      reason:
        FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID,
      selfRoleContextSource,
      diagnostics,
    });
  }

  if (dressTypeResolution.ambiguous) {
    return buildRuntimeRoleMapIdResult({
      reason: FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_DRESS_AMBIGUOUS,
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
        return buildRuntimeRoleMapIdResult({
          reason:
            FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_PVP_MAP_CONF_UNAVAILABLE,
          dressPvpMapUsedId: usedId,
          selfRoleContextSource,
          diagnostics,
        });
      }

      const pvpMapConfig = pvpMapConf.getById(usedId);
      const mapId = toPositiveNumber(pvpMapConfig?.mapId, null);
      recordCandidate(
        diagnostics,
        `${candidate.path}.PVPMapConf[${usedId}].mapId`,
        pvpMapConfig?.mapId,
      );
      if (!mapId) {
        return buildRuntimeRoleMapIdResult({
          reason:
            FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_PVP_MAP_CONF_MAP_ID_MISSING,
          dressPvpMapUsedId: usedId,
          selfRoleContextSource,
          diagnostics,
        });
      }

      return buildRuntimeRoleMapIdResult({
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

  return buildRuntimeRoleMapIdResult({
    reason: firstUsedId
      ? FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_PVP_MAP_CONF_MAP_ID_MISSING
      : FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID,
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
  allowLegacyFallback = false,
} = {}) => {
  const mergedDiagnostics = createDiagnostics();
  const resolvedRuntimeContext = runtimeContext || readFightPvpRuntimeMapIdContext();
  const runtimeResult = resolveFightPvpMapIdFromRuntimeGlobals({
    runtimeContext: resolvedRuntimeContext,
  });
  mergeDiagnostics(mergedDiagnostics, runtimeResult.diagnostics);
  if (runtimeResult.ok) {
    return {
      ...runtimeResult,
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
      runtimeRolePath: runtimeResult.runtimeRolePath,
      runtimeRoleMapId: runtimeResult.runtimeRoleMapId,
      selfRoleContextSource: runtimeResult.selfRoleContextSource,
      diagnostics: mergedDiagnostics,
    };
  }

  if (!allowLegacyFallback) {
    const finalFailure = selectBestFailure(
      runtimeResult,
      battleInputResult.reason ? battleInputResult : null,
    ) || runtimeResult;

    return buildDefaultFallbackMapIdResult({
      failure: finalFailure,
      runtimeRoleAvailable: runtimeResult.runtimeRoleAvailable,
      runtimeRolePath: runtimeResult.runtimeRolePath,
      runtimeRoleMapId: runtimeResult.runtimeRoleMapId,
      battleInputAvailable: battleInputResult.battleInputAvailable,
      selfRoleContextSource: runtimeResult.selfRoleContextSource,
      diagnostics: mergedDiagnostics,
    });
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
        runtimeRolePath: runtimeResult.runtimeRolePath,
        runtimeRoleMapId: runtimeResult.runtimeRoleMapId,
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
    runtimeRolePath: runtimeResult.runtimeRolePath,
    runtimeRoleMapId: runtimeResult.runtimeRoleMapId,
    battleInputAvailable: battleInputResult.battleInputAvailable,
    selfRoleContextSource: runtimeResult.selfRoleContextSource,
    diagnostics: mergedDiagnostics,
  };
};

export const resolveFightPvpMapIdFromRuntimeContext =
  resolveFightPvpMapIdFromRuntimeGlobals;

export const getFightPvpRuntimeRoleMapIdReasonMessageKey = (reason) => {
  switch (reason) {
    case FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.RUNTIME_ROLE_UNAVAILABLE:
    case "runtime-self-role-unavailable":
    case "missing-self-role":
    case "missing-self-role-after-refresh":
      return "fightPvpCard.replay.mapIdReasons.runtimeRoleUnavailable";
    case FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.RUNTIME_ROLE_NO_PVP_MAP_ID:
    case "runtime-role-missing-pvp-map-id":
    case "missing-pvp-map-id":
      return "fightPvpCard.replay.mapIdReasons.runtimeRoleNoPvpMapId";
    case FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.BATTLE_INPUT_MAP_ID_NOT_WRITTEN:
    case "battle-input-map-id-missing-before-snapshot":
      return "fightPvpCard.replay.mapIdReasons.battleInputMapIdNotWritten";
    case FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_ROLE_PAYLOAD_MISSING_EXPLICIT_PVP_MAP_ID:
    case "role-payload-missing-explicit-pvp-map-id":
    case "missing-dress":
    case "missing-dress-used":
      return "fightPvpCard.replay.mapIdReasons.legacyRolePayloadMissingExplicitPvpMapId";
    case FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_DRESS_AMBIGUOUS:
    case "dress-ambiguous":
      return "fightPvpCard.replay.mapIdReasons.legacyDressAmbiguous";
    case FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_PVP_MAP_CONF_UNAVAILABLE:
    case "pvp-map-conf-unavailable":
    case "missing-pvp-map-conf":
      return "fightPvpCard.replay.mapIdReasons.legacyPvpMapConfUnavailable";
    case FIGHT_PVP_RUNTIME_ROLE_MAP_ID_REASONS.LEGACY_PVP_MAP_CONF_MAP_ID_MISSING:
    case "pvp-map-conf-map-id-missing":
    case "missing-pvp-map-conf-map-id":
      return "fightPvpCard.replay.mapIdReasons.legacyPvpMapConfMapIdMissing";
    default:
      return "fightPvpCard.replay.mapIdReasons.legacyRolePayloadMissingExplicitPvpMapId";
  }
};

export const getFightPvpRuntimeMapIdReasonMessageKey =
  getFightPvpRuntimeRoleMapIdReasonMessageKey;
