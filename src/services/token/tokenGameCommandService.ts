interface RefLike<T> {
  value: T;
}

interface LoggerLike {
  info: (...args: any[]) => void;
  error: (...args: any[]) => void;
  verbose?: (...args: any[]) => void;
}

interface SendMessageWithPromise {
  (
    tokenId: string,
    cmd: string,
    params?: Record<string, any>,
    timeout?: number,
  ): Promise<any>;
}

interface SendMessage {
  (
    tokenId: string,
    cmd: string,
    params?: Record<string, any>,
    options?: Record<string, any>,
  ): any;
}

export const sendGetRoleInfoById = async ({
  tokenId,
  params = {},
  retryCount = 0,
  sendMessageWithPromise,
  gameData,
  logger,
}: {
  tokenId: string;
  params?: Record<string, any>;
  retryCount?: number;
  sendMessageWithPromise: SendMessageWithPromise;
  gameData: RefLike<any>;
  logger: LoggerLike;
}) => {
  try {
    const roleInfo = await sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      params,
      15000,
    );

    if (roleInfo) {
      gameData.value.roleInfo = roleInfo;
      gameData.value.lastUpdated = new Date().toISOString();
      logger.verbose?.("角色信息已通过 Promise 更新");
    }

    return roleInfo;
  } catch (error: any) {
    logger.error(`获取角色信息失败 [${tokenId}]:`, error?.message || error);

    if (retryCount < 2) {
      logger.info(`正在重试获取角色信息 [${tokenId}]，重试次数: ${retryCount + 1}`);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return sendGetRoleInfoById({
        tokenId,
        params,
        retryCount: retryCount + 1,
        sendMessageWithPromise,
        gameData,
        logger,
      });
    }

    throw error;
  }
};

export const sendGetDataBundleVersionById = (
  tokenId: string,
  params: Record<string, any> = {},
  sendMessageWithPromise: SendMessageWithPromise,
) => {
  return sendMessageWithPromise(tokenId, "system_getdatabundlever", params);
};

export const sendSignInById = (
  tokenId: string,
  sendMessageWithPromise: SendMessageWithPromise,
) => {
  return sendMessageWithPromise(tokenId, "system_signinreward");
};

export const sendClaimDailyRewardById = (
  tokenId: string,
  rewardId = 0,
  sendMessageWithPromise: SendMessageWithPromise,
) => {
  return sendMessageWithPromise(tokenId, "task_claimdailyreward", {
    rewardId,
  });
};

export const sendGetTeamInfoById = (
  tokenId: string,
  params: Record<string, any> = {},
  sendMessageWithPromise: SendMessageWithPromise,
) => {
  return sendMessageWithPromise(tokenId, "presetteam_getinfo", params);
};

const buildChatPayload = (message: string, channel: 1 | 2) => ({
  channel,
  emojiId: 0,
  extra: null,
  msg: message,
  msgType: 1,
});

export const sendMessageToWorldById = (
  tokenId: string,
  message: string,
  sendMessageWithPromise: SendMessageWithPromise,
) => {
  return sendMessageWithPromise(
    tokenId,
    "system_sendchatmessage",
    buildChatPayload(message, 1),
  );
};

export const sendMessageToLegionById = (
  tokenId: string,
  message: string,
  sendMessageWithPromise: SendMessageWithPromise,
) => {
  return sendMessageWithPromise(
    tokenId,
    "system_sendchatmessage",
    buildChatPayload(message, 2),
  );
};

export const sendGameMessageById = ({
  tokenId,
  cmd,
  params = {},
  options = {},
  sendMessage,
  sendMessageWithPromise,
}: {
  tokenId: string;
  cmd: string;
  params?: Record<string, any>;
  options?: Record<string, any>;
  sendMessage: SendMessage;
  sendMessageWithPromise: SendMessageWithPromise;
}) => {
  if (options.usePromise) {
    return sendMessageWithPromise(tokenId, cmd, params, options.timeout);
  }

  return sendMessage(tokenId, cmd, params, options);
};
