<template>
  <div class="fight-pvp-container">
    <!-- 主卡片容器 -->
    <div class="status-card main-card">
      <!-- 卡片头部 -->
      <div class="card-header">
        <img
          class="status-icon"
          src="/icons/Ob7pyorzmHiJcbab2c25af264d0758b527bc1b61cc3b.png"
          :alt="t('fightPvpCard.iconAlt')"
        >
        <div class="status-info">
          <h3>{{ t("fightPvpCard.title") }}</h3>
          <p>{{ t("fightPvpCard.subtitle") }}</p>
        </div>
      </div>

      <FightPvpToolbar
        v-model:fight-num="fightNum"
        v-model:target-id="targetId"
        :has-member-data="Boolean(memberData)"
        :has-target-raw-info="Boolean(lastTargetRawInfo)"
        :loading="loading1"
        :options="options"
        :t="t"
        @export-data="handleExport1"
        @export-raw="exportCurrentTargetRawData"
        @normalize-fight-num="handleFightNumChange"
        @query-target="getTargetInfo"
        @start-fight="fightPVPRefresh"
      ></FightPvpToolbar>

      <FightPvpHistoryPanel
        v-model:active-tab="activeTargetListTab"
        :format-updated-at="formatUpdatedAt"
        :loading="loading1"
        :records="currentTabRecords"
        :syncing="syncingTargetLists"
        :t="t"
        @clear="clearCurrentTabRecords"
        @remove="removeCurrentTabRecord"
        @sync="syncTargetListsFromGame"
        @use-target="useHistoryTarget"
      ></FightPvpHistoryPanel>

      <!-- 加载状态 -->
      <div v-if="loading1" class="loading-section">
        <n-spin size="large">
          <template #description>
            {{ loadingText }}
          </template>
        </n-spin>
      </div>

      <!-- 对手信息卡片 -->
      <div ref="exportDom" v-else-if="memberData" class="content-section">
        <FightPvpTargetPanel
          :member-data="memberData"
          :t="t"
          @select-hero="selectHeroInfo"
        ></FightPvpTargetPanel>

        <FightPvpResultPanel
          v-if="fightResult"
          :battle-detail-export-mode="battleDetailExportMode"
          :fight-num="fightNum"
          :fight-result="fightResult"
          :set-export-ref="setBattleDetailExportRef"
          :t="t"
          @export="handleExport1"
        ></FightPvpResultPanel>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <n-empty :description="t('fightPvpCard.empty.prompt')"></n-empty>
      </div>
    </div>

    <FightPvpHeroDetailModal
      v-model:show="showHeroModal"
      :get-equipment-quench-slots="getEquipmentQuenchSlots"
      :hero="heroModealTemp"
      :is-orange-quench-slot="isOrangeQuenchSlot"
      :is-red-quench-slot="isRedQuenchSlot"
      :t="t"
    ></FightPvpHeroDetailModal>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import { useAuthStore } from "@/stores/auth";
import api from "@/api";
import FightPvpHeroDetailModal from "@/components/cards/pvp/FightPvpHeroDetailModal.vue";
import FightPvpHistoryPanel from "@/components/cards/pvp/FightPvpHistoryPanel.vue";
import FightPvpResultPanel from "@/components/cards/pvp/FightPvpResultPanel.vue";
import FightPvpTargetPanel from "@/components/cards/pvp/FightPvpTargetPanel.vue";
import FightPvpToolbar from "@/components/cards/pvp/FightPvpToolbar.vue";
import {
  loadFightHistoryFromLocalStorage,
  loadFightTargetListsFromLocalStorage,
  loadFightTargetSyncDiagnosticFromLocalStorage,
  saveFightHistoryToLocalStorage,
  saveFightTargetListsToLocalStorage,
  saveFightTargetSyncDiagnosticToLocalStorage,
} from "@/services/preferences/fightPvpStorage";
import { useFightPvpActions } from "@/composables/useFightPvpActions";
import { useFightPvpTargetSync } from "@/composables/useFightPvpTargetSync";
import {
  countFightPvpPearlOrangeSlots,
  formatFightPvpPower,
  formatFightPvpUpdatedAt,
  getFightPvpEquipmentQuenchSlots,
  isFightPvpOrangeQuenchSlot,
  isFightPvpRedQuenchSlot,
} from "@/components/cards/pvp/fightPvpFormatters";
import { triggerBlobDownload } from "@/utils/download";

import {
  gettoday,
} from "@/utils/goldWarrankUtils";
import {
  formatWeapon,
  getLineupType,
  HERO_DICT,
  HeroFillInfo,
} from "@/utils/HeroList";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import {
  downloadCanvasAsImage,
} from "@/utils/imageExport";

const props = defineProps({
  visible: {
    type: Boolean,
    default: false,
  },
  inline: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["update:visible"]);

const message = useMessage();
const { locale, t } = useI18n();
const tokenStore = useTokenStore();
const authStore = useAuthStore();

const showModal = computed({
  get: () => props.visible,
  set: (val) => emit("update:visible", val),
});

const exportDom = ref(null);
const battleDetailExportRef = ref(null);
const setBattleDetailExportRef = (element) => {
  battleDetailExportRef.value = element;
};
const battleDetailExportMode = ref(false);
const loading1 = ref(false);
const loadingText = ref("");
const topranklist = ref(null);
const expandedMembers = ref(new Set());
const roleIdinput = ref("");
const queryDate = ref("");
const targetId = ref("");
const teamArray = ref(null);
// 切磋对手信息
const memberData = ref(null);
// 批量数量
const fightNum = ref(1);
// 战斗结果
const fightResult = ref(null);
const FIGHT_HISTORY_STORAGE_KEY = "fight_pvp_history_v1";
const FIGHT_HISTORY_PREF_KEY = "fight_pvp_history_v1";
const FIGHT_TARGET_LISTS_STORAGE_KEY = "fight_pvp_target_lists_v1";
const FIGHT_TARGET_LISTS_PREF_KEY = "fight_pvp_target_lists_v1";
const FIGHT_TARGET_LIST_SYNC_DIAGNOSTIC_STORAGE_KEY
  = "fight_pvp_target_sync_diagnostic_v1";
const FIGHT_HISTORY_MAX_COUNT = 50;
const fightHistoryRecords = ref([]);
const lastTargetRawInfo = ref(null);
const targetLists = ref({
  friends: [],
  follows: [],
});
const targetListSyncDiagnostic = ref(null);
const activeTargetListTab = ref("history");
const syncingTargetLists = ref(false);
const isFightHistorySyncReady = ref(false);
const isTargetListsSyncReady = ref(false);
let fightHistorySyncTimer = null;
let targetListsSyncTimer = null;

const GAME_TARGET_LIST_BASE_CMD_CANDIDATES = [
  { cmd: "role_getroleinfo", params: {} },
  { cmd: "friend_batch", params: { friendId: 0 } },
  { cmd: "friend_batch", params: { type: 0 } },
  { cmd: "friend_batch", params: { type: 1 } },
  { cmd: "friend_batch", params: { listType: 0 } },
  { cmd: "friend_batch", params: { listType: 1 } },
  { cmd: "friend_batch", params: { tab: 0 } },
  { cmd: "friend_batch", params: { tab: 1 } },
];

const GAME_TARGET_LIST_FOLLOW_BATCH_CMD_CANDIDATES = [
  { cmd: "friend_batch", params: { type: 2 } },
  { cmd: "friend_batch", params: { type: 3 } },
  { cmd: "friend_batch", params: { listType: 2 } },
  { cmd: "friend_batch", params: { listType: 3 } },
  { cmd: "friend_batch", params: { tab: 2 } },
  { cmd: "friend_batch", params: { tab: 3 } },
];

const GAME_TARGET_LIST_FOLLOW_PROBE_CMD_CANDIDATES = [
  { cmd: "friend_getfollowlist", params: {} },
  { cmd: "friend_getattentionlist", params: {} },
  { cmd: "friend_getfollowerlist", params: {} },
];

// 监听targetId变化，清除之前的切磋结果
watch(targetId, (newId, oldId) => {
  if (newId !== oldId) {
    fightResult.value = null;
  }
});
// 模态框控制符
const showHeroModal = ref(false);
// 选中的武将信息
const heroModealTemp = ref(null);
const options = [
  {
    label: "1",
    value: 1,
  },
  {
    label: "10",
    value: 10,
  },
  {
    label: "25",
    value: 25,
  },
  {
    label: "50",
    value: 50,
  },
];
loadingText.value = t("fightPvpCard.messages.loadingTarget");
const player_date = { name: "", power: "" };

const normalizeFightHistoryRecord = (record) => {
  const normalizedId = String(record?.id || "").trim();
  if (!normalizedId)
    return null;

  return {
    id: normalizedId,
    name: record?.name || t("fightPvpCard.common.unknownPlayer"),
    red: Number(record?.red) || 0,
    headImg: record?.headImg || "",
    serverName: record?.serverName || t("fightPvpCard.common.unknown"),
    updatedAt: Number(record?.updatedAt) || Date.now(),
  };
};

const mergeFightRecord = (existing, incoming) => {
  if (!existing)
    return incoming;
  if (!incoming)
    return existing;

  const incomingName = String(incoming.name || "").trim();
  const existingName = String(existing.name || "").trim();
  const incomingServerName = String(incoming.serverName || "").trim();
  const existingServerName = String(existing.serverName || "").trim();

  return {
    ...existing,
    ...incoming,
    // 避免“未知值”覆盖已有信息
    name:
      incomingName && incomingName !== t("fightPvpCard.common.unknownPlayer")
        ? incomingName
        : existingName || t("fightPvpCard.common.unknownPlayer"),
    serverName:
      incomingServerName && incomingServerName !== t("fightPvpCard.common.unknown")
        ? incomingServerName
        : existingServerName || t("fightPvpCard.common.unknown"),
    headImg: incoming.headImg || existing.headImg || "",
    // 关键：同步数据里 red 常为空，避免用 0 覆盖已有有效红数
    red: Math.max(Number(existing.red) || 0, Number(incoming.red) || 0),
    updatedAt: Math.max(
      Number(existing.updatedAt) || 0,
      Number(incoming.updatedAt) || 0,
    ),
  };
};

const sanitizeFightHistoryRecords = (records) => {
  if (!Array.isArray(records))
    return [];

  const dedup = new Map();
  for (const item of records) {
    const normalized = normalizeFightHistoryRecord(item);
    if (!normalized)
      continue;
    const existing = dedup.get(normalized.id);
    dedup.set(normalized.id, mergeFightRecord(existing, normalized));
  }

  return [...dedup.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, FIGHT_HISTORY_MAX_COUNT);
};

const mergeFightHistoryRecords = (sourceA, sourceB) =>
  sanitizeFightHistoryRecords([...(sourceA || []), ...(sourceB || [])]);

const sanitizeTargetLists = (data) => ({
  friends: sanitizeFightHistoryRecords(data?.friends || []),
  follows: sanitizeFightHistoryRecords(data?.follows || []),
});

const mergeTargetLists = (sourceA, sourceB) => ({
  friends: sanitizeFightHistoryRecords([
    ...(sourceA?.friends || []),
    ...(sourceB?.friends || []),
  ]),
  follows: sanitizeFightHistoryRecords([
    ...(sourceA?.follows || []),
    ...(sourceB?.follows || []),
  ]),
});

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRoleIdFromObject = (obj) =>
  obj?.roleId
  ?? obj?.id
  ?? obj?.uid
  ?? obj?.targetId
  ?? obj?.friendId
  ?? obj?.playerId
  ?? null;

const getRoleNameFromObject = (obj) =>
  obj?.name ?? obj?.roleName ?? obj?.nickName ?? obj?.nickname ?? "";

const getServerFromObject = (obj) =>
  obj?.serverName
  ?? obj?.server
  ?? (obj?.serverId ? `${obj.serverId}` : t("fightPvpCard.common.unknown"));

const getHeadImgFromObject = (obj) =>
  obj?.headImg ?? obj?.avatar ?? obj?.head ?? "";

const getRedFromObject = (obj) =>
  Number(obj?.red ?? obj?.redQuench ?? obj?.redCount ?? 0) || 0;

const formatUpdatedAt = (updatedAt) =>
  formatFightPvpUpdatedAt(
    updatedAt,
    typeof locale?.value === "string" ? locale.value : undefined,
  );

const getQuenchColorLevel = (quench) => {
  const normalizeColorText = (value) => {
    const t = String(value).trim().toLowerCase();
    if (t === "red" || t === "红色" || t === "红")
      return 6;
    if (t === "orange" || t === "橙色" || t === "橙")
      return 5;
    if (t === "purple" || t === "紫色" || t === "紫")
      return 4;
    if (t === "blue" || t === "蓝色" || t === "蓝")
      return 3;
    if (t === "green" || t === "绿色" || t === "绿")
      return 2;
    if (t === "white" || t === "白色" || t === "白")
      return 1;
    return 0;
  };

  const toNumericLevel = (value) => {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0)
      return n;
    return normalizeColorText(value);
  };

  const extractColorLevelDeep = (node, depth = 0) => {
    if (node == null || depth > 2)
      return 0;

    if (typeof node === "number" || typeof node === "string") {
      return toNumericLevel(node);
    }

    if (Array.isArray(node)) {
      for (const item of node) {
        const level = extractColorLevelDeep(item, depth + 1);
        if (level > 0)
          return level;
      }
      return 0;
    }

    if (typeof node !== "object")
      return 0;

    const direct = toNumericLevel(
      node?.colorId
      ?? node?.color
      ?? node?.attrColorId
      ?? node?.slotColorId
      ?? node?.quality
      ?? node?.quenchColorId
      ?? node?.attr?.colorId
      ?? node?.attr?.color
      ?? 0,
    );
    if (direct > 0)
      return direct;

    for (const [key, value] of Object.entries(node)) {
      const lowerKey = String(key).toLowerCase();
      if (
        lowerKey.includes("color")
        || lowerKey.includes("quality")
        || lowerKey.includes("grade")
        || lowerKey.includes("rank")
      ) {
        const level = extractColorLevelDeep(value, depth + 1);
        if (level > 0)
          return level;
      }
    }

    for (const value of Object.values(node)) {
      if (value && typeof value === "object") {
        const level = extractColorLevelDeep(value, depth + 1);
        if (level > 0)
          return level;
      }
    }

    return 0;
  };

  if (typeof quench === "number" || typeof quench === "string") {
    return toNumericLevel(quench);
  }

  return extractColorLevelDeep(quench);
};

const toNonEmptyMap = (value) =>
  value && typeof value === "object" && Object.keys(value).length ? value : null;

const parseQuenchCollection = (value) => {
  if (!value)
    return [];

  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined && item !== null);
  }

  if (typeof value === "string") {
    const text = value.trim();
    if (!text || (text[0] !== "{" && text[0] !== "["))
      return [];
    try {
      return parseQuenchCollection(JSON.parse(text));
    } catch (error) {
      return [];
    }
  }

  if (typeof value === "object") {
    return Object.values(value).filter((item) => item !== undefined && item !== null);
  }

  return [];
};

const detectQuenchPalette = (levels) => {
  const normalized = (levels || [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
  const hasLevel5 = normalized.includes(5);
  const hasLevel7OrAbove = normalized.some((item) => item >= 7);

  // 兼容另一套色阶：6=橙，7=红
  if (!hasLevel5 && hasLevel7OrAbove) {
    return { orangeLevel: 6, redThreshold: 7 };
  }

  // 默认色阶：5=橙，6=红
  return { orangeLevel: 5, redThreshold: 6 };
};

const getEquipmentPalette = (equipment) => {
  const levels = [];
  for (const equ of Object.values(equipment || {})) {
    const quenchMap = getEffectiveQuenchMap(equ);
    if (!quenchMap)
      continue;
    for (const slot of parseQuenchCollection(quenchMap)) {
      const level = getQuenchColorLevel(slot);
      if (level > 0)
        levels.push(level);
    }
  }
  return detectQuenchPalette(levels);
};

const getQuenchCollectionScore = (slots) => {
  if (!Array.isArray(slots) || slots.length === 0)
    return 0;
  const colorScore = slots.filter((slot) => getQuenchColorLevel(slot) > 0).length;
  return colorScore * 10 + slots.length;
};

const getEffectiveQuenchMap = (equip) => {
  if (!equip || typeof equip !== "object")
    return null;

  const primary = toNonEmptyMap(equip.quenches);
  const secondary = toNonEmptyMap(equip.quenches2);
  const curQuenchId = Number(equip.curQuenchId || 0);

  if (curQuenchId === 2 && secondary)
    return secondary;
  if ((curQuenchId === 1 || curQuenchId === 0) && primary)
    return primary;
  if (primary && !secondary)
    return primary;
  if (secondary && !primary)
    return secondary;
  if (!primary && !secondary)
    return null;

  const primarySlots = parseQuenchCollection(primary);
  const secondarySlots = parseQuenchCollection(secondary);
  return getQuenchCollectionScore(primarySlots)
    >= getQuenchCollectionScore(secondarySlots)
    ? primary
    : secondary;
};

const getEquipmentQuenchSlots = getFightPvpEquipmentQuenchSlots;
const isRedQuenchSlot = isFightPvpRedQuenchSlot;
const isOrangeQuenchSlot = isFightPvpOrangeQuenchSlot;
const countPearlOrangeSlots = countFightPvpPearlOrangeSlots;

const calculateRedCountFromHeroes = (heroes) => {
  if (!heroes || typeof heroes !== "object")
    return 0;

  let redCount = 0;
  for (const hero of Object.values(heroes)) {
    if (!hero?.equipment || typeof hero.equipment !== "object")
      continue;
    const palette = getEquipmentPalette(hero.equipment);
    for (const equipment of Object.values(hero.equipment)) {
      const quenchMap = getEffectiveQuenchMap(equipment);
      if (!quenchMap)
        continue;
      for (const quench of parseQuenchCollection(quenchMap)) {
        if (getQuenchColorLevel(quench) >= palette.redThreshold)
          redCount += 1;
      }
    }
  }
  return redCount;
};

const toFightRecord = (obj) => {
  if (!obj || typeof obj !== "object")
    return null;

  const hasStrongRoleId
    = obj?.roleId !== undefined
      || obj?.uid !== undefined
      || obj?.targetId !== undefined
      || obj?.friendId !== undefined
      || obj?.playerId !== undefined;
  const hasProfileLikeFields
    = !!(
      obj?.name
      || obj?.roleName
      || obj?.nickName
      || obj?.nickname
      || obj?.headImg
      || obj?.avatar
      || obj?.serverId
      || obj?.serverName
    );
  // 避免把 avatarFrame/customCard 这类仅含 id 的子对象误识别为角色
  if (!hasStrongRoleId && !hasProfileLikeFields)
    return null;

  const rawId = getRoleIdFromObject(obj);
  const id = rawId === null || rawId === undefined ? "" : String(rawId).trim();
  if (!id)
    return null;

  return {
    id,
    name: getRoleNameFromObject(obj) || t("fightPvpCard.common.unknownPlayer"),
    serverName: getServerFromObject(obj),
    headImg: getHeadImgFromObject(obj),
    red: getRedFromObject(obj),
    updatedAt: Date.now(),
  };
};

const extractRecordsByHints = (payload, hints = [], options = {}) => {
  const { requireHint = false } = options;
  const candidates = [];
  const visit = (node, path = "") => {
    const lowerPath = path.toLowerCase();
    const hasHint
      = hints.length === 0 || hints.some((hint) => lowerPath.includes(hint));

    if (Array.isArray(node)) {
      const records = sanitizeFightHistoryRecords(node.map((item) => toFightRecord(item)));
      if (records.length > 0 && (!requireHint || hasHint)) {
        let score = records.length;
        for (const hint of hints) {
          if (lowerPath.includes(hint))
            score += 100;
        }
        candidates.push({ records, score });
      }
      for (let i = 0; i < node.length; i += 1) {
        visit(node[i], `${path}[${i}]`);
      }
      return;
    }

    if (node && typeof node === "object") {
      const objectValues = Object.values(node);
      if (objectValues.length > 0) {
        const records = sanitizeFightHistoryRecords(
          objectValues
            .filter(
              (item) =>
                item
                && typeof item === "object"
                && !Array.isArray(item)
                && toFightRecord(item),
            )
            .map((item) => toFightRecord(item)),
        );
        if (records.length > 0 && (!requireHint || hasHint)) {
          let score = records.length;
          for (const hint of hints) {
            if (lowerPath.includes(hint))
              score += 100;
          }
          candidates.push({ records, score });
        }
      }

      Object.entries(node).forEach(([key, val]) => {
        const nextPath = path ? `${path}.${key}` : key;
        visit(val, nextPath);
      });
    }
  };

  visit(payload, "");
  if (!candidates.length)
    return [];
  candidates.sort((a, b) => b.score - a.score);
  return candidates[0].records;
};

const hasFollowMarker = (obj) => {
  if (!obj || typeof obj !== "object")
    return false;
  const entries = Object.entries(obj);
  const markerKeys = [
    "follow",
    "attention",
    "focus",
    "subscribe",
    "follower",
    "fans",
    "care",
    "concern",
  ];

  for (const [key, value] of entries) {
    const lowerKey = String(key).toLowerCase();
    if (!markerKeys.some((marker) => lowerKey.includes(marker)))
      continue;

    if (typeof value === "boolean" && value)
      return true;
    if (typeof value === "number" && value > 0)
      return true;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (
        normalized === "1"
        || normalized === "true"
        || normalized === "yes"
        || normalized === "follow"
      ) {
        return true;
      }
    }
  }

  return false;
};

const extractGameTargetLists = (payload) => {
  const friends = extractRecordsByHints(
    payload,
    ["friend", "friends", "buddy"],
    { requireHint: true },
  );
  const follows = extractRecordsByHints(payload, [
    "follow",
    "attention",
    "focus",
    "subscribe",
    "follower",
    "fans",
    "care",
    "concern",
  ], {
    requireHint: true,
  });

  if (follows.length === 0 && payload?.friendList && typeof payload.friendList === "object") {
    const followFromFriendList = sanitizeFightHistoryRecords(
      Object.values(payload.friendList)
        .filter((item) => hasFollowMarker(item))
        .map((item) => toFightRecord(item)),
    );
    if (followFromFriendList.length > 0) {
      return { friends, follows: followFromFriendList };
    }
  }

  return { friends, follows };
};

const buildDiagnosticSnapshot = (
  value,
  depth = 0,
  seen = new WeakSet(),
  maxDepth = 2,
  maxKeys = 16,
) => {
  if (value == null)
    return value;

  if (typeof value === "string") {
    return value.length > 120 ? `${value.slice(0, 120)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean")
    return value;
  if (typeof value === "bigint")
    return value.toString();
  if (typeof value === "function")
    return "[Function]";
  if (depth >= maxDepth)
    return "[MaxDepth]";

  if (Array.isArray(value)) {
    const sliced = value.slice(0, 6);
    return sliced.map((item) =>
      buildDiagnosticSnapshot(item, depth + 1, seen, maxDepth, maxKeys),
    );
  }

  if (typeof value === "object") {
    if (seen.has(value))
      return "[Circular]";
    seen.add(value);

    const keys = Object.keys(value);
    const out = {};
    keys.slice(0, maxKeys).forEach((key) => {
      out[key] = buildDiagnosticSnapshot(
        value[key],
        depth + 1,
        seen,
        maxDepth,
        maxKeys,
      );
    });
    if (keys.length > maxKeys) {
      out.__trimmedKeys = keys.length - maxKeys;
    }
    return out;
  }

  return String(value);
};

const buildTargetListSyncAttemptDiagnostic = (payload) => {
  const isObjectPayload = payload && typeof payload === "object";
  const topKeys = isObjectPayload ? Object.keys(payload).slice(0, 30) : [];
  return {
    topKeys,
    snapshot: buildDiagnosticSnapshot(payload),
    roleLikeCollections: collectRoleLikeCollections(payload),
  };
};

const collectRoleLikeCollections = (payload) => {
  const collections = [];
  const visit = (node, path = "") => {
    if (!node)
      return;

    if (Array.isArray(node)) {
      const records = sanitizeFightHistoryRecords(node.map((item) => toFightRecord(item)));
      if (records.length > 0) {
        const sampleRaw = node.find((item) => toFightRecord(item));
        collections.push({
          path: path || "<root-array>",
          kind: "array",
          count: records.length,
          sampleRecord: records[0],
          sampleRaw: buildDiagnosticSnapshot(sampleRaw, 0, new WeakSet(), 4),
        });
      }
      node.forEach((item, index) => visit(item, `${path}[${index}]`));
      return;
    }

    if (typeof node === "object") {
      const entries = Object.entries(node);
      const objectValues = entries.map(([, val]) => val);
      const recordEntries = entries.filter(([, val]) => toFightRecord(val));
      if (recordEntries.length > 0) {
        const [sampleKey, sampleValue] = recordEntries[0];
        const records = sanitizeFightHistoryRecords(
          objectValues
            .filter((item) => toFightRecord(item))
            .map((item) => toFightRecord(item)),
        );
        collections.push({
          path: path || "<root-map>",
          kind: "map",
          count: records.length,
          sampleKey,
          sampleRecord: records[0],
          sampleRaw: buildDiagnosticSnapshot(
            sampleValue,
            0,
            new WeakSet(),
            5,
            80,
          ),
          sampleEntries:
            path.toLowerCase().includes("friendlist") && recordEntries.length > 1
              ? recordEntries.slice(0, 3).map(([key, value]) => ({
                  key,
                  raw: buildDiagnosticSnapshot(value, 0, new WeakSet(), 3, 40),
                }))
              : undefined,
        });
      }
      entries.forEach(([key, val]) => {
        const nextPath = path ? `${path}.${key}` : key;
        visit(val, nextPath);
      });
    }
  };

  visit(payload, "");
  return collections.slice(0, 10);
};

const saveTargetListSyncDiagnosticToLocal = () => {
  try {
    saveFightTargetSyncDiagnosticToLocalStorage(targetListSyncDiagnostic.value);
  } catch (error) {
    console.warn("保存目标列表同步诊断失败:", error);
  }
};

const loadTargetListSyncDiagnosticFromLocal = () => {
  try {
    const parsed = loadFightTargetSyncDiagnosticFromLocalStorage();
    if (!parsed) {
      targetListSyncDiagnostic.value = null;
      return;
    }
    targetListSyncDiagnostic.value = parsed;
  } catch (error) {
    console.warn("读取目标列表同步诊断失败:", error);
    targetListSyncDiagnostic.value = null;
  }
};

const saveFightHistoryToLocal = () => {
  try {
    saveFightHistoryToLocalStorage(fightHistoryRecords.value);
  } catch (error) {
    console.warn("保存切磋历史失败:", error);
  }
};

const loadFightHistoryFromLocal = () => {
  try {
    const parsed = loadFightHistoryFromLocalStorage();
    if (!Array.isArray(parsed) || parsed.length === 0) {
      fightHistoryRecords.value = [];
      return;
    }
    fightHistoryRecords.value = sanitizeFightHistoryRecords(parsed);
  } catch (error) {
    console.warn("读取切磋历史失败:", error);
    fightHistoryRecords.value = [];
  }
};

const loadFightHistoryFromCloud = async () => {
  if (!authStore.isAuthenticated)
    return null;

  try {
    const res = await api.user.getPreference(FIGHT_HISTORY_PREF_KEY);
    const rawValue = res?.data?.value;
    if (rawValue == null)
      return [];

    if (typeof rawValue === "string") {
      return sanitizeFightHistoryRecords(JSON.parse(rawValue));
    }

    return sanitizeFightHistoryRecords(rawValue);
  } catch (error) {
    console.warn("读取云端切磋历史失败:", error?.message || error);
    return null;
  }
};

const saveFightHistoryToCloud = async () => {
  if (!authStore.isAuthenticated || !isFightHistorySyncReady.value)
    return;

  try {
    await api.user.setPreference(FIGHT_HISTORY_PREF_KEY, fightHistoryRecords.value);
  } catch (error) {
    console.warn("同步云端切磋历史失败:", error?.message || error);
  }
};

const scheduleFightHistoryCloudSync = () => {
  if (!authStore.isAuthenticated || !isFightHistorySyncReady.value)
    return;

  if (fightHistorySyncTimer) {
    clearTimeout(fightHistorySyncTimer);
  }

  fightHistorySyncTimer = setTimeout(() => {
    fightHistorySyncTimer = null;
    saveFightHistoryToCloud();
  }, 300);
};

const persistFightHistory = () => {
  saveFightHistoryToLocal();
  scheduleFightHistoryCloudSync();
};

const addFightHistoryRecord = (record) => {
  const normalizedRecord = normalizeFightHistoryRecord({
    ...record,
    updatedAt: Date.now(),
  });
  if (!normalizedRecord)
    return;

  const current = [...fightHistoryRecords.value];
  const existingIndex = current.findIndex(
    (item) => item.id === normalizedRecord.id,
  );
  if (existingIndex >= 0) {
    current.splice(existingIndex, 1);
  }
  current.unshift(normalizedRecord);
  fightHistoryRecords.value = sanitizeFightHistoryRecords(current);
  persistFightHistory();
};

const useHistoryTarget = (item) => {
  targetId.value = String(item.id);
  getTargetInfo();
};

const removeFightHistory = (id) => {
  fightHistoryRecords.value = fightHistoryRecords.value.filter(
    (item) => item.id !== id,
  );
  persistFightHistory();
};

const clearFightHistory = () => {
  fightHistoryRecords.value = [];
  persistFightHistory();
};

const saveTargetListsToLocal = () => {
  try {
    saveFightTargetListsToLocalStorage(targetLists.value);
  } catch (error) {
    console.warn("保存好友/关注列表失败:", error);
  }
};

const loadTargetListsFromLocal = () => {
  try {
    const parsed = loadFightTargetListsFromLocalStorage();
    if (!parsed || typeof parsed !== "object") {
      targetLists.value = sanitizeTargetLists({});
      return;
    }
    targetLists.value = sanitizeTargetLists(parsed);
  } catch (error) {
    console.warn("读取好友/关注列表失败:", error);
    targetLists.value = sanitizeTargetLists({});
  }
};

const loadTargetListsFromCloud = async () => {
  if (!authStore.isAuthenticated)
    return null;

  try {
    const res = await api.user.getPreference(FIGHT_TARGET_LISTS_PREF_KEY);
    const rawValue = res?.data?.value;
    if (rawValue == null)
      return sanitizeTargetLists({});

    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    return sanitizeTargetLists(parsed);
  } catch (error) {
    console.warn("读取云端好友/关注列表失败:", error?.message || error);
    return null;
  }
};

const saveTargetListsToCloud = async () => {
  if (!authStore.isAuthenticated || !isTargetListsSyncReady.value)
    return;

  try {
    await api.user.setPreference(FIGHT_TARGET_LISTS_PREF_KEY, targetLists.value);
  } catch (error) {
    console.warn("同步云端好友/关注列表失败:", error?.message || error);
  }
};

const scheduleTargetListsCloudSync = () => {
  if (!authStore.isAuthenticated || !isTargetListsSyncReady.value)
    return;

  if (targetListsSyncTimer) {
    clearTimeout(targetListsSyncTimer);
  }

  targetListsSyncTimer = setTimeout(() => {
    targetListsSyncTimer = null;
    saveTargetListsToCloud();
  }, 300);
};

const persistTargetLists = () => {
  saveTargetListsToLocal();
  scheduleTargetListsCloudSync();
};

const getTargetListLabel = (listKey) =>
  listKey === "friends"
    ? t("fightPvpCard.targetLists.friends")
    : t("fightPvpCard.targetLists.follows");

const addRecordToTargetList = (listKey, record) => {
  const normalizedRecord = normalizeFightHistoryRecord({
    ...record,
    updatedAt: Date.now(),
  });
  if (!normalizedRecord)
    return;

  const current = [...(targetLists.value[listKey] || [])];
  const existingIndex = current.findIndex(
    (item) => item.id === normalizedRecord.id,
  );
  if (existingIndex >= 0) {
    current.splice(existingIndex, 1);
  }
  current.unshift(normalizedRecord);
  targetLists.value = {
    ...targetLists.value,
    [listKey]: sanitizeFightHistoryRecords(current),
  };
  persistTargetLists();
};

const addCurrentTargetToList = (listKey) => {
  if (!memberData.value) {
    message.warning(t("fightPvpCard.messages.queryTargetFirst"));
    return;
  }
  addRecordToTargetList(listKey, {
    id: memberData.value.roleId || targetId.value,
    name: memberData.value.name,
    red: memberData.value.red,
    headImg: memberData.value.headImg,
    serverName: memberData.value.serverName,
  });
  activeTargetListTab.value = listKey;
  message.success(t("fightPvpCard.messages.addedToList", { list: getTargetListLabel(listKey) }));
};

const addHistoryRecordToList = (listKey, item) => {
  addRecordToTargetList(listKey, item);
  message.success(t("fightPvpCard.messages.addedToList", { list: getTargetListLabel(listKey) }));
};

const removeTargetListRecord = (listKey, id) => {
  targetLists.value = {
    ...targetLists.value,
    [listKey]: (targetLists.value[listKey] || []).filter((item) => item.id !== id),
  };
  persistTargetLists();
};

const clearTargetList = (listKey) => {
  targetLists.value = {
    ...targetLists.value,
    [listKey]: [],
  };
  persistTargetLists();
};

const currentTabRecords = computed(() => {
  if (activeTargetListTab.value === "history")
    return fightHistoryRecords.value;
  const records = targetLists.value[activeTargetListTab.value] || [];
  if (activeTargetListTab.value === "friends") {
    return [...records].sort((a, b) => {
      const redDiff = (Number(b?.red) || 0) - (Number(a?.red) || 0);
      if (redDiff !== 0)
        return redDiff;
      return (Number(b?.updatedAt) || 0) - (Number(a?.updatedAt) || 0);
    });
  }
  return records;
});

const removeCurrentTabRecord = (id) => {
  if (activeTargetListTab.value === "history") {
    removeFightHistory(id);
    return;
  }
  removeTargetListRecord(activeTargetListTab.value, id);
};

const clearCurrentTabRecords = () => {
  if (activeTargetListTab.value === "history") {
    clearFightHistory();
    return;
  }
  clearTargetList(activeTargetListTab.value);
};

const hasTargetListSyncDiagnostic = computed(
  () =>
    Array.isArray(targetListSyncDiagnostic.value?.attempts)
    && targetListSyncDiagnostic.value.attempts.length > 0,
);

const downloadTextAsFile = (
  text,
  filename,
  mime = "application/json;charset=utf-8",
) => {
  const blob = new Blob([text], { type: mime });
  triggerBlobDownload({ blob, fileName: filename });
};

const exportTargetListSyncDiagnostic = () => {
  if (!hasTargetListSyncDiagnostic.value) {
    message.warning(t("fightPvpCard.messages.noDiagnosticData"));
    return;
  }

  try {
    const text = JSON.stringify(targetListSyncDiagnostic.value, null, 2);
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-");
    const filename = `fight-pvp-target-sync-diagnostic-${timestamp}.json`;
    downloadTextAsFile(text, filename);
    message.success(t("fightPvpCard.messages.diagnosticExported", { filename }));
  } catch (error) {
    message.error(t("fightPvpCard.messages.exportFailed", {
      error: error?.message || t("fightPvpCard.common.unknownError"),
    }));
  }
};

const { syncTargetListsFromGame } = useFightPvpTargetSync({
  tokenStore,
  message,
  t,
  targetLists,
  syncingTargetLists,
  GAME_TARGET_LIST_BASE_CMD_CANDIDATES,
  sanitizeFightHistoryRecords,
  normalizeFightHistoryRecord,
  mergeFightRecord,
  calculateRedCountFromHeroes,
  extractGameTargetLists,
  persistTargetLists,
  sleep,
});

// 分页状态
const currentPage = ref(1);
const pageSize = ref(20); // 每页20条，共5页

// 计算总页数
const totalPages = computed(() => {
  if (!topranklist.value)
    return 0;
  return Math.ceil(Object.keys(topranklist.value).length / pageSize.value);
});

const selectHeroInfo = (heroInfo) => {
  showHeroModal.value = true;
  heroModealTemp.value = heroInfo;
};

// 获取当前页的数据
const currentPageData = computed(() => {
  if (!topranklist.value)
    return {};

  const startIndex = (currentPage.value - 1) * pageSize.value;
  const endIndex = startIndex + pageSize.value;
  const entries = Object.entries(topranklist.value);

  return Object.fromEntries(entries.slice(startIndex, endIndex));
});
// 格式化战力
const formatPower = formatFightPvpPower;

// 获取战斗样式类
const getBattleClass = (battle) => {
  const classes = [];
  if (battle.isWin) {
    classes.push("battle-win");
  } else {
    classes.push("battle-loss");
  }
  return classes.join(" ");
};

const formatScore = (score) => {
  return score.toFixed(0).toString();
};

const formatServerId = (ServerId) => {
  return (ServerId - 27).toFixed(0).toString();
};

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = "none";
};

const { fetchfightPVP, fetchTargetInfo } = useFightPvpActions({
  tokenStore,
  message,
  t,
  gettoday,
  formatPower,
  formatWeapon,
  getLineupType,
  HeroFillInfo,
  countPearlOrangeSlots,
  getHeroInfo,
  HERO_DICT,
  loading1,
  loadingText,
  queryDate,
  targetId,
  memberData,
  fightNum,
  fightResult,
  lastTargetRawInfo,
  topranklist,
  addFightHistoryRecord,
});

const exportCurrentTargetRawData = () => {
  if (!lastTargetRawInfo.value) {
    message.warning(t("fightPvpCard.messages.noRawData"));
    return;
  }

  try {
    const payload = {
      exportedAt: new Date().toISOString(),
      targetId: String(targetId.value || ""),
      summary: memberData.value
        ? {
            roleId: memberData.value.roleId,
            name: memberData.value.name,
            red: memberData.value.red,
            orange: memberData.value.orange,
            hole: memberData.value.hole,
          }
        : null,
      raw: lastTargetRawInfo.value,
    };
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `fight-pvp-target-raw-${targetId.value || "unknown"}-${timestamp}.json`;
    downloadTextAsFile(JSON.stringify(payload, null, 2), filename);
    message.success(t("fightPvpCard.messages.rawExported", { filename }));
  } catch (error) {
    message.error(t("fightPvpCard.messages.rawExportFailed", {
      error: error?.message || t("fightPvpCard.common.unknownError"),
    }));
  }
};

/**
 * 提取数组中的英雄信息
 * @param {object} heroObj
 */
function getHeroInfo(heroObj) {
  // 统计总红数
  let redCount = 0;
  let orangeCount = 0;
  let holeCount = 0;
  const heroList = [];
  Object.values(heroObj).forEach((hero) => {
    const heroInfo = HERO_DICT[hero.heroId];
    const equipmentInfo = getEquipment(hero.equipment);
    const tempObj = {
      heroId: hero.heroId, // 英雄ID
      heroSort: hero.battleTeamSlot, // 阵容站位
      artifactId: hero.artifactId, // 英雄装备ID，用于匹配鱼灵信息
      power: formatPower(hero.power), // 英雄战力
      star: hero.star, // 英雄星级
      equipment: hero.equipment, // 英雄具体孔数和红数
      heroName: heroInfo.name, // 英雄姓名
      heroAvate: heroInfo.avatar,
      level: hero.level, // 英雄等级
      hole: equipmentInfo.holeCount, // 英雄开孔数量
      red: equipmentInfo.redCount, // 英雄红数
      orange: equipmentInfo.orangeCount, // 英雄橙数
      HolyBeast: hero.hB?.active, // 激活四圣
      HBlevel: hero.hB?.order || 0, // 四圣等级
    };
    redCount += tempObj.red;
    orangeCount += tempObj.orange;
    holeCount += tempObj.hole;
    heroList.push(tempObj);
  });
  return {
    redCount,
    orangeCount,
    holeCount,
    heroList: heroList.sort((a, b) => {
      return a.heroSort - b.heroSort;
    }),
  };
}

// 获取装备信息红数和孔数
const getEquipment = (equipment) => {
  let redCount = 0;
  let orangeCount = 0;
  let holeCount = 0;
  const palette = getEquipmentPalette(equipment);
  // 此处遍历4件装备
  Object.values(equipment).forEach((equ) => {
    const quenchMap = getEffectiveQuenchMap(equ);
    if (!quenchMap)
      return;
    // 遍历每件装备的属性
    parseQuenchCollection(quenchMap).forEach((item) => {
      holeCount++;
      const colorLevel = getQuenchColorLevel(item);
      if (colorLevel >= palette.redThreshold) {
        redCount++;
      }
      if (colorLevel === palette.orangeLevel) {
        orangeCount++;
      }
    });
  });
  return { redCount, orangeCount, holeCount };
};

// 处理分页大小改变
const handlePageSizeChange = (size) => {
  pageSize.value = size;
  currentPage.value = 1; // 重置到第一页
};
// 刷新战绩
const fightPVPRefresh = () => {
  fetchfightPVP();
};

// 处理切磋次数变化
const handleFightNumChange = (value) => {
  // 确保输入的是有效的数字
  if (typeof value === "string") {
    // 如果是字符串，转换为数字
    const num = Number.parseInt(value, 10);
    // 确保数字有效且大于0,尽量限制最大次数,万一谁请求打多了,可不是什么好事情
    if (!isNaN(num) && num > 0 && num <= 50) {
      fightNum.value = num;
    } else {
      // 否则重置为默认值1
      fightNum.value = 1;
    }
  } else {
    if (value > 0 && value <= 50) {
      // 如果已经是数字类型，直接使用
      fightNum.value = value;
    } else {
      fightNum.value = 1;
    }
  }
};

// 获取对手信息
const getTargetInfo = () => {
  fetchTargetInfo();
};

const handleExport1 = async () => {
  try {
    if (fightResult.value?.report && battleDetailExportRef.value) {
      try {
        battleDetailExportMode.value = true;
        await new Promise((resolve) => setTimeout(resolve, 80));

        const canvas = await captureWithHtml2canvas(battleDetailExportRef.value, {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
          logging: false,
          allowTaint: true,
          taintTest: false,
        });

        const filenameBase = t("fightPvpCard.messages.detailExportImageFileName");
        downloadCanvasAsImage(canvas, `${filenameBase}.png`);
        message.success(t("fightPvpCard.messages.exportImageSuccess"));
      } finally {
        battleDetailExportMode.value = false;
      }
      return;
    }

    // 校验：确保DOM已正确绑定
    if (!exportDom.value) {
      message.error(t("fightPvpCard.messages.exportDomNotFound"));
      return;
    }

    // 获取结果列表元素
    const resultList = exportDom.value.querySelector(".result-list");
    let originalMaxHeight = "";
    let originalOverflow = "";
    let originalPaddingRight = "";

    try {
      // 临时移除结果列表的高度限制，让所有结果都可见
      if (resultList) {
        originalMaxHeight = resultList.style.maxHeight;
        originalOverflow = resultList.style.overflowY;
        originalPaddingRight = resultList.style.paddingRight;

        resultList.style.maxHeight = "none";
        resultList.style.overflowY = "visible";
        resultList.style.paddingRight = "0";
      }

      // 等待DOM更新
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 生成canvas并导出
      const canvas = await captureWithHtml2canvas(exportDom.value, {
        scale: 2, // 放大2倍，解决图片模糊问题
        useCORS: true, // 允许跨域图片（若DOM内有远程图片，需开启）
        backgroundColor: "#ffffff", // 避免透明背景（默认透明）
        logging: false, // 关闭控制台日志
        allowTaint: true, // 允许跨域图片
        taintTest: false, // 关闭跨域测试
      });

      downloadCanvasAsImage(canvas, t("fightPvpCard.messages.exportImageFileName"));
      message.success(t("fightPvpCard.messages.exportImageSuccess"));
    } finally {
      if (resultList) {
        resultList.style.maxHeight = originalMaxHeight;
        resultList.style.overflowY = originalOverflow;
        resultList.style.paddingRight = originalPaddingRight;
      }
    }
  } catch (err) {
    console.error(t("fightPvpCard.messages.exportImageFailedLog"), err);
    message.error(t("fightPvpCard.messages.exportImageFailed"));
  }
};

// 关闭弹窗
const handleClose = () => {
  expandedMembers.value.clear();
};

// 暴露方法给父组件
defineExpose({
  fetchfightPVP,
});

// Inline 模式：挂载后自动拉取
onMounted(async () => {
  loadFightHistoryFromLocal();
  loadTargetListsFromLocal();
  targetLists.value = {
    friends: sanitizeFightHistoryRecords(targetLists.value.friends || []),
    follows: [],
  };

  const localRecords = [...fightHistoryRecords.value];
  const cloudRecords = await loadFightHistoryFromCloud();
  let mergedRecords = localRecords;

  if (Array.isArray(cloudRecords)) {
    mergedRecords = mergeFightHistoryRecords(cloudRecords, localRecords);
    fightHistoryRecords.value = mergedRecords;
    saveFightHistoryToLocal();
  }

  isFightHistorySyncReady.value = true;

  const shouldSyncToCloud = Array.isArray(cloudRecords)
    ? JSON.stringify(cloudRecords) !== JSON.stringify(mergedRecords)
    : localRecords.length > 0;

  if (shouldSyncToCloud) {
    scheduleFightHistoryCloudSync();
  }

  const localTargetLists = { ...targetLists.value };
  const cloudTargetLists = await loadTargetListsFromCloud();
  let mergedTargetLists = localTargetLists;

  if (cloudTargetLists) {
    mergedTargetLists = {
      friends: sanitizeFightHistoryRecords([
        ...(cloudTargetLists.friends || []),
        ...(localTargetLists.friends || []),
      ]),
      follows: [],
    };
    targetLists.value = {
      friends: mergedTargetLists.friends,
      follows: [],
    };
    saveTargetListsToLocal();
  }

  isTargetListsSyncReady.value = true;

  const shouldSyncTargetListsToCloud = cloudTargetLists
    ? JSON.stringify(cloudTargetLists) !== JSON.stringify(mergedTargetLists)
    : localTargetLists.friends.length > 0;

  if (shouldSyncTargetListsToCloud) {
    scheduleTargetListsCloudSync();
  }
  // if (props.inline) {
  //     topranklistRefresh()
  // }
});

onBeforeUnmount(() => {
  if (fightHistorySyncTimer) {
    clearTimeout(fightHistorySyncTimer);
    fightHistorySyncTimer = null;
  }
  if (targetListsSyncTimer) {
    clearTimeout(targetListsSyncTimer);
    targetListsSyncTimer = null;
  }
});
</script>

<style scoped lang="scss">
.ml-8 {
  margin-left: 8px;
}

.legacy-tag {
  color: #fff;
  background-color: var(--legacy-bg);
}

.lineup-type-tag {
  font-weight: 700;
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.25),
    0 1px 3px rgba(0, 0, 0, 0.18);
}

.fight-pvp-container {
  width: 100%;
  // padding: 16px;
}

.main-card {
  background: var(--bg-primary);
  border-radius: var(--border-radius-xl);
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.main-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  transform: translateY(-2px);
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-light);
}

.card-header .status-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 12px;
  margin-right: 16px;
}

.card-header .status-info {
  flex: 1;
}

.card-header .status-info h3 {
  margin: 0 0 4px 0;
  font-size: 24px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-header .status-info p {
  margin: 0;
  font-size: 14px;
  color: var(--text-secondary);
}

.loading-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 40px 20px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
}

.empty-state {
  padding: 40px 20px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
  text-align: center;
}

.content-section {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .main-card {
    padding: 12px;
  }

  .card-header {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }
}
</style>
