<template>
  <n-modal
    class="modal-w-800"
    preset="card"
    title="月赛助威"
    v-model:show="showModel"
  >
    <div class="settings-content">
      <div class="settings-grid settings-grid-block">
        <div class="war-guess-toolbar">
          <span class="war-guess-label">拍手器:</span>
          <n-input-number
            class="input-w-120"
            placeholder="拍手器"
            v-model:value="warGuessCoinModel"
            :max="20"
            :min="1"
          ></n-input-number>
          <n-button
            type="primary"
            :disabled="!selectedWarGuessLegionId || isRunning"
            @click="$emit('cheer')"
          >
            助威
          </n-button>
          <n-button :loading="warGuessLoading" @click="$emit('refresh')">
            刷新数据
          </n-button>
        </div>

        <n-data-table
          flex-height
          class="war-guess-table"
          :checked-row-keys="selectedWarGuessLegionId ? [selectedWarGuessLegionId] : []"
          :columns="warGuessColumns"
          :data="warGuessList"
          :loading="warGuessLoading"
          :row-key="(row) => row.id"
          :row-props="warGuessRowProps"
          @update:checked-row-keys="handleCheckedRowKeys"
        ></n-data-table>
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
  isRunning: {
    type: Boolean,
    default: false,
  },
  selectedWarGuessLegionId: {
    type: [String, Number, null],
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
  warGuessCoin: {
    type: [String, Number, null],
    default: null,
  },
  warGuessColumns: {
    type: Array,
    default: () => [],
  },
  warGuessList: {
    type: Array,
    default: () => [],
  },
  warGuessLoading: {
    type: Boolean,
    default: false,
  },
  warGuessRowProps: {
    type: Function,
    required: true,
  },
});

const emit = defineEmits([
  "cheer",
  "refresh",
  "update:selected-war-guess-legion-id",
  "update:show",
  "update:war-guess-coin",
]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const warGuessCoinModel = computed({
  get: () => props.warGuessCoin,
  set: (value) => emit("update:war-guess-coin", value),
});

const handleCheckedRowKeys = (keys) => {
  emit("update:selected-war-guess-legion-id", keys[0] || null);
};
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

.settings-grid-block {
  display: block;
}

.input-w-120 {
  width: 120px;
}

.war-guess-toolbar {
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.war-guess-label {
  font-size: 16px;
}

.war-guess-table {
  height: 400px;
  flex: 1;
}

.modal-actions {
  display: flex;
}

.modal-actions-right {
  margin-top: 20px;
  justify-content: flex-end;
}
</style>
