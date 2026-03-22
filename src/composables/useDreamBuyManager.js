import { ref } from "vue";

export function useDreamBuyManager({
  batchSettings,
  goldItemsConfig,
  merchantConfig,
  message,
  saveBatchSettings,
}) {
  const showDreamBuyModal = ref(false);
  const dreamBuyList = ref([]);

  const openDreamBuyModal = () => {
    dreamBuyList.value = batchSettings.dreamPurchaseList || [];
    showDreamBuyModal.value = true;
  };

  const toggleDreamItem = (itemKey, checked) => {
    if (checked) {
      if (!dreamBuyList.value.includes(itemKey)) {
        dreamBuyList.value.push(itemKey);
      }
    } else {
      dreamBuyList.value = dreamBuyList.value.filter((key) => key !== itemKey);
    }
  };

  const saveDreamBuyConfig = () => {
    batchSettings.dreamPurchaseList = [...dreamBuyList.value];
    saveBatchSettings();
    showDreamBuyModal.value = false;
    message.success("梦境购买配置已保存");
  };

  const selectGoldItems = () => {
    const newSelection = new Set(dreamBuyList.value);

    for (const merchantId in goldItemsConfig) {
      const items = goldItemsConfig[merchantId];
      items.forEach((index) => {
        newSelection.add(`${merchantId}-${index}`);
      });
    }

    dreamBuyList.value = Array.from(newSelection);
  };

  const selectAllItems = () => {
    const newSelection = new Set(dreamBuyList.value);

    for (const merchantId in merchantConfig) {
      const items = merchantConfig[merchantId].items;
      items.forEach((_, index) => {
        newSelection.add(`${merchantId}-${index}`);
      });
    }

    dreamBuyList.value = Array.from(newSelection);
  };

  const clearAllItems = () => {
    dreamBuyList.value = [];
  };

  return {
    clearAllItems,
    dreamBuyList,
    openDreamBuyModal,
    saveDreamBuyConfig,
    selectAllItems,
    selectGoldItems,
    showDreamBuyModal,
    toggleDreamItem,
  };
}
