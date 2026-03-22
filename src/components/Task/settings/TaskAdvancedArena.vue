<template>
  <n-divider title-placement="left">{{ t("taskControl.sections.arena") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.arenaFormation')">
    <n-select
      v-model:value="settingsForm.arenaConfig.arenaFormation"
      :options="arenaFormationOptions"
      :placeholder="t('taskControl.settings.placeholders.selectArenaFormation')"
    ></n-select>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.logicMode')">
    <n-radio-group v-model:value="settingsForm.arenaConfig.mode">
      <n-radio value="batch">{{ t("taskControl.arenaModes.batch") }}</n-radio>
      <n-radio value="standalone">{{ t("taskControl.arenaModes.standalone") }}</n-radio>
    </n-radio-group>
  </n-form-item>
  <n-form-item v-if="settingsForm.arenaConfig.mode === 'standalone'" :label="t('taskControl.settings.fields.fightCount')">
    <n-input-number
      style="width: 100%"
      v-model:value="settingsForm.arenaConfig.fightCount"
      :max="10000"
      :min="1"
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
      v-model:value="settingsForm.arenaConfig.skipLineups"
      :options="arenaSkipLineupOptions"
      :placeholder="t('taskControl.settings.placeholders.skipLineups')"
    ></n-select>
  </n-form-item>
</template>

<script setup>
defineProps({
  t: { type: Function, required: true },
  settingsForm: { type: Object, required: true },
  arenaFormationOptions: { type: Array, required: true },
  arenaSkipLineupOptions: { type: Array, required: true },
});
</script>
