import { AES, enc, MD5 } from "crypto-js";
import api from "@/api";
import { useAuthStore } from "@/stores/auth";

export const RESOURCE_CHANGE_STORAGE_KEY = "xyzw_resource_change_logs_v1";
export const RESOURCE_CHANGE_ROLE_SCOPE_PREFIX = "role:";

const buildSecret = (scopeKey = "") => {
  const seed = `xyzw_resource_change:${scopeKey}:v2`;
  return MD5(seed).toString(enc.Hex);
};

const defaultStore = () => ({ version: 2, entries: {} });

const normalizeStore = (parsed) => {
  if (!parsed || typeof parsed !== "object")
    return defaultStore();
  if (parsed.entries && typeof parsed.entries === "object") {
    return { version: 2, entries: parsed.entries };
  }
  // 兼容历史格式（根对象直接是 scope -> entry）
  return { version: 2, entries: parsed };
};

const loadStore = () => {
  if (typeof window === "undefined")
    return defaultStore();
  try {
    const raw = window.localStorage.getItem(RESOURCE_CHANGE_STORAGE_KEY);
    if (!raw)
      return defaultStore();
    const parsed = JSON.parse(raw);
    return normalizeStore(parsed);
  } catch {
    return defaultStore();
  }
};

const saveStore = (store) => {
  if (typeof window === "undefined")
    return;
  window.localStorage.setItem(
    RESOURCE_CHANGE_STORAGE_KEY,
    JSON.stringify(store),
  );
};

const mergeStores = (baseStore, incomingStore) => {
  const base = normalizeStore(baseStore);
  const incoming = normalizeStore(incomingStore);
  return {
    version: 2,
    entries: {
      ...base.entries,
      ...incoming.entries,
    },
  };
};

const getEntryUpdatedAt = (entry) => {
  const ts = Number(entry?.updatedAt ?? 0);
  return Number.isFinite(ts) ? ts : 0;
};

let hydratePromise = null;
let hydratedAtLeastOnce = false;
const decryptedEntryCache = new Map();

const hasAuthToken = () => {
  try {
    const authStore = useAuthStore();
    return Boolean(authStore.isAuthenticated);
  } catch {
    return false;
  }
};

const decryptEntry = (scopeKey, payload) => {
  try {
    const bytes = AES.decrypt(String(payload || ""), buildSecret(scopeKey));
    const plainText = bytes.toString(enc.Utf8);
    if (!plainText)
      return null;
    const parsed = JSON.parse(plainText);
    if (!parsed || typeof parsed !== "object")
      return null;
    return parsed;
  } catch {
    return null;
  }
};

const encryptEntry = (scopeKey, entry) => {
  const text = JSON.stringify(entry || {});
  return AES.encrypt(text, buildSecret(scopeKey)).toString();
};

const normalizeRoleId = (roleId = "") => String(roleId || "").trim();

export const buildResourceChangeScopeKeyByRoleId = (roleId = "") => {
  const normalizedRoleId = normalizeRoleId(roleId);
  if (!normalizedRoleId)
    return "";
  return `${RESOURCE_CHANGE_ROLE_SCOPE_PREFIX}${normalizedRoleId}`;
};

const pickLatestEntry = (candidates = []) =>
  candidates
    .filter(Boolean)
    .sort((a, b) => getEntryUpdatedAt(b) - getEntryUpdatedAt(a))[0] || null;

const findLegacyEntryByRoleId = (roleId = "") => {
  const normalizedRoleId = normalizeRoleId(roleId);
  if (!normalizedRoleId)
    return null;

  const store = loadStore();
  const suffix = `:${normalizedRoleId}`;
  const candidates = [];
  Object.entries(store.entries || {}).forEach(([scopeKey, _]) => {
    if (
      !scopeKey.startsWith(RESOURCE_CHANGE_ROLE_SCOPE_PREFIX)
      && scopeKey.endsWith(suffix)
    ) {
      const entry = loadResourceChangeEntry(scopeKey);
      if (entry && typeof entry === "object") {
        candidates.push(entry);
      }
    }
  });
  return pickLatestEntry(candidates);
};

export const loadResourceChangeEntry = (scopeKey = "") => {
  if (!scopeKey)
    return null;
  const store = loadStore();
  const raw = store.entries?.[scopeKey];
  if (!raw || typeof raw !== "object")
    return null;

  // 新版：加密结构
  if (raw.encrypted && typeof raw.payload === "string") {
    const cached = decryptedEntryCache.get(scopeKey);
    if (cached && cached.payload === raw.payload) {
      return cached.entry;
    }
    const decrypted = decryptEntry(scopeKey, raw.payload);
    if (decrypted) {
      decryptedEntryCache.set(scopeKey, {
        payload: raw.payload,
        entry: decrypted,
      });
    }
    return decrypted;
  }

  // 旧版：明文结构（兼容读取）
  return raw;
};

export const loadResourceChangeEntryByRoleId = (roleId = "") => {
  const newScopeKey = buildResourceChangeScopeKeyByRoleId(roleId);
  if (!newScopeKey)
    return null;

  const entry = loadResourceChangeEntry(newScopeKey);
  if (entry && typeof entry === "object") {
    return entry;
  }

  const legacyEntry = findLegacyEntryByRoleId(roleId);
  if (legacyEntry && typeof legacyEntry === "object") {
    // Read-through migration: once legacy data is discovered, persist under role scope.
    saveResourceChangeEntry(newScopeKey, legacyEntry);
    return legacyEntry;
  }

  return null;
};

export const saveResourceChangeEntry = (scopeKey = "", entry = {}) => {
  if (!scopeKey)
    return;
  const store = loadStore();
  const encryptedEntry = {
    encrypted: true,
    updatedAt: Date.now(),
    payload: encryptEntry(scopeKey, entry),
  };
  decryptedEntryCache.set(scopeKey, {
    payload: encryptedEntry.payload,
    entry,
  });
  store.entries[scopeKey] = encryptedEntry;
  saveStore(store);

  if (typeof window !== "undefined" && hasAuthToken()) {
    api.resourceChangeLogs.save(scopeKey, encryptedEntry).catch(() => {
      // 保持本地缓存可用，网络失败时稍后由 hydrate/sync 重试。
    });
  }
};

export const exportResourceChangeStore = () => {
  return loadStore();
};

export const importResourceChangeStore = (payload, options = {}) => {
  const incoming = normalizeStore(payload);
  const merge = options.merge !== false;
  const nextStore = merge ? mergeStores(loadStore(), incoming) : incoming;
  decryptedEntryCache.clear();
  saveStore(nextStore);
  if (typeof window !== "undefined" && hasAuthToken()) {
    api.resourceChangeLogs.saveBulk(nextStore.entries || {}).catch(() => {
      // 保持本地缓存可用，稍后可重试同步。
    });
  }
  return Object.keys(nextStore.entries || {}).length;
};

export const hydrateResourceChangeStoreFromServer = async (force = false) => {
  if (typeof window === "undefined")
    return false;
  if (!hasAuthToken())
    return false;
  if (hydratedAtLeastOnce && !force)
    return true;
  if (hydratePromise)
    return hydratePromise;

  hydratePromise = (async () => {
    const local = loadStore();
    const response = await api.resourceChangeLogs.list();
    const serverEntriesRaw = response?.data?.entries;
    const serverEntries
      = serverEntriesRaw && typeof serverEntriesRaw === "object"
        ? serverEntriesRaw
        : {};

    const mergedEntries = { ...local.entries };
    const uploadEntries = {};

    Object.entries(serverEntries).forEach(([scopeKey, serverEntry]) => {
      const localEntry = local.entries?.[scopeKey];
      const localTs = getEntryUpdatedAt(localEntry);
      const serverTs = getEntryUpdatedAt(serverEntry);
      if (!localEntry || serverTs >= localTs) {
        mergedEntries[scopeKey] = serverEntry;
      } else {
        uploadEntries[scopeKey] = localEntry;
      }
    });

    Object.entries(local.entries || {}).forEach(([scopeKey, localEntry]) => {
      if (!Object.prototype.hasOwnProperty.call(serverEntries, scopeKey)) {
        uploadEntries[scopeKey] = localEntry;
      }
    });

    saveStore({
      version: 2,
      entries: mergedEntries,
    });
    decryptedEntryCache.clear();

    if (Object.keys(uploadEntries).length > 0) {
      await api.resourceChangeLogs.saveBulk(uploadEntries);
    }

    hydratedAtLeastOnce = true;
    return true;
  })()
    .catch(() => false)
    .finally(() => {
      hydratePromise = null;
    });

  return hydratePromise;
};
