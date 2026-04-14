<template>
  <n-modal
    class="modal-w-600"
    preset="card"
    title="应用任务模板"
    v-model:show="showModel"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <div class="setting-item">
          <label class="setting-label">选择模板</label>
          <n-select
            class="input-w-full"
            label-field="name"
            placeholder="请选择要应用的模板"
            size="small"
            value-field="id"
            v-model:value="selectedTemplateIdModel"
            :options="taskTemplates"
          ></n-select>
        </div>

        <div class="setting-item">
          <label class="setting-label">选择账号</label>

          <div class="apply-group-quick">
            <div class="apply-group-quick-label">快速选择分组：</div>
            <div class="apply-group-buttons">
              <n-button
                v-for="group in tokenGroups"
                :key="group.id"
                ghost
                class="apply-group-btn"
                size="small"
                :style="{ '--group-color': group.color }"
                @click="$emit('append-group-tokens', group.id)"
              >
                {{ group.name }}
              </n-button>
              <div v-if="tokenGroups.length === 0" class="apply-group-empty">
                暂无分组
              </div>
            </div>
          </div>

          <n-checkbox
            :checked="isAllSelected"
            :indeterminate="isIndeterminate"
            @update:checked="$emit('select-all')"
          >
            全选
          </n-checkbox>

          <n-checkbox-group
            class="apply-token-checklist"
            v-model:value="selectedTokensForApplyModel"
          >
            <n-grid :cols="2" :x-gap="12" :y-gap="8">
              <n-grid-item v-for="token in sortedTokens" :key="token.id">
                <n-checkbox :value="token.id">{{ token.name }}</n-checkbox>
              </n-grid-item>
            </n-grid>
          </n-checkbox-group>
        </div>
      </div>

      <div class="modal-actions modal-actions-right">
        <n-button @click="showModel = false">取消</n-button>
        <n-button
          type="success"
          :disabled="!selectedTemplateId || selectedTokensForApply.length === 0"
          @click="$emit('apply')"
        >
          应用模板
        </n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  isAllSelected: {
    type: Boolean,
    default: false,
  },
  isIndeterminate: {
    type: Boolean,
    default: false,
  },
  selectedTemplateId: {
    type: [String, Number, null],
    default: null,
  },
  selectedTokensForApply: {
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
  taskTemplates: {
    type: Array,
    default: () => [],
  },
  tokenGroups: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "append-group-tokens",
  "apply",
  "select-all",
  "update:selected-template-id",
  "update:selected-tokens-for-apply",
  "update:show",
]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const selectedTemplateIdModel = computed({
  get: () => props.selectedTemplateId,
  set: (value) => emit("update:selected-template-id", value),
});

const selectedTokensForApplyModel = computed({
  get: () => props.selectedTokensForApply,
  set: (value) => emit("update:selected-tokens-for-apply", value),
});
</script>

<style scoped lang="scss">
.modal-w-600 {
  width: 90%;
  max-width: 600px;
}

.settings-content,
.settings-grid,
.setting-item {
  display: flex;
  flex-direction: column;
}

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

.input-w-full {
  width: 100%;
}

.modal-actions {
  display: flex;
}

.modal-actions-right {
  margin-top: 20px;
  justify-content: flex-end;
}

.apply-group-quick {
  margin-bottom: 12px;
  border-bottom: 1px solid var(--border-light);
  padding-bottom: 8px;
}

.apply-group-quick-label {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-bottom: 8px;
}

.apply-group-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.apply-group-btn {
  border-color: var(--group-color);
  color: var(--group-color);
}

.apply-group-empty {
  font-size: 12px;
  color: #ccc;
}

.apply-token-checklist {
  margin-top: 8px;
}
</style>
