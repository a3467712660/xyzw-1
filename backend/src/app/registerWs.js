import { WebSocketServer } from "ws";
import { buildLoopbackOriginAlias, normalizeHttpOrigin } from "../lib/origin.js";
import { attachWsHub } from "../services/wsHub.js";

const isAllowedWsOrigin = (origin, corsOriginSet) => {
  const normalized = normalizeHttpOrigin(origin);
  if (!normalized) return false;
  if (corsOriginSet.has(normalized.raw)) return true;

  // Treat localhost and 127.0.0.1 as equivalent loopback origins for dev.
  const alias = buildLoopbackOriginAlias(normalized);
  if (alias && corsOriginSet.has(alias)) return true;

  return false;
};

export function registerWs(server, corsOriginSet) {
  const wss = new WebSocketServer({
    server,
    path: "/ws",
    verifyClient(info, done) {
      const origin = String(info.origin || "").trim();
      if (!origin || !isAllowedWsOrigin(origin, corsOriginSet)) {
        done(false, 403, "WS origin not allowed");
        return;
      }
      done(true);
    },
  });

  attachWsHub(wss);
  return wss;
}
