<template>
  <div class="task-control-panel app-page">
    <PageHero
      eyebrow="任务控制"
      :description="heroDescription"
      :title="t('taskControl.title')"
    >
      <template #meta>
        <div class="app-chip-row">
          <span class="app-inline-stat">
            <strong>{{ taskRows.length }}</strong>
            任务总数
          </span>
          <span class="app-inline-stat">
            <strong>{{ enabledTaskCount }}</strong>
            已启用
          </span>
          <span class="app-inline-stat">
            <strong>{{ availableBinTokenIds.length }}</strong>
            BIN 可用账号
          </span>
          <span class="app-inline-stat">
            <strong>{{ configuredMissingBoundTokenIds.length }}</strong>
            缺失 BIN
          </span>
        </div>
      </template>

      <template #actions>
        <PageToolbar class="task-control-hero-toolbar">
          <template #left>
            <StatusPill
              :label="quietWindowStatusText"
              :tone="quietWindowsEnabled ? 'warning' : 'success'"
            ></StatusPill>
            <StatusPill
              :label="runnerStatusText"
              :tone="preparingRunner ? 'info' : 'default'"
            ></StatusPill>
          </template>

          <template #right>
            <NButton size="large" @click="enableAll">
              {{ t("taskControl.actions.enableAll") }}
            </NButton>
            <NButton size="large" @click="disableAll">
              {{ t("taskControl.actions.disableAll") }}
            </NButton>
            <NButton
              size="large"
              type="primary"
              :loading="binStatusLoading"
              @click="refreshState"
            >
              {{ t("taskControl.actions.refresh") }}
            </NButton>
          </template>
        </PageToolbar>
      </template>
    </PageHero>

    <SummaryGrid :items="summaryCards"></SummaryGrid>

    <n-alert
      v-if="hasMissingBins"
      class="task-control-alert"
      type="warning"
      :show-icon="false"
    >
      当前有 {{ configuredMissingBoundTokenIds.length }} 个任务绑定账号缺少 BIN。
      <span v-if="missingBoundTokenLabels">
        缺失账号：{{ missingBoundTokenLabels }}
      </span>
    </n-alert>

    <n-alert
      v-if="preparingRunner"
      class="task-control-alert"
      type="info"
      :show-icon="false"
    >
      正在准备自动化执行环境。首次执行时会先加载隐藏 runner，本页结构已整理，但执行链路保持不变。
    </n-alert>

    <n-grid
      item-responsive
      class="task-control-grid"
      responsive="screen"
      :x-gap="16"
      :y-gap="16"
    >
      <n-grid-item span="24 l:16">
        <SectionCard
          class="task-control-section"
          title="任务配置区"
          :description="taskSectionDescription"
        >
          <template #header-extra>
            <StatusPill
              size="sm"
              :label="binStatusText"
              :tone="hasMissingBins ? 'warning' : 'success'"
            ></StatusPill>
          </template>

          <PageToolbar class="task-panel-toolbar">
            <template #left>
              <div class="task-panel-toolbar__switch">
                <span class="task-panel-toolbar__label">
                  {{ t("taskControl.quietWindow.label") }}
                </span>
                <NSwitch
                  :value="quietWindowsEnabled"
                  @update:value="setQuietWindowsEnabled"
                ></NSwitch>
                <strong>{{
                  quietWindowsEnabled
                    ? t("taskControl.common.enabled")
                    : t("taskControl.common.disabled")
                }}</strong>
              </div>
            </template>

            <template #right>
              <NButton
                size="small"
                :loading="binStatusLoading"
                @click="loadBinStatus"
              >
                刷新 BIN
              </NButton>
            </template>
          </PageToolbar>

          <div v-if="isMobile" class="task-card-list">
            <article v-for="row in taskRows" :key="row.id" class="task-card">
              <div class="task-card__header">
                <div class="task-card-main">
                  <div class="task-main">{{ row.title }}</div>
                  <div class="task-sub">{{ cronToText(row.cronExpr) }}</div>
                </div>
                <StatusPill
                  size="sm"
                  :label="row.enabled ? '已启用' : '已停用'"
                  :tone="row.enabled ? 'success' : 'default'"
                ></StatusPill>
              </div>

              <div class="task-card__meta">
                <span class="task-card-next">
                  {{ t("taskControl.table.nextRun") }}：{{ getNextRunText(row, nextRunNow) }}
                </span>
                <span class="task-card-note">{{ row.subtitle }}</span>
              </div>

              <div class="task-card-status">
                <span>{{ t("taskControl.table.status") }}</span>
                <NSwitch
                  :value="!!row.enabled"
                  @update:value="(value) => setTaskEnabled(row.id, value)"
                ></NSwitch>
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
            </article>
          </div>

          <div v-else class="task-table-shell">
            <n-data-table
              :key="tableRefreshKey"
              size="small"
              :bordered="false"
              :columns="columns"
              :data="taskRows"
              :pagination="false"
              :scroll-x="980"
            ></n-data-table>
          </div>
        </SectionCard>
      </n-grid-item>

      <n-grid-item span="24 l:8">
        <SectionCard
          compact
          class="task-control-section task-control-section--log"
          description="沿用原有日志轮询与自动滚动逻辑，只重做信息层级与移动端收起方式。"
          :title="t('taskControl.logs.title')"
        >
          <template #header-extra>
            <StatusPill
              size="sm"
              :label="logStatusText"
              :tone="errorLogCount > 0 ? 'error' : 'default'"
            ></StatusPill>
          </template>

          <PageToolbar class="task-log-toolbar">
            <template #left>
              <StatusPill
                size="sm"
                :label="autoScroll ? '自动滚动已开' : '自动滚动已关'"
                :tone="autoScroll ? 'info' : 'default'"
              ></StatusPill>
            </template>

            <template #right>
              <NButton v-if="isMobile" size="small" @click="toggleMobileLogs">
                {{ mobileLogsExpanded ? "收起日志" : "展开日志" }}
              </NButton>
              <NButton
                secondary
                size="small"
                type="error"
                :disabled="logs.length === 0"
                @click="clearLogs"
              >
                {{ t("taskControl.logs.clear") }}
              </NButton>
              <NButton size="small" @click="toggleAutoScroll">
                {{
                  autoScroll
                    ? t("taskControl.logs.stopAutoScroll")
                    : t("taskControl.logs.resumeAutoScroll")
                }}
              </NButton>
            </template>
          </PageToolbar>

          <div
            ref="logRef"
            v-if="!isMobile || mobileLogsExpanded"
            class="log-list"
          >
            <div v-if="logs.length === 0" class="log-empty">
              {{ t("taskControl.logs.empty") }}
            </div>

            <div
              v-for="item in visibleLogs"
              :key="item.id"
              class="log-item"
              :class="`log-${item.status}`"
            >
              <span class="log-time">{{ formatTime(item.time) }}</span>
              <span class="log-task">{{ item.task }}</span>
              <span class="log-msg">{{ item.message }}</span>
            </div>
          </div>

          <div v-else class="log-collapsed-hint">
            日志已折叠，展开后可继续查看最新执行记录。
          </div>
        </SectionCard>
      </n-grid-item>
    </n-grid>

    <n-drawer
      v-if="showSettings"
      v-model:show="showSettings"
      :height="settingsDrawerHeight"
      :placement="settingsDrawerPlacement"
      :width="settingsDrawerWidth"
    >
      <n-drawer-content closable :title="t('taskControl.settings.title')">
        <div v-if="editingTask" class="task-settings-shell">
          <div class="task-settings-summary">
            <span class="task-settings-summary__eyebrow">任务设置</span>
            <strong>{{ editingTask.title }}</strong>
            <p>
              {{ editingTask.subtitle || "调整任务计划、账号绑定与高级参数，不改变当前执行链路。" }}
            </p>
          </div>

          <n-steps v-if="isMobile" size="small" :current="settingsStep">
            <n-step title="基础"></n-step>
            <n-step title="账号"></n-step>
            <n-step v-if="hasAdvancedSettings" title="高级"></n-step>
          </n-steps>

          <n-form
            v-if="editingTask"
            class="task-settings-form"
            label-placement="left"
            label-width="96"
          >
            <template v-if="!isMobile || settingsStep === 1">
              <div class="task-settings-group">
                <div class="task-settings-group__head">
                  <span>基础设置</span>
                  <p>配置任务名、启用状态与执行节奏。</p>
                </div>

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

                  <n-form-item
                    v-if="settingsForm.customType === 'hourly'"
                    :label="t('taskControl.settings.fields.everyHours')"
                  >
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
                      filterable
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

                <n-form-item
                  v-if="settingsForm.scheduleKey === 'custom'"
                  :label="t('taskControl.settings.fields.cron')"
                >
                  <n-input
                    v-model:value="settingsForm.cronExpr"
                    :placeholder="t('taskControl.settings.placeholders.cron')"
                  ></n-input>
                </n-form-item>

                <n-form-item :label="t('taskControl.settings.fields.schedule')">
                  <n-space wrap>
                    <NButton size="tiny" @click="applyQuickSchedule('daily_0930')">
                      每天 09:30
                    </NButton>
                    <NButton size="tiny" @click="applyQuickSchedule('hourly_6')">
                      每 6 小时
                    </NButton>
                    <NButton size="tiny" @click="applyQuickSchedule('hourly_8')">
                      每 8 小时
                    </NButton>
                  </n-space>
                </n-form-item>
              </div>
            </template>

            <template v-if="!isMobile || settingsStep === 2">
              <div class="task-settings-group">
                <div class="task-settings-group__head">
                  <span>账号范围</span>
                  <p>绑定本任务要执行的账号列表，和当前任务模板保持一致。</p>
                </div>

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
              </div>
            </template>

            <template v-if="!isMobile || settingsStep === 3">
              <div class="task-settings-group">
                <div class="task-settings-group__head">
                  <span>高级选项</span>
                  <p>仅针对支持高级参数的任务展示，保留现有参数结构。</p>
                </div>

                <n-collapse :default-expanded-names="isMobile ? [] : ['task-advanced']">
                  <n-collapse-item name="task-advanced" title="高级参数面板">
                    <component
                      :is="currentAdvancedComponent"
                      v-if="currentAdvancedComponent"
                      :arena-formation-options="arenaFormationOptions"
                      :arena-skip-lineup-options="arenaSkipLineupOptions"
                      :car-color-options="carColorOptions"
                      :clear-daily-runner-override="clearDailyRunnerOverride"
                      :clear-smart-car-override="clearSmartCarOverride"
                      :club-store-goods-options="clubStoreGoodsOptions"
                      :daily-selectable-options="dailySelectableOptions"
                      :helper-lineup-keyword-options="helperLineupKeywordOptions"
                      :on-daily-runner-editor-token-change="onDailyRunnerEditorTokenChange"
                      :on-smart-car-editor-token-change="onSmartCarEditorTokenChange"
                      :settings-form="settingsForm"
                      :t="t"
                      :token-options="tokenOptions"
                      :update-settings-form="updateSettingsForm"
                    ></component>
                    <div v-else class="advanced-empty">当前任务没有高级参数</div>
                  </n-collapse-item>
                </n-collapse>
              </div>
            </template>
          </n-form>
        </div>

        <template #footer>
          <n-space justify="end">
            <NButton @click="showSettings = false">
              {{ t("taskControl.actions.cancel") }}
            </NButton>
            <NButton v-if="isMobile && settingsStep > 1" @click="prevSettingsStep">
              上一步
            </NButton>
            <NButton
              v-if="isMobile && settingsStep < settingsMaxStep"
              secondary
              type="primary"
              @click="nextSettingsStep"
            >
              下一步
            </NButton>
            <NButton v-else type="primary" @click="saveSettings">
              {{ t("taskControl.actions.save") }}
            </NButton>
          </n-space>
        </template>
      </n-drawer-content>
    </n-drawer>
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  h,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
} from "vue";
import { NButton, NSwitch, useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import PageHero from "@/components/workbench/PageHero.vue";
import PageToolbar from "@/components/workbench/PageToolbar.vue";
import SectionCard from "@/components/workbench/SectionCard.vue";
import StatusPill from "@/components/workbench/StatusPill.vue";
import SummaryGrid from "@/components/workbench/SummaryGrid.vue";
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

const runningTaskIds = reactive(new Set());
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
  updateSettingsForm,
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

const currentAdvancedComponent = computed(
  () => ADVANCED_COMPONENT_MAP[editingTask.value?.id] || null,
);
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

const hasMissingBins = computed(
  () => configuredMissingBoundTokenIds.value.length > 0,
);
const enabledTaskCount = computed(
  () => taskRows.value.filter((row) => row.enabled).length,
);
const runningTaskCount = computed(() => runningTaskIds.size);
const errorLogCount = computed(
  () => logs.value.filter((item) => item.status === "error").length,
);
const quietWindowStatusText = computed(() =>
  quietWindowsEnabled.value
    ? `${t("taskControl.quietWindow.label")}已启用`
    : `${t("taskControl.quietWindow.label")}已关闭`,
);
const runnerStatusText = computed(() =>
  props.preparingRunner ? "执行器准备中" : "执行器已就绪",
);
const binStatusText = computed(() => {
  if (!configuredBoundTokenIds.value.length)
    return "当前还没有任务绑定账号";
  if (hasMissingBins.value)
    return `缺失 ${configuredMissingBoundTokenIds.value.length} 个 BIN 绑定账号`;
  return "BIN 绑定账号状态完整";
});
const logStatusText = computed(() => {
  if (errorLogCount.value > 0)
    return `错误 ${errorLogCount.value} 条`;
  return `日志 ${logs.value.length} 条`;
});
const binCoverageValue = computed(() => {
  if (!configuredBoundTokenIds.value.length)
    return "未绑定";
  return `${configuredBoundTokenIds.value.length - configuredMissingBoundTokenIds.value.length}/${configuredBoundTokenIds.value.length}`;
});
const heroDescription = computed(() => {
  if (props.preparingRunner) {
    return "当前正在准备自动化执行环境。首次手动执行时会稍等几秒，但执行契约保持原样。";
  }
  if (hasMissingBins.value) {
    return `当前有 ${configuredMissingBoundTokenIds.value.length} 个任务绑定账号缺少 BIN，建议先补齐后再执行自动化。`;
  }
  return "统一管理任务计划、账号绑定、静默窗口和执行日志，保留现有调度与隐藏 runner 链路。";
});
const taskSectionDescription = computed(() =>
  isMobile.value
    ? "移动端切换为任务卡片布局，保留单任务启停、设置和立即执行入口。"
    : "桌面端保留表格操作模型，把状态、执行窗口和任务节奏收口到同一屏。",
);
const summaryCards = computed(() => [
  {
    label: "任务总数",
    value: String(taskRows.value.length),
    meta: `已启用 ${enabledTaskCount.value} 个`,
  },
  {
    label: "执行中任务",
    value: String(runningTaskCount.value),
    meta: props.preparingRunner ? "执行器准备中" : "支持手动执行与定时调度",
  },
  {
    label: "BIN 覆盖",
    value: binCoverageValue.value,
    meta: hasMissingBins.value
      ? `缺失 ${configuredMissingBoundTokenIds.value.length} 个绑定账号`
      : "当前绑定账号均可用",
  },
  {
    label: "静默窗口",
    value: quietWindowsEnabled.value
      ? t("taskControl.common.enabled")
      : t("taskControl.common.disabled"),
    meta: quietWindowsEnabled.value ? "调度会避开静默时段" : "当前允许全天执行",
  },
]);

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
        onUpdateValue: (value) => setTaskEnabled(row.id, value),
      }),
  },
  {
    title: t("taskControl.table.nextRun"),
    key: "nextRun",
    width: 180,
    render: (row) =>
      h("span", { class: "next-run-text" }, getNextRunText(row, nextRunNow)),
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
  gap: var(--spacing-lg);
  animation: task-list-fade-in 0.38s ease;
}

.task-control-alert {
  border-radius: 18px;
  border: 1px solid var(--surface-glass-border);
  background: var(--surface-glass-strong);
  box-shadow: var(--shadow-light);
}

.task-control-grid {
  align-items: start;
}

.task-control-section {
  min-height: 100%;
}

.task-control-section--log {
  display: flex;
  flex-direction: column;
}

.task-control-hero-toolbar,
.task-panel-toolbar,
.task-log-toolbar {
  width: 100%;
}

.task-panel-toolbar {
  margin-bottom: 18px;
}

.task-log-toolbar {
  margin-bottom: 14px;
}

.task-panel-toolbar__switch {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  min-height: 42px;
  padding: 10px 14px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 16px;
  background: var(--surface-glass);
  color: var(--text-secondary);
}

.task-panel-toolbar__label {
  font-size: 13px;
}

.task-table-shell {
  min-width: 0;
}

.task-card-list {
  display: grid;
  gap: 14px;
}

.task-card {
  display: grid;
  gap: 14px;
  padding: 18px;
  border-radius: 22px;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.08), transparent 70%),
    var(--surface-glass);
  box-shadow: var(--shadow-light);
}

.task-card__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.task-card-main {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.task-card__meta {
  display: grid;
  gap: 6px;
}

.task-card-next,
.task-card-note {
  font-size: 13px;
  line-height: 1.5;
  color: var(--text-secondary);
}

.task-card-note {
  color: var(--text-tertiary);
}

.task-card-status {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  border-radius: 16px;
  background: rgba(63, 119, 173, 0.06);
  color: var(--text-secondary);
}

.task-card-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

:deep(.n-data-table) {
  overflow: hidden;
  border: 1px solid var(--surface-glass-border);
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.14), transparent 18%),
    var(--surface-glass-strong);
}

:deep(.n-data-table .n-data-table-th) {
  background: rgba(63, 119, 173, 0.08);
  color: var(--text-secondary);
  font-weight: 700;
}

:deep(.n-data-table .n-data-table-td) {
  padding-top: 11px;
  padding-bottom: 11px;
}

:deep(.task-name) {
  display: grid;
  gap: 4px;
}

:deep(.task-main) {
  font-weight: 700;
  color: var(--text-primary);
}

:deep(.task-sub) {
  font-size: 12px;
  color: var(--text-tertiary);
}

:deep(.next-run-text) {
  color: var(--text-secondary);
}

:deep(.n-switch) {
  transform: scale(0.96);
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

.log-list {
  flex: 1;
  min-height: 280px;
  max-height: 520px;
  overflow: auto;
  border: 1px solid var(--surface-glass-border);
  border-radius: 18px;
  background:
    linear-gradient(180deg, rgba(63, 119, 173, 0.06), transparent 12%),
    var(--surface-glass);
}

.log-empty,
.log-collapsed-hint {
  padding: 18px;
  text-align: center;
  color: var(--text-tertiary);
}

.log-item {
  display: grid;
  grid-template-columns: 96px 180px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(127, 145, 172, 0.16);
  font-size: 13px;
}

.log-item:last-child {
  border-bottom: none;
}

.log-info,
.log-success {
  background: rgba(24, 160, 88, 0.08);
}

.log-warning {
  background: rgba(240, 160, 32, 0.12);
}

.log-error {
  background: rgba(208, 48, 80, 0.1);
}

.log-time {
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  font-family: var(--font-family-mono);
}

.log-task {
  color: var(--text-secondary);
  font-weight: 600;
}

.log-msg {
  color: var(--text-primary);
  line-height: 1.6;
}

.task-settings-shell {
  display: grid;
  gap: 18px;
}

.task-settings-summary {
  display: grid;
  gap: 6px;
  padding: 16px 18px;
  border-radius: 18px;
  border: 1px solid var(--surface-glass-border);
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.08), transparent 70%),
    var(--surface-glass);
}

.task-settings-summary__eyebrow {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.task-settings-summary strong {
  font-size: 20px;
  color: var(--text-primary);
}

.task-settings-summary p {
  margin: 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.task-settings-form {
  display: grid;
  gap: 16px;
}

.task-settings-group {
  padding: 16px 18px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 18px;
  background: var(--surface-glass-strong);
}

.task-settings-group__head {
  display: grid;
  gap: 4px;
  margin-bottom: 14px;
}

.task-settings-group__head span {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.task-settings-group__head p {
  margin: 0;
  color: var(--text-tertiary);
  line-height: 1.5;
}

.advanced-empty {
  color: var(--text-tertiary);
  font-size: 12px;
}

:deep(.n-steps) {
  margin-bottom: 2px;
}

@media (max-width: 980px) {
  .task-control-panel :deep(.n-button.n-button--small-type) {
    min-height: 40px;
    padding-left: 12px;
    padding-right: 12px;
  }

  .task-card__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .log-item {
    grid-template-columns: 1fr;
    gap: 4px;
  }

  .log-list {
    max-height: 360px;
  }
}

@media (max-width: 768px) {
  .task-control-panel {
    gap: var(--spacing-md);
  }

  .task-control-hero-toolbar :deep(.workbench-page-toolbar__group) {
    align-items: stretch;
  }

  .task-panel-toolbar__switch {
    width: 100%;
    justify-content: space-between;
    flex-wrap: wrap;
  }

  .task-card {
    padding: 16px;
    border-radius: 18px;
  }

  .task-card-actions {
    grid-template-columns: 1fr;
  }

  .task-settings-group {
    padding: 14px;
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
