import { reactive, ref } from "vue";

const GAME_ACCOUNT_ID_PATTERN = /^\d{6,12}$/;
const ACCOUNT_ID_PRIORITY = [
  "roleid",
  "role_id",
  "gameaccountid",
  "game_account_id",
];
const ACCOUNT_ID_KEYS = new Set(ACCOUNT_ID_PRIORITY);

const parseTokenPayload = (rawToken) => {
  const text = String(rawToken || "").trim();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {}

  try {
    const clean = text.replace(/^data:.*base64,/, "").trim();
    if (!clean) {
      return null;
    }
    const decoded = atob(clean);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
};

const normalizeRoleId = (value) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (GAME_ACCOUNT_ID_PATTERN.test(text)) {
    return text;
  }
  const matched = text.match(/\b(\d{6,12})\b/);
  return matched ? matched[1] : "";
};

const normalizeSessId = (value) =>
  String(value || "")
    .trim()
    .slice(0, 256);

const collectNineDigitIdsFromPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    return [];
  }
  const keyBuckets = new Map(ACCOUNT_ID_PRIORITY.map((key) => [key, []]));
  const push = (key, value) => {
    const next = normalizeRoleId(value);
    if (next) {
      keyBuckets.get(key)?.push(next);
    }
  };

  const queue = [{ value: payload, depth: 0 }];
  const seen = new WeakSet();
  while (queue.length > 0) {
    const { value, depth } = queue.shift();
    if (!value || typeof value !== "object" || depth > 4) {
      continue;
    }
    if (seen.has(value)) {
      continue;
    }
    seen.add(value);
    Object.entries(value).forEach(([key, child]) => {
      if (typeof child !== "object" || child === null) {
        const normalizedKey = String(key || "").trim().toLowerCase();
        if (ACCOUNT_ID_KEYS.has(normalizedKey)) {
          push(normalizedKey, child);
        }
        return;
      }
      queue.push({ value: child, depth: depth + 1 });
    });
  }

  const result = [];
  ACCOUNT_ID_PRIORITY.forEach((key) => {
    const values = keyBuckets.get(key) || [];
    values.forEach((value) => {
      if (!result.includes(value)) {
        result.push(value);
      }
    });
  });
  return result;
};

const resolveTokenRoleId = (token) => {
  const roleIdFromToken = normalizeRoleId(token?.roleId);
  if (roleIdFromToken) {
    return roleIdFromToken;
  }

  const roleIdFromActivation = normalizeRoleId(
    token?.activationRoleId || token?.activationGameAccountId,
  );
  if (roleIdFromActivation) {
    return roleIdFromActivation;
  }

  const payload = parseTokenPayload(token?.token);
  const fromPayload = collectNineDigitIdsFromPayload(payload);
  return fromPayload.length > 0 ? fromPayload[0] : "";
};

const resolveTokenSessId = (token) => {
  const directSessId = normalizeSessId(
    token?.activationSessId || token?.sessId,
  );
  if (directSessId) {
    return directSessId;
  }

  const payload = parseTokenPayload(token?.token);
  return normalizeSessId(
    payload?.sessId ||
      payload?.sessid ||
      payload?.sess_id ||
      payload?.sessionId ||
      payload?.sessionid ||
      payload?.session_id ||
      payload?.sid ||
      "",
  );
};

const parseBoundSessId = (accountIdentity) => {
  const parts = String(accountIdentity || "").split("|");
  return normalizeSessId(parts[0] || "");
};

export function useTokenImportActivation({ api, message, tokenStore }) {
  const showActivationModal = ref(false);
  const activationSubmitting = ref(false);
  const activationTargetToken = ref(null);
  const activationResolvedRoleId = ref("");
  const activationResolver = ref(null);
  const activationForm = reactive({
    activationCode: "",
  });

  const resolveServerActivationBinding = async (tokenId) => {
    const res = await api.tokenActivation.listMine();
    const bindings = Array.isArray(res?.data) ? res.data : [];
    const matched = bindings.find(
      (item) => String(item?.tokenId || "").trim() === String(tokenId || "").trim(),
    );
    if (!matched) {
      return null;
    }

    const roleId = normalizeRoleId(matched?.roleId || matched?.gameAccountId || "");
    if (!roleId) {
      return null;
    }

    return {
      sessId: parseBoundSessId(matched?.accountIdentity),
      roleId,
      roleName: String(matched?.roleName || "").trim(),
      region: String(matched?.region || "").trim(),
      roleIndex: String(matched?.roleIndex ?? "").trim(),
      expiresAt: matched?.expiresAt || null,
      boundAt: matched?.boundAt || null,
      active: Boolean(matched?.active),
    };
  };

  const requestActivationInput = (token, options = {}) =>
    new Promise((resolve) => {
      activationTargetToken.value = token;
      activationResolvedRoleId.value = resolveTokenRoleId(token);
      activationForm.activationCode = "";
      activationResolver.value = resolve;
      showActivationModal.value = true;
      if (options.forceRenew) {
        message.info("请填写新的激活码完成续期");
      }
    });

  const finishActivationInput = (payload) => {
    const resolver = activationResolver.value;
    activationResolver.value = null;
    showActivationModal.value = false;
    activationSubmitting.value = false;
    activationTargetToken.value = null;
    activationResolvedRoleId.value = "";
    if (typeof resolver === "function") {
      resolver(payload);
    }
  };

  const cancelActivationInput = () => {
    finishActivationInput(null);
  };

  const confirmActivationInput = () => {
    const roleId = String(activationResolvedRoleId.value || "").trim();
    const activationCode = String(activationForm.activationCode || "").trim();
    if (!roleId) {
      message.error("未识别到6-12位游戏内角色RoleID，无法激活");
      return;
    }
    if (!GAME_ACCOUNT_ID_PATTERN.test(roleId)) {
      message.error("角色RoleID必须为6-12位数字");
      return;
    }
    if (!activationCode) {
      message.error("未填写激活码，无法激活");
      return;
    }
    activationSubmitting.value = true;
    finishActivationInput({ roleId, activationCode });
  };

  const ensureTokenActivation = async (token, options = {}) => {
    let normalizedSessId = resolveTokenSessId(token);
    let normalizedRoleId = normalizeRoleId(
      token.activationRoleId ||
        token.activationGameAccountId ||
        token.roleId ||
        resolveTokenRoleId(token),
    );

    if (!normalizedRoleId && typeof tokenStore.parseBase64Token === "function") {
      const parsed = tokenStore.parseBase64Token(String(token?.token || ""));
      if (parsed?.success) {
        normalizedSessId = normalizeSessId(
          parsed?.data?.activationSessId ||
            parsed?.data?.sessId ||
            normalizedSessId,
        );
        normalizedRoleId = normalizeRoleId(
          parsed?.data?.activationRoleId ||
            parsed?.data?.activationGameAccountId ||
            parsed?.data?.roleId ||
            resolveTokenRoleId(parsed?.data),
        );
      }
      if (normalizedRoleId || normalizedSessId) {
        tokenStore.updateToken(token.id, {
          sessId: normalizedSessId || token.sessId || "",
          activationSessId:
            normalizedSessId || token.activationSessId || token.sessId || "",
          roleId: normalizedRoleId,
          activationRoleId: normalizedRoleId,
          activationGameAccountId: normalizedRoleId,
          activationRoleName: String(
            token?.activationRoleName || token?.name || "",
          ).trim(),
          activationRegion: String(
            token?.activationRegion || token?.server || "",
          ).trim(),
        });
      }
    }

    const normalizedRoleName =
      String(token?.activationRoleName || token?.name || "").trim() ||
      "未命名角色";
    const normalizedRegion =
      String(token?.activationRegion || token?.server || "").trim() || "未知大区";
    const normalizedRoleIndex = String(token?.roleIndex ?? "").trim();

    if (normalizedRoleId && !options.forceRenew) {
      try {
        const status = await api.tokenActivation.getStatus(
          token.id,
          normalizedRoleId,
          {
            sessId: normalizedSessId,
            roleName: normalizedRoleName,
            region: normalizedRegion,
            server: normalizedRegion,
            roleIndex: normalizedRoleIndex,
          },
        );
        if (status?.success && status?.data?.active) {
          tokenStore.updateToken(token.id, {
            sessId: normalizedSessId || token.sessId || "",
            activationSessId: normalizeSessId(
              status.data.sessId ||
                normalizedSessId ||
                token.activationSessId ||
                token.sessId,
            ),
            roleId: normalizedRoleId,
            activationRoleId: normalizedRoleId,
            activationGameAccountId: normalizedRoleId,
            activationRoleName: String(
              status.data.roleName || normalizedRoleName,
            ).trim(),
            activationRegion: String(
              status.data.region || normalizedRegion,
            ).trim(),
            activationExpiresAt:
              status.data.expiresAt || token.activationExpiresAt || null,
            activationBoundAt:
              status.data.boundAt || token.activationBoundAt || null,
          });
          return true;
        }
      } catch (error) {
        const messageText = String(error?.message || "").trim();
        if (messageText.includes("未绑定当前账号标识")) {
          try {
            const binding = await resolveServerActivationBinding(token.id);
            if (binding) {
              const status = await api.tokenActivation.getStatus(
                token.id,
                binding.roleId,
                {
                  sessId: binding.sessId,
                  roleName: binding.roleName || normalizedRoleName,
                  region: binding.region || normalizedRegion,
                  server: binding.region || normalizedRegion,
                  roleIndex: binding.roleIndex || normalizedRoleIndex,
                },
              );
              if (status?.success && status?.data?.active) {
                tokenStore.updateToken(token.id, {
                  sessId: binding.sessId || token.sessId || "",
                  activationSessId: normalizeSessId(
                    status.data.sessId ||
                      binding.sessId ||
                      token.activationSessId ||
                      token.sessId,
                  ),
                  roleId: binding.roleId,
                  activationRoleId: binding.roleId,
                  activationGameAccountId: binding.roleId,
                  activationRoleName: String(
                    status.data.roleName ||
                      binding.roleName ||
                      normalizedRoleName,
                  ).trim(),
                  activationRegion: String(
                    status.data.region || binding.region || normalizedRegion,
                  ).trim(),
                  activationExpiresAt:
                    status.data.expiresAt ||
                    binding.expiresAt ||
                    token.activationExpiresAt ||
                    null,
                  activationBoundAt:
                    status.data.boundAt ||
                    binding.boundAt ||
                    token.activationBoundAt ||
                    null,
                });
                return true;
              }
              if (binding.active) {
                tokenStore.updateToken(token.id, {
                  sessId: binding.sessId || token.sessId || "",
                  activationSessId:
                    binding.sessId ||
                    token.activationSessId ||
                    token.sessId ||
                    "",
                  roleId: binding.roleId,
                  activationRoleId: binding.roleId,
                  activationGameAccountId: binding.roleId,
                  activationRoleName: binding.roleName || normalizedRoleName,
                  activationRegion: binding.region || normalizedRegion,
                  activationExpiresAt:
                    binding.expiresAt || token.activationExpiresAt || null,
                  activationBoundAt:
                    binding.boundAt || token.activationBoundAt || null,
                });
                return true;
              }
            }
          } catch {}
        }
      }
    }

    const input = await requestActivationInput(token, options);
    if (!input) {
      message.info("已取消激活");
      return false;
    }

    try {
      const res = await api.tokenActivation.bind({
        tokenId: token.id,
        sessId: normalizedSessId,
        roleId: input.roleId,
        gameAccountId: input.roleId,
        roleName: normalizedRoleName,
        region: normalizedRegion,
        server: normalizedRegion,
        roleIndex: normalizedRoleIndex,
        activationCode: input.activationCode,
      });
      if (!res?.success) {
        message.error(res?.message || "激活失败");
        return false;
      }
      tokenStore.updateToken(token.id, {
        sessId: normalizedSessId || token.sessId || "",
        activationSessId:
          normalizedSessId || token.activationSessId || token.sessId || "",
        roleId: input.roleId,
        activationRoleId: input.roleId,
        activationGameAccountId: input.roleId,
        activationRoleName: normalizedRoleName,
        activationRegion: normalizedRegion,
        activationExpiresAt: res.data?.expiresAt || null,
        activationBoundAt: res.data?.boundAt || new Date().toISOString(),
      });
      message.success(
        `激活成功，${token.name} 可用至 ${new Date(res.data?.expiresAt).toLocaleString()}`,
      );
      return true;
    } catch (error) {
      message.error(error.message || "激活失败");
      return false;
    }
  };

  return {
    activationForm,
    activationResolvedRoleId,
    activationSubmitting,
    activationTargetToken,
    cancelActivationInput,
    confirmActivationInput,
    ensureTokenActivation,
    showActivationModal,
  };
}
