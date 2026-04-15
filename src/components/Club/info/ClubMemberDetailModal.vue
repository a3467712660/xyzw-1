<template>
  <NModal
    class="modal-w-800"
    preset="card"
    v-model:show="showModel"
    :bordered="false"
    :segmented="{ content: 'soft', footer: 'soft' }"
    :show-close="false"
    :title="title"
  >
    <template #header-extra>
      <span v-if="player" class="player-id">{{ idLabel }}: {{ player.id }}</span>
    </template>

    <div v-if="player" class="player-info-content">
      <div class="player-info-main">
        <NAvatar
          round
          class="player-avatar"
          :size="60"
          :src="player.headImg"
        ></NAvatar>
        <div class="player-info-detail">
          <h3>
            {{ player.name }}
            <NTag
              v-if="player.legacy > 0"
              class="legacy-tag ml-8"
              size="small"
              :style="{ '--legacy-bg': legacyMap[player.legacy]?.value }"
            >
              {{ legacyMap[player.legacy]?.name || unknownText }}
            </NTag>
          </h3>
          <div class="detail-row">
            <span>{{ powerLabel }}: <span class="highlight">{{ formatPower(player.power) }}</span></span>
            <span>{{ serverLabel }}: {{ player.serverName || unknownText }}</span>
          </div>
          <div class="detail-row">
            <span>{{ clubLabel }}: {{ player.legionName || noneText }}</span>
          </div>
          <div class="detail-row">
            <span>{{ totalRedLabel }}: <span class="red-text">{{ player.totalRedCount || 0 }}</span></span>
            <span>{{ totalHoleLabel }}: <span class="blue-text">{{ player.totalHoleCount || 0 }}</span></span>
            <span>{{ holyBeastLabel }}: <span class="green-text">{{ player.holyBeast || 0 }}</span></span>
          </div>
        </div>
      </div>

      <slot name="actions"></slot>
      <slot name="status"></slot>

      <div class="hero-section">
        <h4>{{ heroSectionTitle }}</h4>
        <div v-if="player.heroList" class="debug-info debug-info-bottom">
          {{ heroCountLabel }}: {{ player.heroList.length }}
        </div>
        <div
          v-if="player.heroList && player.heroList.length > 0"
          class="hero-list"
        >
          <div
            v-for="(hero, index) in player.heroList"
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
                <span>{{ heroPowerLabel }}: {{ formatPower(hero.power || 0) }}</span>
                <span>{{ heroStarLabel }}: {{ hero.star || 0 }}</span>
                <span>{{ heroRedLabel }}: {{ hero.red || 0 }}</span>
                <span>{{ heroHoleLabel }}: {{ hero.hole || 0 }}</span>
                <span :class="hero.HolyBeast ? 'opened' : 'closed'">
                  {{ hero.HolyBeast ? holyBeastOpenedText : holyBeastClosedText }}
                </span>
                <span v-if="hero.HolyBeast">
                  {{ holyBeastLevelLabel }}: {{ hero.HBlevel || 0 }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="empty-heroes">
          <p>{{ heroEmptyText }}</p>
          <div v-if="player.heroList" class="debug-info debug-info-top">
            {{ heroListEmptyText }}
          </div>
          <div v-else class="debug-info debug-info-top">{{ heroListUndefinedText }}</div>
        </div>
      </div>
    </div>

    <template #footer>
      <slot name="footer">
        <NButton @click="showModel = false">{{ closeText }}</NButton>
      </slot>
    </template>
  </NModal>
</template>

<script setup>
import { computed } from "vue";
import { NAvatar, NButton, NModal, NTag } from "naive-ui/es";

const props = defineProps({
  closeText: {
    type: String,
    default: "关闭",
  },
  clubLabel: {
    type: String,
    default: "俱乐部",
  },
  formatPower: {
    type: Function,
    required: true,
  },
  heroCountLabel: {
    type: String,
    default: "武将数量",
  },
  heroEmptyText: {
    type: String,
    default: "未查询到武将信息",
  },
  heroHoleLabel: {
    type: String,
    default: "开孔",
  },
  heroListEmptyText: {
    type: String,
    default: "武将列表为空",
  },
  heroListUndefinedText: {
    type: String,
    default: "武将列表未定义",
  },
  heroPowerLabel: {
    type: String,
    default: "战力",
  },
  heroRedLabel: {
    type: String,
    default: "红数",
  },
  heroSectionTitle: {
    type: String,
    default: "武将阵容",
  },
  heroStarLabel: {
    type: String,
    default: "星级",
  },
  holyBeastClosedText: {
    type: String,
    default: "未开四圣",
  },
  holyBeastLabel: {
    type: String,
    default: "四圣",
  },
  holyBeastLevelLabel: {
    type: String,
    default: "四圣等级",
  },
  holyBeastOpenedText: {
    type: String,
    default: "已开四圣",
  },
  idLabel: {
    type: String,
    default: "ID",
  },
  legacyMap: {
    type: Object,
    default: () => ({}),
  },
  noneText: {
    type: String,
    default: "无",
  },
  player: {
    type: Object,
    default: null,
  },
  powerLabel: {
    type: String,
    default: "战力",
  },
  serverLabel: {
    type: String,
    default: "服务器",
  },
  show: Boolean,
  title: {
    type: String,
    default: "成员信息",
  },
  totalHoleLabel: {
    type: String,
    default: "总开孔",
  },
  totalRedLabel: {
    type: String,
    default: "总红数",
  },
  unknownText: {
    type: String,
    default: "未知",
  },
});

const emit = defineEmits(["select-hero", "update:show"]);

const showModel = computed({
  get: () => props.show,
  set: (value) => emit("update:show", value),
});
</script>

<style scoped lang="scss">
.modal-w-800 {
  width: min(800px, calc(100vw - 24px));
}

.modal-w-800 :deep(.n-card) {
  max-height: calc(100dvh - 24px);
  display: flex;
  flex-direction: column;
}

.modal-w-800 :deep(.n-card__content) {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.player-info-content {
  display: grid;
  gap: 16px;
}

.player-info-main {
  display: flex;
  gap: 16px;
  align-items: center;
}

.player-info-detail {
  display: grid;
  gap: 8px;
}

.detail-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.highlight {
  font-weight: 700;
}

.red-text {
  color: #d03050;
}

.blue-text {
  color: #2080f0;
}

.green-text {
  color: #18a058;
}

.hero-section {
  display: grid;
  gap: 12px;
}

.hero-list {
  display: grid;
  gap: 10px;
}

.hero-item {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.04);
  cursor: pointer;
}

.hero-info,
.hero-stats {
  display: grid;
  gap: 4px;
}

.hero-name {
  font-weight: 600;
}

.hero-stats {
  font-size: 12px;
}

.empty-heroes,
.debug-info {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.68);
}

@media (max-width: 768px) {
  .modal-w-800 :deep(.n-card) {
    max-height: calc(100dvh - 12px);
  }

  .player-info-main {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
