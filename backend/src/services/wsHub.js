import {
  assertValidAccessToken,
  readBearerTokenFromHeaders,
} from "../middleware/auth.js";
import { parseCookies } from "../lib/cookies.js";
import { env } from "../config/env.js";

const socketsByUserId = new Map();
const WS_AUTH_TIMEOUT_MS = 5000;

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

export const attachWsHub = (wss) => {
  wss.on("connection", (ws, req) => {
    let userId = "";
    let attachedSet = null;
    let authenticated = false;
    let authTimer = null;

    const cleanup = () => {
      if (authTimer) {
        clearTimeout(authTimer);
        authTimer = null;
      }
      if (attachedSet && userId) {
        attachedSet.delete(ws);
        if (attachedSet.size === 0) {
          socketsByUserId.delete(userId);
        }
      }
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
      attachedSet = socketsByUserId.get(userId);
      attachedSet.add(ws);
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
