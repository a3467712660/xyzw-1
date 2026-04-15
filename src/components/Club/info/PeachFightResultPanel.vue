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

defineProps({
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
  margin: 15px 0;
  padding: 15px;
  background: var(--bg-secondary, #f9f9f9);
  border-radius: var(--border-radius-sm, 4px);
  border: 1px solid var(--border-light, #eee);
}

.result-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-light, #eee);
}

.result-title {
  margin: 0;
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-bold, bold);
  color: var(--text-primary, #333);
}

.result-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  gap: 10px 18px;
  font-size: var(--font-size-sm, 14px);
  width: 100%;
}

.summary-item {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  white-space: nowrap;
}

.summary-label {
  color: var(--text-secondary, #666);
}

.summary-value {
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #333);
}

.summary-value.win {
  color: var(--success-color, #52c41a);
}

.summary-value.loss {
  color: var(--error-color, #ff4d4f);
}

.result-list {
  margin-bottom: 15px;
}

.battle-result-item {
  margin-bottom: 10px;
  padding: 12px;
  background: var(--bg-primary, #fff);
  border-radius: var(--border-radius-sm, 4px);
  border: 1px solid var(--border-light, #eee);
  border-left: 4px solid var(--border-light, #eee);
  transition: all var(--transition-fast, 0.3s ease);
}

.battle-result-item.win {
  border-left-color: var(--success-color, #52c41a);
  background: rgba(82, 196, 26, 0.03);
}

.battle-result-item.loss {
  border-left-color: var(--error-color, #ff4d4f);
  background: rgba(255, 77, 79, 0.03);
}

.battle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.battle-index {
  font-size: var(--font-size-sm, 14px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #333);
}

.battle-details {
  display: flex;
  align-items: center;
  gap: 12px;
  gap: 15px;
}

.battle-side {
  display: flex;
  align-items: center;
  flex: 1;
  gap: 10px;
}

.battle-vs {
  font-size: var(--font-size-sm, 14px);
  font-weight: var(--font-weight-bold, bold);
  color: var(--text-secondary, #999);
  margin: 0 10px;
}

.side-avatar {
  flex-shrink: 0;
}

.side-info {
  flex: 1;
  font-size: var(--font-size-sm, 14px);
}

.side-name {
  display: block;
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #333);
  margin-bottom: 3px;
}

.side-power {
  display: block;
  color: var(--text-secondary, #666);
  margin-bottom: 2px;
}

.side-die {
  display: block;
  color: var(--text-secondary, #666);
  font-size: var(--font-size-xs, 12px);
}

.result-actions {
  margin-top: 15px;
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}

@media (max-width: 768px) {
  .result-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .result-summary {
    gap: 10px;
  }

  .battle-details {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .battle-side {
    width: 100%;
  }

  .battle-vs {
    align-self: center;
    margin: 5px 0;
    transform: rotate(90deg);
  }
}
</style>
