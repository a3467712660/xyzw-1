<template>
  <n-form-item :label="t('taskControl.settings.fields.extraTasks')">
    <n-checkbox-group v-model:value="settingsForm.dailySelectedTasks">
      <n-space wrap>
        <n-checkbox
          v-for="option in dailySelectableOptions"
          :key="option.value"
          :value="option.value"
        >
          {{ option.label }}
        </n-checkbox>
      </n-space>
    </n-checkbox-group>
  </n-form-item>

  <n-divider title-placement="left">{{ t("taskControl.sections.dailyRunner") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.friendGold')">
    <NSwitch v-model:value="settingsForm.dailyRunner.friendGoldEnable"></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.recruit')">
    <NSwitch v-model:value="settingsForm.dailyRunner.recruitEnable"></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.payRecruit')">
    <NSwitch v-model:value="settingsForm.dailyRunner.payRecruit"></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.openBox')">
    <NSwitch v-model:value="settingsForm.dailyRunner.openBox"></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.freeFish')">
    <NSwitch v-model:value="settingsForm.dailyRunner.freeFishEnable"></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.mengjing')">
    <NSwitch v-model:value="settingsForm.dailyRunner.mengjingEnable"></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.dailyBoss')">
    <NSwitch v-model:value="settingsForm.dailyRunner.dailyBossEnable"></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.legionBoss')">
    <NSwitch v-model:value="settingsForm.dailyRunner.legionBossEnable"></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.legionBossTimes')">
    <n-input-number
      style="width: 100%"
      v-model:value="settingsForm.dailyRunner.bossTimes"
      :max="4"
      :min="0"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.legionBossFormation')">
    <n-select
      clearable
      v-model:value="settingsForm.dailyRunner.legionBossFormation"
      :options="arenaFormationOptions"
      :placeholder="t('taskControl.settings.placeholders.selectLegionBossFormation')"
    ></n-select>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.dailyBossFormation')">
    <n-select
      clearable
      v-model:value="settingsForm.dailyRunner.dailyBossFormation"
      :options="arenaFormationOptions"
      :placeholder="t('taskControl.settings.placeholders.selectDailyBossFormation')"
    ></n-select>
  </n-form-item>

  <n-divider title-placement="left">{{ t("taskControl.sections.tokenOverride") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.selectAccount')">
    <n-select
      clearable
      filterable
      v-model:value="settingsForm.dailyRunnerEditorTokenId"
      :options="tokenOptions"
      :placeholder="t('taskControl.settings.placeholders.selectAccountOverride')"
      @update:value="onDailyRunnerEditorTokenChange"
    ></n-select>
  </n-form-item>

  <template v-if="settingsForm.dailyRunnerEditorTokenId">
    <n-form-item :label="t('taskControl.settings.fields.friendGold')">
      <NSwitch v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].friendGoldEnable"></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.recruit')">
      <NSwitch v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].recruitEnable"></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.payRecruit')">
      <NSwitch v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].payRecruit"></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.openBox')">
      <NSwitch v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].openBox"></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.freeFish')">
      <NSwitch v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].freeFishEnable"></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.mengjing')">
      <NSwitch v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].mengjingEnable"></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.dailyBoss')">
      <NSwitch v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].dailyBossEnable"></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.legionBoss')">
      <NSwitch v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].legionBossEnable"></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.legionBossTimes')">
      <n-input-number
        style="width: 100%"
        v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].bossTimes"
        :max="4"
        :min="0"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.legionBossFormation')">
      <n-select
        clearable
        v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].legionBossFormation"
        :options="arenaFormationOptions"
        :placeholder="t('taskControl.settings.placeholders.selectLegionBossFormation')"
      ></n-select>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.dailyBossFormation')">
      <n-select
        clearable
        v-model:value="settingsForm.dailyRunnerByToken[settingsForm.dailyRunnerEditorTokenId].dailyBossFormation"
        :options="arenaFormationOptions"
        :placeholder="t('taskControl.settings.placeholders.selectDailyBossFormation')"
      ></n-select>
    </n-form-item>
    <n-form-item>
      <NButton
        secondary
        size="small"
        @click="clearDailyRunnerOverride(settingsForm.dailyRunnerEditorTokenId)"
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
  dailySelectableOptions: { type: Array, required: true },
  arenaFormationOptions: { type: Array, required: true },
  tokenOptions: { type: Array, required: true },
  onDailyRunnerEditorTokenChange: { type: Function, required: true },
  clearDailyRunnerOverride: { type: Function, required: true },
});
</script>
