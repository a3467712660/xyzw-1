import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { errorResponse } from "../lib/httpResponse.js";
import {
  ProxySafetyError,
  fetchProxyResource,
} from "../lib/proxySafety.js";
import { authRequired } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();
const TOKEN_IMPORT_PROXY_ROUTE = "/api/v1/token-import/proxy";
const tokenImportProxyLimiter = createRateLimiter({
  scope: "token_import_proxy",
  windowMs: 60 * 1000,
  max: 30,
  blockMs: 5 * 60 * 1000,
  keyGenerator: (req) =>
    `${req.auth?.user?.id || "anonymous"}:${req.ip || "anonymous"}`,
});
const tokenImportProxyBodySchema = z
  .object({
    url: z.string().trim().min(1).max(2048),
  })
  .strict();

router.use(authRequired);

router.post(
  "/token-import/proxy",
  tokenImportProxyLimiter,
  validateRequest({ body: tokenImportProxyBodySchema }),
  async (req, res) => {
    let target;
    try {
      target = new URL(req.body.url);
    } catch {
      return errorResponse(
        res,
        400,
        "TOKEN_IMPORT_PROXY_INVALID_URL",
        "url 必须是有效的绝对地址",
      );
    }

    if (!["http:", "https:"].includes(target.protocol)) {
      return errorResponse(
        res,
        400,
        "TOKEN_IMPORT_PROXY_UNSUPPORTED_PROTOCOL",
        "仅支持 HTTP 或 HTTPS 地址",
      );
    }

    if (target.username || target.password) {
      return errorResponse(
        res,
        400,
        "TOKEN_IMPORT_PROXY_CREDENTIALS_NOT_ALLOWED",
        "代理地址不允许包含用户名或密码",
      );
    }

    try {
      const upstream = await fetchProxyResource({
        route: TOKEN_IMPORT_PROXY_ROUTE,
        url: target.toString(),
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        allowedHosts: env.trustedImportApiHosts,
        fallbackAllowedHosts: [],
        allowedContentTypes: ["application/json", "application/*+json"],
        timeoutMs: env.tokenImportProxyTimeoutMs,
        maxResponseBytes: env.tokenImportProxyResponseMaxBytes,
      });
      if (upstream.status < 200 || upstream.status >= 300) {
        return errorResponse(
          res,
          502,
          "TOKEN_IMPORT_PROXY_UPSTREAM_ERROR",
          `上游请求失败: HTTP ${upstream.status}`,
        );
      }

      let payload;
      try {
        payload = JSON.parse(upstream.bodyBuffer.toString("utf8"));
      } catch {
        return errorResponse(
          res,
          502,
          "TOKEN_IMPORT_PROXY_INVALID_JSON",
          "上游返回的不是有效 JSON",
        );
      }

      return res.status(upstream.status).json(payload);
    } catch (error) {
      if (error instanceof ProxySafetyError) {
        const responseByReason = {
          HOST_NOT_ALLOWED: [403, "TOKEN_IMPORT_PROXY_HOST_NOT_ALLOWED", "目标地址未在受信任白名单中"],
          DNS_RESOLUTION_FAILED: [502, "TOKEN_IMPORT_PROXY_DNS_RESOLUTION_FAILED", "目标地址解析失败"],
          PRIVATE_IP_BLOCKED: [403, "TOKEN_IMPORT_PROXY_PRIVATE_IP_BLOCKED", "目标地址解析到了不安全的内网或保留地址"],
          REDIRECT_BLOCKED: [502, "TOKEN_IMPORT_PROXY_REDIRECT_BLOCKED", "上游跳转目标不安全或不被允许"],
          RESPONSE_TOO_LARGE: [502, "TOKEN_IMPORT_PROXY_RESPONSE_TOO_LARGE", "上游响应体超过安全大小限制"],
          CONTENT_TYPE_NOT_ALLOWED: [502, "TOKEN_IMPORT_PROXY_CONTENT_TYPE_NOT_ALLOWED", "上游响应类型不被允许"],
          TIMEOUT: [502, "TOKEN_IMPORT_PROXY_UPSTREAM_TIMEOUT", "上游请求超时"],
          FETCH_FAILED: [502, "TOKEN_IMPORT_PROXY_FETCH_FAILED", "上游请求失败"],
        };
        const [status, code, message] = responseByReason[error.reason] || [
          502,
          "TOKEN_IMPORT_PROXY_FETCH_FAILED",
          "上游请求失败",
        ];
        return errorResponse(res, status, code, message);
      }

      return errorResponse(
        res,
        502,
        "TOKEN_IMPORT_PROXY_FETCH_FAILED",
        "上游请求失败",
      );
    }
  },
);

export default router;
