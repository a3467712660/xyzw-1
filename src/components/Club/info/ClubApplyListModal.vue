<template>
  <NModal
    class="modal-w-700 modal-max-h-80"
    preset="card"
    :close-on-esc="true"
    :content-style="contentStyle"
    :mask-closable="true"
    :show="show"
    :show-close-button="true"
    :show-footer="false"
    :title="title"
    @update:show="$emit('update:show', $event)"
  >
    <template #header-extra>
      <NSpace size="small">
        <NButton
          size="small"
          type="primary"
          :disabled="items.length === 0"
          @click="$emit('approve-all')"
        >
          一键通过
        </NButton>
        <NButton
          size="small"
          type="error"
          :disabled="items.length === 0"
          @click="$emit('reject-all')"
        >
          一键拒绝
        </NButton>
      </NSpace>
    </template>

    <div v-if="loading" class="loading">
      <NSpin size="small"></NSpin>
      <span class="ml-8">正在加载申请列表...</span>
    </div>
    <div v-else-if="items.length === 0" class="empty-apply">
      <NEmpty description="暂无申请"></NEmpty>
    </div>
    <div v-else class="apply-list-container">
      <div class="apply-list apply-list-lg">
        <div
          v-for="item in items"
          :key="item.roleId"
          class="apply-item"
          :class="{ 'apply-item-hover': hoveredItemId === item.roleId }"
          @mouseenter="hoveredItemId = item.roleId"
          @mouseleave="hoveredItemId = null"
        >
          <div class="apply-left">
            <NAvatar :size="28" :src="item.avatar"></NAvatar>
            <div class="apply-info">
              <div class="apply-name">{{ item.nameText }}</div>
              <div class="apply-details">
                <span>{{ item.levelText }}</span>
                <span class="apply-power">{{ item.powerText }}</span>
                <span v-if="item.serverText">{{ item.serverText }}</span>
              </div>
              <div v-if="item.reasonText" class="apply-reason">
                {{ item.reasonText }}
              </div>
            </div>
          </div>
          <div class="apply-right">
            <NSpace size="small">
              <NButton size="tiny" type="primary" @click="$emit('approve', item.roleId)">
                通过
              </NButton>
              <NButton size="tiny" @click="$emit('reject', item.roleId)">
                拒绝
              </NButton>
            </NSpace>
          </div>
        </div>
      </div>
    </div>
  </NModal>
</template>

<script setup>
import { ref } from "vue";
import { NAvatar, NButton, NEmpty, NModal, NSpace, NSpin } from "naive-ui/es";

defineProps({
  items: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  show: Boolean,
  title: {
    type: String,
    default: "俱乐部申请列表",
  },
});

defineEmits([
  "approve",
  "approve-all",
  "reject",
  "reject-all",
  "update:show",
]);

const hoveredItemId = ref(null);
const contentStyle = {
  maxHeight: "calc(80vh - 60px)",
  overflow: "auto",
  padding: "0",
};
</script>

<style scoped lang="scss">
.modal-w-700 {
  width: min(700px, calc(100vw - 24px));
}

.modal-max-h-80 {
  max-height: 80vh;
}

.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.empty-apply {
  padding: 30px 0;
}

.apply-list-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.apply-list {
  max-height: 200px;
  overflow-y: auto;
  padding-right: 8px;
  border-radius: 8px;
  border: 1px solid var(--border-color);
  background: var(--bg-primary);
}

.apply-list-lg {
  max-height: 800px;
}

.apply-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  margin: 0;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-primary);
  cursor: pointer;
  transition: all 0.2s ease;
}

.apply-item:last-child {
  border-bottom: none;
}

.apply-item-hover {
  background: var(--bg-tertiary);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.apply-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.apply-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.apply-name {
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  color: var(--text-primary);
}

.apply-details {
  display: flex;
  gap: 12px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.apply-power {
  font-feature-settings: "tnum" 1;
  font-variant-numeric: tabular-nums;
}

.apply-reason {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  margin-top: 4px;
  word-break: break-word;
  white-space: normal;
  line-height: 1.4;
}

.apply-right {
  display: flex;
  gap: 8px;
}

.apply-list::-webkit-scrollbar {
  width: 6px;
}

.apply-list::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.apply-list::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}

.apply-list::-webkit-scrollbar-thumb:hover {
  background: var(--text-tertiary);
}

.ml-8 {
  margin-left: 8px;
}
</style>
