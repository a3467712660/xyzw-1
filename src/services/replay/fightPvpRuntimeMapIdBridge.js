const RUNTIME_SERVER_DATA_MODULE_NAMES = Object.freeze([
  "ServerData",
  "../../orange/data/ServerData",
  "../../../orange/data/ServerData",
  "../orange/data/ServerData",
]);

const RUNTIME_CONFIG_MODULE_NAMES = Object.freeze([
  "Configs",
  "data-index",
  "ConfigsExt",
  "consts",
  "../../../../../launcher/config/Configs",
]);

const toPlainObject = (value) =>
  value && typeof value === "object" ? value : null;

const toNonEmptyString = (...values) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) {
      return text;
    }
  }
  return "";
};

const getRuntimeRoot = (runtimeWindow = null) => {
  if (runtimeWindow && typeof runtimeWindow === "object") {
    return runtimeWindow;
  }

  if (typeof window !== "undefined" && window && typeof window === "object") {
    return window;
  }

  if (typeof globalThis !== "undefined" && globalThis && typeof globalThis === "object") {
    return globalThis;
  }

  return null;
};

const getRuntimeRequire = (runtimeRoot = getRuntimeRoot()) => {
  if (typeof runtimeRoot?.__require === "function") {
    return runtimeRoot.__require;
  }
  if (typeof globalThis?.__require === "function") {
    return globalThis.__require;
  }
  return null;
};

const getModuleRole = (moduleValue) =>
  moduleValue?.ROLE
  || moduleValue?.default?.ROLE
  || moduleValue?.ServerData?.ROLE
  || moduleValue?.default?.ServerData?.ROLE
  || null;

const getModuleServerData = (moduleValue) =>
  moduleValue?.ServerData
  || moduleValue?.default?.ServerData
  || (getModuleRole(moduleValue) ? moduleValue : null);

const safeRequireModule = (requireFn, moduleName) => {
  if (typeof requireFn !== "function") {
    return null;
  }

  try {
    return requireFn(moduleName);
  } catch {
    return null;
  }
};

const createDiagnostics = () => ({
  configSource: null,
  roleSource: null,
  runtimeRequireAvailable: false,
  triedConfigModules: [],
  triedRoleModules: [],
});

const findRuntimeRoleFromGlobals = (runtimeRoot) => {
  const candidates = [
    {
      source: "window.ROLE",
      role: runtimeRoot?.ROLE,
      serverData: null,
    },
    {
      source: "window.ServerData.ROLE",
      role: runtimeRoot?.ServerData?.ROLE,
      serverData: runtimeRoot?.ServerData || null,
    },
    {
      source: "window.serverData.ROLE",
      role: runtimeRoot?.serverData?.ROLE,
      serverData: runtimeRoot?.serverData || null,
    },
  ];

  for (const candidate of candidates) {
    if (candidate.role) {
      return candidate;
    }
  }

  return {
    role: null,
    serverData: null,
    source: null,
  };
};

const findRuntimeRoleFromModules = ({
  requireFn,
  diagnostics,
} = {}) => {
  for (const moduleName of RUNTIME_SERVER_DATA_MODULE_NAMES) {
    diagnostics?.triedRoleModules.push(moduleName);
    const moduleValue = safeRequireModule(requireFn, moduleName);
    const role = getModuleRole(moduleValue);
    if (role) {
      return {
        role,
        serverData: getModuleServerData(moduleValue),
        source: `require:${moduleName}.ROLE`,
      };
    }
  }

  return {
    role: null,
    serverData: null,
    source: null,
  };
};

const findRuntimeConfigs = ({
  runtimeRoot,
  requireFn,
  diagnostics,
} = {}) => {
  const globalPvpMapConf = runtimeRoot?.PVPMapConf || globalThis?.PVPMapConf || null;
  const globalDressType = runtimeRoot?.EMDressType || globalThis?.EMDressType || null;

  if (globalPvpMapConf?.getById || globalDressType?.pvpMap !== undefined) {
    diagnostics.configSource = "window";
    return {
      PVPMapConf: globalPvpMapConf,
      EMDressType: globalDressType,
    };
  }

  for (const moduleName of RUNTIME_CONFIG_MODULE_NAMES) {
    diagnostics?.triedConfigModules.push(moduleName);
    const moduleValue = safeRequireModule(requireFn, moduleName);
    const resolvedPvpMapConf = moduleValue?.PVPMapConf
      || moduleValue?.default?.PVPMapConf
      || moduleValue?.Configs?.PVPMapConf
      || null;
    const resolvedDressType = moduleValue?.EMDressType
      || moduleValue?.default?.EMDressType
      || moduleValue?.Configs?.EMDressType
      || null;
    if (resolvedPvpMapConf?.getById || resolvedDressType?.pvpMap !== undefined) {
      diagnostics.configSource = `require:${moduleName}`;
      return {
        PVPMapConf: resolvedPvpMapConf || null,
        EMDressType: resolvedDressType || null,
      };
    }
  }

  return {
    PVPMapConf: null,
    EMDressType: null,
  };
};

export const readFightPvpRuntimeMapIdContext = ({
  runtimeWindow = null,
} = {}) => {
  const runtimeRoot = getRuntimeRoot(runtimeWindow);
  const diagnostics = createDiagnostics();
  const requireFn = getRuntimeRequire(runtimeRoot);
  diagnostics.runtimeRequireAvailable = typeof requireFn === "function";

  const globalRoleContext = findRuntimeRoleFromGlobals(runtimeRoot);
  const moduleRoleContext = globalRoleContext.role
    ? globalRoleContext
    : findRuntimeRoleFromModules({
        requireFn,
        diagnostics,
      });
  const roleSource = toNonEmptyString(
    globalRoleContext.source,
    moduleRoleContext.source,
  ) || null;
  diagnostics.roleSource = roleSource;

  const configsLike = findRuntimeConfigs({
    runtimeRoot,
    requireFn,
    diagnostics,
  });

  return {
    ok: Boolean(moduleRoleContext.role),
    runtimeRoot,
    runtimeRequire: requireFn,
    runtimeRequireAvailable: diagnostics.runtimeRequireAvailable,
    runtimeRole: moduleRoleContext.role || null,
    runtimeRoleAvailable: Boolean(moduleRoleContext.role),
    runtimeRoleSource: roleSource,
    runtimeServerData: moduleRoleContext.serverData || null,
    runtimeDress: moduleRoleContext.role?.dress || null,
    configsLike,
    diagnostics,
  };
};

export const getFightPvpRuntimeRoleModuleNames = () =>
  [...RUNTIME_SERVER_DATA_MODULE_NAMES];

export const getFightPvpRuntimeConfigModuleNames = () =>
  [...RUNTIME_CONFIG_MODULE_NAMES];
