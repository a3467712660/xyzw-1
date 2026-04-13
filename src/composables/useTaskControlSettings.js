import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import { ARENA_LINEUP_PRESET_OPTIONS, ARENA_LINEUP_PRESET_VALUES } from "@/utils/arenaLineupPresets";

const DAILY_EXTRA_TASK_POOL_KEY = "batchGenieSweep";
const helperLineupKeywordOptions = [...ARENA_LINEUP_PRESET_OPTIONS];
const helperLineupKeywordSet = new Set(ARENA_LINEUP_PRESET_VALUES);
const arenaSkipLineupOptions = [...ARENA_LINEUP_PRESET_OPTIONS];
const arenaSkipLineupSet = new Set(ARENA_LINEUP_PRESET_VALUES);

export function useTaskControlSettings() {
  const tokenStore = useTokenStore();
  const { t } = useI18n();

  const DEFAULT_ARENA_SKIP_LINEUPS = [
    t("taskControl.defaultLineups.lvZhao"),
    t("taskControl.defaultLineups.guanYu"),
  ];

  const TASK_TEMPLATES = computed(() => [
    { id: "daily", title: t("taskControl.tasks.daily.title"), subtitle: t("taskControl.tasks.daily.subtitle"), taskName: "startBatch", cronExpr: "0 1 * * *" },
    { id: "hangup", title: t("taskControl.tasks.hangup.title"), subtitle: t("taskControl.tasks.hangup.subtitle"), taskName: "claimHangUpRewards", cronExpr: "0 */8 * * *" },
    { id: "bottle", title: t("taskControl.tasks.bottle.title"), subtitle: t("taskControl.tasks.bottle.subtitle"), taskName: "resetBottles", cronExpr: "0 */8 * * *" },
    { id: "tower", title: t("taskControl.tasks.tower.title"), subtitle: t("taskControl.tasks.tower.subtitle"), taskName: "climbTower", cronExpr: "0 */5 * * *" },
    { id: "send-car", title: t("taskControl.tasks.sendCar.title"), subtitle: t("taskControl.tasks.sendCar.subtitle"), taskName: "batchSmartSendCar", cronExpr: "30 6 * * 1-3" },
    { id: "claim-car", title: t("taskControl.tasks.claimCar.title"), subtitle: t("taskControl.tasks.claimCar.subtitle"), taskName: "batchClaimCars", cronExpr: "0 11 * * 1-3" },
    { id: "study", title: t("taskControl.tasks.study.title"), subtitle: t("taskControl.tasks.study.subtitle"), taskName: "batchStudy", cronExpr: "30 0 * * 1" },
    { id: "legacy", title: t("taskControl.tasks.legacy.title"), subtitle: t("taskControl.tasks.legacy.subtitle"), taskName: "batchLegacyClaim", cronExpr: "0 */4 * * *" },
    { id: "arena", title: t("taskControl.tasks.arena.title"), subtitle: t("taskControl.tasks.arena.subtitle"), taskName: "batcharenafight", cronExpr: "30 9 * * *" },
    { id: "club-store", title: t("taskControl.tasks.clubStore.title"), subtitle: t("taskControl.tasks.clubStore.subtitle"), taskName: "legion_storebuygoods", cronExpr: "0 9 * * 1" },
  ]);

  const getDefaultSmartCarSettings = () => ({
    carMinColor: 4,
    useGoldRefreshFallback: false,
    smartDepartureGoldThreshold: 0,
    smartDepartureRecruitThreshold: 0,
    smartDepartureJadeThreshold: 0,
    smartDepartureTicketThreshold: 0,
    smartDepartureMaxRefreshAttempts: 30,
    smartDepartureMatchAll: false,
    helperLineupAnalysisEnabled: true,
    helperPreferredLineups: [],
  });

  const getDefaultDailyRunnerSettings = () => ({
    friendGoldEnable: true,
    recruitEnable: true,
    payRecruit: true,
    openBox: true,
    freeFishEnable: true,
    mengjingEnable: true,
    legionBossEnable: true,
    dailyBossEnable: true,
    bossTimes: 2,
    legionBossFormation: undefined,
    dailyBossFormation: undefined,
  });

  const showSettings = ref(false);
  const editingTask = ref(null);
  const settingsForm = ref({
    enabled: false,
    cronExpr: "",
    scheduleKey: "custom",
    customType: "daily",
    customIntervalHours: 4,
    customWeekDays: [1],
    customHour: 9,
    customMinute: 0,
    dailySelectedTasks: [],
    dailyRunner: getDefaultDailyRunnerSettings(),
    dailyRunnerByToken: {},
    dailyRunnerEditorTokenId: null,
    smartCar: getDefaultSmartCarSettings(),
    smartCarByToken: {},
    smartCarEditorTokenId: null,
    arenaConfig: {
      mode: "batch",
      fightCount: 10,
      arenaFormation: 1,
      skipLineups: [...DEFAULT_ARENA_SKIP_LINEUPS],
    },
    clubStore: {
      goodsIds: [6],
      onlyUnbought: true,
    },
    tokenIds: [],
  });

  const updateSettingsForm = (updater) => {
    if (typeof updater !== "function") {
      return;
    }
    const currentValue = settingsForm.value;
    const nextValue = updater(currentValue);
    if (nextValue && nextValue !== currentValue) {
      settingsForm.value = nextValue;
    }
  };

  const tokenOptions = computed(() =>
    tokenStore.gameTokens.map((token) => ({
      label: `${token.name} (${token.server || "-"})`,
      value: token.id,
    })),
  );

  const carColorOptions = computed(() => [
    { label: t("taskControl.carColors.orangePlus"), value: 4 },
    { label: t("taskControl.carColors.redPlus"), value: 5 },
    { label: t("taskControl.carColors.goldPlus"), value: 6 },
  ]);

  const arenaFormationOptions = computed(() => [1, 2, 3, 4, 5, 6].map((v) => ({
    label: t("taskControl.arenaFormation", { value: v }),
    value: v,
  })));

  const clubStoreGoodsOptions = computed(() => [
    6,
    1,
    2,
    3,
    4,
    5,
    7,
    8,
    9,
    10,
    11,
    101,
    102,
    103,
    104,
  ].map((value) => ({
    label: t(`taskControl.clubStoreGoods.${value}`),
    value,
  })));

  const normalizeClubStoreGoodsIds = (value) => {
    if (!Array.isArray(value))
      return [6];
    const ids = [...new Set(value.map((v) => Number(v)).filter((v) => Number.isInteger(v) && v > 0))];
    return ids.length > 0 ? ids : [6];
  };

  const normalizeSkipLineups = (value) => {
    if (!Array.isArray(value))
      return [...DEFAULT_ARENA_SKIP_LINEUPS];
    const list = [...new Set(value.map((item) => String(item || "").trim()).filter((item) => item && arenaSkipLineupSet.has(item)))];
    return list.length > 0 ? list : [...DEFAULT_ARENA_SKIP_LINEUPS];
  };

  const normalizeLineupKeywords = (value) => {
    if (!Array.isArray(value))
      return [];
    return [...new Set(value.map((item) => String(item || "").trim()).filter((item) => item && helperLineupKeywordSet.has(item)))];
  };

  const normalizeSmartCarSettings = (value) => {
    const source = value && typeof value === "object" ? value : {};
    return {
      carMinColor: Number(source.carMinColor || 4),
      useGoldRefreshFallback: Boolean(source.useGoldRefreshFallback),
      smartDepartureGoldThreshold: Number(source.smartDepartureGoldThreshold || 0),
      smartDepartureRecruitThreshold: Number(source.smartDepartureRecruitThreshold || 0),
      smartDepartureJadeThreshold: Number(source.smartDepartureJadeThreshold || 0),
      smartDepartureTicketThreshold: Number(source.smartDepartureTicketThreshold || 0),
      smartDepartureMaxRefreshAttempts: Math.max(1, Math.min(500, Number(source.smartDepartureMaxRefreshAttempts || source.smartDepartureMaxRefreshTimes || 30) || 30)),
      smartDepartureMatchAll: Boolean(source.smartDepartureMatchAll),
      helperLineupAnalysisEnabled: source.helperLineupAnalysisEnabled !== false,
      helperPreferredLineups: normalizeLineupKeywords(source.helperPreferredLineups),
    };
  };

  const normalizeDailyRunnerSettings = (value) => {
    const source = value && typeof value === "object" ? value : {};
    const parseFormation = (raw, fallback = undefined) => {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 1 || n > 6)
        return fallback;
      return n;
    };
    const parseBossTimes = Number(source.bossTimes);
    return {
      friendGoldEnable: source.friendGoldEnable !== false,
      recruitEnable: source.recruitEnable !== false,
      payRecruit: source.payRecruit !== false,
      openBox: source.openBox !== false,
      freeFishEnable: source.freeFishEnable !== false,
      mengjingEnable: source.mengjingEnable !== false,
      legionBossEnable: source.legionBossEnable !== false,
      dailyBossEnable: source.dailyBossEnable !== false,
      bossTimes: Number.isFinite(parseBossTimes) ? Math.max(0, Math.min(4, Math.floor(parseBossTimes))) : 2,
      legionBossFormation: parseFormation(source.legionBossFormation, undefined),
      dailyBossFormation: parseFormation(source.dailyBossFormation, undefined),
    };
  };

  const normalizeDailyRunnerByTokenMap = (value) => {
    if (!value || typeof value !== "object")
      return {};
    const normalized = {};
    Object.entries(value).forEach(([tokenId, settings]) => {
      const key = String(tokenId || "").trim();
      if (key)
        normalized[key] = normalizeDailyRunnerSettings(settings);
    });
    return normalized;
  };

  const normalizeSmartCarByTokenMap = (value) => {
    if (!value || typeof value !== "object")
      return {};
    const normalized = {};
    Object.entries(value).forEach(([tokenId, settings]) => {
      const key = String(tokenId || "").trim();
      if (key)
        normalized[key] = normalizeSmartCarSettings(settings);
    });
    return normalized;
  };

  const dailySelectableOptions = computed(() => {
    const existingTaskNames = new Set(
      TASK_TEMPLATES.value.filter((item) => item.id !== "daily").map((item) => item.taskName),
    );
    return [
      { label: t("taskControl.extraTasks.genieSweep"), value: DAILY_EXTRA_TASK_POOL_KEY },
    ].filter((item) => !existingTaskNames.has(item.value));
  });

  const normalizeDailySelectedTasks = (value) => {
    if (!Array.isArray(value))
      return [];
    const allowed = new Set(dailySelectableOptions.value.map((item) => item.value));
    return [...new Set(value.map((item) => String(item || "").trim()).filter((item) => allowed.has(item)))];
  };

  const scheduleOptions = computed(() => [
    { label: t("taskControl.scheduleOptions.daily0100"), value: "daily_0100" },
    { label: t("taskControl.scheduleOptions.daily0930"), value: "daily_0930" },
    { label: t("taskControl.scheduleOptions.hourly4"), value: "hourly_4" },
    { label: t("taskControl.scheduleOptions.hourly8"), value: "hourly_8" },
    { label: t("taskControl.scheduleOptions.weeklyMon0030"), value: "weekly_mon_0030" },
    { label: t("taskControl.scheduleOptions.weeklyMon0900"), value: "weekly_mon_0900" },
    { label: t("taskControl.scheduleOptions.weekly1230630"), value: "weekly_123_0630" },
    { label: t("taskControl.scheduleOptions.weekly1231100"), value: "weekly_123_1100" },
    { label: t("taskControl.scheduleOptions.customSimple"), value: "custom_simple" },
    { label: t("taskControl.scheduleOptions.customAdvanced"), value: "custom" },
  ]);

  const customTypeOptions = computed(() => [
    { label: t("taskControl.customTypes.daily"), value: "daily" },
    { label: t("taskControl.customTypes.hourly"), value: "hourly" },
    { label: t("taskControl.customTypes.weekly"), value: "weekly" },
  ]);

  const weekDayOptions = computed(() => [
    { label: t("taskControl.weekdays.monday"), value: 1 },
    { label: t("taskControl.weekdays.tuesday"), value: 2 },
    { label: t("taskControl.weekdays.wednesday"), value: 3 },
    { label: t("taskControl.weekdays.thursday"), value: 4 },
    { label: t("taskControl.weekdays.friday"), value: 5 },
    { label: t("taskControl.weekdays.saturday"), value: 6 },
    { label: t("taskControl.weekdays.sunday"), value: 0 },
  ]);

  const scheduleCronMap = {
    daily_0100: "0 1 * * *",
    daily_0930: "30 9 * * *",
    hourly_4: "0 */4 * * *",
    hourly_8: "0 */8 * * *",
    weekly_mon_0030: "30 0 * * 1",
    weekly_mon_0900: "0 9 * * 1",
    weekly_123_0630: "30 6 * * 1-3",
    weekly_123_1100: "0 11 * * 1-3",
  };

  const getScheduleKeyByCronExpr = (expr) => {
    const matched = Object.entries(scheduleCronMap).find(([, cron]) => cron === expr);
    return matched ? matched[0] : "custom";
  };

  const getCronByScheduleKey = (key, fallbackCron = "") => {
    if (key === "custom")
      return String(fallbackCron || "").trim();
    return scheduleCronMap[key] || String(fallbackCron || "").trim();
  };

  const buildSimpleCustomCron = () => {
    const customType = settingsForm.value.customType;
    if (customType === "hourly") {
      const interval = Number(settingsForm.value.customIntervalHours || 0);
      if (!Number.isInteger(interval) || interval < 1 || interval > 23) {
        throw new Error(t("taskControl.validation.intervalHours"));
      }
      return `0 */${interval} * * *`;
    }

    const hour = Number(settingsForm.value.customHour);
    const minute = Number(settingsForm.value.customMinute);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      throw new Error(t("taskControl.validation.hour"));
    }
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error(t("taskControl.validation.minute"));
    }
    if (customType === "weekly") {
      const weekDays = Array.isArray(settingsForm.value.customWeekDays)
        ? [...new Set(settingsForm.value.customWeekDays.map((v) => Number(v)).filter((v) => v >= 0 && v <= 6))]
        : [];
      if (weekDays.length === 0) {
        throw new Error(t("taskControl.validation.weekday"));
      }
      return `${minute} ${hour} * * ${weekDays.sort((a, b) => a - b).join(",")}`;
    }
    return `${minute} ${hour} * * *`;
  };

  const cronToText = (expr) => {
    if (!expr)
      return t("taskControl.messages.notConfigured");
    const presetKey = getScheduleKeyByCronExpr(expr);
    if (presetKey !== "custom") {
      const preset = scheduleOptions.value.find((item) => item.value === presetKey);
      if (preset)
        return preset.label;
    }
    const parts = expr.trim().split(/\s+/);
    if (parts.length !== 5)
      return expr;
    const [m, h, d, mo, w] = parts;
    if (w === "*" && d === "*" && mo === "*" && Number.isInteger(Number(h)) && Number.isInteger(Number(m))) {
      return t("taskControl.messages.dailyAt", {
        hour: String(h).padStart(2, "0"),
        minute: String(m).padStart(2, "0"),
      });
    }
    if (m === "0" && h.startsWith("*/") && d === "*" && mo === "*" && w === "*") {
      return t("taskControl.messages.everyHours", { count: h.slice(2) });
    }
    return expr;
  };

  const onDailyRunnerEditorTokenChange = (tokenId) => {
    const key = String(tokenId || "").trim();
    if (!key)
      return;
    updateSettingsForm((current) => {
      const dailyRunnerByToken = current.dailyRunnerByToken && typeof current.dailyRunnerByToken === "object"
        ? { ...current.dailyRunnerByToken }
        : {};
      if (!dailyRunnerByToken[key]) {
        dailyRunnerByToken[key] = normalizeDailyRunnerSettings(current.dailyRunner);
      }
      return {
        ...current,
        dailyRunnerByToken,
      };
    });
  };

  const clearDailyRunnerOverride = (tokenId) => {
    const key = String(tokenId || "").trim();
    if (!key)
      return;
    updateSettingsForm((current) => {
      const dailyRunnerByToken = current.dailyRunnerByToken && typeof current.dailyRunnerByToken === "object"
        ? { ...current.dailyRunnerByToken }
        : {};
      if (!dailyRunnerByToken[key]) {
        return {
          ...current,
          dailyRunnerByToken,
        };
      }
      delete dailyRunnerByToken[key];
      return {
        ...current,
        dailyRunnerByToken,
      };
    });
  };

  const resolveDailyRunnerSettingsForToken = (row, tokenId) => {
    const globalSettings = normalizeDailyRunnerSettings(row?.dailyRunner);
    const tokenMap = normalizeDailyRunnerByTokenMap(row?.dailyRunnerByToken);
    const override = tokenMap[String(tokenId)] || null;
    return override ? { ...globalSettings, ...override } : globalSettings;
  };

  const onSmartCarEditorTokenChange = (tokenId) => {
    const key = String(tokenId || "").trim();
    if (!key)
      return;
    updateSettingsForm((current) => {
      const smartCarByToken = current.smartCarByToken && typeof current.smartCarByToken === "object"
        ? { ...current.smartCarByToken }
        : {};
      if (!smartCarByToken[key]) {
        smartCarByToken[key] = normalizeSmartCarSettings(current.smartCar);
      }
      return {
        ...current,
        smartCarByToken,
      };
    });
  };

  const clearSmartCarOverride = (tokenId) => {
    const key = String(tokenId || "").trim();
    if (!key)
      return;
    updateSettingsForm((current) => {
      const smartCarByToken = current.smartCarByToken && typeof current.smartCarByToken === "object"
        ? { ...current.smartCarByToken }
        : {};
      if (!smartCarByToken[key]) {
        return {
          ...current,
          smartCarByToken,
        };
      }
      delete smartCarByToken[key];
      return {
        ...current,
        smartCarByToken,
      };
    });
  };

  const resolveSmartCarSettingsForToken = (row, tokenId) => {
    const globalSettings = normalizeSmartCarSettings(row?.smartCar);
    const tokenMap = normalizeSmartCarByTokenMap(row?.smartCarByToken);
    const override = tokenMap[String(tokenId)] || null;
    return override ? { ...globalSettings, ...override } : globalSettings;
  };

  return {
    DEFAULT_ARENA_SKIP_LINEUPS,
    TASK_TEMPLATES,
    arenaFormationOptions,
    arenaSkipLineupOptions,
    buildSimpleCustomCron,
    carColorOptions,
    clearDailyRunnerOverride,
    clearSmartCarOverride,
    clubStoreGoodsOptions,
    cronToText,
    customTypeOptions,
    dailySelectableOptions,
    editingTask,
    getCronByScheduleKey,
    getDefaultDailyRunnerSettings,
    getDefaultSmartCarSettings,
    getScheduleKeyByCronExpr,
    helperLineupKeywordOptions,
    normalizeClubStoreGoodsIds,
    normalizeDailyRunnerByTokenMap,
    normalizeDailyRunnerSettings,
    normalizeDailySelectedTasks,
    normalizeLineupKeywords,
    normalizeSkipLineups,
    normalizeSmartCarByTokenMap,
    normalizeSmartCarSettings,
    onDailyRunnerEditorTokenChange,
    onSmartCarEditorTokenChange,
    resolveDailyRunnerSettingsForToken,
    resolveSmartCarSettingsForToken,
    scheduleOptions,
    settingsForm,
    showSettings,
    tokenOptions,
    updateSettingsForm,
    weekDayOptions,
  };
}
