<template>
  <NModal
    class="club-rank-modal modal-w-800"
    preset="card"
    title="对手信息"
    v-model:show="showModel"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }"
    :show-close="false"
  >
    <template #header-extra>
      <span v-if="playerInfo" class="player-id">ID: {{ playerInfo.id }}</span>
    </template>

    <div v-if="playerInfo" class="player-info-content">
      <div class="player-info-main">
        <NAvatar
          round
          class="player-avatar"
          :size="60"
          :src="playerInfo.headImg"
        ></NAvatar>
        <div class="player-info-detail">
          <h3 class="player-name-row">
            <span class="player-name">{{ playerInfo.name }}</span>
            <NTag
              v-if="playerInfo.lineupType && lineupTagColor"
              class="player-lineup-tag"
              size="small"
              :bordered="false"
              :color="lineupTagColor"
            >
              {{ playerInfo.lineupType }}
            </NTag>
            <NTag
              v-if="playerInfo.legacy > 0"
              class="legacy-tag"
              size="small"
              :style="{ '--legacy-bg': legacycolor[playerInfo.legacy]?.value }"
            >
              {{ legacycolor[playerInfo.legacy]?.name || "未知" }}
            </NTag>
          </h3>
          <p>
            区服: {{ playerInfo.serverName || "未知" }} | 战力:
            {{ formatPower(playerInfo.power) }}
          </p>
          <p>俱乐部: {{ playerInfo.legionName || "无" }}</p>
          <p>
            总红数: {{ playerInfo.totalRedCount || 0 }} | 总开孔数:
            {{ playerInfo.totalHoleCount || 0 }} | 四圣数:
            {{ playerInfo.holyBeast || 0 }}
          </p>
        </div>
      </div>

      <div class="action-section">
        <div class="fight-inline">
          <div class="fight-count-container">
            <label class="fight-count-label" for="fightCount">切磋次数:</label>
            <NInput
              id="fightCount"
              class="fight-count-input"
              max="100"
              min="1"
              placeholder="请输入切磋次数"
              size="small"
              type="number"
              v-model:value="fightCountModel"
              :step="1"
              @input="$emit('validate-fight-count', $event)"
            ></NInput>
            <div class="fight-count-hint">范围: 1-100</div>
          </div>
          <NButton
            class="mr-8"
            size="small"
            type="tertiary"
            @click="showModel = false"
          >
            关闭
          </NButton>
        </div>
        <NButton
          type="primary"
          :disabled="!isFightCountValid"
          @click="$emit('start-duel')"
        >
          切磋
        </NButton>
      </div>

      <div v-if="fightProgress.visible" class="fight-progress">
        <div class="progress-info">
          <div class="progress-title">切磋进行中</div>
          <div class="progress-stats">
            <span>总次数: {{ fightProgress.totalCount }}</span>
            <span>已完成: {{ fightProgress.completedCount }}</span>
            <span>剩余: {{ fightProgress.remainingCount }}</span>
            <span>胜: {{ fightProgress.winCount }}</span>
            <span>负: {{ fightProgress.lossCount }}</span>
          </div>
        </div>
        <NProgress
          status="processing"
          type="line"
          :percentage="fightProgress.percentage"
          :show-indicator="false"
          :stroke-width="8"
        ></NProgress>
      </div>

      <div v-if="fightResult.visible" class="fight-result">
        <div class="result-header">
          <h4 class="result-title">切磋结果</h4>
          <div class="result-summary">
            <div class="summary-item">
              <span class="summary-label">总次数：</span>
              <span class="summary-value">{{ fightResult.totalCount }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">胜：</span>
              <span class="summary-value win">{{ fightResult.winCount }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">负：</span>
              <span class="summary-value loss">{{ fightResult.lossCount }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">胜率：</span>
              <span class="summary-value">{{
                formatPercent(fightResult.winCount, fightResult.totalCount)
              }}%</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">我方掉将率：</span>
              <span class="summary-value">{{
                formatPercent(dieStats.ourDieHeroGameCount, fightResult.totalCount)
              }}%</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">敌方掉将率：</span>
              <span class="summary-value">{{
                formatPercent(dieStats.enemyDieHeroGameCount, fightResult.totalCount)
              }}%</span>
            </div>
          </div>
        </div>

        <div class="result-list">
          <div
            v-for="(battle, index) in fightResult.resultCount"
            :key="index"
            class="battle-result-item"
            :class="[battle.isWin ? 'win' : 'loss']"
          >
            <div class="battle-header">
              <span class="battle-index">第 {{ index + 1 }} 场</span>
              <NTag size="small" :type="battle.isWin ? 'success' : 'error'">
                {{ battle.isWin ? "胜利" : "失败" }}
              </NTag>
            </div>

            <div class="battle-details">
              <div class="battle-side left-side">
                <NAvatar
                  round
                  class="side-avatar"
                  :size="32"
                  :src="battle.leftheadImg"
                ></NAvatar>
                <div class="side-info">
                  <span class="side-name">{{ battle.leftName || "未知" }}</span>
                  <span class="side-power">战力: {{ battle.leftpower }}</span>
                  <span class="side-die">掉将: {{ battle.leftDieHero }} 个</span>
                </div>
              </div>

              <div class="battle-vs">VS</div>

              <div class="battle-side right-side">
                <NAvatar
                  round
                  class="side-avatar"
                  :size="32"
                  :src="battle.rightheadImg"
                ></NAvatar>
                <div class="side-info">
                  <span class="side-name">{{ battle.rightName || "未知" }}</span>
                  <span class="side-power">战力: {{ battle.rightpower }}</span>
                  <span class="side-die">掉将: {{ battle.rightDieHero }} 个</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="result-actions">
          <NButton type="primary" @click="$emit('reset-fight')">重新切磋</NButton>
          <NButton @click="$emit('hide-result')">关闭结果</NButton>
        </div>
      </div>

      <div class="player-heroes">
        <h4>武将阵容</h4>
        <div v-if="playerInfo.heroList" class="debug-info debug-info-bottom">
          武将数量: {{ playerInfo.heroList.length }}
        </div>
        <div
          v-if="playerInfo.heroList && playerInfo.heroList.length > 0"
          class="hero-list"
        >
          <div
            v-for="(hero, index) in playerInfo.heroList"
            :key="hero.heroId || index"
            class="hero-item"
            @click="$emit('select-hero', hero)"
          >
            <NAvatar
              round
              class="cursor-pointer"
              :size="40"
              :src="hero.heroAvate"
            ></NAvatar>
            <div class="hero-info">
              <span class="hero-name">{{ hero.heroName }}</span>
              <div class="hero-stats">
                <span>战力: {{ formatPower(hero.power || 0) }}</span>
                <span>星级: {{ hero.star || 0 }}</span>
                <span>红数: {{ hero.red || 0 }}</span>
                <span>开孔: {{ hero.hole || 0 }}</span>
                <span :class="hero.HolyBeast ? 'opened' : 'closed'">
                  {{ hero.HolyBeast ? "已开四圣" : "未开四圣" }}
                </span>
                <span v-if="hero.HolyBeast">四圣等级: {{ hero.HBlevel || 0 }}</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-heroes">
          <p>未查询到武将信息</p>
          <div v-if="playerInfo.heroList" class="debug-info debug-info-top">
            武将列表为空
          </div>
          <div v-else class="debug-info debug-info-top">武将列表未定义</div>
        </div>
      </div>
    </div>
  </NModal>
</template>

<script setup>
import { computed } from "vue";
import { NAvatar, NButton, NInput, NModal, NProgress, NTag } from "naive-ui/es";

const props = defineProps({
  dieStats: {
    type: Object,
    required: true,
  },
  fightCount: {
    type: [Number, String],
    default: 1,
  },
  fightProgress: {
    type: Object,
    required: true,
  },
  fightResult: {
    type: Object,
    required: true,
  },
  formatPower: {
    type: Function,
    required: true,
  },
  isFightCountValid: {
    type: Boolean,
    default: true,
  },
  legacycolor: {
    type: Object,
    required: true,
  },
  lineupTagColor: {
    type: Object,
    default: null,
  },
  playerInfo: {
    type: Object,
    default: null,
  },
  show: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits([
  "hide-result",
  "reset-fight",
  "select-hero",
  "start-duel",
  "update:fightCount",
  "update:show",
  "validate-fight-count",
]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});

const fightCountModel = computed({
  get: () => props.fightCount,
  set: (value) => emit("update:fightCount", value),
});

const formatPercent = (value, total) => {
  if (!total) {
    return "0.00";
  }
  return ((Number(value || 0) / Number(total)) * 100).toFixed(2);
};
</script>

<style scoped lang="scss">
.modal-w-800 {
  width: min(800px, calc(100vw - 24px));
}

.player-info-content {
  display: grid;
  gap: 20px;
}

.player-info-main {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.player-avatar {
  flex-shrink: 0;
}

.player-info-detail {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.player-name-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.player-lineup-tag {
  margin-left: 4px;
}

.legacy-tag {
  margin-left: 4px;
  background: var(--legacy-bg, #666);
  color: #fff;
}

.action-section {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.fight-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fight-count-container {
  display: grid;
  gap: 4px;
}

.fight-count-label {
  font-size: 12px;
}

.fight-count-input {
  width: 120px;
}

.fight-count-hint {
  font-size: 12px;
  color: var(--n-text-color-3);
}

.mr-8 {
  margin-right: 8px;
}

.fight-progress,
.fight-result {
  display: grid;
  gap: 12px;
}

.progress-info,
.result-header {
  display: grid;
  gap: 8px;
}

.progress-stats,
.result-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.summary-item {
  display: flex;
  gap: 4px;
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
  border-radius: 12px;
  padding: 12px;
  border: 1px solid var(--n-border-color);
}

.battle-result-item.win {
  background: rgba(24, 160, 88, 0.08);
}

.battle-result-item.loss {
  background: rgba(208, 48, 80, 0.08);
}

.battle-header,
.battle-details,
.result-actions {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.battle-side {
  display: flex;
  gap: 10px;
  align-items: center;
}

.side-info {
  display: grid;
  gap: 2px;
}

.player-heroes {
  display: grid;
  gap: 12px;
}

.hero-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.hero-item {
  display: flex;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--n-border-color);
  border-radius: 12px;
  padding: 12px;
  cursor: pointer;
}

.hero-item:hover {
  border-color: var(--n-primary-color);
}

.hero-info,
.hero-stats {
  display: grid;
  gap: 4px;
}

.opened {
  color: #18a058;
}

.closed {
  color: #d03050;
}

.debug-info {
  font-size: 12px;
  color: var(--n-text-color-3);
}

@media (max-width: 768px) {
  .player-info-main,
  .action-section,
  .battle-details,
  .result-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .fight-inline {
    justify-content: space-between;
  }

  .hero-list {
    grid-template-columns: 1fr;
  }
}
</style>
