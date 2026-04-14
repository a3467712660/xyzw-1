<template>
  <div class="arena-pvp-container">
    <div class="status-card main-card">
      <div class="card-header">
        <img
          class="status-icon"
          src="/icons/1736425783912140.png"
          :alt="t('arenaPvpCard.iconAlt')"
        >
        <div class="status-info">
          <h3>{{ t("arenaPvpCard.title") }}</h3>
          <p>{{ t("arenaPvpCard.subtitle") }}</p>
        </div>
      </div>

      <ArenaPvpToolbar
        v-model:fight-count="fightCount"
        v-model:manual-assign-lineup="manualAssignLineup"
        v-model:manual-assign-name="manualAssignName"
        v-model:manual-assign-role-id="manualAssignRoleId"
        v-model:manual-assign-target-id="manualAssignTargetId"
        v-model:preferred-win-rate="preferredWinRate"
        v-model:selected-formation="selectedFormation"
        v-model:skip-lineup-rules="skipLineupRules"
        :arena-ticket-count="arenaTicketCount"
        :battle-logs="battleLogs"
        :fight-count-options="fightCountOptions"
        :format-score-delta="formatScoreDelta"
        :formation-options="formationOptions"
        :get-lineup-class="getLineupClass"
        :get-score-delta-class="getScoreDeltaClass"
        :is-arena-activity-open="isArenaActivityOpen"
        :is-connected="isConnected"
        :is-my-arena-rank-top20="isMyArenaRankTop20"
        :last-updated-label="lastUpdatedLabel"
        :lineup-preset-options="lineupPresetOptions"
        :loading="loading"
        :manual-lineup-entries="manualLineupEntries"
        :manual-lineup-target-options="manualLineupTargetOptions"
        :my-arena-rank-display="myArenaRankDisplay"
        :my-arena-score-display="myArenaScoreDisplay"
        :running="running"
        :t="t"
        :today-arena-score-delta="todayArenaScoreDelta"
        @refresh="refreshArenaData()"
        @remove-manual-lineup="removeManualLineupType"
        @run-battles="runArenaBattles"
        @save-manual="handleSaveManualLineup"
      ></ArenaPvpToolbar>

      <ArenaPvpRecordPanel
        :get-lineup-class="getLineupClass"
        :get-record-type-label="getArenaRecordTypeLabel"
        :get-score-delta-class="getScoreDeltaClass"
        :is-connected="isConnected"
        :is-exporting-image="isExportingArenaImage"
        :loading="loading"
        :record-based-opponent-win-rates="recordBasedOpponentWinRates"
        :record-based-win-rate="recordBasedWinRate"
        :record-syncing="recordSyncing"
        :records="arenaRecords"
        :resolve-corrected-record-lineup-type="resolveCorrectedRecordLineupType"
        :resolve-record-avatar="resolveArenaRecordAvatar"
        :running="running"
        :set-export-ref="setArenaRecordExportRef"
        :t="t"
        @clear-records="clearArenaRecords"
        @export-image="handleExportArenaRecordsImage"
        @pull-records="handlePullArenaBattleRecords"
        @record-avatar-error="handleArenaRecordAvatarError"
      ></ArenaPvpRecordPanel>

      <ArenaPvpRankPanel
        :format-rank-label="formatRankLabel"
        :get-lineup-class="getLineupClass"
        :get-rank-badge-class="getRankBadgeClass"
        :get-rank-row-class="getRankRowClass"
        :my-role-id="myRoleId"
        :rank-list="rankList"
        :resolve-manual-lineup-type="resolveManualLineupType"
        :resolve-rank-avatar="resolveRankAvatar"
        :t="t"
        @rank-avatar-error="handleRankAvatarError"
      ></ArenaPvpRankPanel>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import { useAuthStore } from "@/stores/auth";
import ArenaPvpRankPanel from "@/components/cards/pvp/ArenaPvpRankPanel.vue";
import ArenaPvpRecordPanel from "@/components/cards/pvp/ArenaPvpRecordPanel.vue";
import ArenaPvpToolbar from "@/components/cards/pvp/ArenaPvpToolbar.vue";
import {
  formatArenaRankLabel,
  formatArenaScoreDelta,
  getArenaLineupClass,
  getArenaRankBadgeClass,
  getArenaRankRowClass,
  getArenaRecordTypeLabelText,
  getArenaScoreDeltaClass,
} from "@/components/cards/pvp/arenaPvpFormatters";
import { getLineupType } from "@/utils/HeroList";
import {
  ARENA_DEFAULT_SKIP_LINEUPS,
  ARENA_LINEUP_PRESET_OPTIONS,
} from "@/utils/arenaLineupPresets";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import { downloadCanvasAsImage } from "@/utils/imageExport";
import api from "@/api";
import { AES, enc, MD5 } from "crypto-js";
import {
  getArenaManualLineupStorageKey,
  getArenaRecordStorageKey,
  getArenaSkipLineupsStorageKey,
  getArenaStatsStorageKey,
  getArenaSyncPrefKeyByScope,
  getArenaSyncUserScopeFromStorage,
  loadArenaPreferredWinRateFromLocal,
  loadArenaSkipLineupsFromLocal,
  loadArenaStatsFromLocal,
  loadEncryptedArenaLocalValue,
  saveArenaPreferredWinRateToLocal,
  saveArenaSkipLineupsToLocal,
  saveArenaStatsToLocal,
  saveEncryptedArenaLocalValue,
} from "@/services/preferences/arenaPvpStorage";
import { useArenaPvpBattleActions } from "@/composables/useArenaPvpBattleActions";
import { useArenaPvpTargeting } from "@/composables/useArenaPvpTargeting";

const tokenStore = useTokenStore();
const message = useMessage();
const { locale, t } = useI18n();
const DEFAULT_SKIP_LINEUPS = [...ARENA_DEFAULT_SKIP_LINEUPS];
const ARENA_CLOUD_PREF_MAX_BYTES = 48 * 1024;
// 固定每周一清理：仅保留本周一 00:00 之后的记录
const ARENA_RECORD_WEEKLY_RESET_DAY = 1; // 0=周日, 1=周一

const loading = ref(false);
const running = ref(false);
const recordSyncing = ref(false);
const isExportingArenaImage = ref(false);
const selectedFormation = ref(1);
const fightCount = ref(3);
const currentFormation = ref(null);
const rankList = ref([]);
const selfArenaInfo = ref(null);
const selfArenaFallbackInfo = ref(null);
const lastUpdatedAt = ref(null);
const battleLogs = ref([]);
const arenaRecords = ref([]);
const arenaRecordExportRef = ref(null);
const setArenaRecordExportRef = (element) => {
  arenaRecordExportRef.value = element;
};
const arenaTargetProfileCache = ref(new Map());
const avatarCandidateIndexMap = ref(new Map());
const targetWinStats = ref({});
const manualLineupMap = ref({});
const skipLineupRules = ref([...DEFAULT_SKIP_LINEUPS]);
const preferredWinRate = ref(null);
const manualAssignTargetId = ref("");
const manualAssignRoleId = ref("");
const manualAssignLineup = ref("吕赵");
const manualAssignName = ref("");
const recordAvatarCandidateIndexMap = ref(new Map());
const isArenaSyncReady = ref(false);
const isApplyingArenaCloudData = ref(false);
const arenaRecordsUpdatedAt = ref(0);
const manualLineupUpdatedAt = ref(0);

const authStore = useAuthStore();
let arenaCloudSyncTimer = null;
const formationOptions = computed(() =>
  Array.from({ length: 6 }, (_, index) => ({
    label: t("arenaPvpCard.options.formation", { value: index + 1 }),
    value: index + 1,
  })),
);
const fightCountOptions = computed(() =>
  [1, 3, 5, 10, 20].map((value) => ({
    label: t("arenaPvpCard.options.fightCount", { value }),
    value,
  })),
);
const lineupPresetOptions = [...ARENA_LINEUP_PRESET_OPTIONS];

const rolePayload = computed(() => tokenStore.gameData?.roleInfo || null);
const roleInfo = computed(() => rolePayload.value?.role || null);
const myRoleId = computed(() =>
  String(
    roleInfo.value?.roleId
    || rolePayload.value?.roleId
    || roleInfo.value?.id
    || rolePayload.value?.id
    || "",
  ),
);

const isConnected = computed(() => {
  if (!tokenStore.selectedToken)
    return false;
  return tokenStore.getWebSocketStatus(tokenStore.selectedToken.id) === "connected";
});

const isArenaActivityOpen = computed(() => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 22;
});

const arenaTicketCount = computed(() =>
  Number(roleInfo.value?.items?.[1007]?.quantity || 0),
);

const myArenaRankNumber = computed(() => {
  const rank = Number(selfArenaInfo.value?.rank);
  if (Number.isFinite(rank) && rank > 0)
    return Math.trunc(rank);
  const fallbackFromStartArea = Number(selfArenaFallbackInfo.value?.rank);
  if (Number.isFinite(fallbackFromStartArea) && fallbackFromStartArea > 0) {
    return Math.trunc(fallbackFromStartArea);
  }
  const fallbackRank = Number(extractArenaStatsFromRole().rank);
  return Number.isFinite(fallbackRank) && fallbackRank > 0 ? Math.trunc(fallbackRank) : 0;
});

const myArenaRankDisplay = computed(() => {
  return myArenaRankNumber.value > 0 ? `#${myArenaRankNumber.value}` : "-";
});
const isMyArenaRankTop20 = computed(
  () => myArenaRankNumber.value > 0 && myArenaRankNumber.value <= 20,
);

const myArenaScoreDisplay = computed(() => {
  const score = toIntegerOrNull(selfArenaInfo.value?.score);
  if (score !== null && score >= 0)
    return String(score);
  const fallbackFromStartArea = toIntegerOrNull(selfArenaFallbackInfo.value?.score);
  if (fallbackFromStartArea !== null && fallbackFromStartArea >= 0) {
    return String(fallbackFromStartArea);
  }
  const fallbackScore = toIntegerOrNull(extractArenaStatsFromRole().score);
  return fallbackScore !== null && fallbackScore >= 0 ? String(fallbackScore) : "-";
});
const todayArenaScoreDelta = computed(() => {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return (arenaRecords.value || []).reduce((sum, item) => {
    const createdAt = Number(item?.createdAt || 0);
    if (!Number.isFinite(createdAt) || createdAt < startOfToday)
      return sum;
    const delta = Number(item?.scoreDelta);
    if (!Number.isFinite(delta) || delta === 0)
      return sum;
    return sum + Math.trunc(delta);
  }, 0);
});

const lastUpdatedLabel = computed(() => {
  if (!lastUpdatedAt.value)
    return "";
  return new Date(lastUpdatedAt.value).toLocaleString(locale.value);
});
const skipLineupOptions = computed(() => {
  const fromManual = Object.values(manualLineupMap.value || {}).filter(Boolean);
  const merged = [
    ...lineupPresetOptions.map((item) => item.value),
    ...fromManual,
    ...skipLineupRules.value,
  ];
  return [...new Set(merged.map((item) => String(item).trim()).filter(Boolean))].map(
    (item) => ({ label: item, value: item }),
  );
});
const manualLineupTargetOptions = computed(() => {
  const rankTargets = (rankList.value || []).map((item) => ({
    label: `${item.name || item.roleId} (${item.roleId || "-"})`,
    value: String(item.roleId || ""),
  }));
  const recordTargets = (arenaRecords.value || [])
    .map((item) => ({
      label: t("arenaPvpCard.labels.recordSourceOption", {
        name: item.name || t("arenaPvpCard.common.dash"),
      }),
      value: `name:${String(item.name || "").trim()}`,
    }))
    .filter((item) => item.value !== "name:");
  return [...rankTargets, ...recordTargets]
    .filter((item) => item.value)
    .filter(
      (item, idx, arr) => arr.findIndex((candidate) => candidate.value === item.value) === idx,
    )
    .slice(0, 200);
});
const manualLineupEntries = computed(() =>
  Object.entries(manualLineupMap.value || {})
    .map(([key, lineupType]) => ({
      key,
      lineupType: String(lineupType || t("arenaPvpCard.common.unknown")),
    }))
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(0, 30),
);
const recordBasedWinRate = computed(() => {
  const records = (arenaRecords.value || []).filter((item) => inferRecordWinState(item) !== null);
  const total = records.length;
  const wins = records.filter((item) => inferRecordWinState(item) === true).length;
  const losses = records.filter((item) => inferRecordWinState(item) === false).length;
  const rate = total > 0 ? ((wins / total) * 100).toFixed(1) : "0.0";
  return { total, wins, losses, rate };
});
const recordBasedOpponentWinRates = computed(() => {
  const map = new Map();
  for (const item of arenaRecords.value || []) {
    const isWin = inferRecordWinState(item);
    if (isWin === null)
      continue;
    const name = String(item.name || "").trim() || t("arenaPvpCard.common.unknownPlayer");
    const prev = map.get(name) || { name, total: 0, wins: 0, losses: 0 };
    prev.total += 1;
    if (isWin)
      prev.wins += 1;
    else prev.losses += 1;
    map.set(name, prev);
  }
  return [...map.values()]
    .map((item) => ({
      ...item,
      rate: item.total > 0 ? ((item.wins / item.total) * 100).toFixed(0) : "0",
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
});

const toInteger = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric))
    return 0;
  return Math.trunc(numeric);
};
const toIntegerOrNull = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric))
    return null;
  return Math.trunc(numeric);
};
const toPositiveInteger = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0)
    return 0;
  return Math.trunc(numeric);
};
const normalizePreferredWinRate = (value) => {
  if (value === null || value === undefined || value === "")
    return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric))
    return null;
  return Math.max(0, Math.min(100, Math.round(numeric)));
};
const formatRankLabel = (rank) =>
  formatArenaRankLabel(rank, t("arenaPvpCard.common.dash"));
const getArenaRecordTypeLabel = (type) =>
  getArenaRecordTypeLabelText(type, {
    attack: t("arenaPvpCard.labels.attack"),
    defense: t("arenaPvpCard.labels.defense"),
    unknown: t("arenaPvpCard.common.unknownMark"),
  });
const getRankBadgeClass = getArenaRankBadgeClass;
const getRankRowClass = getArenaRankRowClass;
const getLineupClass = (lineupType) =>
  getArenaLineupClass(lineupType, t("arenaPvpCard.common.unknown"));
const formatScoreDelta = (scoreDelta) =>
  formatArenaScoreDelta(scoreDelta, t("arenaPvpCard.common.dash"));
const getScoreDeltaClass = getArenaScoreDeltaClass;

const getStatsStorageKey = getArenaStatsStorageKey;

const getArenaSyncUserScope = () =>
  getArenaSyncUserScopeFromStorage(authStore.user?.id);

const getArenaSyncRoleId = (tokenId) => {
  const selectedId = String(tokenStore.selectedToken?.id || "");
  const targetId = String(tokenId || "");
  if (selectedId && targetId && selectedId === targetId && myRoleId.value) {
    return normalizeRoleId(myRoleId.value);
  }
  return "";
};

const hashArenaSyncScope = (seed) => MD5(`arena_sync_scope:${seed}`).toString(enc.Hex);

const getArenaSyncScopeId = (tokenId) => {
  const roleId = getArenaSyncRoleId(tokenId);
  if (roleId)
    return hashArenaSyncScope(`role:${roleId}`);

  const normalizedTokenId = String(tokenId || "").trim();
  const tokenEntry = (tokenStore.gameTokens || []).find(
    (item) => String(item?.id || "") === normalizedTokenId,
  );
  const tokenSeed = tokenEntry?.token
    ? String(tokenEntry.token)
    : normalizedTokenId || "unknown";
  return hashArenaSyncScope(tokenSeed);
};

const getArenaSyncScopeCandidates = (tokenId) => {
  const candidates = [];
  const push = (value) => {
    const key = String(value || "").trim();
    if (key && !candidates.includes(key))
      candidates.push(key);
  };

  const roleId = getArenaSyncRoleId(tokenId);
  if (roleId)
    push(hashArenaSyncScope(`role:${roleId}`));

  const normalizedTokenId = String(tokenId || "").trim();
  const tokenEntry = (tokenStore.gameTokens || []).find(
    (item) => String(item?.id || "") === normalizedTokenId,
  );
  if (tokenEntry?.token)
    push(hashArenaSyncScope(String(tokenEntry.token)));
  if (normalizedTokenId)
    push(hashArenaSyncScope(normalizedTokenId));
  if (normalizedTokenId)
    push(normalizedTokenId); // 兼容最早版本直接用tokenId作为偏好键
  return candidates;
};

const buildArenaStorageSecret = (tokenId, scopeId = "") =>
  MD5(`arena_pvp_secure:${scopeId || getArenaSyncScopeId(tokenId)}:v2`).toString(
    enc.Hex,
  );

const buildArenaStorageSecretLegacy = (tokenId) =>
  MD5(`arena_pvp_secure:${getArenaSyncUserScope()}:${tokenId || "unknown"}:v1`).toString(
    enc.Hex,
  );

const encryptArenaPayload = (tokenId, value, scopeId = "") => {
  const text = JSON.stringify(value ?? null);
  return AES.encrypt(text, buildArenaStorageSecret(tokenId, scopeId)).toString();
};

const decryptArenaPayload = (tokenId, payload, scopeId = "") => {
  try {
    const bytes = AES.decrypt(
      String(payload || ""),
      buildArenaStorageSecret(tokenId, scopeId),
    );
    const plainText = bytes.toString(enc.Utf8);
    if (!plainText)
      return null;
    return JSON.parse(plainText);
  } catch {
    try {
      // 兼容旧版本密钥（userId + tokenId）
      const bytes = AES.decrypt(
        String(payload || ""),
        buildArenaStorageSecretLegacy(tokenId),
      );
      const plainText = bytes.toString(enc.Utf8);
      if (!plainText)
        return null;
      return JSON.parse(plainText);
    } catch {
      return null;
    }
  }
};

const saveEncryptedLocalValue = (storageKey, tokenId, value) => {
  const wrapper = {
    encrypted: true,
    updatedAt: Date.now(),
    payload: encryptArenaPayload(tokenId, value),
  };
  saveEncryptedArenaLocalValue(storageKey, tokenId, value, getArenaSyncScopeId(tokenId));
};

const pruneArenaRecordsByRetention = (records = []) => {
  const now = new Date();
  const weekStart = new Date(now);
  const day = weekStart.getDay();
  const diffToMonday
    = day >= ARENA_RECORD_WEEKLY_RESET_DAY
      ? day - ARENA_RECORD_WEEKLY_RESET_DAY
      : day + (7 - ARENA_RECORD_WEEKLY_RESET_DAY);
  weekStart.setDate(weekStart.getDate() - diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  const cutoff = weekStart.getTime();
  return (records || [])
    .filter((item) => {
      const createdAt = Number(item?.createdAt || 0);
      return Number.isFinite(createdAt) && createdAt >= cutoff;
    })
    .sort((a, b) => Number(b?.createdAt || 0) - Number(a?.createdAt || 0));
};

const compactArenaRecordForCloud = (record) => ({
  id: record?.id,
  roleId: normalizeRoleId(record?.roleId || ""),
  name: String(record?.name || "").trim() || t("arenaPvpCard.common.unknownPlayer"),
  lineupType: String(record?.lineupType || "").trim() || t("arenaPvpCard.common.unknown"),
  type: String(record?.type || "").includes("守") ? "守" : "攻",
  scoreDelta: Number.isFinite(Number(record?.scoreDelta))
    ? Math.trunc(Number(record.scoreDelta))
    : null,
  isWin: typeof record?.isWin === "boolean" ? record.isWin : null,
  createdAt: Number(record?.createdAt || Date.now()),
  source: String(record?.source || "auto"),
  // 保留头像URL用于跨端展示；超限由整体payload缩减逻辑处理
  headImg: isUsableHeadImg(record?.headImg) ? String(record.headImg) : "",
});

const buildArenaCloudPayload = (tokenId) => {
  const base = {
    version: 1,
    tokenId: String(tokenId),
    manualLineupMap: manualLineupMap.value || {},
    manualLineupUpdatedAt: Number(manualLineupUpdatedAt.value || 0),
    arenaRecordsUpdatedAt: Number(arenaRecordsUpdatedAt.value || 0),
  };
  const compactRecords = pruneArenaRecordsByRetention(arenaRecords.value || []).map(
    compactArenaRecordForCloud,
  );
  let count = Math.min(compactRecords.length, 120);
  let payload = { ...base, arenaRecords: compactRecords.slice(0, count) };

  // 确保加密后的偏好小于服务端50KB上限
  while (count > 20) {
    const wrapper = {
      encrypted: true,
      updatedAt: Date.now(),
      payload: encryptArenaPayload(tokenId, payload),
    };
    const size = JSON.stringify(wrapper).length;
    if (size <= ARENA_CLOUD_PREF_MAX_BYTES) {
      return { payload, recordCount: count };
    }
    count = Math.floor(count * 0.75);
    payload = { ...base, arenaRecords: compactRecords.slice(0, count) };
  }

  // 最差情况下去掉头像再尝试一次
  const minimized = {
    ...base,
    arenaRecords: compactRecords.slice(0, 20).map((item) => ({ ...item, headImg: "" })),
  };
  return { payload: minimized, recordCount: minimized.arenaRecords.length };
};

const loadEncryptedLocalValue = (storageKey, tokenId, fallbackFactory) => {
  try {
    return loadEncryptedArenaLocalValue(
      storageKey,
      tokenId,
      getArenaSyncScopeId(tokenId),
      getArenaSyncUserScope(),
      fallbackFactory,
    );
  } catch {
    return fallbackFactory();
  }
};

const scheduleArenaCloudSync = () => {
  const tokenId = tokenStore.selectedToken?.id;
  if (!tokenId || !authStore.isAuthenticated || !isArenaSyncReady.value)
    return;
  if (isApplyingArenaCloudData.value)
    return;

  if (arenaCloudSyncTimer)
    clearTimeout(arenaCloudSyncTimer);
  arenaCloudSyncTimer = setTimeout(async () => {
    arenaCloudSyncTimer = null;
    try {
      const scopeId = getArenaSyncScopeId(tokenId);
      const prefKey = getArenaSyncPrefKeyByScope(scopeId);
      const { payload, recordCount } = buildArenaCloudPayload(tokenId);
      const value = {
        encrypted: true,
        updatedAt: Date.now(),
        payload: encryptArenaPayload(tokenId, payload, scopeId),
      };
      await api.user.setPreference(prefKey, value);
      console.info(
        `[ArenaSync] synced token=${tokenId}, scope=${scopeId.slice(0, 8)}, records=${recordCount}, local=${arenaRecords.value.length}`,
      );
    } catch (error) {
      console.warn("同步竞技场记录/手动归类失败:", error?.message || error, {
        tokenId,
        localRecordCount: arenaRecords.value.length,
      });
    }
  }, 350);
};

const loadArenaSyncFromCloud = async (tokenId) => {
  if (!tokenId || !authStore.isAuthenticated)
    return;
  try {
    const candidates = getArenaSyncScopeCandidates(tokenId);
    let payload = null;
    let bestVersion = -1;
    let sourceScope = "";

    for (const scopeCandidate of candidates) {
      const prefKey = getArenaSyncPrefKeyByScope(scopeCandidate);
      const res = await api.user.getPreference(prefKey);
      const rawValue = res?.data?.value;
      if (rawValue == null)
        continue;
      const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
      let parsedPayload = null;
      if (parsed?.encrypted && typeof parsed?.payload === "string") {
        parsedPayload = decryptArenaPayload(tokenId, parsed.payload, scopeCandidate);
      } else if (parsed && typeof parsed === "object") {
        parsedPayload = parsed;
      }
      if (!parsedPayload || typeof parsedPayload !== "object")
        continue;
      const versionScore = Math.max(
        Number(parsedPayload?.manualLineupUpdatedAt || 0),
        Number(parsedPayload?.arenaRecordsUpdatedAt || 0),
      );
      if (versionScore > bestVersion) {
        bestVersion = versionScore;
        payload = parsedPayload;
        sourceScope = scopeCandidate;
      }
    }
    if (!payload || typeof payload !== "object")
      return;

    const remoteManualMap
      = payload?.manualLineupMap
        && typeof payload.manualLineupMap === "object"
        && !Array.isArray(payload.manualLineupMap)
        ? payload.manualLineupMap
        : null;
    const remoteManualUpdatedAt = Number(payload?.manualLineupUpdatedAt || 0);
    const remoteRecords = Array.isArray(payload?.arenaRecords) ? payload.arenaRecords : null;
    const remoteRecordsUpdatedAt = Number(payload?.arenaRecordsUpdatedAt || 0);

    isApplyingArenaCloudData.value = true;
    try {
      if (remoteManualMap && remoteManualUpdatedAt > Number(manualLineupUpdatedAt.value || 0)) {
        manualLineupMap.value = remoteManualMap;
        manualLineupUpdatedAt.value = remoteManualUpdatedAt;
        rankList.value = (rankList.value || []).map((item) => ({
          ...item,
          lineupType:
            resolveManualLineupType(item.roleId, item.name)
            || tryGetLineupTypeFromPayload(item.raw || item)
            || t("arenaPvpCard.common.unknown"),
        }));
        saveEncryptedLocalValue(
          getArenaManualLineupStorageKey(tokenId),
          tokenId,
          {
            data: manualLineupMap.value || {},
            updatedAt: Number(manualLineupUpdatedAt.value || 0),
          },
        );
      }
      if (remoteRecords && remoteRecordsUpdatedAt > Number(arenaRecordsUpdatedAt.value || 0)) {
        arenaRecords.value = pruneArenaRecordsByRetention(
          remoteRecords.map(normalizeArenaRecord),
        );
        arenaRecordsUpdatedAt.value = remoteRecordsUpdatedAt;
        saveEncryptedLocalValue(
          getArenaRecordStorageKey(tokenId),
          tokenId,
          {
            data: arenaRecords.value,
            updatedAt: Number(arenaRecordsUpdatedAt.value || 0),
          },
        );
      }
    } finally {
      isApplyingArenaCloudData.value = false;
    }
    console.info(
      `[ArenaSync] loaded token=${tokenId}, sourceScope=${String(sourceScope).slice(0, 8)}, updated=${bestVersion}`,
    );
  } catch (error) {
    console.warn("读取云端竞技场记录/手动归类失败:", error?.message || error);
  }
};

const formatPower = (power) => {
  const value = Number(power || 0);
  if (!Number.isFinite(value))
    return "0";
  if (value >= 100000000)
    return `${(value / 100000000).toFixed(2)}亿`;
  if (value >= 10000)
    return `${(value / 10000).toFixed(2)}万`;
  return `${value}`;
};

const toArray = (value) => {
  if (!value)
    return [];
  if (Array.isArray(value))
    return value;
  if (typeof value === "object")
    return Object.values(value);
  return [];
};

const normalizeRoleId = (value) => String(value || "").trim();
const normalizeLineupKey = (value) => String(value || "").trim();
const sanitizeHeadImg = (value) =>
  String(value || "")
    .replace(/`/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
const isUsableHeadImg = (value) => {
  const raw = sanitizeHeadImg(value);
  if (!raw)
    return false;
  const lower = raw.toLowerCase();
  if (lower === "null" || lower === "undefined")
    return false;
  if (/^(https?:)?\/\//i.test(raw))
    return true;
  if (raw.startsWith("/"))
    return true;
  if (/^\d+$/.test(raw))
    return false;
  return true;
};
const normalizeHeadImg = (value) => {
  const raw = sanitizeHeadImg(value);
  if (!raw)
    return "";
  if (raw.startsWith("//"))
    return `https:${raw}`;
  return raw;
};
const extractHeadImgFromPayload = (payload) => {
  if (!payload || typeof payload !== "object")
    return "";
  return normalizeHeadImg(
    payload?.headImg
    || payload?.avatar
    || payload?.head
    || payload?.custom?.headImg
    || payload?.role?.headImg
    || payload?.roleInfo?.headImg
    || "",
  );
};

const loadTargetWinStats = (tokenId) => {
  if (!tokenId) {
    targetWinStats.value = {};
    return;
  }
  try {
    const parsed = loadArenaStatsFromLocal(tokenId);
    targetWinStats.value = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    targetWinStats.value = {};
  }
};

const saveTargetWinStats = (tokenId) => {
  if (!tokenId)
    return;
  try {
    saveArenaStatsToLocal(tokenId, targetWinStats.value);
  } catch {
    // 忽略本地存储异常
  }
};

const loadManualLineupMap = (tokenId) => {
  if (!tokenId) {
    manualLineupMap.value = {};
    manualLineupUpdatedAt.value = 0;
    return;
  }
  try {
    const parsed = loadEncryptedLocalValue(
      getArenaManualLineupStorageKey(tokenId),
      tokenId,
      () => ({ data: {}, updatedAt: 0 }),
    );
    if (
      parsed
      && typeof parsed === "object"
      && !Array.isArray(parsed)
      && parsed.data
      && typeof parsed.data === "object"
      && !Array.isArray(parsed.data)
    ) {
      manualLineupMap.value = parsed.data;
      manualLineupUpdatedAt.value = Number(parsed.updatedAt || 0);
    } else {
      // 兼容历史明文/旧加密结构（直接存对象）
      manualLineupMap.value
        = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
      manualLineupUpdatedAt.value = 0;
    }
  } catch {
    manualLineupMap.value = {};
    manualLineupUpdatedAt.value = 0;
  }
};

const saveManualLineupMap = (tokenId) => {
  if (!tokenId)
    return;
  try {
    saveEncryptedLocalValue(
      getArenaManualLineupStorageKey(tokenId),
      tokenId,
      {
        data: manualLineupMap.value || {},
        updatedAt: Number(manualLineupUpdatedAt.value || Date.now()),
      },
    );
    if (!isApplyingArenaCloudData.value)
      scheduleArenaCloudSync();
  } catch {
    // 忽略本地存储异常
  }
};

const loadSkipLineups = (tokenId) => {
  if (!tokenId) {
    skipLineupRules.value = [...DEFAULT_SKIP_LINEUPS];
    return;
  }
  try {
    const parsed = loadArenaSkipLineupsFromLocal(tokenId);
    if (!parsed) {
      skipLineupRules.value = [...DEFAULT_SKIP_LINEUPS];
      return;
    }
    const list = Array.isArray(parsed)
      ? parsed.map((item) => normalizeLineupKey(item)).filter(Boolean)
      : [];
    skipLineupRules.value = list.length > 0 ? [...new Set(list)] : [...DEFAULT_SKIP_LINEUPS];
  } catch {
    skipLineupRules.value = [...DEFAULT_SKIP_LINEUPS];
  }
};

const loadPreferredWinRate = (tokenId) => {
  if (!tokenId) {
    preferredWinRate.value = null;
    return;
  }
  try {
    preferredWinRate.value = normalizePreferredWinRate(
      loadArenaPreferredWinRateFromLocal(tokenId),
    );
  } catch {
    preferredWinRate.value = null;
  }
};

const savePreferredWinRate = (tokenId) => {
  if (!tokenId)
    return;
  try {
    saveArenaPreferredWinRateToLocal(
      tokenId,
      normalizePreferredWinRate(preferredWinRate.value),
    );
  } catch {
    // 忽略本地存储异常
  }
};

const saveSkipLineups = (tokenId) => {
  if (!tokenId)
    return;
  try {
    saveArenaSkipLineupsToLocal(
      tokenId,
      [...new Set((skipLineupRules.value || []).map((item) => normalizeLineupKey(item)).filter(Boolean))],
    );
  } catch {
    // 忽略本地存储异常
  }
};

const resolveManualLineupType = (roleId, name) => {
  const byRoleId = manualLineupMap.value?.[normalizeRoleId(roleId)];
  if (byRoleId)
    return String(byRoleId);
  const nameKey = `name:${String(name || "").trim()}`;
  const byName = manualLineupMap.value?.[nameKey];
  if (byName)
    return String(byName);
  return "";
};

const inferRecordWinState = (record) => {
  if (typeof record?.isWin === "boolean")
    return record.isWin;
  const scoreDelta = Number(record?.scoreDelta);
  if (Number.isFinite(scoreDelta) && scoreDelta !== 0)
    return scoreDelta > 0;
  return null;
};

const getArenaRecordAvatarKey = (item) =>
  `${normalizeRoleId(item?.roleId) || ""}:${String(item?.name || "").trim()}:${item?.id || ""}`;

const getArenaRecordAvatarCandidates = (item) => {
  const candidates = [];
  const pushCandidate = (value) => {
    const normalized = normalizeHeadImg(value);
    if (!isUsableHeadImg(normalized))
      return;
    if (!candidates.includes(normalized))
      candidates.push(normalized);
    if (/^http:\/\//i.test(normalized)) {
      const httpsVersion = normalized.replace(/^http:\/\//i, "https://");
      if (!candidates.includes(httpsVersion))
        candidates.push(httpsVersion);
    } else if (/^https:\/\//i.test(normalized)) {
      const httpVersion = normalized.replace(/^https:\/\//i, "http://");
      if (!candidates.includes(httpVersion))
        candidates.push(httpVersion);
    }
  };

  pushCandidate(item?.headImg);
  const byRoleId = rankList.value.find(
    (entry) => normalizeRoleId(entry.roleId) && normalizeRoleId(entry.roleId) === normalizeRoleId(item?.roleId),
  );
  pushCandidate(byRoleId?.headImg);
  pushCandidate(byRoleId?.raw?.headImg);
  if (!byRoleId) {
    const byName = rankList.value.find(
      (entry) => String(entry?.name || "").trim() && String(entry?.name || "").trim() === String(item?.name || "").trim(),
    );
    pushCandidate(byName?.headImg);
    pushCandidate(byName?.raw?.headImg);
  }
  return candidates;
};

const resolveArenaRecordAvatar = (item) => {
  const key = getArenaRecordAvatarKey(item);
  const index = recordAvatarCandidateIndexMap.value.get(key) || 0;
  const candidates = getArenaRecordAvatarCandidates(item);
  return candidates[index] || "";
};

const handleArenaRecordAvatarError = (item) => {
  const key = getArenaRecordAvatarKey(item);
  const candidates = getArenaRecordAvatarCandidates(item);
  const current = recordAvatarCandidateIndexMap.value.get(key) || 0;
  const next = Math.min(current + 1, candidates.length);
  recordAvatarCandidateIndexMap.value = new Map(recordAvatarCandidateIndexMap.value);
  recordAvatarCandidateIndexMap.value.set(key, next);
};

const applyManualLineupType = (roleId, name, lineupType) => {
  const tokenId = tokenStore.selectedToken?.id;
  if (!tokenId)
    return;
  const key = normalizeRoleId(roleId) || `name:${String(name || "").trim()}`;
  const normalizedLineup = String(lineupType || "").trim();
  if (!key || !normalizedLineup)
    return;
  manualLineupMap.value = {
    ...(manualLineupMap.value || {}),
    [key]: normalizedLineup,
  };
  manualLineupUpdatedAt.value = Date.now();
  saveManualLineupMap(tokenId);
};

const removeManualLineupType = (key) => {
  const tokenId = tokenStore.selectedToken?.id;
  if (!tokenId)
    return;
  if (!key || !manualLineupMap.value?.[key])
    return;
  const next = { ...(manualLineupMap.value || {}) };
  delete next[key];
  manualLineupMap.value = next;
  manualLineupUpdatedAt.value = Date.now();
  saveManualLineupMap(tokenId);
  rankList.value = (rankList.value || []).map((item) => {
    const shouldResetByRole = String(item.roleId || "") === key;
    const shouldResetByName = key === `name:${String(item.name || "").trim()}`;
    if (!shouldResetByRole && !shouldResetByName)
      return item;
    return {
      ...item,
      lineupType: tryGetLineupTypeFromPayload(item.raw || item) || "未知",
    };
  });
};

const handleSaveManualLineup = () => {
  const selected = String(manualAssignTargetId.value || "").trim();
  const roleIdInput = normalizeRoleId(manualAssignRoleId.value);
  const lineupType = String(manualAssignLineup.value || "").trim();
  const customName = String(manualAssignName.value || "").trim();
  if (!lineupType) {
    message.warning(t("arenaPvpCard.messages.selectManualLineup"));
    return;
  }
  if (!selected && !customName && !roleIdInput) {
    message.warning(t("arenaPvpCard.messages.selectManualTarget"));
    return;
  }
  if (roleIdInput) {
    const target = rankList.value.find((item) => String(item.roleId) === roleIdInput);
    const name = target?.name || customName || roleIdInput;
    applyManualLineupType(roleIdInput, name, lineupType);
    rankList.value = (rankList.value || []).map((item) =>
      String(item.roleId || "") === String(roleIdInput) ? { ...item, lineupType } : item,
    );
    message.success(t("arenaPvpCard.messages.manualSavedWithRoleId", { name, roleId: roleIdInput, lineupType }));
    return;
  }
  if (selected.startsWith("name:")) {
    const name = selected.slice(5).trim() || customName;
    applyManualLineupType("", name, lineupType);
    rankList.value = (rankList.value || []).map((item) =>
      String(item.name || "").trim() === name ? { ...item, lineupType } : item,
    );
    message.success(t("arenaPvpCard.messages.manualSaved", { name, lineupType }));
    return;
  }
  const target = rankList.value.find((item) => String(item.roleId) === selected);
  const roleId = target?.roleId || selected;
  const name = target?.name || customName || selected;
  applyManualLineupType(roleId, name, lineupType);
  rankList.value = (rankList.value || []).map((item) =>
    String(item.roleId || "") === String(roleId) ? { ...item, lineupType } : item,
  );
  message.success(t("arenaPvpCard.messages.manualSaved", { name, lineupType }));
};

const isSkippedLineupType = (lineupType) => {
  const normalized = String(lineupType || t("arenaPvpCard.common.unknown")).trim();
  if (!normalized)
    return false;
  const rules = (skipLineupRules.value || []).map((item) => String(item || "").trim()).filter(Boolean);
  if (rules.length === 0)
    return false;
  return rules.some((rule) => normalized.includes(rule));
};

const normalizeArenaRecord = (record) => {
  const rawScoreCandidates = [
    record?.scoreDelta,
    record?.pointDelta,
    record?.scoreChange,
    record?.pointChange,
    record?.score,
    record?.point,
    record?.raw?.score,
    record?.raw?.point,
  ];
  let scoreDelta = null;
  for (const value of rawScoreCandidates) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric === 0)
      continue;
    scoreDelta = Math.trunc(numeric);
    break;
  }
  const hasWinFlag = typeof record?.isWin === "boolean";
  if (scoreDelta !== null && scoreDelta > 0 && hasWinFlag) {
    // 部分区服竞技场记录仅返回 score（绝对值），正负需要结合 isWin 推断
    scoreDelta = record.isWin ? scoreDelta : -scoreDelta;
  }
  const createdAt = Number(record?.createdAt || Date.now());
  const normalizedIsWin
    = typeof record?.isWin === "boolean"
      ? record.isWin
      : Number.isFinite(scoreDelta) && scoreDelta !== 0
        ? scoreDelta > 0
        : null;
  return {
    id: String(record?.id || `${createdAt}-${Math.random().toString(36).slice(2, 8)}`),
    type: String(record?.type || "").includes("攻")
      ? "攻"
      : String(record?.type || "").includes("守")
        ? "守"
        : "?",
    roleId: normalizeRoleId(record?.roleId || ""),
    name: String(record?.name || "").trim() || t("arenaPvpCard.common.unknownPlayer"),
    lineupType:
      String(record?.lineupType || "").trim()
      || tryGetLineupTypeFromPayload(record?.raw || record)
      || t("arenaPvpCard.common.unknown"),
    scoreDelta: Number.isFinite(scoreDelta) ? Math.trunc(scoreDelta) : null,
    isWin: normalizedIsWin,
    headImg: normalizeHeadImg(record?.headImg || ""),
    createdAt,
    timeText: new Date(createdAt).toLocaleString(locale.value),
    source: record?.source || "auto",
    sourceLabel:
      record?.source === "ocr"
        ? t("arenaPvpCard.sources.ocr")
        : record?.source === "manual"
          ? t("arenaPvpCard.sources.manual")
          : record?.source === "game"
            ? t("arenaPvpCard.sources.game")
            : t("arenaPvpCard.sources.auto"),
  };
};

const resolveCorrectedRecordLineupType = (record) => {
  const manualLineup = resolveManualLineupType(record?.roleId, record?.name);
  if (!manualLineup)
    return "";

  const detectedLineup
    = String(record?.lineupType || t("arenaPvpCard.common.unknown")).trim()
      || t("arenaPvpCard.common.unknown");
  if (normalizeLineupKey(manualLineup) === normalizeLineupKey(detectedLineup)) {
    return "";
  }

  return manualLineup;
};

const loadArenaRecords = (tokenId) => {
  if (!tokenId) {
    arenaRecords.value = [];
    arenaRecordsUpdatedAt.value = 0;
    return;
  }
  try {
    const parsed = loadEncryptedLocalValue(
      getArenaRecordStorageKey(tokenId),
      tokenId,
      () => ({ data: [], updatedAt: 0 }),
    );
    const rawList = Array.isArray(parsed?.data)
      ? parsed.data
      : Array.isArray(parsed)
        ? parsed
        : [];
    const list = rawList.map(normalizeArenaRecord);
    arenaRecords.value = pruneArenaRecordsByRetention(list);
    arenaRecordsUpdatedAt.value = Number(parsed?.updatedAt || 0);
  } catch {
    arenaRecords.value = [];
    arenaRecordsUpdatedAt.value = 0;
  }
};

const saveArenaRecords = (tokenId) => {
  if (!tokenId)
    return;
  try {
    const pruned = pruneArenaRecordsByRetention(arenaRecords.value || []);
    arenaRecords.value = pruned;
    saveEncryptedLocalValue(
      getArenaRecordStorageKey(tokenId),
      tokenId,
      {
        data: pruned,
        updatedAt: Number(arenaRecordsUpdatedAt.value || Date.now()),
      },
    );
    if (!isApplyingArenaCloudData.value)
      scheduleArenaCloudSync();
  } catch {
    // 忽略本地存储异常
  }
};

const addArenaRecord = (record) => {
  const tokenId = tokenStore.selectedToken?.id;
  if (!tokenId)
    return;
  const normalized = normalizeArenaRecord(record);
  arenaRecords.value = pruneArenaRecordsByRetention([normalized, ...arenaRecords.value]);
  arenaRecordsUpdatedAt.value = Date.now();
  saveArenaRecords(tokenId);
};

const clearArenaRecords = () => {
  const tokenId = tokenStore.selectedToken?.id;
  arenaRecords.value = [];
  arenaRecordsUpdatedAt.value = Date.now();
  if (!tokenId)
    return;
  try {
    saveArenaRecords(tokenId);
  } catch {
    // 忽略本地存储异常
  }
};

const tryParseBattleDetail = (value) => {
  if (!value)
    return null;
  if (typeof value === "object")
    return value;
  const text = String(value || "").trim();
  if (!text)
    return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const resolveArenaRecordOpponentFromBattleDetail = (detail, oppositeId, isAttack) => {
  if (!detail || typeof detail !== "object")
    return null;

  const normalizeId = (id) => normalizeRoleId(id);
  const targetId = normalizeId(oppositeId);
  const selfId = normalizeId(myRoleId.value);
  const candidates = [
    detail?.accept,
    detail?.sponsor,
    detail?.defender,
    detail?.attacker,
    detail?.defence,
    detail?.defense,
    detail?.opponent,
    detail?.target,
  ].filter((item) => item && typeof item === "object");

  if (targetId) {
    const matched = candidates.find((item) => normalizeId(item?.roleId) === targetId);
    if (matched)
      return matched;
  }

  if (typeof isAttack === "boolean") {
    // 我方进攻时，对手通常是 accept/defender；我方防守时，对手通常是 sponsor/attacker
    const preferredSides = isAttack
      ? [detail?.accept, detail?.defender, detail?.target, detail?.opponent]
      : [detail?.sponsor, detail?.attacker, detail?.opponent, detail?.target];
    for (const side of preferredSides) {
      if (side && typeof side === "object")
        return side;
    }
  }

  // 兜底：优先返回非自身ID的一方，避免把己方阵容识别成对手阵容
  if (selfId) {
    const nonSelf = candidates.find((item) => {
      const rid = normalizeId(item?.roleId);
      return rid && rid !== selfId;
    });
    if (nonSelf)
      return nonSelf;
  }

  return candidates[0] || null;
};

const parseArenaRecordListFromGame = (payload) => {
  const rawList = toArray(payload?.list || payload?.records || payload?.recordList);
  return rawList
    .map((item, index) => {
      const createdSec = Number(item?.created || item?.createTime || 0);
      const createdAt
        = Number.isFinite(createdSec) && createdSec > 0 ? createdSec * 1000 : Date.now() - index * 1000;
      const oppositeId = normalizeRoleId(item?.oppositeId || item?.targetId || item?.roleId || "");
      const detail = tryParseBattleDetail(item?.result);
      const opponent = resolveArenaRecordOpponentFromBattleDetail(
        detail,
        oppositeId,
        typeof item?.isAttack === "boolean" ? item.isAttack : null,
      );
      const lineupFromDetail = opponent ? tryGetLineupTypeFromPayload(opponent) : "";
      return normalizeArenaRecord({
        id: item?.id || `${createdAt}-${oppositeId || index}`,
        type: item?.isAttack ? "攻" : "守",
        roleId: oppositeId,
        name:
          String(item?.oppositeName || opponent?.name || "").trim()
          || t("arenaPvpCard.common.unknownPlayer"),
        lineupType: lineupFromDetail || t("arenaPvpCard.common.unknown"),
        score: item?.score,
        scoreDelta:
          Number.isFinite(Number(item?.scoreDelta)) && Number(item?.scoreDelta) !== 0
            ? Math.trunc(Number(item?.scoreDelta))
            : null,
        isWin: typeof item?.isWin === "boolean" ? item.isWin : null,
        headImg: normalizeHeadImg(item?.oppositeHead || opponent?.headImg || ""),
        source: "game",
        createdAt,
        raw: item,
      });
    })
    .filter((item) => item && (item.roleId || item.name || item.id));
};

const mergeArenaRecords = (incoming = []) => {
  if (!Array.isArray(incoming) || incoming.length === 0)
    return;
  const merged = new Map();
  for (const record of [...incoming, ...arenaRecords.value]) {
    const key = String(record?.id || "");
    if (!key || merged.has(key))
      continue;
    merged.set(key, record);
  }
  arenaRecords.value = pruneArenaRecordsByRetention([...merged.values()]);
};

const syncArenaBattleRecordsFromGame = async ({ silent = true } = {}) => {
  const tokenId = tokenStore.selectedToken?.id;
  if (!tokenId || recordSyncing.value)
    return 0;
  recordSyncing.value = true;
  try {
    const response = await tokenStore.sendMessageWithPromise(
      tokenId,
      "arena_getbattlerecord",
      {},
      10000,
    );
    const records = parseArenaRecordListFromGame(response || {});
    if (records.length === 0) {
      if (!silent)
        message.warning(t("arenaPvpCard.messages.noGameRecords"));
      return 0;
    }
    mergeArenaRecords(records);
    arenaRecordsUpdatedAt.value = Date.now();
    saveArenaRecords(tokenId);
    if (!silent)
      message.success(t("arenaPvpCard.messages.recordsPulled", { count: records.length }));
    return records.length;
  } catch (error) {
    if (!silent) {
      message.error(t("arenaPvpCard.messages.pullRecordsFailed", { error: error.message || t("arenaPvpCard.common.unknownError") }));
    } else {
      console.warn("自动拉取竞技场游戏记录失败:", error?.message || error);
    }
    return 0;
  } finally {
    recordSyncing.value = false;
  }
};

const handlePullArenaBattleRecords = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("arenaPvpCard.messages.selectTokenFirst"));
    return;
  }
  if (!isConnected.value) {
    message.warning(t("arenaPvpCard.messages.connectWebSocketFirst"));
    return;
  }
  await syncArenaBattleRecordsFromGame({ silent: false });
};

const extractArenaScoreDeltaFromFightResult = (fightResult) => {
  const result = fightResult?.battleData?.result || {};
  const candidates = [
    result.scoreDelta,
    result.scoreChange,
    result.pointDelta,
    result.pointChange,
    result.addScore,
    fightResult?.scoreDelta,
    fightResult?.pointDelta,
  ];
  for (const value of candidates) {
    const num = Number(value);
    if (Number.isFinite(num) && num !== 0)
      return Math.trunc(num);
  }
  return null;
};

const handleExportArenaRecordsImage = async () => {
  if (!arenaRecordExportRef.value) {
    message.warning(t("arenaPvpCard.messages.noExportableRecords"));
    return;
  }
  try {
    isExportingArenaImage.value = true;
    await nextTick();
    const canvas = await captureWithHtml2canvas(arenaRecordExportRef.value, {
      useCORS: true,
      backgroundColor: null,
      scale: Math.max(2, window.devicePixelRatio || 1),
    });
    const time = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    downloadCanvasAsImage(canvas, t("arenaPvpCard.messages.exportImageFileName", { time }));
    message.success(t("arenaPvpCard.messages.exportImageSuccess"));
  } catch (error) {
    message.error(t("arenaPvpCard.messages.exportImageFailed", { error: error.message || t("arenaPvpCard.common.unknownError") }));
  } finally {
    isExportingArenaImage.value = false;
  }
};

const getStatsEntries = (stats) => {
  if (!stats)
    return [];
  if (typeof stats.entries === "function") {
    try {
      return [...stats.entries()];
    } catch {
      return [];
    }
  }
  if (typeof stats === "object")
    return Object.entries(stats);
  return [];
};

const extractArenaStatsFromRole = () => {
  const statsSources = [roleInfo.value?.statistics, roleInfo.value?.statisticsTime];
  const rankHintKeys = [
    "arena:rank",
    "last:arena:rank",
    "arenarank",
    "rank:arena",
  ];
  const scoreHintKeys = [
    "arena:score",
    "arena:point",
    "arenascore",
    "score:arena",
  ];

  let rank;
  let score;

  for (const source of statsSources) {
    for (const [key, rawValue] of getStatsEntries(source)) {
      const lowerKey = String(key || "").toLowerCase();
      const value = Number(rawValue);
      if (!Number.isFinite(value))
        continue;

      if (
        rank === undefined
        && (rankHintKeys.some((hint) => lowerKey.includes(hint))
          || (lowerKey.includes("arena") && lowerKey.includes("rank")))
      ) {
        rank = value;
      }

      if (
        score === undefined
        && (scoreHintKeys.some((hint) => lowerKey.includes(hint))
          || (lowerKey.includes("arena")
            && (lowerKey.includes("score") || lowerKey.includes("point"))))
      ) {
        score = value;
      }
    }
  }

  return { rank, score };
};

const {
  enrichRankListLineups,
  extractSelfArenaInfo,
  extractSelfArenaInfoFromStartArea,
  normalizeArenaRankList,
  selectArenaTargetWithRules,
  tryGetLineupTypeFromPayload,
  updateTargetWinStats,
} = useArenaPvpTargeting({
  tokenStore,
  t,
  roleInfo,
  myRoleId,
  rankList,
  targetWinStats,
  preferredWinRate,
  arenaRecords,
  arenaTargetProfileCache,
  saveTargetWinStats,
  getLineupType,
  formatPower,
  normalizeHeadImg,
  normalizeRoleId,
  extractHeadImgFromPayload,
  isUsableHeadImg,
  toArray,
  toInteger,
  toIntegerOrNull,
  toPositiveInteger,
  resolveManualLineupType,
  isSkippedLineupType,
});

const pushBattleLog = (text) => {
  battleLogs.value.unshift({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: new Date().toLocaleTimeString(locale.value),
    text,
  });
  if (battleLogs.value.length > 80) {
    battleLogs.value = battleLogs.value.slice(0, 80);
  }
};

const getAvatarKey = (item) =>
  normalizeRoleId(item?.roleId || "") || `${item?.rank || 0}-${item?.name || "unknown"}`;

const getAvatarCandidates = (item) => {
  const candidates = [];
  const pushCandidate = (value) => {
    const normalized = normalizeHeadImg(value);
    if (!isUsableHeadImg(normalized))
      return;
    if (!candidates.includes(normalized))
      candidates.push(normalized);

    if (/^http:\/\//i.test(normalized)) {
      const httpsVersion = normalized.replace(/^http:\/\//i, "https://");
      if (!candidates.includes(httpsVersion))
        candidates.push(httpsVersion);
    } else if (/^https:\/\//i.test(normalized)) {
      const httpVersion = normalized.replace(/^https:\/\//i, "http://");
      if (!candidates.includes(httpVersion))
        candidates.push(httpVersion);
    }
  };

  pushCandidate(item?.headImg);
  pushCandidate(item?.raw?.headImg);
  pushCandidate(item?.raw?.avatar);
  pushCandidate(item?.raw?.head);
  pushCandidate(item?.raw?.custom?.headImg);
  pushCandidate(item?.raw?.role?.headImg);
  pushCandidate(item?.raw?.roleInfo?.headImg);

  const cached = arenaTargetProfileCache.value.get(item?.roleId);
  pushCandidate(cached?.headImg);

  if (String(item?.roleId || "") === myRoleId.value) {
    pushCandidate(roleInfo.value?.headImg);
  }

  return candidates;
};

const resolveRankAvatar = (item) => {
  const key = getAvatarKey(item);
  const index = avatarCandidateIndexMap.value.get(key) || 0;
  const candidates = getAvatarCandidates(item);
  return candidates[index] || "";
};

const handleRankAvatarError = (item) => {
  const key = getAvatarKey(item);
  const candidates = getAvatarCandidates(item);
  const current = avatarCandidateIndexMap.value.get(key) || 0;
  const next = Math.min(current + 1, candidates.length);
  avatarCandidateIndexMap.value = new Map(avatarCandidateIndexMap.value);
  avatarCandidateIndexMap.value.set(key, next);
};

const fetchArenaRankWithFallback = async (tokenId) => {
  // rankType=0 对应当前竞技场榜单；1 在部分区服更偏向巅峰/其它榜
  const rankTypes = [0, 1];
  let lastError = null;
  for (const rankType of rankTypes) {
    try {
      return await tokenStore.sendMessageWithPromise(
        tokenId,
        "arena_getarearank",
        { rankType },
        8000,
      );
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error("获取竞技场排名失败");
};

const {
  refreshArenaData,
  refreshCurrentFormation,
  runArenaBattles,
} = useArenaPvpBattleActions({
  tokenStore,
  message,
  t,
  loading,
  running,
  selectedFormation,
  fightCount,
  currentFormation,
  rankList,
  selfArenaInfo,
  selfArenaFallbackInfo,
  lastUpdatedAt,
  arenaTargetProfileCache,
  avatarCandidateIndexMap,
  isConnected,
  isArenaActivityOpen,
  arenaTicketCount,
  extractSelfArenaInfoFromStartArea,
  fetchArenaRankWithFallback,
  normalizeArenaRankList,
  extractSelfArenaInfo,
  enrichRankListLineups,
  selectArenaTargetWithRules,
  updateTargetWinStats,
  syncArenaBattleRecordsFromGame,
  pushBattleLog,
  extractHeadImgFromPayload,
  isUsableHeadImg,
});

const initArenaPersistForToken = async (tokenId) => {
  isArenaSyncReady.value = false;
  loadArenaRecords(tokenId);
  loadManualLineupMap(tokenId);
  if (tokenId && authStore.isAuthenticated) {
    await loadArenaSyncFromCloud(tokenId);
  }
  isArenaSyncReady.value = true;
  // 初始化后主动同步一次，避免“本地已有数据但没有后续编辑”时不触发上云
  if (tokenId && authStore.isAuthenticated) {
    scheduleArenaCloudSync();
  }
};

watch(
  skipLineupRules,
  (value) => {
    const sanitized = [...new Set((value || []).map((item) => String(item || "").trim()).filter(Boolean))];
    const current = Array.isArray(skipLineupRules.value) ? skipLineupRules.value : [];
    if (sanitized.join("|") !== current.join("|")) {
      skipLineupRules.value = sanitized;
      return;
    }
    const tokenId = tokenStore.selectedToken?.id;
    if (tokenId)
      saveSkipLineups(tokenId);
  },
  { deep: true },
);

watch(
  () => tokenStore.selectedToken?.id,
  (tokenId) => {
    rankList.value = [];
    selfArenaInfo.value = null;
    selfArenaFallbackInfo.value = null;
    battleLogs.value = [];
    arenaTargetProfileCache.value = new Map();
    avatarCandidateIndexMap.value = new Map();
    recordAvatarCandidateIndexMap.value = new Map();
    currentFormation.value = null;
    lastUpdatedAt.value = null;
    manualAssignTargetId.value = "";
    manualAssignRoleId.value = "";
    manualAssignName.value = "";
    manualAssignLineup.value = "吕赵";
    loadTargetWinStats(tokenId);
    void initArenaPersistForToken(tokenId);
    loadSkipLineups(tokenId);
    loadPreferredWinRate(tokenId);
    if (isConnected.value)
      refreshArenaData({ silent: true });
  },
);

watch(preferredWinRate, (value) => {
  const sanitized = normalizePreferredWinRate(value);
  if (sanitized !== value) {
    preferredWinRate.value = sanitized;
    return;
  }
  const tokenId = tokenStore.selectedToken?.id;
  if (tokenId)
    savePreferredWinRate(tokenId);
});

watch(
  () => authStore.isAuthenticated,
  (isAuthed) => {
    const tokenId = tokenStore.selectedToken?.id;
    if (!tokenId)
      return;
    if (!isAuthed) {
      isArenaSyncReady.value = true;
      return;
    }
    void initArenaPersistForToken(tokenId);
  },
);

watch(
  () => myRoleId.value,
  (nextRoleId, prevRoleId) => {
    if (!authStore.isAuthenticated)
      return;
    if (!tokenStore.selectedToken?.id)
      return;
    if (!nextRoleId || nextRoleId === prevRoleId)
      return;
    // 当角色ID可用后，切换到稳定的跨端scope并执行一次读写同步
    void initArenaPersistForToken(tokenStore.selectedToken.id);
  },
);

watch(
  () =>
    tokenStore.selectedToken
      ? tokenStore.getWebSocketStatus(tokenStore.selectedToken.id)
      : "disconnected",
  (status) => {
    if (status === "connected") {
      refreshArenaData({ silent: true });
    }
  },
  { immediate: true },
);

onMounted(() => {
  loadTargetWinStats(tokenStore.selectedToken?.id);
  void initArenaPersistForToken(tokenStore.selectedToken?.id);
  loadSkipLineups(tokenStore.selectedToken?.id);
  loadPreferredWinRate(tokenStore.selectedToken?.id);
  if (isConnected.value) {
    refreshArenaData({ silent: true });
  }
});

onBeforeUnmount(() => {
  if (arenaCloudSyncTimer) {
    clearTimeout(arenaCloudSyncTimer);
    arenaCloudSyncTimer = null;
  }
});
</script>

<style scoped lang="scss">
.arena-pvp-container {
  width: 100%;
}

.main-card {
  background: var(--bg-primary);
  border-radius: var(--border-radius-xl);
  padding: 20px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-light);
}

.status-icon {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 12px;
  margin-right: 14px;
}

.status-info h3 {
  margin: 0 0 4px 0;
  font-size: 22px;
  color: var(--text-primary);
}

.status-info p {
  margin: 0;
  color: var(--text-secondary);
}

@media (max-width: 1024px) {
}

@media (max-width: 768px) {
}
</style>
