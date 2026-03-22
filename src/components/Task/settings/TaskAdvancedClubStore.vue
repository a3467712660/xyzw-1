<template>
  <n-divider title-placement="left">{{ t("taskControl.sections.clubStore") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.goodsIds')">
    <n-select
      clearable
      filterable
      multiple
      v-model:value="settingsForm.clubStore.goodsIds"
      :options="clubStoreGoodsOptions"
      :placeholder="t('taskControl.settings.placeholders.goodsIds')"
    ></n-select>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.onlyUnbought')">
    <NSwitch v-model:value="settingsForm.clubStore.onlyUnbought"></NSwitch>
  </n-form-item>
</template>

<script setup>
defineProps({
  t: { type: Function, required: true },
  settingsForm: { type: Object, required: true },
  clubStoreGoodsOptions: { type: Array, required: true },
});
</script>
