<template>
  <n-divider title-placement="left">{{ t("taskControl.sections.arena") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.arenaFormation')">
    <n-select
      :options="arenaFormationOptions"
      :placeholder="t('taskControl.settings.placeholders.selectArenaFormation')"
      :value="settingsForm.arenaConfig.arenaFormation"
      @update:value="(value) => updateArenaConfigField('arenaFormation', value)"
    ></n-select>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.logicMode')">
    <n-radio-group
      :value="settingsForm.arenaConfig.mode"
      @update:value="(value) => updateArenaConfigField('mode', value)"
    >
      <n-radio value="batch">{{ t("taskControl.arenaModes.batch") }}</n-radio>
      <n-radio value="standalone">{{ t("taskControl.arenaModes.standalone") }}</n-radio>
    </n-radio-group>
  </n-form-item>
  <n-form-item
    v-if="settingsForm.arenaConfig.mode === 'standalone'"
    :label="t('taskControl.settings.fields.fightCount')"
  >
    <n-input-number
      style="width: 100%"
      :max="10000"
      :min="1"
      :value="settingsForm.arenaConfig.fightCount"
      @update:value="(value) => updateArenaConfigField('fightCount', value)"
    ></n-input-number>
  </n-form-item>
  <n-form-item
    v-if="settingsForm.arenaConfig.mode === 'standalone'"
    :label="t('taskControl.settings.fields.skipLineups')"
  >
    <n-select
      clearable
      filterable
      multiple
      :options="arenaSkipLineupOptions"
      :placeholder="t('taskControl.settings.placeholders.skipLineups')"
      :value="settingsForm.arenaConfig.skipLineups"
      @update:value="(value) => updateArenaConfigField('skipLineups', value)"
    ></n-select>
  </n-form-item>
</template>

<script setup>
const props = defineProps({
  t: { type: Function, required: true },
  settingsForm: { type: Object, required: true },
  arenaFormationOptions: { type: Array, required: true },
  arenaSkipLineupOptions: { type: Array, required: true },
  updateSettingsForm: { type: Function, required: true },
});

const updateArenaConfigField = (field, value) => {
  props.updateSettingsForm((current) => ({
    ...current,
    arenaConfig: {
      ...current.arenaConfig,
      [field]: value,
    },
  }));
};
</script>
