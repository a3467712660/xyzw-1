import { triggerBlobDownload } from "@/utils/download";

export function useBatchConfigTransfer({
  batchSettings,
  gameTokens,
  message,
  saveBatchSettings,
  saveScheduledTasks,
  scheduledTasks,
  tokens,
}) {
  const exportConfig = () => {
    try {
      const validTokenIds = new Set(tokens.value.map((token) => token.id));

      const filteredScheduledTasks = scheduledTasks.value
        .map((task) => ({
          ...task,
          selectedTokens:
            task.selectedTokens?.filter((tokenId) => validTokenIds.has(tokenId))
            || [],
        }))
        .filter((task) => task.selectedTokens.length > 0);

      const tokenSettings = [];
      tokens.value.forEach((token) => {
        const settings = localStorage.getItem(`daily-settings:${token.id}`);
        if (!settings) {
          return;
        }

        try {
          tokenSettings.push({
            tokenId: token.id,
            settings: JSON.parse(settings),
          });
        } catch (error) {
          console.warn(`Failed to parse settings for token ${token.id}`, error);
        }
      });

      const exportData = {
        version: "1.1",
        exportTime: new Date().toISOString(),
        tokens: tokens.value.map((token) => ({
          id: token.id,
          name: token.name,
          token: token.token,
          server: token.server,
          wsUrl: token.wsUrl,
          remark: token.remark,
          importMethod: token.importMethod,
          sourceUrl: token.sourceUrl,
          upgradedToPermanent: true,
          upgradedAt: token.upgradedAt,
          updatedAt: token.updatedAt,
        })),
        scheduledTasks: filteredScheduledTasks,
        batchSettings: {
          boxCount: batchSettings.boxCount,
          fishCount: batchSettings.fishCount,
          recruitCount: batchSettings.recruitCount,
          defaultBoxType: batchSettings.defaultBoxType,
          defaultFishType: batchSettings.defaultFishType,
          carMinColor: batchSettings.carMinColor,
          commandDelay: batchSettings.commandDelay,
          taskDelay: batchSettings.taskDelay,
          actionDelay: batchSettings.actionDelay,
          battleDelay: batchSettings.battleDelay,
          refreshDelay: batchSettings.refreshDelay,
          longDelay: batchSettings.longDelay,
          maxActive: batchSettings.maxActive,
          tokenListColumns: batchSettings.tokenListColumns,
          useGoldRefreshFallback: batchSettings.useGoldRefreshFallback,
          smartDepartureGoldThreshold: batchSettings.smartDepartureGoldThreshold,
          smartDepartureRecruitThreshold:
            batchSettings.smartDepartureRecruitThreshold,
          smartDepartureJadeThreshold: batchSettings.smartDepartureJadeThreshold,
          smartDepartureTicketThreshold:
            batchSettings.smartDepartureTicketThreshold,
          smartDepartureMatchAll: batchSettings.smartDepartureMatchAll,
          helperLineupAnalysisEnabled: batchSettings.helperLineupAnalysisEnabled,
          helperPreferredLineups: Array.isArray(
            batchSettings.helperPreferredLineups,
          )
            ? [...batchSettings.helperPreferredLineups]
            : [],
        },
        tokenSettings,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      triggerBlobDownload({
        blob,
        fileName: `xyzw_config_${new Date().toISOString().slice(0, 10)}.json`,
      });

      message.success(
        `导出成功: ${exportData.tokens.length} 个账号, ${exportData.scheduledTasks.length} 个定时任务`,
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

          if (
            !importData.version
            || !importData.tokens
            || !importData.scheduledTasks
          ) {
            message.error("无效的配置文件格式");
            return;
          }

          let importedTokens = 0;
          let importedTasks = 0;

          if (Array.isArray(importData.tokens)) {
            importData.tokens.forEach((token) => {
              const exists = gameTokens.value.some(
                (currentToken) =>
                  currentToken.token === token.token || currentToken.id === token.id,
              );
              if (!exists && token.token) {
                gameTokens.value.push({
                  id:
                    token.id
                    || `token_${Date.now()}${Math.random().toString(36).slice(2)}`,
                  name: token.name || "",
                  token: token.token,
                  server: token.server || "",
                  wsUrl: token.wsUrl || null,
                  remark: token.remark || "",
                  importMethod: "import",
                  sourceUrl: token.sourceUrl || null,
                  upgradedToPermanent: true,
                  upgradedAt: token.upgradedAt || null,
                  updatedAt: token.updatedAt || new Date().toISOString(),
                  createdAt: new Date().toISOString(),
                  lastUsed: new Date().toISOString(),
                });
                importedTokens++;
              }
            });
          }

          if (Array.isArray(importData.scheduledTasks)) {
            importData.scheduledTasks.forEach((task) => {
              const exists = scheduledTasks.value.some(
                (currentTask) => currentTask.id === task.id,
              );
              if (!exists && task.id) {
                scheduledTasks.value.push(task);
                importedTasks++;
              }
            });
            saveScheduledTasks();
          }

          if (importData.batchSettings) {
            Object.assign(batchSettings, importData.batchSettings);
            saveBatchSettings();
          }

          if (Array.isArray(importData.tokenSettings)) {
            importData.tokenSettings.forEach((item) => {
              if (item.tokenId && item.settings) {
                localStorage.setItem(
                  `daily-settings:${item.tokenId}`,
                  JSON.stringify(item.settings),
                );
              }
            });
          }

          message.success(
            `导入成功: ${importedTokens} 个新账号, ${importedTasks} 个新定时任务`,
          );
        } catch (parseError) {
          console.error("Parse error:", parseError);
          message.error("解析配置文件失败");
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
