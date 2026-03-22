import {
  getJsonPreference,
  setJsonPreference,
} from "@/services/preferences/localPreferences";

export const loadFightHistoryFromLocalStorage = () =>
  getJsonPreference("fight_pvp_history_v1", []);

export const saveFightHistoryToLocalStorage = (value) => {
  setJsonPreference("fight_pvp_history_v1", value);
};

export const loadFightTargetListsFromLocalStorage = () =>
  getJsonPreference("fight_pvp_target_lists_v1", {});

export const saveFightTargetListsToLocalStorage = (value) => {
  setJsonPreference("fight_pvp_target_lists_v1", value);
};

export const loadFightTargetSyncDiagnosticFromLocalStorage = () =>
  getJsonPreference("fight_pvp_target_sync_diagnostic_v1", null);

export const saveFightTargetSyncDiagnosticToLocalStorage = (value) => {
  setJsonPreference("fight_pvp_target_sync_diagnostic_v1", value);
};
