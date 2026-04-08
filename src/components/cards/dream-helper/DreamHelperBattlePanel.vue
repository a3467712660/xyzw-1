<template>
  <div class="dream-helper-battle-panel gwb2-mini-card__stack">
    <div class="gwb2-mini-card__section-title">
      {{ title }}
    </div>

    <div v-if="teamHeroes.length > 0" class="gwb2-mini-card__list battle-hero-list">
      <div
        v-for="hero in teamHeroes"
        :key="hero.id"
        class="battle-hero-card"
      >
        <div class="battle-hero-card__copy">
          <div
            class="battle-hero-card__name"
            :style="{ color: getTypeColor(hero.type) }"
          >
            {{ hero.name }}
          </div>
          <div class="battle-hero-card__meta">
            {{ hero.type }}
          </div>
        </div>
        <n-button
          size="small"
          :disabled="isBusy && !continuousBattles[hero.id]"
          :type="continuousBattles[hero.id] ? 'warning' : 'primary'"
          @click="$emit('toggle-battle', hero.id)"
        >
          {{
            continuousBattles[hero.id]
              ? "停止战斗"
              : "连续战斗"
          }}
        </n-button>
      </div>
    </div>
    <div v-else class="gwb2-mini-card__empty battle-empty">
      {{ emptyText }}
    </div>

    <div class="gwb2-mini-card__action-rail battle-actions">
      <n-button
        size="small"
        type="primary"
        :disabled="isBusy"
        @click="$emit('get-team')"
      >
        获取队伍
      </n-button>
      <n-button
        size="small"
        type="primary"
        :disabled="isBusy || teamHeroes.length === 0"
        @click="$emit('select-lineup')"
      >
        选择阵容
      </n-button>
      <n-button
        size="small"
        :disabled="activeBattleCount === 0"
        @click="$emit('stop-all')"
      >
        停止全部
      </n-button>
    </div>
  </div>
</template>

<script setup>
defineProps({
  activeBattleCount: {
    type: Number,
    default: 0,
  },
  continuousBattles: {
    type: Object,
    default: () => ({}),
  },
  emptyText: {
    type: String,
    default: "请先获取默认队伍",
  },
  isBusy: {
    type: Boolean,
    default: false,
  },
  teamHeroes: {
    type: Array,
    default: () => [],
  },
  title: {
    type: String,
    default: "当前队伍",
  },
});

defineEmits([
  "get-team",
  "select-lineup",
  "stop-all",
  "toggle-battle",
]);

function getTypeColor(type) {
  const colorMap = {
    魏国: "#3b82f6",
    吴国: "#f59e0b",
    群雄: "#ef4444",
    蜀国: "#10b981",
  };
  return colorMap[type] || "#8b5cf6";
}
</script>

<style scoped lang="scss">
.battle-hero-list {
  gap: var(--spacing-sm);
}

.battle-hero-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  min-width: 0;
  padding: 10px 0;
  border-bottom: 1px solid rgba(78, 94, 116, 0.1);
}

.battle-hero-card:last-child {
  border-bottom: none;
}

.battle-hero-card__copy {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}

.battle-hero-card__name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
}

.battle-hero-card__meta {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.battle-empty {
  min-height: 96px;
  align-items: center;
  justify-content: center;
}

@media (max-width: 959px) {
  .battle-hero-card {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
