import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { userSensitiveActionRequired } from "../middleware/userSensitiveAction.js";
import { nowIso } from "../db/sql.js";
import { userPreferenceRepository } from "../repositories/userPreferenceRepository.js";
import { recordSecurityEvent } from "../services/securityEventService.js";

const router = Router();

const KEY_PATTERN = /^[a-zA-Z0-9._:-]{1,64}$/;
const MAX_JSON_LENGTH = 50 * 1024;
const REMOTE_BIN_DOWNLOAD_PREF_KEY = "security.remote_bin_download_enabled";
const REFRESH_SECOND_VERIFY_PREF_KEY = "security.token_refresh_second_verify_enabled";
const SENSITIVE_PREF_KEYS = new Set([
  REMOTE_BIN_DOWNLOAD_PREF_KEY,
  REFRESH_SECOND_VERIFY_PREF_KEY,
]);

const normalizeKey = (input) => String(input || "").trim();
const shouldRequireSensitiveConfirm = (key, value) => {
  if (key === REMOTE_BIN_DOWNLOAD_PREF_KEY) {
    return true;
  }
  if (key === REFRESH_SECOND_VERIFY_PREF_KEY) {
    return Boolean(value);
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

  return res.json({
    success: true,
    data: {
      key: row.prefKey,
      value: parsedValue,
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

  let valueJson = "null";
  try {
    valueJson = JSON.stringify(req.body?.value ?? null);
  } catch {
    return res.status(400).json({ success: false, message: "偏好值必须是有效JSON" });
  }

  if (valueJson.length > MAX_JSON_LENGTH) {
    return res.status(400).json({ success: false, message: "偏好值过大" });
  }

  const ts = nowIso();
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
  }

  return res.json({
    success: true,
    message: "偏好保存成功",
    data: {
      key,
      updatedAt: ts,
    },
  });
});

export default router;
