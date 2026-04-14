<template>
  <n-modal
    class="modal-w-800"
    preset="card"
    title="账号模板引用查看"
    v-model:show="showModel"
  >
    <div class="settings-content">
      <div class="template-header-row">
        <div>
          <span>共 {{ filteredAccountTemplates.length }} 个账号</span>
        </div>
        <div class="account-filter-row">
          <label class="account-filter-label">按模板筛选:</label>
          <n-select
            class="account-filter-select"
            label-field="name"
            placeholder="全部模板"
            size="small"
            value-field="id"
            v-model:value="selectedTemplateForFilterModel"
            :options="taskTemplates"
            @update:value="$emit('filter-account-templates', $event)"
          ></n-select>
        </div>
      </div>

      <div class="account-template-list template-list-box">
        <n-card
          v-for="item in filteredAccountTemplates"
          :key="item.tokenId"
          class="template-item-card"
          size="small"
        >
          <div class="template-item-row">
            <div>
              <h4 class="template-item-title-small">
                {{ item.tokenName }}
              </h4>
            </div>
            <div>
              <n-tag size="small" :type="item.templateId ? 'success' : 'default'">
                {{ item.templateName }}
              </n-tag>
            </div>
          </div>
        </n-card>
        <div v-if="filteredAccountTemplates.length === 0" class="template-empty-state">
          暂无账号数据
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
  filteredAccountTemplates: {
    type: Array,
    default: () => [],
  },
  selectedTemplateForFilter: {
    type: [String, Number, null],
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
  taskTemplates: {
    type: Array,
    default: () => [],
  },
});

const emit = defineEmits([
  "filter-account-templates",
  "update:selected-template-for-filter",
  "update:show",
]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const selectedTemplateForFilterModel = computed({
  get: () => props.selectedTemplateForFilter,
  set: (value) => emit("update:selected-template-for-filter", value),
});
</script>

<style scoped lang="scss">
.modal-w-800 {
  width: 90%;
  max-width: 800px;
}

.settings-content {
  display: flex;
  flex-direction: column;
}

.template-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  gap: 12px;
  flex-wrap: wrap;
}

.account-filter-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.account-filter-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.account-filter-select {
  width: 200px;
}

.template-list-box {
  max-height: 400px;
  overflow-y: auto;
}

.template-item-card {
  margin-bottom: 12px;
  padding: 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 8px;
  background: var(--surface-glass);
}

.template-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.template-item-title-small {
  margin: 0;
  color: var(--text-primary);
}

.template-empty-state {
  text-align: center;
  color: var(--text-tertiary);
  padding: 24px;
}

.modal-actions {
  display: flex;
}

.modal-actions-right {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
