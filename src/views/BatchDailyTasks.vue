<template>
  <div class="batch-daily-tasks">
    <div class="main-layout">
      <!-- Left Column -->
      <div class="left-column">
        <BatchDailyTasksHeader
          :import-config="importConfig"
          :is-running="isRunning"
          :scheduled-task-count="scheduledTasks.length"
          :selected-token-count="selectedTokens.length"
          :shortest-countdown-task="shortestCountdownTask"
          @export-config="exportConfig"
          @open-batch-settings="openBatchSettings"
          @open-task-modal="openTaskModal"
          @open-tasks-modal="showTasksModal = true"
          @open-template-manager="openTemplateManagerModal"
          @start-batch="startBatch"
          @stop-batch="stopBatch"
        ></BatchDailyTasksHeader>

        <BatchDailyTasksTokenSelection
          v-model:selected-tokens="selectedTokens"
          :batch-settings="batchSettings"
          :get-sort-icon="getSortIcon"
          :get-status-text="getStatusText"
          :get-status-type="getStatusType"
          :get-token-groups="tokenStore.getTokenGroups"
          :get-valid-group-token-ids="getValidGroupTokenIds"
          :is-all-selected="isAllSelected"
          :is-group-selected="isGroupSelected"
          :is-indeterminate="isIndeterminate"
          :selected-groups="selectedGroups"
          :sort-config="sortConfig"
          :sorted-tokens="sortedTokens"
          :token-groups="tokenGroups"
          @clear-groups="clearAllGroupSelection"
          @open-group-manage="showGroupManageModal = true"
          @open-settings="openSettings"
          @select-all="handleSelectAll"
          @toggle-group-selection="toggleGroupSelection"
          @toggle-sort="toggleSort"
        ></BatchDailyTasksTokenSelection>

        <BatchDailyTasksToolbar
          :is-baoku-activity-open="isbaokuActivityOpen"
          :is-car-activity-open="isCarActivityOpen"
          :is-running="isRunning"
          :is-war-guess-activity-open="isWarGuessActivityOpen"
          :is-weird-tower-activity-open="isWeirdTowerActivityOpen"
          :isarena-activity-open="isarenaActivityOpen"
          :ismengjing-activity-open="ismengjingActivityOpen"
          :selected-token-count="selectedTokens.length"
          :war-guess-activity-tip="warGuessActivityTip"
          @open-helper="openHelperModal"
          @open-legacy-gift="showLegacyGiftModal = true"
          @open-war-guess="openWarGuessModal"
          @run-action="handleBatchToolbarAction"
        ></BatchDailyTasksToolbar>
      </div>

      <BatchDailyTasksLogPanel
        v-model:auto-scroll-log="autoScrollLog"
        v-model:filter-errors-only="filterErrorsOnly"
        :current-progress="currentProgress"
        :current-running-token-name="currentRunningTokenName"
        :error-count="errorCount"
        :filtered-logs="filteredLogs"
        :logs="logs"
        :max-log-entries="batchSettings.maxLogEntries || 1000"
        :set-log-container="setBatchLogContainer"
        @clear-logs="clearLogs"
        @copy-logs="copyLogs"
      ></BatchDailyTasksLogPanel>
    </div>

    <BatchDailyTasksSettingsModal
      v-model:show="showSettingsModal"
      :boss-times-options="bossTimesOptions"
      :formation-options="formationOptions"
      :settings="currentSettings"
      :title="`任务设置 - ${currentSettingsTokenName}`"
      @save="saveSettings"
      @update-field="(key, value) => updateSettingsField(currentSettings, key, value)"
    ></BatchDailyTasksSettingsModal>

    <BatchDailyTasksTaskTemplateModal
      v-model:show="showTaskTemplateModal"
      :boss-times-options="bossTimesOptions"
      :formation-options="formationOptions"
      :template="currentTemplate"
      :template-id="currentTemplateId"
      :template-name="currentTemplateName"
      @save="saveTaskTemplate"
      @update-field="(key, value) => updateSettingsField(currentTemplate, key, value)"
      @update:template-name="currentTemplateName = $event"
    ></BatchDailyTasksTaskTemplateModal>

    <BatchDailyTasksApplyTemplateModal
      v-model:selected-template-id="selectedTemplateId"
      v-model:selected-tokens-for-apply="selectedTokensForApply"
      v-model:show="showApplyTemplateModal"
      :is-all-selected="isAllSelectedForApply"
      :is-indeterminate="isIndeterminateForApply"
      :sorted-tokens="sortedTokens"
      :task-templates="taskTemplates"
      :token-groups="tokenGroups"
      @append-group-tokens="appendGroupTokensForApply"
      @apply="applyTemplate"
      @select-all="handleSelectAllForApply"
    ></BatchDailyTasksApplyTemplateModal>

    <BatchDailyTasksTemplateManagerModal
      v-model:show="showTemplateManagerModal"
      :filtered-task-templates="filteredTaskTemplates"
      @delete-template="deleteTaskTemplate"
      @edit-template="openEditTemplateModal"
      @open-account-template="openAccountTemplateModal"
      @open-apply-template="openApplyTemplateModal"
      @open-new-template="openNewTemplateModal"
    ></BatchDailyTasksTemplateManagerModal>

    <BatchDailyTasksAccountTemplateModal
      v-model:selected-template-for-filter="selectedTemplateForFilter"
      v-model:show="showAccountTemplateModal"
      :filtered-account-templates="filteredAccountTemplates"
      :task-templates="taskTemplates"
      @filter-account-templates="filterAccountTemplates"
    ></BatchDailyTasksAccountTemplateModal>

    <BatchDailyTasksLegacyGiftModal
      v-model:show="showLegacyGiftModal"
      :avatar-load-error="avatarLoadError"
      :clear-recipient-error="clearRecipientError"
      :gift-quantity="giftQuantity"
      :handle-avatar-error="handleAvatarError"
      :handle-avatar-load="handleAvatarLoad"
      :is-avatar-loading="isAvatarLoading"
      :is-querying-recipient="isQueryingRecipient"
      :on-confirm-legacy-gift="confirmLegacyGift"
      :on-query-recipient-info="queryRecipientInfo"
      :recipient-id-error="recipientIdError"
      :recipient-id-input="recipientIdInput"
      :recipient-info="recipientInfo"
      :security-password="securityPassword"
      @update:gift-quantity="giftQuantity = $event"
      @update:recipient-id-input="recipientIdInput = $event"
      @update:security-password="securityPassword = $event"
    ></BatchDailyTasksLegacyGiftModal>

    <BatchDailyTasksHelperModal
      v-model:show="showHelperModal"
      :box-type-options="boxTypeOptions"
      :fish-type-options="fishTypeOptions"
      :helper-settings="helperSettings"
      :helper-type="helperType"
      :title="helperModalTitle"
      @execute="executeHelper"
      @update-field="(key, value) => updateSettingsField(helperSettings, key, value)"
    ></BatchDailyTasksHelperModal>

    <BatchDailyTasksDreamBuyModal
      v-model:show="showDreamBuyModal"
      :dream-buy-list="dreamBuyList"
      :merchant-config="merchantConfig"
      @clear-all-items="clearAllItems"
      @save="saveDreamBuyConfig"
      @select-all-items="selectAllItems"
      @select-gold-items="selectGoldItems"
      @toggle-item="toggleDreamItem"
    ></BatchDailyTasksDreamBuyModal>

    <BatchDailyTasksListModal
      v-model:show="showTasksModal"
      :executing-task-ids="executingTaskIds"
      :on-delete-task="deleteTask"
      :on-edit-task="editTask"
      :on-manual-execute-task="manualExecuteTask"
      :on-toggle-task-enabled="toggleTaskEnabled"
      :scheduled-tasks="scheduledTasks"
      :task-countdowns="taskCountdowns"
    ></BatchDailyTasksListModal>

    <BatchDailyTasksTaskModal
      v-model:show="showTaskModal"
      :cron-next-runs="cronNextRuns"
      :cron-validation="cronValidation"
      :grouped-available-tasks="groupedAvailableTasks"
      :sorted-tokens="sortedTokens"
      :task-form="taskForm"
      :task-group-definitions="taskGroupDefinitions"
      :task-schedule-selected-group-ids="taskScheduleSelectedGroupIds"
      :title="editingTask ? '编辑定时任务' : '新增定时任务'"
      :token-groups="tokenGroups"
      @deselect-all-tasks="deselectAllTasks"
      @deselect-all-tokens="deselectAllTokens"
      @open-group-manage="showGroupManageModal = true"
      @parse-cron="parseCronExpression"
      @reset-run-type="resetRunType"
      @save="saveTask"
      @select-all-tasks="selectAllTasks"
      @select-all-tokens="selectAllTokens"
      @toggle-task-group="toggleTaskScheduleGroup"
      @update-task-form-field="updateTaskFormField"
    ></BatchDailyTasksTaskModal>

    <BatchDailyTasksBatchSettingsModal
      v-model:show="showBatchSettingsModal"
      :batch-settings="batchSettings"
      :box-type-options="boxTypeOptions"
      :fish-type-options="fishTypeOptions"
      :helper-lineup-keyword-options="helperLineupKeywordOptions"
      @open-dream-buy="openDreamBuyModal"
      @save="saveBatchSettings"
      @update-field="(key, value) => updateSettingsField(batchSettings, key, value)"
    ></BatchDailyTasksBatchSettingsModal>

    <BatchDailyTasksWarGuessModal
      v-model:selected-war-guess-legion-id="selectedWarGuessLegionId"
      v-model:show="showWarGuessModal"
      v-model:war-guess-coin="warGuessCoin"
      :is-running="isRunning"
      :war-guess-columns="warGuessColumns"
      :war-guess-list="warGuessList"
      :war-guess-loading="warGuessLoading"
      :war-guess-row-props="warGuessRowProps"
      @cheer="handleWarGuessCheer"
      @refresh="fetchWarGuessRank"
    ></BatchDailyTasksWarGuessModal>

    <!-- Token Group Management Modal -->
    <BatchDailyTasksGroupManageModal
      v-model:editing-group-color="editingGroupColor"
      v-model:editing-group-name="editingGroupName"
      v-model:new-group-color="newGroupColor"
      v-model:new-group-name="newGroupName"
      v-model:new-group-selected-tokens="newGroupSelectedTokens"
      v-model:show="showGroupManageModal"
      :editing-group-id="editingGroupId"
      :get-valid-group-token-ids="getValidGroupTokenIds"
      :group-colors="groupColors"
      :sorted-tokens="sortedTokens"
      :token-groups="tokenGroups"
      :tokens="tokens"
      @add-token-to-group="addTokenToSelectedGroup"
      @cancel-edit-group="cancelEditGroup"
      @create-new-group="createNewGroup"
      @delete-group="deleteGroup"
      @deselect-all-new-group="deselectAllNewGroup"
      @remove-token-from-group="removeTokenFromSelectedGroup"
      @save-edit-group="saveEditGroup"
      @select-all-new-group="selectAllNewGroup"
      @start-edit-group="startEditGroup"
    ></BatchDailyTasksGroupManageModal>
  </div>
</template>

<script setup>
// Import required dependencies
import {
  computed,
  defineAsyncComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from "vue";
import { tokenGroups, useTokenStore } from "@/stores/tokenStore";
import { useBatchTaskPersistence } from "@/composables/useBatchTaskPersistence";
import { useBatchConnectionManager } from "@/composables/useBatchConnectionManager";
import { useBatchConfigTransfer } from "@/composables/useBatchConfigTransfer";
import { useBatchLogManager } from "@/composables/useBatchLogManager";
import { useBatchTaskRuntime } from "@/composables/useBatchTaskRuntime";
import { useDreamBuyManager } from "@/composables/useDreamBuyManager";
import { useLegacyGiftManager } from "@/composables/useLegacyGiftManager";
import { useScheduledTaskCountdown } from "@/composables/useScheduledTaskCountdown";
import { useBatchTokenSelection } from "@/composables/useBatchTokenSelection";
import { useScheduledTaskRunner } from "@/composables/useScheduledTaskRunner";
import { useTaskTemplateManager } from "@/composables/useTaskTemplateManager";
import { useTokenTaskSettings } from "@/composables/useTokenTaskSettings";
import { useTokenGroupManager } from "@/composables/useTokenGroupManager";
import { useWarGuessManager } from "@/composables/useWarGuessManager";
import { DailyTaskRunner } from "@/utils/dailyTaskRunner";
import { useMessage } from "naive-ui/es";
import BatchDailyTasksAccountTemplateModal from "@/views/batch-daily-tasks/BatchDailyTasksAccountTemplateModal.vue";
import BatchDailyTasksApplyTemplateModal from "@/views/batch-daily-tasks/BatchDailyTasksApplyTemplateModal.vue";
import BatchDailyTasksBatchSettingsModal from "@/views/batch-daily-tasks/BatchDailyTasksBatchSettingsModal.vue";
import BatchDailyTasksHelperModal from "@/views/batch-daily-tasks/BatchDailyTasksHelperModal.vue";
import BatchDailyTasksHeader from "@/views/batch-daily-tasks/BatchDailyTasksHeader.vue";
import BatchDailyTasksDreamBuyModal from "@/views/batch-daily-tasks/BatchDailyTasksDreamBuyModal.vue";
import BatchDailyTasksLegacyGiftModal from "@/views/batch-daily-tasks/BatchDailyTasksLegacyGiftModal.vue";
import BatchDailyTasksListModal from "@/views/batch-daily-tasks/BatchDailyTasksListModal.vue";
import BatchDailyTasksLogPanel from "@/views/batch-daily-tasks/BatchDailyTasksLogPanel.vue";
import BatchDailyTasksSettingsModal from "@/views/batch-daily-tasks/BatchDailyTasksSettingsModal.vue";
import BatchDailyTasksTaskModal from "@/views/batch-daily-tasks/BatchDailyTasksTaskModal.vue";
import BatchDailyTasksTaskTemplateModal from "@/views/batch-daily-tasks/BatchDailyTasksTaskTemplateModal.vue";
import BatchDailyTasksGroupManageModal from "@/views/batch-daily-tasks/BatchDailyTasksGroupManageModal.vue";
import BatchDailyTasksTemplateManagerModal from "@/views/batch-daily-tasks/BatchDailyTasksTemplateManagerModal.vue";
import BatchDailyTasksToolbar from "@/views/batch-daily-tasks/BatchDailyTasksToolbar.vue";
import BatchDailyTasksTokenSelection from "@/views/batch-daily-tasks/BatchDailyTasksTokenSelection.vue";
import BatchDailyTasksWarGuessModal from "@/views/batch-daily-tasks/BatchDailyTasksWarGuessModal.vue";
import {
  buildWarGuessActivityTip,
  getBatchCurrentActivityWeek,
  getBatchFourthSundayOfMonth,
  groupAvailableTasks,
  isBatchArenaActivityOpen,
  isBatchBaokuActivityOpen,
  isBatchCarActivityOpen,
  isBatchMengjingActivityOpen,
  isBatchWarGuessActivityOpen,
  isBatchWeirdTowerActivityOpen,
  TASK_GROUP_DEFINITIONS,
} from "@/views/batch-daily-tasks/batchDailyTaskFormatters.js";
import { useBatchTokenSort } from "@/views/batch-daily-tasks/useBatchTokenSort";
import {
  ARENA_LINEUP_PRESET_OPTIONS,
  ARENA_LINEUP_PRESET_VALUES,
} from "@/utils/arenaLineupPresets";

// Import batch task modules
import {
  addTaskSaveLog,
  availableTasks,
  bossTimesOptions,
  // Constants
  boxTypeOptions,
  calculateMonthProgress,
  calculateNextExecutionTime,
  calculateNextRuns,
  canClaim,
  fishTypeOptions,
  formationOptions,
  formatTimeDifference,
  getTodayStartSec,
  gradeLabel,
  isTodayAvailable,
  matchesCronExpression,
  // Car utilities
  normalizeCars,
  pickArenaTargetId,
  shouldSendCar,
  validateCronExpression,
} from "@/utils/batch";

import { goldItemsConfig, merchantConfig } from "@/utils/dreamConstants";

// Initialize token store, message service, and task runner
const tokenStore = useTokenStore();
const message = useMessage();
const helperLineupKeywordOptions = [...ARENA_LINEUP_PRESET_OPTIONS];
const helperLineupKeywordSet = new Set(ARENA_LINEUP_PRESET_VALUES);

// 计算属性 - 从gameData中获取塔相关信息
const evoTowerInfo = computed(() => {
  const data = tokenStore.gameData?.evoTowerInfo || null;
  return data;
});

const weirdTowerData = computed(() => {
  return evoTowerInfo.value?.evoTower || null;
});

const currentTowerId = computed(() => {
  return weirdTowerData.value?.towerId || 0;
});

const towerEnergy = computed(() => {
  return weirdTowerData.value?.energy || 0;
});

const { getSortIcon, sortConfig, sortedTokens, toggleSort } =
  useBatchTokenSort(tokenStore);

const tokens = computed(() => tokenStore.gameTokens);
const isCarActivityOpen = computed(() => isBatchCarActivityOpen(new Date()));
const ismengjingActivityOpen = computed(() => isBatchMengjingActivityOpen(new Date()));
const isbaokuActivityOpen = computed(() => isBatchBaokuActivityOpen(new Date()));
const isarenaActivityOpen = computed(() => isBatchArenaActivityOpen(new Date()));
const currentActivityWeek = computed(() => getBatchCurrentActivityWeek(new Date()));
const isWeirdTowerActivityOpen = computed(() =>
  isBatchWeirdTowerActivityOpen(new Date(), currentActivityWeek.value),
);
const warGuessOpenDate = computed(() => getBatchFourthSundayOfMonth(new Date()));
const isWarGuessActivityOpen = computed(() =>
  isBatchWarGuessActivityOpen(new Date(), warGuessOpenDate.value),
);

const warGuessActivityTip = computed(() => {
  return buildWarGuessActivityTip({
    currentWeek: currentActivityWeek.value,
    isOpen: isWarGuessActivityOpen.value,
    openDate: warGuessOpenDate.value,
  });
});

const selectedTokens = ref([]);
const tokenStatus = ref({}); // { tokenId: 'waiting' | 'running' | 'completed' | 'failed' }
const isRunning = ref(false);
const shouldStop = ref(false);

const {
  addTokenToSelectedGroup,
  cancelEditGroup,
  clearAllGroupSelection,
  createNewGroup,
  deleteGroup,
  deselectAllNewGroup,
  editingGroupColor,
  editingGroupId,
  editingGroupName,
  getValidGroupTokenIds,
  groupColors,
  isGroupSelected,
  newGroupColor,
  newGroupName,
  newGroupSelectedTokens,
  removeTokenFromSelectedGroup,
  saveEditGroup,
  selectAllNewGroup,
  selectedGroups,
  showGroupManageModal,
  startEditGroup,
  taskScheduleSelectedGroupIds,
  toggleGroupSelection,
} = useTokenGroupManager({
  message,
  selectedTokens,
  sortedTokens,
  tokenGroups,
  tokenStore,
  tokens,
});

const {
  filteredAccountTemplates,
  filteredTaskTemplates,
  filterAccountTemplates,
  applyTemplate,
  currentTemplate,
  currentTemplateId,
  currentTemplateName,
  deleteTaskTemplate,
  handleSelectAllForApply,
  isAllSelectedForApply,
  isIndeterminateForApply,
  loadTaskTemplates,
  openAccountTemplateModal,
  openApplyTemplateModal,
  openEditTemplateModal,
  openNewTemplateModal,
  openTaskTemplateModal,
  openTemplateManagerModal,
  saveTaskTemplate,
  selectedTemplateForFilter,
  selectedTemplateId,
  selectedTokensForApply,
  showAccountTemplateModal,
  showApplyTemplateModal,
  showTaskTemplateModal,
  showTemplateManagerModal,
  taskTemplates,
} = useTaskTemplateManager({
  message,
  sortedTokens,
});

const defaultDreamPurchaseList = [];
for (const merchantId in goldItemsConfig) {
  goldItemsConfig[merchantId].forEach((index) => {
    defaultDreamPurchaseList.push(`${merchantId}-${index}`);
  });
}
const batchSettingsDefaults = {
  dreamPurchaseList: defaultDreamPurchaseList,
  boxCount: 100,
  fishCount: 100,
  recruitCount: 100,
  defaultBoxType: 2001,
  defaultFishType: 1,
  receiverId: "",
  password: "",
  tokenListColumns: 2,
  useGoldRefreshFallback: false,
  // 延迟配置（毫秒）
  commandDelay: 500, // 命令间延迟
  taskDelay: 500, // 任务间延迟
  actionDelay: 300, // 一般操作延迟（开箱、钓鱼、招募等）
  battleDelay: 500, // 战斗延迟（宝库、竞技场等）
  refreshDelay: 1000, // 刷新延迟（发车刷新等）
  longDelay: 3000, // 长延迟（功法赠送等）
  // 其他配置
  maxActive: 2,
  carMinColor: 4,
  connectionTimeout: 10000,
  reconnectDelay: 1000,
  maxLogEntries: 1000,
  // 页面刷新配置
  enableRefresh: false,
  refreshInterval: 360, // 分钟
  smartDepartureGoldThreshold: 0,
  smartDepartureRecruitThreshold: 0,
  smartDepartureJadeThreshold: 0,
  smartDepartureTicketThreshold: 0,
  smartDepartureMaxRefreshAttempts: 30,
  smartDepartureMatchAll: false,
  helperLineupAnalysisEnabled: true,
  helperPreferredLineups: [],
};

// ======================
// Scheduled Tasks Feature
// ======================

// 任务分组定义
const taskGroupDefinitions = TASK_GROUP_DEFINITIONS;

// 计算属性，根据 taskGroupDefinitions 将 availableTasks 分组
const groupedAvailableTasks = computed(() => {
  return groupAvailableTasks(availableTasks, taskGroupDefinitions);
});

let batchLogManager = null;
const helperTaskActions = {};
let batchLegacyGiftSendEnhancedAction = () => {};
let quickTaskLogForwarder = () => {};

function addLog(log) {
  batchLogManager?.addLog(log);
}

const sanitizeHelperPreferredLineups = (lineups) => {
  if (!Array.isArray(lineups)) {
    return [];
  }
  return [
    ...new Set(
      lineups
        .map((item) => String(item || "").trim())
        .filter((item) => item && helperLineupKeywordSet.has(item)),
    ),
  ];
};

const {
  batchSettings,
  cronNextRuns,
  cronValidation,
  deleteTask,
  deselectAllTasks,
  editTask,
  editingTask,
  openBatchSettings,
  openTaskModal,
  parseCronExpression,
  saveBatchSettings,
  saveScheduledTasks,
  saveTask,
  scheduledTasks,
  selectAllTasks,
  showBatchSettingsModal,
  showTaskModal,
  showTasksModal,
  taskForm,
  toggleTaskEnabled,
} = useBatchTaskPersistence({
  message,
  addLog,
  addTaskSaveLog,
  validateCronExpression,
  calculateNextRuns,
  availableTasks,
  taskScheduleSelectedGroupIds,
  batchSettingsDefaults,
  sanitizeHelperPreferredLineups,
});

// 注: availableTasks, CarresearchItem, taskColumns 已从 @/utils/batch 导入

// ======================
// Scheduled Tasks Storage
// ======================

// Track executing tasks for UI loading state
const executingTaskIds = ref([]);

// Manual execute task
const manualExecuteTask = async (task) => {
  if (executingTaskIds.value.includes(task.id))
    return;

  // Reset stop flag if not running, to allow manual execution
  if (!isRunning.value && shouldStop.value) {
    shouldStop.value = false;
  }

  executingTaskIds.value.push(task.id);
  try {
    message.info(`开始执行任务: ${task.name}`);
    await executeScheduledTask(task);
    message.success(`任务 ${task.name} 执行完成`);
  } catch (e) {
    console.error(`执行任务 ${task.name} 失败:`, e);
    message.error(`任务 ${task.name} 执行失败`);
  } finally {
    executingTaskIds.value = executingTaskIds.value.filter(
      (id) => id !== task.id,
    );
  }
};

// 注: addTaskSaveLog 已从 @/utils/batch 导入，调用时需传入 addLog

// Reset run type related fields
const resetRunType = () => {
  if (taskForm.runType === "daily") {
    taskForm.cronExpression = "";
  } else {
    taskForm.runTime = undefined;
  }
};

// Select all tokens
const selectAllTokens = () => {
  taskForm.selectedTokens = tokens.value.map((token) => token.id);
};

// Deselect all tokens
const deselectAllTokens = () => {
  taskForm.selectedTokens = [];
};

const { exportConfig, importConfig } = useBatchConfigTransfer({
  batchSettings,
  message,
  saveBatchSettings,
  saveScheduledTasks,
  scheduledTasks,
  tokens,
});

// ======================
// Scheduled Tasks Countdown
// ======================

// 注: parseCronField, calculateNextExecutionTime, formatTimeDifference 已从 @/utils/batch 导入

const {
  nextExecutionTimes,
  resetCountdowns,
  shortestCountdownTask,
  startCountdown,
  stopCountdown,
  taskCountdowns,
} = useScheduledTaskCountdown({
  scheduledTasks,
  calculateNextExecutionTime,
  formatTimeDifference,
});

// ======================
// Scheduled Tasks Scheduler
// ======================

// Watch for changes to scheduledTasks for debugging
watch(
  scheduledTasks,
  () => {
    resetCountdowns();
  },
  { deep: true },
);

// 修复TimePicker的"Invalid time value"错误：确保runTime的初始值不是null
watch(
  () => showTaskModal.value,
  (isVisible) => {
    if (isVisible && !taskForm.runTime) {
      // 当模态框显示且runTime为null时，将其设置为undefined
      taskForm.runTime = undefined;
    }
  },
);

batchLogManager = useBatchLogManager({
  batchSettings,
  forwardQuickTaskLog: (log) => quickTaskLogForwarder(log),
  message,
  nextTick,
  tokens,
});

const {
  autoScrollLog,
  clearLogs,
  copyLogs,
  currentProgress,
  currentRunningTokenId,
  currentRunningTokenName,
  errorCount,
  filteredLogs,
  filterErrorsOnly,
  logContainer,
  logs,
} = batchLogManager;

const setBatchLogContainer = (element) => {
  logContainer.value = element;
};

const batchToolbarActions = {
  batchAddHangUpTime,
  batchBuyDreamItems,
  batchClaimBoxPointReward,
  batchClaimCars,
  batchClaimFreeEnergy,
  batchClaimMailAttachment,
  batchClaimPeachTasks,
  batchClaimStarRewards,
  batchGenieSweep,
  batchHeroUpgrade,
  batchLegacyClaim,
  batchMergeItems,
  batchStudy,
  batchTopUpArena,
  batchTopUpFish,
  batchUseItems,
  batcharenafight,
  batchbaoku13,
  batchbaoku45,
  batchclubsign,
  batchlingguanzi,
  batchmengjing,
  climbTower,
  climbWeirdTower,
  collection_claimfreereward,
  claimHangUpRewards,
  legionStoreBuySkinCoins,
  legion_storebuygoods,
  resetBottles,
  skinChallenge,
  store_purchase,
};

const handleBatchToolbarAction = (actionKey) => {
  const action = batchToolbarActions[actionKey];
  if (typeof action === "function") {
    action();
  }
};

const appendGroupTokensForApply = (groupId) => {
  const groupTokenIds = getValidGroupTokenIds(groupId);
  const nextSelectedTokens = new Set(selectedTokensForApply.value || []);
  groupTokenIds.forEach((tokenId) => {
    nextSelectedTokens.add(tokenId);
  });
  selectedTokensForApply.value = [...nextSelectedTokens];
};

const updateTaskFormField = (key, value) => {
  taskForm[key] = value;
};

const toggleTaskScheduleGroup = (groupId) => {
  const index = taskScheduleSelectedGroupIds.indexOf(groupId);
  const groupTokenIds = getValidGroupTokenIds(groupId);

  if (index > -1) {
    taskScheduleSelectedGroupIds.splice(index, 1);
    taskForm.selectedTokens = taskForm.selectedTokens.filter(
      (tokenId) => !groupTokenIds.includes(tokenId),
    );
    return;
  }

  taskScheduleSelectedGroupIds.push(groupId);
  groupTokenIds.forEach((tokenId) => {
    if (!taskForm.selectedTokens.includes(tokenId)) {
      taskForm.selectedTokens.push(tokenId);
    }
  });
};

const updateSettingsField = (target, key, value) => {
  if (target && key) {
    target[key] = value;
  }
};

// 注: boxTypeOptions, fishTypeOptions 已从 @/utils/batch 导入

// 批量功法残卷赠送相关方法
const {
  clearAllItems,
  dreamBuyList,
  openDreamBuyModal,
  saveDreamBuyConfig,
  selectAllItems,
  selectGoldItems,
  showDreamBuyModal,
  toggleDreamItem,
} = useDreamBuyManager({
  batchSettings,
  goldItemsConfig,
  merchantConfig,
  message,
  saveBatchSettings,
});

// 注: formationOptions, bossTimesOptions 已从 @/utils/batch 导入

const {
  currentSettings,
  currentSettingsTokenId,
  currentSettingsTokenName,
  executeHelper,
  helperModalTitle,
  helperSettings,
  helperType,
  loadSettings,
  openHelperModal,
  openSettings,
  saveSettings,
  showHelperModal,
  showSettingsModal,
} = useTokenTaskSettings({
  batchFish: (...args) => helperTaskActions.batchFish?.(...args),
  batchOpenBox: (...args) => helperTaskActions.batchOpenBox?.(...args),
  batchRecruit: (...args) => helperTaskActions.batchRecruit?.(...args),
  message,
});

// 注: pickArenaTargetId, FISH_TARGET, ARENA_TARGET, getTodayStartSec, isTodayAvailable, calculateMonthProgress 已从 @/utils/batch 导入

const {
  getStatusText,
  getStatusType,
  handleSelectAll,
  isAllSelected,
  isIndeterminate,
} = useBatchTokenSelection({
  selectedTokens,
  tokenStatus,
  tokens,
});

const {
  connectionQueue,
  ensureConnection,
  releaseConnectionSlot,
} = useBatchConnectionManager({
  addLog,
  batchSettings,
  tokenStore,
  tokens,
});

const {
  avatarLoadError,
  clearRecipientError,
  confirmLegacyGift,
  giftQuantity,
  handleAvatarError,
  handleAvatarLoad,
  isAvatarLoading,
  isQueryingRecipient,
  queryRecipientInfo,
  recipientIdError,
  recipientIdInput,
  recipientInfo,
  securityPassword,
  showLegacyGiftModal,
} = useLegacyGiftManager({
  addLog,
  batchLegacyGiftSendEnhanced: (...args) =>
    batchLegacyGiftSendEnhancedAction(...args),
  ensureConnection,
  message,
  selectedTokens,
  tokenStore,
  tokens,
});

const {
  claimHangUpRewards,
  batchAddHangUpTime,
  batchStudy,
  batchclubsign,
  batchClaimMailAttachment,
  batchWarGuessCheer,
  resetBottles,
  batchlingguanzi,
  climbTower,
  climbWeirdTower,
  batchClaimFreeEnergy,
  skinChallenge,
  batchUseItems,
  batchMergeItems,
  batchSmartSendCar,
  batchClaimCars,
  batchOpenBox,
  batchClaimBoxPointReward,
  batchFish,
  batchRecruit,
  batchHeroUpgrade,
  batchBookUpgrade,
  batchClaimStarRewards,
  batchClaimPeachTasks,
  batchGenieSweep,
  batchbaoku13,
  batchbaoku45,
  batchmengjing,
  batchBuyDreamItems,
  batcharenafight,
  batchArenaStandalone,
  batchTopUpFish,
  batchTopUpArena,
  legionStoreBuySkinCoins,
  legion_storebuygoods,
  store_purchase,
  collection_claimfreereward,
  batchLegacyClaim,
  batchLegacyGiftSendEnhanced,
  executeQuickTask,
  executeScheduledTask,
  forwardQuickTaskLog,
  getSelectedTokenIds,
  setSelectedTokenIds,
  startBatch,
  stopBatch,
} = useBatchTaskRuntime({
  DailyTaskRunner,
  addLog,
  autoScrollLog,
  availableTasks,
  batchSettings,
  calculateMonthProgress,
  canClaim,
  connectionQueue,
  currentRunningTokenId,
  currentSettings,
  ensureConnection,
  getTodayStartSec,
  giftQuantity,
  gradeLabel,
  helperSettings,
  isCarActivityOpen,
  isRunning,
  isTodayAvailable,
  isWeirdTowerActivityOpen,
  isarenaActivityOpen,
  isbaokuActivityOpen,
  ismengjingActivityOpen,
  loadSettings,
  logContainer,
  logs,
  message,
  nextTick,
  normalizeCars,
  pickArenaTargetId,
  recipientIdInput,
  recipientInfo,
  releaseConnectionSlot,
  securityPassword,
  selectedTokens,
  shouldSendCar,
  shouldStop,
  tokenStatus,
  tokenStore,
  tokens,
});

const {
  currentGuessCount,
  fetchWarGuessRank,
  handleWarGuessCheer,
  openWarGuessModal,
  selectedWarGuessLegionId,
  showWarGuessModal,
  warGuessCoin,
  warGuessColumns,
  warGuessList,
  warGuessLoading,
  warGuessRowProps,
} = useWarGuessManager({
  addLog,
  batchWarGuessCheer,
  h,
  isRunning,
  message,
  selectedTokens,
  tokenStore,
  tokens,
});

Object.assign(helperTaskActions, {
  batchFish,
  batchOpenBox,
  batchRecruit,
});
batchLegacyGiftSendEnhancedAction = batchLegacyGiftSendEnhanced;
quickTaskLogForwarder = forwardQuickTaskLog;

const {
  intervalId,
  scheduleTaskExecution,
  stopScheduler,
} = useScheduledTaskRunner({
  addLog,
  batchSettings,
  executeScheduledTask,
  isRunning,
  matchesCronExpression,
  scheduledTasks,
});

// Debug: Log initial state when component mounts
onMounted(() => {
  // Start the task scheduler after all functions are initialized
  scheduleTaskExecution();
  // Start countdown timer
  startCountdown();
  loadTaskTemplates();
});

// Cleanup countdown interval on unmount
onBeforeUnmount(() => {
  stopCountdown();
  stopScheduler();
});

defineExpose({
  executeQuickTask,
  setSelectedTokenIds,
  getSelectedTokenIds,
});
</script>

<style scoped lang="scss">
.batch-daily-tasks {
  position: relative;
  padding: clamp(14px, 1.6vw, 22px);
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  background: transparent;
  animation: batch-fade-in 0.4s ease;
}

.batch-daily-tasks::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  background:
    radial-gradient(circle at 12% 10%, rgba(63, 119, 173, 0.1), transparent 24%),
    radial-gradient(circle at 88% 12%, rgba(90, 155, 142, 0.08), transparent 22%);
  opacity: 0.9;
}

.main-layout {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(320px, 380px);
  gap: clamp(14px, 1.6vw, 20px);
  height: 100%;
  overflow: hidden;
}

.left-column {
  min-width: 0;
  display: grid;
  align-content: start;
  gap: var(--spacing-md);
  overflow-y: auto;
  padding-right: 6px;

  &::-webkit-scrollbar {
    width: 8px;
  }
}

.right-column {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.batch-daily-tasks :deep(.n-card) {
  border-radius: 24px;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 12%),
    var(--surface-glass-strong);
  box-shadow:
    0 18px 36px rgba(15, 23, 42, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.18);
  backdrop-filter: blur(12px);
}

.batch-daily-tasks :deep(.n-card-header) {
  border-bottom: 1px solid var(--border-light);
  padding: clamp(18px, 1.8vw, 24px) clamp(18px, 1.8vw, 24px) 0;
}

.mt-16 {
  margin-top: 16px;
}

@media (max-width: 992px) {
  .batch-daily-tasks {
    height: auto;
    overflow: visible;
  }

  .main-layout {
    grid-template-columns: 1fr;
    height: auto;
    overflow: visible;
  }

  .left-column {
    overflow-y: visible;
    padding-right: 0;
  }

  .right-column {
    height: auto;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .batch-daily-tasks :deep(.n-button) {
    min-height: 40px;
  }

  .batch-daily-tasks :deep(.n-button.n-button--small-type),
  .batch-daily-tasks :deep(.n-button.n-button--medium-type),
  .batch-daily-tasks :deep(.n-button.n-button--tiny-type) {
    min-height: 40px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .batch-daily-tasks {
    padding: 12px;
    height: auto;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .main-layout {
    height: auto;
    overflow: visible;
  }

  .left-column {
    overflow: visible;
    padding-right: 0;
    height: auto;
  }

  .right-column {
    height: auto;
    width: 100%;
  }
}

@keyframes batch-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
