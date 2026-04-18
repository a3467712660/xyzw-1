import api from "@/api";

const POPUP_FEATURES = [
  "width=520",
  "height=720",
  "left=120",
  "top=80",
  "resizable=yes",
  "scrollbars=yes",
].join(",");

const createPopupError = (code, message) => {
  const error = new Error(message);
  error.code = code;
  return error;
};

const resolveWechatStarter = (intent) => {
  if (intent === "bind") {
    return () => api.auth.startWechatBind();
  }
  return (payload = {}) => api.auth.startWechatLogin(payload);
};

export const openWechatAuthPopup = async ({
  intent = "login",
  payload = {},
  timeoutMs = 5 * 60 * 1000,
} = {}) => {
  const popup = window.open("about:blank", "xyzw-wechat-auth", POPUP_FEATURES);
  if (!popup) {
    throw createPopupError(
      "WECHAT_POPUP_BLOCKED",
      "微信登录弹窗被浏览器拦截，请允许弹窗后重试",
    );
  }

  const closePopup = () => {
    try {
      popup.close();
    } catch {
      // ignore popup close failures
    }
  };

  try {
    const starter = resolveWechatStarter(intent);
    const response = await starter(payload);
    const authorizeUrl = String(response?.data?.authorizeUrl || "").trim();
    const flowId = String(response?.data?.flowId || "").trim();
    if (!response?.success || !authorizeUrl || !flowId) {
      closePopup();
      throw createPopupError(
        "WECHAT_POPUP_START_FAILED",
        response?.message || "微信登录初始化失败，请稍后重试",
      );
    }

    popup.location.href = authorizeUrl;

    return await new Promise((resolve, reject) => {
      let settled = false;
      let timeoutId = null;
      let closePollId = null;

      const cleanup = () => {
        window.removeEventListener("message", handleMessage);
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (closePollId) {
          clearInterval(closePollId);
        }
      };

      const finishResolve = (result) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        closePopup();
        resolve(result);
      };

      const finishReject = (error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        closePopup();
        reject(error);
      };

      const handleMessage = (event) => {
        if (event.origin !== window.location.origin) {
          return;
        }
        const nextPayload = event.data || {};
        if (
          String(nextPayload?.source || "") !== "xyzw-wechat-auth"
          || String(nextPayload?.flowId || "") !== flowId
        ) {
          return;
        }
        finishResolve(nextPayload);
      };

      window.addEventListener("message", handleMessage);
      timeoutId = setTimeout(() => {
        finishReject(
          createPopupError(
            "WECHAT_POPUP_TIMEOUT",
            "微信登录超时，请重新发起操作",
          ),
        );
      }, timeoutMs);
      closePollId = setInterval(() => {
        if (!popup.closed) {
          return;
        }
        finishReject(
          createPopupError(
            "WECHAT_POPUP_CANCELLED",
            "微信登录已取消",
          ),
        );
      }, 400);
    });
  } catch (error) {
    closePopup();
    throw error;
  }
};
