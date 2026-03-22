import { computed, ref } from "vue";
import api from "@/api";

export function useTaskControlState({
  DEFAULT_ARENA_SKIP_LINEUPS,
  TASK_TEMPLATES,
  getDefaultDailyRunnerSettings,
  getDefaultSmartCarSettings,
  message,
  normalizeClubStoreGoodsIds,
  normalizeDailyRunnerByTokenMap,
  normalizeDailyRunnerSettings,
  normalizeDailySelectedTasks,
  normalizeSkipLineups,
  normalizeSmartCarByTokenMap,
  normalizeSmartCarSettings,
  t,
  tokenStore,
}) {
  const taskRows = ref([]);
  const availableBinTokenIds = ref([]);
  const binStatusLoading = ref(false);

  const extractRoleIdFromTokenText = (tokenText) => {
    if (typeof tokenText !== "string" || !tokenText.trim())
      return "";
    try {
      const parsed = JSON.parse(tokenText);
      const roleId = Number(parsed?.roleId || parsed?.role?.roleId);
      return Number.isFinite(roleId) && roleId > 0 ? String(roleId) : "";
    } catch {
      return "";
    }
  };

  const configuredBoundTokenIds = computed(() => {
    const ids = new Set();
    for (const row of taskRows.value) {
      const tokenIds = Array.isArray(row?.tokenIds) ? row.tokenIds : [];
      for (const tokenId of tokenIds) {
        const id = String(tokenId || "").trim();
        if (id)
          ids.add(id);
      }
    }
    return [...ids];
  });

  const configuredMissingBoundTokenIds = computed(() => {
    const available = new Set(availableBinTokenIds.value);
    return configuredBoundTokenIds.value.filter((id) => !available.has(id));
  });

  const maskTokenId = (tokenId) => {
    const value = String(tokenId || "").trim();
    if (!value)
      return "***";
    if (value.length <= 8)
      return `${value.slice(0, 2)}***`;
    return `${value.slice(0, 4)}***${value.slice(-4)}`;
  };

  const missingBoundTokenLabels = computed(() => {
    if (configuredMissingBoundTokenIds.value.length === 0)
      return "";
    const nameMap = new Map(
      tokenStore.gameTokens.map((token) => [token.id, token.name || token.id]),
    );
    const labels = configuredMissingBoundTokenIds.value.map((id) => {
      const name = String(nameMap.get(id) || id).trim();
      return `${name}(token:${maskTokenId(id)})`;
    });
    if (labels.length <= 3) {
      return labels.join("、");
    }
    return `${labels.slice(0, 3).join("、")} 等 ${labels.length} 个`;
  });

  const serializeRows = () =>
    taskRows.value.map((item) => {
      const tokenIds = Array.isArray(item.tokenIds) ? [...item.tokenIds] : [];
      const tokenNameMap = {};
      const tokenRoleIdMap = {};
      for (const token of tokenStore.gameTokens || []) {
        const id = String(token?.id || "").trim();
        if (!id)
          continue;
        const name = String(token?.name || id).trim() || id;
        tokenNameMap[id] = name;
        const roleId = extractRoleIdFromTokenText(token?.token);
        if (roleId) {
          tokenRoleIdMap[id] = roleId;
        }
      }
      return {
        id: item.id,
        enabled: !!item.enabled,
        cronExpr: item.cronExpr,
        tokenIds,
        tokenNameMap,
        tokenRoleIdMap,
        dailySelectedTasks: normalizeDailySelectedTasks(item.dailySelectedTasks),
        dailyRunner: item.dailyRunner
          ? normalizeDailyRunnerSettings(item.dailyRunner)
          : getDefaultDailyRunnerSettings(),
        dailyRunnerByToken: item.dailyRunnerByToken
          ? normalizeDailyRunnerByTokenMap(item.dailyRunnerByToken)
          : {},
        smartCar: item.smartCar
          ? normalizeSmartCarSettings(item.smartCar)
          : getDefaultSmartCarSettings(),
        smartCarByToken: item.smartCarByToken
          ? normalizeSmartCarByTokenMap(item.smartCarByToken)
          : {},
        arenaConfig: item.arenaConfig
          ? {
              ...item.arenaConfig,
              skipLineups: normalizeSkipLineups(item.arenaConfig.skipLineups),
            }
          : {
              mode: "batch",
              fightCount: 10,
              arenaFormation: 1,
              skipLineups: [...DEFAULT_ARENA_SKIP_LINEUPS],
            },
        clubStore: item.clubStore
          ? {
              goodsIds: normalizeClubStoreGoodsIds(item.clubStore.goodsIds),
              onlyUnbought: item.clubStore.onlyUnbought !== false,
            }
          : {
              goodsIds: [6],
              onlyUnbought: true,
            },
        lastAutoMinuteKey: item.lastAutoMinuteKey || "",
        lastRunAt: item.lastRunAt || "",
        quietDeferredAt: item.quietDeferredAt || "",
      };
    });

  const persistState = async () => {
    try {
      await api.taskControl.saveState(serializeRows());
    } catch (error) {
      message.warning(error?.message || t("taskControl.messages.saveStateFailed"));
    }
  };

  const loadState = async () => {
    let savedMap = new Map();
    let tokenBindingAutoFixed = false;
    try {
      const resp = await api.taskControl.getState();
      const parsed = Array.isArray(resp?.data?.tasks) ? resp.data.tasks : [];
      savedMap = new Map(parsed.map((item) => [item.id, item]));
    } catch {
      savedMap = new Map();
    }

    const currentTokens = Array.isArray(tokenStore.gameTokens)
      ? tokenStore.gameTokens
      : [];
    const validTokenIdSet = new Set(
      currentTokens.map((token) => String(token?.id || "").trim()).filter(Boolean),
    );
    const tokenIdsByName = new Map();
    for (const token of currentTokens) {
      const id = String(token?.id || "").trim();
      const name = String(token?.name || "").trim();
      if (!id || !name)
        continue;
      const list = tokenIdsByName.get(name) || [];
      list.push(id);
      tokenIdsByName.set(name, list);
    }

    taskRows.value = TASK_TEMPLATES.value.map((tpl) => {
      const saved = savedMap.get(tpl.id) || {};
      const rawTokenIds = Array.isArray(saved.tokenIds) ? saved.tokenIds : [];
      const tokenNameMap =
        saved.tokenNameMap && typeof saved.tokenNameMap === "object"
          ? { ...saved.tokenNameMap }
          : {};
      const normalizedTokenIds = [];
      const usedTokenIds = new Set();
      for (const rawId of rawTokenIds) {
        const id = String(rawId || "").trim();
        if (!id)
          continue;
        if (validTokenIdSet.has(id) && !usedTokenIds.has(id)) {
          normalizedTokenIds.push(id);
          usedTokenIds.add(id);
          continue;
        }
        const legacyName = String(tokenNameMap[id] || "").trim();
        if (!legacyName)
          continue;
        const candidates = (tokenIdsByName.get(legacyName) || []).filter(
          (candidateId) => !usedTokenIds.has(candidateId),
        );
        if (candidates.length === 1) {
          normalizedTokenIds.push(candidates[0]);
          usedTokenIds.add(candidates[0]);
        }
      }
      const autoFallbackToAllAccounts =
        rawTokenIds.length > 0 && normalizedTokenIds.length === 0;
      if (autoFallbackToAllAccounts || normalizedTokenIds.length !== rawTokenIds.length) {
        tokenBindingAutoFixed = true;
      }
      return {
        ...tpl,
        enabled: Boolean(saved.enabled ?? false),
        cronExpr:
          typeof saved.cronExpr === "string" && saved.cronExpr
            ? saved.cronExpr
            : tpl.cronExpr,
        tokenIds: autoFallbackToAllAccounts ? [] : normalizedTokenIds,
        tokenNameMap,
        tokenRoleIdMap:
          saved.tokenRoleIdMap && typeof saved.tokenRoleIdMap === "object"
            ? { ...saved.tokenRoleIdMap }
            : {},
        dailySelectedTasks: Array.isArray(saved.dailySelectedTasks)
          ? normalizeDailySelectedTasks(saved.dailySelectedTasks)
          : [],
        dailyRunner: saved.dailyRunner
          ? normalizeDailyRunnerSettings(saved.dailyRunner)
          : getDefaultDailyRunnerSettings(),
        dailyRunnerByToken: saved.dailyRunnerByToken
          ? normalizeDailyRunnerByTokenMap(saved.dailyRunnerByToken)
          : {},
        smartCar: saved.smartCar
          ? normalizeSmartCarSettings(saved.smartCar)
          : getDefaultSmartCarSettings(),
        smartCarByToken: saved.smartCarByToken
          ? normalizeSmartCarByTokenMap(saved.smartCarByToken)
          : {},
        arenaConfig: saved.arenaConfig
          ? {
              ...saved.arenaConfig,
              skipLineups: normalizeSkipLineups(saved.arenaConfig.skipLineups),
            }
          : {
              mode: "batch",
              fightCount: 10,
              arenaFormation: 1,
              skipLineups: [...DEFAULT_ARENA_SKIP_LINEUPS],
            },
        clubStore: saved.clubStore
          ? {
              goodsIds: normalizeClubStoreGoodsIds(saved.clubStore.goodsIds),
              onlyUnbought: saved.clubStore.onlyUnbought !== false,
            }
          : {
              goodsIds: [6],
              onlyUnbought: true,
            },
        lastAutoMinuteKey: saved.lastAutoMinuteKey || "",
        lastRunAt: saved.lastRunAt || "",
        quietDeferredAt: saved.quietDeferredAt || "",
      };
    });

    if (tokenBindingAutoFixed) {
      await persistState();
    }
  };

  const loadBinStatus = async () => {
    binStatusLoading.value = true;
    try {
      const resp = await api.binFiles.list();
      const rows = Array.isArray(resp?.data) ? resp.data : [];
      availableBinTokenIds.value = [
        ...new Set(
          rows.map((item) => String(item?.tokenId || "").trim()).filter(Boolean),
        ),
      ];
    } catch {
      availableBinTokenIds.value = [];
    } finally {
      binStatusLoading.value = false;
    }
  };

  return {
    availableBinTokenIds,
    binStatusLoading,
    configuredBoundTokenIds,
    configuredMissingBoundTokenIds,
    loadBinStatus,
    loadState,
    missingBoundTokenLabels,
    persistState,
    taskRows,
  };
}
