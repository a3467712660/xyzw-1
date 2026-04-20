<template>
  <n-card class="token-list-card batch-token-panel">
    <template #header>
      <div class="batch-token-panel__header">
        <div>
          <span class="batch-token-panel__eyebrow">执行账号</span>
          <h3>账号选择与分组</h3>
          <p>按分组、状态和排序条件快速选择执行账号。</p>
        </div>
        <div class="batch-token-panel__summary">
          <span>已选 {{ selectedTokensModel.length }} / {{ sortedTokens.length }}</span>
          <strong>{{ selectedGroups.length }} 个分组已参与筛选</strong>
        </div>
      </div>
    </template>

    <div class="token-selection-top">
      <div v-if="tokenGroups.length > 0" class="group-selection-section">
        <div class="group-selection-header">
          <label class="group-selection-label">快速分组筛选</label>
          <n-button text size="small" type="error" @click="$emit('clear-groups')">
            清空当前分组
          </n-button>
        </div>

        <div class="group-tags-row">
          <button
            v-for="group in tokenGroups"
            :key="group.id"
            class="group-select-chip"
            type="button"
            :class="{ 'is-selected': isGroupSelected(group.id) }"
            :style="{ '--group-color': group.color }"
            @click="$emit('toggle-group-selection', group.id)"
          >
            <span>{{ group.name }}</span>
            <strong>{{ getValidGroupTokenIds(group.id).length }}</strong>
          </button>
        </div>
      </div>

      <div class="group-manage-row">
        <n-button size="small" type="info" @click="$emit('open-group-manage')">
          管理分组
        </n-button>
        <span v-if="selectedGroups.length > 0" class="group-selected-hint">
          已命中 {{ selectedGroups.length }} 个分组，当前共选中 {{ selectedTokensModel.length }} 个账号
        </span>
        <span v-else class="group-selected-hint">
          也可以直接勾选下方账号，不依赖分组筛选。
        </span>
      </div>
    </div>

    <div class="sort-buttons">
      <div class="batch-token-panel__sort-head">
        <span>排序方式</span>
        <p>按名称、服务器、创建时间或最后使用时间切换视角。</p>
      </div>
      <n-space align="center">
        <n-button-group size="small">
          <n-button
            :type="sortConfig.field === 'name' ? 'primary' : 'default'"
            @click="$emit('toggle-sort', 'name')"
          >
            名称 {{ getSortIcon("name") }}
          </n-button>
          <n-button
            :type="sortConfig.field === 'server' ? 'primary' : 'default'"
            @click="$emit('toggle-sort', 'server')"
          >
            服务器 {{ getSortIcon("server") }}
          </n-button>
          <n-button
            :type="sortConfig.field === 'createdAt' ? 'primary' : 'default'"
            @click="$emit('toggle-sort', 'createdAt')"
          >
            创建时间 {{ getSortIcon("createdAt") }}
          </n-button>
          <n-button
            :type="sortConfig.field === 'lastUsed' ? 'primary' : 'default'"
            @click="$emit('toggle-sort', 'lastUsed')"
          >
            最后使用 {{ getSortIcon("lastUsed") }}
          </n-button>
        </n-button-group>
      </n-space>
    </div>

    <div class="batch-token-panel__selection-bar">
      <n-checkbox
        :checked="isAllSelected"
        :indeterminate="isIndeterminate"
        @update:checked="$emit('select-all', $event)"
      >
        全选当前结果
      </n-checkbox>
      <span class="batch-token-panel__selection-hint">
        当前账号卡片数量：{{ sortedTokens.length }}
      </span>
    </div>

    <n-checkbox-group class="batch-token-panel__checkbox-group" v-model:value="selectedTokensModel">
      <n-grid :cols="tokenListColumns" :x-gap="14" :y-gap="12">
        <n-grid-item v-for="token in sortedTokens" :key="token.id">
          <div class="token-row">
            <n-checkbox class="token-checkbox-main" :value="token.id">
              <div class="token-item">
                <div class="token-item__head">
                  <span class="token-item__name">{{ token.name }}</span>
                  <n-tag size="small" :type="getStatusType(token.id)">
                    {{ getStatusText(token.id) }}
                  </n-tag>
                </div>

                <div class="token-item__meta">
                  <span>{{ token.server || "未知服务器" }}</span>
                </div>

                <div
                  v-if="getTokenGroups(token.id).length > 0"
                  class="token-group-list"
                >
                  <n-tag
                    v-for="group in getTokenGroups(token.id)"
                    :key="group.id"
                    class="token-group-tag"
                    size="small"
                    :color="{ color: group.color, textColor: 'white' }"
                  >
                    {{ group.name }}
                  </n-tag>
                </div>
              </div>
            </n-checkbox>

            <n-button circle size="tiny" @click.stop="$emit('open-settings', token)">
              <template #icon>
                <n-icon>
                  <Settings></Settings>
                </n-icon>
              </template>
            </n-button>
          </div>
        </n-grid-item>
      </n-grid>
    </n-checkbox-group>
  </n-card>
</template>

<script setup>
import { computed } from "vue";
import { Settings } from "@vicons/ionicons5";

const props = defineProps({
  batchSettings: {
    type: Object,
    required: true,
  },
  getSortIcon: {
    type: Function,
    required: true,
  },
  getStatusText: {
    type: Function,
    required: true,
  },
  getStatusType: {
    type: Function,
    required: true,
  },
  getTokenGroups: {
    type: Function,
    required: true,
  },
  getValidGroupTokenIds: {
    type: Function,
    required: true,
  },
  isAllSelected: {
    type: Boolean,
    default: false,
  },
  isGroupSelected: {
    type: Function,
    required: true,
  },
  isIndeterminate: {
    type: Boolean,
    default: false,
  },
  selectedGroups: {
    type: Array,
    default: () => [],
  },
  selectedTokens: {
    type: Array,
    default: () => [],
  },
  sortConfig: {
    type: Object,
    required: true,
  },
  sortedTokens: {
    type: Array,
    default: () => [],
  },
  tokenGroups: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "clear-groups",
  "open-group-manage",
  "open-settings",
  "select-all",
  "toggle-group-selection",
  "toggle-sort",
  "update:selectedTokens",
]);

const selectedTokensModel = computed({
  get: () => props.selectedTokens,
  set: (value) => emit("update:selectedTokens", value),
});

const tokenListColumns = computed(
  () => props.batchSettings?.tokenListColumns || 1,
);
</script>

<style scoped lang="scss">
.batch-token-panel {
  border-radius: 26px;
}

.batch-token-panel :deep(.n-card__content) {
  display: grid;
  gap: 16px;
}

.batch-token-panel__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
}

.batch-token-panel__eyebrow {
  display: inline-block;
  margin-bottom: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-tertiary);
}

.batch-token-panel__header h3 {
  margin: 0;
  font-size: 24px;
  color: var(--text-primary);
}

.batch-token-panel__header p,
.batch-token-panel__sort-head p {
  margin: 6px 0 0;
  color: var(--text-secondary);
  line-height: 1.6;
}

.batch-token-panel__summary {
  display: grid;
  gap: 6px;
  min-width: 220px;
  padding: 14px 16px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 18px;
  background: var(--surface-glass);
  color: var(--text-secondary);
}

.batch-token-panel__summary strong {
  color: var(--text-primary);
}

.token-selection-top {
  display: grid;
  gap: 14px;
  margin-bottom: 18px;
}

.group-selection-section {
  padding: 16px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 20px;
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.08), transparent 78%),
    var(--surface-glass);
}

.group-selection-header,
.group-manage-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.group-selection-header {
  margin-bottom: 12px;
}

.group-selection-label {
  font-weight: 700;
  color: var(--text-primary);
}

.group-tags-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.group-select-chip {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 40px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--group-color) 62%, white 38%);
  background: color-mix(in srgb, var(--group-color) 10%, transparent);
  color: var(--group-color);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    background 0.2s ease;
}

.group-select-chip strong {
  font-size: 12px;
}

.group-select-chip:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 20px rgba(15, 23, 42, 0.08);
}

.group-select-chip.is-selected {
  background: var(--group-color);
  color: #fff;
}

.group-selected-hint,
.batch-token-panel__selection-hint {
  font-size: 12px;
  color: var(--text-tertiary);
}

.sort-buttons {
  display: grid;
  gap: 12px;
  margin-bottom: 14px;
}

.batch-token-panel__sort-head {
  display: grid;
  gap: 4px;
}

.batch-token-panel__sort-head span {
  font-weight: 700;
  color: var(--text-primary);
}

.batch-token-panel__selection-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
  padding: 12px 14px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 16px;
  background: rgba(63, 119, 173, 0.05);
}

.token-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  min-height: 100%;
  padding: 14px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 18px;
  background:
    linear-gradient(135deg, rgba(63, 119, 173, 0.08), transparent 78%),
    var(--surface-glass);
  box-shadow: var(--shadow-light);
  transition:
    transform 0.2s ease,
    border-color 0.2s ease,
    box-shadow 0.2s ease;
}

.token-row:hover {
  transform: translateY(-1px);
  border-color: rgba(63, 119, 173, 0.24);
  box-shadow: 0 16px 32px rgba(15, 23, 42, 0.08);
}

.token-checkbox-main {
  flex: 1;
  min-width: 0;
}

.token-item {
  display: grid;
  gap: 8px;
}

.token-item__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.token-item__name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

@media (max-width: 768px) {
  .batch-token-panel {
    border-radius: 20px;
  }

  .batch-token-panel__header,
  .batch-token-panel__selection-bar,
  .group-selection-header,
  .group-manage-row {
    flex-direction: column;
    align-items: stretch;
  }
}

.token-item__meta {
  font-size: 13px;
  color: var(--text-secondary);
}

.token-group-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.token-group-tag {
  font-size: 11px;
}

@media (max-width: 768px) {
  .batch-token-panel__header,
  .batch-token-panel__selection-bar,
  .group-selection-header,
  .group-manage-row {
    flex-direction: column;
    align-items: stretch;
  }

  .group-select-chip {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
