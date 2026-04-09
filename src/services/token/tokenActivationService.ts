import api from "@/api";
import { resolveServerActivationBindingForToken } from "@/services/token/tokenActivationBindingResolver";
import type { TokenData } from "@/services/token/tokenStorage";

interface RefLike<T> {
  value: T;
}

interface TokenActivationBinding {
  sessId: string;
  roleId: string;
  roleName: string;
  region: string;
  roleIndex: string;
  expiresAt: string | null;
  boundAt: string | null;
  active: boolean;
}

interface TokenActivationStatusData {
  active?: boolean;
  sessId?: string;
  roleId?: string;
  gameAccountId?: string;
  roleName?: string;
  region?: string;
  expiresAt?: string | null;
  boundAt?: string | null;
}

interface ParseBase64TokenResult {
  success: boolean;
  data?: Record<string, any>;
  error?: string;
}

interface CreateTokenActivationServiceDeps {
  gameTokens: RefLike<TokenData[]>;
  parseBase64Token: (base64String: string) => ParseBase64TokenResult;
  updateToken: (tokenId: string, updates: Partial<TokenData>) => boolean;
  listMine: () => Promise<any>;
  getStatus: (
    tokenId: string,
    roleId: string,
    payload: Record<string, any>,
  ) => Promise<any>;
}

const findTokenById = (tokens: TokenData[], tokenId: string) =>
  tokens.find(
    (item) => String(item?.id || "").trim() === String(tokenId || "").trim(),
  );

const getActivationBindings = async (listMine: () => Promise<any>) => {
  const res = await listMine();
  return Array.isArray(res?.data) ? res.data : [];
};

const buildBindingPatch = (
  token: TokenData,
  binding: TokenActivationBinding,
  fallback: {
    sessId?: string;
    roleName?: string;
    region?: string;
  } = {},
): Partial<TokenData> => ({
  activationSessId:
    binding.sessId ||
    fallback.sessId ||
    token.activationSessId ||
    token.sessId ||
    "",
  activationRoleId: binding.roleId,
  activationGameAccountId: binding.roleId,
  activationRoleName:
    binding.roleName ||
    fallback.roleName ||
    token.activationRoleName ||
    token.name ||
    "",
  activationRegion:
    binding.region ||
    fallback.region ||
    token.activationRegion ||
    token.server ||
    "",
  activationExpiresAt: binding.expiresAt || token.activationExpiresAt || null,
  activationBoundAt: binding.boundAt || token.activationBoundAt || null,
});

const buildCurrentActivation = (token: TokenData, roleId: string) => ({
  sessId: String(token.activationSessId || token.sessId || "").trim(),
  roleId,
  roleName:
    String(token.activationRoleName || token.name || "").trim() || "未命名角色",
  region:
    String(token.activationRegion || token.server || "").trim() || "未知大区",
  roleIndex: String(token.roleIndex ?? "").trim(),
});

const buildStatusPatch = (
  token: TokenData,
  currentActivation: ReturnType<typeof buildCurrentActivation>,
  roleId: string,
  statusData: TokenActivationStatusData | null | undefined,
): Partial<TokenData> => ({
  activationSessId: String(
    statusData?.sessId || currentActivation.sessId,
  ).trim(),
  activationRoleId: String(
    statusData?.roleId || statusData?.gameAccountId || roleId,
  ).trim(),
  activationGameAccountId: String(
    statusData?.gameAccountId || statusData?.roleId || roleId,
  ).trim(),
  activationRoleName: String(
    statusData?.roleName || currentActivation.roleName,
  ).trim(),
  activationRegion: String(
    statusData?.region || currentActivation.region,
  ).trim(),
  activationExpiresAt: statusData?.expiresAt || token.activationExpiresAt || null,
  activationBoundAt: statusData?.boundAt || token.activationBoundAt || null,
});

export const createTokenActivationService = ({
  gameTokens,
  parseBase64Token,
  updateToken,
  listMine,
  getStatus,
}: CreateTokenActivationServiceDeps) => {
  const resolveActivationBinding = async (tokenId: string) => {
    const token = findTokenById(gameTokens.value, tokenId);
    if (!token) {
      return null;
    }

    const bindings = await getActivationBindings(listMine);
    return resolveServerActivationBindingForToken({
      token,
      bindings,
      parseBase64Token,
    }) as TokenActivationBinding | null;
  };

  const syncActivationBindingsFromServer = async () => {
    if (gameTokens.value.length === 0) {
      return { matchedCount: 0 };
    }

    const bindings = await getActivationBindings(listMine);
    let matchedCount = 0;

    for (const token of [...gameTokens.value]) {
      const binding = resolveServerActivationBindingForToken({
        token,
        bindings,
        parseBase64Token,
      }) as TokenActivationBinding | null;
      if (!binding) {
        continue;
      }

      updateToken(token.id, buildBindingPatch(token, binding));
      matchedCount += 1;
    }

    return { matchedCount };
  };

  const ensureActivationReadyForConnection = async (tokenId: string) => {
    const token = findTokenById(gameTokens.value, tokenId);
    if (!token) {
      return;
    }

    const roleId = String(
      token.activationRoleId || token.activationGameAccountId || token.roleId || "",
    ).trim();
    if (!roleId) {
      throw new Error("该Token尚未激活，请先绑定角色RoleID并输入激活码");
    }

    const localExpiresAt = String(token.activationExpiresAt || "").trim();
    if (localExpiresAt && new Date(localExpiresAt).getTime() <= Date.now()) {
      throw new Error("该Token激活已过期，请续期后再使用");
    }

    const currentActivation = buildCurrentActivation(token, roleId);
    let statusRes;

    try {
      statusRes = await getStatus(tokenId, currentActivation.roleId, {
        sessId: currentActivation.sessId,
        roleName: currentActivation.roleName,
        region: currentActivation.region,
        server: currentActivation.region,
        roleIndex: currentActivation.roleIndex,
      });
    } catch (error: any) {
      const message = String(error?.message || "").trim();
      if (!message.includes("未绑定当前账号标识")) {
        throw error;
      }

      const binding = await resolveActivationBinding(tokenId);
      if (!binding) {
        throw error;
      }

      statusRes = await getStatus(tokenId, binding.roleId, {
        sessId: binding.sessId,
        roleName: binding.roleName || currentActivation.roleName,
        region: binding.region || currentActivation.region,
        server: binding.region || currentActivation.region,
        roleIndex: binding.roleIndex || currentActivation.roleIndex,
      });

      updateToken(
        tokenId,
        buildBindingPatch(token, binding, {
          sessId: currentActivation.sessId,
          roleName: currentActivation.roleName,
          region: currentActivation.region,
        }),
      );
    }

    if (!statusRes?.success || !statusRes?.data?.active) {
      throw new Error(statusRes?.message || "该Token未激活或已过期");
    }

    updateToken(
      tokenId,
      buildStatusPatch(
        token,
        currentActivation,
        roleId,
        statusRes?.data as TokenActivationStatusData,
      ),
    );
  };

  return {
    ensureActivationReadyForConnection,
    resolveActivationBinding,
    syncActivationBindingsFromServer,
  };
};

export const listTokenActivationBindings = () => {
  return api.tokenActivation.listMine();
};

export const getTokenActivationStatus = (
  tokenId: string,
  roleId: string,
  payload: Record<string, any> = {},
) => {
  return api.tokenActivation.getStatus(tokenId, roleId, payload);
};
