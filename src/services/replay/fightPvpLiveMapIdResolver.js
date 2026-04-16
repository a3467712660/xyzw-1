import {
  getFightPvpRuntimeRoleMapIdReasonMessageKey,
  resolveFightPvpMapIdForLiveCapture,
  resolveFightPvpMapIdFromRolePayload,
} from "./fightPvpRuntimeRoleMapIdResolver.js";

export const resolveFightPvpMapIdFromLiveRole = (
  roleLike,
  configsLike = null,
) =>
  resolveFightPvpMapIdFromRolePayload({
    rolePayload: roleLike,
    configsLike,
    diagnosticBasePath: "selfRole",
  });

export const resolveFightPvpMapIdFromLiveContext = (context = {}) =>
  resolveFightPvpMapIdForLiveCapture({
    runtimeContext: context?.runtimeContext || null,
    battleInput: context?.battleInput || null,
    selfRoleRaw: context?.selfRoleRaw || null,
    selectedTokenRoleInfo: context?.selectedTokenRoleInfo || null,
    tokenStoreRoleInfo:
      context?.tokenStoreRoleInfo
      || context?.liveContext?.tokenStoreRoleInfo
      || null,
    configsLike: context?.configsLike || null,
  });

export const ensureFightPvpSelfRoleContext = async ({
  tokenStore,
  selectedToken,
  backendClient: _backendClient,
} = {}) => {
  const selectedTokenId = String(
    selectedToken?.id || tokenStore?.selectedToken?.id || "",
  ).trim();
  const selectedTokenRoleInfo = tokenStore?.selectedTokenRoleInfo || null;
  const tokenStoreRoleInfo = tokenStore?.gameData?.roleInfo
    || tokenStore?.gameData?.value?.roleInfo
    || null;

  if (selectedTokenRoleInfo) {
    return {
      ok: true,
      roleInfo: selectedTokenRoleInfo,
      refreshed: false,
      reason: null,
      selfRoleContextSource: "selectedTokenRoleInfo",
    };
  }

  if (tokenStoreRoleInfo) {
    return {
      ok: true,
      roleInfo: tokenStoreRoleInfo,
      refreshed: false,
      reason: null,
      selfRoleContextSource: "tokenStore.gameData.roleInfo",
    };
  }

  if (!selectedTokenId || typeof tokenStore?.sendGetRoleInfo !== "function") {
    return {
      ok: false,
      roleInfo: null,
      refreshed: false,
      reason: "runtime-role-unavailable",
      selfRoleContextSource: null,
    };
  }

  try {
    const roleInfo = await tokenStore.sendGetRoleInfo(selectedTokenId);
    if (!roleInfo) {
      return {
        ok: false,
        roleInfo: null,
        refreshed: true,
        reason: "runtime-role-unavailable",
        selfRoleContextSource: "refreshed-role_getroleinfo",
      };
    }

    return {
      ok: true,
      roleInfo,
      refreshed: true,
      reason: null,
      selfRoleContextSource: "refreshed-role_getroleinfo",
    };
  } catch {
    return {
      ok: false,
      roleInfo: null,
      refreshed: true,
      reason: "runtime-role-unavailable",
      selfRoleContextSource: "refreshed-role_getroleinfo",
    };
  }
};

export const getFightPvpLiveMapIdReasonMessageKey = (reason) =>
  getFightPvpRuntimeRoleMapIdReasonMessageKey(reason);
