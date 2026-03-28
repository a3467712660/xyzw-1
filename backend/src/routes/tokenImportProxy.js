import { Router } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { isHostAllowed } from "../lib/hostAllowlist.js";
import { errorResponse } from "../lib/httpResponse.js";
import { authRequired } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { validateRequest } from "../middleware/validate.js";

const router = Router();
const PROXY_TIMEOUT_MS = 15_000;
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

    if (!isHostAllowed(target.hostname, env.trustedImportApiHosts, [])) {
      return errorResponse(
        res,
        403,
        "TOKEN_IMPORT_PROXY_HOST_NOT_ALLOWED",
        "目标地址未在受信任白名单中",
      );
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROXY_TIMEOUT_MS);

    try {
      const upstream = await fetch(target.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        redirect: "error",
        signal: controller.signal,
      });

      if (!upstream.ok) {
        return errorResponse(
          res,
          502,
          "TOKEN_IMPORT_PROXY_UPSTREAM_ERROR",
          `上游请求失败: HTTP ${upstream.status}`,
        );
      }

      let payload;
      try {
        payload = await upstream.json();
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
      const isTimeout =
        String(error?.name || "").toLowerCase() === "aborterror";
      return errorResponse(
        res,
        502,
        isTimeout
          ? "TOKEN_IMPORT_PROXY_UPSTREAM_TIMEOUT"
          : "TOKEN_IMPORT_PROXY_FETCH_FAILED",
        isTimeout ? "上游请求超时" : "上游请求失败",
      );
    } finally {
      clearTimeout(timer);
    }
  },
);

export default router;
