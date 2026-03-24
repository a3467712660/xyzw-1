import express, { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import {
  USER_SENSITIVE_ACTION_TOKEN_HEADER,
  USER_SENSITIVE_ACTION_TOKEN_PURPOSE,
} from "../middleware/userSensitiveAction.js";
import { nowIso, randomId, secureId } from "../db/sql.js";
import {
  BIN_UPLOAD_MAX_BYTES,
  deleteBinFile,
  listBinFiles,
  readBinFile,
  saveBinFile,
  validateBinBuffer,
} from "../services/binStorageService.js";
import { userPreferenceRepository } from "../repositories/userPreferenceRepository.js";
import { binDownloadRepository } from "../repositories/binDownloadRepository.js";
import { recordSecurityEvent } from "../services/securityEventService.js";
import { verifyJwt } from "../lib/crypto.js";
import { errorResponse } from "../lib/httpResponse.js";

const router = Router();
const REMOTE_BIN_DOWNLOAD_PREF_KEY = "security.remote_bin_download_enabled";
const REFRESH_SECOND_VERIFY_PREF_KEY = "security.token_refresh_second_verify_enabled";
const BIN_DOWNLOAD_TICKET_TTL_SECONDS = 5 * 60;
const binRateKey = (req) => `${req.auth?.user?.id || "anonymous"}:${req.ip || "anonymous"}`;
const binListLimiter = createRateLimiter({
  scope: "bin_files_list",
  windowMs: 60 * 1000,
  max: 90,
  blockMs: 5 * 60 * 1000,
  keyGenerator: binRateKey,
});
const binUploadLimiter = createRateLimiter({
  scope: "bin_files_upload",
  windowMs: 10 * 60 * 1000,
  max: 20,
  blockMs: 20 * 60 * 1000,
  keyGenerator: binRateKey,
});
const binDownloadLimiter = createRateLimiter({
  scope: "bin_files_download",
  windowMs: 10 * 60 * 1000,
  max: 180,
  blockMs: 10 * 60 * 1000,
  keyGenerator: binRateKey,
});
const binDeleteLimiter = createRateLimiter({
  scope: "bin_files_delete",
  windowMs: 10 * 60 * 1000,
  max: 30,
  blockMs: 20 * 60 * 1000,
  keyGenerator: binRateKey,
});
const binTicketLimiter = createRateLimiter({
  scope: "bin_files_download_ticket",
  windowMs: 10 * 60 * 1000,
  max: 60,
  blockMs: 10 * 60 * 1000,
  keyGenerator: binRateKey,
});

const isRemoteBinDownloadEnabled = (userId) => {
  const row = userPreferenceRepository.findByUserAndKey({
    userId,
    key: REMOTE_BIN_DOWNLOAD_PREF_KEY,
  });
  if (!row) {
    return false;
  }

  try {
    const parsed = JSON.parse(row.valueJson);
    if (parsed === true) {
      return true;
    }
    if (!parsed || typeof parsed !== "object") {
      return false;
    }
    const expiresAt = String(parsed.expiresAt || "").trim();
    const expiresTs = new Date(expiresAt).getTime();
    return Number.isFinite(expiresTs) && expiresTs > Date.now();
  } catch {
    return false;
  }
};

const isRefreshSecondVerifyEnabled = (userId) => {
  const row = userPreferenceRepository.findByUserAndKey({
    userId,
    key: REFRESH_SECOND_VERIFY_PREF_KEY,
  });
  if (!row) {
    return true;
  }

  try {
    return JSON.parse(row.valueJson) !== false;
  } catch {
    return true;
  }
};

const readBinBuffer = (req) => readBinFile({
  user: req.auth.user,
  tokenId: req.params.tokenId,
});

const readUserConfirmToken = (req) => {
  const raw = req.headers?.[USER_SENSITIVE_ACTION_TOKEN_HEADER];
  if (Array.isArray(raw)) return String(raw[0] || "").trim();
  return String(raw || "").trim();
};

const writeBinAudit = (req, {
  tokenId = "",
  action = "unknown",
  result = "success",
  message = "",
}) => {
  const eventType = action === "bin_upload" ? "bin_upload" : "bin_download";
  recordSecurityEvent({
    userId: req.auth?.user?.id || null,
    eventType,
    detail: {
      action: String(action || "unknown"),
      tokenId: String(tokenId || req.params?.tokenId || ""),
      result: String(result || "success"),
      message: message ? String(message) : "",
    },
    ip: req.ip || null,
    userAgent: req.headers["user-agent"] || null,
  });

  try {
    binDownloadRepository.createDownloadAudit({
      id: randomId("bda"),
      userId: req.auth?.user?.id || "unknown",
      tokenId: String(tokenId || req.params?.tokenId || ""),
      action: String(action || "unknown"),
      result: String(result || "success"),
      message: message ? String(message) : null,
      ip: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
      createdAt: nowIso(),
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn("[bin-audit] write failed:", error?.message || "unknown");
  }
};

const userSensitiveActionRequiredWithAudit = (req, res, next) => {
  const token = readUserConfirmToken(req);
  if (!token) {
    writeBinAudit(req, {
      action: "bin_confirm_check",
      result: "required",
      message: "敏感操作需要二次确认，请先验证当前密码",
    });
    return errorResponse(
      res,
      403,
      "USER_CONFIRM_REQUIRED",
      "敏感操作需要二次确认，请先验证当前密码",
    );
  }

  try {
    const payload = verifyJwt(token);
    if (String(payload?.purpose || "") !== USER_SENSITIVE_ACTION_TOKEN_PURPOSE) {
      writeBinAudit(req, {
        action: "bin_confirm_check",
        result: "invalid",
        message: "二次确认令牌无效",
      });
      return errorResponse(res, 403, "USER_CONFIRM_INVALID", "二次确认令牌无效");
    }
    if (String(payload?.sub || "") !== String(req.auth?.user?.id || "")) {
      writeBinAudit(req, {
        action: "bin_confirm_check",
        result: "invalid",
        message: "二次确认令牌无效",
      });
      return errorResponse(res, 403, "USER_CONFIRM_INVALID", "二次确认令牌无效");
    }
    if (Number(payload?.ver) !== Number(req.auth?.user?.tokenVersion ?? 0)) {
      writeBinAudit(req, {
        action: "bin_confirm_check",
        result: "expired",
        message: "二次确认已失效，请重新验证密码",
      });
      return errorResponse(res, 403, "USER_CONFIRM_EXPIRED", "二次确认已失效，请重新验证密码");
    }

    return next();
  } catch {
    writeBinAudit(req, {
      action: "bin_confirm_check",
      result: "expired",
      message: "二次确认已失效，请重新验证密码",
    });
    return errorResponse(res, 403, "USER_CONFIRM_EXPIRED", "二次确认已失效，请重新验证密码");
  }
};

const conditionalSensitiveBinRead = (req, res, next) => {
  return userSensitiveActionRequiredWithAudit(req, res, next);
};

const sendBinBuffer = (req, res, buffer) => {
  if (!buffer) {
    writeBinAudit(req, {
      action: "bin_read",
      result: "not_found",
      message: "BIN 文件不存在",
    });
    return res.status(404).json({ success: false, message: "BIN 文件不存在" });
  }

  res.setHeader("Content-Type", "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Disposition", `attachment; filename="${req.params.tokenId}.bin"`);
  writeBinAudit(req, {
    action: "bin_read",
    result: "success",
    message: "BIN 明文已下发",
  });
  return res.send(buffer);
};

router.use(authRequired);

router.get("/bin-files", binListLimiter, (req, res) => {
  try {
    return res.json({
      success: true,
      data: listBinFiles({ user: req.auth.user }),
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message || "BIN 文件列表获取失败",
    });
  }
});

router.put(
  "/bin-files/:tokenId",
  binUploadLimiter,
  express.raw({ type: "application/octet-stream", limit: BIN_UPLOAD_MAX_BYTES }),
  (req, res) => {
    try {
      if (!req.is("application/octet-stream")) {
        writeBinAudit(req, {
          action: "bin_upload",
          result: "invalid_content_type",
          message: "仅支持 application/octet-stream",
        });
        return res.status(415).json({
          success: false,
          message: "仅支持 application/octet-stream 上传",
        });
      }
      const validationError = validateBinBuffer(req.body);
      if (validationError) {
        writeBinAudit(req, {
          action: "bin_upload",
          result: "invalid_format",
          message: validationError,
        });
        return res.status(400).json({
          success: false,
          message: validationError,
        });
      }
      const saved = saveBinFile({
        user: req.auth.user,
        tokenId: req.params.tokenId,
        buffer: req.body,
      });
      writeBinAudit(req, {
        action: "bin_upload",
        tokenId: saved.tokenId,
        result: "success",
        message: "BIN 文件上传成功",
      });
      return res.json({
        success: true,
        message: "BIN 文件保存成功",
        data: {
          tokenId: saved.tokenId,
          size: saved.size,
          checksum: saved.checksum,
        },
      });
    } catch (error) {
      writeBinAudit(req, {
        action: "bin_upload",
        result: "error",
        message: error.message || "BIN 文件保存失败",
      });
      return res.status(400).json({
        success: false,
        message: error.message || "BIN 文件保存失败",
      });
    }
  },
);

router.get("/bin-files/:tokenId", binDownloadLimiter, conditionalSensitiveBinRead, (req, res) => {
  try {
    const buffer = readBinBuffer(req);
    return sendBinBuffer(req, res, buffer);
  } catch (error) {
    writeBinAudit(req, {
      action: "bin_read",
      result: "error",
      message: error.message || "BIN 文件读取失败",
    });
    return res.status(400).json({
      success: false,
      message: error.message || "BIN 文件读取失败",
    });
  }
});

router.post(
  "/bin-files/:tokenId/download-ticket",
  binTicketLimiter,
  userSensitiveActionRequiredWithAudit,
  (req, res) => {
    try {
      const tokenId = String(req.params.tokenId || "").trim();
      if (!tokenId) {
        writeBinAudit(req, {
          action: "bin_download_ticket_issue",
          result: "invalid_request",
          message: "tokenId 为空",
        });
        return res.status(400).json({ success: false, message: "无效的 tokenId" });
      }
      if (!isRemoteBinDownloadEnabled(req.auth.user.id)) {
        writeBinAudit(req, {
          action: "bin_download_ticket_issue",
          result: "forbidden",
          message: "未开启远程 BIN 下载",
        });
        return res.status(403).json({
          success: false,
          message: "未开启远程 BIN 下载，请先前往个人设置开启",
        });
      }

      const ticketId = secureId("bdt");
      const now = Date.now();
      const expiresAt = new Date(now + BIN_DOWNLOAD_TICKET_TTL_SECONDS * 1000).toISOString();
      binDownloadRepository.createDownloadTicket({
        id: ticketId,
        userId: req.auth.user.id,
        tokenId,
        expiresAt,
        createdAt: nowIso(),
        createdIp: req.ip || null,
        createdUserAgent: req.headers["user-agent"] || null,
      });
      writeBinAudit(req, {
        action: "bin_download_ticket_issue",
        result: "success",
        message: "下载票据签发成功",
      });
      return res.json({
        success: true,
        data: {
          ticket: ticketId,
          expiresAt,
          tokenId,
        },
      });
    } catch (error) {
      writeBinAudit(req, {
        action: "bin_download_ticket_issue",
        result: "error",
        message: error.message || "下载票据签发失败",
      });
      return res.status(400).json({
        success: false,
        message: error.message || "下载票据签发失败",
      });
    }
  },
);

router.get("/bin-files/:tokenId/download", binDownloadLimiter, (req, res) => {
  try {
    const ticket = String(req.query?.ticket || "").trim();
    if (!ticket) {
      writeBinAudit(req, {
        action: "bin_download",
        result: "forbidden",
        message: "缺少下载票据",
      });
      return res.status(403).json({
        success: false,
        message: "缺少下载票据，请重新申请下载授权",
      });
    }

    if (!isRemoteBinDownloadEnabled(req.auth.user.id)) {
      writeBinAudit(req, {
        action: "bin_download",
        result: "forbidden",
        message: "未开启远程 BIN 下载",
      });
      return res.status(403).json({
        success: false,
        message: "未开启远程 BIN 下载，请先前往个人设置开启",
      });
    }

    const consumed = binDownloadRepository.consumeDownloadTicket({
      id: ticket,
      userId: req.auth.user.id,
      tokenId: String(req.params.tokenId || ""),
      usedAt: nowIso(),
      usedIp: req.ip || null,
      usedUserAgent: req.headers["user-agent"] || null,
    });
    if (!consumed) {
      writeBinAudit(req, {
        action: "bin_download",
        result: "ticket_invalid",
        message: "下载票据无效、过期或已使用",
      });
      return res.status(403).json({
        success: false,
        message: "下载票据无效、过期或已使用，请重新申请",
      });
    }

    const buffer = readBinBuffer(req);
    writeBinAudit(req, {
      action: "bin_download",
      result: "success",
      message: "下载票据消费成功",
    });
    return sendBinBuffer(req, res, buffer);
  } catch (error) {
    writeBinAudit(req, {
      action: "bin_download",
      result: "error",
      message: error.message || "BIN 文件读取失败",
    });
    return res.status(400).json({
      success: false,
      message: error.message || "BIN 文件读取失败",
    });
  }
});

router.delete("/bin-files/:tokenId", binDeleteLimiter, (req, res) => {
  try {
    const removed = deleteBinFile({
      user: req.auth.user,
      tokenId: req.params.tokenId,
    });
    recordSecurityEvent({
      userId: req.auth.user.id,
      eventType: "bin_delete",
      detail: {
        tokenId: String(req.params.tokenId || ""),
        removed,
      },
      ip: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
    });
    return res.json({
      success: true,
      message: removed ? "BIN 文件已删除" : "BIN 文件不存在",
      data: { removed },
    });
  } catch (error) {
    recordSecurityEvent({
      userId: req.auth.user.id,
      eventType: "bin_delete",
      detail: {
        tokenId: String(req.params.tokenId || ""),
        result: "error",
        message: error.message || "BIN 文件删除失败",
      },
      ip: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
    });
    return res.status(400).json({
      success: false,
      message: error.message || "BIN 文件删除失败",
    });
  }
});

export default router;
