import { Router } from "express";
import { authRequired } from "../middleware/auth.js";
import { nowIso } from "../db/sql.js";
import { resourceChangeLogRepository } from "../repositories/resourceChangeLogRepository.js";

const router = Router();

const KEY_PATTERN = /^[a-zA-Z0-9._:-]{1,160}$/;
const MAX_ENTRY_JSON_LENGTH = 200 * 1024;
const MAX_BULK_JSON_LENGTH = 2 * 1024 * 1024;

const normalizeKey = (input) => String(input || "").trim();

const serializeEntry = (entry) => {
  try {
    return JSON.stringify(entry ?? null);
  } catch {
    return null;
  }
};

const parseEntry = (text) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

router.use(authRequired);

router.get("/resource-change-logs", (req, res) => {
  const rows = resourceChangeLogRepository.listByUser(req.auth.user.id);

  const entries = {};
  rows.forEach((row) => {
    const parsed = parseEntry(row.payloadJson);
    if (parsed !== null) {
      entries[row.scopeKey] = parsed;
    }
  });

  return res.json({
    success: true,
    data: {
      entries,
      updatedAt: rows[0]?.updatedAt || null,
    },
  });
});

router.put("/resource-change-logs/:scopeKey", (req, res) => {
  const scopeKey = normalizeKey(req.params.scopeKey);
  if (!KEY_PATTERN.test(scopeKey)) {
    return res.status(400).json({ success: false, message: "scopeKey 格式无效" });
  }

  const payloadJson = serializeEntry(req.body?.entry);
  if (payloadJson === null) {
    return res.status(400).json({ success: false, message: "entry 必须是有效 JSON" });
  }
  if (payloadJson.length > MAX_ENTRY_JSON_LENGTH) {
    return res.status(400).json({ success: false, message: "entry 数据过大" });
  }

  const ts = nowIso();
  resourceChangeLogRepository.upsertOne({
    userId: req.auth.user.id,
    scopeKey,
    payloadJson,
    createdAt: ts,
    updatedAt: ts,
  });

  return res.json({
    success: true,
    message: "资源变化记录已保存",
    data: { scopeKey, updatedAt: ts },
  });
});

router.put("/resource-change-logs", (req, res) => {
  const entries = req.body?.entries;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) {
    return res.status(400).json({ success: false, message: "entries 格式无效" });
  }

  const entriesJson = serializeEntry(entries);
  if (!entriesJson) {
    return res.status(400).json({ success: false, message: "entries 必须是有效 JSON" });
  }
  if (entriesJson.length > MAX_BULK_JSON_LENGTH) {
    return res.status(400).json({ success: false, message: "entries 数据过大" });
  }

  const ts = nowIso();
  const items = [];

  Object.entries(entries).forEach(([rawScopeKey, entry]) => {
    const scopeKey = normalizeKey(rawScopeKey);
    if (!KEY_PATTERN.test(scopeKey)) {
      return;
    }

    const payloadJson = serializeEntry(entry);
    if (payloadJson === null || payloadJson.length > MAX_ENTRY_JSON_LENGTH) {
      return;
    }

    items.push({ scopeKey, payloadJson });
  });

  resourceChangeLogRepository.upsertMany({
    userId: req.auth.user.id,
    items,
    timestamp: ts,
  });

  return res.json({
    success: true,
    message: `资源变化记录批量保存成功（${items.length} 条）`,
    data: { count: items.length, updatedAt: ts },
  });
});

export default router;
