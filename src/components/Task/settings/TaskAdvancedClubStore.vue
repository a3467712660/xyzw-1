<template>
  <n-divider title-placement="left">{{ t("taskControl.sections.clubStore") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.goodsIds')">
    <n-select
      clearable
      filterable
      multiple
      :options="clubStoreGoodsOptions"
      :placeholder="t('taskControl.settings.placeholders.goodsIds')"
      :value="settingsForm.clubStore.goodsIds"
      @update:value="(value) => updateClubStoreField('goodsIds', value)"
    ></n-select>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.onlyUnbought')">
    <NSwitch
      :value="settingsForm.clubStore.onlyUnbought"
      @update:value="(value) => updateClubStoreField('onlyUnbought', value)"
    ></NSwitch>
  </n-form-item>
</template>

<script setup>
const props = defineProps({
  t: { type: Function, required: true },
  settingsForm: { type: Object, required: true },
  clubStoreGoodsOptions: { type: Array, required: true },
  updateSettingsForm: { type: Function, required: true },
});

const updateClubStoreField = (field, value) => {
  props.updateSettingsForm((current) => ({
    ...current,
    clubStore: {
      ...current.clubStore,
      [field]: value,
    },
  }));
};
</script>
