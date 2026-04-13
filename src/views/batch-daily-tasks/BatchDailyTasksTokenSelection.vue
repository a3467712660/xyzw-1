<template>
  <n-card class="token-list-card" title="账号列表">
    <div class="token-selection-top">
      <n-space vertical class="w-full">
        <div v-if="tokenGroups.length > 0" class="group-selection-section">
          <div class="group-selection-header">
            <label class="group-selection-label">分组选择</label>
            <n-button text size="small" type="error" @click="$emit('clear-groups')">
              一键清除所有分组选择
            </n-button>
          </div>
          <div class="group-tags-row">
            <div
              v-for="group in tokenGroups"
              :key="group.id"
              class="group-select-chip"
              :class="{ 'is-selected': isGroupSelected(group.id) }"
              :style="{ '--group-color': group.color }"
              @click="$emit('toggle-group-selection', group.id)"
            >
              {{ group.name }} ({{ getValidGroupTokenIds(group.id).length }})
            </div>
          </div>
        </div>

        <div class="group-manage-row">
          <n-button size="small" type="info" @click="$emit('open-group-manage')">
            管理分组
          </n-button>
          <span v-if="selectedGroups.length > 0" class="group-selected-hint">
            已选择 {{ selectedGroups.length }} 个分组，包含
            {{ selectedTokensModel.length }} 个账号
          </span>
        </div>
      </n-space>
    </div>

    <div class="sort-buttons">
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

    <n-space vertical>
      <n-checkbox
        :checked="isAllSelected"
        :indeterminate="isIndeterminate"
        @update:checked="$emit('select-all', $event)"
      >
        全选
      </n-checkbox>
      <n-checkbox-group v-model:value="selectedTokensModel">
        <n-grid :cols="tokenListColumns" :x-gap="12" :y-gap="8">
          <n-grid-item v-for="token in sortedTokens" :key="token.id">
            <div class="token-row">
              <n-checkbox
                class="token-checkbox-main"
                :label="token.name"
                :value="token.id"
              >
                <div class="token-item">
                  <span>{{ token.name }}</span>
                  <n-tag class="ml-8" size="small" :type="getStatusType(token.id)">
                    {{ getStatusText(token.id) }}
                  </n-tag>
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
              <n-button
                circle
                size="tiny"
                @click.stop="$emit('open-settings', token)"
              >
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
    </n-space>
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
