/* eslint-disable test/no-import-node-test */
import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

const loadModule = jiti(import.meta.url, { interopDefault: true });
const {
  applyAuthTransportToRequest,
  createAuthResponseErrorHandler,
} = loadModule("../../src/api/authTransportRuntime.js");

test("auth transport request handler does not inject Authorization bearer header", () => {
  const config = {
    method: "get",
    headers: {},
  };

  const nextConfig = applyAuthTransportToRequest(config, {
    readCookie: () => "",
    csrfCookieNames: ["__Host-xyzw_csrf_token", "xyzw_csrf_token"],
    csrfHeaderName: "X-CSRF-Token",
    csrfSafeMethods: new Set(["GET", "HEAD", "OPTIONS", "TRACE"]),
  });

  assert.equal(nextConfig.headers.Authorization, undefined);
  assert.equal(nextConfig.headers.authorization, undefined);
});

test("auth transport response handler retries the original request after refresh succeeds", async () => {
  const authStore = {
    handleUnauthorized: () => {
      throw new Error("handleUnauthorized should not run when refresh succeeds");
    },
  };
  const retriedConfigs = [];
  const handler = createAuthResponseErrorHandler({
    getAuthStore: () => authStore,
    refreshTokenOnce: async () => true,
    refreshCsrfTokenOnce: async () => false,
    request: async (config) => {
      retriedConfigs.push({ ...config });
      return { success: true, data: { recovered: true } };
    },
    extractErrorMessage: (_payload, fallback) => fallback,
    createRequestError: (message, extra = {}) => Object.assign(new Error(message), extra),
    isRefreshRequest: () => false,
    isAuthBootstrapRequest: () => false,
    isCsrfRequest: () => false,
    isUnsafeRequestMethod: () => true,
    isCsrfFailure: () => false,
    clearCachedUserConfirmToken: () => {},
    getHandlingUnauthorized: () => false,
    setHandlingUnauthorized: () => {},
    redirectToLogin: () => {
      throw new Error("redirect should not run when refresh succeeds");
    },
  });

  const originalConfig = {
    method: "get",
    url: "/auth/me",
  };
  const result = await handler({
    config: originalConfig,
    response: {
      status: 401,
      data: {
        message: "expired",
      },
    },
  });

  assert.deepEqual(result, { success: true, data: { recovered: true } });
  assert.equal(retriedConfigs.length, 1);
  assert.equal(retriedConfigs[0].__retriedAfterRefresh, true);
});
