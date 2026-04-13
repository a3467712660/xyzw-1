<template>
  <n-form-item :label="t('taskControl.settings.fields.extraTasks')">
    <n-checkbox-group
      :value="settingsForm.dailySelectedTasks"
      @update:value="updateDailySelectedTasks"
    >
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
    <NSwitch
      :value="settingsForm.dailyRunner.friendGoldEnable"
      @update:value="(value) => updateDailyRunnerField('friendGoldEnable', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.recruit')">
    <NSwitch
      :value="settingsForm.dailyRunner.recruitEnable"
      @update:value="(value) => updateDailyRunnerField('recruitEnable', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.payRecruit')">
    <NSwitch
      :value="settingsForm.dailyRunner.payRecruit"
      @update:value="(value) => updateDailyRunnerField('payRecruit', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.openBox')">
    <NSwitch
      :value="settingsForm.dailyRunner.openBox"
      @update:value="(value) => updateDailyRunnerField('openBox', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.freeFish')">
    <NSwitch
      :value="settingsForm.dailyRunner.freeFishEnable"
      @update:value="(value) => updateDailyRunnerField('freeFishEnable', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.mengjing')">
    <NSwitch
      :value="settingsForm.dailyRunner.mengjingEnable"
      @update:value="(value) => updateDailyRunnerField('mengjingEnable', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.dailyBoss')">
    <NSwitch
      :value="settingsForm.dailyRunner.dailyBossEnable"
      @update:value="(value) => updateDailyRunnerField('dailyBossEnable', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.legionBoss')">
    <NSwitch
      :value="settingsForm.dailyRunner.legionBossEnable"
      @update:value="(value) => updateDailyRunnerField('legionBossEnable', value)"
    ></NSwitch>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.legionBossTimes')">
    <n-input-number
      style="width: 100%"
      :max="4"
      :min="0"
      :value="settingsForm.dailyRunner.bossTimes"
      @update:value="(value) => updateDailyRunnerField('bossTimes', value)"
    ></n-input-number>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.legionBossFormation')">
    <n-select
      clearable
      :options="arenaFormationOptions"
      :placeholder="t('taskControl.settings.placeholders.selectLegionBossFormation')"
      :value="settingsForm.dailyRunner.legionBossFormation"
      @update:value="(value) => updateDailyRunnerField('legionBossFormation', value)"
    ></n-select>
  </n-form-item>
  <n-form-item :label="t('taskControl.settings.fields.dailyBossFormation')">
    <n-select
      clearable
      :options="arenaFormationOptions"
      :placeholder="t('taskControl.settings.placeholders.selectDailyBossFormation')"
      :value="settingsForm.dailyRunner.dailyBossFormation"
      @update:value="(value) => updateDailyRunnerField('dailyBossFormation', value)"
    ></n-select>
  </n-form-item>

  <n-divider title-placement="left">{{ t("taskControl.sections.tokenOverride") }}</n-divider>
  <n-form-item :label="t('taskControl.settings.fields.selectAccount')">
    <n-select
      clearable
      filterable
      :options="tokenOptions"
      :placeholder="t('taskControl.settings.placeholders.selectAccountOverride')"
      :value="settingsForm.dailyRunnerEditorTokenId"
      @update:value="onDailyRunnerEditorTokenChange"
    ></n-select>
  </n-form-item>

  <template v-if="settingsForm.dailyRunnerEditorTokenId && currentDailyRunnerOverride">
    <n-form-item :label="t('taskControl.settings.fields.friendGold')">
      <NSwitch
        :value="getDailyRunnerTokenValue('friendGoldEnable')"
        @update:value="(value) => updateDailyRunnerTokenField('friendGoldEnable', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.recruit')">
      <NSwitch
        :value="getDailyRunnerTokenValue('recruitEnable')"
        @update:value="(value) => updateDailyRunnerTokenField('recruitEnable', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.payRecruit')">
      <NSwitch
        :value="getDailyRunnerTokenValue('payRecruit')"
        @update:value="(value) => updateDailyRunnerTokenField('payRecruit', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.openBox')">
      <NSwitch
        :value="getDailyRunnerTokenValue('openBox')"
        @update:value="(value) => updateDailyRunnerTokenField('openBox', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.freeFish')">
      <NSwitch
        :value="getDailyRunnerTokenValue('freeFishEnable')"
        @update:value="(value) => updateDailyRunnerTokenField('freeFishEnable', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.mengjing')">
      <NSwitch
        :value="getDailyRunnerTokenValue('mengjingEnable')"
        @update:value="(value) => updateDailyRunnerTokenField('mengjingEnable', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.dailyBoss')">
      <NSwitch
        :value="getDailyRunnerTokenValue('dailyBossEnable')"
        @update:value="(value) => updateDailyRunnerTokenField('dailyBossEnable', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.legionBoss')">
      <NSwitch
        :value="getDailyRunnerTokenValue('legionBossEnable')"
        @update:value="(value) => updateDailyRunnerTokenField('legionBossEnable', value)"
      ></NSwitch>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.legionBossTimes')">
      <n-input-number
        style="width: 100%"
        :max="4"
        :min="0"
        :value="getDailyRunnerTokenValue('bossTimes')"
        @update:value="(value) => updateDailyRunnerTokenField('bossTimes', value)"
      ></n-input-number>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.legionBossFormation')">
      <n-select
        clearable
        :options="arenaFormationOptions"
        :placeholder="t('taskControl.settings.placeholders.selectLegionBossFormation')"
        :value="getDailyRunnerTokenValue('legionBossFormation')"
        @update:value="(value) => updateDailyRunnerTokenField('legionBossFormation', value)"
      ></n-select>
    </n-form-item>
    <n-form-item :label="t('taskControl.settings.fields.dailyBossFormation')">
      <n-select
        clearable
        :options="arenaFormationOptions"
        :placeholder="t('taskControl.settings.placeholders.selectDailyBossFormation')"
        :value="getDailyRunnerTokenValue('dailyBossFormation')"
        @update:value="(value) => updateDailyRunnerTokenField('dailyBossFormation', value)"
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
import { computed } from "vue";

const props = defineProps({
  t: { type: Function, required: true },
  settingsForm: { type: Object, required: true },
  dailySelectableOptions: { type: Array, required: true },
  arenaFormationOptions: { type: Array, required: true },
  tokenOptions: { type: Array, required: true },
  onDailyRunnerEditorTokenChange: { type: Function, required: true },
  clearDailyRunnerOverride: { type: Function, required: true },
  updateSettingsForm: { type: Function, required: true },
});

const currentDailyRunnerOverride = computed(() => {
  const tokenId = String(props.settingsForm.dailyRunnerEditorTokenId || "").trim();
  if (!tokenId) {
    return null;
  }
  return props.settingsForm.dailyRunnerByToken?.[tokenId] || null;
});

const updateDailySelectedTasks = (value) => {
  props.updateSettingsForm((current) => ({
    ...current,
    dailySelectedTasks: value,
  }));
};

const updateDailyRunnerField = (field, value) => {
  props.updateSettingsForm((current) => ({
    ...current,
    dailyRunner: {
      ...current.dailyRunner,
      [field]: value,
    },
  }));
};

const updateDailyRunnerTokenField = (field, value) => {
  const tokenId = String(props.settingsForm.dailyRunnerEditorTokenId || "").trim();
  if (!tokenId) {
    return;
  }

  props.updateSettingsForm((current) => {
    const dailyRunnerByToken = current.dailyRunnerByToken && typeof current.dailyRunnerByToken === "object"
      ? { ...current.dailyRunnerByToken }
      : {};

    dailyRunnerByToken[tokenId] = {
      ...current.dailyRunner,
      ...dailyRunnerByToken[tokenId],
      [field]: value,
    };

    return {
      ...current,
      dailyRunnerByToken,
    };
  });
};

const getDailyRunnerTokenValue = (field) => currentDailyRunnerOverride.value?.[field];
</script>
