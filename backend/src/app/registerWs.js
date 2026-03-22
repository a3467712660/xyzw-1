import { WebSocketServer } from "ws";
import { attachWsHub } from "../services/wsHub.js";

const normalizeLoopbackOrigin = (originValue) => {
  const raw = String(originValue || "").trim();
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    const { protocol, hostname, port } = parsed;
    const normalizedProtocol = String(protocol || "").toLowerCase();
    if (normalizedProtocol !== "http:" && normalizedProtocol !== "https:") {
      return null;
    }

    const normalizedHostname = String(hostname || "").toLowerCase();
    const normalizedPort = String(port || "");
    return {
      protocol: normalizedProtocol,
      hostname: normalizedHostname,
      port: normalizedPort,
      raw: `${normalizedProtocol}//${normalizedHostname}${normalizedPort ? `:${normalizedPort}` : ""}`,
    };
  } catch {
    return null;
  }
};

const buildLoopbackAlias = (normalized) => {
  if (!normalized) return null;
  if (normalized.hostname === "localhost") {
    return `${normalized.protocol}//127.0.0.1${normalized.port ? `:${normalized.port}` : ""}`;
  }
  if (normalized.hostname === "127.0.0.1") {
    return `${normalized.protocol}//localhost${normalized.port ? `:${normalized.port}` : ""}`;
  }
  return null;
};

const isAllowedWsOrigin = (origin, corsOriginSet) => {
  const normalized = normalizeLoopbackOrigin(origin);
  if (!normalized) return false;
  if (corsOriginSet.has(normalized.raw)) return true;

  // Treat localhost and 127.0.0.1 as equivalent loopback origins for dev.
  const alias = buildLoopbackAlias(normalized);
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
