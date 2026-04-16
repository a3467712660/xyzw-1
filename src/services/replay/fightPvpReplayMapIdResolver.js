export const FIGHT_PVP_REPLAY_FIXTURE_FALLBACK_MAP_ID = 110001;

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
      "id",
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

const buildResolutionResult = ({
  ok,
  mapId = null,
  pvpMapId = null,
  mapIdSource = null,
  pvpMapIdSource = null,
  diagnostics = null,
  fixtureMapFallbackUsed = false,
  dressPvpMapUsedId = null,
  dressPvpMapMapId = null,
} = {}) => ({
  ok: Boolean(ok),
  mapId: toPositiveNumber(mapId, null),
  pvpMapId: toPositiveNumber(pvpMapId, null),
  source: toNonEmptyString(mapIdSource, pvpMapIdSource) || null,
  mapIdSource: toNonEmptyString(mapIdSource) || null,
  pvpMapIdSource: toNonEmptyString(pvpMapIdSource) || null,
  fixtureMapFallbackUsed: Boolean(fixtureMapFallbackUsed),
  dressPvpMapUsedId: toPositiveNumber(dressPvpMapUsedId, null),
  dressPvpMapMapId: toPositiveNumber(dressPvpMapMapId, null),
  diagnostics: diagnostics || createDiagnostics(),
});

const hasDressResolutionMetadata = (result) =>
  Boolean(
    toPositiveNumber(result?.dressPvpMapUsedId, null)
    || toPositiveNumber(result?.dressPvpMapMapId, null),
  );

const isLegacyDressUsedPvpMapIdLeak = ({
  pvpMapId = null,
  dressPvpMapUsedId = null,
  dressPvpMapMapId = null,
} = {}) => {
  const resolvedPvpMapId = toPositiveNumber(pvpMapId, null);
  const resolvedDressUsedId = toPositiveNumber(dressPvpMapUsedId, null);
  const resolvedDressMapId = toPositiveNumber(dressPvpMapMapId, null);
  return Boolean(
    resolvedPvpMapId
    && resolvedDressUsedId
    && resolvedPvpMapId === resolvedDressUsedId
    && !resolvedDressMapId,
  );
};

const getReplayPvpMapLeakLinks = (replayObject, scope = "all") => {
  const contextLink = {
    usedId: replayObject?.context?.dressPvpMapUsedId,
    usedPath: "replay.context.dressPvpMapUsedId",
    dressMapId: replayObject?.context?.dressPvpMapMapId,
    mapPath: "replay.context.dressPvpMapMapId",
  };
  const snapshotLink = {
    usedId: replayObject?.selfRoleSnapshot?.dressPvpMapUsedId,
    usedPath: "replay.selfRoleSnapshot.dressPvpMapUsedId",
    dressMapId: replayObject?.selfRoleSnapshot?.dressPvpMapMapId,
    mapPath: "replay.selfRoleSnapshot.dressPvpMapMapId",
  };

  if (scope === "context") {
    return [contextLink];
  }
  if (scope === "selfRoleSnapshot") {
    return [snapshotLink];
  }

  return [contextLink, snapshotLink];
};

const isTrustedReplayPvpMapCandidate = ({
  candidate,
  replayObject,
  diagnostics,
} = {}) => {
  const resolvedPvpMapId = toPositiveNumber(candidate?.value, null);
  if (!resolvedPvpMapId) {
    return false;
  }

  for (const link of getReplayPvpMapLeakLinks(replayObject, candidate?.leakScope)) {
    recordCandidate(diagnostics, link.usedPath, link.usedId);
    recordCandidate(diagnostics, link.mapPath, link.dressMapId);
    if (isLegacyDressUsedPvpMapIdLeak({
      pvpMapId: resolvedPvpMapId,
      dressPvpMapUsedId: link.usedId,
      dressPvpMapMapId: link.dressMapId,
    })) {
      recordCandidate(diagnostics, `${candidate.path}.suspectLegacyDressUsedLeak`, true);
      recordCandidate(diagnostics, `${candidate.path}.suspectLegacyDressUsedLeakSource`, link.usedPath);
      return false;
    }
  }

  return true;
};

const getGlobalRequire = () => {
  if (typeof globalThis === "undefined") {
    return null;
  }

  return typeof globalThis.__require === "function"
    ? globalThis.__require
    : null;
};

const getPvpMapConfLookup = () => {
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

const resolvePvpMapDressTypeKeys = () => {
  const keys = new Set(PVP_MAP_DRESS_TYPE_KEYS);
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
      const runtimeKey = dressEnum?.pvpMap;
      if (runtimeKey !== null && runtimeKey !== undefined && runtimeKey !== "") {
        keys.add(runtimeKey);
        keys.add(String(runtimeKey));
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

const resolveDressMapIdFromSources = ({
  dressSources = [],
  diagnostics,
} = {}) => {
  const dressTypeKeys = resolvePvpMapDressTypeKeys();

  for (const source of dressSources) {
    const dressCollection = source?.value ?? null;
    recordCandidate(diagnostics, source?.path, dressCollection);
    if (!dressCollection) {
      continue;
    }

    for (const typeKey of dressTypeKeys) {
      const entry = getDressEntryFromCollection(dressCollection, typeKey);
      recordCandidate(diagnostics, `${source?.path}.type:${String(typeKey)}`, entry);
      if (!entry) {
        continue;
      }

      const usedId = getDressEntryUsedId(entry);
      recordCandidate(diagnostics, `${source?.path}.used`, usedId);
      if (!usedId) {
        continue;
      }

      const pvpMapConfLookup = getPvpMapConfLookup();
      if (!pvpMapConfLookup?.getById) {
        recordCandidate(diagnostics, `${source?.path}.configLookup`, "dress-config-unavailable");
        return buildResolutionResult({
          ok: false,
          dressPvpMapUsedId: usedId,
          diagnostics,
        });
      }

      const config = pvpMapConfLookup.getById(usedId);
      recordCandidate(diagnostics, `${source?.path}.PVPMapConf[${usedId}]`, config);
      const mapId = toPositiveNumber(config?.mapId, null);
      if (!mapId) {
        continue;
      }

      recordCandidate(diagnostics, `${source?.path}.PVPMapConf[${usedId}].mapId`, mapId);
      return buildResolutionResult({
        ok: true,
        mapId,
        pvpMapId: mapId,
        mapIdSource: `${source?.path}.PVPMapConf.mapId`,
        pvpMapIdSource: `${source?.path}.PVPMapConf.mapId`,
        dressPvpMapUsedId: usedId,
        dressPvpMapMapId: mapId,
        diagnostics,
      });
    }
  }

  return buildResolutionResult({
    ok: false,
    diagnostics,
  });
};

const resolvePersistedDressMapIdFromUsedIdCandidates = ({
  candidates = [],
  diagnostics,
} = {}) => {
  const normalizedCandidates = Array.isArray(candidates)
    ? candidates.map((candidate) => ({
        ...candidate,
        usedId: toPositiveNumber(candidate?.usedId, null),
        dressMapId: toPositiveNumber(candidate?.dressMapId, null),
      }))
    : [];

  for (const candidate of normalizedCandidates) {
    recordCandidate(diagnostics, candidate.usedPath, candidate.usedId);
    recordCandidate(diagnostics, candidate.mapPath, candidate.dressMapId);
  }

  const actionableCandidates = normalizedCandidates.filter((candidate) =>
    candidate.usedId && !candidate.dressMapId,
  );
  if (actionableCandidates.length === 0) {
    return buildResolutionResult({
      ok: false,
      diagnostics,
    });
  }

  const pvpMapConfLookup = getPvpMapConfLookup();
  if (!pvpMapConfLookup?.getById) {
    for (const candidate of actionableCandidates) {
      recordCandidate(
        diagnostics,
        `${candidate.scopePath}.persistedDressPVPMapConfLookup`,
        "dress-config-unavailable",
      );
    }
    return buildResolutionResult({
      ok: false,
      dressPvpMapUsedId: actionableCandidates[0].usedId,
      diagnostics,
    });
  }

  for (const candidate of actionableCandidates) {
    const config = pvpMapConfLookup.getById(candidate.usedId);
    recordCandidate(
      diagnostics,
      `${candidate.scopePath}.PVPMapConf[${candidate.usedId}]`,
      config,
    );
    const mapId = toPositiveNumber(config?.mapId, null);
    recordCandidate(
      diagnostics,
      `${candidate.scopePath}.PVPMapConf[${candidate.usedId}].mapId`,
      mapId,
    );
    if (!mapId) {
      continue;
    }

    return buildResolutionResult({
      ok: true,
      mapId,
      pvpMapId: mapId,
      mapIdSource: `${candidate.scopePath}.persistedDressPVPMapConf.mapId`,
      pvpMapIdSource: `${candidate.scopePath}.persistedDressPVPMapConf.mapId`,
      dressPvpMapUsedId: candidate.usedId,
      dressPvpMapMapId: mapId,
      diagnostics,
    });
  }

  return buildResolutionResult({
    ok: false,
    dressPvpMapUsedId: actionableCandidates[0].usedId,
    diagnostics,
  });
};

const buildLiveDressSources = ({
  selfRoleRaw = null,
  tokenStoreRoleInfo = null,
  liveContext = null,
} = {}) => [
  {
    path: "selfRoleRaw.role.dress",
    value: selfRoleRaw?.role?.dress,
  },
  {
    path: "selfRoleRaw.roleInfo.dress",
    value: selfRoleRaw?.roleInfo?.dress,
  },
  {
    path: "tokenStore.gameData.roleInfo.role.dress",
    value: tokenStoreRoleInfo?.role?.dress,
  },
  {
    path: "tokenStore.gameData.roleInfo.dress",
    value: tokenStoreRoleInfo?.dress,
  },
  {
    path: "liveContext.dress",
    value: liveContext?.dress,
  },
].filter((item) => item.value);

const buildReplayDressSources = (replay) => [
  {
    path: "replay.context.dress",
    value: replay?.context?.dress,
  },
  {
    path: "replay.selfRoleSnapshot.dress",
    value: replay?.selfRoleSnapshot?.dress,
  },
].filter((item) => item.value);

export function resolveFightPvpMapIdFromLiveContext({
  mapId = null,
  pvpMapId = null,
  selfRoleRaw = null,
  tokenStoreRoleInfo = null,
  liveContext = null,
} = {}) {
  const diagnostics = createDiagnostics();
  const explicitMapId = toPositiveNumber(mapId ?? liveContext?.mapId, null);
  const explicitPvpMapId = toPositiveNumber(pvpMapId ?? liveContext?.pvpMapId, null);

  recordCandidate(diagnostics, "live.explicit.mapId", explicitMapId);
  recordCandidate(diagnostics, "live.explicit.pvpMapId", explicitPvpMapId);

  if (explicitMapId) {
    return buildResolutionResult({
      ok: true,
      mapId: explicitMapId,
      pvpMapId: explicitPvpMapId || explicitMapId,
      mapIdSource: "live.explicit.mapId",
      pvpMapIdSource: explicitPvpMapId ? "live.explicit.pvpMapId" : "live.explicit.mapId",
      diagnostics,
    });
  }

  if (explicitPvpMapId) {
    return buildResolutionResult({
      ok: true,
      mapId: explicitPvpMapId,
      pvpMapId: explicitPvpMapId,
      mapIdSource: "live.explicit.pvpMapId",
      pvpMapIdSource: "live.explicit.pvpMapId",
      diagnostics,
    });
  }

  const roleInfoNode = liveContext?.tokenStoreRoleInfo || tokenStoreRoleInfo || liveContext?.roleInfo || null;
  const pvpMapCandidates = [
    {
      path: "selfRoleRaw.role.pvpMapId",
      value: selfRoleRaw?.role?.pvpMapId,
    },
    {
      path: "selfRoleRaw.roleInfo.pvpMapId",
      value: selfRoleRaw?.roleInfo?.pvpMapId,
    },
    {
      path: "tokenStore.gameData.roleInfo.role.pvpMapId",
      value: roleInfoNode?.role?.pvpMapId,
    },
    {
      path: "tokenStore.gameData.roleInfo.pvpMapId",
      value: roleInfoNode?.pvpMapId,
    },
  ];

  for (const candidate of pvpMapCandidates) {
    const resolvedPvpMapId = toPositiveNumber(candidate.value, null);
    recordCandidate(diagnostics, candidate.path, candidate.value);
    if (!resolvedPvpMapId) {
      continue;
    }

    return buildResolutionResult({
      ok: true,
      mapId: resolvedPvpMapId,
      pvpMapId: resolvedPvpMapId,
      mapIdSource: candidate.path,
      pvpMapIdSource: candidate.path,
      diagnostics,
    });
  }

  const dressResolution = resolveDressMapIdFromSources({
    dressSources: buildLiveDressSources({
      selfRoleRaw,
      tokenStoreRoleInfo: roleInfoNode,
      liveContext,
    }),
    diagnostics,
  });
  if (dressResolution.ok || hasDressResolutionMetadata(dressResolution)) {
    return dressResolution;
  }

  return buildResolutionResult({
    ok: false,
    diagnostics,
  });
}

const isFixtureReplay = (replay) =>
  replay?.meta?.fixtureMapFallback === true
  || replay?.source === "fight-pvp-real-fixture";

export function resolveFightPvpMapIdFromReplay({
  replay = null,
  liveContext = null,
} = {}) {
  const diagnostics = createDiagnostics();
  const replayObject = toPlainObject(replay);
  if (!replayObject) {
    recordCandidate(diagnostics, "replay", replay);
    return buildResolutionResult({
      ok: false,
      diagnostics,
    });
  }

  const storedMapId = toPositiveNumber(replayObject.mapId, null);
  recordCandidate(diagnostics, "replay.mapId", replayObject.mapId);
  if (storedMapId) {
    return buildResolutionResult({
      ok: true,
      mapId: storedMapId,
      pvpMapId: storedMapId,
      mapIdSource: toNonEmptyString(replayObject.mapIdSource, "replay.mapId"),
      pvpMapIdSource: toNonEmptyString(replayObject.mapIdSource, "replay.mapId"),
      diagnostics,
    });
  }

  const battleDataMapId = toPositiveNumber(replayObject.battleData?.mapId, null);
  recordCandidate(diagnostics, "replay.battleData.mapId", replayObject.battleData?.mapId);
  if (battleDataMapId) {
    return buildResolutionResult({
      ok: true,
      mapId: battleDataMapId,
      pvpMapId: battleDataMapId,
      mapIdSource: "replay.battleData.mapId",
      pvpMapIdSource: "replay.battleData.mapId",
      diagnostics,
    });
  }

  const replayPvpMapCandidates = [
    {
      path: "replay.pvpMapId",
      value: replayObject.pvpMapId,
      sourceFallback: "replay.pvpMapId",
      leakScope: "all",
    },
    {
      path: "replay.meta.pvpMapId",
      value: replayObject.meta?.pvpMapId,
      sourceFallback: "replay.meta.pvpMapId",
      leakScope: "all",
    },
    {
      path: "replay.context.pvpMapId",
      value: replayObject.context?.pvpMapId,
      sourceFallback: "replay.context.pvpMapId",
      leakScope: "context",
    },
    {
      path: "replay.selfRoleSnapshot.pvpMapId",
      value: replayObject.selfRoleSnapshot?.pvpMapId,
      sourceFallback: "replay.selfRoleSnapshot.pvpMapId",
      leakScope: "selfRoleSnapshot",
    },
  ];

  for (const candidate of replayPvpMapCandidates) {
    const resolvedPvpMapId = toPositiveNumber(candidate.value, null);
    recordCandidate(diagnostics, candidate.path, candidate.value);
    if (!resolvedPvpMapId) {
      continue;
    }
    if (!isTrustedReplayPvpMapCandidate({
      candidate,
      replayObject,
      diagnostics,
    })) {
      continue;
    }

    return buildResolutionResult({
      ok: true,
      mapId: resolvedPvpMapId,
      pvpMapId: resolvedPvpMapId,
      mapIdSource: toNonEmptyString(replayObject.mapIdSource, replayObject.pvpMapIdSource, candidate.sourceFallback),
      pvpMapIdSource: toNonEmptyString(replayObject.pvpMapIdSource, candidate.sourceFallback),
      diagnostics,
    });
  }

  const storedDressMapIdCandidates = [
    {
      scopePath: "replay.selfRoleSnapshot",
      path: "replay.selfRoleSnapshot.dressPvpMapMapId",
      value: replayObject.selfRoleSnapshot?.dressPvpMapMapId,
      usedId: replayObject.selfRoleSnapshot?.dressPvpMapUsedId,
      usedPath: "replay.selfRoleSnapshot.dressPvpMapUsedId",
      mapPath: "replay.selfRoleSnapshot.dressPvpMapMapId",
      dressMapId: replayObject.selfRoleSnapshot?.dressPvpMapMapId,
    },
    {
      scopePath: "replay.context",
      path: "replay.context.dressPvpMapMapId",
      value: replayObject.context?.dressPvpMapMapId,
      usedId: replayObject.context?.dressPvpMapUsedId,
      usedPath: "replay.context.dressPvpMapUsedId",
      mapPath: "replay.context.dressPvpMapMapId",
      dressMapId: replayObject.context?.dressPvpMapMapId,
    },
  ];

  for (const candidate of storedDressMapIdCandidates) {
    const resolvedMapId = toPositiveNumber(candidate.value, null);
    recordCandidate(diagnostics, candidate.path, candidate.value);
    recordCandidate(diagnostics, candidate.usedPath, candidate.usedId);
    if (!resolvedMapId) {
      continue;
    }

    return buildResolutionResult({
      ok: true,
      mapId: resolvedMapId,
      pvpMapId: resolvedMapId,
      mapIdSource: candidate.path,
      pvpMapIdSource: candidate.path,
      dressPvpMapUsedId: candidate.usedId,
      dressPvpMapMapId: resolvedMapId,
      diagnostics,
    });
  }

  const persistedDressResolution = resolvePersistedDressMapIdFromUsedIdCandidates({
    candidates: storedDressMapIdCandidates,
    diagnostics,
  });
  if (persistedDressResolution.ok) {
    return persistedDressResolution;
  }
  let failedDressResolution = hasDressResolutionMetadata(persistedDressResolution)
    ? persistedDressResolution
    : null;

  const dressResolution = resolveDressMapIdFromSources({
    dressSources: buildReplayDressSources(replayObject),
    diagnostics,
  });
  if (dressResolution.ok) {
    return dressResolution;
  }
  if (!failedDressResolution && hasDressResolutionMetadata(dressResolution)) {
    failedDressResolution = dressResolution;
  }

  if (liveContext) {
    const liveResolution = resolveFightPvpMapIdFromLiveContext(liveContext);
    mergeDiagnostics(diagnostics, liveResolution.diagnostics);
    if (liveResolution.ok) {
      return buildResolutionResult({
        ...liveResolution,
        diagnostics,
      });
    }
  }

  recordCandidate(diagnostics, "replay.meta.fixtureMapFallback", replayObject.meta?.fixtureMapFallback);
  recordCandidate(diagnostics, "replay.source", replayObject.source);
  if (isFixtureReplay(replayObject)) {
    return buildResolutionResult({
      ok: true,
      mapId: FIGHT_PVP_REPLAY_FIXTURE_FALLBACK_MAP_ID,
      pvpMapId: FIGHT_PVP_REPLAY_FIXTURE_FALLBACK_MAP_ID,
      mapIdSource: "fixture.110001",
      pvpMapIdSource: "fixture.110001",
      fixtureMapFallbackUsed: true,
      dressPvpMapUsedId: failedDressResolution?.dressPvpMapUsedId,
      dressPvpMapMapId: failedDressResolution?.dressPvpMapMapId,
      diagnostics,
    });
  }

  return failedDressResolution || buildResolutionResult({
    ok: false,
    diagnostics,
  });
}

export function resolveFightPvpMapId(options = {}) {
  if (options?.replay) {
    return resolveFightPvpMapIdFromReplay(options);
  }

  return resolveFightPvpMapIdFromLiveContext(options);
}

export function explainFightPvpMapIdResolution(options = {}) {
  const result = resolveFightPvpMapId(options);
  return {
    ok: result.ok,
    mapId: result.mapId,
    pvpMapId: result.pvpMapId,
    source: result.source,
    mapIdSource: result.mapIdSource,
    pvpMapIdSource: result.pvpMapIdSource,
    fixtureMapFallbackUsed: result.fixtureMapFallbackUsed,
    tried: [...(result.diagnostics?.tried || [])],
    availableValues: { ...(result.diagnostics?.availableValues || {}) },
  };
}
