import api from "@/api";
import {
  REFRESH_SECOND_VERIFY_LOCAL_KEY,
  REFRESH_SECOND_VERIFY_PREF_KEY,
  REMOTE_BIN_DOWNLOAD_LOCAL_KEY,
  REMOTE_BIN_DOWNLOAD_PREF_KEY,
} from "@/constants/userPreferences";
import { getBooleanPreference, setBooleanPreference } from "@/services/tokenImport/tokenImportPreferences";
import { triggerBlobDownload } from "@/utils/download";
import { loadBinBuffer, saveBinBuffer } from "@/utils/binStorage";
import { g_utils } from "@/utils/bonProtocol";
import { getServerList, transformToken } from "@/utils/token";
import { ensureUserSensitiveConfirmTokenByDialog } from "@/utils/userSensitiveConfirm";
import { XyzwWebSocketClient } from "@/utils/xyzwWebSocket";
import { Download, TrashBin } from "@vicons/ionicons5";
import { NButton, NIcon } from "naive-ui/es";
import { computed, h, onMounted, onUnmounted, ref } from "vue";

export function useTokenImportBinFiles({
  authStore,
  dialog,
  formatTime,
  message,
  t,
  tokenStore,
}) {
  const binFilesLoading = ref(false);
  const binFiles = ref([]);
  const binDownloading = ref({});
  const binDeleting = ref({});
  const remoteBinDownloadEnabled = ref(false);
  const refreshSecondVerifyEnabled = ref(true);
  const sensitiveConfirmRemainingMs = ref(0);
  let sensitiveConfirmStateTimer = null;
  const DOWNLOAD_CONFIRM_CACHE_MAX_AGE_MS = 30 * 1000;

  const ensureSensitiveActionConfirmed = async ({ actionType = "refresh", actionLabel = "" } = {}) => {
    if (actionType === "refresh" && !refreshSecondVerifyEnabled.value) {
      return "";
    }
    return ensureUserSensitiveConfirmTokenByDialog({
      dialog,
      message,
      title: t("tokenImport.dialogs.sensitiveConfirm.title"),
      prompt: actionType === "download"
        ? t("tokenImport.messages.sensitiveConfirmPromptDownload", { action: actionLabel })
        : t("tokenImport.messages.sensitiveConfirmPrompt", { action: actionLabel }),
      placeholder: t("profile.placeholders.currentPassword"),
      positiveText: t("tokenImport.common.confirm"),
      negativeText: t("tokenImport.common.cancel"),
      emptyCredentialMessage: t("profile.validation.currentPasswordRequired"),
      cancelledMessage: t("tokenImport.messages.sensitiveConfirmCancelled"),
      failedMessage: t("tokenImport.messages.sensitiveConfirmFailed"),
      successMessage: t("tokenImport.messages.sensitiveConfirmSuccess"),
      cacheMaxAgeMs: actionType === "download" ? DOWNLOAD_CONFIRM_CACHE_MAX_AGE_MS : undefined,
      mfaEnabled: Boolean(authStore.user?.mfaEnabled),
      preferMfa: true,
      methodLabelTotp: t("tokenImport.messages.sensitiveConfirmMethodTotp"),
      methodLabelRecovery: t("tokenImport.messages.sensitiveConfirmMethodRecovery"),
      methodLabelPassword: t("tokenImport.messages.sensitiveConfirmMethodPassword"),
      totpPlaceholder: t("tokenImport.messages.sensitiveConfirmTotpPlaceholder"),
      recoveryPlaceholder: t("tokenImport.messages.sensitiveConfirmRecoveryPlaceholder"),
      mfaHint: t("tokenImport.messages.sensitiveConfirmMfaHint"),
    });
  };

  const syncSensitiveConfirmState = () => {
    const state = api.user.getCachedSensitiveConfirmState();
    sensitiveConfirmRemainingMs.value = state?.active
      ? Math.max(0, Number(state.remainingMs) || 0)
      : 0;
  };

  const startSensitiveConfirmStateTimer = () => {
    if (sensitiveConfirmStateTimer) {
      return;
    }
    syncSensitiveConfirmState();
    sensitiveConfirmStateTimer = setInterval(() => {
      syncSensitiveConfirmState();
    }, 1000);
  };

  const stopSensitiveConfirmStateTimer = () => {
    if (!sensitiveConfirmStateTimer) {
      return;
    }
    clearInterval(sensitiveConfirmStateTimer);
    sensitiveConfirmStateTimer = null;
  };

  const sensitiveConfirmRemainingText = computed(() => {
    const remain = Math.max(0, Number(sensitiveConfirmRemainingMs.value) || 0);
    if (remain <= 0) {
      return "";
    }
    const totalSeconds = Math.ceil(remain / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return t("tokenImport.messages.highPrivilegeRemaining", { minutes, seconds });
  });

  const formatFileSize = (bytes) => {
    if (!Number.isFinite(bytes) || bytes <= 0)
      return "0 B";
    if (bytes < 1024)
      return `${bytes} B`;
    if (bytes < 1024 * 1024)
      return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const setBinActionLoading = (target, tokenId, value) => {
    target.value = {
      ...target.value,
      [tokenId]: value,
    };
  };

  const parseRoleIdFromTokenString = (tokenText) => {
    try {
      const parsed = JSON.parse(String(tokenText || ""));
      const roleId = Number(parsed?.roleId || parsed?.role?.roleId);
      return Number.isFinite(roleId) && roleId > 0 ? roleId : null;
    } catch {
      return null;
    }
  };

  const parseServerIdFromBinBuffer = (userToken) => {
    try {
      const binMsg = g_utils.parse(userToken);
      const binData = binMsg.getData?.() || binMsg?._raw || {};
      const serverId = Number(binData?.serverId);
      return Number.isFinite(serverId) && serverId > 0 ? serverId : null;
    } catch {
      return null;
    }
  };

  const parseRoleMetaFromBinFileName = (fileName) => {
    const normalized = String(fileName || "").replace(/\.enc$/, "").trim();
    const matched = normalized.match(/^bin-(.*?)服-(\d{1,2})-(\d{1,20})-(.*)\.bin$/);
    if (!matched) {
      return null;
    }

    return {
      server: `${matched[1]}服`,
      roleIndex: matched[2],
      roleId: matched[3],
      roleName: String(matched[4] || "").trim(),
    };
  };

  const getActualTokenFromTokenText = (tokenText) => {
    const raw = String(tokenText || "").trim();
    if (!raw) {
      return "";
    }

    try {
      const parsed = JSON.parse(raw);
      return String(parsed?.token || parsed?.gameToken || raw).trim();
    } catch {
      return raw;
    }
  };

  const getRoleProfileFromWs = async (tokenText) => {
    const actualToken = getActualTokenFromTokenText(tokenText);
    if (!actualToken) {
      return null;
    }

    const wsUrl = `wss://xxz-xyzw.hortorgames.com/agent?p=${encodeURIComponent(actualToken)}&e=x&lang=chinese`;
    const client = new XyzwWebSocketClient({
      url: wsUrl,
      utils: g_utils,
      heartbeatMs: 5000,
    });

    return await new Promise((resolve) => {
      let settled = false;
      let guardTimer = null;

      const finish = (value) => {
        if (settled) {
          return;
        }
        settled = true;
        if (guardTimer) {
          clearTimeout(guardTimer);
        }
        try {
          client.disconnect();
        } catch {
          // 忽略临时连接关闭异常。
        }
        resolve(value);
      };

      client.onConnect = async () => {
        try {
          const roleInfo = await client.getRoleInfo({});
          finish({
            name: String(roleInfo?.role?.name || roleInfo?.name || "").trim(),
            server: String(
              roleInfo?.role?.serverName
              || roleInfo?.serverName
              || roleInfo?.role?.server
              || roleInfo?.server
              || "",
            ).trim(),
          });
        } catch {
          finish(null);
        }
      };

      client.onError = () => finish(null);
      client.onDisconnect = () => finish(null);

      guardTimer = setTimeout(() => finish(null), 12000);
      client.init();
    });
  };

  const tryRelinkBinSourceByRoleId = async (token) => {
    const confirmToken = await ensureSensitiveActionConfirmed({
      actionType: "refresh",
      actionLabel: t("tokenImport.actions.refresh"),
    });
    if (refreshSecondVerifyEnabled.value && !confirmToken) {
      return { status: "confirm-required", userToken: null };
    }

    const targetRoleId = parseRoleIdFromTokenString(token?.token);
    if (!targetRoleId)
      return { status: "no-role-id", userToken: null };

    const listRes = await api.binFiles.list();
    const candidates = Array.isArray(listRes?.data) ? listRes.data : [];
    const matched = [];

    for (const item of candidates) {
      const candidateTokenId = String(item?.tokenId || "").trim();
      if (!candidateTokenId || candidateTokenId === token.id) {
        continue;
      }

      try {
        const binRes = await api.binFiles.get(candidateTokenId, confirmToken || "");
        const userToken = binRes?.data;
        if (!userToken)
          continue;

        const transformed = await transformToken(userToken);
        const candidateRoleId = parseRoleIdFromTokenString(transformed);
        if (candidateRoleId !== targetRoleId) {
          continue;
        }
        matched.push({ candidateTokenId, userToken });
      } catch {
        // 某个候选 BIN 无法解析时，继续尝试下一个。
      }
    }

    if (matched.length === 1) {
      await saveBinBuffer(token.id, matched[0].userToken);
      return { status: "linked", userToken: matched[0].userToken };
    }

    if (matched.length > 1) {
      return { status: "ambiguous", userToken: null, count: matched.length };
    }

    return { status: "not-found", userToken: null };
  };

  const loadRemoteBinDownloadPreference = async () => {
    remoteBinDownloadEnabled.value = getBooleanPreference(
      REMOTE_BIN_DOWNLOAD_LOCAL_KEY,
      false,
    );
    refreshSecondVerifyEnabled.value = getBooleanPreference(
      REFRESH_SECOND_VERIFY_LOCAL_KEY,
      true,
    );

    if (!authStore.isAuthenticated) {
      return;
    }

    try {
      const [remoteRes, refreshVerifyRes] = await Promise.all([
        api.user.getPreference(REMOTE_BIN_DOWNLOAD_PREF_KEY),
        api.user.getPreference(REFRESH_SECOND_VERIFY_PREF_KEY),
      ]);
      const remoteEnabled = !!remoteRes?.data?.value;
      const refreshVerifyEnabled = refreshVerifyRes?.data?.value == null
        ? true
        : !!refreshVerifyRes?.data?.value;
      remoteBinDownloadEnabled.value = remoteEnabled;
      refreshSecondVerifyEnabled.value = refreshVerifyEnabled;
      setBooleanPreference(REMOTE_BIN_DOWNLOAD_LOCAL_KEY, remoteEnabled);
      setBooleanPreference(REFRESH_SECOND_VERIFY_LOCAL_KEY, refreshVerifyEnabled);
    } catch {
      // 网络失败时沿用本地缓存。
    }
  };

  const downloadSavedBinFile = async (row) => {
    if (!remoteBinDownloadEnabled.value) {
      message.warning(t("tokenImport.messages.enableRemoteBinFirst"));
      return;
    }

    try {
      const confirmToken = await ensureSensitiveActionConfirmed({
        actionType: "download",
        actionLabel: t("tokenImport.actions.download"),
      });
      if (!confirmToken) {
        return;
      }

      setBinActionLoading(binDownloading, row.tokenId, true);
      const ticketRes = await api.binFiles.createDownloadTicket(
        row.tokenId,
        confirmToken,
      );
      const ticket = String(ticketRes?.data?.ticket || "");
      if (!ticket) {
        throw new Error(t("tokenImport.messages.binDownloadTicketFailed"));
      }

      const res = await api.binFiles.download(row.tokenId, ticket);
      const blob = new Blob([res.data], { type: "application/octet-stream" });
      const fileName = row.fileName?.replace(/\.enc$/, "") || `${row.tokenId}.bin`;
      triggerBlobDownload({ blob, fileName, appendToBody: false });
      message.success(t("tokenImport.messages.binDownloaded", { fileName }));
    } catch (error) {
      message.error(error.message || t("tokenImport.messages.binDownloadFailed"));
    } finally {
      // 下载票据属于高敏感操作，下载结束后立即清理本地确认缓存，避免误判为长期高权限窗口。
      api.user.clearSensitiveConfirmToken();
      setBinActionLoading(binDownloading, row.tokenId, false);
    }
  };

  const restoreLocalBinFilesToServer = async (serverTokenIds = new Set()) => {
    const candidates = tokenStore.gameTokens.filter((token) =>
      token.importMethod === "bin" || token.importMethod === "wxQrcode",
    );

    let restoredCount = 0;

    for (const token of candidates) {
      if (serverTokenIds.has(token.id)) {
        if (token.binSourceState !== "available") {
          tokenStore.markBinSourceState(token.id, "available");
        }
        continue;
      }

      try {
        const userToken = await loadBinBuffer(token.id, [token.name]);
        if (!userToken) {
          tokenStore.markBinSourceState(token.id, "missing");
          continue;
        }

        await saveBinBuffer(token.id, userToken);
        tokenStore.markBinSourceState(token.id, "available");
        serverTokenIds.add(token.id);
        restoredCount += 1;
      } catch {
        tokenStore.markBinSourceState(token.id, "missing");
      }
    }

    return restoredCount;
  };

  const loadBinFiles = async () => {
    if (!authStore.isAuthenticated) {
      binFiles.value = [];
      return;
    }

    try {
      binFilesLoading.value = true;
      let res = await api.binFiles.list();
      binFiles.value = Array.isArray(res.data) ? res.data : [];
      const savedTokenIds = new Set(binFiles.value.map((item) => item.tokenId));
      const restoredCount = await restoreLocalBinFilesToServer(savedTokenIds);

      if (restoredCount > 0) {
        res = await api.binFiles.list();
        binFiles.value = Array.isArray(res.data) ? res.data : [];
      }

      const finalSavedTokenIds = new Set(binFiles.value.map((item) => item.tokenId));
      tokenStore.gameTokens.forEach((token) => {
        if (token.importMethod !== "bin" && token.importMethod !== "wxQrcode") {
          return;
        }
        if (finalSavedTokenIds.has(token.id) && token.binSourceState !== "available") {
          tokenStore.markBinSourceState(token.id, "available");
        }
      });
    } catch (error) {
      binFiles.value = [];
      message.error(error.message || t("tokenImport.messages.binListLoadFailed"));
    } finally {
      binFilesLoading.value = false;
    }
  };

  const deleteSavedBinFile = (row) => {
    const hasToken = tokenStore.gameTokens.some(
      (token) => token.id === row.tokenId,
    );
    const tokenHint = hasToken
      ? t("tokenImport.dialogs.deleteBin.tokenHintLinked")
      : t("tokenImport.dialogs.deleteBin.tokenHintStandalone");

    dialog.warning({
      title: t("tokenImport.dialogs.deleteBin.title"),
      content: t("tokenImport.dialogs.deleteBin.content", {
        fileName: row.fileName,
        tokenHint,
      }),
      positiveText: t("tokenImport.dialogs.deleteBin.confirm"),
      negativeText: t("tokenImport.common.cancel"),
      onPositiveClick: async () => {
        try {
          setBinActionLoading(binDeleting, row.tokenId, true);
          await api.binFiles.delete(row.tokenId);
          if (hasToken) {
            tokenStore.markBinSourceState(row.tokenId, "missing");
          }
          await loadBinFiles();
          message.success(t("tokenImport.messages.binDeleted"));
        } catch (error) {
          message.error(error.message || t("tokenImport.messages.binDeleteFailed"));
        } finally {
          setBinActionLoading(binDeleting, row.tokenId, false);
        }
      },
    });
  };

  const getNameFromServerList = async (
    userToken,
    tokenId,
    tokenText = "",
    targetServerId = null,
  ) => {
    try {
      const listStr = await getServerList(userToken);
      const parsedList = JSON.parse(listStr);
      if (!parsedList || typeof parsedList !== "object") {
        return tokenId;
      }

      const roles = Object.values(parsedList).filter(
        (item) => item && typeof item === "object",
      );
      if (roles.length === 0) {
        return tokenId;
      }

      if (targetServerId) {
        const matchedByServerId = roles.find((item) => {
          const serverId = Number(item?.serverId);
          return Number.isFinite(serverId) && serverId === targetServerId;
        });
        const matchedRoleName = String(matchedByServerId?.name || "").trim();
        if (matchedRoleName) {
          return matchedRoleName;
        }
      }

      const targetRoleId = parseRoleIdFromTokenString(tokenText);
      if (targetRoleId) {
        const matchedRole = roles.find((item) => {
          const roleId = Number(item?.roleId);
          return Number.isFinite(roleId) && roleId === targetRoleId;
        });
        const matchedRoleName = String(matchedRole?.name || "").trim();
        if (matchedRoleName) {
          return matchedRoleName;
        }
      }

      roles.sort((a, b) => Number(b.power || 0) - Number(a.power || 0));
      const roleName = String(roles[0]?.name || "").trim();
      return roleName || tokenId;
    } catch {
      return tokenId;
    }
  };

  const getNameFromTokenPayload = (tokenText, fallback) => {
    try {
      const parsed = JSON.parse(tokenText || "{}");
      const candidates = [parsed?.roleName, parsed?.role?.name];
      const hit = candidates.find(
        (item) => typeof item === "string" && item.trim(),
      );
      return hit ? String(hit).trim() : fallback;
    } catch {
      return fallback;
    }
  };

  const getServerFromTokenPayload = (tokenText, fallback = "") => {
    try {
      const parsed = JSON.parse(tokenText || "{}");
      const candidates = [
        parsed?.server,
        parsed?.serverName,
        parsed?.role?.server,
        parsed?.role?.serverName,
      ];
      const hit = candidates.find(
        (item) => typeof item === "string" && item.trim(),
      );
      return hit ? String(hit).trim() : fallback;
    } catch {
      return fallback;
    }
  };

  const isUnusableRoleName = (value, tokenId = "") => {
    const text = String(value || "").trim();
    if (!text) {
      return true;
    }
    return text === String(tokenId || "").trim();
  };

  const tryRestoreTokensFromSavedBins = async () => {
    if (!authStore.isAuthenticated)
      return 0;
    if (!Array.isArray(binFiles.value) || binFiles.value.length === 0)
      return 0;

    const existingIds = new Set(tokenStore.gameTokens.map((token) => token.id));
    const candidates = binFiles.value
      .filter((row) => row?.tokenId && !existingIds.has(row.tokenId));
    if (candidates.length === 0)
      return 0;

    const confirmToken = await ensureSensitiveActionConfirmed({
      actionType: "refresh",
      actionLabel: t("tokenImport.actions.refresh"),
    });
    if (refreshSecondVerifyEnabled.value && !confirmToken) {
      return 0;
    }

    const restoredTokens = [];
    let restored = 0;
    let cursor = 0;
    const concurrency = 2;

    const worker = async () => {
      while (cursor < candidates.length) {
        const row = candidates[cursor];
        cursor += 1;
        const tokenId = row?.tokenId;
        const fileMeta = parseRoleMetaFromBinFileName(row?.fileName);

        try {
          const userToken = await loadBinBuffer(tokenId, [tokenId], {
            confirmToken: confirmToken || "",
          });
          if (!userToken)
            continue;

          const token = await transformToken(userToken);
          if (!token)
            continue;

          const parseResult = tokenStore.parseBase64Token(token);
          const roleId = parseResult?.success
            ? String(
                parseResult?.data?.activationRoleId
                || parseResult?.data?.activationGameAccountId
                || parseResult?.data?.roleId
                || "",
              ).trim()
            : "";
          const sessId = parseResult?.success
            ? String(
                parseResult?.data?.activationSessId
                || parseResult?.data?.sessId
                || "",
              ).trim()
            : "";

          const targetServerId = parseServerIdFromBinBuffer(userToken);
          let roleName = String(fileMeta?.roleName || "").trim();
          if (isUnusableRoleName(roleName, tokenId)) {
            roleName = getNameFromTokenPayload(token, "");
          }
          let resolvedServer = String(fileMeta?.server || "").trim();
          if (!resolvedServer) {
            resolvedServer = getServerFromTokenPayload(token, "");
          }
          if (isUnusableRoleName(roleName, tokenId) || !resolvedServer) {
            const wsProfile = await getRoleProfileFromWs(token);
            if (wsProfile?.name && isUnusableRoleName(roleName, tokenId)) {
              roleName = wsProfile.name;
            }
            if (wsProfile?.server && !resolvedServer) {
              resolvedServer = wsProfile.server;
            }
          }
          if (isUnusableRoleName(roleName, tokenId)) {
            roleName = await getNameFromServerList(
              userToken,
              tokenId,
              token,
              targetServerId,
            );
          }
          if (isUnusableRoleName(roleName, tokenId)) {
            roleName = fileMeta?.roleName || tokenId;
          }
          if (!resolvedServer) {
            resolvedServer = fileMeta?.server || "";
          }

          const nowIso = new Date().toISOString();
          restoredTokens.push({
            id: tokenId,
            name: roleName,
            token,
            server: resolvedServer,
            roleId,
            sessId,
            wsUrl: null,
            remark: "",
            level: 1,
            profession: "",
            createdAt: nowIso,
            lastUsed: nowIso,
            isActive: true,
            importMethod: "bin",
            binSourceState: "available",
            binSourceMissingAt: null,
            activationSessId: sessId,
            activationRoleId: roleId,
            activationGameAccountId: roleId,
            activationRoleName: roleName,
            activationRegion: resolvedServer,
          });
          existingIds.add(tokenId);
          restored += 1;
        } catch (error) {
          console.warn(`恢复 BIN Token 失败: ${tokenId}`, error);
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    if (restoredTokens.length > 0) {
      tokenStore.gameTokens = [...tokenStore.gameTokens, ...restoredTokens];
    }

    if (restored > 0) {
      message.success(
        t("tokenImport.messages.restoredFromBin", {
          count: restored,
        }),
      );
    }

    return restored;
  };

  const binFileColumns = computed(() => [
    {
      title: t("tokenImport.binFiles.columns.tokenId"),
      key: "tokenId",
      ellipsis: {
        tooltip: true,
      },
    },
    {
      title: t("tokenImport.binFiles.columns.fileName"),
      key: "fileName",
      ellipsis: {
        tooltip: true,
      },
    },
    {
      title: t("tokenImport.binFiles.columns.size"),
      key: "size",
      width: 120,
      render: (row) => formatFileSize(row.size),
    },
    {
      title: t("tokenImport.binFiles.columns.updatedAt"),
      key: "updatedAt",
      width: 180,
      render: (row) => formatTime(row.updatedAt),
    },
    {
      title: t("tokenImport.binFiles.columns.actions"),
      key: "actions",
      width: 170,
      render: (row) =>
        h(
          "div",
          {
            style: {
              display: "flex",
              gap: "8px",
              alignItems: "center",
            },
          },
          [
            h(
              NButton,
              {
                size: "small",
                secondary: true,
                disabled: !remoteBinDownloadEnabled.value,
                loading: !!binDownloading.value[row.tokenId],
                onClick: () => downloadSavedBinFile(row),
              },
              {
                icon: () => h(NIcon, null, { default: () => h(Download) }),
                default: () => t("tokenImport.actions.download"),
              },
            ),
            h(
              NButton,
              {
                size: "small",
                secondary: true,
                type: "error",
                loading: !!binDeleting.value[row.tokenId],
                onClick: () => deleteSavedBinFile(row),
              },
              {
                icon: () => h(NIcon, null, { default: () => h(TrashBin) }),
                default: () => t("tokenImport.actions.delete"),
              },
            ),
          ],
        ),
    },
  ]);

  onMounted(() => {
    startSensitiveConfirmStateTimer();
  });

  onUnmounted(() => {
    stopSensitiveConfirmStateTimer();
  });

  return {
    binDeleting,
    binDownloading,
    binFileColumns,
    binFiles,
    binFilesLoading,
    loadBinFiles,
    loadRemoteBinDownloadPreference,
    remoteBinDownloadEnabled,
    refreshSecondVerifyEnabled,
    sensitiveConfirmRemainingText,
    tryRelinkBinSourceByRoleId,
    tryRestoreTokensFromSavedBins,
  };
}
