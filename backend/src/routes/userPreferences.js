import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { userSensitiveActionRequired } from "../middleware/userSensitiveAction.js";
import { nowIso } from "../db/sql.js";
import { userPreferenceRepository } from "../repositories/userPreferenceRepository.js";
import { createUserNotification } from "../services/notificationService.js";
import { recordSecurityEvent } from "../services/securityEventService.js";

const router = Router();

const KEY_PATTERN = /^[a-zA-Z0-9._:-]{1,64}$/;
const MAX_JSON_LENGTH = 50 * 1024;
const REMOTE_BIN_DOWNLOAD_PREF_KEY = "security.remote_bin_download_enabled";
const REFRESH_SECOND_VERIFY_PREF_KEY = "security.token_refresh_second_verify_enabled";
const REMOTE_BIN_DOWNLOAD_LEASE_MS = 15 * 60 * 1000;
const SENSITIVE_PREF_KEYS = new Set([
  REMOTE_BIN_DOWNLOAD_PREF_KEY,
  REFRESH_SECOND_VERIFY_PREF_KEY,
]);

const normalizeKey = (input) => String(input || "").trim();
const parseRemoteBinDownloadLease = (rawValue) => {
  if (rawValue === true) {
    return {
      active: true,
      expiresAt: null,
    };
  }

  if (!rawValue || typeof rawValue !== "object") {
    return {
      active: false,
      expiresAt: null,
    };
  }

  const expiresAt = String(rawValue.expiresAt || "").trim();
  const expiresTs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresTs)) {
    return {
      active: false,
      expiresAt: null,
    };
  }

  return {
    active: expiresTs > Date.now(),
    expiresAt,
  };
};

const normalizePreferenceResponse = (key, parsedValue) => {
  if (key === REMOTE_BIN_DOWNLOAD_PREF_KEY) {
    const lease = parseRemoteBinDownloadLease(parsedValue);
    return {
      value: lease.active,
      expiresAt: lease.expiresAt,
    };
  }

  return {
    value: parsedValue,
    expiresAt: null,
  };
};

const buildStoredPreferenceValue = (key, nextValue) => {
  if (key === REMOTE_BIN_DOWNLOAD_PREF_KEY) {
    if (nextValue === true) {
      return {
        enabled: true,
        expiresAt: new Date(Date.now() + REMOTE_BIN_DOWNLOAD_LEASE_MS).toISOString(),
      };
    }
    return false;
  }

  return nextValue;
};

const createSensitivePreferenceNotification = ({
  userId,
  key,
  nextValue,
  expiresAt = null,
}) => {
  if (!userId) {
    return;
  }

  if (key === REFRESH_SECOND_VERIFY_PREF_KEY) {
    const enabled = nextValue !== false;
    createUserNotification({
      userId,
      type: "security",
      title: enabled ? "已开启刷新 Token 二次验证" : "已关闭刷新 Token 二次验证",
      content: enabled
        ? "后续刷新 Token 读取 BIN 时，将再次要求安全确认。"
        : "后续刷新 Token 读取 BIN 时，不再依赖这项额外确认。请仅在受信环境下关闭。",
      payload: {
        key,
        value: enabled,
      },
    });
    return;
  }

  if (key === REMOTE_BIN_DOWNLOAD_PREF_KEY) {
    const enabled = Boolean(nextValue && typeof nextValue === "object" && nextValue.enabled);
    createUserNotification({
      userId,
      type: "security",
      title: enabled ? "已开启远程 BIN 下载" : "已关闭远程 BIN 下载",
      content: enabled
        ? `远程 BIN 下载权限已临时开启${expiresAt ? `，将于 ${expiresAt} 失效。` : "。"}`
        : "远程 BIN 下载权限已关闭。",
      payload: {
        key,
        value: enabled,
        expiresAt,
      },
    });
  }
};

const shouldRequireSensitiveConfirm = (key, value) => {
  if (key === REMOTE_BIN_DOWNLOAD_PREF_KEY) {
    return true;
  }
  if (key === REFRESH_SECOND_VERIFY_PREF_KEY) {
    return true;
  }
  return false;
};

router.use(authRequired);

router.get("/user/preferences/:key", (req, res) => {
  const key = normalizeKey(req.params.key);
  if (!KEY_PATTERN.test(key)) {
    return res.status(400).json({ success: false, message: "偏好键格式无效" });
  }

  const row = userPreferenceRepository.findByUserAndKey({
    userId: req.auth.user.id,
    key,
  });

  if (!row) {
    return res.json({
      success: true,
      data: {
        key,
        value: null,
        updatedAt: null,
      },
    });
  }

  let parsedValue = null;
  try {
    parsedValue = JSON.parse(row.valueJson);
  } catch {
    parsedValue = null;
  }
  const normalized = normalizePreferenceResponse(key, parsedValue);

  return res.json({
    success: true,
    data: {
      key: row.prefKey,
      value: normalized.value,
      expiresAt: normalized.expiresAt,
      updatedAt: row.updatedAt,
    },
  });
});

router.put("/user/preferences/:key", (req, res, next) => {
  const key = normalizeKey(req.params.key);
  if (SENSITIVE_PREF_KEYS.has(key) && shouldRequireSensitiveConfirm(key, req.body?.value)) {
    return userSensitiveActionRequired(req, res, next);
  }
  return next();
}, (req, res) => {
  const key = normalizeKey(req.params.key);
  if (!KEY_PATTERN.test(key)) {
    return res.status(400).json({ success: false, message: "偏好键格式无效" });
  }

  let parsedNextValue = null;
  try {
    parsedNextValue = buildStoredPreferenceValue(key, req.body?.value ?? null);
  } catch {
    return res.status(400).json({ success: false, message: "偏好值必须是有效JSON" });
  }
  const valueJson = JSON.stringify(parsedNextValue);

  if (valueJson.length > MAX_JSON_LENGTH) {
    return res.status(400).json({ success: false, message: "偏好值过大" });
  }

  const ts = nowIso();
  if (key === REFRESH_SECOND_VERIFY_PREF_KEY && req.body?.value === false) {
    return res.status(403).json({
      success: false,
      message: "普通用户不能直接关闭刷新 Token 二次验证，请向管理员提交申请",
    });
  }
  const previousRow = userPreferenceRepository.findByUserAndKey({
    userId: req.auth.user.id,
    key,
  });

  userPreferenceRepository.upsert({
    userId: req.auth.user.id,
    key,
    valueJson,
    createdAt: ts,
    updatedAt: ts,
  });

  if (key === REMOTE_BIN_DOWNLOAD_PREF_KEY || key === REFRESH_SECOND_VERIFY_PREF_KEY) {
    let previousValue = null;
    let nextValue = null;
    try {
      previousValue = previousRow ? JSON.parse(previousRow.valueJson) : null;
    } catch {
      previousValue = null;
    }
    try {
      nextValue = JSON.parse(valueJson);
    } catch {
      nextValue = null;
    }
    recordSecurityEvent({
      userId: req.auth.user.id,
      eventType:
        key === REMOTE_BIN_DOWNLOAD_PREF_KEY
          ? "remote_download_toggle"
          : "token_refresh_verify_toggle",
      detail: {
        key,
        previousValue,
        value: nextValue,
      },
      ip: req.ip || null,
      userAgent: req.headers["user-agent"] || null,
      createdAt: ts,
    });
    const normalized = normalizePreferenceResponse(key, parsedNextValue);
    createSensitivePreferenceNotification({
      userId: req.auth.user.id,
      key,
      nextValue: parsedNextValue,
      expiresAt: normalized.expiresAt,
    });
  }

  const normalizedResponse = normalizePreferenceResponse(key, parsedNextValue);
  return res.json({
    success: true,
    message: "偏好保存成功",
    data: {
      key,
      value: normalizedResponse.value,
      expiresAt: normalizedResponse.expiresAt,
      updatedAt: ts,
    },
  });
});

export default router;
