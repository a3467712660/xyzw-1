<template>
  <n-modal
    class="modal-w-700"
    preset="card"
    :show="show"
    :title="title"
    @update:show="$emit('update:show', $event)"
  >
    <div class="settings-content">
      <n-grid :cols="2" :x-gap="24">
        <n-grid-item>
          <n-divider class="divider-tight" title-placement="left">
            批量操作设置
          </n-divider>
          <div class="settings-grid">
            <div class="setting-item setting-item-row">
              <label class="setting-label">开箱数量(10倍)</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="10000"
                :min="10"
                :step="10"
                :value="batchSettings.boxCount"
                @update:value="emit('update-field', 'boxCount', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">钓鱼数量(10倍)</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="10000"
                :min="10"
                :step="10"
                :value="batchSettings.fishCount"
                @update:value="emit('update-field', 'fishCount', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">招募数量(10倍)</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="10000"
                :min="10"
                :step="10"
                :value="batchSettings.recruitCount"
                @update:value="emit('update-field', 'recruitCount', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">默认宝箱类型</label>
              <n-select
                class="input-w-100"
                size="small"
                :options="boxTypeOptions"
                :value="batchSettings.defaultBoxType"
                @update:value="emit('update-field', 'defaultBoxType', $event)"
              ></n-select>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">默认鱼竿类型</label>
              <n-select
                class="input-w-100"
                size="small"
                :options="fishTypeOptions"
                :value="batchSettings.defaultFishType"
                @update:value="emit('update-field', 'defaultFishType', $event)"
              ></n-select>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">梦境商品购买配置</label>
              <n-button size="small" @click="$emit('open-dream-buy')">
                点击配置
              </n-button>
            </div>
          </div>

          <n-divider class="divider-normal" title-placement="left">
            智能发车条件设置(0为不限制)
          </n-divider>
          <div class="settings-grid">
            <div class="setting-item setting-item-row">
              <label class="setting-label">保底车辆颜色</label>
              <n-select
                class="input-w-100"
                size="small"
                :options="carMinColorOptions"
                :value="batchSettings.carMinColor"
                @update:value="emit('update-field', 'carMinColor', $event)"
              ></n-select>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">车辆强制刷新保底</label>
              <n-switch
                :value="batchSettings.useGoldRefreshFallback"
                @update:value="emit('update-field', 'useGoldRefreshFallback', $event)"
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
                :value="batchSettings.smartDepartureMatchAll"
                @update:value="emit('update-field', 'smartDepartureMatchAll', $event)"
              ></n-switch>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">金砖 >=</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :min="0"
                :step="100"
                :value="batchSettings.smartDepartureGoldThreshold"
                @update:value="emit('update-field', 'smartDepartureGoldThreshold', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">招募令 >=</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :min="0"
                :step="10"
                :value="batchSettings.smartDepartureRecruitThreshold"
                @update:value="emit('update-field', 'smartDepartureRecruitThreshold', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">白玉 >=</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :min="0"
                :step="100"
                :value="batchSettings.smartDepartureJadeThreshold"
                @update:value="emit('update-field', 'smartDepartureJadeThreshold', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">刷新卷 >=</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :min="0"
                :step="1"
                :value="batchSettings.smartDepartureTicketThreshold"
                @update:value="emit('update-field', 'smartDepartureTicketThreshold', $event)"
              ></n-input-number>
            </div>
          </div>

          <div class="settings-grid settings-grid-top-gap">
            <div class="setting-item setting-item-row">
              <label class="setting-label">护卫阵容分析</label>
              <n-switch
                :value="batchSettings.helperLineupAnalysisEnabled"
                @update:value="emit('update-field', 'helperLineupAnalysisEnabled', $event)"
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
                :options="helperLineupKeywordOptions"
                :value="batchSettings.helperPreferredLineups"
                @update:value="emit('update-field', 'helperPreferredLineups', $event)"
              ></n-select>
            </div>
          </div>

          <n-divider class="divider-normal" title-placement="left">
            功法赠送设置
          </n-divider>
          <div class="settings-grid">
            <div class="setting-item setting-item-row">
              <label class="setting-label">接收者ID</label>
              <n-input-number
                class="input-w-100"
                placeholder="ID"
                size="small"
                :show-button="false"
                :value="batchSettings.receiverId"
                @update:value="emit('update-field', 'receiverId', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">密码</label>
              <n-input
                class="input-w-100"
                placeholder="密码"
                size="small"
                type="password"
                :value="batchSettings.password"
                @update:value="emit('update-field', 'password', $event)"
              ></n-input>
            </div>
          </div>
        </n-grid-item>

        <n-grid-item>
          <n-divider class="divider-tight" title-placement="left">
            延迟设置(ms)
          </n-divider>
          <div class="settings-grid">
            <div class="setting-item setting-item-row">
              <label class="setting-label">命令延迟</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="2000"
                :min="100"
                :step="100"
                :value="batchSettings.commandDelay"
                @update:value="emit('update-field', 'commandDelay', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">任务间延迟</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="2000"
                :min="100"
                :step="100"
                :value="batchSettings.taskDelay"
                @update:value="emit('update-field', 'taskDelay', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">操作延迟</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="2000"
                :min="100"
                :step="100"
                :value="batchSettings.actionDelay"
                @update:value="emit('update-field', 'actionDelay', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">战斗延迟</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="2000"
                :min="100"
                :step="100"
                :value="batchSettings.battleDelay"
                @update:value="emit('update-field', 'battleDelay', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">刷新延迟</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="3000"
                :min="500"
                :step="100"
                :value="batchSettings.refreshDelay"
                @update:value="emit('update-field', 'refreshDelay', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">长延迟</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="10000"
                :min="1000"
                :step="500"
                :value="batchSettings.longDelay"
                @update:value="emit('update-field', 'longDelay', $event)"
              ></n-input-number>
            </div>
          </div>

          <n-divider class="divider-normal" title-placement="left">
            连接设置
          </n-divider>
          <div class="settings-grid">
            <div class="setting-item setting-item-row">
              <label class="setting-label">最大并发数</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="20"
                :min="1"
                :step="1"
                :value="batchSettings.maxActive"
                @update:value="emit('update-field', 'maxActive', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">连接超时(ms)</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="30000"
                :min="1000"
                :step="1000"
                :value="batchSettings.connectionTimeout"
                @update:value="emit('update-field', 'connectionTimeout', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">重连等待(ms)</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="5000"
                :min="100"
                :step="100"
                :value="batchSettings.reconnectDelay"
                @update:value="emit('update-field', 'reconnectDelay', $event)"
              ></n-input-number>
            </div>
          </div>

          <n-divider class="divider-normal" title-placement="left">
            系统设置
          </n-divider>
          <div class="settings-grid">
            <div class="setting-item setting-item-row">
              <label class="setting-label">列表每行数量</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="10"
                :min="1"
                :step="1"
                :value="batchSettings.tokenListColumns"
                @update:value="emit('update-field', 'tokenListColumns', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">最大日志条目</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="5000"
                :min="100"
                :step="100"
                :value="batchSettings.maxLogEntries"
                @update:value="emit('update-field', 'maxLogEntries', $event)"
              ></n-input-number>
            </div>
            <div class="setting-item setting-item-row">
              <label class="setting-label">定时刷新页面</label>
              <n-switch
                :value="batchSettings.enableRefresh"
                @update:value="emit('update-field', 'enableRefresh', $event)"
              ></n-switch>
            </div>
            <div
              v-if="batchSettings.enableRefresh"
              class="setting-item setting-item-row"
            >
              <label class="setting-label">刷新间隔(分钟)</label>
              <n-input-number
                class="input-w-100"
                size="small"
                :max="1440"
                :min="10"
                :step="30"
                :value="batchSettings.refreshInterval"
                @update:value="emit('update-field', 'refreshInterval', $event)"
              ></n-input-number>
            </div>
          </div>
        </n-grid-item>
      </n-grid>

      <div class="modal-actions modal-actions-right">
        <n-button class="btn-mr" @click="$emit('update:show', false)">
          取消
        </n-button>
        <n-button type="primary" @click="$emit('save')">保存设置</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
defineProps({
  batchSettings: {
    type: Object,
    required: true,
  },
  boxTypeOptions: {
    type: Array,
    default: () => [],
  },
  fishTypeOptions: {
    type: Array,
    default: () => [],
  },
  helperLineupKeywordOptions: {
    type: Array,
    default: () => [],
  },
  show: Boolean,
  title: {
    type: String,
    default: "任务设置",
  },
});

const emit = defineEmits(["open-dream-buy", "save", "update-field", "update:show"]);

const carMinColorOptions = [
  { label: "绿·普通", value: 1 },
  { label: "蓝·稀有", value: 2 },
  { label: "紫·史诗", value: 3 },
  { label: "橙·传说", value: 4 },
  { label: "红·神话", value: 5 },
  { label: "金·传奇", value: 6 },
];
</script>

<style scoped lang="scss">
.modal-w-700 {
  width: 90%;
  max-width: 700px;
}

.settings-content {
  display: flex;
  flex-direction: column;
}

.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
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
  gap: 12px;
}

.setting-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.input-w-100 {
  width: 100px;
}

.btn-mr {
  margin-right: 12px;
}

.modal-actions-right {
  margin-top: 20px;
  text-align: right;
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
</style>
