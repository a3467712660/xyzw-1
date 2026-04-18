import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createApp } from "../src/app/createApp.js";
import { env } from "../src/config/env.js";
import { initDatabase } from "../src/db/database.js";
import { query, run } from "../src/db/client.js";
import { createPassword } from "../src/lib/crypto.js";
import { nowIso } from "../src/db/sql.js";
import { encryptMfaSecret } from "../src/services/mfaService.js";

const WECHAT_MOCK_PROFILES = {
  bind_ok: {
    openId: "wx-open-bind-ok",
    unionId: "wx-union-bind-ok",
    nickname: "Bind OK",
    avatarUrl: "https://example.com/bind-ok.png",
  },
  bind_conflict: {
    openId: "wx-open-conflict",
    unionId: "wx-union-conflict",
    nickname: "Conflict User",
    avatarUrl: "https://example.com/conflict.png",
  },
  login_bound: {
    openId: "wx-open-login-bound",
    unionId: "wx-union-login-bound",
    nickname: "Bound Login",
    avatarUrl: "https://example.com/login-bound.png",
  },
  login_unbound: {
    openId: "wx-open-login-unbound",
    unionId: "wx-union-login-unbound",
    nickname: "Unbound Login",
    avatarUrl: "https://example.com/login-unbound.png",
  },
  login_mfa: {
    openId: "wx-open-login-mfa",
    unionId: "wx-union-login-mfa",
    nickname: "MFA Login",
    avatarUrl: "https://example.com/login-mfa.png",
  },
  unbind_flow: {
    openId: "wx-open-unbind",
    unionId: "wx-union-unbind",
    nickname: "Unbind Login",
    avatarUrl: "https://example.com/unbind.png",
  },
};

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createServer = async () => {
  const { app } = createApp();
  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const mergeCookieHeader = (...chunks) => {
  const cookieMap = new Map();
  for (const chunk of chunks) {
    if (!chunk) {
      continue;
    }
    if (Array.isArray(chunk)) {
      chunk.forEach((line) => {
        const pair = String(line || "").split(";")[0];
        const idx = pair.indexOf("=");
        if (idx <= 0) {
          return;
        }
        cookieMap.set(pair.slice(0, idx), pair.slice(idx + 1));
      });
      continue;
    }
    String(chunk)
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const idx = pair.indexOf("=");
        if (idx <= 0) {
          return;
        }
        cookieMap.set(pair.slice(0, idx), pair.slice(idx + 1));
      });
  }
  return Array.from(cookieMap.entries())
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
};

const fetchCsrfContext = async (baseUrl, cookieHeader = "") => {
  const response = await fetch(`${baseUrl}/api/v1/auth/csrf`, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
  assert.equal(response.status, 200);
  const payload = await response.json();
  const csrfToken = String(payload?.data?.token || "").trim();
  assert.ok(csrfToken, "expected csrf token");
  return {
    csrfToken,
    cookieHeader: mergeCookieHeader(cookieHeader, response.headers.getSetCookie()),
  };
};

const readResponsePayload = async (response) => {
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return {
    success: false,
    message: await response.text(),
  };
};

const extractWechatCallbackPayload = (html) => {
  const matched = String(html || "").match(/decodeURIComponent\("([^"]+)"\)/);
  assert.ok(matched?.[1], "expected encoded callback payload in html");
  return JSON.parse(decodeURIComponent(matched[1]));
};

const createUser = ({
  id,
  username,
  password,
  isAdmin = false,
  mfaEnabled = false,
  mfaSecret = "",
  mfaRecoveryCodesHash = "[]",
}) => {
  const ts = nowIso();
  const passwordMeta = createPassword(password);
  run(`DELETE FROM refresh_tokens WHERE user_id = $id`, { $id: id });
  run(`DELETE FROM users WHERE id = $id OR username = $username`, {
    $id: id,
    $username: username,
  });
  run(
    `INSERT INTO users (
      id,
      username,
      email,
      password_salt,
      password_hash,
      token_version,
      is_admin,
      mfa_enabled,
      mfa_totp_secret_enc,
      mfa_recovery_codes_hash,
      created_at,
      updated_at
    ) VALUES (
      $id,
      $username,
      NULL,
      $salt,
      $hash,
      0,
      $isAdmin,
      $mfaEnabled,
      $mfaTotpSecretEnc,
      $mfaRecoveryCodesHash,
      $createdAt,
      $updatedAt
    )`,
    {
      $id: id,
      $username: username,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $isAdmin: isAdmin ? 1 : 0,
      $mfaEnabled: mfaEnabled ? 1 : 0,
      $mfaTotpSecretEnc: mfaEnabled ? encryptMfaSecret(mfaSecret) : null,
      $mfaRecoveryCodesHash: mfaEnabled ? mfaRecoveryCodesHash : null,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
};

const seedWechatBinding = ({ userId, profile }) => {
  const ts = nowIso();
  run(
    `UPDATE users
     SET wechat_open_id = $openId,
         wechat_union_id = $unionId,
         wechat_app_id = $appId,
         wechat_nickname = $nickname,
         wechat_avatar_url = $avatarUrl,
         wechat_bound_at = $boundAt,
         updated_at = $updatedAt
     WHERE id = $id`,
    {
      $id: userId,
      $openId: profile.openId,
      $unionId: profile.unionId,
      $appId: "wx-test-app",
      $nickname: profile.nickname,
      $avatarUrl: profile.avatarUrl,
      $boundAt: ts,
      $updatedAt: ts,
    },
  );
};

const loginWithPassword = async ({
  baseUrl,
  username,
  password,
  rememberMe = false,
}) => {
  const csrf = await fetchCsrfContext(baseUrl);
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: csrf.cookieHeader,
      [env.csrfHeaderName]: csrf.csrfToken,
    },
    body: JSON.stringify({
      username,
      password,
      rememberMe,
    }),
  });
  const body = await response.json();
  return {
    response,
    body,
    cookieHeader: mergeCookieHeader(csrf.cookieHeader, response.headers.getSetCookie()),
  };
};

const startWechatFlow = async ({
  baseUrl,
  pathName,
  cookieHeader = "",
  body = {},
}) => {
  const csrf = await fetchCsrfContext(baseUrl, cookieHeader);
  const response = await fetch(`${baseUrl}${pathName}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: csrf.cookieHeader,
      [env.csrfHeaderName]: csrf.csrfToken,
    },
    body: JSON.stringify(body),
  });
  const payload = await readResponsePayload(response);
  return {
    response,
    payload,
    cookieHeader: csrf.cookieHeader,
  };
};

const getWechatBinding = async ({ baseUrl, cookieHeader }) => {
  const response = await fetch(`${baseUrl}/api/v1/auth/wechat/binding`, {
    headers: {
      cookie: cookieHeader,
    },
  });
  const payload = await response.json();
  return { response, payload };
};

const confirmSensitiveAction = async ({
  baseUrl,
  cookieHeader,
  password,
}) => {
  const csrf = await fetchCsrfContext(baseUrl, cookieHeader);
  const response = await fetch(`${baseUrl}/api/v1/user/confirm-password`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: csrf.cookieHeader,
      [env.csrfHeaderName]: csrf.csrfToken,
    },
    body: JSON.stringify({ password }),
  });
  const payload = await readResponsePayload(response);
  return {
    response,
    payload,
    cookieHeader: csrf.cookieHeader,
  };
};

const callWechatCallback = async ({
  baseUrl,
  code,
  flowId,
  cookieHeader = "",
}) => {
  const response = await fetch(
    `${baseUrl}/api/v1/auth/wechat/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(flowId)}`,
    {
      headers: cookieHeader ? { cookie: cookieHeader } : {},
    },
  );
  const html = await response.text();
  return { response, html };
};

const useIsolatedPaths = (t) => {
  const previousDbPath = env.dbPath;
  const previousBinStoragePath = env.binStoragePath;
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "xyzw-wechat-auth-"));
  env.dbPath = path.join(tempRoot, "test.sqlite.bin");
  env.binStoragePath = path.join(tempRoot, "test-bin");
  t.after(() => {
    env.dbPath = previousDbPath;
    env.binStoragePath = previousBinStoragePath;
    fs.rmSync(tempRoot, { recursive: true, force: true });
  });
};

const useWechatEnv = (t) => {
  const previous = {
    wechatOpenAppId: env.wechatOpenAppId,
    wechatOpenAppSecret: env.wechatOpenAppSecret,
    wechatOpenRedirectUri: env.wechatOpenRedirectUri,
  };
  env.wechatOpenAppId = "wx-test-app";
  env.wechatOpenAppSecret = "wx-test-secret";
  env.wechatOpenRedirectUri = "http://127.0.0.1/api/v1/auth/wechat/callback";
  t.after(() => {
    env.wechatOpenAppId = previous.wechatOpenAppId;
    env.wechatOpenAppSecret = previous.wechatOpenAppSecret;
    env.wechatOpenRedirectUri = previous.wechatOpenRedirectUri;
  });
};

const useWechatFetchMock = (t, profilesByCode) => {
  const originalFetch = global.fetch;
  global.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (
      url.hostname === "api.weixin.qq.com"
      && url.pathname === "/sns/oauth2/access_token"
    ) {
      const code = String(url.searchParams.get("code") || "");
      const profile = profilesByCode[code];
      if (!profile) {
        return Response.json({
          errcode: 40029,
          errmsg: "invalid code",
        });
      }
      return Response.json({
        access_token: `access-${code}`,
        expires_in: 7200,
        refresh_token: `refresh-${code}`,
        openid: profile.openId,
        scope: "snsapi_login",
        unionid: profile.unionId,
      });
    }

    if (
      url.hostname === "api.weixin.qq.com"
      && url.pathname === "/sns/userinfo"
    ) {
      const accessToken = String(url.searchParams.get("access_token") || "");
      const code = accessToken.replace(/^access-/, "");
      const profile = profilesByCode[code];
      if (!profile) {
        return Response.json({
          errcode: 40003,
          errmsg: "invalid openid",
        });
      }
      return Response.json({
        openid: profile.openId,
        unionid: profile.unionId,
        nickname: profile.nickname,
        headimgurl: profile.avatarUrl,
      });
    }

    return originalFetch(input, init);
  };
  t.after(() => {
    global.fetch = originalFetch;
  });
};

test("wechat login start returns website authorize url without fragment and logs masked params", async (t) => {
  useIsolatedPaths(t);
  useWechatEnv(t);
  await initDatabase();

  const infoLogs = [];
  const originalInfo = console.info;
  console.info = (...args) => {
    infoLogs.push(args);
  };
  t.after(() => {
    console.info = originalInfo;
  });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const started = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/login/start",
    body: { rememberMe: true },
  });

  assert.equal(started.response.status, 200);
  assert.ok(started.payload?.data?.authorizeUrl, "expected authorizeUrl");
  assert.ok(started.payload?.data?.flowId, "expected flowId");

  const authorizeUrl = new URL(String(started.payload.data.authorizeUrl));
  assert.equal(authorizeUrl.origin + authorizeUrl.pathname, "https://open.weixin.qq.com/connect/qrconnect");
  assert.equal(authorizeUrl.searchParams.get("appid"), env.wechatOpenAppId);
  assert.equal(authorizeUrl.searchParams.get("redirect_uri"), env.wechatOpenRedirectUri);
  assert.equal(authorizeUrl.searchParams.get("response_type"), "code");
  assert.equal(authorizeUrl.searchParams.get("scope"), "snsapi_login");
  assert.equal(authorizeUrl.searchParams.get("state"), String(started.payload.data.flowId));
  assert.equal(authorizeUrl.hash, "");
  assert.equal(authorizeUrl.toString().includes("oauth2/authorize"), false);
  assert.equal(authorizeUrl.toString().includes("snsapi_base"), false);
  assert.equal(authorizeUrl.toString().includes("snsapi_userinfo"), false);
  assert.equal(authorizeUrl.toString().includes("SCOPE"), false);

  assert.equal(infoLogs.length > 0, true, "expected masked debug log");
  const debugPayload = infoLogs[0]?.[1] || {};
  assert.equal(String(debugPayload.endpoint || ""), "https://open.weixin.qq.com/connect/qrconnect");
  assert.equal(String(debugPayload.redirectUri || ""), env.wechatOpenRedirectUri);
  assert.equal(String(debugPayload.scope || ""), "snsapi_login");
  assert.equal(String(debugPayload.appidMasked || ""), "wx-t***-app");
  assert.equal(String(debugPayload.stateMasked || "").startsWith("wxflow"), true);
  assert.equal(String(debugPayload.stateMasked || "").includes("***"), true);
  assert.equal(String(debugPayload.secret || ""), "");
});

test("wechat bind success stores binding summary for the current user", async (t) => {
  useIsolatedPaths(t);
  useWechatEnv(t);
  useWechatFetchMock(t, WECHAT_MOCK_PROFILES);
  await initDatabase();

  const userId = `wechat_bind_${Date.now()}`;
  const username = `wechat_bind_${Date.now()}`;
  const password = "WechatBind123!Aa";
  createUser({ id: userId, username, password });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const login = await loginWithPassword({ baseUrl, username, password });
  assert.equal(login.response.status, 200);

  const started = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/bind/start",
    cookieHeader: login.cookieHeader,
  });
  assert.equal(started.response.status, 200);
  assert.ok(started.payload?.data?.flowId, "expected wechat bind flowId");

  const callback = await callWechatCallback({
    baseUrl,
    code: "bind_ok",
    flowId: String(started.payload?.data?.flowId || ""),
    cookieHeader: login.cookieHeader,
  });
  const callbackPayload = extractWechatCallbackPayload(callback.html);
  assert.equal(callback.response.status, 200);
  assert.equal(callbackPayload.success, true);
  assert.equal(callbackPayload.intent, "bind");

  const binding = await getWechatBinding({
    baseUrl,
    cookieHeader: login.cookieHeader,
  });
  assert.equal(binding.response.status, 200);
  assert.equal(binding.payload?.data?.bound, true);
  assert.equal(binding.payload?.data?.nickname, WECHAT_MOCK_PROFILES.bind_ok.nickname);
});

test("wechat bind rejects identities already bound to another account", async (t) => {
  useIsolatedPaths(t);
  useWechatEnv(t);
  useWechatFetchMock(t, WECHAT_MOCK_PROFILES);
  await initDatabase();

  const firstUserId = `wechat_conflict_a_${Date.now()}`;
  const firstUsername = `wechat_conflict_a_${Date.now()}`;
  const firstPassword = "WechatConflictA123!Aa";
  const secondUserId = `wechat_conflict_b_${Date.now()}`;
  const secondUsername = `wechat_conflict_b_${Date.now()}`;
  const secondPassword = "WechatConflictB123!Aa";
  createUser({ id: firstUserId, username: firstUsername, password: firstPassword });
  createUser({ id: secondUserId, username: secondUsername, password: secondPassword });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const firstLogin = await loginWithPassword({
    baseUrl,
    username: firstUsername,
    password: firstPassword,
  });
  const firstStart = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/bind/start",
    cookieHeader: firstLogin.cookieHeader,
  });
  await callWechatCallback({
    baseUrl,
    code: "bind_conflict",
    flowId: String(firstStart.payload?.data?.flowId || ""),
    cookieHeader: firstLogin.cookieHeader,
  });

  const secondLogin = await loginWithPassword({
    baseUrl,
    username: secondUsername,
    password: secondPassword,
  });
  const secondStart = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/bind/start",
    cookieHeader: secondLogin.cookieHeader,
  });
  const callback = await callWechatCallback({
    baseUrl,
    code: "bind_conflict",
    flowId: String(secondStart.payload?.data?.flowId || ""),
    cookieHeader: secondLogin.cookieHeader,
  });
  const callbackPayload = extractWechatCallbackPayload(callback.html);

  assert.equal(callback.response.status, 200);
  assert.equal(callbackPayload.success, false);
  assert.equal(callbackPayload.errorCode, "AUTH_WECHAT_ALREADY_BOUND");
});

test("wechat login succeeds only for already bound users", async (t) => {
  useIsolatedPaths(t);
  useWechatEnv(t);
  useWechatFetchMock(t, WECHAT_MOCK_PROFILES);
  await initDatabase();

  const userId = `wechat_login_${Date.now()}`;
  const username = `wechat_login_${Date.now()}`;
  const password = "WechatLogin123!Aa";
  createUser({ id: userId, username, password });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const bindLogin = await loginWithPassword({ baseUrl, username, password });
  const bindStart = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/bind/start",
    cookieHeader: bindLogin.cookieHeader,
  });
  await callWechatCallback({
    baseUrl,
    code: "login_bound",
    flowId: String(bindStart.payload?.data?.flowId || ""),
    cookieHeader: bindLogin.cookieHeader,
  });

  const loginStart = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/login/start",
    body: { rememberMe: true },
  });
  assert.equal(loginStart.response.status, 200);
  const callback = await callWechatCallback({
    baseUrl,
    code: "login_bound",
    flowId: String(loginStart.payload?.data?.flowId || ""),
  });
  const callbackPayload = extractWechatCallbackPayload(callback.html);

  assert.equal(callback.response.status, 200);
  assert.equal(callbackPayload.success, true);
  assert.equal(callbackPayload.intent, "login");
  const callbackCookies = mergeCookieHeader(callback.response.headers.getSetCookie());
  assert.match(callbackCookies, new RegExp(`${env.refreshCookieName}=`));
  const meResponse = await fetch(`${baseUrl}/api/v1/auth/me`, {
    headers: {
      cookie: callbackCookies,
    },
  });
  assert.equal(meResponse.status, 200);
  const mePayload = await meResponse.json();
  assert.equal(mePayload?.data?.username, username);
});

test("wechat login rejects unbound identities and does not create new users", async (t) => {
  useIsolatedPaths(t);
  useWechatEnv(t);
  useWechatFetchMock(t, WECHAT_MOCK_PROFILES);
  await initDatabase();

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const beforeCount = Number(query(`SELECT COUNT(*) as total FROM users`)[0]?.total || 0);
  const started = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/login/start",
    body: { rememberMe: false },
  });
  assert.equal(started.response.status, 200);

  const callback = await callWechatCallback({
    baseUrl,
    code: "login_unbound",
    flowId: String(started.payload?.data?.flowId || ""),
  });
  const callbackPayload = extractWechatCallbackPayload(callback.html);
  assert.equal(callback.response.status, 200);
  assert.equal(callbackPayload.success, false);
  assert.equal(callbackPayload.errorCode, "AUTH_WECHAT_NOT_BOUND");

  const afterCount = Number(query(`SELECT COUNT(*) as total FROM users`)[0]?.total || 0);
  assert.equal(afterCount, beforeCount);
});

test("wechat login surfaces MFA challenge instead of creating a session for MFA users", async (t) => {
  useIsolatedPaths(t);
  useWechatEnv(t);
  useWechatFetchMock(t, WECHAT_MOCK_PROFILES);
  await initDatabase();

  const userId = `wechat_login_mfa_${Date.now()}`;
  const username = `wechat_login_mfa_${Date.now()}`;
  const password = "WechatMfa123!Aa";
  createUser({
    id: userId,
    username,
    password,
    mfaEnabled: true,
    mfaSecret: "JBSWY3DPEHPK3PXP",
  });
  seedWechatBinding({
    userId,
    profile: WECHAT_MOCK_PROFILES.login_mfa,
  });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const loginStart = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/login/start",
    body: { rememberMe: true },
  });
  const callback = await callWechatCallback({
    baseUrl,
    code: "login_mfa",
    flowId: String(loginStart.payload?.data?.flowId || ""),
  });
  const callbackPayload = extractWechatCallbackPayload(callback.html);

  assert.equal(callback.response.status, 200);
  assert.equal(callbackPayload.success, true);
  assert.equal(callbackPayload.mfaRequired, true);
  assert.ok(callbackPayload.mfaChallengeToken, "expected mfa challenge token");
  const callbackCookies = mergeCookieHeader(callback.response.headers.getSetCookie());
  assert.equal(callbackCookies.includes(`${env.refreshCookieName}=`), false);
  assert.equal(callbackCookies.includes(`${env.accessCookieName}=`), false);
});

test("wechat unbind makes the existing wechat identity unable to log in immediately", async (t) => {
  useIsolatedPaths(t);
  useWechatEnv(t);
  useWechatFetchMock(t, WECHAT_MOCK_PROFILES);
  await initDatabase();

  const userId = `wechat_unbind_${Date.now()}`;
  const username = `wechat_unbind_${Date.now()}`;
  const password = "WechatUnbind123!Aa";
  createUser({ id: userId, username, password });

  const server = await createServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  const baseUrl = makeBaseUrl(server);
  const login = await loginWithPassword({ baseUrl, username, password });
  const bindStart = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/bind/start",
    cookieHeader: login.cookieHeader,
  });
  await callWechatCallback({
    baseUrl,
    code: "unbind_flow",
    flowId: String(bindStart.payload?.data?.flowId || ""),
    cookieHeader: login.cookieHeader,
  });

  const confirmed = await confirmSensitiveAction({
    baseUrl,
    cookieHeader: login.cookieHeader,
    password,
  });
  assert.equal(confirmed.response.status, 200);
  assert.ok(confirmed.payload?.data?.token, "expected user confirm token");

  const csrf = await fetchCsrfContext(baseUrl, confirmed.cookieHeader);
  const unbindResponse = await fetch(`${baseUrl}/api/v1/auth/wechat/unbind`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: csrf.cookieHeader,
      [env.csrfHeaderName]: csrf.csrfToken,
      "x-user-confirm-token": String(confirmed.payload?.data?.token || ""),
    },
    body: JSON.stringify({}),
  });
  const unbindPayload = await readResponsePayload(unbindResponse);
  assert.equal(unbindResponse.status, 200);
  assert.equal(unbindPayload?.success, true);

  const loginStart = await startWechatFlow({
    baseUrl,
    pathName: "/api/v1/auth/wechat/login/start",
    body: { rememberMe: false },
  });
  const callback = await callWechatCallback({
    baseUrl,
    code: "unbind_flow",
    flowId: String(loginStart.payload?.data?.flowId || ""),
  });
  const callbackPayload = extractWechatCallbackPayload(callback.html);
  assert.equal(callbackPayload.success, false);
  assert.equal(callbackPayload.errorCode, "AUTH_WECHAT_NOT_BOUND");
});
