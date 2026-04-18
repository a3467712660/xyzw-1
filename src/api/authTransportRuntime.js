export const applyAuthTransportToRequest = (
  config,
  {
    readCookie,
    csrfCookieNames,
    csrfHeaderName,
    csrfSafeMethods,
  },
) => {
  const nextConfig = config || {};
  const nextHeaders = { ...(nextConfig.headers || {}) };
  const method = String(nextConfig.method || "get").toUpperCase();

  nextConfig.headers = nextHeaders;

  if (nextConfig.data == null) {
    nextConfig.data = undefined;
    delete nextHeaders["Content-Type"];
    delete nextHeaders["content-type"];
  }

  if (!csrfSafeMethods.has(method)) {
    const csrfToken = csrfCookieNames
      .map((name) => readCookie(name))
      .find((value) => String(value || "").trim().length > 0);
    if (csrfToken) {
      nextHeaders[csrfHeaderName] = csrfToken;
    }
  }

  return nextConfig;
};

export const createAuthResponseErrorHandler = ({
  getAuthStore,
  refreshTokenOnce,
  refreshCsrfTokenOnce,
  request,
  extractErrorMessage,
  createRequestError,
  isRefreshRequest,
  isAuthBootstrapRequest,
  isCsrfRequest,
  isUnsafeRequestMethod,
  isCsrfFailure,
  clearCachedUserConfirmToken,
  getHandlingUnauthorized,
  setHandlingUnauthorized,
  redirectToLogin,
}) =>
  async (error) => {
    const authStore = getAuthStore();
    const skipAuthHandling = Boolean(error?.config?.skipAuthHandling);
    const originalConfig = error?.config || {};

    if (error.response) {
      const { status, data } = error.response;
      const getMessage = (fallback) => extractErrorMessage(data, fallback);

      switch (status) {
        case 400:
          return Promise.reject(
            createRequestError(getMessage("请求失败"), {
              code: data?.error?.code || data?.code || "",
              status,
            }),
          );
        case 401:
          if (
            !skipAuthHandling &&
            !originalConfig.__retriedAfterRefresh &&
            !isRefreshRequest(originalConfig) &&
            !isAuthBootstrapRequest(originalConfig)
          ) {
            const refreshed = await refreshTokenOnce();
            if (refreshed) {
              originalConfig.__retriedAfterRefresh = true;
              return request(originalConfig);
            }
          }

          if (!skipAuthHandling && !getHandlingUnauthorized()) {
            setHandlingUnauthorized(true);
            authStore.handleUnauthorized();
            redirectToLogin();
            setTimeout(() => {
              setHandlingUnauthorized(false);
            }, 1000);
          }
          return Promise.reject(
            createRequestError(getMessage("登录已过期，请重新登录"), {
              code: data?.error?.code || "AUTH_INVALID_TOKEN",
            }),
          );
        case 403:
          if (
            !skipAuthHandling &&
            !originalConfig.__retriedAfterCsrf &&
            !originalConfig.__skipCsrfRetry &&
            !isCsrfRequest(originalConfig) &&
            isUnsafeRequestMethod(originalConfig) &&
            isCsrfFailure(status, data)
          ) {
            const refreshed = await refreshCsrfTokenOnce();
            if (refreshed) {
              originalConfig.__retriedAfterCsrf = true;
              return request(originalConfig);
            }
          }
          if (String(data?.error?.code || "").startsWith("USER_CONFIRM_")) {
            clearCachedUserConfirmToken();
          }
          return Promise.reject(
            createRequestError(getMessage("没有权限访问"), {
              code: data?.error?.code || data?.code || "AUTH_FORBIDDEN",
              status,
            }),
          );
        case 404:
          return Promise.reject(
            createRequestError(getMessage("请求的资源不存在"), {
              code: data?.error?.code || data?.code || "",
              status,
            }),
          );
        case 429:
          return Promise.reject(
            createRequestError(getMessage("请求过于频繁，请稍后重试"), {
              code: data?.error?.code || data?.code || "RATE_LIMITED",
              retryAfter: Number(data?.retryAfter) || 0,
              status,
            }),
          );
        case 500:
          return Promise.reject(
            createRequestError(getMessage("服务器内部错误")),
          );
        default:
          return Promise.reject(createRequestError(getMessage("请求失败")));
      }
    } else if (error.request) {
      return Promise.reject(createRequestError("网络连接失败，请检查网络"));
    } else {
      return Promise.reject(createRequestError(error.message || "未知错误"));
    }
  };
