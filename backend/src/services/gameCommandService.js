import crypto from "crypto";
import WebSocket from "ws";
import { nowIso } from "../db/sql.js";
import { readBinFile } from "./binStorageService.js";
import { userPreferenceRepository } from "../repositories/userPreferenceRepository.js";
import { sanitizeTaskControlLogMessage } from "./taskControlScheduler/taskControlSchedulerHelpers.js";
import { g_utils } from "../../../shared/bonProtocol.js";
import { gameReplayRenderService } from "./gameReplayRenderService.js";

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

const GAME_WORKBENCH_GROUPS = Object.freeze([
  { id: "operations", label: "运营", caption: "日常、活动和工具面板" },
  { id: "battle", label: "战斗", caption: "军团、切磋和竞技场" },
  { id: "analysis", label: "分析", caption: "榜单、资源和推演" },
]);

const GAME_WORKBENCH_MODULES = Object.freeze([
  {
    id: "daily",
    label: "日常",
    groupId: "operations",
    description: "阵容、日常任务、塔和挂机收益。",
    defaultSectionId: "daily",
    sections: [{ id: "daily", label: "日常", description: "阵容、任务和基础收益。" }],
  },
  {
    id: "legionOps",
    label: "军团",
    groupId: "battle",
    description: "俱乐部报名、签到和军团信息。",
    defaultSectionId: "club",
    sections: [{ id: "club", label: "俱乐部", description: "军团报名、签到、信息和车王。" }],
  },
  {
    id: "activity",
    label: "活动",
    groupId: "operations",
    description: "月任务、答题、皮肤和消耗进度。",
    defaultSectionId: "activity",
    sections: [{ id: "activity", label: "活动", description: "限时活动和阶段进度。" }],
  },
  {
    id: "tools",
    label: "工具",
    groupId: "operations",
    description: "箱子、鱼灵、招募、升星等辅助工具。",
    defaultSectionId: "tools",
    sections: [{ id: "tools", label: "工具", description: "高频助手面板集合。" }],
  },
  {
    id: "pvp",
    label: "PVP",
    groupId: "battle",
    description: "切磋、竞技场和回放渲染结果。",
    defaultSectionId: "fightPvp",
    sections: [
      { id: "fightPvp", label: "切磋", description: "切磋目标、结果和回放。" },
      { id: "arenaPvp", label: "竞技场", description: "竞技场目标和挑战结果。" },
    ],
  },
  {
    id: "dataAnalysis",
    label: "数据分析",
    groupId: "analysis",
    description: "榜单、资源变化、金鱼计算和十殿分析。",
    defaultSectionId: "rankGroup",
    sections: [
      { id: "rankGroup", label: "榜单", description: "区服、巅峰、俱乐部和黄金榜。" },
      { id: "resourceChanges", label: "资源变化", description: "资源流水和差异摘要。" },
      { id: "goldFishCalc", label: "金鱼计算", description: "金鱼资源估算。" },
      { id: "tenHall", label: "十殿", description: "十殿战斗分析。" },
    ],
  },
]);

const SECTION_MODULE_ID = new Map(
  GAME_WORKBENCH_MODULES.flatMap((module) =>
    module.sections.map((section) => [section.id, module.id])),
);

const makeMetric = (label, value, tone = "neutral") => ({ label, value: String(value), tone });
const makeActionRef = (id, label, enabled = true) => ({ id, label, enabled });

const SECTION_CARDS = Object.freeze({
  daily: [
    {
      id: "team-formation",
      type: "formation",
      title: "阵容",
      subtitle: "当前上阵与阵容槽概览",
      tone: "info",
      iconKey: "formation",
      metrics: [makeMetric("槽位", "--"), makeMetric("主将", "待刷新")],
      actions: [makeActionRef("power-switch", "刷新阵容")],
    },
    {
      id: "daily-task-status",
      type: "task",
      title: "日常任务",
      subtitle: "领取日常奖励并刷新任务状态",
      tone: "success",
      iconKey: "task",
      metrics: [makeMetric("完成", "--"), makeMetric("奖励", "可检查")],
      actions: [makeActionRef("daily-tasks", "领取日常奖励")],
    },
    {
      id: "tower-status",
      type: "helper",
      title: "咸将塔",
      subtitle: "塔层状态与挑战入口",
      tone: "warning",
      iconKey: "tower",
      metrics: [makeMetric("层数", "--"), makeMetric("状态", "待刷新")],
      actions: [makeActionRef("tower-challenge", "发起挑战")],
    },
    {
      id: "hangup-status",
      type: "helper",
      title: "挂机收益",
      subtitle: "挂机奖励领取和收益状态",
      tone: "info",
      iconKey: "reward",
      metrics: [makeMetric("收益", "待领取")],
      actions: [makeActionRef("idle-time", "领取挂机收益")],
    },
  ],
  club: [
    {
      id: "legion-match",
      type: "action",
      title: "俱乐部报名",
      subtitle: "军团赛报名状态",
      tone: "warning",
      iconKey: "club",
      metrics: [makeMetric("报名", "待检查")],
      actions: [makeActionRef("club-ranking", "报名")],
    },
    {
      id: "legion-signin",
      type: "action",
      title: "俱乐部签到",
      subtitle: "每日军团签到",
      tone: "success",
      iconKey: "checkin",
      metrics: [makeMetric("签到", "待检查")],
      actions: [makeActionRef("club-checkin", "签到")],
    },
    {
      id: "club-info",
      type: "list",
      title: "俱乐部信息",
      subtitle: "成员、排行和俱乐部摘要",
      tone: "info",
      iconKey: "info",
      metrics: [makeMetric("成员", "--"), makeMetric("活跃", "--")],
      actions: [makeActionRef("power-switch", "刷新信息")],
    },
    {
      id: "club-car-king",
      type: "rank",
      title: "俱乐部车王",
      subtitle: "车王活动摘要",
      tone: "neutral",
      iconKey: "rank",
      metrics: [makeMetric("排名", "--")],
      actions: [],
    },
  ],
  activity: [
    {
      id: "monthly-tasks",
      type: "task",
      title: "月任务",
      subtitle: "月度任务和阶段奖励",
      tone: "info",
      iconKey: "calendar",
      metrics: [makeMetric("进度", "--")],
      actions: [makeActionRef("daily-tasks", "刷新任务")],
    },
    {
      id: "study-challenge",
      type: "helper",
      title: "答题/研习",
      subtitle: "研习挑战状态",
      tone: "success",
      iconKey: "study",
      metrics: [makeMetric("题目", "--")],
      actions: [],
    },
    {
      id: "skin-challenge",
      type: "helper",
      title: "皮肤活动",
      subtitle: "皮肤挑战进度",
      tone: "warning",
      iconKey: "skin",
      metrics: [makeMetric("进度", "--")],
      actions: [],
    },
    {
      id: "consumption-progress",
      type: "chart",
      title: "消耗进度",
      subtitle: "活动消耗与阶段目标",
      tone: "info",
      iconKey: "chart",
      metrics: [makeMetric("消耗", "--")],
      actions: [],
    },
  ],
  tools: [
    {
      id: "bottle-helper",
      type: "helper",
      title: "盐罐助手",
      subtitle: "盐罐奖励领取",
      tone: "success",
      iconKey: "bottle",
      metrics: [makeMetric("状态", "可检查")],
      actions: [makeActionRef("salt-robot", "领取奖励")],
    },
    {
      id: "box-helper",
      type: "helper",
      title: "箱子助手",
      subtitle: "宝箱和资源辅助",
      tone: "info",
      iconKey: "box",
      metrics: [makeMetric("箱子", "--")],
      actions: [],
    },
    {
      id: "fish-helper",
      type: "helper",
      title: "鱼灵助手",
      subtitle: "鱼灵和鱼珠状态",
      tone: "info",
      iconKey: "fish",
      metrics: [makeMetric("鱼灵", "--")],
      actions: [],
    },
    {
      id: "recruit-helper",
      type: "helper",
      title: "招募助手",
      subtitle: "招募活动和资源",
      tone: "warning",
      iconKey: "recruit",
      metrics: [makeMetric("招募", "--")],
      actions: [],
    },
    {
      id: "star-upgrade",
      type: "helper",
      title: "升星助手",
      subtitle: "升星材料和目标",
      tone: "success",
      iconKey: "star",
      metrics: [makeMetric("材料", "--")],
      actions: [],
    },
    {
      id: "fight-helper",
      type: "pvp",
      title: "战斗助手",
      subtitle: "战斗前置状态",
      tone: "danger",
      iconKey: "battle",
      metrics: [makeMetric("战斗", "待命")],
      actions: [makeActionRef("team-challenge", "竞技场挑战")],
    },
    {
      id: "dream-helper",
      type: "helper",
      title: "梦境助手",
      subtitle: "梦境商店与战斗",
      tone: "info",
      iconKey: "dream",
      metrics: [makeMetric("梦境", "--")],
      actions: [],
    },
    {
      id: "hero-upgrade",
      type: "helper",
      title: "武将升级",
      subtitle: "武将升级和材料",
      tone: "success",
      iconKey: "hero",
      metrics: [makeMetric("武将", "--")],
      actions: [],
    },
    {
      id: "refine-helper",
      type: "helper",
      title: "淬炼助手",
      subtitle: "淬炼条件和装备槽",
      tone: "warning",
      iconKey: "refine",
      metrics: [makeMetric("槽位", "--")],
      actions: [],
    },
    {
      id: "boss-tower",
      type: "helper",
      title: "Boss 塔",
      subtitle: "Boss 塔状态",
      tone: "danger",
      iconKey: "boss",
      metrics: [makeMetric("状态", "--")],
      actions: [],
    },
  ],
  fightPvp: [
    {
      id: "fight-pvp-target",
      type: "pvp",
      title: "切磋目标",
      subtitle: "对手信息、阵容和战力",
      tone: "danger",
      iconKey: "pvp",
      metrics: [makeMetric("目标", "待选择"), makeMetric("胜率", "--")],
      actions: [makeActionRef("team-challenge", "发起切磋")],
    },
    {
      id: "fight-pvp-replay",
      type: "replay",
      title: "回放渲染",
      subtitle: "后端生成回放截图和诊断",
      tone: "info",
      iconKey: "replay",
      metrics: [makeMetric("渲染", "待生成")],
      actions: [makeActionRef("render-replay", "生成渲染图")],
    },
  ],
  arenaPvp: [
    {
      id: "arena-targets",
      type: "pvp",
      title: "竞技场目标",
      subtitle: "目标参考、挑战结果和历史记录",
      tone: "danger",
      iconKey: "arena",
      metrics: [makeMetric("目标", "--"), makeMetric("积分", "--")],
      actions: [makeActionRef("team-challenge", "挑战目标")],
    },
  ],
  rankGroup: [
    {
      id: "rank-server",
      type: "rank",
      title: "区服榜",
      subtitle: "区服排行和巅峰榜入口",
      tone: "info",
      iconKey: "rank",
      metrics: [makeMetric("榜单", "区服")],
      actions: [],
    },
    {
      id: "rank-club",
      type: "rank",
      title: "俱乐部榜",
      subtitle: "俱乐部、黄金积分和大路榜",
      tone: "success",
      iconKey: "club-rank",
      metrics: [makeMetric("榜单", "俱乐部")],
      actions: [],
    },
  ],
  resourceChanges: [
    {
      id: "resource-change",
      type: "list",
      title: "资源变化",
      subtitle: "资源流水、差值和趋势",
      tone: "info",
      iconKey: "resource",
      metrics: [makeMetric("记录", "--")],
      actions: [],
    },
  ],
  goldFishCalc: [
    {
      id: "gold-fish-calc",
      type: "chart",
      title: "金鱼计算",
      subtitle: "金鱼资源和投入估算",
      tone: "warning",
      iconKey: "calculator",
      metrics: [makeMetric("估算", "待输入")],
      actions: [],
    },
  ],
  tenHall: [
    {
      id: "ten-hall-team-battle",
      type: "pvp",
      title: "十殿战斗",
      subtitle: "十殿队伍和战斗分析",
      tone: "danger",
      iconKey: "ten-hall",
      metrics: [makeMetric("队伍", "--")],
      actions: [],
    },
  ],
});

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
  replayRenderService = gameReplayRenderService,
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

    getWorkbenchCatalog() {
      return {
        groups: GAME_WORKBENCH_GROUPS,
        modules: GAME_WORKBENCH_MODULES,
        defaultModuleId: "daily",
        defaultSectionId: "daily",
      };
    },

    async getWorkbenchBootstrap({ user, tokenId }) {
      const summary = await this.getSummary({ user, tokenId });
      return {
        tokenId,
        roleName: summary.roleName || "",
        serverName: summary.serverName || "",
        binAvailable: Boolean(summary.binAvailable),
        connectionStatus: summary.connectionStatus || "unknown",
        selectedModuleId: "daily",
        selectedSectionId: "daily",
        recommendation: summary.recommendedAction || "检查连接状态",
        groups: GAME_WORKBENCH_GROUPS,
        modules: GAME_WORKBENCH_MODULES,
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

    async getWorkbenchSection({ user, tokenId, sectionId }) {
      const normalizedSectionId = String(sectionId || "daily").trim() || "daily";
      const moduleId = SECTION_MODULE_ID.get(normalizedSectionId);
      if (!moduleId) {
        throw new GameCommandError("不支持的游戏功能分区", {
          status: 400,
          code: "GAME_WORKBENCH_SECTION_NOT_ALLOWED",
        });
      }
      const summary = await this.getSummary({ user, tokenId });
      const cards = (SECTION_CARDS[normalizedSectionId] || []).map((card) => ({
        ...card,
        status: summary.binAvailable ? "ready" : "disabled",
        actions: (card.actions || []).map((action) => ({
          ...action,
          enabled: Boolean(action.enabled) && Boolean(summary.binAvailable),
        })),
      }));
      const module = GAME_WORKBENCH_MODULES.find((item) => item.id === moduleId) || null;
      const section = module?.sections?.find((item) => item.id === normalizedSectionId) || null;
      return {
        tokenId,
        moduleId,
        sectionId: normalizedSectionId,
        title: section?.label || normalizedSectionId,
        subtitle: section?.description || "",
        status: summary.binAvailable ? "ready" : "missing-bin",
        cards,
        updatedAt: nowIso(),
      };
    },

    async runWorkbenchAction({ user, tokenId, actionId, sectionId = "", cardId = "", payload = {} }) {
      const result = await this.runAction({ user, tokenId, actionId });
      return {
        ...result,
        sectionId,
        cardId,
        payload: stripSensitiveGamePayload(payload),
      };
    },

    async renderWorkbenchReplay({ user, tokenId, payload = {} }) {
      return replayRenderService.renderReplay({ user, tokenId, payload });
    },

    async getRenderedReplayImage({ user, renderId }) {
      return replayRenderService.getRenderedReplayImage({ user, renderId });
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

    async broadcastLegionWarReviveInfo({ user, tokenId, legions = [] }) {
      const normalizedLegions = Array.isArray(legions)
        ? legions
          .map((item) => ({
            name: String(item?.name || item?.id || "").trim().slice(0, 60),
            reviveLeft: Number(item?.reviveLeft ?? item?.revive ?? 0),
          }))
          .filter((item) => item.name)
          .slice(0, 20)
        : [];
      if (!normalizedLegions.length) {
        throw new GameCommandError("没有可发送的战队免费复活信息", {
          status: 400,
          code: "LEGION_WAR_BROADCAST_EMPTY",
        });
      }
      const messages = [];
      for (let i = 0; i < normalizedLegions.length; i += 10) {
        const content = normalizedLegions
          .slice(i, i + 10)
          .map((item) => `${item.name}:剩${Number.isFinite(item.reviveLeft) ? item.reviveLeft : 0}`)
          .join("\n");
        if (content) messages.push(content);
      }
      await withGameConnection({
        user,
        tokenId,
        fetchImpl,
        WebSocketImpl,
        fn: async (state) => {
          for (const message of messages) {
            await sendCommand(
              state,
              "system_sendchatmessage",
              {
                channel: 2,
                emojiId: 0,
                extra: null,
                msg: message,
                msgType: 1,
              },
              8_000,
            );
          }
        },
      });
      return {
        status: "success",
        sentCount: messages.length,
        messages,
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
