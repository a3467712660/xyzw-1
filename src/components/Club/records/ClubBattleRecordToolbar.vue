<template>
  <div class="club-battle-record-toolbar">
    <div class="toolbar-left">
      <div v-if="styleOptions.length" class="export-options">
        <NRadioGroup
          size="small"
          :value="currentStyle"
          @update:value="$emit('update:current-style', $event)"
        >
          <NRadioButton
            v-for="option in styleOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </NRadioButton>
        </NRadioGroup>
        <NCheckboxGroup
          v-if="showExportMethods"
          name="group-exportmethod"
          size="small"
          :value="exportMethods"
          @update:value="$emit('update:export-methods', $event)"
        >
          <NCheckbox
            v-for="option in exportMethodOptions"
            :key="option.value"
            :value="option.value"
          >
            {{ option.label }}
          </NCheckbox>
        </NCheckboxGroup>
      </div>
      <slot name="left-extra"></slot>
    </div>

    <div class="toolbar-right">
      <slot name="right-prefix"></slot>
      <a-date-picker
        v-if="showDatePicker"
        format="YYYY/MM/DD"
        value-format="YYYY/MM/DD"
        :default-value="queryDate"
        :disabled-date="disabledDate"
        :value="queryDate"
        @change="$emit('change-date', $event)"
        @update:value="$emit('update:query-date', $event)"
      ></a-date-picker>
      <n-button
        class="action-btn refresh-btn"
        size="small"
        :disabled="loading"
        @click="$emit('refresh')"
      >
        <template #icon>
          <n-icon>
            <Refresh></Refresh>
          </n-icon>
        </template>
        刷新
      </n-button>
      <n-button
        class="action-btn export-btn"
        size="small"
        type="primary"
        :disabled="!canExport || loading"
        @click="$emit('export')"
      >
        <template #icon>
          <n-icon>
            <Copy></Copy>
          </n-icon>
        </template>
        导出
      </n-button>
    </div>
  </div>
</template>

<script setup>
import { Copy, Refresh } from "@vicons/ionicons5";

defineProps({
  canExport: Boolean,
  currentStyle: {
    type: String,
    default: "",
  },
  disabledDate: {
    type: Function,
    default: null,
  },
  exportMethodOptions: {
    type: Array,
    default: () => [
      { label: "表格导出", value: "1" },
      { label: "图片导出", value: "2" },
    ],
  },
  exportMethods: {
    type: Array,
    default: () => [],
  },
  loading: Boolean,
  queryDate: {
    type: String,
    default: "",
  },
  showDatePicker: {
    type: Boolean,
    default: true,
  },
  showExportMethods: Boolean,
  styleOptions: {
    type: Array,
    default: () => [],
  },
});

defineEmits([
  "change-date",
  "export",
  "refresh",
  "update:current-style",
  "update:export-methods",
  "update:query-date",
]);
</script>

<style scoped lang="scss">
.club-battle-record-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}

.toolbar-left,
.toolbar-right,
.export-options {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
