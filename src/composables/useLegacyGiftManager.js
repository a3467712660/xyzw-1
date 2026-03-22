import { ref } from "vue";

export function useLegacyGiftManager({
  addLog,
  batchLegacyGiftSendEnhanced,
  ensureConnection,
  message,
  selectedTokens,
  tokenStore,
  tokens,
}) {
  const showLegacyGiftModal = ref(false);
  const recipientIdInput = ref("");
  const recipientIdError = ref("");
  const recipientInfo = ref(null);
  const isQueryingRecipient = ref(false);
  const giftQuantity = ref(10);
  const securityPassword = ref("");
  const isAvatarLoading = ref(false);
  const avatarLoadError = ref(false);

  const clearRecipientError = () => {
    recipientIdError.value = "";
  };

  const validateRecipientId = (value) => {
    if (!value || value === "") {
      return true;
    }
    if (!Number.isInteger(Number(value)) || Number(value) <= 0) {
      recipientIdError.value = "请输入有效的数字ID";
      return false;
    }
    return true;
  };

  const handleAvatarLoad = () => {
    isAvatarLoading.value = false;
    avatarLoadError.value = false;
  };

  const handleAvatarError = () => {
    isAvatarLoading.value = false;
    avatarLoadError.value = true;
  };

  const resetAvatarState = () => {
    isAvatarLoading.value = true;
    avatarLoadError.value = false;
  };

  const queryRecipientInfo = async () => {
    if (!recipientIdInput.value || recipientIdInput.value === "") {
      recipientIdError.value = "请输入接收者ID";
      return;
    }

    const recipientId = Number(recipientIdInput.value);
    if (!Number.isInteger(recipientId) || recipientId <= 0) {
      recipientIdError.value = "请输入有效的数字ID";
      return;
    }

    if (selectedTokens.value.length === 0) {
      recipientIdError.value = "请先选择要操作的角色";
      return;
    }

    isQueryingRecipient.value = true;
    recipientIdError.value = "";
    recipientInfo.value = null;
    resetAvatarState();

    const firstTokenId = selectedTokens.value[0];
    const token = tokens.value.find((item) => item.id === firstTokenId);

    addLog({
      time: new Date().toLocaleTimeString(),
      message: `=== 开始查询接收者信息: 使用账号 ${token.name} (ID: ${firstTokenId}) ===`,
      type: "info",
    });

    try {
      addLog({
        time: new Date().toLocaleTimeString(),
        message: "正在建立WebSocket连接...",
        type: "info",
      });

      await ensureConnection(firstTokenId);

      addLog({
        time: new Date().toLocaleTimeString(),
        message: "WebSocket连接成功",
        type: "success",
      });

      addLog({
        time: new Date().toLocaleTimeString(),
        message: `正在发送查询命令，接收者ID: ${recipientId}`,
        type: "info",
      });

      const response = await tokenStore.sendMessageWithPromise(
        firstTokenId,
        "rank_getroleinfo",
        {
          bottleType: 0,
          includeBottleTeam: false,
          isSearch: false,
          roleId: recipientId,
        },
        10000,
      );

      addLog({
        time: new Date().toLocaleTimeString(),
        message: "查询命令发送成功，正在处理响应...",
        type: "info",
      });

      const roleData = response?.role || response?.roleInfo;

      if (roleData) {
        recipientInfo.value = {
          roleId: roleData.roleId || roleData.role?.roleId,
          name: roleData.name || roleData.role?.name,
          avatarUrl:
            response?.roleInfo?.headImg
            || roleData?.headImg
            || roleData?.role?.headImg
            || "",
          power: (function (power) {
            const billion = 100000000;
            return (power / billion).toFixed(2);
          })(roleData.power || roleData.role?.power || 0),
          powerUnit: "亿",
          serverName: roleData.serverName || roleData.role?.serverName || "",
          legionName: response?.legionInfo?.name || "",
          legionId: response?.legionInfo?.id || 0,
        };

        const displayName = recipientInfo.value.name || "未知角色";

        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== 查询成功: 找到角色 ${displayName} (ID: ${recipientInfo.value.roleId})，战力: ${recipientInfo.value.power}${recipientInfo.value.powerUnit} ===`,
          type: "success",
        });

        message.success("查询成功");
      } else {
        const errorMsg = "未找到该角色信息";
        recipientIdError.value = errorMsg;

        addLog({
          time: new Date().toLocaleTimeString(),
          message: `=== 查询失败: ${errorMsg} ===`,
          type: "error",
        });

        message.error(errorMsg);
      }
    } catch (error) {
      console.error("查询接收者信息失败:", error);

      let errorMsg = "查询失败";
      let logType = "error";

      if (error.message.includes("连接失败")) {
        errorMsg = "WebSocket连接失败，请检查网络或账号状态";
      } else if (
        error.message.includes("timeout")
        || error.message.includes("超时")
      ) {
        errorMsg = "查询超时，请稍后重试";
        logType = "warning";
      } else if (error.message.includes("200160")) {
        errorMsg = "功法系统未开启";
      } else {
        errorMsg = `查询失败: ${error.message}`;
      }

      recipientIdError.value = errorMsg;

      addLog({
        time: new Date().toLocaleTimeString(),
        message: `=== ${errorMsg} ===`,
        type: logType,
      });

      message.error(errorMsg);
    } finally {
      isQueryingRecipient.value = false;

      addLog({
        time: new Date().toLocaleTimeString(),
        message: "=== 查询操作完成 ===",
        type: "info",
      });
    }
  };

  const confirmLegacyGift = async () => {
    if (!recipientIdInput.value || !recipientInfo.value) {
      message.error("请先查询并确认接收者信息");
      return;
    }

    if (!securityPassword.value) {
      message.error("请输入安全密码");
      return;
    }

    await batchLegacyGiftSendEnhanced();

    showLegacyGiftModal.value = false;
    securityPassword.value = "";
  };

  return {
    avatarLoadError,
    clearRecipientError,
    confirmLegacyGift,
    giftQuantity,
    handleAvatarError,
    handleAvatarLoad,
    isAvatarLoading,
    isQueryingRecipient,
    queryRecipientInfo,
    recipientIdError,
    recipientIdInput,
    recipientInfo,
    resetAvatarState,
    securityPassword,
    showLegacyGiftModal,
    validateRecipientId,
  };
}
