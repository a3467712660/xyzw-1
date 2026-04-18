import { env } from "../config/env.js";

const WECHAT_AUTHORIZE_URL = "https://open.weixin.qq.com/connect/qrconnect";
const WECHAT_ACCESS_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token";
const WECHAT_USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo";

const maskValue = (value, { prefix = 4, suffix = 4 } = {}) => {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }
  if (text.length <= prefix + suffix) {
    if (text.length <= prefix) {
      return `${text}***`;
    }
    return `${text.slice(0, prefix)}***`;
  }
  return `${text.slice(0, prefix)}***${text.slice(-suffix)}`;
};

const logWechatAuthorizeUrlDebug = ({ endpoint, appid, redirectUri, scope, state }) => {
  console.info("[wechat-open-auth] authorize-url", {
    endpoint: String(endpoint || "").trim(),
    appidMasked: maskValue(appid, { prefix: 4, suffix: 4 }),
    redirectUri: String(redirectUri || "").trim(),
    scope: String(scope || "").trim(),
    stateMasked: maskValue(state, { prefix: 6, suffix: 4 }),
  });
};

const createWechatAuthError = (code, message, details = undefined) => {
  const error = new Error(message);
  error.code = code;
  error.details = details;
  return error;
};

const parseWechatJson = async (response) => {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw createWechatAuthError(
      "AUTH_WECHAT_UPSTREAM_ERROR",
      "微信登录服务暂时不可用，请稍后重试",
      payload,
    );
  }
  if (payload?.errcode) {
    throw createWechatAuthError(
      "AUTH_WECHAT_UPSTREAM_ERROR",
      "微信登录失败，请重新扫码后重试",
      payload,
    );
  }
  return payload || {};
};

export const isWechatOpenConfigured = () =>
  Boolean(
    String(env.wechatOpenAppId || "").trim()
    && String(env.wechatOpenAppSecret || "").trim()
    && String(env.wechatOpenRedirectUri || "").trim(),
  );

export const buildAuthorizeUrl = ({ state }) => {
  const url = new URL(WECHAT_AUTHORIZE_URL);
  const appid = String(env.wechatOpenAppId || "").trim();
  const redirectUri = String(env.wechatOpenRedirectUri || "").trim();
  const flowState = String(state || "").trim();
  const scope = "snsapi_login";
  url.searchParams.set("appid", appid);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scope);
  url.searchParams.set("state", flowState);
  logWechatAuthorizeUrlDebug({
    endpoint: `${url.origin}${url.pathname}`,
    appid,
    redirectUri,
    scope,
    state: flowState,
  });
  return url.toString();
};

export const exchangeCodeForAccessToken = async (code) => {
  const url = new URL(WECHAT_ACCESS_TOKEN_URL);
  url.searchParams.set("appid", String(env.wechatOpenAppId || "").trim());
  url.searchParams.set("secret", String(env.wechatOpenAppSecret || "").trim());
  url.searchParams.set("code", String(code || "").trim());
  url.searchParams.set("grant_type", "authorization_code");

  const payload = await parseWechatJson(
    await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }),
  );

  return {
    accessToken: String(payload.access_token || "").trim(),
    openId: String(payload.openid || "").trim(),
    unionId: String(payload.unionid || "").trim(),
  };
};

export const fetchWechatUserProfile = async ({ accessToken, openId }) => {
  const url = new URL(WECHAT_USERINFO_URL);
  url.searchParams.set("access_token", String(accessToken || "").trim());
  url.searchParams.set("openid", String(openId || "").trim());
  url.searchParams.set("lang", "zh_CN");

  const payload = await parseWechatJson(
    await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }),
  );

  return {
    openId: String(payload.openid || openId || "").trim(),
    unionId: String(payload.unionid || "").trim(),
    nickname: String(payload.nickname || "").trim(),
    avatarUrl: String(payload.headimgurl || "").trim(),
    appId: String(env.wechatOpenAppId || "").trim(),
  };
};
