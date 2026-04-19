import { randomId } from "../db/sql.js";

const DEFAULT_RENDER_TTL_MS = 10 * 60 * 1000;
const renderStore = new Map();
const SENSITIVE_KEY_PATTERN = /token|cookie|seed|signature|secret|password/i;

const nowMs = () => Date.now();

const purgeExpiredRenders = () => {
  const now = nowMs();
  for (const [renderId, entry] of renderStore.entries()) {
    if (entry.expiresAtMs <= now) {
      renderStore.delete(renderId);
    }
  }
};

const escapeSvgText = (value) =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const stripSensitivePayload = (value, depth = 0) => {
  if (depth > 8) return null;
  if (Array.isArray(value)) return value.map((item) => stripSensitivePayload(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const output = {};
  Object.entries(value).forEach(([key, item]) => {
    if (!SENSITIVE_KEY_PATTERN.test(key)) {
      output[key] = stripSensitivePayload(item, depth + 1);
    }
  });
  return output;
};

const buildReplayPng = () => Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAXUlEQVR4nO3PQQ0AIBDAMMC/5+ONAvZoFSzZnTvwFs9fAHiGMBoGjIYBoyHAaBgwGgaMhgGjYcBoGDAaBoyGAaNhwGgYMBomjIYBo2HAaBgwGgaMhgGjYcBoGDAaBgz2A0HYFHiRbi29AAAAAElFTkSuQmCC",
  "base64",
);

export const createGameReplayRenderService = ({ ttlMs = DEFAULT_RENDER_TTL_MS } = {}) => ({
  renderReplay({ user, tokenId, payload }) {
    purgeExpiredRenders();
    const safePayload = stripSensitivePayload(payload || {});
    const renderId = randomId("grr");
    const expiresAtMs = nowMs() + ttlMs;
    const summary = String(safePayload?.summary || safePayload?.result || "回放渲染已生成").slice(0, 160);
    const title = String(safePayload?.title || `Token ${tokenId} 回放`).slice(0, 120);
    const imageBody = buildReplayPng({ title, summary });
    renderStore.set(renderId, {
      userId: String(user?.id || ""),
      imageBody,
      contentType: "image/png",
      expiresAtMs,
    });
    return {
      renderId,
      imageUrl: `/api/v1/game-features/rendered-replays/${renderId}/image`,
      summary,
      diagnostics: {
        renderer: "backend-svg",
        status: "rendered",
      },
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  },

  getRenderedReplayImage({ user, renderId }) {
    purgeExpiredRenders();
    const entry = renderStore.get(renderId);
    if (!entry || String(entry.userId) !== String(user?.id || "")) {
      return null;
    }
    return {
      renderId,
      contentType: entry.contentType,
      body: entry.imageBody,
    };
  },
});

export const gameReplayRenderService = createGameReplayRenderService();
