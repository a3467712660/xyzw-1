import { env } from "../config/env.js";

const SSE_RETRY_MS = 5000;
const SSE_KEEPALIVE_MS = 20000;
const SSE_LIMIT_MESSAGE = "公开联系人订阅过于频繁，请稍后重试";

const clients = new Map();
const connectionsByIp = new Map();
let keepaliveTimer = null;

const writeSseFrame = (res, lines = []) => {
  const payload = Array.isArray(lines) ? lines.join("\n") : String(lines || "");
  res.write(`${payload}\n\n`);
};

const getClientIp = (req) =>
  String(req.ip || req.socket?.remoteAddress || "unknown").trim() || "unknown";

const incrementIpCount = (ip) => {
  connectionsByIp.set(ip, (connectionsByIp.get(ip) || 0) + 1);
};

const decrementIpCount = (ip) => {
  const next = (connectionsByIp.get(ip) || 0) - 1;
  if (next > 0) {
    connectionsByIp.set(ip, next);
    return;
  }
  connectionsByIp.delete(ip);
};

const ensureKeepaliveTimer = () => {
  if (keepaliveTimer || clients.size === 0) {
    return;
  }
  keepaliveTimer = setInterval(() => {
    clients.forEach((_meta, res) => {
      try {
        writeSseFrame(res, [": keepalive"]);
      } catch {
        const ip = clients.get(res)?.ip;
        clients.delete(res);
        if (ip) {
          decrementIpCount(ip);
        }
      }
    });
    if (clients.size === 0 && keepaliveTimer) {
      clearInterval(keepaliveTimer);
      keepaliveTimer = null;
    }
  }, SSE_KEEPALIVE_MS);
  if (typeof keepaliveTimer.unref === "function") {
    keepaliveTimer.unref();
  }
};

const cleanupClient = (res) => {
  const meta = clients.get(res);
  if (!meta) {
    return;
  }
  clients.delete(res);
  decrementIpCount(meta.ip);
  if (clients.size === 0 && keepaliveTimer) {
    clearInterval(keepaliveTimer);
    keepaliveTimer = null;
  }
};

const isOverLimit = (ip) => {
  if (clients.size >= env.publicWechatContactsSseMaxGlobal) {
    return true;
  }
  return (connectionsByIp.get(ip) || 0) >= env.publicWechatContactsSseMaxPerIp;
};

export const registerWechatContactsStreamClient = (req, res) => {
  const ip = getClientIp(req);
  if (isOverLimit(ip)) {
    res.status(429).json({
      success: false,
      message: SSE_LIMIT_MESSAGE,
    });
    return false;
  }

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  writeSseFrame(res, [`retry: ${SSE_RETRY_MS}`]);
  writeSseFrame(res, [
    "event: connected",
    `data: ${JSON.stringify({ at: new Date().toISOString() })}`,
  ]);

  clients.set(res, { ip });
  incrementIpCount(ip);
  ensureKeepaliveTimer();

  const cleanup = () => cleanupClient(res);
  req.on("close", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
  return true;
};

export const broadcastWechatContactsChanged = () => {
  const payload = JSON.stringify({ at: new Date().toISOString() });
  clients.forEach((_meta, res) => {
    try {
      writeSseFrame(res, [
        "event: contacts_changed",
        `data: ${payload}`,
      ]);
    } catch {
      cleanupClient(res);
    }
  });
};
