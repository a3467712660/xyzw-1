import express, { Router } from "express";
import { env } from "../config/env.js";
import {
  HORTOR_DEVICE_UNIQUE_ID_PATTERN,
  QR_STATUS_BODY_SCHEMA,
} from "../contracts/hardeningSchemas.js";
import { isAllowedHttpOrigin, normalizeHttpOrigin } from "../lib/origin.js";
import {
  ProxySafetyError,
  fetchProxyResource,
} from "../lib/proxySafety.js";
import { authOptional } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();
const HORTOR_LOGIN_BODY_LIMIT = "64kb";
const HORTOR_DEVICE_UNIQUE_ID_HEADER = "x-xyzw-device-unique-id";
const WECHAT_PROXY_ALLOWED_HOSTS = [
  "open.weixin.qq.com",
  "long.open.weixin.qq.com",
  "comb-platform.hortorgames.com",
];
const QRCONNECT_RESPONSE_MAX_BYTES = 256 * 1024;
const QRSTATUS_RESPONSE_MAX_BYTES = 64 * 1024;
const HORTOR_LOGIN_RESPONSE_MAX_BYTES = 256 * 1024;

const qrConnectLimiter = createRateLimiter({
  scope: "wechat_proxy_qrconnect",
  windowMs: 60 * 1000,
  max: 60,
  blockMs: 5 * 60 * 1000,
});
const sharedWechatProxyLimiter = createRateLimiter({
  scope: "wechat_proxy_shared",
  windowMs: 60 * 1000,
  max: 120,
  blockMs: 5 * 60 * 1000,
});

const qrStatusLimiter = createRateLimiter({
  scope: "wechat_proxy_qrstatus",
  windowMs: 60 * 1000,
  max: 180,
  blockMs: 5 * 60 * 1000,
});

const hortorLoginLimiter = createRateLimiter({
  scope: "wechat_proxy_hortor_login",
  windowMs: 60 * 1000,
  max: 30,
  blockMs: 5 * 60 * 1000,
});

const allowedHortorRequestOrigins = new Set(
  (env.corsOrigins || [])
    .map((item) => normalizeHttpOrigin(item)?.raw || "")
    .filter(Boolean),
);

router.use("/wechat-proxy", sharedWechatProxyLimiter);

const ensureAllowedHortorSource = (req, res, next) => {
  const requestOrigin = String(req.get("origin") || "").trim();
  const refererOrigin = String(req.get("referer") || "").trim();
  const originAllowed = requestOrigin && isAllowedHttpOrigin(requestOrigin, allowedHortorRequestOrigins);
  const refererAllowed = refererOrigin && isAllowedHttpOrigin(refererOrigin, allowedHortorRequestOrigins);
  if (!originAllowed && !refererAllowed) {
    return res.status(403).json({
      success: false,
      message: "请求来源非法",
    });
  }
  return next();
};

const enforceGuestOnlyForHortorLogin = (req, res, next) => {
  if (!env.wechatProxyHortorLoginGuestOnly) {
    return next();
  }
  if (req.auth?.user?.id) {
    return res.status(403).json({
      success: false,
      message: "当前流程不支持已登录用户调用",
    });
  }
  return next();
};

const appendQuery = (target, query) => {
  Object.entries(query || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item !== undefined && item !== null) {
          target.searchParams.append(key, String(item));
        }
      });
      return;
    }
    if (value !== undefined && value !== null) {
      target.searchParams.append(key, String(value));
    }
  });
};

const hasNonEmptyQueryValue = (value) => {
  if (Array.isArray(value)) {
    return value.some((item) => String(item ?? "").trim());
  }
  return Boolean(String(value ?? "").trim());
};

const proxyText = async ({
  res,
  route,
  url,
  method = "GET",
  body = undefined,
  headers = {},
  allowedContentTypes = [],
  maxResponseBytes = env.wechatProxyResponseMaxBytes,
  timeoutFallback = null,
}) => {
  try {
    const upstream = await fetchProxyResource({
      route,
      url,
      method,
      body,
      headers,
      allowedHosts: WECHAT_PROXY_ALLOWED_HOSTS,
      fallbackAllowedHosts: [],
      allowedContentTypes,
      timeoutMs: env.wechatProxyTimeoutMs,
      maxResponseBytes: Math.min(
        Number(maxResponseBytes) || env.wechatProxyResponseMaxBytes,
        env.wechatProxyResponseMaxBytes,
      ),
      allowProxyFakeIpAddresses: true,
    });
    if (upstream.contentType) {
      res.set("content-type", upstream.contentType);
    }
    res.set("content-length", String(upstream.bodyBuffer.length));
    return res.status(upstream.status).send(upstream.bodyBuffer.toString("utf8"));
  } catch (error) {
    if (
      timeoutFallback
      && error instanceof ProxySafetyError
      && error.reason === "TIMEOUT"
    ) {
      if (timeoutFallback.contentType) {
        res.set("content-type", timeoutFallback.contentType);
      }
      return res.status(timeoutFallback.status || 200).send(timeoutFallback.body || "");
    }

    const reasonToMessage = {
      HOST_NOT_ALLOWED: "上游地址不安全，已拒绝请求",
      DNS_RESOLUTION_FAILED: "上游地址解析失败",
      PRIVATE_IP_BLOCKED: "上游地址不安全，已拒绝请求",
      REDIRECT_BLOCKED: "上游跳转目标不安全，已拒绝请求",
      RESPONSE_TOO_LARGE: "上游响应体超过安全大小限制",
      CONTENT_TYPE_NOT_ALLOWED: "上游响应类型不被允许",
      TIMEOUT: "上游请求超时",
      FETCH_FAILED: "上游请求失败",
    };
    return res.status(502).json({
      success: false,
      message:
        error instanceof ProxySafetyError
          ? reasonToMessage[error.reason] || "上游请求失败"
          : `上游请求失败: ${error?.message || "unknown error"}`,
    });
  }
};

router.get("/wechat-proxy/qrconnect", qrConnectLimiter, async (req, res) => {
  const target = new URL("https://open.weixin.qq.com/connect/app/qrconnect");
  appendQuery(target, req.query);
  return proxyText({
    res,
    route: "/api/v1/wechat-proxy/qrconnect",
    url: target.toString(),
    allowedContentTypes: ["text/html", "application/xhtml+xml"],
    maxResponseBytes: QRCONNECT_RESPONSE_MAX_BYTES,
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN",
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "referer": "https://open.weixin.qq.com/",
    },
  });
});

router.post(
  "/wechat-proxy/qrstatus",
  qrStatusLimiter,
  validateRequest({ body: QR_STATUS_BODY_SCHEMA }),
  async (req, res) => {
    if (hasNonEmptyQueryValue(req.query?.uuid)) {
      return res.status(400).json({
        success: false,
        message: "uuid 不能通过 URL 参数传递",
      });
    }

    const target = new URL("https://long.open.weixin.qq.com/connect/l/qrconnect");
    target.searchParams.set("uuid", req.body.uuid);
    target.searchParams.set("f", "url");
    target.searchParams.set("_", String(Date.now()));
    return proxyText({
      res,
      route: "/api/v1/wechat-proxy/qrstatus",
      url: target.toString(),
      allowedContentTypes: [
        "text/plain",
        "text/html",
        "text/javascript",
        "application/javascript",
        "application/x-javascript",
      ],
      maxResponseBytes: QRSTATUS_RESPONSE_MAX_BYTES,
      timeoutFallback: {
        status: 200,
        contentType: "application/javascript; charset=utf-8",
        body: "window.wx_errcode=404;",
      },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 7.0; Mi-4c Build/NRD90M; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/53.0.2785.49 Mobile MQQBrowser/6.2 TBS/043632 Safari/537.36 MicroMessenger/6.6.1.1220(0x26060135) NetType/WIFI Language/zh_CN",
        "accept": "*/*",
        "referer": "https://open.weixin.qq.com/",
      },
    });
  },
);

router.post(
  "/wechat-proxy/hortor-login",
  hortorLoginLimiter,
  authOptional,
  enforceGuestOnlyForHortorLogin,
  ensureAllowedHortorSource,
  express.text({ type: "*/*", limit: HORTOR_LOGIN_BODY_LIMIT }),
  async (req, res) => {
    const rawDeviceUniqueId = String(
      req.get(HORTOR_DEVICE_UNIQUE_ID_HEADER) || "",
    ).trim();
    if (hasNonEmptyQueryValue(req.query?.deviceUniqueId)) {
      return res.status(400).json({
        success: false,
        message: "deviceUniqueId 不能通过 URL 参数传递",
      });
    }
    if (!HORTOR_DEVICE_UNIQUE_ID_PATTERN.test(rawDeviceUniqueId)) {
      return res.status(400).json({
        success: false,
        message: "deviceUniqueId 非法",
      });
    }

    const target = new URL("https://comb-platform.hortorgames.com/comb-login-server/api/v1/login");
    const passthroughQuery = { ...req.query };
    delete passthroughQuery.deviceUniqueId;
    appendQuery(target, passthroughQuery);
    target.searchParams.set("deviceUniqueId", rawDeviceUniqueId);
    return proxyText({
      res,
      route: "/api/v1/wechat-proxy/hortor-login",
      url: target.toString(),
      method: "POST",
      body: String(req.body || ""),
      allowedContentTypes: [
        "application/json",
        "application/*+json",
        "text/plain",
      ],
      maxResponseBytes: HORTOR_LOGIN_RESPONSE_MAX_BYTES,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 12; 23117RK66C Build/V417IR; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/95.0.4638.74 Mobile Safari/537.36",
        "accept": "*/*",
        "origin": "https://open.weixin.qq.com",
        "referer": "https://open.weixin.qq.com/",
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  },
);

export default router;
