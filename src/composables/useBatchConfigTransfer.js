import { triggerBlobDownload } from "@/utils/download";
import {
  buildBatchConfigExportData,
  normalizeBatchConfigImportData,
} from "./useBatchConfigTransfer.logic.js";

const collectTokenSettingsForExport = (
  tokens = [],
  readSettings = (tokenId) => localStorage.getItem(`daily-settings:${tokenId}`),
) => {
  const tokenSettings = [];
  (Array.isArray(tokens) ? tokens : []).forEach((token) => {
    const tokenId = normalizeTokenId(token?.id);
    if (!tokenId) {
      return;
    }
    const settings = readSettings(tokenId);
    if (!settings) {
      return;
    }

    try {
      tokenSettings.push({
        tokenId,
        settings: JSON.parse(settings),
      });
    } catch (error) {
      console.warn(`Failed to parse settings for token ${tokenId}`, error);
    }
  });
  return tokenSettings;
};

const normalizeTokenId = (value) => String(value || "").trim();

export function useBatchConfigTransfer({
  batchSettings,
  message,
  saveBatchSettings,
  saveScheduledTasks,
  scheduledTasks,
  tokens,
}) {
  const exportConfig = () => {
    try {
      const exportData = buildBatchConfigExportData({
        batchSettings,
        scheduledTasks: scheduledTasks.value,
        tokenSettings: collectTokenSettingsForExport(tokens.value),
        tokens: tokens.value,
      });

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      triggerBlobDownload({
        blob,
        fileName: `xyzw_config_${new Date().toISOString().slice(0, 10)}.json`,
      });

      message.success(
        `导出成功: ${exportData.tokens.length} 个账号引用, ${exportData.scheduledTasks.length} 个定时任务`,
      );
    } catch (error) {
      console.error("Export failed:", error);
      message.error(`导出失败: ${error.message}`);
    }
  };

  const importConfig = async ({ file }) => {
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importData = JSON.parse(event.target.result);
          const validTokenIds = new Set(
            tokens.value
              .map((token) => normalizeTokenId(token.id))
              .filter(Boolean),
          );
          const existingTaskIds = new Set(
            scheduledTasks.value
              .map((task) => normalizeTokenId(task.id))
              .filter(Boolean),
          );
          const normalized = normalizeBatchConfigImportData({
            existingTaskIds,
            importData,
            validTokenIds,
          });

          let importedTaskCount = 0;
          if (normalized.scheduledTasksToImport.length > 0) {
            scheduledTasks.value.push(...normalized.scheduledTasksToImport);
            importedTaskCount = normalized.scheduledTasksToImport.length;
            saveScheduledTasks();
          }

          const batchSettingsKeys = Object.keys(normalized.batchSettings || {});
          const importedBatchSettings = batchSettingsKeys.length > 0;
          if (importedBatchSettings) {
            Object.assign(batchSettings, normalized.batchSettings);
            saveBatchSettings();
          }

          if (normalized.tokenSettingsToApply.length > 0) {
            normalized.tokenSettingsToApply.forEach((item) => {
              localStorage.setItem(
                `daily-settings:${item.tokenId}`,
                JSON.stringify(item.settings),
              );
            });
          }
          const appliedTokenSettingsCount = normalized.tokenSettingsToApply.length;

          const successParts = [];
          if (importedTaskCount > 0) {
            successParts.push(`${importedTaskCount} 个定时任务`);
          }
          if (importedBatchSettings) {
            successParts.push("批量设置");
          }
          if (appliedTokenSettingsCount > 0) {
            successParts.push(`${appliedTokenSettingsCount} 个账号设置`);
          }

          if (successParts.length === 0) {
            message.warning("配置文件中没有可导入的有效配置");
          } else {
            message.success(`配置导入成功: ${successParts.join("，")}`);
          }

          const warningParts = [];
          if (normalized.skippedTaskTokenRefCount > 0) {
            warningParts.push(
              `已过滤 ${normalized.skippedTaskTokenRefCount} 个不存在的账号引用`,
            );
          }
          if (normalized.skippedTaskCount > 0) {
            warningParts.push(
              `已跳过 ${normalized.skippedTaskCount} 个无有效账号的任务`,
            );
          }
          if (normalized.skippedTokenSettingsCount > 0) {
            warningParts.push(
              `已跳过 ${normalized.skippedTokenSettingsCount} 个不存在账号的设置`,
            );
          }
          if (normalized.hasLegacyCredentialFields) {
            warningParts.push(
              "检测到旧版配置中的账号凭据字段，已忽略；配置导入不会恢复账号凭据，请通过专用 Token 导入/导出迁移账号",
            );
          } else if (normalized.hasTokenReferences) {
            warningParts.push(
              "配置导入不会恢复账号凭据，请通过专用 Token 导入/导出迁移账号",
            );
          }
          if (warningParts.length > 0) {
            message.warning(warningParts.join("；"));
          }
        } catch (parseError) {
          console.error("Parse error:", parseError);
          message.error(parseError?.message || "解析配置文件失败");
        }
      };
      reader.readAsText(file.file);
    } catch (error) {
      console.error("Import failed:", error);
      message.error(`导入失败: ${error.message}`);
    }
  };

  return {
    exportConfig,
    importConfig,
  };
}
