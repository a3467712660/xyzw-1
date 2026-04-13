<template>
  <MyCard class="lineup-saver" :status-class="{ active: state.isRunning }">
    <template #icon>
      <img
        alt="阵容图标"
        src="/icons/Ob7pyorzmHiJcbab2c25af264d0758b527bc1b61cc3b.png"
      >
    </template>
    <template #title>
      <h3>阵容助手</h3>
      <p>保存阵容、快速切换</p>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? "运行中" : "已停止" }}</span>
    </template>
    <template #default>
      <div class="lineup-container">
        <LineupToolbar
          :editing-hero-count="editingHeroes.length"
          :loading="loading"
          :saved-lineup-count="savedLineups.length"
          @add-hero="openAddHeroModal"
          @refresh="refreshTeamInfo"
          @save-lineup="saveCurrentLineup"
          @show-saved-lineups="savedLineupsModalVisible = true"
        ></LineupToolbar>

        <LineupSlotList
          :available-teams="availableTeams"
          :current-team-id="currentTeamId"
          :current-team-info="currentTeamInfo"
          :drag-over-position="dragOverPosition"
          :dragged-hero-id="draggedHeroId"
          :editing-heroes="editingHeroes"
          :format-power="formatPower"
          :get-fish-info="getFishInfo"
          :get-hero-avatar="getHeroAvatar"
          :get-hero-name="getHeroName"
          :get-pearl-skill-name-by-artifact-id="getPearlSkillNameByArtifactId"
          :get-slot-colors-by-artifact-id="getSlotColorsByArtifactId"
          :switching-team-id="switchingTeamId"
          @drag-end="onDragEnd"
          @drag-leave="onDragLeave"
          @drag-over="onDragOver"
          @drag-start="onDragStart"
          @drop="onDrop"
          @open-exchange="openExchangeModal"
          @open-refine="showHeroRefineModal"
          @remove-hero="removeHero"
          @switch-team="switchTeam"
        ></LineupSlotList>
      </div>

      <LineupApplyProgressModal
        :debug-finished="applyDebugFinished"
        :debug-lineup-name="applyDebugLineupName"
        :debug-mode="applyDebugMode"
        :debug-paused="applyDebugPaused"
        :debug-steps="applyDebugSteps"
        :elapsed-text="applyProgressElapsedText"
        :estimated-text="applyProgressEstimatedText"
        :finish-text="applyProgressFinishText"
        :format-step-status="formatApplyDebugStepStatus"
        :overdue="applyProgressOverdue"
        :percent="applyProgressPercent"
        :remaining-text="applyProgressRemainingText"
        :show="applyProgressVisible"
        :spinning="applyProgressSpinning"
        :stage="applyProgressStage"
        :status="applyProgressStatus"
        @abort-debug="abortApplyDebug"
        @close-debug="closeApplyDebugPanel"
        @continue-debug="continueApplyDebug"
      ></LineupApplyProgressModal>

      <LineupSavedLineupsModal
        v-model:expanded-lineup="expandedLineup"
        v-model:selected-team-tab="selectedTeamTab"
        v-model:show="savedLineupsModalVisible"
        :actions="savedLineupsModalActions"
        :available-teams="availableTeams"
        :current-team-id="currentTeamId"
        :lineup-cloud-loading="lineupCloudLoading"
        :lineup-cloud-syncing="lineupCloudSyncing"
        :saved-lineups="savedLineups"
        :weapon="weapon"
      ></LineupSavedLineupsModal>

      <LineupTechModal
        v-model:show="techModalVisible"
        :selected-tech-data="selectedTechData"
        :tech-max-level="LEGION_TECH_MAX_LEVEL"
        :tech-name="LEGION_TECH_NAME"
        :tech-type-map="LEGION_TECH_TYPE_MAP"
        :tech-type-name="LEGION_TECH_TYPE_NAME"
      ></LineupTechModal>

      <LineupRefineModal
        v-model:show="refineModalVisible"
        :get-attr-name="getAttrName"
        :get-equip-bonus="getEquipBonus"
        :get-equip-slots="getEquipSlots"
        :loading="refineModalLoading"
        :part-map="partMap"
        :selected-hero-equipment="selectedHeroEquipment"
        :title="refineModalTitle"
      ></LineupRefineModal>

      <LineupExchangeModal
        v-model:hero-search-keyword="heroSearchKeyword"
        v-model:selected-country="selectedCountry"
        v-model:selected-quality="selectedQuality"
        v-model:show="exchangeModalVisible"
        :exchange-hero="exchangeHero"
        :exchange-loading="exchangeLoading"
        :exchange-mode="exchangeMode"
        :exchange-target-hero-id="exchangeTargetHeroId"
        :filtered-hero-list="filteredHeroList"
        :get-first-empty-slot="getFirstEmptySlot"
        :get-hero-name="getHeroName"
        :hero-countries="heroCountries"
        :hero-qualities="heroQualities"
        @confirm="confirmHeroAction"
        @select-hero="selectExchangeHero"
      ></LineupExchangeModal>
    </template>
  </MyCard>
</template>

<script setup>
import { computed, h, onMounted, onUnmounted, ref, watch } from "vue";
import { NInput, useDialog, useMessage } from "naive-ui";
import api from "@/api";
import { useAuthStore } from "@/stores/auth";
import { $emit } from "@/stores/events";
import { useTokenStore } from "@/stores/tokenStore";
import {
  acquireTokenOperationLock,
  releaseTokenOperationLock,
} from "@/services/token/tokenOperationCoordination";
import MyCard from "../Common/MyCard.vue";
import LineupApplyProgressModal from "./lineup/LineupApplyProgressModal.vue";
import LineupExchangeModal from "./lineup/LineupExchangeModal.vue";
import LineupRefineModal from "./lineup/LineupRefineModal.vue";
import LineupSavedLineupsModal from "./lineup/LineupSavedLineupsModal.vue";
import LineupSlotList from "./lineup/LineupSlotList.vue";
import LineupTechModal from "./lineup/LineupTechModal.vue";
import LineupToolbar from "./lineup/LineupToolbar.vue";
import {
  buildLineupCloudPrefKey,
  buildLineupStorageKey,
  getAverageApplyDurationMs,
  recordApplyDurationMetric,
} from "./lineup/lineupCloudStorage";
import {
  APPLY_DEBUG_ABORT_ERROR_CODE,
  APPLY_DEBUG_STAGE_DEFS,
} from "./lineup/lineupDebugStages";
import {
  formatLineupPower,
  getLineupFishInfoByArtifactId,
  getLineupFishNameById,
  getLineupHeroDisplayName,
  getLineupPearlDataByArtifactId,
  getLineupPearlSkillNameByArtifactId,
  getLineupPearlSkillNameById,
  getLineupSlotColors,
  getLineupSlotColorsByArtifactId,
} from "./lineup/lineupFormatters";
import {
  buildSavedLineupStore,
  createLineupId,
  normalizeHeroEquipmentSnapshot,
  parseEquipmentQuenchMap,
  toNullableNumber,
  useSavedLineupStorage,
} from "./lineup/useSavedLineupStorage";
import { useLineupApplyProgress } from "./lineup/useLineupApplyProgress";
import {
  color,
  FishMap,
  getTechType,
  HERO_DICT,
  LEGION_TECH_MAX_LEVEL,
  LEGION_TECH_NAME,
  LEGION_TECH_RESET_TYPE_MAP,
  LEGION_TECH_TYPE_MAP,
  LEGION_TECH_TYPE_NAME,
  PearlMap,
  weapon,
} from "@/utils/HeroList.js";

const tokenStore = useTokenStore();
const authStore = useAuthStore();
const message = useMessage();
const dialog = useDialog();

const loading = ref(false);
const switchingTeamId = ref(null);
const currentTeamId = ref(1);
const availableTeams = ref([1, 2, 3, 4, 5, 6]);
const currentTeamInfo = ref(null);
const presetTeamData = ref(null);
const savedLineups = ref([]);
const allHeroesData = ref({});
const roleHeroesData = ref({});
const editingTeamHeroes = ref({});
const artifactBooks = ref({});
const pearlMap = ref({});
let lastRefreshTime = 0;
const REFRESH_DEBOUNCE = 3000;
const COMMAND_DELAY = 500;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const formatPower = formatLineupPower;

const state = ref({
  isRunning: false,
});
const applyDebugMode = ref(false);
const applyDebugPaused = ref(false);
const applyDebugFinished = ref(false);
const applyDebugLineupName = ref("");
const applyDebugSteps = ref([]);
const applyDebugCurrentStepKey = ref("");
let applyDebugResolver = null;
let applyDebugRejecter = null;

const refineModalVisible = ref(false);
const refineModalLoading = ref(false);
const refineModalTitle = ref("");
const selectedHeroEquipment = ref(null);

const exchangeModalVisible = ref(false);
const exchangeLoading = ref(false);
const exchangeMode = ref("exchange");
const exchangeHero = ref(null);
const exchangeTargetHeroId = ref(null);
const heroSearchKeyword = ref("");
const selectedQuality = ref("全部");
const selectedCountry = ref("全部");
const savedLineupsModalVisible = ref(false);
const selectedTeamTab = ref(1);
const expandedLineup = ref(null);
const techModalVisible = ref(false);
const selectedTechData = ref(null);

const draggedHeroId = ref(null);
const dragOverPosition = ref(null);

const getSelectedTokenId = () => String(tokenStore.selectedToken?.id || "").trim();

const getLineupStorageKey = (tokenId = getSelectedTokenId()) =>
  buildLineupStorageKey(tokenId);

const getLineupCloudPrefKey = (tokenId = getSelectedTokenId()) =>
  buildLineupCloudPrefKey(tokenId);

const getEquipmentQuenchColorLevel = (quench) => {
  const normalizeColorText = (value) => {
    const text = String(value || "").trim().toLowerCase();
    if (text === "red" || text === "红色" || text === "红") return 6;
    if (text === "orange" || text === "橙色" || text === "橙") return 5;
    if (text === "purple" || text === "紫色" || text === "紫") return 4;
    if (text === "blue" || text === "蓝色" || text === "蓝") return 3;
    if (text === "green" || text === "绿色" || text === "绿") return 2;
    if (text === "white" || text === "白色" || text === "白") return 1;
    return 0;
  };

  const numericLevel = Number(quench?.colorId ?? quench?.color ?? 0);
  if (Number.isFinite(numericLevel) && numericLevel > 0) {
    return numericLevel;
  }

  return normalizeColorText(quench?.colorId ?? quench?.color ?? "");
};

const detectEquipmentPalette = (levels) => {
  const normalized = (levels || [])
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
  const hasLevel5 = normalized.includes(5);
  const hasLevel7OrAbove = normalized.some((item) => item >= 7);

  if (!hasLevel5 && hasLevel7OrAbove) {
    return { orangeLevel: 6, redThreshold: 7 };
  }

  return { orangeLevel: 5, redThreshold: 6 };
};

const getEquipmentSnapshotPalette = (equipmentSnapshot) => {
  const levels = [];
  for (const part of Object.values(equipmentSnapshot || {})) {
    for (const slot of parseEquipmentQuenchMap(part?.quenches)) {
      const level = getEquipmentQuenchColorLevel(slot);
      if (level > 0) {
        levels.push(level);
      }
    }
  }
  return detectEquipmentPalette(levels);
};

const getEquipmentPartStats = (part, palette) => {
  const slots = parseEquipmentQuenchMap(part?.quenches);
  const coloredCount = slots.filter((slot) => getEquipmentQuenchColorLevel(slot) > 0).length;
  const redCount = slots.filter(
    (slot) => getEquipmentQuenchColorLevel(slot) >= palette.redThreshold,
  ).length;
  const orangeCount = slots.filter(
    (slot) => getEquipmentQuenchColorLevel(slot) === palette.orangeLevel,
  ).length;
  const bonusValue =
    (toNullableNumber(part?.quenchAttackExt) ?? 0)
    + (toNullableNumber(part?.quenchDefenseExt) ?? 0)
    + (toNullableNumber(part?.quenchHpExt) ?? 0);

  return {
    redCount,
    orangeCount,
    coloredCount,
    bonusValue,
  };
};

const getEquipmentMatchScore = (targetEquipment, currentEquipment) => {
  const normalizedTarget = normalizeHeroEquipmentSnapshot(targetEquipment);
  const normalizedCurrent = normalizeHeroEquipmentSnapshot(currentEquipment);

  if (!normalizedTarget || !normalizedCurrent) {
    return {
      exact: false,
      redHit: 0,
      orangeHit: 0,
      coloredHit: 0,
      bonusDiff: Number.POSITIVE_INFINITY,
      hasSignal: false,
    };
  }

  if (JSON.stringify(normalizedTarget) === JSON.stringify(normalizedCurrent)) {
    return {
      exact: true,
      redHit: Number.MAX_SAFE_INTEGER,
      orangeHit: Number.MAX_SAFE_INTEGER,
      coloredHit: Number.MAX_SAFE_INTEGER,
      bonusDiff: 0,
      hasSignal: true,
    };
  }

  const targetPalette = getEquipmentSnapshotPalette(normalizedTarget);
  const currentPalette = getEquipmentSnapshotPalette(normalizedCurrent);
  const partIds = new Set([
    ...Object.keys(normalizedTarget || {}),
    ...Object.keys(normalizedCurrent || {}),
  ]);

  let redHit = 0;
  let orangeHit = 0;
  let coloredHit = 0;
  let bonusDiff = 0;

  for (const partId of partIds) {
    const targetPartStats = getEquipmentPartStats(
      normalizedTarget?.[partId],
      targetPalette,
    );
    const currentPartStats = getEquipmentPartStats(
      normalizedCurrent?.[partId],
      currentPalette,
    );

    redHit += Math.min(targetPartStats.redCount, currentPartStats.redCount);
    orangeHit += Math.min(targetPartStats.orangeCount, currentPartStats.orangeCount);
    coloredHit += Math.min(targetPartStats.coloredCount, currentPartStats.coloredCount);
    bonusDiff += Math.abs(targetPartStats.bonusValue - currentPartStats.bonusValue);
  }

  return {
    exact: false,
    redHit,
    orangeHit,
    coloredHit,
    bonusDiff,
    hasSignal:
      redHit > 0
      || orangeHit > 0
      || coloredHit > 0
      || Number.isFinite(bonusDiff),
  };
};
const {
  clearLineupCloudTimer,
  lineupCloudLoading,
  lineupCloudSyncing,
  loadSavedLineups,
  persistSavedLineups,
  pushSavedLineupsToCloud,
} = useSavedLineupStorage({
  api,
  authStore,
  getSelectedTokenId,
  message,
  savedLineups,
  buildLineupCloudPrefKey: getLineupCloudPrefKey,
  buildLineupStorageKey: getLineupStorageKey,
});

const estimateApplyDurationMsByShape = (lineup) => {
  const heroCount = Array.isArray(lineup?.heroes) ? lineup.heroes.length : 0;
  const hasLevelData = lineup?.heroes?.some((hero) => hero.level && hero.level > 0);
  const hasFishData = lineup?.heroes?.some((hero) => hero.pearlId || hero.fishId);
  const hasEquipmentData = lineup?.heroes?.some(
    (hero) => hero?.equipment && Object.keys(hero.equipment).length > 0,
  );
  const hasTechData =
    lineup?.legionResearch && Object.keys(lineup.legionResearch).length > 0;
  const hasWeaponData = lineup?.weaponId !== undefined && lineup?.weaponId !== null;

  let commandCount = 8;
  commandCount += heroCount * 3;
  if (hasEquipmentData) commandCount += heroCount * 2;
  if (hasLevelData) commandCount += heroCount * 3;
  if (hasFishData) commandCount += heroCount * 3;
  if (hasTechData) commandCount += 16;
  if (hasWeaponData) commandCount += 2;

  return Math.max(20000, commandCount * 1200);
};

const estimateApplyDurationMs = (lineup) => {
  const historyAvg = getAverageApplyDurationMs(lineup?.id, getSelectedTokenId());
  if (historyAvg > 0) {
    return historyAvg;
  }
  return estimateApplyDurationMsByShape(lineup);
};

const {
  applyProgressElapsedMs,
  applyProgressEstimatedText,
  applyProgressElapsedText,
  applyProgressFinishText,
  applyProgressOverdue,
  applyProgressPercent,
  applyProgressRemainingText,
  applyProgressSpinning,
  applyProgressStage,
  applyProgressStartedAt,
  applyProgressStatus,
  applyProgressVisible,
  finishApplyProgress,
  setApplyProgressStage,
  startApplyProgress,
} = useLineupApplyProgress({
  isRunning: computed(() => state.value.isRunning),
  applyDebugMode,
  applyDebugPaused,
  estimateApplyDurationMs,
});

const createDebugAbortError = () => {
  const error = new Error("已手动中止调试");
  error.code = APPLY_DEBUG_ABORT_ERROR_CODE;
  return error;
};

const resetApplyDebugSession = ({ clearSteps = true } = {}) => {
  applyDebugMode.value = false;
  applyDebugPaused.value = false;
  applyDebugFinished.value = false;
  applyDebugLineupName.value = "";
  applyDebugCurrentStepKey.value = "";
  applyDebugResolver = null;
  applyDebugRejecter = null;
  if (clearSteps) {
    applyDebugSteps.value = [];
  }
};

const initApplyDebugSession = (lineup) => {
  applyDebugMode.value = true;
  applyDebugPaused.value = false;
  applyDebugFinished.value = false;
  applyDebugLineupName.value = String(lineup?.name || "").trim();
  applyDebugSteps.value = APPLY_DEBUG_STAGE_DEFS.map((item, index) => ({
    ...item,
    order: index + 1,
    status: "pending",
    detail: "",
    commands: [],
  }));
};

const setApplyDebugStep = (stepKey, patch) => {
  applyDebugSteps.value = applyDebugSteps.value.map((step) =>
    step.key === stepKey ? { ...step, ...patch } : step,
  );
};

const formatApplyDebugStepStatus = (status) => {
  switch (status) {
    case "waiting":
      return "等待执行";
    case "running":
      return "执行中";
    case "success":
      return "已完成";
    case "error":
      return "失败";
    default:
      return "未开始";
  }
};

const normalizeApplyDebugDetail = (detail) => {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (typeof detail === "object" && typeof detail.detail === "string") {
    return detail.detail;
  }
  return "";
};

const formatApplyDebugCommand = (cmd, attempt = 1) =>
  attempt > 1 ? `${cmd}（第${attempt}次）` : String(cmd || "");

const appendApplyDebugCommand = (stepKey, cmd, attempt = 1) => {
  if (!stepKey || !cmd) return;
  const nextCommand = formatApplyDebugCommand(cmd, attempt);
  applyDebugSteps.value = applyDebugSteps.value.map((step) =>
    step.key === stepKey
      ? {
          ...step,
          commands: [...(Array.isArray(step.commands) ? step.commands : []), nextCommand],
        }
      : step,
  );
};

const pauseBeforeApplyDebugStep = async (stepKey, stageLabel) => {
  if (!applyDebugMode.value) return;

  setApplyDebugStep(stepKey, {
    status: "waiting",
    detail: "",
  });
  applyDebugPaused.value = true;
  setApplyProgressStage(`调试暂停：${stageLabel}`);

  await new Promise((resolve, reject) => {
    applyDebugResolver = resolve;
    applyDebugRejecter = reject;
  });

  applyDebugResolver = null;
  applyDebugRejecter = null;
  applyDebugPaused.value = false;
  setApplyDebugStep(stepKey, { status: "running" });
};

const continueApplyDebug = () => {
  if (!applyDebugResolver) return;
  const resolve = applyDebugResolver;
  applyDebugResolver = null;
  applyDebugRejecter = null;
  resolve();
};

const abortApplyDebug = () => {
  const error = createDebugAbortError();
  if (applyDebugRejecter) {
    const reject = applyDebugRejecter;
    applyDebugResolver = null;
    applyDebugRejecter = null;
    applyDebugPaused.value = false;
    reject(error);
    return;
  }

  applyDebugFinished.value = true;
  setApplyProgressStage("已中止调试");
};

const closeApplyDebugPanel = () => {
  finishApplyProgress();
  resetApplyDebugSession();
};

const isTooFastCommandError = (error) => {
  const text = String(error?.message || error || "");
  return text.includes("200400") || text.includes("操作太快") || text.includes("请稍后再试");
};

const isServerBusyCommandError = (error) => {
  const text = String(error?.message || error || "");
  return text.includes("200020") || text.includes("出了点小问题") || text.includes("重启游戏解决");
};

const isDisconnectedCommandError = (error) => {
  const text = String(error?.message || error || "");
  return text.includes("WebSocket未连接") || text.includes("连接已失效");
};

const recoverApplyConnection = async (tokenId) => {
  if (tokenStore.getWebSocketStatus(tokenId) === "connected") {
    return true;
  }

  setApplyProgressStage("连接已断开，5 秒后尝试重新连接");
  await delay(5000);

  if (tokenStore.getWebSocketStatus(tokenId) === "connected") {
    return true;
  }

  const token =
    tokenStore.gameTokens.find((item) => item.id === tokenId)
    || (tokenStore.selectedToken?.id === tokenId ? tokenStore.selectedToken : null);
  if (!token?.token) {
    throw new Error("连接已失效，且无法获取角色凭证进行重连");
  }

  setApplyProgressStage("正在重新连接角色");
  await tokenStore.createWebSocketConnection(tokenId, token.token, token.wsUrl || null);

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    const status = tokenStore.getWebSocketStatus(tokenId);
    if (status === "connected") {
      return true;
    }
    await delay(250);
  }

  throw new Error("重新连接超时，请手动重连角色后再试");
};

const sendRetriedGameCommand = async (
  tokenId,
  cmd,
  params = {},
  {
    maxRetries = 4,
    allowFailure = false,
  } = {},
) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (tokenStore.getWebSocketStatus(tokenId) !== "connected") {
      await recoverApplyConnection(tokenId);
    }
    appendApplyDebugCommand(applyDebugCurrentStepKey.value, cmd, attempt);
    try {
      return await tokenStore.sendMessageWithPromise(tokenId, cmd, params);
    } catch (error) {
      if (isDisconnectedCommandError(error)) {
        if (attempt >= maxRetries) {
          if (allowFailure) {
            return null;
          }
          throw error;
        }
        await recoverApplyConnection(tokenId);
        continue;
      }
      const tooFast = isTooFastCommandError(error);
      const serverBusy = isServerBusyCommandError(error);
      if (!tooFast && !serverBusy) {
        if (allowFailure) {
          return null;
        }
        throw error;
      }

      console.warn(
        `[LineupApplyDiag] command-retry cmd=${cmd} attempt=${attempt} error=${error?.message || String(error)} stage=${applyProgressStage.value || ""}`,
      );

      if (attempt >= maxRetries) {
        if (allowFailure) {
          return null;
        }
        throw error;
      }

      const retryDelayMs = tooFast ? 3000 * attempt : 10000;
      setApplyProgressStage(
        tooFast
          ? `${cmd} 操作过快，等待 ${Math.ceil(retryDelayMs / 1000)} 秒后重试（${attempt}/${maxRetries}）`
          : `${cmd} 被服务器拒绝，等待 ${Math.ceil(retryDelayMs / 1000)} 秒后重试（${attempt}/${maxRetries}）`,
      );
      await delay(retryDelayMs);
    }
  }

  return null;
};

const syncLegionResearch = async (tokenId, targetResearch) => {
  if (!targetResearch || Object.keys(targetResearch).length === 0) {
    return { success: true, message: "无科技数据需要同步" };
  }

  const roleInfo = await sendRetriedGameCommand(
    tokenId,
    "role_getroleinfo",
    {},
    { maxRetries: 3 },
  );
  await delay(COMMAND_DELAY);
  const role = roleInfo?.role || roleInfo;
  const currentResearch = role?.legionResearch || {};

  const typesToReset = new Set();
  const typesToResetResearch = new Set();
  const hasResearchDiff = (techIds) =>
    techIds.some((techId) => {
      const currentLevel = currentResearch[techId] || 0;
      const targetLevel = targetResearch[techId] || 0;
      return currentLevel !== targetLevel && (currentLevel > 0 || targetLevel > 0);
    });
  const needsResearchReset = (techIds) =>
    techIds.some((techId) => {
      const currentLevel = currentResearch[techId] || 0;
      const targetLevel = targetResearch[techId] || 0;
      return currentLevel > targetLevel;
    });

  for (const type of [1, 2, 3, 4, 5, 6]) {
    const techIds = LEGION_TECH_RESET_TYPE_MAP[type];
    if (needsResearchReset(techIds)) {
      typesToResetResearch.add(type);
    }
    const techIds2 = LEGION_TECH_TYPE_MAP[type];
    if (hasResearchDiff(techIds2)) {
      typesToReset.add(type);
    }
  }

  if (typesToResetResearch.size === 0 && typesToReset.size === 0) {
    return { success: true, message: "科技配置已匹配，无需调整" };
  }

  for (const type of [...typesToResetResearch].sort((a, b) => a - b)) {
    try {
      setApplyProgressStage(`正在重置${LEGION_TECH_TYPE_NAME[type] || `类型${type}`}科技`);
      await sendRetriedGameCommand(tokenId, "legion_resetresearch", {
        advanced: false,
        type,
      });
    } catch (err) {
      return {
        success: false,
        message: `${LEGION_TECH_TYPE_NAME[type] || `类型${type}`}科技重置失败：${err?.message || "服务器拒绝"}`,
      };
    }
    await delay(COMMAND_DELAY);
  }

  const sortedTypes = [...typesToReset].sort((a, b) => a - b);

  for (const type of sortedTypes) {
    const techIds2 = LEGION_TECH_TYPE_MAP[type];
    for (const techId of techIds2) {
      const targetLevel = targetResearch[techId] || 0;
      if (targetLevel > 0) {
        const maxLevel = LEGION_TECH_MAX_LEVEL[techId];
        const isMax = targetLevel >= maxLevel;
        if (isMax) {
          try {
            setApplyProgressStage(`正在同步科技配置：${LEGION_TECH_NAME[techId] || techId}`);
            await sendRetriedGameCommand(
              tokenId,
              "legion_research",
              {
                isMax: true,
                researchId: techId,
              },
            );
          } catch (err) {
            return {
              success: false,
              message: `${LEGION_TECH_NAME[techId] || techId}同步失败：${err?.message || "服务器拒绝"}`,
            };
          }
          await delay(COMMAND_DELAY);
        } else {
          for (let i = 0; i < targetLevel; i++) {
            try {
              setApplyProgressStage(
                `正在同步科技配置：${LEGION_TECH_NAME[techId] || techId} (${i + 1}/${targetLevel})`,
              );
              await sendRetriedGameCommand(
                tokenId,
                "legion_research",
                {
                  isMax: false,
                  researchId: techId,
                },
              );
            } catch (err) {
              return {
                success: false,
                message: `${LEGION_TECH_NAME[techId] || techId}同步失败：${err?.message || "服务器拒绝"}`,
              };
            }
            await delay(COMMAND_DELAY);
          }
        }
      }
    }
  }

  return { success: true, message: "科技配置已同步" };
};

const partMap = {
  1: "武器",
  2: "铠甲",
  3: "头冠",
  4: "坐骑",
};

const attrMap = {
  1: "攻击",
  2: "血量",
  3: "防御",
  4: "速度",
  5: "破甲",
  6: "破甲抵抗",
  7: "精准",
  8: "格挡",
  9: "减伤",
  10: "暴击",
  11: "暴击抵抗",
  12: "爆伤",
  13: "爆伤抵抗",
  14: "技能伤害",
  15: "免控",
  16: "眩晕免疫",
  17: "冰冻免疫",
  18: "沉默免疫",
  19: "流血免疫",
  20: "中毒免疫",
  21: "灼烧免疫",
};

const heroQualities = computed(() => {
  return ["全部", "红将", "橙将", "紫将"];
});

const heroCountries = computed(() => {
  const countries = new Set(["全部"]);
  Object.values(HERO_DICT).forEach((hero) => {
    if (hero.type) countries.add(hero.type);
  });
  return Array.from(countries);
});

const getHeroQuality = (heroId) => {
  const prefix = Math.floor(heroId / 100);
  if (prefix === 1) return "红将";
  if (prefix === 2) return "橙将";
  if (prefix === 3) return "紫将";
  return "其他";
};

const getFishInfo = (artifactId) => {
  return getLineupFishInfoByArtifactId(artifactId, artifactBooks.value, FishMap);
};

const getFishNameByArtifactId = (artifactId) => {
  const fishInfo = getFishInfo(artifactId);
  return fishInfo ? fishInfo.name : null;
};

const getFishNameById = (fishId) => {
  return getLineupFishNameById(fishId, FishMap);
};

const getPearlSkillNameById = (skillId) => {
  return getLineupPearlSkillNameById(skillId, PearlMap);
};

const getSlotColors = (slotMap) => {
  return getLineupSlotColors(slotMap, color);
};

const getPearlDataByArtifactId = (artifactId) => {
  return getLineupPearlDataByArtifactId(artifactId, pearlMap.value);
};

const getPearlSkillNameByArtifactId = (artifactId) => {
  return getLineupPearlSkillNameByArtifactId(
    artifactId,
    pearlMap.value,
    PearlMap,
  );
};

const getSlotColorsByArtifactId = (artifactId) => {
  return getLineupSlotColorsByArtifactId(artifactId, pearlMap.value, color);
};

const allHeroList = computed(() => {
  const heroes = Object.entries(roleHeroesData.value).map(([id, hero]) => {
    const heroInfo = HERO_DICT[hero.heroId] || {};
    return {
      id: Number(hero.heroId),
      name: getLineupHeroDisplayName(heroInfo.name, hero.heroId),
      type: heroInfo.type || "未知",
      avatar: heroInfo.avatar || null,
      quality: getHeroQuality(Number(hero.heroId)),
      artifactId: hero.artifactId || null,
      attachmentUid: hero.attachmentUid || null,
      heroData: hero,
    };
  });

  const countryOrder = { 魏国: 1, 蜀国: 2, 吴国: 3, 群雄: 4 };
  const qualityOrder = { 红将: 1, 橙将: 2, 紫将: 3, 其他: 4 };

  return heroes.sort((a, b) => {
    const countryA = countryOrder[a.type] || 99;
    const countryB = countryOrder[b.type] || 99;
    if (countryA !== countryB) return countryA - countryB;

    const qualityA = qualityOrder[a.quality] || 99;
    const qualityB = qualityOrder[b.quality] || 99;
    if (qualityA !== qualityB) return qualityA - qualityB;

    return a.id - b.id;
  });
});

const filteredHeroList = computed(() => {
  let list = allHeroList.value;

  if (selectedQuality.value !== "全部") {
    list = list.filter((hero) => hero.quality === selectedQuality.value);
  }

  if (selectedCountry.value !== "全部") {
    list = list.filter((hero) => hero.type === selectedCountry.value);
  }

  if (heroSearchKeyword.value) {
    const keyword = heroSearchKeyword.value.toLowerCase();
    list = list.filter((hero) => hero.name.toLowerCase().includes(keyword));
  }

  return list;
});

const currentTeamHeroes = computed(() => {
  if (!currentTeamInfo.value) return [];
  const teamInfo = currentTeamInfo.value;
  return Object.entries(teamInfo)
    .map(([key, hero]) => {
      const heroData = roleHeroesData.value[String(hero?.heroId || hero?.id)];
      return {
        position: hero?.battleTeamSlot ?? Number(key),
        heroId: hero?.heroId || hero?.id,
        level: hero?.level || null,
        artifactId: hero?.artifactId || null,
        attachmentUid: hero?.attachmentUid || null,
        power: heroData?.power || null,
        attack: heroData?.attack || null,
        hp: heroData?.hp || null,
        speed: heroData?.speed || null,
      };
    })
    .filter((h) => h.heroId)
    .sort((a, b) => a.position - b.position);
});

const editingHeroes = computed(() => {
  if (Object.keys(editingTeamHeroes.value).length > 0) {
    return Object.entries(editingTeamHeroes.value)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([pos, hero]) => {
        const heroData = roleHeroesData.value[String(hero?.heroId)];
        return {
          position: Number(pos),
          heroId: hero?.heroId,
          level: hero?.level || null,
          artifactId: hero?.artifactId || null,
          attachmentUid: hero?.attachmentUid || null,
          power: heroData?.power || null,
          attack: heroData?.attack || null,
          hp: heroData?.hp || null,
          speed: heroData?.speed || null,
        };
      })
      .filter((h) => h.heroId);
  }
  return currentTeamHeroes.value;
});

const getFirstEmptySlot = () => {
  for (let i = 0; i < 5; i++) {
    const hero = editingHeroes.value.find((h) => h.position === i);
    if (!hero) return i;
  }
  return 0;
};

const getLineupsByTeamId = (teamId) => {
  return savedLineups.value.filter((lineup) => lineup.teamId === teamId);
};

const toggleLineupExpand = (lineup) => {
  if (expandedLineup.value === lineup) {
    expandedLineup.value = null;
  } else {
    expandedLineup.value = lineup;
  }
};

const hasEditingChanges = computed(() => {
  if (Object.keys(editingTeamHeroes.value).length === 0) return false;
  const current = JSON.stringify(
    currentTeamHeroes.value
      .map((h) => `${h.position}:${h.heroId}`)
      .sort()
      .join(","),
  );
  const editing = JSON.stringify(
    editingHeroes.value
      .map((h) => `${h.position}:${h.heroId}`)
      .sort()
      .join(","),
  );
  return current !== editing;
});

const getHeroName = (heroId) => {
  if (!heroId) return null;
  return HERO_DICT[heroId]?.name || null;
};

const resolveHeroName = (heroId) =>
  getLineupHeroDisplayName(getHeroName(heroId), heroId);

const getHeroAvatar = (heroId) => {
  if (!heroId) return null;
  return HERO_DICT[heroId]?.avatar || null;
};

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const formatLevel = (level) => {
  if (!level) return "";
  return String(level);
};

const getAttrName = (attrId) => {
  return attrMap[attrId] || `属性${attrId}`;
};

const getEquipBonus = (partId) => {
  if (!selectedHeroEquipment.value || !selectedHeroEquipment.value[partId]) {
    return 0;
  }
  const equip = selectedHeroEquipment.value[partId];
  const bonusType =
    partId === 1
      ? "quenchAttackExt"
      : partId === 3
        ? "quenchDefenseExt"
        : "quenchHpExt";
  return equip[bonusType] || 0;
};

const getEquipSlots = (partId) => {
  if (!selectedHeroEquipment.value || !selectedHeroEquipment.value[partId]) {
    return [];
  }
  const quenches = selectedHeroEquipment.value[partId].quenches || {};
  const slotList = [];
  const slotKeys = Object.keys(quenches).sort((a, b) => Number(a) - Number(b));

  for (const key of slotKeys) {
    const slotId = Number(key);
    const slot = quenches[key];
    slotList.push({
      id: slotId,
      attrId: slot.attrId || null,
      attrNum: slot.attrNum || 0,
      isLocked: slot.isLocked || slot.locked || false,
      colorId: slot.colorId || 0,
    });
  }

  return slotList;
};

const showHeroRefineModal = async (hero) => {
  refineModalTitle.value = `${resolveHeroName(hero.heroId)} - 装备洗练`;
  refineModalVisible.value = true;
  refineModalLoading.value = true;
  selectedHeroEquipment.value = null;

  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    refineModalLoading.value = false;
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法获取装备信息");
    refineModalLoading.value = false;
    return;
  }

  try {
    const heroData = allHeroesData.value[String(hero.heroId)];
    if (heroData?.equipment) {
      selectedHeroEquipment.value = heroData.equipment;
    } else {
      const roleInfo = await tokenStore.sendMessageWithPromise(
        tokenId,
        "role_getroleinfo",
        {},
      );
      const role = roleInfo?.role || roleInfo;
      const heroes = role?.heroes || {};
      allHeroesData.value = heroes;

      const currentHero = heroes[String(hero.heroId)];
      selectedHeroEquipment.value = currentHero?.equipment || null;
    }

    if (!selectedHeroEquipment.value) {
      message.warning("未找到该武将的装备数据");
    }
  } catch (error) {
  } finally {
    refineModalLoading.value = false;
  }
  await delay(COMMAND_DELAY);
};

const openExchangeModal = (hero) => {
  exchangeMode.value = "exchange";
  exchangeHero.value = hero;
  exchangeTargetHeroId.value = null;
  heroSearchKeyword.value = "";
  selectedQuality.value = "全部";
  selectedCountry.value = "全部";
  exchangeModalVisible.value = true;
};

const openAddHeroModal = () => {
  if (editingHeroes.value.length >= 5) {
    message.warning("阵容已满，无法上阵更多英雄");
    return;
  }
  exchangeMode.value = "add";
  exchangeHero.value = null;
  exchangeTargetHeroId.value = null;
  heroSearchKeyword.value = "";
  selectedQuality.value = "全部";
  selectedCountry.value = "全部";
  exchangeModalVisible.value = true;
};

const selectExchangeHero = (hero) => {
  exchangeTargetHeroId.value = hero.id;
};

const confirmHeroAction = () => {
  if (!exchangeTargetHeroId.value) {
    message.warning("请选择武将");
    return;
  }

  if (Object.keys(editingTeamHeroes.value).length === 0) {
    currentTeamHeroes.value.forEach((h) => {
      editingTeamHeroes.value[h.position] = {
        heroId: h.heroId,
        level: h.level || null,
        artifactId: h.artifactId || null,
        attachmentUid: h.attachmentUid || null,
      };
    });
  }

  if (exchangeMode.value === "add") {
    const slot = getFirstEmptySlot();
    const targetHeroData =
      roleHeroesData.value[String(exchangeTargetHeroId.value)];
    const currentTeamHeroInfo = currentTeamInfo.value?.[slot];
    editingTeamHeroes.value[slot] = {
      heroId: exchangeTargetHeroId.value,
      level: currentTeamHeroInfo?.level || targetHeroData?.level || null,
      artifactId: targetHeroData?.artifactId || null,
      attachmentUid: targetHeroData?.attachmentUid || null,
    };
    message.success(
      `${resolveHeroName(exchangeTargetHeroId.value)} 已上阵到位置 ${slot + 1}`,
    );
  } else {
    if (!exchangeHero.value) {
      message.warning("请选择要更换的武将");
      return;
    }
    const originalArtifactId = exchangeHero.value.artifactId;
    const originalAttachmentUid = exchangeHero.value.attachmentUid;
    const targetHeroData =
      roleHeroesData.value[String(exchangeTargetHeroId.value)];
    editingTeamHeroes.value[exchangeHero.value.position] = {
      heroId: exchangeTargetHeroId.value,
      level: targetHeroData?.level || null,
      artifactId: originalArtifactId,
      attachmentUid: originalAttachmentUid,
    };
    message.success(
      `已将 ${resolveHeroName(exchangeHero.value.heroId)} 更换为 ${resolveHeroName(exchangeTargetHeroId.value)}`,
    );
  }

  exchangeModalVisible.value = false;
};

const removeHero = (hero) => {
  if (Object.keys(editingTeamHeroes.value).length === 0) {
    currentTeamHeroes.value.forEach((h) => {
      editingTeamHeroes.value[h.position] = {
        heroId: h.heroId,
        level: h.level || null,
        artifactId: h.artifactId || null,
        attachmentUid: h.attachmentUid || null,
      };
    });
  }

  delete editingTeamHeroes.value[hero.position];
  message.success(`${resolveHeroName(hero.heroId)} 已下阵`);
};

const onDragStart = (event, hero) => {
  draggedHeroId.value = hero.heroId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(hero));
};

const onDragEnd = () => {
  draggedHeroId.value = null;
  dragOverPosition.value = null;
};

const onDragOver = (event, hero) => {
  if (draggedHeroId.value !== hero.heroId) {
    dragOverPosition.value = hero.position;
  }
};

const onDragLeave = () => {
  dragOverPosition.value = null;
};

const onDrop = (event, targetHero) => {
  event.preventDefault();
  dragOverPosition.value = null;

  if (!draggedHeroId.value || draggedHeroId.value === targetHero.heroId) {
    return;
  }

  const draggedHero = editingHeroes.value.find(
    (h) => h.heroId === draggedHeroId.value,
  );
  if (!draggedHero) return;

  if (Object.keys(editingTeamHeroes.value).length === 0) {
    currentTeamHeroes.value.forEach((h) => {
      editingTeamHeroes.value[h.position] = {
        heroId: h.heroId,
        level: h.level || null,
        artifactId: h.artifactId || null,
        attachmentUid: h.attachmentUid || null,
      };
    });
  }

  const draggedPos = draggedHero.position;
  const targetPos = targetHero.position;

  const draggedHeroData = editingTeamHeroes.value[draggedPos];
  const targetHeroData = editingTeamHeroes.value[targetPos];

  editingTeamHeroes.value[draggedPos] = targetHeroData;
  editingTeamHeroes.value[targetPos] = draggedHeroData;

  message.success(
    `已将 ${resolveHeroName(draggedHero.heroId)} 与 ${resolveHeroName(targetHero.heroId)} 交换位置`,
  );

  draggedHeroId.value = null;
};

const saveLineupsToStorage = (options = {}) => {
  try {
    return persistSavedLineups(options);
  } catch (e) {
    console.error("保存阵容到缓存失败:", e);
    message.error("保存阵容失败");
    return buildSavedLineupStore(savedLineups.value);
  }
};

const refreshTeamInfo = async () => {
  const now = Date.now();
  if (now - lastRefreshTime < REFRESH_DEBOUNCE) {
    return;
  }
  lastRefreshTime = now;

  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法获取数据");
    return;
  }

  loading.value = true;
  try {
    let presetTeamResult = await tokenStore.sendMessageWithPromise(
      tokenId,
      "presetteam_getinfo",
      {},
    );

    const teamsFromGame =
      presetTeamResult?.presetTeamInfo?.presetTeamInfo || {};
    const gameTeamIds = Object.keys(teamsFromGame)
      .filter((k) => /^\d+$/.test(k))
      .map(Number)
      .sort((a, b) => a - b);
    const availableTeamIds = gameTeamIds.length
      ? gameTeamIds
      : [1, 2, 3, 4, 5, 6];

    let targetTeamId = presetTeamResult?.presetTeamInfo?.useTeamId || 1;
    if (!availableTeamIds.includes(targetTeamId)) {
      targetTeamId = availableTeamIds[0];
    }

    const currentIndex = availableTeamIds.indexOf(targetTeamId);
    const otherTeamId =
      availableTeamIds[currentIndex === 0 ? 1 : currentIndex - 1] ||
      availableTeamIds[0];

    if (otherTeamId !== targetTeamId && availableTeamIds.length > 1) {
      await tokenStore.sendMessageWithPromise(tokenId, "presetteam_saveteam", {
        teamId: otherTeamId,
      });

      await delay(COMMAND_DELAY);

      await tokenStore.sendMessageWithPromise(tokenId, "presetteam_saveteam", {
        teamId: targetTeamId,
      });

      await delay(COMMAND_DELAY);
    }

    presetTeamResult = await tokenStore.sendMessageWithPromise(
      tokenId,
      "presetteam_getinfo",
      {},
    );
    await delay(COMMAND_DELAY);

    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
    );
    await delay(COMMAND_DELAY);
    const role = roleInfo?.role || roleInfo;
    roleHeroesData.value = role?.heroes || {};
    allHeroesData.value = role?.heroes || {};
    artifactBooks.value = role?.artifactBooks || {};
    pearlMap.value = role?.pearlMap || {};

    presetTeamData.value = presetTeamResult?.presetTeamInfo;

    if (presetTeamResult) {
      tokenStore.$patch((state) => {
        state.gameData = {
          ...(state.gameData ?? {}),
          presetTeam: presetTeamResult,
        };
      });
    }

    if (presetTeamData.value) {
      const updatedTeamsFromGame = presetTeamData.value.presetTeamInfo || {};
      currentTeamId.value = presetTeamData.value.useTeamId || 1;
      availableTeams.value = availableTeamIds;

      const currentTeam =
        updatedTeamsFromGame[currentTeamId.value] ||
        updatedTeamsFromGame[String(currentTeamId.value)];
      currentTeamInfo.value = currentTeam?.teamInfo || {};
      editingTeamHeroes.value = {};
    }

    message.success("数据已刷新");
  } catch (error) {
    message.error(`获取数据失败: ${error.message}`);
  } finally {
    loading.value = false;
  }
};

const saveCurrentLineup = async () => {
  if (editingHeroes.value.length === 0) {
    message.warning("当前阵容为空，无法保存");
    return;
  }

  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法保存阵容");
    return;
  }

  loading.value = true;

  try {
    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
    );
    await delay(COMMAND_DELAY);

    const role = roleInfo?.role || roleInfo;
    const legionResearch = role?.legionResearch || {};
    const currentArtifactBooks = role?.artifactBooks || {};
    const currentHeroes = role?.heroes || {};
    const pearlMap = role?.pearlMap || {};

    const presetTeamResult = await tokenStore.sendMessageWithPromise(
      tokenId,
      "presetteam_getinfo",
      {},
    );
    await delay(COMMAND_DELAY);

    const presetInfo =
      presetTeamResult?.presetTeamInfo?.presetTeamInfo ||
      presetTeamResult?.presetTeamInfo ||
      {};
    const teamData =
      presetInfo[currentTeamId.value] ||
      presetInfo[String(currentTeamId.value)];
    const weaponId = teamData?.weapon?.weaponId || null;
    const teamInfo = teamData?.teamInfo || {};

    const lineupName = `阵容${currentTeamId.value} - ${new Date().toLocaleTimeString()}`;

    const fishAssignments = {};
    for (const [fishId, book] of Object.entries(currentArtifactBooks)) {
      if (book.artifactId && book.artifactId !== -1) {
        fishAssignments[book.artifactId] = Number(fishId);
      }
    }

    const heroesData = editingHeroes.value.map((hero) => {
      const heroData = currentHeroes[String(hero.heroId)];
      const artifactId = heroData?.artifactId || hero.artifactId || null;
      const teamHeroInfo = teamInfo[hero.position];
      const fishId = artifactId ? fishAssignments[artifactId] : null;
      const pearlId = teamHeroInfo?.pearlId || null;
      const pearlData = pearlMap[pearlId];
      const slotMap = pearlData?.slotMap || null;
      const equipment = normalizeHeroEquipmentSnapshot(heroData?.equipment);
      return {
        position: hero.position,
        heroId: hero.heroId,
        level: teamHeroInfo?.level || null,
        attachmentUid: hero.attachmentUid || null,
        fishId: fishId || null,
        pearlId,
        skillId: pearlData?.skillId || null,
        slotMap,
        power: heroData?.power || null,
        attack: heroData?.attack || null,
        hp: heroData?.hp || null,
        speed: heroData?.speed || null,
        equipment,
      };
    });

    savedLineups.value.unshift({
      id: createLineupId(),
      name: lineupName,
      heroes: heroesData,
      teamId: currentTeamId.value,
      savedAt: Date.now(),
      updatedAt: Date.now(),
      applying: false,
      legionResearch,
      weaponId,
    });

    saveLineupsToStorage();
    message.success(`阵容已保存: ${lineupName}`);
  } catch (error) {
    message.error(`保存阵容失败: ${error.message}`);
  } finally {
    loading.value = false;
  }
};

const LEVEL_ORDER_THRESHOLDS = [
  { level: 100, order: 1 },
  { level: 200, order: 2 },
  { level: 300, order: 3 },
  { level: 500, order: 4 },
  { level: 700, order: 5 },
  { level: 900, order: 6 },
  { level: 1100, order: 7 },
  { level: 1300, order: 8 },
  { level: 1500, order: 9 },
  { level: 1800, order: 10 },
  { level: 2100, order: 11 },
  { level: 2400, order: 12 },
  { level: 2800, order: 13 },
  { level: 3200, order: 14 },
  { level: 3600, order: 15 },
  { level: 4000, order: 16 },
  { level: 4500, order: 17 },
  { level: 5000, order: 18 },
  { level: 5500, order: 19 },
];

const UPGRADE_OPTIONS = [50, 10, 5, 1];

const getNextOrderLevel = (currentLevel) => {
  for (const threshold of LEVEL_ORDER_THRESHOLDS) {
    if (currentLevel < threshold.level) {
      return threshold.level;
    }
  }
  return null;
};

const getOrder = (level) => {
  let order = 0;
  for (const threshold of LEVEL_ORDER_THRESHOLDS) {
    if (level >= threshold.level) {
      order = threshold.order;
    } else {
      break;
    }
  }
  return order;
};

const applyHeroLevel = async (
  tokenId,
  heroId,
  targetLevel,
  currentLevel,
  currentOrder = 0,
  slot = -1,
) => {
  if (!targetLevel || targetLevel <= 0)
    return { success: true, message: "无目标等级" };

  let actualCurrentLevel = currentLevel;
  let actualCurrentOrder = currentOrder;

  if (actualCurrentLevel > targetLevel) {
    if (slot >= 0) {
      try {
        await sendRetriedGameCommand(tokenId, "hero_gobackbattle", {
          slot,
        });
      } catch (err) {}
      await delay(COMMAND_DELAY);
    }

    try {
      const result = await sendRetriedGameCommand(
        tokenId,
        "hero_rebirth",
        {
          heroId,
        },
      );
      if (result?.role?.heroes?.[heroId]?.level !== undefined) {
        actualCurrentLevel = result.role.heroes[heroId].level;
      } else {
        actualCurrentLevel = 1;
      }
      if (result?.role?.heroes?.[heroId]?.order !== undefined) {
        actualCurrentOrder = result.role.heroes[heroId].order;
      } else {
        actualCurrentOrder = 0;
      }
    } catch (err) {}
    await delay(COMMAND_DELAY);

    if (slot >= 0) {
      try {
        await sendRetriedGameCommand(tokenId, "hero_gointobattle", {
          heroId,
          slot,
        });
      } catch (err) {}
      await delay(COMMAND_DELAY);
    }
  }

  const expectedOrder = getOrder(actualCurrentLevel);
  if (actualCurrentOrder < expectedOrder) {
    try {
      const result = await sendRetriedGameCommand(
        tokenId,
        "hero_heroupgradeorder",
        {
          heroId,
        },
      );
      if (result?.role?.heroes?.[heroId]?.order !== undefined) {
        actualCurrentOrder = result.role.heroes[heroId].order;
      } else {
        actualCurrentOrder = expectedOrder;
      }
    } catch (err) {}
    await delay(COMMAND_DELAY);
  }

  if (actualCurrentLevel >= targetLevel) {
    return { success: true, message: "等级已达标" };
  }

  while (actualCurrentLevel < targetLevel) {
    const nextOrderLevel = getNextOrderLevel(actualCurrentLevel);
    const maxAllowed = nextOrderLevel
      ? nextOrderLevel - actualCurrentLevel
      : targetLevel - actualCurrentLevel;
    const remaining = targetLevel - actualCurrentLevel;
    const stepLimit = Math.min(maxAllowed, remaining);

    let upgradeNum = 1;
    for (const num of UPGRADE_OPTIONS) {
      if (num <= stepLimit) {
        upgradeNum = num;
        break;
      }
    }

    try {
      await sendRetriedGameCommand(
        tokenId,
        "hero_heroupgradelevel",
        {
          heroId,
          upgradeNum,
        },
      );
      actualCurrentLevel += upgradeNum;
    } catch (err) {}
    await delay(COMMAND_DELAY);

    if (nextOrderLevel && actualCurrentLevel >= nextOrderLevel) {
      try {
        const result = await sendRetriedGameCommand(
          tokenId,
          "hero_heroupgradeorder",
          {
            heroId,
          },
        );
        if (result?.role?.heroes?.[heroId]?.order !== undefined) {
          actualCurrentOrder = result.role.heroes[heroId].order;
        } else {
          actualCurrentOrder++;
        }
      } catch (err) {}
      await delay(COMMAND_DELAY);
    }
  }

  return { success: true, message: `等级已升至 ${actualCurrentLevel}` };
};

const applyLineup = async (lineup, options = {}) => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const debugMode = Boolean(options?.debug);

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法应用阵容");
    return;
  }

  if (lineup.teamId !== currentTeamId.value) {
    message.warning(
      `此阵容仅适用于阵容槽位 ${lineup.teamId}，当前槽位为 ${currentTeamId.value}`,
    );
    return;
  }

  const lockResult = acquireTokenOperationLock(tokenId, "lineup-apply", {
    lineupId: lineup.id || null,
    lineupName: lineup.name || "",
    teamId: Number(lineup.teamId || 0) || 0,
  });
  if (!lockResult.ok) {
    message.warning("当前账号正在执行其他操作，请稍后再试");
    return;
  }
  const applyOperationLockId = lockResult.lock.lockId;

  lineup.applying = true;
  state.value.isRunning = true;
  if (debugMode) {
    initApplyDebugSession(lineup);
  } else {
    resetApplyDebugSession();
  }
  startApplyProgress(lineup);
  const errors = [];
  let lastFetchLatestDataAt = 0;
  const FETCH_LATEST_DATA_MIN_INTERVAL = 1800;
  let liveBattleTeamCache = null;

  const getTeamHeroes = (teamInfo) => {
    if (!teamInfo) return [];
    return Object.entries(teamInfo)
      .map(([key, hero]) => ({
        position: hero?.battleTeamSlot ?? Number(key),
        heroId: hero?.heroId || hero?.id,
        artifactId: hero?.artifactId || null,
        attachmentUid: hero?.attachmentUid || null,
      }))
      .filter((h) => h.heroId)
      .sort((a, b) => a.position - b.position);
  };

  const buildTeamHeroesFromSyncResp = (roleData = {}) => {
    const battleTeam = roleData?.battleTeam || {};
    const heroesData = roleData?.heroes || {};
    const teamHeroes = Object.entries(battleTeam)
      .map(([slot, hero]) => {
        const heroId = Number(hero?.heroId || hero?.id || 0) || null;
        if (!heroId) return null;
        const heroData =
          heroesData[String(heroId)] || heroesData[heroId] || {};
        return {
          position: Number(heroData?.battleTeamSlot ?? slot) || Number(slot),
          heroId,
          artifactId: hero?.artifactId || heroData?.artifactId || null,
          attachmentUid: hero?.attachmentUid || heroData?.attachmentUid || null,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.position - b.position);

    return teamHeroes.length > 0 ? teamHeroes : null;
  };

  const seedLiveBattleTeamCache = (teamInfo = {}) => {
    if (liveBattleTeamCache?.heroes?.length) {
      return;
    }
    const teamHeroes = getTeamHeroes(teamInfo);
    if (teamHeroes.length > 0) {
      liveBattleTeamCache = {
        heroes: teamHeroes,
        updatedAt: Date.now(),
        source: "snapshot",
      };
    }
  };

  const getPositionAwareTeamHeroes = (teamInfo = {}) => {
    if (liveBattleTeamCache?.heroes?.length) {
      return liveBattleTeamCache.heroes
        .map((hero) => ({ ...hero }))
        .sort((a, b) => a.position - b.position);
    }
    return getTeamHeroes(teamInfo);
  };

  const handleApplySyncResp = (session) => {
    if (session?.tokenId !== tokenId) {
      return;
    }
    const syncedHeroes = buildTeamHeroesFromSyncResp(session?.body?.role || {});
    if (!syncedHeroes) {
      return;
    }
    liveBattleTeamCache = {
      heroes: syncedHeroes,
      updatedAt: Number(session?.body?.time || Date.now()) || Date.now(),
      source: "syncresp",
    };
  };

  const isTooFastError = (error) => {
    const text = String(error?.message || error || "");
    return text.includes("200400") || text.includes("操作太快") || text.includes("请稍后再试");
  };

  const isServerBusyError = (error) => {
    const text = String(error?.message || error || "");
    return text.includes("200020") || text.includes("出了点小问题") || text.includes("重启游戏解决");
  };

  const isBenignApplyNoopError = (cmd, error) => {
    const text = String(error?.message || error || "");
    if (cmd === "artifact_unload" && text.includes("400150")) {
      return true;
    }
    return false;
  };

  const sendApplyReadCommand = async (cmd, params = {}, maxRetries = 2) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (tokenStore.getWebSocketStatus(tokenId) !== "connected") {
        await recoverApplyConnection(tokenId);
      }
      appendApplyDebugCommand(applyDebugCurrentStepKey.value, cmd, attempt);
      try {
        return await tokenStore.sendMessageWithPromise(tokenId, cmd, params);
      } catch (error) {
        if (isDisconnectedCommandError(error)) {
          if (attempt >= maxRetries) {
            throw error;
          }
          await recoverApplyConnection(tokenId);
          continue;
        }
        if (!isTooFastError(error) || attempt >= maxRetries) {
          throw error;
        }
        const retryDelayMs = 5000;
        setApplyProgressStage(
          `读取账号状态过快，等待 ${Math.ceil(retryDelayMs / 1000)} 秒后重试（${attempt}/${maxRetries}）`,
        );
        await delay(retryDelayMs);
      }
    }
    throw new Error(`命令 ${cmd} 重试后仍未成功执行`);
  };

  const sendApplyActionCommand = async (
    cmd,
    params = {},
    { maxRetries = 2, allowFailure = false } = {},
  ) => {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (tokenStore.getWebSocketStatus(tokenId) !== "connected") {
        await recoverApplyConnection(tokenId);
      }
      appendApplyDebugCommand(applyDebugCurrentStepKey.value, cmd, attempt);
      try {
        return await tokenStore.sendMessageWithPromise(tokenId, cmd, params);
      } catch (error) {
        if (isDisconnectedCommandError(error)) {
          if (attempt >= maxRetries) {
            if (allowFailure) {
              return null;
            }
            throw error;
          }
          await recoverApplyConnection(tokenId);
          continue;
        }
        if (isBenignApplyNoopError(cmd, error)) {
          console.warn(
            `[LineupApplyDiag] command-noop cmd=${cmd} attempt=${attempt} error=${error?.message || String(error)} stage=${applyProgressStage.value || ""}`,
          );
          return { ignored: true };
        }
        const tooFast = isTooFastError(error);
        const serverBusy = isServerBusyError(error);
        if (!tooFast && !serverBusy) {
          console.error(
            `[LineupApplyDiag] command-failed cmd=${cmd} attempt=${attempt} error=${error?.message || String(error)} stage=${applyProgressStage.value || ""}`,
          );
          if (allowFailure) {
            return null;
          }
          throw error;
        }
        console.warn(
          `[LineupApplyDiag] command-retry cmd=${cmd} attempt=${attempt} error=${error?.message || String(error)} stage=${applyProgressStage.value || ""}`,
        );
        if (attempt >= maxRetries) {
          console.error(
            `[LineupApplyDiag] command-abort cmd=${cmd} attempt=${attempt} error=${error?.message || String(error)} stage=${applyProgressStage.value || ""}`,
          );
          if (allowFailure) {
            return null;
          }
          throw error;
        }
        const retryDelayMs = 5000;
        setApplyProgressStage(
          tooFast
            ? `${cmd} 操作过快，等待 ${Math.ceil(retryDelayMs / 1000)} 秒后重试（${attempt}/${maxRetries}）`
            : `${cmd} 被服务器拒绝，等待 ${Math.ceil(retryDelayMs / 1000)} 秒后重试（${attempt}/${maxRetries}）`,
        );
        await delay(retryDelayMs);
      }
    }
    return null;
  };

  const fetchLatestData = async (teamId = null) => {
    const now = Date.now();
    const waitMs = Math.max(
      0,
      FETCH_LATEST_DATA_MIN_INTERVAL - (now - lastFetchLatestDataAt),
    );
    if (waitMs > 0) {
      await delay(waitMs);
    }

    const roleInfo = await sendApplyReadCommand("role_getroleinfo", {});
    lastFetchLatestDataAt = Date.now();
    await delay(COMMAND_DELAY);
    const presetTeam = await sendApplyReadCommand("presetteam_getinfo", {});
    await delay(COMMAND_DELAY);
    const heroes = roleInfo?.role?.heroes || roleInfo?.heroes || {};
    const pearlMapData = roleInfo?.role?.pearlMap || roleInfo?.pearlMap || {};
    const artifactBooksData =
      roleInfo?.role?.artifactBooks || roleInfo?.artifactBooks || {};
    roleHeroesData.value = heroes;
    const targetTeamId = teamId || currentTeamId.value;
    const team =
      presetTeam?.presetTeamInfo?.presetTeamInfo?.[targetTeamId] ||
      presetTeam?.presetTeamInfo?.presetTeamInfo?.[String(targetTeamId)];
    seedLiveBattleTeamCache(team?.teamInfo || {});
    return {
      heroes,
      teamInfo: team?.teamInfo || {},
      pearlMap: pearlMapData,
      artifactBooks: artifactBooksData,
    };
  };

  const isIgnorableError = (err) => {
    const msg = err.message || "";
    return msg.includes("200020");
  };

  $emit.on("syncresp", handleApplySyncResp);

  try {
    const targetHeroes = [...lineup.heroes];
    const targetHeroIds = new Set(targetHeroes.map((h) => Number(h.heroId)));
    const targetByPosition = new Map(
      targetHeroes.map((hero) => [Number(hero.position), hero]),
    );

    const runApplyStage = async (stepKey, stageLabel, runner) => {
      await pauseBeforeApplyDebugStep(stepKey, stageLabel);
      if (applyDebugMode.value) {
        applyDebugCurrentStepKey.value = stepKey;
        setApplyDebugStep(stepKey, {
          status: "running",
          detail: "",
          commands: [],
        });
      }

      try {
        if (stepKey !== "read_current_snapshot") {
          setApplyProgressStage(`${stageLabel}：正在查看当前阵容`);
          await syncLatestSnapshot();
        }
        setApplyProgressStage(stageLabel);
        const result = await runner();
        if (applyDebugMode.value) {
          setApplyDebugStep(stepKey, {
            status: "success",
            detail: normalizeApplyDebugDetail(result),
          });
          applyDebugCurrentStepKey.value = "";
        }
        return result;
      } catch (error) {
        if (applyDebugMode.value) {
          setApplyDebugStep(stepKey, {
            status: "error",
            detail: error?.message || String(error),
          });
          applyDebugFinished.value = true;
          applyDebugCurrentStepKey.value = "";
        }
        throw error;
      }
    };

    const getLineupSlotCandidates = (heroesInTeam = []) => {
      const positions = [
        ...heroesInTeam.map((hero) => Number(hero.position)),
        ...targetHeroes.map((hero) => Number(hero.position)),
      ].filter((position) => Number.isFinite(position));
      const slotBase = positions.includes(0) ? 0 : 1;
      return Array.from({ length: 5 }, (_, index) => slotBase + index);
    };

    const getArtifactIdForTargetHero = (
      targetHero,
      pearlMapData = {},
      artifactBooksData = {},
    ) => {
      if (targetHero?.fishId != null) {
        const book =
          artifactBooksData[String(targetHero.fishId)] ||
          artifactBooksData[targetHero.fishId] ||
          null;
        const artifactId = Number(book?.artifactId || 0) || null;
        if (artifactId && artifactId !== -1) {
          return artifactId;
        }
      }

      if (targetHero?.pearlId) {
        const pearlData =
          pearlMapData[String(targetHero.pearlId)] ||
          pearlMapData[targetHero.pearlId] ||
          null;
        const artifactId = Number(pearlData?.artifactId || 0) || null;
        if (artifactId && artifactId !== -1) {
          return artifactId;
        }
      }

      return null;
    };

    const getPearlSkillId = (pearlMapData = {}, pearlId) => {
      if (!pearlId) return null;
      const pearlData =
        pearlMapData[String(pearlId)] || pearlMapData[pearlId] || null;
      return Number(pearlData?.skillId || 0) || null;
    };

    const findPearlSkillHolderId = (
      pearlMapData = {},
      skillId,
      currentPearlId = null,
    ) => {
      const targetSkillId = Number(skillId || 0) || null;
      const excludedPearlId = Number(currentPearlId || 0) || null;
      if (!targetSkillId) return null;

      for (const [pearlId, pearlData] of Object.entries(pearlMapData || {})) {
        const numericPearlId = Number(pearlId || 0) || null;
        if (!numericPearlId || numericPearlId === excludedPearlId) {
          continue;
        }
        const currentSkillId = Number(pearlData?.skillId || 0) || null;
        if (currentSkillId === targetSkillId) {
          return numericPearlId;
        }
      }

      return null;
    };

    const buildArtifactToHeroMap = (heroesData = {}, teamInfoData = {}) => {
      const result = {};

      for (const teamHero of Object.values(teamInfoData || {})) {
        const heroId = Number(teamHero?.heroId || teamHero?.id || 0) || null;
        const artifactId = Number(teamHero?.artifactId || 0) || null;
        if (heroId && artifactId && artifactId !== -1) {
          result[artifactId] = heroId;
        }
      }

      for (const [heroId, hero] of Object.entries(heroesData || {})) {
        const numericHeroId = Number(heroId || 0) || null;
        const artifactId = Number(hero?.artifactId || 0) || null;
        if (numericHeroId && artifactId && artifactId !== -1 && !result[artifactId]) {
          result[artifactId] = numericHeroId;
        }
      }

      return result;
    };

    const getCurrentArtifactIdForTargetHero = (
      targetHero,
      heroesData = {},
      teamInfoData = {},
    ) => {
      if (!targetHero?.heroId) return null;

      const teamHero =
        teamInfoData?.[targetHero.position] ||
        teamInfoData?.[String(targetHero.position)] ||
        null;
      if (Number(teamHero?.heroId || teamHero?.id || 0) === Number(targetHero.heroId)) {
        return Number(teamHero?.artifactId || 0) || null;
      }

      const heroData =
        heroesData[String(targetHero.heroId)] || heroesData[targetHero.heroId] || {};
      return Number(heroData?.artifactId || 0) || null;
    };

    const isTargetLineupMatched = (teamHeroes = []) => {
      if (teamHeroes.length !== targetHeroes.length) {
        return false;
      }
      return targetHeroes.every((targetHero) => {
        const currentHero = teamHeroes.find(
          (hero) => Number(hero.position) === Number(targetHero.position),
        );
        return Number(currentHero?.heroId || 0) === Number(targetHero.heroId);
      });
    };

    const isTargetFishMatched = (
      teamInfoData = {},
      heroesData = {},
      pearlMapData = {},
      artifactBooksData = {},
    ) =>
      targetHeroes.every((targetHero) => {
        const expectedArtifactId = getArtifactIdForTargetHero(
          targetHero,
          pearlMapData,
          artifactBooksData,
        );
        const teamHero =
          teamInfoData?.[targetHero.position] ||
          teamInfoData?.[String(targetHero.position)] ||
          null;
        if (Number(teamHero?.heroId || teamHero?.id || 0) !== Number(targetHero.heroId)) {
          return false;
        }
        const currentArtifactId = getCurrentArtifactIdForTargetHero(
          targetHero,
          heroesData,
          teamInfoData,
        );
        if ((expectedArtifactId || null) !== (currentArtifactId || null)) {
          return false;
        }
        const currentPearlId = Number(teamHero?.pearlId || 0) || null;
        if ((Number(targetHero?.pearlId || 0) || null) !== (currentPearlId || null)) {
          return false;
        }
        const currentSkillId = getPearlSkillId(pearlMapData, currentPearlId);
        const targetSkillId = Number(targetHero?.skillId || 0) || null;
        return (currentSkillId || null) === (targetSkillId || null);
      });

    const doesTargetHeroExpectFish = (targetHero) =>
      Boolean(
        Number(targetHero?.fishId || 0) || Number(targetHero?.pearlId || 0),
      );

    const getLatestFishSyncState = async () => {
      const latestData = await fetchLatestData();
      const latestHeroesData = latestData.heroes || {};
      const latestTeamInfoData = latestData.teamInfo || {};
      return {
        latestHeroesData,
        latestTeamInfoData,
        latestPearlMap: latestData.pearlMap || {},
        latestArtifactBooks: latestData.artifactBooks || {},
        artifactToHero: buildArtifactToHeroMap(
          latestHeroesData,
          latestTeamInfoData,
        ),
      };
    };

    const isArtifactAssignedToTargetHero = (
      targetHero,
      expectedArtifactId,
      heroesData = {},
      teamInfoData = {},
      artifactToHeroMap = {},
    ) => {
      const normalizedExpectedArtifactId = Number(expectedArtifactId || 0) || null;
      const currentArtifactId = getCurrentArtifactIdForTargetHero(
        targetHero,
        heroesData,
        teamInfoData,
      );
      if ((currentArtifactId || null) !== (normalizedExpectedArtifactId || null)) {
        return false;
      }
      if (!normalizedExpectedArtifactId) {
        return true;
      }
      const holderId = Number(
        artifactToHeroMap?.[normalizedExpectedArtifactId] || 0,
      ) || null;
      return !holderId || holderId === Number(targetHero?.heroId || 0);
    };

    const getEquipmentReview = (heroesData = {}) => {
      const mismatched = [];

      for (const targetHero of targetHeroes) {
        const targetEquipment = normalizeHeroEquipmentSnapshot(targetHero?.equipment);
        if (!targetEquipment) {
          continue;
        }

        const heroData =
          heroesData[String(targetHero.heroId)] || heroesData[targetHero.heroId] || {};
        const currentEquipment = normalizeHeroEquipmentSnapshot(heroData?.equipment);

        if (JSON.stringify(currentEquipment) !== JSON.stringify(targetEquipment)) {
          mismatched.push({
            heroId: Number(targetHero.heroId),
            heroName: resolveHeroName(targetHero.heroId),
          });
        }
      }

      return {
        success: mismatched.length === 0,
        mismatched,
      };
    };

    const findBestEquipmentHolderForTarget = (
      targetHero,
      heroesData = {},
      teamInfoData = {},
    ) => {
      const targetEquipment = normalizeHeroEquipmentSnapshot(targetHero?.equipment);
      if (!targetEquipment) {
        return null;
      }

      const teamHeroIds = new Set(
        getTeamHeroes(teamInfoData).map((hero) => Number(hero.heroId)),
      );
      const candidates = [];

      for (const [heroId, heroData] of Object.entries(heroesData)) {
        const candidateHeroId = Number(heroId);
        if (!candidateHeroId) continue;
        if (candidateHeroId === Number(targetHero.heroId)) continue;

        const score = getEquipmentMatchScore(targetEquipment, heroData?.equipment);
        if (!score.hasSignal) continue;

        candidates.push({
          ...score,
          heroId: candidateHeroId,
          inTeam: teamHeroIds.has(candidateHeroId),
        });
      }

      candidates.sort((left, right) => {
        if (left.exact !== right.exact) {
          return left.exact ? -1 : 1;
        }
        if (left.redHit !== right.redHit) {
          return right.redHit - left.redHit;
        }
        if (left.orangeHit !== right.orangeHit) {
          return right.orangeHit - left.orangeHit;
        }
        if (left.coloredHit !== right.coloredHit) {
          return right.coloredHit - left.coloredHit;
        }
        if (left.bonusDiff !== right.bonusDiff) {
          return left.bonusDiff - right.bonusDiff;
        }
        if (left.inTeam !== right.inTeam) {
          return left.inTeam ? -1 : 1;
        }
        return left.heroId - right.heroId;
      });

      return candidates[0] || null;
    };

    const exchangeHeroesLosslessly = async (
      sourceHeroId,
      targetHeroId,
      teamInfoData = {},
    ) => {
      if (!sourceHeroId || !targetHeroId || Number(sourceHeroId) === Number(targetHeroId)) {
        return false;
      }

      const directExchange = await sendApplyActionCommand(
        "hero_exchange",
        {
          heroId: sourceHeroId,
          targetHeroId,
        },
        { allowFailure: true },
      );
      if (directExchange) {
        await delay(COMMAND_DELAY);
        return true;
      }

      const teamHeroes = getTeamHeroes(teamInfoData);
      const teamHeroIds = new Set(teamHeroes.map((hero) => Number(hero.heroId)));
      if (teamHeroIds.has(Number(sourceHeroId)) || teamHeroIds.has(Number(targetHeroId))) {
        return false;
      }

      const occupiedSlots = new Set(teamHeroes.map((hero) => Number(hero.position)));
      const emptySlots = getLineupSlotCandidates(teamHeroes).filter(
        (slot) => !occupiedSlots.has(slot),
      );
      if (teamHeroes.length >= 4 || emptySlots.length < 2) {
        return false;
      }

      const [sourceTempSlot, targetTempSlot] = emptySlots;
      const sourceMoved = await sendApplyActionCommand(
        "hero_gointobattle",
        {
          heroId: sourceHeroId,
          slot: sourceTempSlot,
        },
        { allowFailure: true },
      );
      if (!sourceMoved) {
        return false;
      }
      await delay(COMMAND_DELAY);

      const targetMoved = await sendApplyActionCommand(
        "hero_gointobattle",
        {
          heroId: targetHeroId,
          slot: targetTempSlot,
        },
        { allowFailure: true },
      );
      if (!targetMoved) {
        return false;
      }
      await delay(COMMAND_DELAY);

      const exchanged = await sendApplyActionCommand(
        "hero_exchange",
        {
          heroId: sourceHeroId,
          targetHeroId,
        },
        { allowFailure: true },
      );
      if (!exchanged) {
        return false;
      }

      await delay(COMMAND_DELAY);
      return true;
    };

    const syncLatestSnapshot = async () => {
      const latestData = await fetchLatestData();
      heroes = latestData.heroes || {};
      teamInfo = latestData.teamInfo || {};
      currentHeroes = getPositionAwareTeamHeroes(teamInfo);
      return latestData;
    };

    const runEquipmentExchangePass = async ({
      stageLabel = "按装备洗练无损换将",
      successMessagePrefix = "已按装备洗练无损切换",
      skipMessage = "该阵容未保存装备洗练，跳过此步",
      initialReview = null,
    } = {}) => {
      if (!hasEquipmentData) {
        return skipMessage;
      }

      const beforeData = initialReview?.data || await syncLatestSnapshot();
      const beforeReview = initialReview?.review || getEquipmentReview(beforeData.heroes || {});
      if (beforeReview.success) {
        return "装备洗练已匹配，无需调整";
      }

      let equipmentExchangeCount = 0;

      for (const targetHero of targetHeroes) {
        const targetEquipment = normalizeHeroEquipmentSnapshot(targetHero?.equipment);
        if (!targetEquipment) {
          continue;
        }

        setApplyProgressStage(
          `${stageLabel}：正在分析 ${resolveHeroName(targetHero.heroId)}`,
        );

        const latestData = await fetchLatestData();
        const latestHeroesData = latestData.heroes || {};
        const latestTeamInfo = latestData.teamInfo || {};
        const currentHeroData =
          latestHeroesData[String(targetHero.heroId)] ||
          latestHeroesData[targetHero.heroId] ||
          {};
        const currentScore = getEquipmentMatchScore(
          targetEquipment,
          currentHeroData?.equipment,
        );
        if (currentScore.exact) {
          continue;
        }

        const candidate = findBestEquipmentHolderForTarget(
          targetHero,
          latestHeroesData,
          latestTeamInfo,
        );
        if (!candidate || Number(candidate.heroId) === Number(targetHero.heroId)) {
          continue;
        }

        const exchanged = await exchangeHeroesLosslessly(
          candidate.heroId,
          targetHero.heroId,
          latestTeamInfo,
        );
        if (exchanged) {
          equipmentExchangeCount++;
        }
      }

      if (equipmentExchangeCount > 0) {
        message.success(`${successMessagePrefix} ${equipmentExchangeCount} 名武将`);
      }

      const afterData = await syncLatestSnapshot();
      const afterReview = getEquipmentReview(afterData.heroes || {});
      if (afterReview.success) {
        return equipmentExchangeCount > 0
          ? `已无损切换 ${equipmentExchangeCount} 名武将`
          : "装备洗练已匹配，无需调整";
      }

      return equipmentExchangeCount > 0
        ? `已无损切换 ${equipmentExchangeCount} 名武将，仍有 ${afterReview.mismatched.length} 名武将存在装备差异`
        : `检测到 ${afterReview.mismatched.length} 名武将存在装备差异，未找到更合适的换将目标`;
    };

    const runLineupPositionPass = async ({
      progressLabel = "正在按目标站位切换武将",
      successSummary = "已整理站位",
      unchangedSummary = "站位已匹配，无需调整",
    } = {}) => {
      setApplyProgressStage("正在校验第一轮站位结果");
      await syncLatestSnapshot();

      setApplyProgressStage(progressLabel);
      let directMoveCount = 0;
      let positionedCount = 0;
      const orderedTargetHeroes = Array.from(targetByPosition.values()).sort(
        (left, right) => Number(left.position) - Number(right.position),
      );

      for (const targetHero of orderedTargetHeroes) {
        await syncLatestSnapshot();

        const heroAtTargetSlot = currentHeroes.find(
          (hero) => Number(hero.position) === Number(targetHero.position),
        );
        const currentTargetHero = currentHeroes.find(
          (hero) => Number(hero.heroId) === Number(targetHero.heroId),
        );

        if (Number(heroAtTargetSlot?.heroId || 0) === Number(targetHero.heroId)) {
          continue;
        }

        if (heroAtTargetSlot) {
          const moved = await sendApplyActionCommand(
            "hero_gointobattle",
            {
              heroId: targetHero.heroId,
              slot: targetHero.position,
            },
            { allowFailure: true },
          );
          if (moved) {
            directMoveCount++;
          }
          await delay(COMMAND_DELAY);
          continue;
        }

        if (!currentTargetHero) {
          const moved = await sendApplyActionCommand(
            "hero_gointobattle",
            {
              heroId: targetHero.heroId,
              slot: targetHero.position,
            },
            { allowFailure: true },
          );
          if (moved) {
            positionedCount++;
          }
          await delay(COMMAND_DELAY);
          continue;
        }

        if (Number(currentTargetHero.position) !== Number(targetHero.position)) {
          const removed = await sendApplyActionCommand(
            "hero_gobackbattle",
            {
              slot: currentTargetHero.position,
            },
            { allowFailure: true },
          );
          await delay(COMMAND_DELAY);
          const moved = await sendApplyActionCommand(
            "hero_gointobattle",
            {
              heroId: targetHero.heroId,
              slot: targetHero.position,
            },
            { allowFailure: true },
          );
          if (removed || moved) {
            positionedCount++;
          }
          await delay(COMMAND_DELAY);
        }
      }

      await syncLatestSnapshot();
      return directMoveCount > 0 || positionedCount > 0
        ? `${successSummary}：直接到位 ${directMoveCount} 名，补位或修正 ${positionedCount} 名`
        : unchangedSummary;
    };

    const ensureFinalLineupMatches = async () => {
      for (let attempt = 1; attempt <= 2; attempt++) {
        setApplyProgressStage(`正在复核最终阵容（${attempt}/2）`);
        let latestData = await fetchLatestData();
        let latestHeroes = getPositionAwareTeamHeroes(latestData.teamInfo);
        if (isTargetLineupMatched(latestHeroes)) {
          return { success: true, repaired: attempt > 1 };
        }

        for (const targetHero of targetHeroes) {
          latestData = await fetchLatestData();
          latestHeroes = getPositionAwareTeamHeroes(latestData.teamInfo);
          const currentByPosition = new Map(
            latestHeroes.map((hero) => [Number(hero.position), hero]),
          );
          const currentByHeroId = new Map(
            latestHeroes.map((hero) => [Number(hero.heroId), hero]),
          );
          const heroAtTarget = currentByPosition.get(Number(targetHero.position)) || null;
          const targetCurrentHero =
            currentByHeroId.get(Number(targetHero.heroId)) || null;

          if (Number(heroAtTarget?.heroId || 0) === Number(targetHero.heroId)) {
            continue;
          }

          if (heroAtTarget && Number(heroAtTarget.heroId) !== Number(targetHero.heroId)) {
            const exchanged = await sendApplyActionCommand(
              "hero_exchange",
              {
                heroId: heroAtTarget.heroId,
                targetHeroId: targetHero.heroId,
              },
              { allowFailure: true },
            );
            if (exchanged) {
              await delay(COMMAND_DELAY);
              continue;
            }
          }

          if (targetCurrentHero && Number(targetCurrentHero.position) !== Number(targetHero.position)) {
            await sendApplyActionCommand(
              "hero_gobackbattle",
              {
                slot: targetCurrentHero.position,
              },
              { allowFailure: true },
            );
            await delay(COMMAND_DELAY);
          }

          await sendApplyActionCommand(
            "hero_gointobattle",
            {
              heroId: targetHero.heroId,
              slot: targetHero.position,
            },
            { allowFailure: true },
          );
          await delay(COMMAND_DELAY);
        }

        latestData = await fetchLatestData();
        latestHeroes = getPositionAwareTeamHeroes(latestData.teamInfo);
        if (isTargetLineupMatched(latestHeroes)) {
          return { success: true, repaired: true };
        }
      }

      return { success: false, repaired: false };
    };

    const ensureFinalFishArtifactsMatch = async () => {
      const hasFishData = targetHeroes.some((hero) => hero.pearlId || hero.fishId);
      if (!hasFishData) {
        return { success: true, repaired: false };
      }

      for (let attempt = 1; attempt <= 2; attempt++) {
        setApplyProgressStage(`正在复核最终鱼灵（${attempt}/2）`);
        let latestData = await fetchLatestData();
        if (
          isTargetFishMatched(
            latestData.teamInfo || {},
            latestData.heroes || {},
            latestData.pearlMap || {},
            latestData.artifactBooks || {},
          )
        ) {
          return { success: true, repaired: attempt > 1 };
        }

        const noopClearedTargetHeroIds = new Set();
        const noopReleasedArtifactIds = new Set();

        for (const targetHero of targetHeroes) {
          const {
            latestHeroesData: currentHeroesData,
            latestTeamInfoData: currentTeamInfoData,
            latestPearlMap: currentPearlMap,
            latestArtifactBooks: currentArtifactBooks,
            artifactToHero,
          } = await getLatestFishSyncState();
          const expectedArtifactId = getArtifactIdForTargetHero(
            targetHero,
            currentPearlMap,
            currentArtifactBooks,
          );
          const currentArtifactId = getCurrentArtifactIdForTargetHero(
            targetHero,
            currentHeroesData,
            currentTeamInfoData,
          );
          const currentHolderId = expectedArtifactId
            ? artifactToHero[expectedArtifactId]
            : null;

          if (!expectedArtifactId) {
            if (doesTargetHeroExpectFish(targetHero)) {
              continue;
            }
            if (currentArtifactId) {
              await sendApplyActionCommand(
                "artifact_unload",
                {
                  heroId: targetHero.heroId,
                },
                { allowFailure: true },
              );
              await delay(COMMAND_DELAY);
            }
          } else {
            if (
              isArtifactAssignedToTargetHero(
                targetHero,
                expectedArtifactId,
                currentHeroesData,
                currentTeamInfoData,
                artifactToHero,
              )
            ) {
              continue;
            }

            const targetHasCurrentArtifact =
              currentArtifactId && currentArtifactId !== Number(expectedArtifactId);
            const holderNeedsRelease =
              currentHolderId && currentHolderId !== Number(targetHero.heroId);

            if (targetHasCurrentArtifact) {
              const unloaded = await sendApplyActionCommand(
                "artifact_unload",
                {
                  heroId: targetHero.heroId,
                },
                { allowFailure: true },
              );
              if (unloaded?.ignored) {
                noopClearedTargetHeroIds.add(Number(targetHero.heroId));
              }
              if (!unloaded) {
                const verifyData = await fetchLatestData();
                const verifyCurrentArtifactId = getCurrentArtifactIdForTargetHero(
                  targetHero,
                  verifyData.heroes || {},
                  verifyData.teamInfo || {},
                );
                if (
                  verifyCurrentArtifactId
                  && verifyCurrentArtifactId !== Number(expectedArtifactId)
                ) {
                  continue;
                }
              }
              await delay(COMMAND_DELAY);
            }

            if (holderNeedsRelease) {
              const unloaded = await sendApplyActionCommand(
                "artifact_unload",
                {
                  heroId: currentHolderId,
                },
                { allowFailure: true },
              );
              if (unloaded?.ignored && expectedArtifactId) {
                noopReleasedArtifactIds.add(Number(expectedArtifactId));
              }
              if (!unloaded) {
                const verifyData = await fetchLatestData();
                const verifyHolderId = buildArtifactToHeroMap(
                  {},
                  verifyData.teamInfo || {},
                )[expectedArtifactId];
                if (verifyHolderId && verifyHolderId !== Number(targetHero.heroId)) {
                  continue;
                }
              }
              await delay(COMMAND_DELAY);
            }

            let loadState = null;
            if (targetHasCurrentArtifact || holderNeedsRelease) {
              loadState = await getLatestFishSyncState();
              const verifyCurrentArtifactId = getCurrentArtifactIdForTargetHero(
                targetHero,
                loadState.latestHeroesData,
                loadState.latestTeamInfoData,
              );
              const verifyHolderId = loadState.artifactToHero[expectedArtifactId];
              const stillTargetOccupied =
                verifyCurrentArtifactId
                && verifyCurrentArtifactId !== Number(expectedArtifactId)
                && !noopClearedTargetHeroIds.has(Number(targetHero.heroId));
              const stillHeldByOther =
                verifyHolderId
                && verifyHolderId !== Number(targetHero.heroId)
                && !noopReleasedArtifactIds.has(Number(expectedArtifactId));
              if (
                stillTargetOccupied
                || stillHeldByOther
              ) {
                continue;
              }
            }

            if (
              isArtifactAssignedToTargetHero(
                targetHero,
                expectedArtifactId,
                loadState?.latestHeroesData || currentHeroesData,
                loadState?.latestTeamInfoData || currentTeamInfoData,
                loadState?.artifactToHero || artifactToHero,
              )
            ) {
              continue;
            }

            await sendApplyActionCommand(
              "artifact_load",
              {
                heroId: targetHero.heroId,
                itemId: expectedArtifactId,
                pearlId: Number(targetHero.pearlId || 0) || 0,
                targetHeroId: -1,
              },
              { allowFailure: true },
            );
            await delay(COMMAND_DELAY);
          }
        }

        latestData = await fetchLatestData();
        const refreshedPearlMap = latestData.pearlMap || {};
        for (const targetHero of targetHeroes) {
          const pearlId = Number(targetHero.pearlId || 0) || null;
          if (!pearlId) continue;
          const currentSkillId = getPearlSkillId(refreshedPearlMap, pearlId);
          const targetSkillId = Number(targetHero.skillId || 0) || null;
          if ((currentSkillId || null) === (targetSkillId || null)) {
            continue;
          }

          const holderPearlId = findPearlSkillHolderId(
            refreshedPearlMap,
            targetSkillId,
            pearlId,
          );
          if (holderPearlId) {
            await sendApplyActionCommand(
              "pearl_exchangeskill",
              {
                pearlId1: pearlId,
                pearlId2: holderPearlId,
              },
              { allowFailure: true },
            );
            await delay(COMMAND_DELAY);
            continue;
          }

          if (currentSkillId) {
            await sendApplyActionCommand(
              "pearl_unloadskill",
              {
                pearlId,
              },
              { allowFailure: true },
            );
            await delay(COMMAND_DELAY);
          }
          if (targetSkillId) {
            await sendApplyActionCommand(
              "pearl_replaceskill",
              {
                pearlId,
                skillId: targetSkillId,
              },
              { allowFailure: true },
            );
            await delay(COMMAND_DELAY);
          }
        }

        latestData = await fetchLatestData();
        if (
          isTargetFishMatched(
            latestData.teamInfo || {},
            latestData.heroes || {},
            latestData.pearlMap || {},
            latestData.artifactBooks || {},
          )
        ) {
          return { success: true, repaired: true };
        }
      }

      return { success: false, repaired: false };
    };

    let heroes = {};
    let teamInfo = {};
    let currentHeroes = [];
    await runApplyStage("read_current_snapshot", "读取当前角色快照", async () => {
      const initialData = await fetchLatestData();
      heroes = initialData.heroes || {};
      teamInfo = initialData.teamInfo || {};
      currentHeroes = getPositionAwareTeamHeroes(teamInfo);
      return `当前阵容共 ${currentHeroes.length} 名武将`;
    });
    await runApplyStage("read_saved_lineup", "读取已保存阵容快照", async () => (
      `已加载目标阵容 ${targetHeroes.length} 名武将`
    ));
    const hasEquipmentData = targetHeroes.some(
      (hero) => hero?.equipment && Object.keys(hero.equipment).length > 0,
    );

    await runApplyStage("equipment_exchange", "按装备洗练无损换将", async () => {
      return runEquipmentExchangePass({
        stageLabel: "按装备洗练无损换将",
        successMessagePrefix: "已按装备洗练无损切换",
      });
    });

    await runApplyStage("lineup_attachment", "整理站位", async () => {
      return runLineupPositionPass({
        progressLabel: "正在按目标站位切换武将",
        successSummary: "已整理站位",
        unchangedSummary: "站位已匹配，无需调整",
      });
    });

    await runApplyStage("equipment_exchange_review", "站位后复查装备洗练", async () => {
      const reviewData = await syncLatestSnapshot();
      const review = getEquipmentReview(reviewData.heroes || {});
      if (review.success) {
        return "站位整理后装备洗练无差异，跳过再次无损换将";
      }

      return runEquipmentExchangePass({
        stageLabel: "站位后复查装备洗练",
        successMessagePrefix: "站位整理后再次无损切换",
        initialReview: {
          data: reviewData,
          review,
        },
      });
    });

    await runApplyStage("lineup_attachment_review", "补完后再次整理站位", async () => (
      runLineupPositionPass({
        progressLabel: "正在补完后再次按目标站位切换武将",
        successSummary: "补完后再次整理站位完成",
        unchangedSummary: "补完后站位已匹配，无需再次调整",
      })
    ));

    const hasLevelData = lineup.heroes.some((h) => h.level && h.level > 0);
    await runApplyStage("level_sync", "同步等级", async () => {
      if (!hasLevelData) {
        return "该阵容未保存等级，跳过此步";
      }

      const levelData = await fetchLatestData();
      const currentHeroesData = levelData.heroes;

      let levelApplied = 0;
      for (const targetHero of targetHeroes) {
        if (!targetHero.level || targetHero.level <= 0) continue;

        const heroData = currentHeroesData[String(targetHero.heroId)];
        const currentLevel = heroData?.level || 1;
        const currentOrder = heroData?.order || 0;

        if (currentLevel !== targetHero.level) {
          const result = await applyHeroLevel(
            tokenId,
            targetHero.heroId,
            targetHero.level,
            currentLevel,
            currentOrder,
            targetHero.position,
          );

          if (result.success) {
            levelApplied++;
          }
        }
      }

      if (levelApplied > 0) {
        message.success(`已应用 ${levelApplied} 个武将等级配置`);
      }

      return levelApplied > 0
        ? `已同步 ${levelApplied} 名武将等级`
        : "等级已匹配，无需调整";
    });

    const hasFishData = lineup.heroes.some((h) => h.pearlId || h.fishId);
    await runApplyStage("fish_pearl_sync", "同步鱼灵与鱼珠技能", async () => {
      if (!hasFishData) {
        return "该阵容未保存鱼灵或鱼珠，跳过此步";
      }

      const lineupDataBeforeFishSync = await fetchLatestData();
      const lineupMatchedBeforeFishSync = isTargetLineupMatched(
        getPositionAwareTeamHeroes(lineupDataBeforeFishSync.teamInfo),
      );
      if (!lineupMatchedBeforeFishSync) {
        return "当前站位仍未匹配，已跳过鱼灵与鱼珠技能同步";
      }
      const noopClearedTargetHeroIds = new Set();
      const noopReleasedArtifactIds = new Set();

      let fishApplied = 0;
      for (const targetHero of targetHeroes) {
        if (!targetHero.fishId && !targetHero.pearlId) continue;

        const {
          latestHeroesData: currentHeroes,
          latestTeamInfoData,
          latestPearlMap: pearlMap,
          latestArtifactBooks: artifactBooks,
          artifactToHero,
        } = await getLatestFishSyncState();

        const fishToArtifact = {};
        for (const [fishId, book] of Object.entries(artifactBooks)) {
          if (book.artifactId && book.artifactId !== -1) {
            fishToArtifact[Number(fishId)] = book.artifactId;
          }
        }

        let artifactId = null;
        const pearlId = targetHero.pearlId || 0;

        if (targetHero.fishId) {
          artifactId = fishToArtifact[targetHero.fishId];
        }

        if (!artifactId && targetHero.pearlId) {
          const pearlData = pearlMap[targetHero.pearlId];
          if (pearlData?.artifactId && pearlData.artifactId !== -1) {
            artifactId = pearlData.artifactId;
          }
        }

        if (!artifactId) continue;

        const currentArtifactId = getCurrentArtifactIdForTargetHero(
          targetHero,
          currentHeroes,
          latestTeamInfoData,
        );
        const currentHolderId = artifactToHero[artifactId];

        if (
          isArtifactAssignedToTargetHero(
            targetHero,
            artifactId,
            currentHeroes,
            latestTeamInfoData,
            artifactToHero,
          )
        ) {
          continue;
        }

        const targetHasCurrentArtifact =
          currentArtifactId && currentArtifactId !== Number(artifactId);
        const holderNeedsRelease =
          currentHolderId && currentHolderId !== Number(targetHero.heroId);

        if (targetHasCurrentArtifact) {
          const unloaded = await sendApplyActionCommand(
            "artifact_unload",
            {
              heroId: targetHero.heroId,
            },
            { allowFailure: true },
          );
          if (unloaded?.ignored) {
            noopClearedTargetHeroIds.add(Number(targetHero.heroId));
          }
          if (!unloaded) {
            const verifyData = await fetchLatestData();
            const verifyCurrentArtifactId = getCurrentArtifactIdForTargetHero(
              targetHero,
              verifyData.heroes || {},
              verifyData.teamInfo || {},
            );
            if (verifyCurrentArtifactId && verifyCurrentArtifactId !== Number(artifactId)) {
              continue;
            }
          }
          await delay(COMMAND_DELAY);
        }

        if (holderNeedsRelease) {
          const unloaded = await sendApplyActionCommand(
            "artifact_unload",
            {
              heroId: currentHolderId,
            },
            { allowFailure: true },
          );
          if (unloaded?.ignored && artifactId) {
            noopReleasedArtifactIds.add(Number(artifactId));
          }
          if (!unloaded) {
            const verifyData = await fetchLatestData();
            const verifyHolderId = buildArtifactToHeroMap(
              {},
              verifyData.teamInfo || {},
            )[artifactId];
            if (verifyHolderId && verifyHolderId !== Number(targetHero.heroId)) {
              continue;
            }
          }
          await delay(COMMAND_DELAY);
        }

        let loadState = null;
        if (targetHasCurrentArtifact || holderNeedsRelease) {
          loadState = await getLatestFishSyncState();
          const verifyCurrentArtifactId = getCurrentArtifactIdForTargetHero(
            targetHero,
            loadState.latestHeroesData,
            loadState.latestTeamInfoData,
          );
          const verifyHolderId = loadState.artifactToHero[artifactId];
          if (
            (
              verifyCurrentArtifactId
              && verifyCurrentArtifactId !== Number(artifactId)
              && !noopClearedTargetHeroIds.has(Number(targetHero.heroId))
            )
            || (
              verifyHolderId
              && verifyHolderId !== Number(targetHero.heroId)
              && !noopReleasedArtifactIds.has(Number(artifactId))
            )
          ) {
            continue;
          }
        }

        if (
          isArtifactAssignedToTargetHero(
            targetHero,
            artifactId,
            loadState?.latestHeroesData || currentHeroes,
            loadState?.latestTeamInfoData || latestTeamInfoData,
            loadState?.artifactToHero || artifactToHero,
          )
        ) {
          continue;
        }

        const applied = await sendApplyActionCommand(
          "artifact_load",
          {
            heroId: targetHero.heroId,
            itemId: artifactId,
            pearlId,
            targetHeroId: -1,
          },
          { allowFailure: true },
        );
        if (applied) {
          fishApplied++;
        }
        await delay(COMMAND_DELAY);
      }

      if (fishApplied > 0) {
        message.success(`已应用 ${fishApplied} 个鱼灵配置`);
      }

      let skillApplied = 0;
      const skillData = await fetchLatestData();
      const latestPearlMap = skillData.pearlMap || {};

      const processedPearlIds = new Set();
      const pearlIdsToHandle = targetHeroes
        .filter((h) => h.pearlId)
        .map((h) => h.pearlId);

      for (const pearlId of pearlIdsToHandle) {
        if (processedPearlIds.has(pearlId)) continue;

        const targetHero = targetHeroes.find((h) => h.pearlId === pearlId);
        const currentPearlData = latestPearlMap[pearlId];
        const currentSkillId = currentPearlData?.skillId || null;
        const targetSkillId = targetHero?.skillId || null;

        if (currentSkillId === targetSkillId) {
          continue;
        }

        const holderPearlId = findPearlSkillHolderId(
          latestPearlMap,
          targetSkillId,
          pearlId,
        );
        if (holderPearlId) {
          const exchanged = await sendApplyActionCommand(
            "pearl_exchangeskill",
            {
              pearlId1: pearlId,
              pearlId2: holderPearlId,
            },
            { allowFailure: true },
          );
          if (exchanged) {
            skillApplied += 2;
            processedPearlIds.add(pearlId);
            processedPearlIds.add(holderPearlId);
          }
          await delay(COMMAND_DELAY);
          continue;
        }

        if (currentSkillId) {
          const unloaded = await sendApplyActionCommand(
            "pearl_unloadskill",
            {
              pearlId,
            },
            { allowFailure: true },
          );
          if (unloaded) {
            skillApplied++;
          }
          await delay(COMMAND_DELAY);
        }

        if (!targetSkillId) {
          processedPearlIds.add(pearlId);
          continue;
        }

        const replaced = await sendApplyActionCommand(
          "pearl_replaceskill",
          {
            pearlId,
            skillId: targetSkillId,
          },
          { allowFailure: true },
        );
        if (replaced) {
          skillApplied++;
          processedPearlIds.add(pearlId);
        }
        await delay(COMMAND_DELAY);
      }

      if (skillApplied > 0) {
        message.success(`已切换 ${skillApplied} 个鱼珠技能`);
      }
      return fishApplied > 0 || skillApplied > 0
        ? `已同步 ${fishApplied} 个鱼灵、${skillApplied} 个鱼珠技能`
        : "鱼灵与鱼珠技能已匹配";
    });

    await runApplyStage("tail_sync", "同步科技与玩具", async () => {
      if (
        lineup.legionResearch &&
        Object.keys(lineup.legionResearch).length > 0
      ) {
        setApplyProgressStage("正在同步科技配置");
        const syncResult = await syncLegionResearch(
          tokenId,
          lineup.legionResearch,
        );
        if (syncResult.success) {
          if (syncResult.message !== "科技配置已匹配，无需调整") {
            message.success(syncResult.message);
          }
        } else {
          message.warning(syncResult.message || "科技配置同步失败，已跳过");
        }
      }

      if (lineup.weaponId !== undefined && lineup.weaponId !== null) {
        setApplyProgressStage("正在同步玩具配置");
        const currentPresetTeam = await tokenStore.sendMessageWithPromise(
          tokenId,
          "presetteam_getinfo",
          {},
        );
        const currentPresetInfo =
          currentPresetTeam?.presetTeamInfo?.presetTeamInfo ||
          currentPresetTeam?.presetTeamInfo ||
          {};
        const currentTeamData =
          currentPresetInfo[currentTeamId.value] ||
          currentPresetInfo[String(currentTeamId.value)];
        const currentWeaponId = currentTeamData?.weapon?.weaponId || null;

        if (currentWeaponId !== lineup.weaponId) {
          try {
            await tokenStore.sendMessageWithPromise(
              tokenId,
              "lordweapon_changedefaultweapon",
              {
                weaponId: lineup.weaponId,
              },
            );
            message.success(
              `玩具已切换为: ${weapon[lineup.weaponId] || lineup.weaponId}`,
            );
          } catch (err) {}
          await delay(COMMAND_DELAY);
        }
      }

      return "科技与玩具同步已完成";
    });

    await runApplyStage("final_review_refresh", "复核并刷新界面", async () => {
      if (hasEquipmentData) {
        setApplyProgressStage("正在复核装备洗练");
        await fetchLatestData();
      }

      const finalLineupCheck = await ensureFinalLineupMatches();
      if (!finalLineupCheck.success) {
        errors.push("最终阵容复核失败：当前上阵结果与已保存阵容不一致");
      }

      if (finalLineupCheck.success) {
        const finalFishCheck = await ensureFinalFishArtifactsMatch();
        if (!finalFishCheck.success) {
          errors.push("最终鱼灵复核失败：当前鱼灵结果与已保存阵容不一致");
        }
      } else if (hasFishData) {
        errors.push("最终阵容未对齐，已跳过最终鱼灵复核以避免误卸鱼灵");
      }

      if (hasEquipmentData) {
        const finalEquipmentData = await fetchLatestData();
        const finalEquipmentCheck = getEquipmentReview(finalEquipmentData.heroes || {});
        if (!finalEquipmentCheck.success) {
          const previewNames = finalEquipmentCheck.mismatched
            .map((item) => item.heroName)
            .slice(0, 3)
            .join("、");
          const summary = finalEquipmentCheck.mismatched.length > 3
            ? `${previewNames} 等 ${finalEquipmentCheck.mismatched.length} 名武将`
            : previewNames;
          errors.push(
            `最终装备洗练复核失败：${summary} 的装备洗练与已保存阵容不一致，请手动处理`,
          );
        }
      }

      if (errors.length > 0) {
        message.warning(`阵容已应用，但有部分错误:\n${errors.join("\n")}`);
      } else {
        message.success(`阵容 "${lineup.name}" 已应用`);
      }

      setApplyProgressStage("正在刷新阵容结果");
      lastRefreshTime = 0;
      await refreshTeamInfo();
      recordApplyDurationMetric(
        lineup.id,
        Date.now() - applyProgressStartedAt.value,
        tokenId,
      );

      return errors.length > 0
        ? `检测到 ${errors.length} 个待人工确认问题`
        : "所有复核已通过";
    });
  } catch (error) {
    if (error?.code === APPLY_DEBUG_ABORT_ERROR_CODE) {
      applyDebugFinished.value = true;
      setApplyProgressStage("已中止调试");
      message.warning("已中止分步调试");
    } else {
      setApplyProgressStage("应用阵容失败");
      message.error(`应用阵容失败: ${error.message}`);
    }
  } finally {
    $emit.off("syncresp", handleApplySyncResp);
    lineup.applying = false;
    state.value.isRunning = false;
    if (applyDebugMode.value) {
      applyDebugPaused.value = false;
      applyDebugFinished.value = true;
      finishApplyProgress({ keepVisible: true });
    } else {
      finishApplyProgress();
      resetApplyDebugSession();
    }
    releaseTokenOperationLock(tokenId, applyOperationLockId);
  }
};

const showTechModal = (lineup) => {
  selectedTechData.value = lineup.legionResearch || null;
  techModalVisible.value = true;
};

const startDebugApply = (lineup) => {
  void applyLineup(lineup, { debug: true });
};

const renameLineup = (index) => {
  const currentName = savedLineups.value[index].name;
  let newName = currentName;
  dialog.create({
    title: "重命名阵容",
    content: () =>
      h(NInput, {
        defaultValue: currentName,
        onInput: (val) => {
          newName = val;
        },
        placeholder: "请输入阵容名称",
      }),
    positiveText: "确定",
    negativeText: "取消",
    onPositiveClick: () => {
      if (newName && newName.trim()) {
        savedLineups.value[index].name = newName.trim();
        saveLineupsToStorage({ updatedAt: Date.now() });
        message.success("阵容名称已更新");
      }
    },
  });
};

const deleteLineup = (index) => {
  dialog.warning({
    title: "删除阵容",
    content: `确定要删除阵容 "${savedLineups.value[index].name}" 吗？`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      savedLineups.value.splice(index, 1);
      saveLineupsToStorage({ updatedAt: Date.now() });
      message.success("阵容已删除");
    },
  });
};

const syncSavedLineupsCloudNow = async () => {
  const tokenId = getSelectedTokenId();
  if (!tokenId) {
    message.warning("请先选择Token");
    return;
  }
  if (!authStore.isAuthenticated) {
    message.warning("请先登录账号后再上传到服务器");
    return;
  }

  clearLineupCloudTimer();

  lineupCloudSyncing.value = true;
  try {
    const store = persistSavedLineups({
      updatedAt: Date.now(),
      syncCloud: false,
    });
    await pushSavedLineupsToCloud(tokenId, store);
    message.success("已将已保存阵容上传到服务器");
  } catch (error) {
    message.error(`上传到服务器失败: ${error?.message || error}`);
  } finally {
    lineupCloudSyncing.value = false;
  }
};

const exportLineups = async () => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法导出");
    return;
  }

  try {
    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
    );
    const role = roleInfo?.role || roleInfo;
    const roleId = role?.roleId || role?.id;

    if (!roleId) {
      message.error("无法获取角色ID");
      return;
    }

    const exportData = {
      roleId,
      exportTime: Date.now(),
      lineups: savedLineups.value,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `阵容配置_${roleId}_${new Date().toLocaleDateString().replace(/\//g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);

    message.success(`已导出 ${savedLineups.value.length} 个阵容`);
  } catch (error) {
    message.error(`导出失败: ${error.message}`);
  }
};

const importLineups = async ({ file }) => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法导入");
    return;
  }

  try {
    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
    );
    const role = roleInfo?.role || roleInfo;
    const currentRoleId = role?.roleId || role?.id;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);

        if (!importData.roleId || !importData.lineups) {
          message.error("无效的阵容文件格式");
          return;
        }

        const processImport = (lineupsToImport) => {
          const existingIds = new Set(savedLineups.value.map((l) => l.id));
          const newLineups = [];
          const duplicateLineups = [];

          for (const lineup of lineupsToImport) {
            if (lineup.id && existingIds.has(lineup.id)) {
              duplicateLineups.push(lineup);
            } else {
              newLineups.push({
                ...lineup,
                id: lineup.id || createLineupId(),
                savedAt: Date.now(),
                updatedAt: Date.now(),
                applying: false,
              });
            }
          }

          if (duplicateLineups.length > 0) {
            dialog.warning({
              title: "发现重复阵容",
              content: `发现 ${duplicateLineups.length} 个已存在的阵容，是否覆盖？`,
              positiveText: "覆盖",
              negativeText: "跳过重复",
              onPositiveClick: () => {
                for (const dupLineup of duplicateLineups) {
                  const index = savedLineups.value.findIndex(
                    (l) => l.id === dupLineup.id,
                  );
                  if (index !== -1) {
                    savedLineups.value[index] = {
                      ...dupLineup,
                      savedAt: Date.now(),
                      updatedAt: Date.now(),
                      applying: false,
                    };
                  }
                }
                savedLineups.value = [...savedLineups.value, ...newLineups];
                saveLineupsToStorage({ updatedAt: Date.now() });
                message.success(
                  `已导入 ${newLineups.length + duplicateLineups.length} 个阵容`,
                );
              },
              onNegativeClick: () => {
                savedLineups.value = [...savedLineups.value, ...newLineups];
                saveLineupsToStorage({ updatedAt: Date.now() });
                message.success(
                  `已导入 ${newLineups.length} 个阵容，跳过 ${duplicateLineups.length} 个重复`,
                );
              },
            });
          } else {
            savedLineups.value = [...savedLineups.value, ...newLineups];
            saveLineupsToStorage({ updatedAt: Date.now() });
            message.success(`已导入 ${newLineups.length} 个阵容`);
          }
        };

        if (importData.roleId !== currentRoleId) {
          dialog.warning({
            title: "角色不匹配",
            content: `该阵容文件来自其他角色，是否继续导入？`,
            positiveText: "导入",
            negativeText: "取消",
            onPositiveClick: () => {
              processImport(importData.lineups);
            },
          });
        } else {
          processImport(importData.lineups);
        }
      } catch (parseError) {
        message.error("解析文件失败，请检查文件格式");
      }
    };
    reader.readAsText(file.file);
  } catch (error) {
    message.error(`导入失败: ${error.message}`);
  }
};

const switchTeam = async (teamId) => {
  if (teamId === currentTeamId.value) return;

  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法切换阵容");
    return;
  }

  switchingTeamId.value = teamId;
  state.value.isRunning = true;

  try {
    await tokenStore.sendMessageWithPromise(tokenId, "presetteam_saveteam", {
      teamId,
    });

    await delay(500);

    currentTeamId.value = teamId;
    message.success(`已切换到阵容 ${teamId}`);

    await refreshTeamInfo();
  } catch (error) {
    message.error(`切换阵容失败: ${error.message}`);
  } finally {
    switchingTeamId.value = null;
    state.value.isRunning = false;
  }
};

const savedLineupsModalActions = {
  applyLineup,
  deleteLineup,
  exportLineups,
  formatLevel,
  formatPower,
  formatTime,
  getFishNameById,
  getHeroAvatar,
  getHeroName,
  getLineupsByTeamId,
  getPearlSkillNameById,
  getSlotColors,
  importLineups,
  renameLineup,
  showTechModal,
  startDebugApply,
  syncSavedLineupsCloudNow,
};

watch(
  () => tokenStore.selectedToken,
  async (newToken, oldToken) => {
    if (newToken && newToken.id !== oldToken?.id) {
      clearLineupCloudTimer();
      await loadSavedLineups();
      currentTeamInfo.value = null;
      presetTeamData.value = null;
      allHeroesData.value = {};
      currentTeamId.value = 1;

      const status = tokenStore.getWebSocketStatus(newToken.id);
      if (status === "connected") {
        refreshTeamInfo();
      }
    }
  },
);

watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated, wasAuthenticated) => {
    if (isAuthenticated && !wasAuthenticated && tokenStore.selectedToken) {
      await loadSavedLineups();
    }
  },
);

watch(
  () =>
    tokenStore.selectedToken
      ? tokenStore.getWebSocketStatus(tokenStore.selectedToken.id)
      : null,
  (newStatus, oldStatus) => {
    if (
      newStatus === "connected" &&
      oldStatus !== "connected" &&
      tokenStore.selectedToken
    ) {
      setTimeout(() => {
        refreshTeamInfo();
      }, 500);
    }
  },
);

onMounted(() => {
  loadSavedLineups();

  const token = tokenStore.selectedToken;
  if (token) {
    const status = tokenStore.getWebSocketStatus(token.id);
    if (status === "connected") {
      refreshTeamInfo();
    }
  }
});

onUnmounted(() => {
  clearLineupCloudTimer();
  finishApplyProgress();
  resetApplyDebugSession();
});
</script>

<style scoped lang="scss">
.lineup-saver {
  min-height: 300px;
}

.apply-progress-modal {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.apply-progress-header {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.apply-progress-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.apply-progress-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}

.apply-progress-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.apply-progress-stage {
  padding: 12px 14px;
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(24, 144, 255, 0.12) 0%, rgba(114, 46, 209, 0.1) 100%);
  border: 1px solid rgba(24, 144, 255, 0.15);
  color: var(--text-primary);
  font-weight: 600;
}

.apply-progress-time-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.apply-progress-bar-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.apply-progress-bar-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 600;
}

.apply-progress-time-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-tertiary);
}

.apply-progress-time-item .label {
  font-size: 12px;
  color: var(--text-secondary);
}

.apply-progress-time-item .value {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.apply-progress-tip {
  font-size: 12px;
  color: var(--warning-color);
}

.apply-debug-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.04);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.apply-debug-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.apply-debug-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.apply-debug-state {
  font-size: 12px;
  color: var(--text-secondary);
}

.apply-debug-step-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 240px;
  overflow: auto;
}

.apply-debug-step {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--bg-primary);
  border: 1px solid rgba(15, 23, 42, 0.08);
}

.apply-debug-step.is-waiting {
  border-color: rgba(250, 173, 20, 0.28);
  background: rgba(250, 173, 20, 0.08);
}

.apply-debug-step.is-running {
  border-color: rgba(24, 144, 255, 0.28);
  background: rgba(24, 144, 255, 0.08);
  box-shadow: 0 0 0 1px rgba(24, 144, 255, 0.12);
}

.apply-debug-step.is-running::before {
  content: "";
  position: absolute;
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 4px;
  border-radius: 999px;
  background: linear-gradient(180deg, #1890ff 0%, #36cfc9 100%);
}

.apply-debug-step.is-success {
  border-color: rgba(82, 196, 26, 0.24);
  background: rgba(82, 196, 26, 0.08);
}

.apply-debug-step.is-error {
  border-color: rgba(255, 77, 79, 0.24);
  background: rgba(255, 77, 79, 0.08);
}

.apply-debug-step-main {
  display: flex;
  align-items: center;
  gap: 8px;
}

.apply-debug-step-index {
  width: 20px;
  height: 20px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.08);
  color: var(--text-primary);
  font-size: 11px;
  font-weight: 700;
  flex: 0 0 auto;
}

.apply-debug-step-label {
  flex: 1;
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.apply-debug-step-status {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.apply-debug-step-detail {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.apply-debug-step-commands {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.apply-debug-step-commands-title {
  font-size: 12px;
  color: var(--text-secondary);
}

.apply-debug-step-command-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.apply-debug-step-command {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.06);
  color: var(--text-primary);
  font-size: 12px;
  line-height: 1.4;
}

.apply-debug-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.lineup-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.toolbar {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.current-team-section {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);

  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .drag-tip {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    font-weight: normal;
  }
}

.heroes-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.hero-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: var(--bg-primary);
  border-radius: var(--border-radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  width: 100%;
  transition: all 0.2s;
  cursor: grab;
  border: 2px solid transparent;

  &:hover {
    background: var(--primary-color-light);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  &.drag-over {
    border-color: var(--primary-color);
    background: var(--primary-color-light);
  }
}

.hero-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-left: auto;
  min-width: 60px;
  justify-content: center;
}

.hero-position {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary-color);
  color: white;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.hero-placeholder {
  font-size: 12px;
  color: var(--text-secondary);
}

.hero-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  cursor: pointer;
}

.hero-avatar-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.hero-name-small-inline {
  font-size: var(--font-size-xs);
  color: var(--text-primary);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-level-small-inline {
  font-size: 10px;
  color: white;
  font-weight: 600;
  white-space: nowrap;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  padding: 2px 6px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(240, 147, 251, 0.3);
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  flex: 1;
}

.hero-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.hero-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.hero-level {
  font-size: var(--font-size-xs);
  color: var(--text-accent);
  font-weight: 500;
}

.hero-fish {
  font-size: var(--font-size-xs);
  color: var(--primary-color);
  background: linear-gradient(
    135deg,
    rgba(114, 46, 209, 0.15) 0%,
    rgba(114, 46, 209, 0.08) 100%
  );
  border: 1px solid rgba(114, 46, 209, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  align-self: flex-start;
  margin-bottom: 6px;
  font-weight: 500;
}

.hero-stats {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 3px;

  .stat-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  span {
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    white-space: nowrap;
    min-width: 90px;
    text-align: center;
  }

  .stat-power {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
    color: white;
    font-size: 12px;
  }

  .stat-attack {
    background: linear-gradient(135deg, #ffa940 0%, #fa8c16 100%);
    color: white;
  }

  .stat-hp {
    background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
    color: white;
  }

  .stat-speed {
    background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
    color: white;
  }
}

.hero-fish-skill-inline {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: white;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.hero-fish-slots-inline {
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
  padding-left: 6px;
  border-left: 1px solid rgba(114, 46, 209, 0.2);
}

.slot-dot-small {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.hero-artifact {
  font-size: var(--font-size-xs);
}

.exchange-btn {
  flex-shrink: 0;
  width: 100%;
}

.remove-btn {
  flex-shrink: 0;
  width: 100%;
}

.saved-lineups-section {
  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
}

.empty-tip {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-lg);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
}

.saved-lineups-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.saved-lineup-item {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-sm);
}

.lineup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.lineup-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.lineup-time {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.lineup-heroes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.lineup-heroes-row {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  margin-bottom: var(--spacing-sm);
}

.lineup-hero-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 110px;
  padding: 8px 6px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-small);
}

.hero-avatar {
  width: 60px;
  height: 60px;
  border-radius: var(--border-radius-small);
  object-fit: cover;
  border: 2px solid var(--border-color);
}

.hero-avatar-placeholder {
  width: 60px;
  height: 60px;
  border-radius: var(--border-radius-small);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
  border: 2px solid var(--border-color);
}

.hero-info-small {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.hero-header-small {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-bottom: 4px;
}

.hero-name-small {
  font-size: 13px;
  color: var(--text-primary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-level-small {
  font-size: 12px;
  color: white;
  font-weight: 600;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  padding: 2px 6px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(240, 147, 251, 0.3);
}

.hero-fish-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 4px;
  gap: 2px;
  background: linear-gradient(
    135deg,
    rgba(114, 46, 209, 0.12) 0%,
    rgba(114, 46, 209, 0.06) 100%
  );
  border: 1px solid rgba(114, 46, 209, 0.18);
  border-radius: 6px;
  padding: 4px 8px;
  width: 100%;
}

.hero-fish-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.hero-stats-small {
  font-size: 10px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;

  .stat-row-small {
    display: flex;
    justify-content: center;
    gap: 4px;
  }

  span {
    padding: 3px 5px;
    border-radius: 4px;
    font-weight: 500;
    white-space: nowrap;
    min-width: 70px;
    text-align: center;
  }

  .stat-power {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
    color: white;
  }

  .stat-attack {
    background: linear-gradient(135deg, #ffa940 0%, #fa8c16 100%);
    color: white;
  }

  .stat-hp {
    background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
    color: white;
  }

  .stat-speed {
    background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
    color: white;
  }
}

.hero-fish-name {
  font-size: 11px;
  color: var(--primary-color);
  font-weight: 500;
}

.hero-fish-skill-name {
  font-size: 10px;
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
  font-weight: 500;
}

.hero-fish-slots {
  display: flex;
  gap: 4px;
  justify-content: center;
  padding-top: 3px;
}

.lineup-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.quick-switch-section {
  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
}

.team-selector {
  display: flex;
  gap: var(--spacing-xs);
}

.refine-modal-content {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.equip-refine-section {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-sm);
}

.equip-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  padding-bottom: var(--spacing-xs);
  border-bottom: 1px solid var(--border-light);
}

.equip-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.equip-level {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.equip-bonus {
  font-size: var(--font-size-xs);
  color: var(--primary-color);
  margin-left: auto;
}

.slots-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.slot-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--border-radius-small);
  border-left: 3px solid var(--border-light);

  &.locked {
    border-left-color: var(--primary-color);
    background: var(--primary-color-light);
  }

  &.color-1 {
    border-left-color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  &.color-2 {
    border-left-color: #4caf50;
    background: rgba(76, 175, 80, 0.1);
  }

  &.color-3 {
    border-left-color: #2196f3;
    background: rgba(33, 150, 243, 0.1);
  }

  &.color-4 {
    border-left-color: #9c27b0;
    background: rgba(156, 39, 176, 0.1);
  }

  &.color-5 {
    border-left-color: #ff9800;
    background: rgba(255, 152, 0, 0.1);
  }

  &.color-6 {
    border-left-color: #f44336;
    background: rgba(244, 67, 54, 0.1);
  }
}

.slot-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  min-width: 30px;
}

.slot-attr {
  flex: 1;
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.attr-name {
  color: var(--text-primary);
}

.attr-value {
  color: var(--primary-color);
  font-weight: var(--font-weight-medium);
}

.slot-empty {
  flex: 1;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.no-equipment {
  text-align: center;
  color: var(--text-secondary);
  padding: var(--spacing-lg);
}

.exchange-modal-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.current-hero-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
}

.hero-filter-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);

  .filter-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .filter-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }
}

.hero-select-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--spacing-sm);
  max-height: 400px;
  overflow-y: auto;
  padding: var(--spacing-xs);
}

.hero-select-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;

  &:hover {
    background: var(--bg-secondary);
    transform: translateY(-2px);
  }

  &.selected {
    border-color: var(--primary-color);
    background: var(--primary-color-light);
  }

  &.quality-red {
    border-color: rgba(245, 34, 45, 0.3);

    &:hover {
      border-color: rgba(245, 34, 45, 0.6);
      background: rgba(245, 34, 45, 0.1);
    }

    &.selected {
      border-color: #f5222d;
      background: rgba(245, 34, 45, 0.15);
    }
  }

  &.quality-orange {
    border-color: rgba(250, 173, 20, 0.3);

    &:hover {
      border-color: rgba(250, 173, 20, 0.6);
      background: rgba(250, 173, 20, 0.1);
    }

    &.selected {
      border-color: #faad14;
      background: rgba(250, 173, 20, 0.15);
    }
  }

  &.quality-purple {
    border-color: rgba(114, 46, 209, 0.3);

    &:hover {
      border-color: rgba(114, 46, 209, 0.6);
      background: rgba(114, 46, 209, 0.1);
    }

    &.selected {
      border-color: #722ed1;
      background: rgba(114, 46, 209, 0.15);
    }
  }
}

.hero-select-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.hero-select-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  text-align: center;
}

.hero-select-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.hero-artifact-id {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  margin-top: 2px;
}

.saved-lineups-modal-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.team-tabs {
  display: flex;
  gap: var(--spacing-xs);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: var(--spacing-sm);
  justify-content: space-between;
  align-items: center;
}

.team-tabs-left {
  display: flex;
  gap: var(--spacing-xs);
}

.team-tabs-right {
  display: flex;
  gap: var(--spacing-xs);
}

.team-tab {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  transition: all 0.2s;

  &:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }
}

.tab-count {
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

.lineups-list {
  max-height: 50vh;
  overflow-y: auto;
}

.lineup-card {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  margin-bottom: var(--spacing-sm);
  overflow: hidden;
}

.lineup-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-secondary);
  }
}

.lineup-title-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.expand-icon {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  width: 12px;
}

.lineup-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.lineup-time {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.lineup-weapon-tag {
  font-size: var(--font-size-xs);
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb, 0, 122, 255), 0.1);
  padding: 1px 6px;
  border-radius: var(--border-radius-small);
  margin-left: var(--spacing-xs);
}

.lineup-quick-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.lineup-detail {
  padding: var(--spacing-sm);
  padding-top: 0;
  border-top: 1px solid var(--border-color);
}

.lineup-heroes-detail {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.lineup-hero-item {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: var(--border-radius-small);
}

.hero-pos {
  color: var(--text-tertiary);
}

.hero-name {
  color: var(--text-primary);
}

.hero-artifact {
  color: var(--primary-color);
  font-size: var(--font-size-xs);
}

.hero-fish-tag {
  color: var(--success-color);
  font-size: var(--font-size-xs);
  background: rgba(var(--success-color-rgb, 0, 128, 0), 0.1);
  padding: 1px 4px;
  border-radius: var(--border-radius-small);
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.hero-fish-skill {
  color: var(--primary-color);
  font-weight: normal;
}

.hero-fish-slots {
  display: inline-flex;
  gap: 2px;
  margin-left: 4px;
}

.slot-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.tech-modal-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.tech-type-section {
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.tech-type-header {
  background: var(--bg-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-weight: bold;
  color: var(--primary-color);
}

.tech-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--border-color);
}

.tech-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-primary);
  font-size: var(--font-size-sm);
}

.tech-name {
  color: var(--text-secondary);
}

.tech-level {
  color: var(--text-primary);
  font-weight: 500;
}

.no-tech-data {
  text-align: center;
  color: var(--text-tertiary);
  padding: var(--spacing-lg);
}

.lineup-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.no-lineup-tip {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-lg);
}
</style>
