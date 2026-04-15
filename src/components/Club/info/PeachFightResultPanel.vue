<template>
  <div class="fight-result">
    <div class="result-header">
      <h4 class="result-title">{{ title }}</h4>
      <div class="result-summary">
        <div v-for="item in summaryItems" :key="item.label" class="summary-item">
          <span class="summary-label">{{ item.label }}</span>
          <span class="summary-value" :class="item.className">{{ item.value }}</span>
        </div>
      </div>
    </div>

    <div class="result-list">
      <div
        v-for="(battle, index) in battles"
        :key="index"
        class="battle-result-item"
        :class="[battle.isWin ? 'win' : 'loss']"
      >
        <div class="battle-header">
          <span class="battle-index">{{ formatBattleIndex(index) }}</span>
          <NTag size="small" :type="battle.isWin ? 'success' : 'error'">
            {{ battle.isWin ? winText : lossText }}
          </NTag>
        </div>

        <div class="battle-details">
          <div class="battle-side left-side">
            <NAvatar round class="side-avatar" :size="32" :src="battle.leftheadImg"></NAvatar>
            <div class="side-info">
              <span class="side-name">{{ battle.leftName || unknownText }}</span>
              <span class="side-power">{{ formatPowerText(battle.leftpower) }}</span>
              <span class="side-die">{{ formatDieText(battle.leftDieHero) }}</span>
            </div>
          </div>

          <div class="battle-vs">VS</div>

          <div class="battle-side right-side">
            <NAvatar round class="side-avatar" :size="32" :src="battle.rightheadImg"></NAvatar>
            <div class="side-info">
              <span class="side-name">{{ battle.rightName || unknownText }}</span>
              <span class="side-power">{{ formatPowerText(battle.rightpower) }}</span>
              <span class="side-die">{{ formatDieText(battle.rightDieHero) }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="result-actions">
      <NButton type="primary" @click="$emit('retry')">{{ retryText }}</NButton>
      <NButton @click="$emit('close')">{{ closeText }}</NButton>
    </div>
  </div>
</template>

<script setup>
import { NAvatar, NButton, NTag } from "naive-ui/es";

const props = defineProps({
  battles: {
    type: Array,
    default: () => [],
  },
  closeText: {
    type: String,
    default: "关闭结果",
  },
  formatBattleIndex: {
    type: Function,
    default: (index) => `第${index + 1}场`,
  },
  formatDieText: {
    type: Function,
    default: (count) => `掉将: ${count}`,
  },
  formatPowerText: {
    type: Function,
    default: (value) => `战力: ${value}`,
  },
  lossText: {
    type: String,
    default: "失败",
  },
  retryText: {
    type: String,
    default: "重试",
  },
  summaryItems: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: "切磋结果",
  },
  unknownText: {
    type: String,
    default: "未知",
  },
  winText: {
    type: String,
    default: "胜利",
  },
});

defineEmits(["close", "retry"]);
</script>

<style scoped lang="scss">
.fight-result {
  display: grid;
  gap: 16px;
  padding: 14px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.result-header {
  display: grid;
  gap: 12px;
}

.result-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.result-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(118px, 1fr));
  gap: 10px;
}

.summary-item {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
}

.summary-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.68);
}

.summary-value {
  font-size: 16px;
  font-weight: 700;
}

.summary-value.win {
  color: #18a058;
}

.summary-value.loss {
  color: #d03050;
}

.result-list {
  display: grid;
  gap: 12px;
}

.battle-result-item {
  display: grid;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.battle-result-item.win {
  background: rgba(24, 160, 88, 0.08);
}

.battle-result-item.loss {
  background: rgba(208, 48, 80, 0.08);
}

.battle-header,
.battle-details,
.battle-side,
.result-actions {
  display: flex;
  align-items: center;
}

.battle-header,
.result-actions {
  justify-content: space-between;
}

.battle-details {
  gap: 12px;
  justify-content: space-between;
}

.battle-side {
  flex: 1;
  gap: 10px;
  min-width: 0;
}

.battle-vs {
  font-size: 12px;
  font-weight: 700;
  opacity: 0.72;
}

.side-avatar {
  flex-shrink: 0;
}

.side-info {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.side-name {
  font-weight: 600;
}

.side-name,
.side-power,
.side-die {
  word-break: break-all;
}

.side-power,
.side-die,
.battle-index {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.68);
}

.result-actions {
  gap: 12px;
  justify-content: flex-end;
}

@media (max-width: 768px) {
  .battle-details {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
