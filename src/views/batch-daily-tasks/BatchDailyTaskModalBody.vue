<template>
  <div class="task-modal-body">
    <div class="settings-grid">
      <div class="setting-item">
        <label class="setting-label">任务名称</label>
        <n-input
          placeholder="请输入任务名称"
          :value="taskForm.name"
          @update:value="updateTaskFormField('name', $event)"
        ></n-input>
      </div>

      <div class="setting-item">
        <label class="setting-label">运行类型</label>
        <n-radio-group
          :value="taskForm.runType"
          @update:value="handleRunTypeChange"
        >
          <n-radio value="daily">每天固定时间</n-radio>
          <n-radio value="cron">Cron表达式</n-radio>
        </n-radio-group>
      </div>

      <div v-if="taskForm.runType === 'daily'" class="setting-item">
        <label class="setting-label">运行时间</label>
        <n-time-picker
          format="HH:mm"
          :value="taskForm.runTime"
          @update:value="updateTaskFormField('runTime', $event)"
        ></n-time-picker>
      </div>

      <div v-if="taskForm.runType === 'cron'" class="setting-item">
        <label class="setting-label">Cron表达式</label>
        <n-input
          placeholder="请输入Cron表达式"
          :value="taskForm.cronExpression"
          @update:value="handleCronExpressionChange"
        ></n-input>

        <div v-if="taskForm.cronExpression" class="cron-parser">
          <div v-if="cronValidation.valid" class="cron-validation success">
            <n-text type="success">✓ {{ cronValidation.message }}</n-text>
          </div>
          <div v-else class="cron-validation error">
            <n-text type="error">✗ {{ cronValidation.message }}</n-text>
          </div>

          <div
            v-if="cronValidation.valid && cronNextRuns.length > 0"
            class="cron-next-runs"
          >
            <h4>未来5次执行时间：</h4>
            <ul>
              <li v-for="(run, index) in cronNextRuns" :key="index">
                {{ run }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div class="setting-item">
        <div class="setting-header-row">
          <label class="setting-label">选择账号</label>
          <n-space size="small">
            <n-button size="small" @click="$emit('select-all-tokens')">
              全选
            </n-button>
            <n-button size="small" @click="$emit('deselect-all-tokens')">
              全不选
            </n-button>
          </n-space>
        </div>

        <div class="task-group-quick">
          <div class="task-group-quick-head">
            <div class="task-group-quick-text">快速选择分组：</div>
            <n-button
              text
              size="tiny"
              type="primary"
              @click="$emit('open-group-manage')"
            >
              管理分组
            </n-button>
          </div>

          <div v-if="tokenGroups.length === 0" class="task-group-empty">
            暂无分组
          </div>

          <div class="task-group-buttons">
            <n-button
              v-for="group in tokenGroups"
              :key="group.id"
              class="task-group-btn"
              size="small"
              :style="{ '--group-color': group.color }"
              :type="
                taskScheduleSelectedGroupIds.includes(group.id)
                  ? 'primary'
                  : 'default'
              "
              @click="$emit('toggle-task-group', group.id)"
            >
              {{ group.name }}
            </n-button>
          </div>
        </div>

        <n-checkbox-group
          :value="taskForm.selectedTokens"
          @update:value="updateTaskFormField('selectedTokens', $event)"
        >
          <n-grid :cols="2" :x-gap="12" :y-gap="8">
            <n-grid-item v-for="token in sortedTokens" :key="token.id">
              <n-checkbox :value="token.id">{{ token.name }}</n-checkbox>
            </n-grid-item>
          </n-grid>
        </n-checkbox-group>
      </div>

      <div class="setting-item">
        <div class="setting-header-row">
          <label class="setting-label">选择任务</label>
          <n-space size="small">
            <n-button size="small" @click="$emit('select-all-tasks')">
              全选
            </n-button>
            <n-button size="small" @click="$emit('deselect-all-tasks')">
              全不选
            </n-button>
          </n-space>
        </div>

        <n-checkbox-group
          :value="taskForm.selectedTasks"
          @update:value="updateTaskFormField('selectedTasks', $event)"
        >
          <n-tabs
            animated
            class="task-tabs"
            default-value="daily"
            size="small"
            type="line"
          >
            <n-tab-pane
              v-for="group in taskGroupDefinitions"
              :key="group.name"
              :name="group.name"
              :tab="group.label"
            >
              <n-grid :cols="2" :x-gap="12" :y-gap="8">
                <n-grid-item
                  v-for="task in groupedAvailableTasks[group.name]"
                  :key="task.value"
                >
                  <n-checkbox :value="task.value">
                    {{ task.label }}
                  </n-checkbox>
                </n-grid-item>
              </n-grid>
            </n-tab-pane>

            <n-tab-pane
              v-if="
                groupedAvailableTasks.other
                  && groupedAvailableTasks.other.length > 0
              "
              name="other"
              tab="其他"
            >
              <n-grid :cols="2" :x-gap="12" :y-gap="8">
                <n-grid-item
                  v-for="task in groupedAvailableTasks.other"
                  :key="task.value"
                >
                  <n-checkbox :value="task.value">
                    {{ task.label }}
                  </n-checkbox>
                </n-grid-item>
              </n-grid>
            </n-tab-pane>
          </n-tabs>
        </n-checkbox-group>
      </div>
    </div>

    <div class="modal-actions modal-actions-right">
      <n-button class="btn-mr" @click="$emit('cancel')">取消</n-button>
      <n-button type="primary" @click="$emit('save')">保存</n-button>
    </div>
  </div>
</template>

<script setup>
const props = defineProps({
  cronNextRuns: {
    type: Array,
    default: () => [],
  },
  cronValidation: {
    type: Object,
    default: () => ({
      message: "",
      valid: false,
    }),
  },
  groupedAvailableTasks: {
    type: Object,
    default: () => ({}),
  },
  sortedTokens: {
    type: Array,
    default: () => [],
  },
  taskForm: {
    type: Object,
    required: true,
  },
  taskGroupDefinitions: {
    type: Array,
    default: () => [],
  },
  taskScheduleSelectedGroupIds: {
    type: Array,
    default: () => [],
  },
  tokenGroups: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "cancel",
  "deselect-all-tasks",
  "deselect-all-tokens",
  "open-group-manage",
  "parse-cron",
  "reset-run-type",
  "save",
  "select-all-tasks",
  "select-all-tokens",
  "toggle-task-group",
  "update-task-form-field",
]);

const updateTaskFormField = (key, value) => {
  emit("update-task-form-field", key, value);
};

const handleRunTypeChange = (value) => {
  updateTaskFormField("runType", value);
  emit("reset-run-type");
};

const handleCronExpressionChange = (value) => {
  updateTaskFormField("cronExpression", value);
  emit("parse-cron");
};
</script>

<style scoped lang="scss">
.task-modal-body,
.settings-grid,
.setting-item,
.cron-parser,
.task-group-quick {
  display: flex;
  flex-direction: column;
}

.task-modal-body,
.settings-grid {
  gap: 16px;
}

.setting-item {
  gap: 8px;
}

.setting-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.setting-header-row,
.task-group-quick-head,
.modal-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.task-group-quick {
  margin-bottom: 12px;
  gap: 8px;
}

.task-group-quick-text,
.task-group-empty {
  font-size: 12px;
  color: var(--text-tertiary);
}

.task-group-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.task-group-btn {
  border-color: var(--group-color);
}

.cron-parser {
  margin-top: 12px;
  padding: 12px;
  gap: 12px;
  background-color: var(--bg-tertiary);
  border-radius: 8px;
}

.cron-validation {
  padding: 8px;
  border-radius: 4px;
}

.cron-validation.success {
  background-color: rgba(24, 160, 88, 0.12);
}

.cron-validation.error {
  background-color: rgba(235, 87, 87, 0.12);
}

.cron-next-runs h4 {
  margin: 0 0 8px 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.cron-next-runs ul {
  list-style: none;
  padding: 0;
  margin: 0;
}

.cron-next-runs li {
  padding: 6px 0;
  font-size: 13px;
  color: var(--text-secondary);
  border-bottom: 1px solid var(--border-color);
}

.cron-next-runs li:last-child {
  border-bottom: none;
}

.modal-actions-right {
  margin-top: 20px;
}

.btn-mr {
  margin-right: 12px;
}

@media (max-width: 768px) {
  .setting-header-row,
  .task-group-quick-head,
  .modal-actions {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
