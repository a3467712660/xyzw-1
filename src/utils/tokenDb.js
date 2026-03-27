// Lightweight IndexedDB wrapper for token persistence

const DB_NAME = "xyzw_token_db";
const DB_VERSION = 1;
const STORE_KV = "kv";
const STORE_GAME_TOKENS = "gameTokens";

const SENSITIVE_TOKEN_KEYS = new Set([
  "token",
  "actualToken",
  "gameToken",
  "userToken",
]);
const LEGACY_STORAGE_KEYS = ["userToken", "gameTokens", "selectedRoleInfo"];

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const getNowIso = () => new Date().toISOString();

const sanitizeGameTokenForPersistence = (tokenData = {}) => {
  if (!tokenData || typeof tokenData !== "object") return {};
  const sanitized = {};
  Object.entries(tokenData).forEach(([key, value]) => {
    if (SENSITIVE_TOKEN_KEYS.has(String(key))) return;
    sanitized[key] = value;
  });
  return sanitized;
};

function openDB() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("当前环境不支持 IndexedDB"));
      return;
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);
    let settled = false;
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("打开本地 Token 数据库超时"));
    }, 5000);

    const finishResolve = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      resolve(value);
    };

    const finishReject = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    };

    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV, { keyPath: "key" });
      }
      if (!db.objectStoreNames.contains(STORE_GAME_TOKENS)) {
        db.createObjectStore(STORE_GAME_TOKENS, { keyPath: "roleId" });
      }
    };

    req.onsuccess = () => finishResolve(req.result);
    req.onerror = () =>
      finishReject(req.error || new Error("打开本地 Token 数据库失败"));
    req.onblocked = () =>
      finishReject(
        new Error("本地 Token 数据库被占用，请关闭其他标签页后重试"),
      );
  });
}

async function withStore(storeName, mode, fn) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const result = fn(store);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

// KV helpers
export async function getKV(key) {
  return withStore(STORE_KV, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : undefined);
      req.onerror = () => reject(req.error);
    });
  });
}

export async function setKV(key, value) {
  return withStore(STORE_KV, "readwrite", (store) => {
    store.put({ key, value });
  });
}

export async function deleteKV(key) {
  return withStore(STORE_KV, "readwrite", (store) => {
    store.delete(key);
  });
}

// User token
export async function getUserToken() {
  return undefined;
}
export async function setUserToken(token) {
  void token;
  return deleteKV("userToken");
}
export async function clearUserToken() {
  return deleteKV("userToken");
}

// Game tokens (per role)
export async function getAllGameTokens() {
  return withStore(STORE_GAME_TOKENS, "readonly", (store) => {
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const arr = req.result || [];
        const map = {};
        arr.forEach((t) => {
          if (t && t.roleId) map[t.roleId] = t;
        });
        resolve(map);
      };
      req.onerror = () => reject(req.error);
    });
  });
}

export async function putGameToken(roleId, tokenData) {
  const safeRoleId = String(roleId || tokenData?.roleId || "").trim();
  if (!safeRoleId) return;
  const sanitized = sanitizeGameTokenForPersistence(tokenData);
  return withStore(STORE_GAME_TOKENS, "readwrite", (store) => {
    store.put({ ...sanitized, roleId: safeRoleId });
  });
}

export async function deleteGameToken(roleId) {
  return withStore(STORE_GAME_TOKENS, "readwrite", (store) => {
    store.delete(roleId);
  });
}

export async function clearGameTokens() {
  return withStore(STORE_GAME_TOKENS, "readwrite", (store) => {
    store.clear();
  });
}

const clearLegacyWebStorage = () => {
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("userToken");
    localStorage.removeItem("gameTokens");
    localStorage.removeItem("selectedRoleInfo");
  }
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("userToken");
    sessionStorage.removeItem("gameTokens");
    sessionStorage.removeItem("selectedRoleInfo");
  }
};

const readStorageValue = (storage, key, warnings, sourceName) => {
  try {
    return String(storage?.getItem?.(key) || "");
  } catch (error) {
    warnings.push(
      `[${sourceName}] failed to read ${key}: ${error?.message || String(error)}`,
    );
    return "";
  }
};

const normalizeLegacyTimestamp = (value) => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const ts = new Date(raw).getTime();
  if (!Number.isFinite(ts)) return "";
  return new Date(ts).toISOString();
};

const normalizeLegacyGameToken = (rawRoleId, tokenData) => {
  if (!isPlainObject(tokenData)) {
    return null;
  }

  const roleId = String(
    tokenData.roleId || tokenData.id || rawRoleId || "",
  ).trim();
  if (!roleId) {
    return null;
  }

  const createdAt = normalizeLegacyTimestamp(tokenData.createdAt);
  const lastUsed = normalizeLegacyTimestamp(tokenData.lastUsed);
  const nowIso = getNowIso();

  return {
    ...tokenData,
    roleId,
    id: String(tokenData.id || roleId).trim() || roleId,
    createdAt: createdAt || lastUsed || nowIso,
    lastUsed: lastUsed || createdAt || nowIso,
  };
};

const parseLegacyGameTokens = (rawValue, sourceName, warnings) => {
  const value = String(rawValue || "").trim();
  if (!value) {
    return {
      foundData: false,
      hasParseFailure: false,
      tokens: {},
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    warnings.push(
      `[${sourceName}] failed to parse gameTokens JSON: ${error?.message || String(error)}`,
    );
    return {
      foundData: true,
      hasParseFailure: true,
      tokens: {},
    };
  }

  const entries = Array.isArray(parsed)
    ? parsed.map((item, index) => [item?.roleId || item?.id || index, item])
    : isPlainObject(parsed)
      ? Object.entries(parsed)
      : null;

  if (!entries) {
    warnings.push(
      `[${sourceName}] gameTokens must be an array or object to migrate safely`,
    );
    return {
      foundData: true,
      hasParseFailure: true,
      tokens: {},
    };
  }

  const tokens = {};
  entries.forEach(([rawRoleId, tokenData], index) => {
    const normalized = normalizeLegacyGameToken(rawRoleId, tokenData);
    if (!normalized) {
      warnings.push(
        `[${sourceName}] skipped legacy gameTokens entry at index/key "${String(index)}" because roleId is missing or payload is invalid`,
      );
      return;
    }
    tokens[normalized.roleId] = normalized;
  });

  return {
    foundData: true,
    hasParseFailure: false,
    tokens,
  };
};

const readLegacyStorageArea = (storage, sourceName) => {
  const warnings = [];
  const snapshot = LEGACY_STORAGE_KEYS.reduce((acc, key) => {
    acc[key] = readStorageValue(storage, key, warnings, sourceName);
    return acc;
  }, {});
  const parsedGameTokens = parseLegacyGameTokens(
    snapshot.gameTokens,
    sourceName,
    warnings,
  );

  return {
    sourceName,
    userToken: String(snapshot.userToken || "").trim(),
    selectedRoleInfo: String(snapshot.selectedRoleInfo || "").trim(),
    rawGameTokens: String(snapshot.gameTokens || ""),
    gameTokens: parsedGameTokens.tokens,
    foundGameTokens: parsedGameTokens.foundData,
    hasParseFailure: parsedGameTokens.hasParseFailure,
    warnings,
  };
};

export const readLegacyWebStorageSnapshot = () => {
  const localArea = readLegacyStorageArea(
    globalThis.localStorage,
    "localStorage",
  );
  const sessionArea = readLegacyStorageArea(
    globalThis.sessionStorage,
    "sessionStorage",
  );

  const mergedGameTokens = {
    ...localArea.gameTokens,
    ...sessionArea.gameTokens,
  };
  const warnings = [...localArea.warnings, ...sessionArea.warnings];
  const foundLegacyData = Boolean(
    localArea.userToken ||
    sessionArea.userToken ||
    localArea.selectedRoleInfo ||
    sessionArea.selectedRoleInfo ||
    localArea.foundGameTokens ||
    sessionArea.foundGameTokens,
  );

  return {
    foundLegacyData,
    hasParseFailure: localArea.hasParseFailure || sessionArea.hasParseFailure,
    restoredUserToken: sessionArea.userToken || localArea.userToken || "",
    selectedRoleInfo:
      sessionArea.selectedRoleInfo || localArea.selectedRoleInfo || "",
    restoredGameTokens: mergedGameTokens,
    warnings,
  };
};

export async function clearLegacyWebStorageIfNeeded() {
  try {
    clearLegacyWebStorage();
    return { cleanedLocalStorage: true, warnings: [] };
  } catch (e) {
    console.warn("Legacy web storage cleanup skipped:", e);
    return {
      cleanedLocalStorage: false,
      error: e?.message,
      warnings: [`legacy cleanup failed: ${e?.message || String(e)}`],
    };
  }
}

export async function migrateFromLocalStorageIfNeeded(options = {}) {
  const snapshot = options.snapshot || readLegacyWebStorageSnapshot();
  const persistMetadata = options.persistMetadata !== false;
  const result = {
    foundLegacyData: Boolean(snapshot?.foundLegacyData),
    migratedMetadataCount: 0,
    restoredInMemoryCount: Object.keys(snapshot?.restoredGameTokens || {})
      .length,
    restoredUserTokenInMemory: Boolean(snapshot?.restoredUserToken),
    cleanedLegacyStorage: false,
    warnings: [...(snapshot?.warnings || [])],
    restoredGameTokens: snapshot?.restoredGameTokens || {},
    restoredUserToken: snapshot?.restoredUserToken || "",
  };

  if (!result.foundLegacyData) {
    return result;
  }

  if (persistMetadata) {
    for (const [roleId, tokenData] of Object.entries(
      result.restoredGameTokens,
    )) {
      await putGameToken(roleId, tokenData);
      result.migratedMetadataCount += 1;
    }
  }

  if (snapshot?.hasParseFailure) {
    result.warnings.push(
      "legacy storage was not cleaned because at least one gameTokens payload could not be parsed safely",
    );
    return result;
  }

  const cleanupResult = await clearLegacyWebStorageIfNeeded();
  result.cleanedLegacyStorage = Boolean(cleanupResult.cleanedLocalStorage);
  if (cleanupResult.error) {
    result.warnings.push(cleanupResult.error);
  }
  if (Array.isArray(cleanupResult.warnings)) {
    result.warnings.push(...cleanupResult.warnings);
  }

  return result;
}
