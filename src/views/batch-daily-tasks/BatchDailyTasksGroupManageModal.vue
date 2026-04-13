<template>
  <n-modal
    class="modal-w-800"
    preset="card"
    title="分组管理"
    v-model:show="showModel"
  >
    <div class="group-manage-modal">
      <n-divider class="divider-section" title-placement="left">
        创建新分组
      </n-divider>

      <div class="group-create-section">
        <div class="group-create-row">
          <n-input
            class="group-name-input"
            placeholder="输入分组名称"
            size="small"
            v-model:value="newGroupNameModel"
          ></n-input>
          <div class="group-color-row">
            <span class="group-color-label">选择颜色:</span>
            <div class="group-color-list">
              <div
                v-for="color in groupColors"
                :key="color"
                class="color-swatch color-swatch-md"
                :class="{ 'is-selected': newGroupColorModel === color }"
                :style="{ '--swatch-color': color }"
                @click="newGroupColorModel = color"
              ></div>
            </div>
          </div>
          <n-button size="small" type="primary" @click="$emit('create-new-group')">
            创建分组
          </n-button>
        </div>

        <div class="group-account-box">
          <div class="group-account-header">
            <span class="group-account-title">
              包含账号 ({{ newGroupSelectedTokensModel.length }})
            </span>
            <n-space size="small">
              <n-button size="tiny" @click="$emit('select-all-new-group')">
                全选
              </n-button>
              <n-button size="tiny" @click="$emit('deselect-all-new-group')">
                全不选
              </n-button>
            </n-space>
          </div>

          <div class="group-account-list">
            <n-checkbox-group v-model:value="newGroupSelectedTokensModel">
              <n-grid :cols="3" :x-gap="12" :y-gap="8">
                <n-grid-item v-for="token in sortedTokens" :key="token.id">
                  <n-checkbox :value="token.id">{{ token.name }}</n-checkbox>
                </n-grid-item>
              </n-grid>
            </n-checkbox-group>
          </div>
        </div>
      </div>

      <n-divider class="divider-section" title-placement="left">
        分组列表
      </n-divider>

      <div class="group-list-container">
        <div
          v-for="group in tokenGroups"
          :key="group.id"
          class="group-list-item"
        >
          <div class="group-list-item-row">
            <div class="group-list-main">
              <div v-if="editingGroupId === group.id" class="group-edit-row">
                <n-input
                  class="group-edit-input"
                  placeholder="分组名称"
                  size="small"
                  v-model:value="editingGroupNameModel"
                ></n-input>
                <div class="group-color-list">
                  <div
                    v-for="color in groupColors"
                    :key="color"
                    class="color-swatch color-swatch-sm"
                    :class="{ 'is-selected': editingGroupColorModel === color }"
                    :style="{ '--swatch-color': color }"
                    @click="editingGroupColorModel = color"
                  ></div>
                </div>
                <n-button
                  class="group-mini-btn"
                  size="small"
                  type="primary"
                  @click="$emit('save-edit-group')"
                >
                  保存
                </n-button>
                <n-button
                  class="group-mini-btn"
                  size="small"
                  @click="$emit('cancel-edit-group')"
                >
                  取消
                </n-button>
              </div>

              <div v-else>
                <div class="group-name-row">
                  <div
                    class="group-color-dot"
                    :style="{ '--dot-color': group.color }"
                  ></div>
                  <span class="group-name-text">{{ group.name }}</span>
                  <n-tag size="small" type="info">
                    {{ getValidGroupTokenIds(group.id).length }} 个账号
                  </n-tag>
                </div>

                <div class="group-token-tags">
                  <div
                    v-for="tokenId in getValidGroupTokenIds(group.id)"
                    :key="tokenId"
                    class="group-token-tag"
                  >
                    {{ getTokenName(tokenId) }}
                    <n-button
                      text
                      size="tiny"
                      type="error"
                      @click="$emit('remove-token-from-group', group.id, tokenId)"
                    >
                      ×
                    </n-button>
                  </div>
                </div>

                <div class="group-add-token-row">
                  <n-select
                    filterable
                    placeholder="添加账号到分组"
                    size="small"
                    :options="getAvailableTokenOptions(group.id)"
                    @update:value="(tokenId) => handleAddToken(group.id, tokenId)"
                  ></n-select>
                </div>
              </div>
            </div>

            <div v-if="editingGroupId !== group.id" class="group-item-actions">
              <n-button size="small" @click="$emit('start-edit-group', group.id)">
                编辑
              </n-button>
              <n-button
                size="small"
                type="error"
                @click="$emit('delete-group', group.id)"
              >
                删除
              </n-button>
            </div>
          </div>
        </div>

        <div v-if="tokenGroups.length === 0" class="group-empty-state">
          暂无分组，请创建一个新分组
        </div>
      </div>

      <div class="modal-actions modal-actions-right">
        <n-button @click="showModel = false">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  editingGroupColor: {
    type: String,
    default: "",
  },
  editingGroupId: {
    type: [Number, String],
    default: null,
  },
  editingGroupName: {
    type: String,
    default: "",
  },
  getValidGroupTokenIds: {
    type: Function,
    required: true,
  },
  groupColors: {
    type: Array,
    default: () => [],
  },
  newGroupColor: {
    type: String,
    default: "",
  },
  newGroupName: {
    type: String,
    default: "",
  },
  newGroupSelectedTokens: {
    type: Array,
    default: () => [],
  },
  show: {
    type: Boolean,
    default: false,
  },
  sortedTokens: {
    type: Array,
    default: () => [],
  },
  tokenGroups: {
    type: Array,
    default: () => [],
  },
  tokens: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "add-token-to-group",
  "cancel-edit-group",
  "create-new-group",
  "delete-group",
  "deselect-all-new-group",
  "remove-token-from-group",
  "save-edit-group",
  "select-all-new-group",
  "start-edit-group",
  "update:editing-group-color",
  "update:editing-group-name",
  "update:new-group-color",
  "update:new-group-name",
  "update:new-group-selected-tokens",
  "update:show",
]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const newGroupNameModel = computed({
  get: () => props.newGroupName,
  set: (value) => emit("update:new-group-name", value),
});

const newGroupColorModel = computed({
  get: () => props.newGroupColor,
  set: (value) => emit("update:new-group-color", value),
});

const newGroupSelectedTokensModel = computed({
  get: () => props.newGroupSelectedTokens,
  set: (value) => emit("update:new-group-selected-tokens", value),
});

const editingGroupNameModel = computed({
  get: () => props.editingGroupName,
  set: (value) => emit("update:editing-group-name", value),
});

const editingGroupColorModel = computed({
  get: () => props.editingGroupColor,
  set: (value) => emit("update:editing-group-color", value),
});

const getTokenName = (tokenId) =>
  props.tokens.find((token) => token.id === tokenId)?.name || `账号${tokenId}`;

const getAvailableTokenOptions = (groupId) =>
  props.tokens
    .filter((token) => !props.getValidGroupTokenIds(groupId).includes(token.id))
    .map((token) => ({
      label: token.name,
      value: token.id,
    }));

const handleAddToken = (groupId, tokenId) => {
  if (!tokenId) {
    return;
  }
  emit("add-token-to-group", groupId, tokenId);
};
</script>

<style scoped lang="scss">
.modal-w-800 {
  width: 90%;
  max-width: 800px;
}

.group-manage-modal {
  display: flex;
  flex-direction: column;
}

.divider-section {
  margin: 0 0 16px 0;
}

.group-create-section {
  margin-bottom: 24px;
}

.group-create-row,
.group-color-row,
.group-color-list,
.group-edit-row,
.modal-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.group-create-row {
  margin-bottom: 12px;
  gap: 12px;
  flex-wrap: wrap;
}

.group-color-label {
  font-size: 12px;
}

.group-name-input {
  width: 200px;
}

.group-edit-input {
  width: 150px;
}

.color-swatch {
  width: 24px;
  height: 24px;
  border-radius: 999px;
  cursor: pointer;
  border: 2px solid transparent;
  background: var(--swatch-color);
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.color-swatch.is-selected {
  border-color: #fff;
}

.color-swatch-md:hover {
  transform: scale(1.1);
}

.color-swatch-sm {
  width: 20px;
  height: 20px;
}

.group-account-box {
  background: var(--surface-glass);
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--surface-glass-border);
}

.group-account-header,
.group-list-item-row,
.group-name-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.group-account-header {
  margin-bottom: 8px;
}

.group-account-title,
.group-name-text {
  font-weight: 700;
}

.group-account-list {
  max-height: 150px;
  overflow-y: auto;
}

.group-list-container {
  max-height: 500px;
  overflow-y: auto;
  border: 1px solid var(--surface-glass-border);
  border-radius: 8px;
  padding: 12px;
}

.group-list-item {
  padding: 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 6px;
  margin-bottom: 12px;
  background: var(--surface-glass);
}

.group-list-main {
  flex: 1;
}

.group-mini-btn {
  margin-right: 8px;
}

.group-name-row {
  justify-content: flex-start;
  margin-bottom: 8px;
}

.group-color-dot {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  background-color: var(--dot-color);
}

.group-token-tags {
  margin-bottom: 8px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.group-token-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.group-add-token-row {
  margin-top: 8px;
}

.group-item-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-end;
}

.group-empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-tertiary);
}

.modal-actions-right {
  margin-top: 20px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .group-account-header,
  .group-create-row,
  .group-edit-row,
  .group-list-item-row {
    flex-direction: column;
    align-items: flex-start;
  }

  .group-item-actions {
    flex-direction: row;
    align-items: center;
  }
}
</style>
