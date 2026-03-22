<template>
  <div class="task-control-panel">
    <div class="head-row">
      <div class="head-title">
        <h2>{{ t("taskControl.title") }}</h2>
      </div>
      <div class="head-actions">
        <span class="quiet-label">{{ t("taskControl.quietWindow.label") }}</span>
        <NSwitch
          :value="quietWindowsEnabled"
          @update:value="setQuietWindowsEnabled"
        ></NSwitch>
        <span class="quiet-sub">{{ quietWindowsEnabled ? t("taskControl.common.enabled") : t("taskControl.common.disabled") }}</span>
        <NButton size="small" @click="enableAll">{{ t("taskControl.actions.enableAll") }}</NButton>
        <NButton size="small" @click="disableAll">{{ t("taskControl.actions.disableAll") }}</NButton>
        <NButton size="small" @click="refreshState">{{ t("taskControl.actions.refresh") }}</NButton>
      </div>
    </div>
    <div class="bin-status-row" :class="{ warning: configuredMissingBoundTokenIds.length > 0 }">
      <span>BIN可用账号: {{ availableBinTokenIds.length }}</span>
      <span>任务绑定账号: {{ configuredBoundTokenIds.length }}</span>
      <span>缺失BIN: {{ configuredMissingBoundTokenIds.length }}</span>
      <span v-if="configuredMissingBoundTokenIds.length > 0" class="bin-status-missing">
        缺失账号: {{ missingBoundTokenLabels }}
      </span>
      <NButton secondary size="tiny" :loading="binStatusLoading" @click="loadBinStatus">
        刷新BIN
      </NButton>
    </div>
    <div v-if="preparingRunner" class="runner-status-row">
      <span class="runner-status-dot"></span>
      <span>正在准备执行环境，首次执行会稍等几秒...</span>
    </div>
    <div v-if="isMobile" class="task-card-list">
      <div v-for="row in taskRows" :key="row.id" class="task-card">
        <div class="task-card-main">
          <div class="task-main">{{ row.title }}</div>
          <div class="task-sub">{{ cronToText(row.cronExpr) }}</div>
          <div class="task-card-next">{{ t("taskControl.table.nextRun") }}：{{ getNextRunText(row, nextRunNow) }}</div>
        </div>
        <div class="task-card-status">
          <span>{{ t("taskControl.table.status") }}</span>
          <NSwitch :value="!!row.enabled" @update:value="(v) => setTaskEnabled(row.id, v)"></NSwitch>
        </div>
        <div class="task-card-actions">
          <NButton secondary size="small" @click="openSettingsPanel(row)">
            {{ t("taskControl.actions.settings") }}
          </NButton>
          <NButton
            size="small"
            type="primary"
            :disabled="runningTaskIds.has(row.id) || preparingRunner"
            @click="runTask(row, 'manual')"
          >
            {{
              runningTaskIds.has(row.id)
                ? t("taskControl.actions.running")
                : preparingRunner
                  ? "准备中"
                  : t("taskControl.actions.run")
            }}
          </NButton>
        </div>
      </div>
    </div>
    <n-data-table
      :key="tableRefreshKey"
      v-else
      size="small"
      :bordered="false"
      :columns="columns"
      :data="taskRows"
      :pagination="false"
      :scroll-x="980"
    ></n-data-table>

    <div class="log-panel">
      <div class="log-head">
        <h3>{{ t("taskControl.logs.title") }}</h3>
        <div class="log-head-actions">
          <NButton v-if="isMobile" size="small" @click="toggleMobileLogs">
            {{ mobileLogsExpanded ? "收起日志" : "展开日志" }}
          </NButton>
          <NButton secondary size="small" type="error" :disabled="logs.length === 0" @click="clearLogs">{{ t("taskControl.logs.clear") }}</NButton>
          <NButton size="small" @click="toggleAutoScroll">{{ autoScroll ? t("taskControl.logs.stopAutoScroll") : t("taskControl.logs.resumeAutoScroll") }}</NButton>
        </div>
      </div>

      <div ref="logRef" v-if="!isMobile || mobileLogsExpanded" class="log-list">
        <div v-if="logs.length === 0" class="log-empty">{{ t("taskControl.logs.empty") }}</div>
        <div v-for="item in visibleLogs" :key="item.id" class="log-item" :class="`log-${item.status}`">
          <span class="log-time">{{ formatTime(item.time) }}</span>
          <span class="log-task">{{ item.task }}</span>
          <span class="log-msg">{{ item.message }}</span>
        </div>
      </div>
    </div>

    <n-drawer
      v-if="showSettings"
      v-model:show="showSettings"
      :height="settingsDrawerHeight"
      :placement="settingsDrawerPlacement"
      :width="settingsDrawerWidth"
    >
      <n-drawer-content closable :title="t('taskControl.settings.title')">
      <n-form v-if="editingTask" label-placement="left" label-width="96">
        <n-steps v-if="isMobile" size="small" :current="settingsStep">
          <n-step title="基础"></n-step>
          <n-step title="账号"></n-step>
          <n-step v-if="hasAdvancedSettings" title="高级"></n-step>
        </n-steps>
        <template v-if="!isMobile || settingsStep === 1">
        <n-form-item :label="t('taskControl.settings.fields.taskName')">
          <n-input disabled :value="editingTask.title"></n-input>
        </n-form-item>
        <n-form-item :label="t('taskControl.settings.fields.autoExecute')">
          <NSwitch v-model:value="settingsForm.enabled"></NSwitch>
        </n-form-item>
        <n-form-item :label="t('taskControl.settings.fields.schedule')">
          <n-select
            v-model:value="settingsForm.scheduleKey"
            :options="scheduleOptions"
            :placeholder="t('taskControl.settings.placeholders.selectSchedule')"
          ></n-select>
        </n-form-item>
        <template v-if="settingsForm.scheduleKey === 'custom_simple'">
          <n-form-item :label="t('taskControl.settings.fields.type')">
            <n-select
              v-model:value="settingsForm.customType"
              :options="customTypeOptions"
              :placeholder="t('taskControl.settings.placeholders.selectCustomType')"
            ></n-select>
          </n-form-item>
          <n-form-item v-if="settingsForm.customType === 'hourly'" :label="t('taskControl.settings.fields.everyHours')">
            <n-input-number
              style="width: 100%"
              v-model:value="settingsForm.customIntervalHours"
              :max="23"
              :min="1"
            ></n-input-number>
          </n-form-item>
          <n-form-item
            v-if="settingsForm.customType === 'weekly'"
            :label="t('taskControl.settings.fields.weekday')"
          >
            <n-select
              clearable
              multiple
              v-model:value="settingsForm.customWeekDays"
              :options="weekDayOptions"
              :placeholder="t('taskControl.settings.placeholders.selectWeekdays')"
            ></n-select>
          </n-form-item>
          <n-form-item
            v-if="settingsForm.customType === 'daily' || settingsForm.customType === 'weekly'"
            :label="t('taskControl.settings.fields.time')"
          >
            <n-space>
              <n-input-number
                style="width: 120px"
                v-model:value="settingsForm.customHour"
                :max="23"
                :min="0"
                :placeholder="t('taskControl.settings.placeholders.hour')"
              ></n-input-number>
              <n-input-number
                style="width: 120px"
                v-model:value="settingsForm.customMinute"
                :max="59"
                :min="0"
                :placeholder="t('taskControl.settings.placeholders.minute')"
              ></n-input-number>
            </n-space>
          </n-form-item>
        </template>
        <n-form-item v-if="settingsForm.scheduleKey === 'custom'" :label="t('taskControl.settings.fields.cron')">
          <n-input v-model:value="settingsForm.cronExpr" :placeholder="t('taskControl.settings.placeholders.cron')"></n-input>
        </n-form-item>
          <n-form-item :label="t('taskControl.settings.fields.schedule')">
            <n-space wrap>
              <NButton size="tiny" @click="applyQuickSchedule('daily_0930')">每天 09:30</NButton>
              <NButton size="tiny" @click="applyQuickSchedule('hourly_6')">每 6 小时</NButton>
              <NButton size="tiny" @click="applyQuickSchedule('hourly_8')">每 8 小时</NButton>
            </n-space>
          </n-form-item>
        </template>
        <template v-if="!isMobile || settingsStep === 2">
          <n-form-item :label="t('taskControl.settings.fields.tokenIds')">
            <n-select
              clearable
              filterable
              multiple
              v-model:value="settingsForm.tokenIds"
              :options="tokenOptions"
              :placeholder="t('taskControl.settings.placeholders.tokenIds')"
            ></n-select>
          </n-form-item>
        </template>
        <template v-if="!isMobile || settingsStep === 3">
          <n-collapse :default-expanded-names="isMobile ? [] : ['task-advanced']">
            <n-collapse-item name="task-advanced" title="高级选项">
              <component
                :is="currentAdvancedComponent"
                v-if="currentAdvancedComponent"
                :arena-formation-options="arenaFormationOptions"
                :car-color-options="carColorOptions"
                :clear-daily-runner-override="clearDailyRunnerOverride"
                :daily-selectable-options="dailySelectableOptions"
                :helper-lineup-keyword-options="helperLineupKeywordOptions"
                :on-daily-runner-editor-token-change="onDailyRunnerEditorTokenChange"
                :on-smart-car-editor-token-change="onSmartCarEditorTokenChange"
                :clear-smart-car-override="clearSmartCarOverride"
                :settings-form="settingsForm"
                :arena-skip-lineup-options="arenaSkipLineupOptions"
                :t="t"
                :club-store-goods-options="clubStoreGoodsOptions"
                :token-options="tokenOptions"
              ></component>
              <div v-else class="advanced-empty">当前任务没有高级参数</div>
            </n-collapse-item>
          </n-collapse>
        </template>
      </n-form>
      <template #footer>
        <n-space justify="end">
          <NButton @click="showSettings = false">{{ t("taskControl.actions.cancel") }}</NButton>
          <NButton v-if="isMobile && settingsStep > 1" @click="prevSettingsStep">上一步</NButton>
          <NButton
            v-if="isMobile && settingsStep < settingsMaxStep"
            secondary
            type="primary"
            @click="nextSettingsStep"
          >
            下一步
          </NButton>
          <NButton v-else type="primary" @click="saveSettings">{{ t("taskControl.actions.save") }}</NButton>
        </n-space>
      </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent, h, onBeforeUnmount, onMounted, ref } from "vue";
import { NButton, NSwitch, useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTaskControlLogs } from "@/composables/useTaskControlLogs";
import { useTaskControlNextRun } from "@/composables/useTaskControlNextRun";
import { useTaskControlRunner } from "@/composables/useTaskControlRunner";
import { useTaskControlScheduler } from "@/composables/useTaskControlScheduler";
import { useTaskControlSettings } from "@/composables/useTaskControlSettings";
import { useTaskControlSettingsEditor } from "@/composables/useTaskControlSettingsEditor";
import { useTaskControlState } from "@/composables/useTaskControlState";
import { useTokenStore } from "@/stores/tokenStore";
import { matchesCronExpression, validateCronExpression } from "@/utils/batch";

const props = defineProps({
  preparingRunner: {
    type: Boolean,
    default: false,
  },
  runFeature: {
    type: Function,
    default: null,
  },
});
const message = useMessage();
const tokenStore = useTokenStore();
const { t, locale } = useI18n();

const quietWindowsEnabled = ref(false);
const isMobile = ref(false);
const settingsStep = ref(1);
const mobileLogsExpanded = ref(false);
const MOBILE_LOG_RENDER_LIMIT = 120;
let mobileMediaQuery = null;
let mobileMediaListener = null;

const runningTaskIds = new Set();
const nextRunNow = ref(Date.now());
const tableRefreshKey = ref(0);
const {
  DEFAULT_ARENA_SKIP_LINEUPS,
  TASK_TEMPLATES,
  arenaFormationOptions,
  arenaSkipLineupOptions,
  buildSimpleCustomCron,
  carColorOptions,
  clearDailyRunnerOverride,
  clearSmartCarOverride,
  clubStoreGoodsOptions,
  cronToText,
  customTypeOptions,
  dailySelectableOptions,
  editingTask,
  getCronByScheduleKey,
  getDefaultDailyRunnerSettings,
  getDefaultSmartCarSettings,
  getScheduleKeyByCronExpr,
  helperLineupKeywordOptions,
  normalizeClubStoreGoodsIds,
  normalizeDailyRunnerByTokenMap,
  normalizeDailyRunnerSettings,
  normalizeDailySelectedTasks,
  normalizeSkipLineups,
  normalizeSmartCarByTokenMap,
  normalizeSmartCarSettings,
  onDailyRunnerEditorTokenChange,
  onSmartCarEditorTokenChange,
  resolveDailyRunnerSettingsForToken,
  resolveSmartCarSettingsForToken,
  scheduleOptions,
  settingsForm,
  showSettings,
  tokenOptions,
  weekDayOptions,
} = useTaskControlSettings();
const hasAdvancedSettings = computed(() =>
  ["daily", "send-car", "arena", "club-store"].includes(editingTask.value?.id),
);
const ADVANCED_COMPONENT_MAP = {
  "daily": defineAsyncComponent(() => import("./settings/TaskAdvancedDaily.vue")),
  "send-car": defineAsyncComponent(() => import("./settings/TaskAdvancedSendCar.vue")),
  "arena": defineAsyncComponent(() => import("./settings/TaskAdvancedArena.vue")),
  "club-store": defineAsyncComponent(() => import("./settings/TaskAdvancedClubStore.vue")),
};
const currentAdvancedComponent = computed(() => ADVANCED_COMPONENT_MAP[editingTask.value?.id] || null);
const settingsMaxStep = computed(() => (hasAdvancedSettings.value ? 3 : 2));
const settingsDrawerPlacement = computed(() => (isMobile.value ? "bottom" : "right"));
const settingsDrawerWidth = computed(() => (isMobile.value ? undefined : 620));
const settingsDrawerHeight = computed(() => (isMobile.value ? "100vh" : undefined));
const {
  appendLog,
  autoScroll,
  clearLogs,
  formatTime,
  loadLogs,
  logRef,
  logs,
  startLogsPolling,
  stopLogsPolling,
  toggleAutoScroll,
} = useTaskControlLogs({
  locale,
  message,
  t,
});
const visibleLogs = computed(() => {
  if (!Array.isArray(logs.value))
    return [];
  if (!isMobile.value)
    return logs.value;
  return logs.value.slice(0, MOBILE_LOG_RENDER_LIMIT);
});
const toggleMobileLogs = () => {
  mobileLogsExpanded.value = !mobileLogsExpanded.value;
};
const {
  getHourlyIntervalFromCron,
  getNextRunText,
  isIntervalDueNow,
  minuteKey,
  refreshNextRunNow,
  startNextRunTicker,
  stopNextRunTicker,
} = useTaskControlNextRun({
  locale,
  matchesCronExpression,
  t,
  tableRefreshKey,
  validateCronExpression,
});
let schedulerApi = null;
let settingsEditorApi = null;
const loadQuietWindowSetting = (...args) =>
  schedulerApi?.loadQuietWindowSetting?.(...args) || Promise.resolve();
const setQuietWindowsEnabled = (...args) =>
  schedulerApi?.setQuietWindowsEnabled?.(...args) || Promise.resolve();
const setTaskEnabled = (...args) => schedulerApi?.setTaskEnabled?.(...args);
const startScheduler = (...args) => schedulerApi?.startScheduler?.(...args);
const stopScheduler = (...args) => schedulerApi?.stopScheduler?.(...args);
const openSettings = (...args) => settingsEditorApi?.openSettings?.(...args);
const saveSettings = (...args) => settingsEditorApi?.saveSettings?.(...args);
const openSettingsPanel = (row) => {
  settingsStep.value = 1;
  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(() => openSettings(row));
    return;
  }
  openSettings(row);
};
const nextSettingsStep = () => {
  settingsStep.value = Math.min(settingsMaxStep.value, settingsStep.value + 1);
};
const prevSettingsStep = () => {
  settingsStep.value = Math.max(1, settingsStep.value - 1);
};
const applyQuickSchedule = (key) => {
  if (key === "hourly_6") {
    settingsForm.value.scheduleKey = "custom_simple";
    settingsForm.value.customType = "hourly";
    settingsForm.value.customIntervalHours = 6;
    return;
  }
  settingsForm.value.scheduleKey = key;
};
const {
  availableBinTokenIds,
  binStatusLoading,
  configuredBoundTokenIds,
  configuredMissingBoundTokenIds,
  loadBinStatus,
  loadState,
  missingBoundTokenLabels,
  persistState,
  taskRows,
} = useTaskControlState({
  DEFAULT_ARENA_SKIP_LINEUPS,
  TASK_TEMPLATES,
  getDefaultDailyRunnerSettings,
  getDefaultSmartCarSettings,
  message,
  normalizeClubStoreGoodsIds,
  normalizeDailyRunnerByTokenMap,
  normalizeDailyRunnerSettings,
  normalizeDailySelectedTasks,
  normalizeSkipLineups,
  normalizeSmartCarByTokenMap,
  normalizeSmartCarSettings,
  t,
  tokenStore,
});

const columns = computed(() => [
  {
    title: t("taskControl.table.taskName"),
    key: "title",
    width: 280,
    render: (row) =>
      h("div", { class: "task-name" }, [
        h("div", { class: "task-main" }, row.title),
        h("div", { class: "task-sub" }, cronToText(row.cronExpr)),
      ]),
  },
  {
    title: t("taskControl.table.description"),
    key: "subtitle",
    ellipsis: { tooltip: true },
  },
  {
    title: t("taskControl.table.status"),
    key: "enabled",
    width: 120,
    render: (row) =>
      h(NSwitch, {
        value: !!row.enabled,
        onUpdateValue: (v) => setTaskEnabled(row.id, v),
      }),
  },
  {
    title: t("taskControl.table.nextRun"),
    key: "nextRun",
    width: 180,
    render: (row) => h("span", { class: "next-run-text" }, getNextRunText(row, nextRunNow)),
  },
  {
    title: t("taskControl.table.settings"),
    key: "setting",
    width: 120,
    render: (row) =>
      h(
        NButton,
        { size: "small", secondary: true, onClick: () => openSettingsPanel(row) },
        { default: () => t("taskControl.actions.settings") },
      ),
  },
  {
    title: t("taskControl.table.action"),
    key: "action",
    width: 120,
    render: (row) =>
      h(
        NButton,
        {
          size: "small",
          type: "primary",
          disabled: runningTaskIds.has(row.id) || props.preparingRunner,
          onClick: () => runTask(row, "manual"),
        },
        {
          default: () => {
            if (runningTaskIds.has(row.id))
              return t("taskControl.actions.running");
            if (props.preparingRunner)
              return "准备中";
            return t("taskControl.actions.run");
          },
        },
      ),
  },
]);

const CRON_CATCHUP_MAX_MINUTES = 5;
const findDueCronMinuteKey = (row, nowTs, previousTickTs) => {
  const fallbackStart = nowTs - 60 * 1000;
  const safePreviousTs
    = Number.isFinite(previousTickTs) && previousTickTs > 0 ? previousTickTs : fallbackStart;
  const lookbackStartTs = Math.max(
    nowTs - CRON_CATCHUP_MAX_MINUTES * 60 * 1000,
    safePreviousTs,
  );
  const probe = new Date(lookbackStartTs);
  probe.setSeconds(0, 0);
  const end = new Date(nowTs);
  end.setSeconds(0, 0);
  let dueMinute = "";
  while (probe.getTime() <= end.getTime()) {
    if (matchesCronExpression(row.cronExpr, probe)) {
      const key = minuteKey(probe);
      if (key !== row.lastAutoMinuteKey) {
        dueMinute = key;
      }
    }
    probe.setMinutes(probe.getMinutes() + 1);
  }
  return dueMinute;
};
const { runTask } = useTaskControlRunner({
  appendLog,
  dailySelectableOptions,
  nextRunNow,
  normalizeClubStoreGoodsIds,
  normalizeDailySelectedTasks,
  normalizeSkipLineups,
  persistState,
  refreshNextRunNow,
  resolveDailyRunnerSettingsForToken,
  resolveSmartCarSettingsForToken,
  runFeature: props.runFeature,
  runningTaskIds,
  t,
  tokenStore,
});

schedulerApi = useTaskControlScheduler({
  appendLog,
  findDueCronMinuteKey,
  getHourlyIntervalFromCron,
  isIntervalDueNow,
  minuteKey,
  nextRunNow,
  persistState,
  quietWindowsEnabled,
  refreshNextRunNow,
  runTask,
  runningTaskIds,
  t,
  taskRows,
  tokenStore,
  validateCronExpression,
});
settingsEditorApi = useTaskControlSettingsEditor({
  appendLog,
  buildSimpleCustomCron,
  getCronByScheduleKey,
  getDefaultDailyRunnerSettings,
  getDefaultSmartCarSettings,
  getScheduleKeyByCronExpr,
  message,
  normalizeClubStoreGoodsIds,
  normalizeDailyRunnerByTokenMap,
  normalizeDailyRunnerSettings,
  normalizeDailySelectedTasks,
  normalizeSkipLineups,
  normalizeSmartCarByTokenMap,
  normalizeSmartCarSettings,
  persistState,
  refreshNextRunNow,
  settingsForm,
  showSettings,
  t,
  validateCronExpression,
  DEFAULT_ARENA_SKIP_LINEUPS,
  editingTask,
  nextRunNow,
});

const enableAll = () => {
  taskRows.value.forEach((row) => {
    row.enabled = true;
  });
  persistState();
  message.success(t("taskControl.messages.allTasksEnabled"));
};

const disableAll = () => {
  taskRows.value.forEach((row) => {
    row.enabled = false;
  });
  persistState();
  message.success(t("taskControl.messages.allTasksDisabled"));
};

const refreshState = async () => {
  await Promise.all([loadState(), loadLogs(), loadQuietWindowSetting(), loadBinStatus()]);
  message.success(t("taskControl.messages.stateRefreshed"));
};
onMounted(async () => {
  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    mobileMediaQuery = window.matchMedia("(max-width: 980px)");
    const syncMobile = () => {
      isMobile.value = mobileMediaQuery.matches;
      if (!isMobile.value)
        mobileLogsExpanded.value = true;
    };
    mobileMediaListener = syncMobile;
    syncMobile();
    if (typeof mobileMediaQuery.addEventListener === "function")
      mobileMediaQuery.addEventListener("change", mobileMediaListener);
    else if (typeof mobileMediaQuery.addListener === "function")
      mobileMediaQuery.addListener(mobileMediaListener);
  }
  await Promise.all([loadState(), loadLogs(), loadQuietWindowSetting(), loadBinStatus()]);
  startScheduler();
  startLogsPolling();
  startNextRunTicker(nextRunNow);
});

onBeforeUnmount(() => {
  if (mobileMediaQuery && mobileMediaListener) {
    if (typeof mobileMediaQuery.removeEventListener === "function")
      mobileMediaQuery.removeEventListener("change", mobileMediaListener);
    else if (typeof mobileMediaQuery.removeListener === "function")
      mobileMediaQuery.removeListener(mobileMediaListener);
  }
  stopScheduler();
  stopLogsPolling();
  stopNextRunTicker();
});
</script>

<style scoped lang="scss">
.task-control-panel {
  display: grid;
  gap: 14px;
  animation: task-list-fade-in 0.38s ease;
}

.head-row,
.bin-status-row,
.runner-status-row,
.log-panel {
  background: var(--surface-glass-strong);
  border: 1px solid var(--surface-glass-border);
  border-radius: 12px;
  padding: 10px 12px;
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(10px);
}

.bin-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--text-secondary);
}

.bin-status-row.warning {
  border-color: rgba(245, 166, 35, 0.45);
  background: rgba(245, 166, 35, 0.08);
}

.task-card-list {
  display: grid;
  gap: 10px;
}

.task-card {
  border: 1px solid var(--surface-glass-border);
  border-radius: 10px;
  padding: 10px;
  background: var(--surface-glass-strong);
  display: grid;
  gap: 10px;
}

.task-card-main {
  display: grid;
  gap: 4px;
}

.task-card-next {
  font-size: 12px;
  color: var(--text-tertiary);
}

.task-card-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-secondary);
}

.task-card-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.bin-status-missing {
  color: var(--warning-color, #f5a623);
}

.runner-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: #1d4ed8;
  border-color: rgba(59, 130, 246, 0.22);
  background: rgba(59, 130, 246, 0.08);
  font-size: 13px;
}

.runner-status-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 0 6px rgba(59, 130, 246, 0.12);
  animation: runner-status-pulse 1.4s ease-in-out infinite;
}

.head-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.head-title {
  display: flex;
  align-items: center;
  gap: 14px;
}

.head-title h2 {
  margin: 0;
  font-size: 34px;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.01em;
}

.head-notice {
  margin-top: -4px;
  padding: 8px 12px;
  border-radius: 8px;
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass);
  font-size: 12px;
  color: var(--text-secondary);
}

.head-actions {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.quiet-label {
  font-size: 12px;
  line-height: 1.3;
  color: var(--text-secondary);
  white-space: normal;
}

:deep(.n-data-table) {
  border: 1px solid var(--surface-glass-border);
  border-radius: 8px;
  overflow: hidden;
  background: var(--surface-glass-strong);
}

:deep(.n-data-table .n-data-table-th) {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-weight: 600;
}

:deep(.n-data-table .n-data-table-td) {
  padding-top: 9px;
  padding-bottom: 9px;
}

:deep(.task-name) {
  display: grid;
  gap: 2px;
}

:deep(.task-main) {
  font-weight: 600;
  color: var(--text-primary);
}

:deep(.task-sub) {
  font-size: 12px;
  color: var(--text-tertiary);
}

:deep(.n-switch) {
  transform: scale(0.95);
}

:deep(.n-button.n-button--primary-type) {
  background: var(--primary-color);
  border-color: var(--primary-color);
}

:deep(.n-button.n-button--error-type.n-button--secondary) {
  color: #fff;
  background: var(--error-color);
  border-color: var(--error-color);
}

.log-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 2px 2px 0;
}

.log-head h3 {
  margin: 0;
  font-size: 34px;
  line-height: 1;
  color: var(--text-primary);
}

.log-head-actions {
  display: flex;
  gap: 8px;
}

.log-list {
  margin-top: 10px;
  max-height: 320px;
  overflow: auto;
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass);
  border-radius: 8px;
}

.log-empty {
  padding: 14px;
  color: var(--text-tertiary);
  text-align: center;
}

.log-item {
  display: grid;
  grid-template-columns: 92px 180px 1fr;
  gap: 10px;
  padding: 8px 11px;
  border-bottom: 1px solid var(--border-light);
  font-size: 13px;
  color: var(--text-primary);
}

.log-info,
.log-success {
  background: rgba(24, 160, 88, 0.1);
}

.log-warning {
  background: rgba(245, 166, 35, 0.14);
}

.log-error {
  background: rgba(208, 48, 80, 0.1);
}

.advanced-empty {
  color: var(--text-tertiary);
  font-size: 12px;
}

:deep(.n-steps) {
  margin-bottom: 12px;
}

@keyframes runner-status-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.2);
    opacity: 1;
  }
}

@media (max-width: 980px) {
  .task-control-panel :deep(.n-button.n-button--small-type) {
    min-height: 40px;
    padding-left: 10px;
    padding-right: 10px;
  }

  .head-row {
    flex-direction: column;
    align-items: stretch;
  }

  .head-title,
  .head-actions {
    width: 100%;
    justify-content: flex-start;
    flex-wrap: wrap;
  }

  .head-title h2,
  .log-head h3 {
    font-size: 24px;
  }

  .quiet-label {
    width: 100%;
  }

  .log-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .log-head-actions {
    width: 100%;
    flex-wrap: wrap;
  }

  .log-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }
}

@keyframes task-list-fade-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
