<template>
  <n-divider title-placement="left">{{ t("taskControl.sections.smartCar") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.minColor')">
    <n-select
      v-model:value="settingsForm.smartCar.carMinColor"
      :options="carColorOptions"
      :placeholder="t('taskControl.settings.placeholders.minColor')"
    ></n-select>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.goldFallback')">
    <NSwitch v-model:value="settingsForm.smartCar.useGoldRefreshFallback"></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.matchRule')">
    <n-radio-group v-model:value="settingsForm.smartCar.smartDepartureMatchAll">
      <n-radio :value="false">{{ t("taskControl.matchModes.any") }}</n-radio>
      <n-radio :value="true">{{ t("taskControl.matchModes.all") }}</n-radio>
    </n-radio-group>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.goldThreshold')">
    <n-input-number
      style="width: 100%"
      v-model:value="settingsForm.smartCar.smartDepartureGoldThreshold"
      :min="0"
      :step="100"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.recruitThreshold')">
    <n-input-number
      style="width: 100%"
      v-model:value="settingsForm.smartCar.smartDepartureRecruitThreshold"
      :min="0"
      :step="10"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.jadeThreshold')">
    <n-input-number
      style="width: 100%"
      v-model:value="settingsForm.smartCar.smartDepartureJadeThreshold"
      :min="0"
      :step="100"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.ticketThreshold')">
    <n-input-number
      style="width: 100%"
      v-model:value="settingsForm.smartCar.smartDepartureTicketThreshold"
      :min="0"
      :step="1"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.maxRefreshAttempts')">
    <n-input-number
      style="width: 100%"
      v-model:value="settingsForm.smartCar.smartDepartureMaxRefreshAttempts"
      :max="500"
      :min="1"
      :step="1"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.helperAnalysis')">
    <NSwitch v-model:value="settingsForm.smartCar.helperLineupAnalysisEnabled"></NSwitch>
  </n-form-item>
  <n-form-item
    v-if="settingsForm.smartCar.helperLineupAnalysisEnabled"
    :label="t('taskControl.settings.fields.preferredLineups')"
  >
    <n-select
      clearable
      filterable
      multiple
      v-model:value="settingsForm.smartCar.helperPreferredLineups"
      :options="helperLineupKeywordOptions"
      :placeholder="t('taskControl.settings.placeholders.preferredLineups')"
    ></n-select>
  </n-form-item>

  <n-divider title-placement="left">{{ t("taskControl.sections.tokenOverride") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.selectAccount')">
    <n-select
      clearable
      filterable
      v-model:value="settingsForm.smartCarEditorTokenId"
      :options="tokenOptions"
      :placeholder="t('taskControl.settings.placeholders.selectAccountOverride')"
      @update:value="onSmartCarEditorTokenChange"
    ></n-select>
  </n-form-item>

  <template v-if="settingsForm.smartCarEditorTokenId">
    <n-form-item :label="t('taskControl.settings.fields.minColor')">
      <n-select
        v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].carMinColor"
        :options="carColorOptions"
        :placeholder="t('taskControl.settings.placeholders.minColor')"
      ></n-select>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.goldFallback')">
      <NSwitch v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].useGoldRefreshFallback"></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.matchRule')">
      <n-radio-group v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].smartDepartureMatchAll">
        <n-radio :value="false">{{ t("taskControl.matchModes.any") }}</n-radio>
        <n-radio :value="true">{{ t("taskControl.matchModes.all") }}</n-radio>
      </n-radio-group>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.goldThreshold')">
      <n-input-number
        style="width: 100%"
        v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].smartDepartureGoldThreshold"
        :min="0"
        :step="100"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.recruitThreshold')">
      <n-input-number
        style="width: 100%"
        v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].smartDepartureRecruitThreshold"
        :min="0"
        :step="10"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.jadeThreshold')">
      <n-input-number
        style="width: 100%"
        v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].smartDepartureJadeThreshold"
        :min="0"
        :step="100"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.ticketThreshold')">
      <n-input-number
        style="width: 100%"
        v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].smartDepartureTicketThreshold"
        :min="0"
        :step="1"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.maxRefreshAttempts')">
      <n-input-number
        style="width: 100%"
        v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].smartDepartureMaxRefreshAttempts"
        :max="500"
        :min="1"
        :step="1"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.helperAnalysis')">
      <NSwitch v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].helperLineupAnalysisEnabled"></NSwitch>
    </n-form-item>
    <n-form-item
      v-if="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].helperLineupAnalysisEnabled"
      :label="t('taskControl.settings.fields.preferredLineups')"
    >
      <n-select
        clearable
        filterable
        multiple
        v-model:value="settingsForm.smartCarByToken[settingsForm.smartCarEditorTokenId].helperPreferredLineups"
        :options="helperLineupKeywordOptions"
        :placeholder="t('taskControl.settings.placeholders.preferredLineups')"
      ></n-select>
    </n-form-item>
    <n-form-item>
      <NButton
        secondary
        size="small"
        @click="clearSmartCarOverride(settingsForm.smartCarEditorTokenId)"
      >
        {{ t("taskControl.actions.clearAccountOverride") }}
      </NButton>
    </n-form-item>
  </template>
</template>

<script setup>
defineProps({
  t: { type: Function, required: true },
  settingsForm: { type: Object, required: true },
  carColorOptions: { type: Array, required: true },
  helperLineupKeywordOptions: { type: Array, required: true },
  tokenOptions: { type: Array, required: true },
  onSmartCarEditorTokenChange: { type: Function, required: true },
  clearSmartCarOverride: { type: Function, required: true },
});
</script>
