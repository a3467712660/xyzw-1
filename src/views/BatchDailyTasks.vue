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

    <!-- Task Template Modal -->
    <n-modal
      class="modal-w-400"
      preset="card"
      v-model:show="showTaskTemplateModal"
      :title="currentTemplateId ? '编辑任务模板' : '任务模板设置'"
    >
      <div class="settings-content">
        <div class="settings-grid">
          <div class="setting-item">
            <label class="setting-label">模板名称</label>
            <n-input
              placeholder="请输入模板名称"
              size="small"
              v-model:value="currentTemplateName"
            ></n-input>
          </div>
        </div>
        <BatchDailyTaskSettingsForm
          :boss-times-options="bossTimesOptions"
          :formation-options="formationOptions"
          :settings="currentTemplate"
          @update-field="(key, value) => updateSettingsField(currentTemplate, key, value)"
        ></BatchDailyTaskSettingsForm>
        <div class="modal-actions modal-actions-right">
          <n-button
            class="btn-mr"
            @click="showTaskTemplateModal = false"
          >
            取消
          </n-button>
          <n-button type="primary" @click="saveTaskTemplate">保存模板</n-button>
        </div>
      </div>
    </n-modal>

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

    <!-- Legacy Gift Modal -->
    <n-modal
      class="modal-w-600"
      preset="card"
      title="批量功法残卷赠送"
      v-model:show="showLegacyGiftModal"
    >
      <TaskControlLegacyGiftModalBody
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
        @close="showLegacyGiftModal = false"
        @update:gift-quantity="giftQuantity = $event"
        @update:recipient-id-input="recipientIdInput = $event"
        @update:security-password="securityPassword = $event"
      ></TaskControlLegacyGiftModalBody>
    </n-modal>

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

    <!-- Task Modal -->
    <n-modal
      class="modal-w-600"
      preset="card"
      v-model:show="showTaskModal"
      :title="editingTask ? '编辑定时任务' : '新增定时任务'"
    >
      <BatchDailyTaskModalBody
        :cron-next-runs="cronNextRuns"
        :cron-validation="cronValidation"
        :grouped-available-tasks="groupedAvailableTasks"
        :sorted-tokens="sortedTokens"
        :task-form="taskForm"
        :task-group-definitions="taskGroupDefinitions"
        :task-schedule-selected-group-ids="taskScheduleSelectedGroupIds"
        :token-groups="tokenGroups"
        @cancel="showTaskModal = false"
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
      ></BatchDailyTaskModalBody>
    </n-modal>

    <!-- Batch Settings Modal -->
    <n-modal
      class="modal-w-700"
      preset="card"
      title="任务设置"
      v-model:show="showBatchSettingsModal"
    >
      <div class="settings-content">
        <n-grid :cols="2" :x-gap="24">
          <!-- 左列：批量操作设置 -->
          <n-grid-item>
            <n-divider
              class="divider-tight"
              title-placement="left"
            >
              批量操作设置
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">开箱数量(10倍)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.boxCount"
                  :max="10000"
                  :min="10"
                  :step="10"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">钓鱼数量(10倍)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.fishCount"
                  :max="10000"
                  :min="10"
                  :step="10"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">招募数量(10倍)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.recruitCount"
                  :max="10000"
                  :min="10"
                  :step="10"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">默认宝箱类型</label>
                <n-select
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.defaultBoxType"
                  :options="boxTypeOptions"
                ></n-select>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">默认鱼竿类型</label>
                <n-select
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.defaultFishType"
                  :options="fishTypeOptions"
                ></n-select>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">梦境商品购买配置</label>
                <n-button
                  size="small"
                  @click="openDreamBuyModal"
                >
                  点击配置
                </n-button>
              </div>
            </div>
            <n-divider
              class="divider-normal"
              title-placement="left"
            >
              智能发车条件设置(0为不限制)
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">保底车辆颜色</label>
                <n-select
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.carMinColor"
                  :options="[
                    { label: '绿·普通', value: 1 },
                    { label: '蓝·稀有', value: 2 },
                    { label: '紫·史诗', value: 3 },
                    { label: '橙·传说', value: 4 },
                    { label: '红·神话', value: 5 },
                    { label: '金·传奇', value: 6 },
                  ]"
                ></n-select>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">车辆强制刷新保底</label>
                <n-switch
                  v-model:value="batchSettings.useGoldRefreshFallback"
                ></n-switch>
              </div>
            </div>
            <div
              v-if="batchSettings.useGoldRefreshFallback"
              class="settings-grid settings-grid-top-gap"
            >
              <div class="setting-item setting-item-row">
                <label class="setting-label">需同时满足所有条件</label>
                <n-switch
                  v-model:value="batchSettings.smartDepartureMatchAll"
                ></n-switch>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">金砖 >=</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.smartDepartureGoldThreshold"
                  :min="0"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">招募令 >=</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.smartDepartureRecruitThreshold"
                  :min="0"
                  :step="10"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">白玉 >=</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.smartDepartureJadeThreshold"
                  :min="0"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">刷新卷 >=</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.smartDepartureTicketThreshold"
                  :min="0"
                  :step="1"
                ></n-input-number>
              </div>
            </div>
            <div class="settings-grid settings-grid-top-gap">
              <div class="setting-item setting-item-row">
                <label class="setting-label">护卫阵容分析</label>
                <n-switch
                  v-model:value="batchSettings.helperLineupAnalysisEnabled"
                ></n-switch>
              </div>
              <div
                v-if="batchSettings.helperLineupAnalysisEnabled"
                class="setting-item setting-item-row"
              >
                <label class="setting-label">优先阵容关键词</label>
                <n-select
                  clearable
                  filterable
                  multiple
                  class="input-w-100"
                  placeholder="选择优先匹配的阵容关键词"
                  size="small"
                  v-model:value="batchSettings.helperPreferredLineups"
                  :options="helperLineupKeywordOptions"
                ></n-select>
              </div>
            </div>
            <n-divider
              class="divider-normal"
              title-placement="left"
            >
              功法赠送设置
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">接收者ID</label>
                <n-input-number
                  class="input-w-100"
                  placeholder="ID"
                  size="small"
                  v-model:value="batchSettings.receiverId"
                  :show-button="false"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">密码</label>
                <n-input
                  class="input-w-100"
                  placeholder="密码"
                  size="small"
                  type="password"
                  v-model:value="batchSettings.password"
                ></n-input>
              </div>
            </div>
          </n-grid-item>
          <!-- 右列：延迟与连接设置 -->
          <n-grid-item>
            <n-divider
              class="divider-tight"
              title-placement="left"
            >
              延迟设置(ms)
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">命令延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.commandDelay"
                  :max="2000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">任务间延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.taskDelay"
                  :max="2000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">操作延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.actionDelay"
                  :max="2000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">战斗延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.battleDelay"
                  :max="2000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">刷新延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.refreshDelay"
                  :max="3000"
                  :min="500"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">长延迟</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.longDelay"
                  :max="10000"
                  :min="1000"
                  :step="500"
                ></n-input-number>
              </div>
            </div>
            <n-divider
              class="divider-normal"
              title-placement="left"
            >
              连接设置
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">最大并发数</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.maxActive"
                  :max="20"
                  :min="1"
                  :step="1"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">连接超时(ms)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.connectionTimeout"
                  :max="30000"
                  :min="1000"
                  :step="1000"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">重连等待(ms)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.reconnectDelay"
                  :max="5000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
            </div>
            <n-divider
              class="divider-normal"
              title-placement="left"
            >
              系统设置
            </n-divider>
            <div class="settings-grid">
              <div class="setting-item setting-item-row">
                <label class="setting-label">列表每行数量</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.tokenListColumns"
                  :max="10"
                  :min="1"
                  :step="1"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">最大日志条目</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.maxLogEntries"
                  :max="5000"
                  :min="100"
                  :step="100"
                ></n-input-number>
              </div>
              <div class="setting-item setting-item-row">
                <label class="setting-label">定时刷新页面</label>
                <n-switch v-model:value="batchSettings.enableRefresh"></n-switch>
              </div>
              <div
                v-if="batchSettings.enableRefresh"
                class="setting-item setting-item-row"
              >
                <label class="setting-label">刷新间隔(分钟)</label>
                <n-input-number
                  class="input-w-100"
                  size="small"
                  v-model:value="batchSettings.refreshInterval"
                  :max="1440"
                  :min="10"
                  :step="30"
                ></n-input-number>
              </div>
            </div>
          </n-grid-item>
        </n-grid>
        <div class="modal-actions modal-actions-right">
          <n-button
            class="btn-mr"
            @click="showBatchSettingsModal = false"
          >
            取消
          </n-button>
          <n-button
            type="primary"
            @click="saveBatchSettings"
          >
            保存设置
          </n-button>
        </div>
      </div>
    </n-modal>

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
import BatchDailyTasksHelperModal from "@/views/batch-daily-tasks/BatchDailyTasksHelperModal.vue";
import BatchDailyTasksHeader from "@/views/batch-daily-tasks/BatchDailyTasksHeader.vue";
import BatchDailyTasksDreamBuyModal from "@/views/batch-daily-tasks/BatchDailyTasksDreamBuyModal.vue";
import BatchDailyTasksListModal from "@/views/batch-daily-tasks/BatchDailyTasksListModal.vue";
import BatchDailyTasksLogPanel from "@/views/batch-daily-tasks/BatchDailyTasksLogPanel.vue";
import BatchDailyTaskModalBody from "@/views/batch-daily-tasks/BatchDailyTaskModalBody.vue";
import BatchDailyTaskSettingsForm from "@/views/batch-daily-tasks/BatchDailyTaskSettingsForm.vue";
import BatchDailyTasksSettingsModal from "@/views/batch-daily-tasks/BatchDailyTasksSettingsModal.vue";
import BatchDailyTasksGroupManageModal from "@/views/batch-daily-tasks/BatchDailyTasksGroupManageModal.vue";
import BatchDailyTasksTemplateManagerModal from "@/views/batch-daily-tasks/BatchDailyTasksTemplateManagerModal.vue";
import BatchDailyTasksToolbar from "@/views/batch-daily-tasks/BatchDailyTasksToolbar.vue";
import BatchDailyTasksTokenSelection from "@/views/batch-daily-tasks/BatchDailyTasksTokenSelection.vue";
import BatchDailyTasksWarGuessModal from "@/views/batch-daily-tasks/BatchDailyTasksWarGuessModal.vue";
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

const TaskControlLegacyGiftModalBody = defineAsyncComponent(
  () => import("@/components/task-control/TaskControlLegacyGiftModalBody.vue"),
);

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
const isCarActivityOpen = computed(() => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  // 1=Mon, 2=Tue, 3=Wed; 6点之后
  return day >= 1 && day <= 3 && hour >= 6;
});
const ismengjingActivityOpen = computed(() => {
  const day = new Date().getDay();
  return day === 0 || day === 1 || day === 3 || day === 4;
});
const isbaokuActivityOpen = computed(() => {
  const day = new Date().getDay();
  return day != 1 && day != 2;
});
const isarenaActivityOpen = computed(() => {
  const hour = new Date().getHours();
  return hour >= 6 && hour < 22;
});
const getCurrentActivityWeek = computed(() => {
  const now = new Date();
  const start = new Date("2025-12-12T12:00:00"); // 起始时间：黑市周开始
  const weekDuration = 7 * 24 * 60 * 60 * 1000; // 一周毫秒数
  const cycleDuration = 3 * weekDuration; // 三周期毫秒数

  const elapsed = now - start;
  if (elapsed < 0)
    return null; // 活动开始前

  const cyclePosition = elapsed % cycleDuration;

  if (cyclePosition < weekDuration) {
    return "黑市周";
  } else if (cyclePosition < 2 * weekDuration) {
    return "招募周";
  } else {
    return "宝箱周";
  }
});

const isWeirdTowerActivityOpen = computed(() => {
  if (getCurrentActivityWeek.value !== "黑市周")
    return false;

  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  // 如果是周五，必须在12点之后
  if (day === 5) {
    return hour >= 12;
  }
  return true;
});

// 获取本月第四个周日的日期
const getFourthSundayOfMonth = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // 当月第一天
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay(); // 0-6

  // 计算第一个周日的日期 (1号是周日则为1，否则为 1 + 7 - dayOfWeek)
  let firstSundayDate = 1 + ((7 - dayOfWeek) % 7);

  // 仅针对2026年3月进行特殊处理
  if (year === 2026 && month === 2 && dayOfWeek === 0) {
    firstSundayDate = 8;
  }

  // 第四个周日 = 第一个周日 + 21天
  return new Date(year, month, firstSundayDate + 21);
};

const isWarGuessActivityOpen = computed(() => {
  const now = new Date();

  // 手动修正：2026年3月1日开放
  if (
    now.getFullYear() === 2026
    && now.getMonth() === 2
    && now.getDate() === 1
  ) {
    const hour = now.getHours();
    const minute = now.getMinutes();
    if (hour < 19 || (hour === 19 && minute <= 55))
      return true;
  }

  const fourthSunday = getFourthSundayOfMonth();

  // 检查是否是今天
  if (now.getDate() !== fourthSunday.getDate())
    return false;

  // 检查时间 00:00 - 19:55
  const hour = now.getHours();
  const minute = now.getMinutes();
  if (hour > 19 || (hour === 19 && minute > 55))
    return false;

  return true;
});

const warGuessActivityTip = computed(() => {
  if (isWarGuessActivityOpen.value)
    return "";

  const fourthSunday = getFourthSundayOfMonth();
  const month = fourthSunday.getMonth() + 1;
  const date = fourthSunday.getDate();
  return `月赛助威仅在每月第四个周日 (${month}月${date}日) 00:00-19:55 开放`;
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
const taskGroupDefinitions = [
  {
    name: "daily",
    label: "日常",
    tasks: [
      "startBatch",
      "claimHangUpRewards",
      "resetBottles",
      "batchlingguanzi",
      "batchStudy",
      "batcharenafight",
      "batchSmartSendCar",
      "batchClaimCars",
      "batchGenieSweep",
    ],
  },
  {
    name: "dungeon",
    label: "副本",
    tasks: [
      "climbTower",
      "batchmengjing",
      "skinChallenge",
      "batchClaimPeachTasks",
      "batchBuyDreamItems",
    ],
  },
  { name: "baoku", label: "宝库", tasks: ["batchbaoku13", "batchbaoku45"] },
  {
    name: "weirdTower",
    label: "怪异塔",
    tasks: [
      "climbWeirdTower",
      "batchUseItems",
      "batchMergeItems",
      "batchClaimFreeEnergy",
    ],
  },
  {
    name: "resource",
    label: "资源",
    tasks: [
      "batchOpenBox",
      "batchClaimBoxPointReward",
      "batchFish",
      "batchRecruit",
      "legion_storebuygoods",
    ],
  },
  {
    name: "legacy",
    label: "功法",
    tasks: ["batchLegacyClaim", "batchLegacyGiftSendEnhanced"],
  },
  {
    name: "monthly",
    label: "月度",
    tasks: ["batchTopUpFish", "batchTopUpArena"],
  },
];

// 计算属性，根据 taskGroupDefinitions 将 availableTasks 分组
const groupedAvailableTasks = computed(() => {
  const groups = {};
  taskGroupDefinitions.forEach((group) => {
    groups[group.name] = availableTasks.filter((task) =>
      group.tasks.includes(task.value),
    );
  });

  // 处理未分组的任务
  const groupedTaskValues = taskGroupDefinitions.flatMap((g) => g.tasks);
  const otherTasks = availableTasks.filter(
    (task) => !groupedTaskValues.includes(task.value),
  );
  if (otherTasks.length > 0) {
    groups.other = otherTasks;
  }

  return groups;
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
  padding: var(--spacing-md);
  height: 100vh;
  box-sizing: border-box;
  overflow: hidden;
  background: transparent;
  animation: batch-fade-in 0.4s ease;
}

.main-layout {
  display: flex;
  gap: var(--spacing-md);
  height: 100%;
  overflow: hidden;
}

.left-column {
  flex: 1;
  overflow-y: auto;
  min-width: 0;
  padding-right: 8px;

  &::-webkit-scrollbar {
    width: 8px;
  }
}

.right-column {
  width: 400px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 700px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: var(--spacing-md);
  background: var(--surface-glass);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-large);
  box-shadow: var(--shadow-light);
  backdrop-filter: blur(10px);
  padding: var(--spacing-md);
}

[data-theme="dark"] .page-header {
  background: rgba(18, 32, 58, 0.72);
}

.header-left-wrap {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.header-info-chip,
.header-action-chip {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--surface-glass-strong);
  border: 1px solid var(--surface-glass-border);
  border-radius: var(--border-radius-medium);
  flex-wrap: wrap;
}

.chip-text-main {
  font-size: 14px;
  color: var(--text-secondary);
}

.chip-text-highlight {
  font-size: 14px;
  font-weight: 500;
  color: var(--primary-color);
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
}

.chip-text-muted {
  font-size: 14px;
  color: var(--text-tertiary);
}

.chip-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.token-selection-top {
  margin-bottom: 16px;
}

.group-selection-header,
.group-manage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  gap: 8px;
  flex-wrap: wrap;
}

.group-selection-label {
  font-weight: 500;
  color: var(--text-primary);
}

.group-tags-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.group-select-chip {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  background: transparent;
  border: 2px solid var(--group-color);
  color: var(--group-color);
  font-weight: 400;
  transition: all 0.3s ease;
  user-select: none;
}

.group-select-chip.is-selected {
  background-color: var(--group-color);
  color: #fff;
  font-weight: 600;
}

.group-selected-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.sort-buttons {
  margin-bottom: 12px;
}

.token-item {
  display: flex;
  align-items: center;
}

.log-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.custom-card-header {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-title {
  font-size: 16px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.log-header-controls {
  display: flex;
  align-items: center;
  gap: 12px;
  justify-content: flex-end;
  flex-wrap: nowrap;
}

.log-card :deep(.n-card__content) {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.batch-daily-tasks :deep(.n-card) {
  border-radius: var(--border-radius-large);
  border: 1px solid var(--surface-glass-border);
  box-shadow: var(--shadow-light);
  background: var(--surface-glass-strong);
  backdrop-filter: blur(10px);
}

.batch-daily-tasks :deep(.n-card-header) {
  border-bottom: 1px solid var(--border-light);
}

.log-header-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.log-container {
  flex: 1;
  overflow-y: auto;
  background: var(--surface-glass);
  padding: 10px;
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--surface-glass-border);
  margin-top: 10px;
  font-family: var(--font-family-mono);
  font-variant-numeric: tabular-nums;
  min-height: 200px;
}

.log-item {
  margin-bottom: 4px;
  font-size: 12px;
}

.log-item.error {
  color: #d03050;
}

.log-item.success {
  color: #18a058;
}

.log-item.warning {
  color: #f0a020;
}

.log-item.info {
  color: var(--text-primary);
}

.time {
  color: var(--text-tertiary);
  margin-right: 8px;
}

.token-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-right: 8px;
}

/* Settings Modal Styles */
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.settings-grid-block {
  display: block;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-item-row {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}

.setting-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.btn-mr {
  margin-right: 12px;
}

.btn-ml {
  margin-left: 12px;
}

.input-w-full {
  width: 100%;
}

.input-w-100 {
  width: 100px;
}

.input-w-120 {
  width: 120px;
}

.input-w-150 {
  width: 150px;
}

.input-w-180 {
  width: 180px;
}

.input-w-200 {
  width: 200px;
}

.modal-w-600 {
  width: 90%;
  max-width: 600px;
}

.modal-w-400 {
  width: 90%;
  max-width: 400px;
}

.modal-w-700 {
  width: 90%;
  max-width: 700px;
}

.modal-w-800 {
  width: 90%;
  max-width: 800px;
}

.modal-actions-right {
  margin-top: 20px;
  text-align: right;
}

.divider-section {
  margin: 0 0 16px 0;
}

.divider-tight {
  margin: 1px 0 8px 0;
}

.divider-normal {
  margin: 12px 0 8px 0;
}

.settings-grid-top-gap {
  margin-top: 12px;
}

.w-full {
  width: 100%;
}

.token-checkbox-main {
  flex: 1;
}

.ml-8 {
  margin-left: 8px;
}

.token-group-tag {
  font-size: 11px;
}

.token-group-list {
  margin-left: 8px;
  display: inline-flex;
  gap: 4px;
  flex-wrap: wrap;
}

.mt-16 {
  margin-top: 16px;
}

.log-count-meta {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-tertiary);
}

.recipient-error-text {
  margin-top: 5px;
  display: block;
}

.recipient-card {
  background: var(--surface-glass);
  padding: 16px;
  border-radius: 8px;
  border: 1px solid var(--surface-glass-border);
  display: flex;
  align-items: flex-start;
  gap: 16px;
  transition: all 0.3s ease;
}

.avatar-container {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.3s ease;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: all 0.3s ease;
}

.avatar-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  color: #fff;
  font-size: 24px;
  font-weight: bold;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.avatar-loading {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.loading-spinner {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top: 3px solid #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.role-info {
  flex: 1;
  min-width: 0;
}

.role-name {
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.role-info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.task-tabs :deep(.n-tab-pane) {
  padding-top: 12px;
}

.info-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 2px;
}

.info-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.info-value-power {
  font-size: 16px;
  font-weight: 600;
  color: #667eea;
}

.info-item-full {
  grid-column: 1 / -1;
}

.setting-switches {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
}

.switch-row:last-child {
  border-bottom: none;
}

.switch-label {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Responsive Design */
@media (max-width: 1200px) {
  .right-column {
    width: 380px;
  }
}

@media (max-width: 992px) {
  .batch-daily-tasks {
    height: auto;
    overflow: visible;
  }

  .main-layout {
    flex-direction: column;
    height: auto;
    overflow: visible;
  }

  .left-column {
    overflow-y: visible;
    padding-right: 0;
  }

  .right-column {
    width: 100%;
    height: auto;
    flex-shrink: 0;
  }

  .log-container {
    height: 300px;
    min-height: 300px;
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
    height: 100vh;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .main-layout {
    height: auto;
    overflow: visible;
    flex-direction: column;
  }

  .left-column {
    overflow: visible;
    padding-right: 0;
    flex: none;
    height: auto;
  }

  .right-column {
    height: auto;
    width: 100%;
    flex: none;
  }

  .page-header {
    flex-direction: column;
    gap: 12px;
    align-items: stretch;
    padding: var(--spacing-sm);
  }

  .header-left-wrap {
    width: 100%;
    align-items: stretch;
    gap: 10px;
  }

  .header-info-chip,
  .header-action-chip {
    width: 100%;
    justify-content: flex-start;
  }

  .chip-actions {
    width: 100%;
  }

  .chip-actions :deep(.n-button) {
    flex: 1;
    min-width: 96px;
  }

  .page-header .actions {
    display: flex;
    gap: 8px;
  }

  .log-card {
    height: auto !important;
  }

  .log-card :deep(.n-card__content) {
    flex: none !important;
    overflow: visible !important;
    display: block !important;
  }

  .log-container {
    height: 300px;
    min-height: 300px;
    flex: none !important;
  }

  .log-header-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  /* 批量功法残卷赠送样式 */
  .recipient-info:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
  }

  /* 头像悬停效果 */
  .avatar-container:hover {
    transform: scale(1.05);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.3);
  }

  /* 加载动画 */
  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Token分组管理样式 */
  .group-selection-section {
    padding: 12px;
    background-color: var(--surface-glass);
    border-radius: 8px;
    border: 1px solid var(--surface-glass-border);
  }

  .group-tag {
    padding: 8px 12px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    user-select: none;
    text-align: center;
    font-weight: 500;
  }

  .group-tag:hover {
    transform: translateY(-2px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .group-tag-selected {
    color: white;
    font-weight: 600;
  }

  /* 响应式设计 */
  @media (max-width: 600px) {
    .recipient-info {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }

    .avatar-container {
      margin-bottom: 12px;
    }
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
