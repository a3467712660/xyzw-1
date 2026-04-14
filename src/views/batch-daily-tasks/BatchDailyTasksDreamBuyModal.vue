<template>
  <n-modal
    class="modal-w-600"
    preset="card"
    title="梦境商品购买配置"
    v-model:show="showModel"
  >
    <div class="settings-content">
      <div class="settings-grid">
        <n-alert show-icon class="dream-alert" type="info">
          请勾选需要购买的商品。只会购买列表中存在的商品。
        </n-alert>

        <div class="dream-actions-row">
          <n-button size="small" type="warning" @click="$emit('select-gold-items')">
            一键勾选金币商品
          </n-button>
          <n-button size="small" @click="$emit('select-all-items')">全选所有</n-button>
          <n-button size="small" @click="$emit('clear-all-items')">清空选择</n-button>
        </div>

        <div
          v-for="(merchant, id) in merchantConfig"
          :key="id"
          class="dream-merchant-block"
        >
          <div class="dream-merchant-title">{{ merchant.name }}</div>
          <n-grid :cols="3" :x-gap="12" :y-gap="8">
            <n-grid-item v-for="(item, index) in merchant.items" :key="index">
              <n-checkbox
                :checked="dreamBuyList.includes(`${id}-${index}`)"
                :value="`${id}-${index}`"
                @update:checked="$emit('toggle-item', `${id}-${index}`, $event)"
              >
                {{ item }}
              </n-checkbox>
            </n-grid-item>
          </n-grid>
        </div>
      </div>

      <div class="modal-actions modal-actions-right">
        <n-button class="btn-mr" @click="showModel = false">取消</n-button>
        <n-button type="primary" @click="$emit('save')">保存配置</n-button>
      </div>
    </div>
  </n-modal>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  dreamBuyList: {
    type: Array,
    default: () => [],
  },
  merchantConfig: {
    type: Object,
    default: () => ({}),
  },
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "clear-all-items",
  "save",
  "select-all-items",
  "select-gold-items",
  "toggle-item",
  "update:show",
]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});
</script>

<style scoped lang="scss">
.modal-w-600 {
  width: 90%;
  max-width: 600px;
}

.settings-content,
.settings-grid {
  display: flex;
  flex-direction: column;
}

.settings-grid {
  gap: 16px;
}

.dream-alert {
  margin-bottom: 16px;
}

.dream-actions-row {
  margin-bottom: 16px;
  display: flex;
  gap: 12px;
}

.dream-merchant-block {
  margin-bottom: 16px;
  padding: 12px;
  border: 1px solid var(--surface-glass-border);
  border-radius: 8px;
  background: var(--surface-glass);
}

.dream-merchant-title {
  margin-bottom: 8px;
  font-weight: 600;
  color: var(--text-primary);
}

.btn-mr {
  margin-right: 12px;
}

.modal-actions {
  display: flex;
}

.modal-actions-right {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
