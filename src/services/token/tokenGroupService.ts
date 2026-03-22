import type { Ref } from "vue";

import { getEffectiveUserId } from "@/services/token/tokenStorage";
import type { TokenData, TokenGroup } from "@/services/token/tokenStorage";

export function createTokenGroupService(
  tokenGroups: Ref<TokenGroup[]>,
  gameTokens: Ref<TokenData[]>,
) {
  const createTokenGroup = (name: string, color: string = "#1677ff") => {
    const group: TokenGroup = {
      id: `group_${Date.now()}${Math.random().toString(36).slice(2)}`,
      name,
      color,
      tokenIds: [],
      ownerId: getEffectiveUserId() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tokenGroups.value = [...tokenGroups.value, group];
    return group;
  };

  const deleteTokenGroup = (groupId: string) => {
    const groups = [...tokenGroups.value];
    const index = groups.findIndex((group) => group.id === groupId);
    if (index !== -1) {
      groups.splice(index, 1);
      tokenGroups.value = groups;
    }
  };

  const updateTokenGroup = (
    groupId: string,
    updates: Partial<TokenGroup>,
  ) => {
    tokenGroups.value = tokenGroups.value.map((group) =>
      group.id === groupId
        ? {
            ...group,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
        : group,
    );
  };

  const addTokenToGroup = (groupId: string, tokenId: string) => {
    tokenGroups.value = tokenGroups.value.map((group) => {
      if (group.id !== groupId || group.tokenIds.includes(tokenId))
        return group;
      return {
        ...group,
        tokenIds: [...group.tokenIds, tokenId],
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const removeTokenFromGroup = (groupId: string, tokenId: string) => {
    tokenGroups.value = tokenGroups.value.map((group) => {
      if (group.id !== groupId || !group.tokenIds.includes(tokenId))
        return group;
      return {
        ...group,
        tokenIds: group.tokenIds.filter((id) => id !== tokenId),
        updatedAt: new Date().toISOString(),
      };
    });
  };

  const getTokenGroups = (tokenId: string): TokenGroup[] => {
    return tokenGroups.value.filter((group) => group.tokenIds.includes(tokenId));
  };

  const getGroupTokenIds = (groupId: string): string[] => {
    const group = tokenGroups.value.find((item) => item.id === groupId);
    return group ? group.tokenIds : [];
  };

  const getValidGroupTokenIds = (groupId: string): string[] => {
    const tokenIds = getGroupTokenIds(groupId);
    const validTokenIds = gameTokens.value.map((token) => token.id);
    return tokenIds.filter((id) => validTokenIds.includes(id));
  };

  const cleanupInvalidTokens = () => {
    const validTokenIds = new Set(gameTokens.value.map((token) => token.id));
    tokenGroups.value = tokenGroups.value.map((group) => ({
      ...group,
      tokenIds: group.tokenIds.filter((id) => validTokenIds.has(id)),
    }));
  };

  return {
    addTokenToGroup,
    cleanupInvalidTokens,
    createTokenGroup,
    deleteTokenGroup,
    getGroupTokenIds,
    getTokenGroups,
    getValidGroupTokenIds,
    removeTokenFromGroup,
    updateTokenGroup,
  };
}
