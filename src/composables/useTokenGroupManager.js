import { ref } from "vue";

export function useTokenGroupManager({
  message,
  selectedTokens,
  sortedTokens,
  tokenGroups,
  tokenStore,
  tokens,
}) {
  const showGroupManageModal = ref(false);
  const selectedGroups = ref([]);
  const newGroupName = ref("");
  const newGroupColor = ref("#1677ff");
  const newGroupSelectedTokens = ref([]);
  const editingGroupId = ref(null);
  const editingGroupName = ref("");
  const editingGroupColor = ref("");
  const taskScheduleSelectedGroupIds = ref([]);

  const groupColors = [
    "#1677ff",
    "#52c41a",
    "#faad14",
    "#f5222d",
    "#722ed1",
    "#13c2c2",
    "#eb2f96",
    "#fa8c16",
  ];

  const createNewGroup = () => {
    if (!newGroupName.value.trim()) {
      message.warning("请输入分组名称");
      return;
    }

    const newGroup = tokenStore.createTokenGroup(
      newGroupName.value.trim(),
      newGroupColor.value,
    );

    if (newGroupSelectedTokens.value.length > 0) {
      newGroupSelectedTokens.value.forEach((tokenId) => {
        tokenStore.addTokenToGroup(newGroup.id, tokenId);
      });
    }

    message.success("分组创建成功");
    newGroupName.value = "";
    newGroupColor.value = "#1677ff";
    newGroupSelectedTokens.value = [];
  };

  const selectAllNewGroup = () => {
    newGroupSelectedTokens.value = sortedTokens.value.map((token) => token.id);
  };

  const deselectAllNewGroup = () => {
    newGroupSelectedTokens.value = [];
  };

  const deleteGroup = (groupId) => {
    if (confirm("确定要删除这个分组吗？分组中的token不会被删除。")) {
      tokenStore.deleteTokenGroup(groupId);
      message.success("分组已删除");
    }
  };

  const saveEditGroup = () => {
    if (!editingGroupId.value) {
      return;
    }

    if (!editingGroupName.value.trim()) {
      message.warning("请输入分组名称");
      return;
    }

    tokenStore.updateTokenGroup(editingGroupId.value, {
      name: editingGroupName.value.trim(),
      color: editingGroupColor.value,
    });

    message.success("分组已更新");
    editingGroupId.value = null;
    editingGroupName.value = "";
    editingGroupColor.value = "";
  };

  const startEditGroup = (groupId) => {
    const group = tokenGroups.value.find((item) => item.id === groupId);
    if (!group) {
      return;
    }

    editingGroupId.value = groupId;
    editingGroupName.value = group.name;
    editingGroupColor.value = group.color;
  };

  const cancelEditGroup = () => {
    editingGroupId.value = null;
    editingGroupName.value = "";
    editingGroupColor.value = "";
  };

  const updateSelectedTokensFromGroups = () => {
    const tokenIds = new Set();

    selectedGroups.value.forEach((groupId) => {
      const validTokenIds = tokenStore.getValidGroupTokenIds(groupId);
      validTokenIds.forEach((id) => tokenIds.add(id));
    });

    selectedTokens.value = Array.from(tokenIds);
  };

  const toggleGroupSelection = (groupId) => {
    const index = selectedGroups.value.indexOf(groupId);
    if (index > -1) {
      selectedGroups.value.splice(index, 1);
    } else {
      selectedGroups.value.push(groupId);
    }

    updateSelectedTokensFromGroups();
  };

  const isGroupSelected = (groupId) => {
    return selectedGroups.value.includes(groupId);
  };

  const clearAllGroupSelection = () => {
    selectedGroups.value = [];
    selectedTokens.value = [];
  };

  const addTokenToSelectedGroup = (groupId, tokenId) => {
    tokenStore.addTokenToGroup(groupId, tokenId);
    message.success("已将token添加到分组");
  };

  const removeTokenFromSelectedGroup = (groupId, tokenId) => {
    tokenStore.removeTokenFromGroup(groupId, tokenId);
    message.success("已将token从分组移除");
  };

  const getValidGroupTokenIds = (groupId) => {
    return tokenStore.getValidGroupTokenIds(groupId);
  };

  const getGroupTokenList = (groupId) => {
    const tokenIds = tokenStore.getValidGroupTokenIds(groupId);
    return tokens.value.filter((token) => tokenIds.includes(token.id));
  };

  return {
    addTokenToSelectedGroup,
    cancelEditGroup,
    clearAllGroupSelection,
    createNewGroup,
    deleteGroup,
    deselectAllNewGroup,
    editingGroupColor,
    editingGroupId,
    editingGroupName,
    getGroupTokenList,
    getValidGroupTokenIds,
    groupColors,
    isGroupSelected,
    newGroupColor,
    newGroupName,
    newGroupSelectedTokens,
    removeTokenFromSelectedGroup,
    saveEditGroup,
    selectAllNewGroup,
    selectedGroups,
    showGroupManageModal,
    startEditGroup,
    taskScheduleSelectedGroupIds,
    toggleGroupSelection,
    updateSelectedTokensFromGroups,
  };
}
