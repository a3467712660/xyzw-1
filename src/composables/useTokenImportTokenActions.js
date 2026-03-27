import { fetchTokenPayloadFromUrl } from "@/services/tokenImport/tokenRemoteSource";
import { loadBinBuffer } from "@/utils/binStorage";
import {
  confirmAndCopyFullToken,
  copyMaskedToken,
} from "@/utils/sensitiveCopy";
import { transformToken } from "@/utils/token";
import { Copy, Create, Refresh, SyncCircle, TrashBin } from "@vicons/ionicons5";
import { NIcon } from "naive-ui/es";
import { h, reactive, ref } from "vue";

export function useTokenImportTokenActions({
  dialog,
  editFormRef,
  ensureTokenActivation,
  loadBinFiles,
  message,
  selectedTokenId,
  t,
  tokenStore,
  tryRelinkBinSourceByRoleId,
}) {
  const showEditModal = ref(false);
  const editingToken = ref(null);
  const editingRemark = ref(null);
  const tempRemarks = ref({});
  const refreshingTokens = ref(new Set());
  const editForm = reactive({
    name: "",
    token: "",
    server: "",
    wsUrl: "",
    remark: "",
  });

  const editRules = {
    name: [
      {
        required: true,
        message: t("tokenImport.validation.nameRequired"),
        trigger: "blur",
      },
    ],
    token: [
      {
        required: true,
        message: t("tokenImport.validation.tokenRequired"),
        trigger: "blur",
      },
    ],
  };

  const refreshToken = async (token, options = {}) => {
    refreshingTokens.value.add(token.id);

    try {
      if (token.importMethod === "url") {
        const data = await fetchTokenPayloadFromUrl(token.sourceUrl, {
          trustedOnly: true,
        });
        const parsed = tokenStore.parseBase64Token(data.token);
        const nextToken =
          parsed?.success && parsed?.data?.actualToken
            ? parsed.data.actualToken
            : data.token;
        const nextRoleId = parsed?.success
          ? String(
              parsed?.data?.activationRoleId ||
                parsed?.data?.activationGameAccountId ||
                parsed?.data?.roleId ||
                "",
            ).trim()
          : "";
        const nextSessId = parsed?.success
          ? String(
              parsed?.data?.activationSessId || parsed?.data?.sessId || "",
            ).trim()
          : "";

        tokenStore.updateToken(token.id, {
          token: nextToken,
          sessId: nextSessId || token.sessId || "",
          activationSessId:
            nextSessId || token.activationSessId || token.sessId || "",
          roleId: nextRoleId || token.roleId || "",
          activationRoleId:
            nextRoleId ||
            token.activationRoleId ||
            token.activationGameAccountId ||
            "",
          activationGameAccountId:
            nextRoleId ||
            token.activationGameAccountId ||
            token.activationRoleId ||
            "",
          server: data.server || token.server,
          lastRefreshed: Date.now(),
        });

        message.success(t("tokenImport.messages.tokenRefreshSuccess"));
      } else if (
        token.importMethod === "wxQrcode" ||
        token.importMethod === "bin"
      ) {
        let userToken = await loadBinBuffer(token.id, [token.name]);
        let relinkResult = null;
        if (!userToken) {
          relinkResult = await tryRelinkBinSourceByRoleId(token);
          userToken = relinkResult?.userToken || null;
        }
        if (userToken) {
          const newToken = await transformToken(userToken);
          const parsed = tokenStore.parseBase64Token(newToken);
          const nextRoleId = parsed?.success
            ? String(
                parsed?.data?.activationRoleId ||
                  parsed?.data?.activationGameAccountId ||
                  parsed?.data?.roleId ||
                  "",
              ).trim()
            : "";
          const nextSessId = parsed?.success
            ? String(
                parsed?.data?.activationSessId || parsed?.data?.sessId || "",
              ).trim()
            : "";
          tokenStore.updateToken(token.id, {
            token: newToken,
            sessId: nextSessId || token.sessId || "",
            activationSessId:
              nextSessId || token.activationSessId || token.sessId || "",
            roleId: nextRoleId || token.roleId || "",
            activationRoleId:
              nextRoleId ||
              token.activationRoleId ||
              token.activationGameAccountId ||
              "",
            activationGameAccountId:
              nextRoleId ||
              token.activationGameAccountId ||
              token.activationRoleId ||
              "",
            lastRefreshed: Date.now(),
            binSourceState: "available",
            binSourceMissingAt: null,
          });
          message.success(t("tokenImport.messages.tokenRefreshSuccess"));
        } else {
          tokenStore.markBinSourceState(token.id, "missing");
          if (relinkResult?.status === "ambiguous") {
            throw new Error(
              t("tokenImport.errors.ambiguousBinRelink", {
                count: relinkResult.count,
              }),
            );
          }
          throw new Error(t("tokenImport.messages.missingBinSource"));
        }
      } else {
        dialog.info({
          title: t("tokenImport.dialogs.reacquireToken.title"),
          content: t("tokenImport.dialogs.reacquireToken.content", {
            name: token.name,
          }),
          positiveText: t("tokenImport.dialogs.reacquireToken.importAgain"),
          negativeText: t("tokenImport.dialogs.reacquireToken.reconnect"),
          onPositiveClick: () => {
            options.openImportForm?.(token);
          },
          onNegativeClick: () => {
            if (tokenStore.getWebSocketStatus(token.id) === "connected") {
              tokenStore.closeWebSocketConnection(token.id);
            }

            setTimeout(() => {
              tokenStore
                .createWebSocketConnection(token.id, token.token, token.wsUrl)
                .catch(() => {});
              message.info(t("tokenImport.messages.reconnecting"));
            }, 500);
          },
        });
        return;
      }

      if (tokenStore.getWebSocketStatus(token.id) === "connected") {
        tokenStore.closeWebSocketConnection(token.id);
        setTimeout(() => {
          tokenStore
            .createWebSocketConnection(token.id, token.token, token.wsUrl)
            .catch(() => {});
        }, 500);
      }
    } catch (error) {
      console.error("刷新Token失败:", error);
      message.error(
        error.message || t("tokenImport.messages.tokenRefreshFailed"),
      );
    } finally {
      refreshingTokens.value.delete(token.id);
    }
  };

  const upgradeTokenToPermanent = (token) => {
    dialog.warning({
      title: t("tokenImport.dialogs.upgradePermanent.title"),
      content: t("tokenImport.dialogs.upgradePermanent.content", {
        name: token.name,
      }),
      positiveText: t("tokenImport.dialogs.upgradePermanent.confirm"),
      negativeText: t("tokenImport.common.cancel"),
      onPositiveClick: () => {
        const success = tokenStore.upgradeTokenToPermanent(token.id);
        if (success) {
          message.success(
            t("tokenImport.messages.upgradePermanentSuccess", {
              name: token.name,
            }),
          );
        } else {
          message.error(t("tokenImport.messages.upgradePermanentFailed"));
        }
      },
    });
  };

  const getConnectionStatus = (tokenId) =>
    tokenStore.getWebSocketStatus(tokenId);

  const getConnectionStatusText = (tokenId) => {
    const status = getConnectionStatus(tokenId);
    const statusMap = {
      connected: t("tokenImport.connection.connected"),
      connecting: t("tokenImport.connection.connecting"),
      disconnected: t("tokenImport.connection.disconnected"),
      error: t("tokenImport.connection.error"),
      disconnecting: t("tokenImport.connection.disconnecting"),
    };
    return statusMap[status] || t("tokenImport.connection.notConnected");
  };

  const getTokenStyle = (tokenId) => {
    const status = getConnectionStatus(tokenId);
    const statusMap = {
      connected: "success",
      connecting: "warning",
      disconnected: "danger",
      error: "danger",
      disconnecting: "warning",
    };
    return statusMap[status] || "danger";
  };

  const getServerTagType = (tokenId) =>
    getConnectionStatus(tokenId) === "connected" ? "success" : "error";

  const getServerTagColor = (tokenId) =>
    getConnectionStatus(tokenId) === "connected" ? "green" : "red";

  const saveCurrentRemark = () => {
    if (!editingRemark.value) return;

    const editingTokenId = editingRemark.value;
    const remark = tempRemarks.value[editingTokenId] || "";
    tokenStore.updateToken(editingTokenId, {
      remark,
    });
    editingRemark.value = null;
    message.success(t("tokenImport.messages.remarkSaved"));
  };

  const selectToken = async (token, forceReconnect = false) => {
    if (editingRemark.value) {
      saveCurrentRemark();
      return;
    }

    if (typeof ensureTokenActivation === "function") {
      const activated = await ensureTokenActivation(token);
      if (!activated) {
        return;
      }
    }

    const isAlreadySelected = selectedTokenId.value === token.id;
    const connectionStatus = getConnectionStatus(token.id);

    if (
      isAlreadySelected &&
      connectionStatus === "connected" &&
      !forceReconnect
    ) {
      tokenStore.closeWebSocketConnection(token.id);
      message.success(
        t("tokenImport.messages.disconnectedToken", { name: token.name }),
      );
      return;
    }

    if (
      !isAlreadySelected &&
      connectionStatus === "connected" &&
      !forceReconnect
    ) {
      tokenStore.closeWebSocketConnection(token.id);
      message.success(
        t("tokenImport.messages.disconnectedToken", { name: token.name }),
      );
      return;
    }

    if (
      isAlreadySelected &&
      connectionStatus === "connecting" &&
      !forceReconnect
    ) {
      message.info(
        t("tokenImport.messages.tokenConnecting", { name: token.name }),
      );
      return;
    }

    const result = tokenStore.selectToken(token.id, forceReconnect);

    if (result) {
      if (forceReconnect) {
        message.success(
          t("tokenImport.messages.forceReconnect", { name: token.name }),
        );
      } else if (isAlreadySelected) {
        message.success(
          t("tokenImport.messages.reselectedReconnect", { name: token.name }),
        );
      } else {
        message.success(
          t("tokenImport.messages.selectedToken", { name: token.name }),
        );
      }
    } else {
      message.error(
        t("tokenImport.messages.selectTokenFailed", { name: token.name }),
      );
    }
  };

  const getTokenActions = (token) => {
    const actions = [
      {
        label: t("tokenImport.menu.edit"),
        key: "edit",
        icon: () => h(NIcon, null, { default: () => h(Create) }),
      },
      {
        label: t("tokenImport.menu.copyToken"),
        key: "copy-masked",
        icon: () => h(NIcon, null, { default: () => h(Copy) }),
      },
      {
        label: t("tokenImport.menu.copyFullToken"),
        key: "copy-full",
        icon: () => h(NIcon, null, { default: () => h(Copy) }),
      },
    ];

    if (token.importMethod === "url" && token.sourceUrl) {
      actions.push({
        label: t("tokenImport.menu.refreshFromUrl"),
        key: "refresh-url",
        icon: () => h(NIcon, null, { default: () => h(SyncCircle) }),
      });
    } else {
      actions.push({
        label: t("tokenImport.menu.reacquire"),
        key: "refresh",
        icon: () => h(NIcon, null, { default: () => h(Refresh) }),
      });
    }

    actions.push(
      {
        label: t("tokenImport.menu.activateToken"),
        key: "activate",
        icon: () => h(NIcon, null, { default: () => h(SyncCircle) }),
      },
      { type: "divider" },
      {
        label: t("tokenImport.menu.delete"),
        key: "delete",
        icon: () => h(NIcon, null, { default: () => h(TrashBin) }),
        props: { style: { color: "#e74c3c" } },
      },
    );

    return actions;
  };

  const editToken = (token) => {
    editingToken.value = token;
    Object.assign(editForm, {
      name: token.name,
      token: token.token,
      server: token.server || "",
      wsUrl: token.wsUrl || "",
      remark: token.remark || "",
    });
    showEditModal.value = true;
  };

  const saveEdit = async () => {
    if (!editFormRef.value || !editingToken.value) return;

    try {
      await editFormRef.value.validate();

      tokenStore.updateToken(editingToken.value.id, {
        name: editForm.name,
        token: editForm.token,
        server: editForm.server,
        wsUrl: editForm.wsUrl,
        remark: editForm.remark,
      });

      message.success(t("tokenImport.messages.tokenInfoUpdated"));
      showEditModal.value = false;
      editingToken.value = null;
    } catch {
      // 验证失败
    }
  };

  const copyTokenMasked = async (token) => {
    await copyMaskedToken({
      token: token.token,
      message,
      successMessage: t("tokenImport.messages.tokenCopiedMasked"),
      failureMessage: t("tokenImport.messages.clipboardCopyFailed"),
    });
  };

  const copyTokenFull = (token) => {
    confirmAndCopyFullToken({
      token: token.token,
      dialog,
      message,
      title: t("tokenImport.dialogs.copyFullToken.title"),
      content: t("tokenImport.dialogs.copyFullToken.content"),
      placeholder: t("tokenImport.dialogs.copyFullToken.placeholder"),
      positiveText: t("tokenImport.common.confirm"),
      negativeText: t("tokenImport.common.cancel"),
      successMessage: t("tokenImport.messages.tokenCopiedFull"),
      failureMessage: t("tokenImport.messages.clipboardCopyFailed"),
      missingConfirmMessage: t("tokenImport.messages.copyFullConfirmMissing"),
    });
  };

  const startEditRemark = (token) => {
    editingRemark.value = token.id;
    tempRemarks.value[token.id] = token.remark || "";
  };

  const saveRemark = () => {
    saveCurrentRemark();
  };

  const cancelEditRemark = () => {
    editingRemark.value = null;
  };

  const deleteToken = (token) => {
    dialog.warning({
      title: t("tokenImport.dialogs.deleteToken.title"),
      content: t("tokenImport.dialogs.deleteToken.content", {
        name: token.name,
      }),
      positiveText: t("tokenImport.dialogs.deleteToken.confirm"),
      negativeText: t("tokenImport.common.cancel"),
      onPositiveClick: async () => {
        await tokenStore.removeToken(token.id);
        await loadBinFiles();
        message.success(t("tokenImport.messages.tokenDeleted"));
      },
    });
  };

  const handleTokenAction = (key, token, options = {}) => {
    switch (key) {
      case "edit":
        editToken(token);
        break;
      case "copy-masked":
        copyTokenMasked(token);
        break;
      case "copy-full":
        copyTokenFull(token);
        break;
      case "refresh":
      case "refresh-url":
        refreshToken(token, options);
        break;
      case "activate":
        if (typeof ensureTokenActivation === "function") {
          ensureTokenActivation(token, { forceRenew: true });
        }
        break;
      case "delete":
        deleteToken(token);
        break;
    }
  };

  return {
    cancelEditRemark,
    editForm,
    editRules,
    getConnectionStatus,
    getConnectionStatusText,
    getServerTagColor,
    getServerTagType,
    getTokenActions,
    getTokenStyle,
    handleTokenAction,
    refreshToken,
    refreshingTokens,
    saveCurrentRemark,
    saveEdit,
    saveRemark,
    selectToken,
    showEditModal,
    startEditRemark,
    tempRemarks,
    editingRemark,
    upgradeTokenToPermanent,
  };
}
