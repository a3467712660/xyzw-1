<template>
  <n-modal
    class="modal-w-800"
    preset="card"
    title="任务模板管理"
    v-model:show="showModel"
  >
    <div class="settings-content">
      <div class="template-header-row">
        <div class="template-header-actions">
          <n-button type="primary" @click="$emit('open-new-template')">
            新增模板
          </n-button>
          <n-button class="btn-ml" type="success" @click="$emit('open-apply-template')">
            应用模板
          </n-button>
          <n-button class="btn-ml" type="info" @click="$emit('open-account-template')">
            查看账号模板引用
          </n-button>
        </div>
        <n-input
          class="template-search-input"
          placeholder="搜索模板"
          size="small"
          v-model:value="searchKeyword"
        ></n-input>
      </div>

      <div class="template-list template-list-box">
        <n-card
          v-for="template in visibleTemplates"
          :key="template.id"
          class="template-item-card"
          size="small"
        >
          <div class="template-item-row">
            <div>
              <h4 class="template-item-title">
                {{ template.name }}
              </h4>
              <div class="template-item-meta">
                创建时间: {{ new Date(template.createdAt).toLocaleString() }}
                <span v-if="template.updatedAt">
                  , 更新时间: {{ new Date(template.updatedAt).toLocaleString() }}
                </span>
              </div>
            </div>
            <div class="template-item-actions">
              <n-button size="small" @click="$emit('edit-template', template)">
                编辑
              </n-button>
              <n-button size="small" type="error" @click="$emit('delete-template', template.id)">
                删除
              </n-button>
            </div>
          </div>
        </n-card>
        <div v-if="visibleTemplates.length === 0" class="template-empty-state">
          暂无模板
        </div>
      </div>

      <div class="modal-actions modal-actions-right">
        <n-button @click="showModel = false">关闭</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { computed, ref } from "vue";

const props = defineProps({
  filteredTaskTemplates: {
    type: Array,
    default: () => [],
  },
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "delete-template",
  "edit-template",
  "open-account-template",
  "open-apply-template",
  "open-new-template",
  "update:show",
]);

const searchKeyword = ref("");

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const visibleTemplates = computed(() => {
  const keyword = String(searchKeyword.value || "").trim().toLowerCase();
  if (!keyword) {
    return props.filteredTaskTemplates;
  }
  return props.filteredTaskTemplates.filter((template) =>
    String(template?.name || "").toLowerCase().includes(keyword),
  );
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

.template-header-actions {
  display: flex;
  align-items: center;
}

.btn-ml {
  margin-left: 12px;
}

.template-search-input {
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

.template-item-title {
  margin: 0 0 4px 0;
  color: var(--text-primary);
}

.template-item-meta {
  color: var(--text-tertiary);
  font-size: 12px;
}

.template-item-actions {
  display: flex;
  gap: 8px;
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
