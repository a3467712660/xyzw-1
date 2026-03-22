export function useTaskControlSettingsEditor({
  appendLog,
  buildSimpleCustomCron,
  getCronByScheduleKey,
  getDefaultDailyRunnerSettings,
  getDefaultSmartCarSettings,
  getScheduleKeyByCronExpr,
  message,
  normalizeClubStoreGoodsIds,
  normalizeDailyRunnerByTokenMap,
  normalizeDailyRunnerSettings,
  normalizeDailySelectedTasks,
  normalizeSkipLineups,
  normalizeSmartCarByTokenMap,
  normalizeSmartCarSettings,
  persistState,
  refreshNextRunNow,
  settingsForm,
  showSettings,
  t,
  validateCronExpression,
  DEFAULT_ARENA_SKIP_LINEUPS,
  editingTask,
  nextRunNow,
}) {
  const openSettings = (row) => {
    editingTask.value = row;
    const scheduleKey = getScheduleKeyByCronExpr(row.cronExpr);
    settingsForm.value = {
      enabled: !!row.enabled,
      cronExpr: row.cronExpr,
      scheduleKey,
      customType: "daily",
      customIntervalHours: 4,
      customWeekDays: [1],
      customHour: 9,
      customMinute: 0,
      dailySelectedTasks: Array.isArray(row.dailySelectedTasks)
        ? normalizeDailySelectedTasks(row.dailySelectedTasks)
        : [],
      dailyRunner: row.dailyRunner
        ? normalizeDailyRunnerSettings(row.dailyRunner)
        : getDefaultDailyRunnerSettings(),
      dailyRunnerByToken: row.dailyRunnerByToken
        ? normalizeDailyRunnerByTokenMap(row.dailyRunnerByToken)
        : {},
      dailyRunnerEditorTokenId: null,
      smartCar: row.smartCar
        ? normalizeSmartCarSettings(row.smartCar)
        : getDefaultSmartCarSettings(),
      smartCarByToken: row.smartCarByToken
        ? normalizeSmartCarByTokenMap(row.smartCarByToken)
        : {},
      smartCarEditorTokenId: null,
      arenaConfig: row.arenaConfig
        ? {
            ...row.arenaConfig,
            skipLineups: normalizeSkipLineups(row.arenaConfig.skipLineups),
          }
        : {
            mode: "batch",
            fightCount: 10,
            arenaFormation: 1,
            skipLineups: [...DEFAULT_ARENA_SKIP_LINEUPS],
          },
      clubStore: row.clubStore
        ? {
            goodsIds: normalizeClubStoreGoodsIds(row.clubStore.goodsIds),
            onlyUnbought: row.clubStore.onlyUnbought !== false,
          }
        : {
            goodsIds: [6],
            onlyUnbought: true,
          },
      tokenIds: Array.isArray(row.tokenIds) ? [...row.tokenIds] : [],
    };
    showSettings.value = true;
  };

  const saveSettings = () => {
    const row = editingTask.value;
    if (!row)
      return;

    let cronExpr = "";
    try {
      if (settingsForm.value.scheduleKey === "custom_simple") {
        cronExpr = buildSimpleCustomCron();
      } else {
        cronExpr = getCronByScheduleKey(
          settingsForm.value.scheduleKey,
          settingsForm.value.cronExpr,
        );
      }
    } catch (error) {
      message.error(error.message || t("taskControl.messages.invalidSimpleCustomConfig"));
      return;
    }

    const validation = validateCronExpression(cronExpr);
    if (!validation.valid) {
      message.error(validation.message || t("taskControl.messages.invalidCron"));
      return;
    }

    row.enabled = !!settingsForm.value.enabled;
    row.cronExpr = cronExpr;
    row.tokenIds = Array.isArray(settingsForm.value.tokenIds)
      ? [...settingsForm.value.tokenIds]
      : [];
    row.dailySelectedTasks = normalizeDailySelectedTasks(
      settingsForm.value.dailySelectedTasks,
    );
    row.dailyRunner = normalizeDailyRunnerSettings(settingsForm.value.dailyRunner);
    row.dailyRunnerByToken = normalizeDailyRunnerByTokenMap(
      settingsForm.value.dailyRunnerByToken,
    );
    row.smartCar = normalizeSmartCarSettings(settingsForm.value.smartCar);
    row.smartCarByToken = normalizeSmartCarByTokenMap(
      settingsForm.value.smartCarByToken,
    );
    row.arenaConfig = settingsForm.value.arenaConfig
      ? {
          mode:
            settingsForm.value.arenaConfig.mode === "standalone"
              ? "standalone"
              : "batch",
          fightCount: Math.max(
            1,
            Math.min(10000, Number(settingsForm.value.arenaConfig.fightCount || 10)),
          ),
          arenaFormation: Math.max(
            1,
            Math.min(6, Number(settingsForm.value.arenaConfig.arenaFormation || 1)),
          ),
          skipLineups: normalizeSkipLineups(
            settingsForm.value.arenaConfig.skipLineups,
          ),
        }
      : {
          mode: "batch",
          fightCount: 10,
          arenaFormation: 1,
          skipLineups: [...DEFAULT_ARENA_SKIP_LINEUPS],
        };
    row.clubStore = settingsForm.value.clubStore
      ? {
          goodsIds: normalizeClubStoreGoodsIds(settingsForm.value.clubStore.goodsIds),
          onlyUnbought: settingsForm.value.clubStore.onlyUnbought !== false,
        }
      : {
          goodsIds: [6],
          onlyUnbought: true,
        };

    persistState();
    refreshNextRunNow(nextRunNow);
    showSettings.value = false;
    appendLog(row, t("taskControl.messages.settingsSaved"), "info");
  };

  return {
    openSettings,
    saveSettings,
  };
}
