const BATCH_CONFIG_VERSION = "1.2";
const BATCH_SETTINGS_KEYS = [
  "boxCount",
  "fishCount",
  "recruitCount",
  "defaultBoxType",
  "defaultFishType",
  "carMinColor",
  "commandDelay",
  "taskDelay",
  "actionDelay",
  "battleDelay",
  "refreshDelay",
  "longDelay",
  "maxActive",
  "tokenListColumns",
  "useGoldRefreshFallback",
  "smartDepartureGoldThreshold",
  "smartDepartureRecruitThreshold",
  "smartDepartureJadeThreshold",
  "smartDepartureTicketThreshold",
  "smartDepartureMatchAll",
  "helperLineupAnalysisEnabled",
  "helperPreferredLineups",
];

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const normalizeTokenId = (value) => String(value || "").trim();

const pickBatchSettings = (batchSettings = {}) => {
  const sanitized = {};
  BATCH_SETTINGS_KEYS.forEach((key) => {
    if (!(key in batchSettings)) {
      return;
    }
    const value = batchSettings[key];
    sanitized[key] = key === "helperPreferredLineups" && Array.isArray(value)
      ? [...value]
      : value;
  });
  return sanitized;
};

const buildFilteredScheduledTasks = (scheduledTasks = [], validTokenIds) => {
  return (Array.isArray(scheduledTasks) ? scheduledTasks : [])
    .filter(isPlainObject)
    .map((task) => {
      const selectedTokens = Array.isArray(task.selectedTokens)
        ? task.selectedTokens
            .map((tokenId) => normalizeTokenId(tokenId))
            .filter((tokenId) => validTokenIds.has(tokenId))
        : [];
      return {
        ...task,
        selectedTokens,
      };
    })
    .filter((task) => task.selectedTokens.length > 0);
};

const buildTokenReferences = (tokens = []) =>
  (Array.isArray(tokens) ? tokens : [])
    .filter(isPlainObject)
    .map((token) => ({
      id: normalizeTokenId(token.id),
      name: String(token.name || "").trim(),
      server: String(token.server || "").trim(),
      remark: String(token.remark || "").trim(),
      importMethod: String(token.importMethod || "").trim() || "manual",
    }))
    .filter((token) => token.id);

const hasLegacyCredentialFields = (tokenRefs = []) =>
  tokenRefs.some((token) =>
    ["token", "sourceUrl", "wsUrl"].some(
      (key) => String(token?.[key] || "").trim().length > 0,
    ),
  );

export const buildBatchConfigExportData = ({
  batchSettings,
  scheduledTasks,
  tokenSettings = [],
  tokens = [],
}) => {
  const validTokenIds = new Set(
    (Array.isArray(tokens) ? tokens : [])
      .map((token) => normalizeTokenId(token?.id))
      .filter(Boolean),
  );

  return {
    version: BATCH_CONFIG_VERSION,
    exportTime: new Date().toISOString(),
    tokens: buildTokenReferences(tokens),
    scheduledTasks: buildFilteredScheduledTasks(scheduledTasks, validTokenIds),
    batchSettings: pickBatchSettings(batchSettings),
    tokenSettings: Array.isArray(tokenSettings) ? tokenSettings : [],
  };
};

export const normalizeBatchConfigImportData = ({
  existingTaskIds = new Set(),
  importData,
  validTokenIds = new Set(),
}) => {
  if (!isPlainObject(importData) || !String(importData.version || "").trim()) {
    throw new TypeError("无效的配置文件格式");
  }

  const seenTaskIds = new Set(
    Array.from(existingTaskIds || [])
      .map((taskId) => normalizeTokenId(taskId))
      .filter(Boolean),
  );
  const tokenRefs = Array.isArray(importData.tokens)
    ? importData.tokens.filter(isPlainObject)
    : [];
  const scheduledTasksToImport = [];
  let skippedTaskCount = 0;
  let skippedTaskTokenRefCount = 0;

  (Array.isArray(importData.scheduledTasks) ? importData.scheduledTasks : [])
    .forEach((task) => {
      if (!isPlainObject(task)) {
        skippedTaskCount += 1;
        return;
      }

      const taskId = normalizeTokenId(task.id);
      if (!taskId || seenTaskIds.has(taskId)) {
        skippedTaskCount += 1;
        return;
      }

      const rawSelectedTokens = Array.isArray(task.selectedTokens)
        ? task.selectedTokens
            .map((tokenId) => normalizeTokenId(tokenId))
            .filter(Boolean)
        : [];
      const validSelectedTokens = rawSelectedTokens.filter((tokenId) =>
        validTokenIds.has(tokenId),
      );
      skippedTaskTokenRefCount +=
        rawSelectedTokens.length - validSelectedTokens.length;

      if (validSelectedTokens.length === 0) {
        skippedTaskCount += 1;
        return;
      }

      scheduledTasksToImport.push({
        ...task,
        id: taskId,
        selectedTokens: validSelectedTokens,
      });
      seenTaskIds.add(taskId);
    });

  const tokenSettingsToApply = [];
  let skippedTokenSettingsCount = 0;
  (Array.isArray(importData.tokenSettings) ? importData.tokenSettings : [])
    .forEach((item) => {
      if (!isPlainObject(item) || !isPlainObject(item.settings)) {
        skippedTokenSettingsCount += 1;
        return;
      }

      const tokenId = normalizeTokenId(item.tokenId);
      if (!tokenId || !validTokenIds.has(tokenId)) {
        skippedTokenSettingsCount += 1;
        return;
      }

      tokenSettingsToApply.push({
        tokenId,
        settings: item.settings,
      });
    });

  return {
    batchSettings: pickBatchSettings(importData.batchSettings),
    hasLegacyCredentialFields: hasLegacyCredentialFields(tokenRefs),
    hasTokenReferences: tokenRefs.length > 0,
    scheduledTasksToImport,
    skippedTaskCount,
    skippedTaskTokenRefCount,
    skippedTokenSettingsCount,
    tokenReferenceCount: tokenRefs.length,
    tokenSettingsToApply,
  };
};
