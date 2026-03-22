import { computed } from "vue";

export function useBatchTokenSelection({
  selectedTokens,
  tokenStatus,
  tokens,
}) {
  const isAllSelected = computed(
    () =>
      selectedTokens.value.length === tokens.value.length
      && tokens.value.length > 0,
  );

  const isIndeterminate = computed(
    () =>
      selectedTokens.value.length > 0
      && selectedTokens.value.length < tokens.value.length,
  );

  const handleSelectAll = (checked) => {
    if (checked) {
      selectedTokens.value = tokens.value.map((token) => token.id);
      return;
    }

    selectedTokens.value = [];
  };

  const getStatusType = (tokenId) => {
    const status = tokenStatus.value[tokenId];
    if (status === "completed")
      return "success";
    if (status === "failed")
      return "error";
    if (status === "running")
      return "info";
    return "default";
  };

  const getStatusText = (tokenId) => {
    const status = tokenStatus.value[tokenId];
    if (status === "completed")
      return "已完成";
    if (status === "failed")
      return "失败";
    if (status === "running")
      return "执行中";
    return "等待中";
  };

  return {
    getStatusText,
    getStatusType,
    handleSelectAll,
    isAllSelected,
    isIndeterminate,
  };
}
