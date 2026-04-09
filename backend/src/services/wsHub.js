import {
  assertValidAccessToken,
  readBearerTokenFromHeaders,
} from "../middleware/auth.js";
import { parseCookies } from "../lib/cookies.js";
import { env } from "../config/env.js";

const socketsByUserId = new Map();
const socketsByIp = new Map();
const WS_AUTH_TIMEOUT_MS = 5000;
const WS_LIMIT_CLOSE_CODE = 1013;
const WS_LIMIT_CLOSE_REASON = "Connection limit exceeded";
let globalSocketCount = 0;

const getSocketIp = (req) => {
  const forwardedFor = String(req.headers?.["x-forwarded-for"] || "").trim();
  if (env.trustProxy !== false && forwardedFor) {
    const forwardedIp = forwardedFor.split(",")[0]?.trim();
    if (forwardedIp) {
      return forwardedIp;
    }
  }
  return String(req.socket?.remoteAddress || "").trim() || "unknown";
};

const incrementMapCount = (map, key) => {
  map.set(key, (map.get(key) || 0) + 1);
};

const decrementMapCount = (map, key) => {
  const next = (map.get(key) || 0) - 1;
  if (next > 0) {
    map.set(key, next);
    return;
  }
  map.delete(key);
};

const closeAllSocketsByUserId = (userId, reason = "Session revoked") => {
  const clients = socketsByUserId.get(String(userId || ""));
  if (!clients || clients.size === 0) return;

  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.close(1008, reason);
    }
  });
};

export const disconnectUserSockets = (userId, reason = "Session revoked") => {
  closeAllSocketsByUserId(userId, reason);
};

const mapAuthErrorToWsReason = (error) => {
  const code = String(error?.code || "");
  if (code === "AUTH_MISSING_TOKEN") return "Missing token";
  if (code === "AUTH_USER_NOT_FOUND") return "User not found";
  if (code === "AUTH_TRIAL_EXPIRED") return "Trial expired";
  if (code === "AUTH_TOKEN_REVOKED") return "Token revoked";
  return "Invalid token";
};

const closeForLimit = (ws) => {
  if (ws.readyState === ws.OPEN || ws.readyState === ws.CONNECTING) {
    ws.close(WS_LIMIT_CLOSE_CODE, WS_LIMIT_CLOSE_REASON);
  }
};

export const attachWsHub = (wss) => {
  wss.on("connection", (ws, req) => {
    const ip = getSocketIp(req);
    const currentIpCount = socketsByIp.get(ip) || 0;
    if (
      globalSocketCount >= env.wsMaxGlobalConnections
      || currentIpCount >= env.wsMaxConnectionsPerIp
    ) {
      closeForLimit(ws);
      return;
    }

    globalSocketCount += 1;
    incrementMapCount(socketsByIp, ip);

    let userId = "";
    let attachedSet = null;
    let authenticated = false;
    let authTimer = null;
    let cleanedUp = false;

    const cleanup = () => {
      if (cleanedUp) {
        return;
      }
      cleanedUp = true;
      if (authTimer) {
        clearTimeout(authTimer);
        authTimer = null;
      }
      if (attachedSet && userId) {
        attachedSet.delete(ws);
        if (attachedSet.size === 0) {
          socketsByUserId.delete(userId);
        }
        attachedSet = null;
      }
      decrementMapCount(socketsByIp, ip);
      globalSocketCount = Math.max(0, globalSocketCount - 1);
    };

    const acceptToken = (token, { allowReauth = false } = {}) => {
      if (!token) {
        ws.close(1008, "Missing token");
        return false;
      }

      const previousUserId = userId;
      try {
        const { payload, user } = assertValidAccessToken(token);

        const subject = String(user.id || payload.sub || "");
        if (!subject) {
          ws.close(1008, "Invalid subject");
          return false;
        }

        userId = subject;
      } catch (error) {
        ws.close(1008, mapAuthErrorToWsReason(error));
        return false;
      }

      if (allowReauth && previousUserId && previousUserId !== userId) {
        ws.close(1008, "Invalid subject");
        return false;
      }

      if (!socketsByUserId.has(userId)) {
        socketsByUserId.set(userId, new Set());
      }
      const userSockets = socketsByUserId.get(userId);
      const userAlreadyAttached = userSockets.has(ws);
      if (
        !userAlreadyAttached
        && userSockets.size >= env.wsMaxConnectionsPerUser
      ) {
        if (userSockets.size === 0) {
          socketsByUserId.delete(userId);
        }
        closeForLimit(ws);
        return false;
      }

      attachedSet = userSockets;
      if (!userAlreadyAttached) {
        userSockets.add(ws);
      }
      const wasAuthenticated = authenticated;
      authenticated = true;
      if (authTimer) {
        clearTimeout(authTimer);
        authTimer = null;
      }

      if (!wasAuthenticated || !allowReauth) {
        ws.send(
          JSON.stringify({
            type: "connected",
            at: new Date().toISOString(),
          }),
        );
      } else {
        ws.send(
          JSON.stringify({
            type: "reauthenticated",
            at: new Date().toISOString(),
          }),
        );
      }

      return true;
    };

    const bearer = readBearerTokenFromHeaders(req.headers);
    const accessTokenFromCookie = String(parseCookies(req.headers?.cookie || "")[env.accessCookieName] || "").trim();
    const handshakeToken = bearer || accessTokenFromCookie;
    if (handshakeToken) {
      acceptToken(handshakeToken);
    } else {
      authTimer = setTimeout(() => {
        if (!authenticated && ws.readyState === ws.OPEN) {
          ws.close(1008, "Authentication timeout");
        }
      }, WS_AUTH_TIMEOUT_MS);
    }

    ws.on("message", (raw) => {
      let payload;
      try {
        payload = JSON.parse(String(raw || ""));
      } catch {
        if (!authenticated) {
          ws.close(1008, "Invalid auth frame");
        }
        return;
      }

      const type = String(payload?.type || "").trim();
      if (type === "auth") {
        if (authenticated) return;
        const token = String(payload?.token || "").trim();
        acceptToken(token);
        return;
      }

      if (type === "reauth") {
        if (!authenticated) {
          ws.close(1008, "Authentication required");
          return;
        }
        const token = String(payload?.token || "").trim();
        acceptToken(token, { allowReauth: true });
        return;
      }

      if (!authenticated) {
        ws.close(1008, "Authentication required");
      }
    });

    ws.on("close", cleanup);
    ws.on("error", cleanup);
  });
};

export const broadcastToUser = (userId, payload) => {
  const clients = socketsByUserId.get(userId);
  if (!clients || clients.size === 0) return;

  const body = JSON.stringify(payload);
  clients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(body);
    }
  });
};
