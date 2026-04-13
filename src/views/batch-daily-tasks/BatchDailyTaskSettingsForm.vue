<template>
  <div class="settings-grid">
    <div class="setting-item">
      <label class="setting-label">竞技场阵容</label>
      <n-select
        size="small"
        :options="formationOptions"
        :value="settings.arenaFormation"
        @update:value="$emit('update-field', 'arenaFormation', $event)"
      ></n-select>
    </div>
    <div class="setting-item">
      <label class="setting-label">爬塔阵容</label>
      <n-select
        size="small"
        :options="formationOptions"
        :value="settings.towerFormation"
        @update:value="$emit('update-field', 'towerFormation', $event)"
      ></n-select>
    </div>
    <div class="setting-item">
      <label class="setting-label">BOSS阵容</label>
      <n-select
        size="small"
        :options="formationOptions"
        :value="settings.bossFormation"
        @update:value="$emit('update-field', 'bossFormation', $event)"
      ></n-select>
    </div>
    <div class="setting-item">
      <label class="setting-label">BOSS次数</label>
      <n-select
        size="small"
        :options="bossTimesOptions"
        :value="settings.bossTimes"
        @update:value="$emit('update-field', 'bossTimes', $event)"
      ></n-select>
    </div>
    <div class="setting-switches">
      <div
        v-for="field in toggleFields"
        :key="field.key"
        class="switch-row"
      >
        <span class="switch-label">{{ field.label }}</span>
        <n-switch
          :value="settings[field.key]"
          @update:value="$emit('update-field', field.key, $event)"
        ></n-switch>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  bossTimesOptions: {
    type: Array,
    default: () => [],
  },
  formationOptions: {
    type: Array,
    default: () => [],
  },
  settings: {
    type: Object,
    required: true,
  },
});

defineEmits(["update-field"]);

const toggleFields = [
  { key: "claimBottle", label: "领罐子" },
  { key: "claimHangUp", label: "领挂机" },
  { key: "arenaEnable", label: "竞技场" },
  { key: "openBox", label: "开宝箱" },
  { key: "claimEmail", label: "领取邮件奖励" },
  { key: "blackMarketPurchase", label: "黑市购买物品" },
  { key: "payRecruit", label: "付费招募" },
];
</script>

<style scoped lang="scss">
.settings-grid {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.setting-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.setting-label,
.switch-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.setting-switches {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.switch-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid var(--border-light);
}

.switch-row:last-child {
  border-bottom: none;
}
</style>
