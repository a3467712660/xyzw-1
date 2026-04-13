import { computed, ref } from "vue";
import {
  getTokenSortConfig,
  setTokenSortConfig,
} from "@/services/tokenImport/tokenImportPreferences";

export function useBatchTokenSort(tokenStore) {
  const sortConfig = ref(getTokenSortConfig());

  const sortedTokens = computed(() => {
    return [...tokenStore.gameTokens].sort((tokenA, tokenB) => {
      let valueA;
      let valueB;

      switch (sortConfig.value.field) {
        case "name":
          valueA = tokenA.name?.toLowerCase() || "";
          valueB = tokenB.name?.toLowerCase() || "";
          break;
        case "server":
          valueA = tokenA.server?.toLowerCase() || "";
          valueB = tokenB.server?.toLowerCase() || "";
          break;
        case "createdAt":
          valueA = new Date(tokenA.createdAt || 0).getTime();
          valueB = new Date(tokenB.createdAt || 0).getTime();
          break;
        case "lastUsed":
          valueA = new Date(tokenA.lastUsed || 0).getTime();
          valueB = new Date(tokenB.lastUsed || 0).getTime();
          break;
        default:
          valueA = tokenA.name?.toLowerCase() || "";
          valueB = tokenB.name?.toLowerCase() || "";
      }

      if (valueA < valueB) {
        return sortConfig.value.direction === "asc" ? -1 : 1;
      }
      if (valueA > valueB) {
        return sortConfig.value.direction === "asc" ? 1 : -1;
      }
      return 0;
    });
  });

  const toggleSort = (field) => {
    if (sortConfig.value.field === field) {
      sortConfig.value.direction =
        sortConfig.value.direction === "asc" ? "desc" : "asc";
    } else {
      sortConfig.value.field = field;
      sortConfig.value.direction = "asc";
    }
    setTokenSortConfig(sortConfig.value);
  };

  const getSortIcon = (field) => {
    if (sortConfig.value.field !== field) {
      return null;
    }
    return sortConfig.value.direction === "asc" ? "↑" : "↓";
  };

  return {
    getSortIcon,
    sortConfig,
    sortedTokens,
    toggleSort,
  };
}
