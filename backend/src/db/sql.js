import crypto from "crypto";
import { persist, query, run as executeRun, transaction } from "./client.js";

export const nowIso = () => new Date().toISOString();

export const randomId = (prefix) =>
  `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

export const secureId = (prefix) =>
  `${prefix}_${crypto.randomBytes(16).toString("base64url")}`;

export const getOne = (sql, params = {}) => {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
};

export const getMany = (sql, params = {}) => query(sql, params);

export const run = (sql, params = {}) => executeRun(sql, params);

export const withTransaction = (fn) => transaction(() => fn());

export { query, transaction, persist };
