import fs from "fs";
import path from "path";
import { env } from "../config/env.js";
import { getDb } from "./database.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const backupDir = path.resolve(path.dirname(env.dbPath), "backups");
const writeSafetyLogPath = path.resolve(path.dirname(env.dbPath), "db-write-safety.log");
const WRITE_SAFETY_LOG_FILE_MODE = 0o600;
const SENSITIVE_KEYWORDS = ["password", "token", "secret", "code", "cookie", "authorization"];
let backupTimer = null;

const ensureDir = (filePath) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

const appendWriteSafetyLog = (entry) => {
  if (!env.dbWriteSafetyLogEnabled) {
    return;
  }

  try {
    ensureDir(writeSafetyLogPath);
    if (!fs.existsSync(writeSafetyLogPath)) {
      fs.writeFileSync(writeSafetyLogPath, "", { encoding: "utf8", mode: WRITE_SAFETY_LOG_FILE_MODE });
    } else {
      const mode = fs.statSync(writeSafetyLogPath).mode & 0o777;
      if (mode !== WRITE_SAFETY_LOG_FILE_MODE) {
        fs.chmodSync(writeSafetyLogPath, WRITE_SAFETY_LOG_FILE_MODE);
      }
    }
    fs.appendFileSync(writeSafetyLogPath, `${JSON.stringify(entry)}\n`, "utf8");
  } catch {
    // ignore logging failure
  }
};

const toSafeString = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return "[unserializable]";
  }
};

const isSensitiveKey = (key) => SENSITIVE_KEYWORDS.some((keyword) => key.includes(keyword));

const truncateString = (value) => {
  if (typeof value !== "string") return value;
  if (value.length <= env.dbWriteSafetyParamMaxLen) return value;
  return `${value.slice(0, env.dbWriteSafetyParamMaxLen)}...(truncated)`;
};

const sanitizeParamValue = (key, value) => {
  const normalizedKey = String(key || "").toLowerCase();
  if (isSensitiveKey(normalizedKey)) {
    return "[redacted]";
  }
  return truncateString(toSafeString(value));
};

const sanitizeParams = (params) => {
  if (params === undefined || params === null) {
    return null;
  }
  if (Array.isArray(params)) {
    return params.map((value, index) => sanitizeParamValue(String(index), value));
  }
  if (typeof params !== "object") {
    return sanitizeParamValue("value", params);
  }
  const out = {};
  Object.keys(params).forEach((key) => {
    out[key] = sanitizeParamValue(key, params[key]);
  });
  return out;
};

const extractWriteMeta = (sql = "") => {
  const source = String(sql || "").trim();
  const normalized = source.replace(/\s+/g, " ");
  const patterns = [
    { op: "insert", regex: /^insert\s+into\s+["`[]?([a-zA-Z0-9_$.]+)["`\]]?/i },
    { op: "update", regex: /^update\s+["`[]?([a-zA-Z0-9_$.]+)["`\]]?/i },
    { op: "delete", regex: /^delete\s+from\s+["`[]?([a-zA-Z0-9_$.]+)["`\]]?/i },
    { op: "replace", regex: /^replace\s+into\s+["`[]?([a-zA-Z0-9_$.]+)["`\]]?/i },
  ];

  for (const candidate of patterns) {
    const matched = normalized.match(candidate.regex);
    if (matched) {
      return { op: candidate.op, table: String(matched[1] || "").toLowerCase() || "unknown" };
    }
  }
  return { op: "write", table: "unknown" };
};

const shouldLogParamsForTable = (table) => {
  if (!table || table === "unknown") {
    return false;
  }
  return env.dbWriteSafetyParamsTables.includes(table);
};

const nowStamp = () => new Date().toISOString().replace(/[:.]/g, "-");

const normalizeBindingParams = (params) => {
  if (params === undefined || params === null) {
    return params;
  }
  if (Array.isArray(params)) {
    return params;
  }
  if (typeof params !== "object") {
    return params;
  }

  const normalized = {};
  Object.keys(params).forEach((key) => {
    const normalizedKey = String(key).replace(/^[$:@]/, "");
    normalized[normalizedKey] = params[key];
  });
  return normalized;
};

const shouldBindParams = (params) => {
  if (params === undefined || params === null) {
    return false;
  }
  if (Array.isArray(params)) {
    return params.length > 0;
  }
  if (typeof params === "object") {
    return Object.keys(params).length > 0;
  }
  return true;
};

export const backup = (reason = "manual") => {
  if (!fs.existsSync(env.dbPath)) {
    return null;
  }

  const fileName = `xyzw-${reason}-${nowStamp()}.sqlite.bin`;
  const targetPath = path.join(backupDir, fileName);
  ensureDir(targetPath);
  fs.copyFileSync(env.dbPath, targetPath);
  return targetPath;
};

export const scheduleDailyBackup = () => {
  if (backupTimer) {
    return;
  }

  backupTimer = setInterval(() => {
    try {
      backup("daily");
    } catch (error) {
      appendWriteSafetyLog({
        type: "backup-error",
        at: new Date().toISOString(),
        reason: "daily",
        message: error.message,
      });
    }
  }, DAY_MS);

  if (typeof backupTimer.unref === "function") {
    backupTimer.unref();
  }
};

export const query = (sql, params = {}) => {
  const db = getDb();
  try {
    const stmt = db.prepare(sql);
    const bindingParams = normalizeBindingParams(params);
    if (!shouldBindParams(bindingParams)) {
      return stmt.all();
    }
    return stmt.all(bindingParams);
  } catch (error) {
    console.error(`[db-query-error] SQL: ${sql}`, error);
    throw error;
  }
};

export const run = (sql, params = {}) => {
  const db = getDb();
  const at = new Date().toISOString();
  const { op, table } = extractWriteMeta(sql);
  const shouldLogParams = shouldLogParamsForTable(table);
  const entry = {
    type: "write-intent",
    at,
    op,
    table,
    paramCount: Array.isArray(params)
      ? params.length
      : (params && typeof params === "object" ? Object.keys(params).length : (params == null ? 0 : 1)),
  };
  if (env.dbWriteSafetyIncludeSql) {
    entry.sql = truncateString(String(sql || "").replace(/\s+/g, " ").trim());
  }
  if (shouldLogParams) {
    entry.params = sanitizeParams(params);
  }
  appendWriteSafetyLog(entry);

  try {
    const stmt = db.prepare(sql);
    const bindingParams = normalizeBindingParams(params);
    if (!shouldBindParams(bindingParams)) {
      const info = stmt.run();
      appendWriteSafetyLog({
        type: "write-success",
        at: new Date().toISOString(),
        op,
        table,
        changes: info.changes,
        lastInsertRowid: info.lastInsertRowid,
      });
      return { success: true, changes: info.changes, lastInsertRowid: info.lastInsertRowid };
    }

    const info = stmt.run(bindingParams);
    appendWriteSafetyLog({
      type: "write-success",
      at: new Date().toISOString(),
      op,
      table,
      changes: info.changes,
      lastInsertRowid: info.lastInsertRowid,
    });
    return { success: true, changes: info.changes, lastInsertRowid: info.lastInsertRowid };
  } catch (error) {
    const failedEntry = {
      type: "write-failed",
      at: new Date().toISOString(),
      op,
      table,
      message: error.message,
    };
    if (env.dbWriteSafetyIncludeSql) {
      failedEntry.sql = truncateString(String(sql || "").replace(/\s+/g, " ").trim());
    }
    if (shouldLogParams) {
      failedEntry.params = sanitizeParams(params);
    }
    appendWriteSafetyLog(failedEntry);
    console.error(`[db-run-error] SQL: ${sql}`, error);
    throw error;
  }
};

export const transaction = (work) => {
  const db = getDb();
  return db.transaction(() => work({ query, run }))();
};

export const persist = () => {};
