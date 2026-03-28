import type { Ref } from "vue";

import { getEffectiveUserId, scopeTokenToUser } from "@/services/token/tokenStorage";
import type { TokenData } from "@/services/token/tokenStorage";
import { sanitizeSourceUrlForDisplay } from "@/utils/securitySanitizer";

interface TokenDataServiceDeps {
  gameTokens: Ref<TokenData[]>;
  addToken: (tokenData: TokenData) => TokenData;
  updateToken: (tokenId: string, updates: Partial<TokenData>) => boolean;
  removeToken: (tokenId: string) => Promise<boolean>;
}

const SENSITIVE_EXPORT_KEYS = new Set([
  "token",
  "actualToken",
  "gameToken",
  "userToken",
  "sourceUrl",
]);

const ALLOWED_IMPORT_ROOT_KEYS = new Set([
  "version",
  "format",
  "exportMode",
  "exportedAt",
  "payload",
  "tokens",
]);

const ALLOWED_IMPORT_TOKEN_KEYS = new Set([
  "id",
  "ownerId",
  "roleId",
  "name",
  "token",
  "actualToken",
  "gameToken",
  "wsUrl",
  "server",
  "roleIndex",
  "remark",
  "importMethod",
  "sourceUrl",
  "sourceUrlDisplay",
  "avatar",
  "upgradedToPermanent",
  "upgradedAt",
  "updatedAt",
  "createdAt",
  "lastUsed",
  "binSourceState",
  "binSourceMissingAt",
  "sessId",
  "activationSessId",
  "activationRoleId",
  "activationGameAccountId",
  "activationRoleName",
  "activationRegion",
  "activationExpiresAt",
  "activationBoundAt",
]);

const MAX_IMPORT_TOKENS = 500;
const MAX_IMPORT_STRING_LENGTH = 8192;
const GAME_ACCOUNT_ID_PATTERN = /^\d{6,12}$/;
const ACCOUNT_ID_PRIORITY = [
  "roleid",
  "role_id",
  "gameaccountid",
  "game_account_id",
];
const ACCOUNT_ID_KEYS = new Set(ACCOUNT_ID_PRIORITY);
const SESSION_ID_KEYS = [
  "sessid",
  "sess_id",
  "sessionid",
  "session_id",
  "sid",
];
const SESSION_ID_KEY_SET = new Set(SESSION_ID_KEYS);

const isPlainObject = (value: unknown): value is Record<string, any> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const normalizeImportValue = (value: unknown) => {
  if (value === null)
    return null;
  if (typeof value === "string")
    return value.slice(0, MAX_IMPORT_STRING_LENGTH);
  if (typeof value === "number" || typeof value === "boolean")
    return value;
  return undefined;
};

const normalizeRoleId = (value: unknown) => {
  const text = String(value || "").trim();
  if (!text)
    return "";
  if (GAME_ACCOUNT_ID_PATTERN.test(text))
    return text;
  const matched = text.match(/\b(\d{6,12})\b/);
  return matched ? matched[1] : "";
};

const normalizeSessId = (value: unknown) => String(value || "").trim().slice(0, 256);

const collectSessIdsFromPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object")
    return [];
  const result: string[] = [];
  const queue: Array<{ value: Record<string, any>; depth: number }> = [{ value: payload as Record<string, any>, depth: 0 }];
  const seen = new WeakSet();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current)
      continue;
    const { value, depth } = current;
    if (!value || typeof value !== "object" || depth > 4 || seen.has(value))
      continue;
    seen.add(value);

    Object.entries(value).forEach(([key, child]) => {
      if (child && typeof child === "object") {
        queue.push({ value: child as Record<string, any>, depth: depth + 1 });
        return;
      }
      const normalizedKey = String(key || "").trim().toLowerCase();
      if (!SESSION_ID_KEY_SET.has(normalizedKey))
        return;
      const normalized = normalizeSessId(child);
      if (normalized && !result.includes(normalized)) {
        result.push(normalized);
      }
    });
  }

  return result;
};

const collectNineDigitIdsFromPayload = (payload: unknown) => {
  if (!payload || typeof payload !== "object")
    return [];
  const keyBuckets = new Map(ACCOUNT_ID_PRIORITY.map((key) => [key, [] as string[]]));
  const queue: Array<{ value: Record<string, any>; depth: number }> = [{ value: payload as Record<string, any>, depth: 0 }];
  const seen = new WeakSet();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current)
      continue;
    const { value, depth } = current;
    if (!value || typeof value !== "object" || depth > 4 || seen.has(value))
      continue;
    seen.add(value);

    Object.entries(value).forEach(([key, child]) => {
      if (child && typeof child === "object") {
        queue.push({ value: child as Record<string, any>, depth: depth + 1 });
        return;
      }
      const normalizedKey = String(key || "").trim().toLowerCase();
      if (!ACCOUNT_ID_KEYS.has(normalizedKey))
        return;
      const normalizedId = normalizeRoleId(child);
      if (normalizedId) {
        keyBuckets.get(normalizedKey)?.push(normalizedId);
      }
    });
  }

  const result: string[] = [];
  ACCOUNT_ID_PRIORITY.forEach((key) => {
    const values = keyBuckets.get(key) || [];
    values.forEach((value) => {
      if (!result.includes(value)) {
        result.push(value);
      }
    });
  });
  return result;
};

const stripSensitiveFields = (tokenData: Record<string, any> = {}) => {
  if (!isPlainObject(tokenData))
    return {};
  const sanitized: Record<string, any> = {};
  const rawSourceUrl = String(tokenData.sourceUrl || "").trim();
  const sourceUrlDisplay = (rawSourceUrl && sanitizeSourceUrlForDisplay(rawSourceUrl))
    || String(tokenData.sourceUrlDisplay || "").trim();
  Object.entries(tokenData).forEach(([key, value]) => {
    if (SENSITIVE_EXPORT_KEYS.has(String(key)))
      return;
    if (key === "sourceUrlDisplay")
      return;
    sanitized[key] = value;
  });
  if (sourceUrlDisplay) {
    sanitized.sourceUrlDisplay = sourceUrlDisplay;
  }
  return sanitized;
};

const stripSourceUrlForFullExport = (tokenData: Record<string, any> = {}) => {
  if (!isPlainObject(tokenData))
    return {};
  const sanitized: Record<string, any> = { ...tokenData };
  const rawSourceUrl = String(tokenData.sourceUrl || "").trim();
  const sourceUrlDisplay = (rawSourceUrl && sanitizeSourceUrlForDisplay(rawSourceUrl))
    || String(tokenData.sourceUrlDisplay || "").trim();
  delete sanitized.sourceUrl;
  delete sanitized.sourceUrlDisplay;
  if (sourceUrlDisplay) {
    sanitized.sourceUrlDisplay = sourceUrlDisplay;
  }
  return sanitized;
};

const normalizeImportPayload = (rawData: unknown) => {
  if (!isPlainObject(rawData)) {
    throw new TypeError("导入失败：文件结构无效");
  }

  const root: Record<string, any> = {};
  Object.keys(rawData).forEach((key) => {
    if (ALLOWED_IMPORT_ROOT_KEYS.has(key)) {
      root[key] = (rawData as Record<string, any>)[key];
    }
  });

  const rawPayload = isPlainObject(root.payload) ? root.payload : root;
  const rawTokens = rawPayload.tokens;
  const normalizedTokens: TokenData[] = [];

  if (Array.isArray(rawTokens)) {
    for (const token of rawTokens) {
      if (normalizedTokens.length >= MAX_IMPORT_TOKENS)
        break;
      if (!isPlainObject(token))
        continue;

      const normalizedToken: Record<string, any> = {};
      ALLOWED_IMPORT_TOKEN_KEYS.forEach((key) => {
        if (!(key in token))
          return;
        const normalized = normalizeImportValue(token[key]);
        if (normalized !== undefined) {
          normalizedToken[key] = normalized;
        }
      });
      if (Object.keys(normalizedToken).length > 0) {
        normalizedTokens.push(normalizedToken as TokenData);
      }
    }
  }

  return normalizedTokens;
};

export function createTokenDataService({
  gameTokens,
  addToken,
  updateToken,
  removeToken,
}: TokenDataServiceDeps) {
  const validateToken = (token: any) => {
    if (!token || typeof token !== "string")
      return false;
    if (token.trim().length === 0)
      return false;
    return token.trim().length >= 10;
  };

  const parseBase64Token = (base64String: string) => {
    try {
      if (!base64String || typeof base64String !== "string") {
        throw new Error("Token字符串无效");
      }

      const cleanBase64 = base64String.replace(/^data:.*base64,/, "").trim();
      if (cleanBase64.length === 0) {
        throw new Error("Token字符串为空");
      }

      let decoded;
      try {
        decoded = atob(cleanBase64);
      } catch {
        decoded = base64String.trim();
      }

      let tokenData;
      try {
        tokenData = JSON.parse(decoded);
      } catch {
        tokenData = { token: decoded };
      }

      const actualToken = tokenData.token || tokenData.gameToken || decoded;
      if (!validateToken(actualToken)) {
        throw new Error("提取的token无效");
      }

      const candidates = [
        tokenData.roleId,
        tokenData.role_id,
        tokenData.roleid,
        tokenData.gameAccountId,
        tokenData.game_account_id,
        tokenData.gameaccountid,
        tokenData.activationRoleId,
        tokenData.activationGameAccountId,
      ];
      let normalizedRoleId = "";
      for (const candidate of candidates) {
        normalizedRoleId = normalizeRoleId(candidate);
        if (normalizedRoleId)
          break;
      }
      if (!normalizedRoleId) {
        normalizedRoleId = collectNineDigitIdsFromPayload(tokenData)[0] || "";
      }
      const normalizedSessId = normalizeSessId(
        tokenData.sessId
        || tokenData.sessid
        || tokenData.sess_id
        || tokenData.sessionId
        || tokenData.sessionid
        || tokenData.session_id
        || tokenData.sid
        || collectSessIdsFromPayload(tokenData)[0]
        || "",
      );

      return {
        success: true,
        data: {
          ...tokenData,
          actualToken,
          sessId: normalizedSessId,
          roleId: normalizedRoleId || tokenData.roleId || "",
          activationSessId:
            normalizedSessId
            || tokenData.activationSessId
            || tokenData.sessId
            || tokenData.sessid
            || "",
          activationRoleId:
            normalizedRoleId
            || tokenData.activationRoleId
            || tokenData.activationGameAccountId
            || "",
          activationGameAccountId:
            normalizedRoleId
            || tokenData.activationGameAccountId
            || tokenData.activationRoleId
            || "",
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: `解析失败：${error.message}`,
      };
    }
  };

  const importBase64Token = (
    name: string,
    base64String: string,
    additionalInfo = {},
  ) => {
    const parseResult = parseBase64Token(base64String);

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
        message: `Token "${name}" 导入失败: ${parseResult.error}`,
      };
    }

    const tokenData = {
      name,
      token: parseResult.data.actualToken,
      ...additionalInfo,
      ...parseResult.data,
    };

    try {
      const newToken = addToken(tokenData);
      const tokenInfo = parseResult.data.actualToken;
      const displayToken
        = tokenInfo.length > 20
          ? `${tokenInfo.substring(0, 10)}...${tokenInfo.substring(tokenInfo.length - 6)}`
          : tokenInfo;

      return {
        success: true,
        token: newToken,
        tokenName: name,
        message: `Token "${name}" 导入成功`,
        details: `实际Token: ${displayToken}`,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        message: `Token "${name}" 添加失败: ${error.message}`,
      };
    }
  };

  const exportTokens = (options: { mode?: "metadata" | "full" } = {}) => {
    const mode = options.mode === "metadata" ? "metadata" : "full";
    const tokenList = mode === "metadata"
      ? gameTokens.value.map((token) => stripSensitiveFields(token as Record<string, any>))
      : gameTokens.value.map((token) => stripSourceUrlForFullExport(token as Record<string, any>));
    return {
      version: "2.1",
      format: "xyzw-token-export",
      exportMode: mode,
      payload: {
        tokens: tokenList,
      },
      exportedAt: new Date().toISOString(),
    };
  };

  const importTokens = (data: any) => {
    try {
      const normalizedTokens = normalizeImportPayload(data);
      const replacedExisting = normalizedTokens.reduce((acc, token) => {
        if (!token.id)
          return acc;
        return acc + (gameTokens.value.some((item) => item.id === token.id) ? 1 : 0);
      }, 0);
      const sensitiveTokenCount = normalizedTokens.reduce((acc, token) => {
        const rawToken = String(token.token || "").trim();
        return acc + (rawToken ? 1 : 0);
      }, 0);

      const scoped = normalizedTokens.map((token: TokenData) =>
        scopeTokenToUser(token, getEffectiveUserId()),
      );
      gameTokens.value = scoped;
      return {
        success: true,
        message: `成功导入 ${scoped.length} 个Token`,
        importedCount: scoped.length,
        sensitiveTokenCount,
        replacedExisting,
        containsSensitiveToken: sensitiveTokenCount > 0,
      };
    } catch (error: any) {
      return {
        success: false,
        message: `导入失败：${error.message}`,
      };
    }
  };

  const cleanExpiredTokens = async () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const tokensToRemove = gameTokens.value.filter((token) => {
      if (
        token.importMethod === "url"
        || token.importMethod === "bin"
        || token.importMethod === "wxQrcode"
        || token.upgradedToPermanent
      ) {
        return false;
      }
      const lastUsed = new Date(token.lastUsed || token.createdAt);
      return lastUsed <= oneDayAgo;
    });

    const cleanedCount = tokensToRemove.length;
    for (const token of tokensToRemove) {
      await removeToken(token.id);
    }

    return cleanedCount;
  };

  const upgradeTokenToPermanent = (tokenId: string) => {
    const token = gameTokens.value.find((item) => item.id === tokenId);
    if (
      token
      && !token.upgradedToPermanent
      && token.importMethod !== "url"
      && token.importMethod !== "bin"
      && token.importMethod !== "wxQrcode"
    ) {
      updateToken(tokenId, {
        upgradedToPermanent: true,
        upgradedAt: new Date().toISOString(),
      });
      return true;
    }
    return false;
  };

  return {
    cleanExpiredTokens,
    exportTokens,
    importBase64Token,
    importTokens,
    parseBase64Token,
    upgradeTokenToPermanent,
    validateToken,
  };
}
