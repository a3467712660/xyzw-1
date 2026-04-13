<template>
  <n-divider title-placement="left">{{ t("taskControl.sections.smartCar") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.minColor')">
    <n-select
      :options="carColorOptions"
      :placeholder="t('taskControl.settings.placeholders.minColor')"
      :value="settingsForm.smartCar.carMinColor"
      @update:value="(value) => updateSmartCarField('carMinColor', value)"
    ></n-select>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.goldFallback')">
    <NSwitch
      :value="settingsForm.smartCar.useGoldRefreshFallback"
      @update:value="(value) => updateSmartCarField('useGoldRefreshFallback', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.matchRule')">
    <n-radio-group
      :value="settingsForm.smartCar.smartDepartureMatchAll"
      @update:value="(value) => updateSmartCarField('smartDepartureMatchAll', value)"
    >
      <n-radio :value="false">{{ t("taskControl.matchModes.any") }}</n-radio>
      <n-radio :value="true">{{ t("taskControl.matchModes.all") }}</n-radio>
    </n-radio-group>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.goldThreshold')">
    <n-input-number
      style="width: 100%"
      :min="0"
      :step="100"
      :value="settingsForm.smartCar.smartDepartureGoldThreshold"
      @update:value="(value) => updateSmartCarField('smartDepartureGoldThreshold', value)"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.recruitThreshold')">
    <n-input-number
      style="width: 100%"
      :min="0"
      :step="10"
      :value="settingsForm.smartCar.smartDepartureRecruitThreshold"
      @update:value="(value) => updateSmartCarField('smartDepartureRecruitThreshold', value)"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.jadeThreshold')">
    <n-input-number
      style="width: 100%"
      :min="0"
      :step="100"
      :value="settingsForm.smartCar.smartDepartureJadeThreshold"
      @update:value="(value) => updateSmartCarField('smartDepartureJadeThreshold', value)"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.ticketThreshold')">
    <n-input-number
      style="width: 100%"
      :min="0"
      :step="1"
      :value="settingsForm.smartCar.smartDepartureTicketThreshold"
      @update:value="(value) => updateSmartCarField('smartDepartureTicketThreshold', value)"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.maxRefreshAttempts')">
    <n-input-number
      style="width: 100%"
      :max="500"
      :min="1"
      :step="1"
      :value="settingsForm.smartCar.smartDepartureMaxRefreshAttempts"
      @update:value="(value) => updateSmartCarField('smartDepartureMaxRefreshAttempts', value)"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.helperAnalysis')">
    <NSwitch
      :value="settingsForm.smartCar.helperLineupAnalysisEnabled"
      @update:value="(value) => updateSmartCarField('helperLineupAnalysisEnabled', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item
    v-if="settingsForm.smartCar.helperLineupAnalysisEnabled"
    :label="t('taskControl.settings.fields.preferredLineups')"
  >
    <n-select
      clearable
      filterable
      multiple
      :options="helperLineupKeywordOptions"
      :placeholder="t('taskControl.settings.placeholders.preferredLineups')"
      :value="settingsForm.smartCar.helperPreferredLineups"
      @update:value="(value) => updateSmartCarField('helperPreferredLineups', value)"
    ></n-select>
  </n-form-item>

  <n-divider title-placement="left">{{ t("taskControl.sections.tokenOverride") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.selectAccount')">
    <n-select
      clearable
      filterable
      :options="tokenOptions"
      :placeholder="t('taskControl.settings.placeholders.selectAccountOverride')"
      :value="settingsForm.smartCarEditorTokenId"
      @update:value="onSmartCarEditorTokenChange"
    ></n-select>
  </n-form-item>

  <template v-if="settingsForm.smartCarEditorTokenId && currentSmartCarOverride">
    <n-form-item :label="t('taskControl.settings.fields.minColor')">
      <n-select
        :options="carColorOptions"
        :placeholder="t('taskControl.settings.placeholders.minColor')"
        :value="getSmartCarTokenValue('carMinColor')"
        @update:value="(value) => updateSmartCarTokenField('carMinColor', value)"
      ></n-select>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.goldFallback')">
      <NSwitch
        :value="getSmartCarTokenValue('useGoldRefreshFallback')"
        @update:value="(value) => updateSmartCarTokenField('useGoldRefreshFallback', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.matchRule')">
      <n-radio-group
        :value="getSmartCarTokenValue('smartDepartureMatchAll')"
        @update:value="(value) => updateSmartCarTokenField('smartDepartureMatchAll', value)"
      >
        <n-radio :value="false">{{ t("taskControl.matchModes.any") }}</n-radio>
        <n-radio :value="true">{{ t("taskControl.matchModes.all") }}</n-radio>
      </n-radio-group>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.goldThreshold')">
      <n-input-number
        style="width: 100%"
        :min="0"
        :step="100"
        :value="getSmartCarTokenValue('smartDepartureGoldThreshold')"
        @update:value="(value) => updateSmartCarTokenField('smartDepartureGoldThreshold', value)"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.recruitThreshold')">
      <n-input-number
        style="width: 100%"
        :min="0"
        :step="10"
        :value="getSmartCarTokenValue('smartDepartureRecruitThreshold')"
        @update:value="(value) => updateSmartCarTokenField('smartDepartureRecruitThreshold', value)"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.jadeThreshold')">
      <n-input-number
        style="width: 100%"
        :min="0"
        :step="100"
        :value="getSmartCarTokenValue('smartDepartureJadeThreshold')"
        @update:value="(value) => updateSmartCarTokenField('smartDepartureJadeThreshold', value)"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.ticketThreshold')">
      <n-input-number
        style="width: 100%"
        :min="0"
        :step="1"
        :value="getSmartCarTokenValue('smartDepartureTicketThreshold')"
        @update:value="(value) => updateSmartCarTokenField('smartDepartureTicketThreshold', value)"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.maxRefreshAttempts')">
      <n-input-number
        style="width: 100%"
        :max="500"
        :min="1"
        :step="1"
        :value="getSmartCarTokenValue('smartDepartureMaxRefreshAttempts')"
        @update:value="(value) => updateSmartCarTokenField('smartDepartureMaxRefreshAttempts', value)"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.helperAnalysis')">
      <NSwitch
        :value="getSmartCarTokenValue('helperLineupAnalysisEnabled')"
        @update:value="(value) => updateSmartCarTokenField('helperLineupAnalysisEnabled', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item
      v-if="getSmartCarTokenValue('helperLineupAnalysisEnabled')"
      :label="t('taskControl.settings.fields.preferredLineups')"
    >
      <n-select
        clearable
        filterable
        multiple
        :options="helperLineupKeywordOptions"
        :placeholder="t('taskControl.settings.placeholders.preferredLineups')"
        :value="getSmartCarTokenValue('helperPreferredLineups')"
        @update:value="(value) => updateSmartCarTokenField('helperPreferredLineups', value)"
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
import { computed } from "vue";

const props = defineProps({
  t: { type: Function, required: true },
  settingsForm: { type: Object, required: true },
  carColorOptions: { type: Array, required: true },
  helperLineupKeywordOptions: { type: Array, required: true },
  tokenOptions: { type: Array, required: true },
  onSmartCarEditorTokenChange: { type: Function, required: true },
  clearSmartCarOverride: { type: Function, required: true },
  updateSettingsForm: { type: Function, required: true },
});

const currentSmartCarOverride = computed(() => {
  const tokenId = String(props.settingsForm.smartCarEditorTokenId || "").trim();
  if (!tokenId) {
    return null;
  }
  return props.settingsForm.smartCarByToken?.[tokenId] || null;
});

const updateSmartCarField = (field, value) => {
  props.updateSettingsForm((current) => ({
    ...current,
    smartCar: {
      ...current.smartCar,
      [field]: value,
    },
  }));
};

const updateSmartCarTokenField = (field, value) => {
  const tokenId = String(props.settingsForm.smartCarEditorTokenId || "").trim();
  if (!tokenId) {
    return;
  }

  props.updateSettingsForm((current) => {
    const smartCarByToken = current.smartCarByToken && typeof current.smartCarByToken === "object"
      ? { ...current.smartCarByToken }
      : {};

    smartCarByToken[tokenId] = {
      ...current.smartCar,
      ...smartCarByToken[tokenId],
      [field]: value,
    };

    return {
      ...current,
      smartCarByToken,
    };
  });
};

const getSmartCarTokenValue = (field) => currentSmartCarOverride.value?.[field];
</script>
