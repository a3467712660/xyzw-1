import crypto from "crypto";
import WebSocket from "ws";
import { nowIso } from "../db/sql.js";
import { readBinFile } from "./binStorageService.js";
import { userPreferenceRepository } from "../repositories/userPreferenceRepository.js";
import { sanitizeTaskControlLogMessage } from "./taskControlScheduler/taskControlSchedulerHelpers.js";
import { g_utils } from "../../../shared/bonProtocol.js";

const DEFAULT_TIMEOUT_MS = 10_000;
const WS_CONNECT_TIMEOUT_MS = 12_000;
const TOKEN_CACHE_TTL_MS = 30 * 60 * 1000;
const MAX_SAVED_LINEUPS = 30;
const tokenCache = new Map();

export const GAME_FEATURE_ACTIONS = Object.freeze([
  {
    id: "daily-tasks",
    title: "日常任务",
    description: "领取日常奖励并刷新基础状态。",
    command: "task_claimdailyreward",
  },
  {
    id: "salt-robot",
    title: "盐罐助手",
    description: "领取盐罐助手奖励。",
    command: "bottlehelper_claim",
  },
  {
    id: "idle-time",
    title: "挂机收益",
    description: "领取挂机收益。",
    command: "system_claimhangupreward",
  },
  {
    id: "power-switch",
    title: "刷新战力",
    description: "读取角色基础信息。",
    command: "role_getroleinfo",
  },
  {
    id: "club-ranking",
    title: "俱乐部报名",
    description: "执行俱乐部比赛报名。",
    command: "legionmatch_rolesignup",
  },
  {
    id: "club-checkin",
    title: "俱乐部签到",
    description: "执行俱乐部签到。",
    command: "legion_signin",
  },
  {
    id: "tower-challenge",
    title: "咸将塔",
    description: "发起咸将塔挑战。",
    command: "fight_starttower",
  },
  {
    id: "team-challenge",
    title: "竞技场挑战",
    description: "获取竞技场目标并发起一次挑战。",
    command: "arena_getareatarget",
  },
]);

const GAME_ACTION_BY_ID = new Map(GAME_FEATURE_ACTIONS.map((item) => [item.id, item]));
export const GAME_FEATURE_ACTION_IDS = [...GAME_ACTION_BY_ID.keys()];

const SENSITIVE_KEY_PATTERN = /token|cookie|seed|signature|secret|password/i;

export class GameCommandError extends Error {
  constructor(message, { status = 400, code = "GAME_COMMAND_FAILED" } = {}) {
    super(message);
    this.name = "GameCommandError";
    this.status = status;
    this.code = code;
    this.publicMessage = message;
  }
}

export const stripSensitiveGamePayload = (value, depth = 0) => {
  if (depth > 8) return null;
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveGamePayload(item, depth + 1));
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  const output = {};
  Object.entries(value).forEach(([key, item]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return;
    }
    output[key] = stripSensitiveGamePayload(item, depth + 1);
  });
  return output;
};

const parseJsonPreference = (row, fallback) => {
  if (!row) return fallback;
  try {
    return JSON.parse(row.valueJson);
  } catch {
    return fallback;
  }
};

const lineupPreferenceKey = (tokenId) => `lineup.saved:${tokenId}`;

const normalizeSavedLineups = (value) => {
  const source = Array.isArray(value?.saved) ? value.saved : Array.isArray(value) ? value : [];
  return source.slice(0, MAX_SAVED_LINEUPS).map((item, index) => {
    const id = String(item?.id || `lineup-${index + 1}`).trim().slice(0, 80);
    const name = String(item?.name || `阵容 ${index + 1}`).trim().slice(0, 80);
    const teamId = Number(item?.teamId || item?.formation || 0);
    const slots = Array.isArray(item?.slots)
      ? item.slots.slice(0, 12).map((slot, slotIndex) => ({
        position: Number(slot?.position || slotIndex + 1),
        heroId: String(slot?.heroId || "").trim(),
        heroName: String(slot?.heroName || slot?.name || "").trim().slice(0, 80),
        artifactId: String(slot?.artifactId || "").trim(),
        pearlId: String(slot?.pearlId || "").trim(),
      }))
      : [];
    return {
      id,
      name,
      teamId: Number.isInteger(teamId) && teamId >= 1 && teamId <= 6 ? teamId : null,
      slots,
      updatedAt: String(item?.updatedAt || nowIso()),
    };
  });
};

const pickArenaTargetId = (targets) => {
  const candidate =
    targets?.rankList?.[0]
    || targets?.roleList?.[0]
    || targets?.targets?.[0]
    || targets?.targetList?.[0]
    || targets?.list?.[0];
  return candidate?.roleId || candidate?.id || targets?.roleId || targets?.id || null;
};

const decodeAuthPayloadToToken = async (binBuffer, { fetchImpl = fetch } = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetchImpl("https://xxz-xyzw.hortorgames.com/login/authuser?_seq=1", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
      },
      body: Buffer.from(binBuffer),
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new GameCommandError(`BIN 登录换取 token 失败: HTTP ${response.status}`, {
        status: 502,
        code: "GAME_AUTHUSER_FAILED",
      });
    }
    const payload = await response.arrayBuffer();
    const msg = g_utils.parse(payload);
    const data = msg.getData() || {};
    return JSON.stringify({
      ...data,
      sessId: Date.now() * 100 + crypto.randomInt(0, 100),
      connId: Date.now() + crypto.randomInt(0, 10),
      isRestore: 0,
    });
  } finally {
    clearTimeout(timer);
  }
};

const getActualTokenByBin = async ({ user, tokenId, fetchImpl }) => {
  const cacheKey = `${user.id}:${tokenId}`;
  const cached = tokenCache.get(cacheKey);
  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return cached.token;
  }
  const binBuffer = await readBinFile({ user, tokenId });
  if (!binBuffer) {
    throw new GameCommandError("未找到对应 BIN 文件，请先上传 BIN", {
      status: 404,
      code: "BIN_FILE_NOT_FOUND",
    });
  }
  const decoded = await decodeAuthPayloadToToken(binBuffer, { fetchImpl });
  const parsed = (() => {
    try {
      const json = JSON.parse(decoded);
      return String(json?.token || json?.gameToken || decoded).trim();
    } catch {
      return String(decoded || "").trim();
    }
  })();
  if (!parsed || parsed.length < 10) {
    throw new GameCommandError("BIN 转换 token 失败", {
      status: 502,
      code: "GAME_TOKEN_DECODE_FAILED",
    });
  }
  tokenCache.set(cacheKey, {
    token: parsed,
    expiresAt: now + TOKEN_CACHE_TTL_MS,
  });
  return parsed;
};

const connectGameWs = async ({ token, WebSocketImpl = WebSocket }) => {
  const url = `wss://xxz-xyzw.hortorgames.com/agent?p=${encodeURIComponent(token)}&e=x&lang=chinese`;
  const ws = new WebSocketImpl(url);
  const state = {
    ack: 0,
    seq: 1,
    waitersByResp: new Map(),
    waitersByCmd: new Map(),
    ws,
  };
  ws.binaryType = "arraybuffer";
  ws.on("message", (raw) => {
    try {
      const msg = g_utils.parse(raw);
      if (msg?.seq) state.ack = msg.seq;
      const data = msg.getData();
      const code = Number(msg?.code);
      const error = Number.isFinite(code) && code !== 0
        ? new Error(`服务器错误: ${code} - ${String(msg?.hint || "未知错误")}`)
        : null;
      const resp = Number(msg?.resp);
      const settle = (waiter) => {
        if (!waiter || waiter.settled) return;
        waiter.settled = true;
        clearTimeout(waiter.timeoutId);
        waiter.cleanup?.();
        if (error) waiter.reject(error);
        else waiter.resolve(data);
      };
      if (Number.isFinite(resp) && state.waitersByResp.has(resp)) {
        settle(state.waitersByResp.get(resp));
        return;
      }
      const cmd = String(msg?.cmd || "").toLowerCase();
      const queue = state.waitersByCmd.get(cmd);
      if (Array.isArray(queue) && queue.length > 0) {
        settle(queue.shift());
        if (queue.length === 0) state.waitersByCmd.delete(cmd);
      }
    } catch {
      // Ignore malformed game frames; pending command timeout will handle it.
    }
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("WebSocket 连接超时")), WS_CONNECT_TIMEOUT_MS);
    ws.once("open", () => {
      clearTimeout(timeout);
      resolve();
    });
    ws.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
  return state;
};

const closeGameWs = async (state) => {
  if (!state?.ws) return;
  await new Promise((resolve) => {
    const done = () => resolve();
    state.ws.once?.("close", done);
    state.ws.close?.(1000, "done");
    setTimeout(done, 1200);
  });
};

const sendCommand = (state, cmd, body = {}, timeout = DEFAULT_TIMEOUT_MS) => {
  const respCmd = `${String(cmd).toLowerCase()}resp`;
  return new Promise((resolve, reject) => {
    const seq = state.seq++;
    const timeoutId = setTimeout(() => {
      state.waitersByResp.delete(seq);
      const queue = state.waitersByCmd.get(respCmd);
      if (Array.isArray(queue)) {
        const index = queue.findIndex((item) => item.seq === seq);
        if (index >= 0) queue.splice(index, 1);
      }
      reject(new Error(`命令超时: ${cmd}`));
    }, timeout);
    const waiter = {
      seq,
      resolve,
      reject,
      timeoutId,
      settled: false,
      cleanup: () => {
        state.waitersByResp.delete(seq);
        const queue = state.waitersByCmd.get(respCmd);
        if (!Array.isArray(queue)) return;
        const index = queue.findIndex((item) => item.seq === seq);
        if (index >= 0) queue.splice(index, 1);
        if (queue.length === 0) state.waitersByCmd.delete(respCmd);
      },
    };
    state.waitersByResp.set(seq, waiter);
    const queue = state.waitersByCmd.get(respCmd) || [];
    queue.push(waiter);
    state.waitersByCmd.set(respCmd, queue);
    state.ws.send(g_utils.encode({
      ack: state.ack || 0,
      body: g_utils.bon.encode(body || {}),
      cmd,
      seq,
      time: Date.now(),
    }, "x"));
  });
};

const withGameConnection = async ({ user, tokenId, fetchImpl, WebSocketImpl, fn }) => {
  const token = await getActualTokenByBin({ user, tokenId, fetchImpl });
  const state = await connectGameWs({ token, WebSocketImpl });
  try {
    return await fn(state);
  } finally {
    await closeGameWs(state);
  }
};

export const createGameCommandService = ({
  fetchImpl = fetch,
  WebSocketImpl = WebSocket,
} = {}) => {
  const executeAllowedCommand = async ({ user, tokenId, cmd, params = {}, timeout = DEFAULT_TIMEOUT_MS }) =>
    withGameConnection({
      user,
      tokenId,
      fetchImpl,
      WebSocketImpl,
      fn: (state) => sendCommand(state, cmd, params, timeout),
    });

  return {
    getCatalog() {
      return {
        features: GAME_FEATURE_ACTIONS.map(({ id, title, description }) => ({
          id,
          title,
          description,
          enabled: true,
        })),
        legionWar: { enabled: true, title: "军团战" },
        lineupAssistant: { enabled: true, title: "阵容助手" },
      };
    },

    async getSummary({ user, tokenId }) {
      const binBuffer = await readBinFile({ user, tokenId });
      if (!binBuffer) {
        return {
          tokenId,
          roleName: "",
          serverName: "",
          binAvailable: false,
          connectionStatus: "missing-bin",
          recommendedAction: "请先上传 BIN 文件",
        };
      }
      return {
        tokenId,
        roleName: "",
        serverName: "",
        binAvailable: true,
        connectionStatus: "ready",
        recommendedAction: "可以执行游戏功能",
      };
    },

    async runAction({ user, tokenId, actionId }) {
      const action = GAME_ACTION_BY_ID.get(actionId);
      if (!action) {
        throw new GameCommandError("不支持的游戏功能", {
          status: 400,
          code: "GAME_ACTION_NOT_ALLOWED",
        });
      }
      if (actionId === "team-challenge") {
        const result = await withGameConnection({
          user,
          tokenId,
          fetchImpl,
          WebSocketImpl,
          fn: async (state) => {
            const targets = await sendCommand(state, "arena_getareatarget", {}, 8_000);
            const targetId = pickArenaTargetId(targets);
            if (!targetId) {
              throw new GameCommandError("未找到可挑战目标", {
                status: 409,
                code: "ARENA_TARGET_NOT_FOUND",
              });
            }
            const battle = await sendCommand(state, "fight_startareaarena", { targetId }, 15_000);
            return { targetId, battle };
          },
        });
        return {
          actionId,
          status: "success",
          message: "竞技场挑战已发起",
          detail: stripSensitiveGamePayload(result),
        };
      }
      const data = await executeAllowedCommand({
        user,
        tokenId,
        cmd: action.command,
        params: {},
      });
      return {
        actionId,
        status: "success",
        message: "命令已发送",
        detail: stripSensitiveGamePayload(data),
      };
    },

    async getLegionWarSnapshot({ user, tokenId }) {
      const battlefield = await executeAllowedCommand({
        user,
        tokenId,
        cmd: "legion_getbattlefield",
        params: {},
      });
      return {
        battlefieldId: String(battlefield?.info?.battlefieldId || battlefield?.battlefieldId || ""),
        nodes: [],
        legions: [],
        rawSummary: stripSensitiveGamePayload(battlefield),
      };
    },

    async getLineups({ user, tokenId }) {
      const row = userPreferenceRepository.findByUserAndKey({
        userId: user.id,
        key: lineupPreferenceKey(tokenId),
      });
      const saved = normalizeSavedLineups(parseJsonPreference(row, { saved: [] }));
      return {
        currentFormation: null,
        saved,
      };
    },

    async saveLineups({ user, tokenId, saved }) {
      const normalized = normalizeSavedLineups({ saved });
      const ts = nowIso();
      userPreferenceRepository.upsert({
        userId: user.id,
        key: lineupPreferenceKey(tokenId),
        valueJson: JSON.stringify({ saved: normalized }),
        createdAt: ts,
        updatedAt: ts,
      });
      return {
        saved: normalized,
      };
    },

    async applyLineup({ user, tokenId, lineupId }) {
      const current = await this.getLineups({ user, tokenId });
      const lineup = current.saved.find((item) => item.id === lineupId);
      if (!lineup) {
        throw new GameCommandError("未找到阵容", {
          status: 404,
          code: "LINEUP_NOT_FOUND",
        });
      }
      const stages = [];
      if (lineup.teamId) {
        await executeAllowedCommand({
          user,
          tokenId,
          cmd: "presetteam_saveteam",
          params: { teamId: lineup.teamId },
          timeout: 8_000,
        });
        stages.push({ id: "formation", status: "success", message: "已切换预设阵容" });
      } else {
        stages.push({ id: "formation", status: "skipped", message: "该方案没有可直接切换的阵容槽位" });
      }
      return {
        lineupId,
        stages,
      };
    },

    executeAllowedCommand,
  };
};

export const gameCommandService = createGameCommandService();

export const normalizeGameCommandError = (error, fallbackMessage = "游戏功能执行失败") => {
  if (error instanceof GameCommandError) {
    return {
      status: error.status || 400,
      code: error.code || "GAME_COMMAND_FAILED",
      message: error.publicMessage || error.message || fallbackMessage,
    };
  }
  return {
    status: 400,
    code: "GAME_COMMAND_FAILED",
    message: sanitizeTaskControlLogMessage(error?.message || fallbackMessage),
  };
};
