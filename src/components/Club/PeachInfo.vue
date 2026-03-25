<template>
  <div ref="exportDom" class="peach-info-card">
    <div class="toolbar">
      <div class="left">
        <span class="title">{{ t("peachInfo.toolbar.queryDate") }}</span>
        <a-date-picker
          format="YYYY/MM/DD"
          value-format="YYYY/MM/DD"
          v-model:value="queryDate"
          :default-value="queryDate"
          :disabled-date="disabledDate"
          @change="fetchBattleRecordsByDate"
        ></a-date-picker>
      </div>
      <div class="right">
        <NButton
          class="action-btn export-btn mr-8"
          size="small"
          :disabled="!opponentMembers.length"
          @click="handleExportImage"
        >
          <template #icon>
            <NIcon>
              <Copy></Copy>
            </NIcon> </template
          >{{ t("peachInfo.toolbar.exportImage") }}
        </NButton>
        <NButton
          class="refresh-btn"
          size="small"
          :disabled="loading"
          @click="fetchBattleRecordsByDate"
        >
          <template #icon>
            <NIcon>
              <Refresh></Refresh>
            </NIcon>
          </template>
          {{ t("peachInfo.toolbar.refresh") }}
        </NButton>
      </div>
    </div>

    <!-- Header Section -->
    <h2 v-if="battleInfo" class="main-title">
      {{ t("peachInfo.title", { date: queryDate }) }}
    </h2>
    <div v-if="battleInfo" class="header-section">
      <div class="club-vs-container">
        <!-- Own Club (Left) -->
        <div class="club-info own">
          <NAvatar
            round
            class="club-logo"
            :size="80"
            :src="battleInfo.ownClub?.logo || '/icons/xiaoyugan.png'"
          ></NAvatar>
          <div class="club-details">
            <div class="club-name">
              {{ t("peachInfo.club.server", { serverId: battleInfo.ownClub.serverId }) }}
              {{ battleInfo.ownClub?.name || t("peachInfo.common.unknown") }}
            </div>
            <div class="club-stats">
              {{ t("peachInfo.club.id", { id: battleInfo.ownClub.id }) }}
            </div>
            <div class="club-stats">
              {{ t("peachInfo.club.memberCount", { count: battleInfo.ownClub.memberCount }) }} |
              {{ t("peachInfo.club.quenchNum", { count: battleInfo.ownClub.quenchNum }) }} |
              {{ formatPower(battleInfo.ownClub.power) }}
            </div>
            <div class="club-stats announcement">
              {{ battleInfo.ownClub.announcement }}
            </div>
          </div>
        </div>

        <!-- VS Badge -->
        <div class="vs-badge">
          <span class="vs-text">VS</span>
        </div>

        <!-- Opponent Club (Right) -->
        <div class="club-info opponent">
          <NAvatar
            round
            class="club-logo"
            :size="80"
            :src="battleInfo.opponentClub?.logo || '/icons/xiaoyugan.png'"
          ></NAvatar>
          <div class="club-details">
            <div class="club-name">
              {{ t("peachInfo.club.server", { serverId: battleInfo.opponentClub.serverId }) }}
              {{ battleInfo.opponentClub?.name || t("peachInfo.common.unknown") }}
            </div>
            <div class="club-stats">
              {{ t("peachInfo.club.id", { id: battleInfo.opponentClub.id }) }}
            </div>
            <div class="club-stats">
              {{ t("peachInfo.club.memberCount", { count: battleInfo.opponentClub.memberCount }) }} |
              {{ t("peachInfo.club.quenchNum", { count: battleInfo.opponentClub.quenchNum }) }} |
              {{ formatPower(battleInfo.opponentClub.power) }}
            </div>
            <div class="club-stats announcement">
              {{ battleInfo.opponentClub.announcement }}
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <NSpin size="large">
        <template #description>{{ t("peachInfo.states.loadingOpponent") }}</template>
      </NSpin>
    </div>

    <!-- Data Table -->
    <div v-else-if="opponentMembers.length > 0" class="members-table">
      <div class="table-title">{{ t("peachInfo.table.title") }}</div>
      <div v-if="isMobile" class="mobile-member-list">
        <div
          v-for="member in opponentMembers"
          :key="member.id"
          class="mobile-member-card"
        >
          <div class="mobile-member-head">
            <NAvatar
              round
              class="mobile-member-avatar"
              :size="40"
              :src="member.headImg"
            ></NAvatar>
            <div class="mobile-member-meta">
              <div
                class="mobile-member-name"
                @click="fetchTargetInfo(member.id)"
              >
                {{ member.name }}
              </div>
              <div class="mobile-member-power">
                {{ t("peachInfo.labels.power", { value: formatPower(member.power) }) }}
              </div>
            </div>
            <NTag
size="small"
type="error"
              >{{ t("peachInfo.labels.redQuench", { count: member.redQuench || 0 }) }}</NTag
            >
          </div>
          <div class="mobile-member-lineup-type">
            <span>{{ t("peachInfo.labels.lineupType") }}</span>
            <NTag
              size="small"
              :bordered="false"
              :color="getLineupTagColorProps(member.lineupType)"
            >
              {{ member.lineupType || t("peachInfo.common.unknown") }}
            </NTag>
          </div>
          <div class="mobile-member-lineup">
            <span
              v-for="(hero, index) in member.heroList || []"
              :key="`${member.id}_${hero.heroId}_${index}`"
              class="mobile-hero-chip"
            >
              {{ hero.heroName }}({{ hero.red }})<template v-if="hero.HolyBeast"
                >[{{ hero.HBlevel }}]</template
              >
            </span>
            <span
              v-if="!member.heroList || member.heroList.length === 0"
              class="mobile-hero-empty"
            >
              {{ t("peachInfo.states.noLineup") }}
            </span>
          </div>
        </div>
      </div>
      <NDataTable
        v-else
        striped
        size="small"
        :bordered="false"
        :columns="columns"
        :data="opponentMembers"
        :scroll-x="1200"
      ></NDataTable>
    </div>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <NEmpty :description="t('peachInfo.states.noOpponentData')"></NEmpty>
    </div>

    <!-- 玩家信息模态框 -->
    <NModal
      class="modal-w-800"
      preset="card"
      v-model:show="showPlayerInfoModal"
      :bordered="false"
      :segmented="{ content: 'soft', footer: 'soft' }"
      :show-close="false"
      :title="t('peachInfo.modals.playerInfoTitle')"
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
            <h3>
              {{ playerInfo.name }}
              <NTag
                v-if="playerInfo.legacy > 0"
                class="legacy-tag ml-8"
                size="small"
                :style="{
                  '--legacy-bg': legacycolor[playerInfo.legacy]?.value,
                }"
              >
                {{ legacycolor[playerInfo.legacy]?.name || t("peachInfo.common.unknown") }}
              </NTag>
            </h3>
            <p>
              {{ t("peachInfo.labels.serverName", {
                name: playerInfo.serverName || t("peachInfo.common.unknown"),
              }) }}
              |
              {{ t("peachInfo.labels.power", { value: formatPower(playerInfo.power) }) }}
            </p>
            <p>{{ t("peachInfo.labels.legionName", { name: playerInfo.legionName || t("peachInfo.common.none") }) }}</p>
            <p>
              {{ t("peachInfo.labels.totalRedCount", { count: playerInfo.totalRedCount || 0 }) }} |
              {{ t("peachInfo.labels.totalHoleCount", { count: playerInfo.totalHoleCount || 0 }) }} |
              {{ t("peachInfo.labels.holyBeastCount", { count: playerInfo.holyBeast || 0 }) }}
            </p>
          </div>
        </div>

        <div class="action-section">
          <div class="fight-inline">
            <div class="fight-count-container">
              <label
class="fight-count-label"
for="fightCount"
                >{{ t("peachInfo.duel.countLabel") }}</label
              >
              <NInput
                id="fightCount"
                class="fight-count-input"
                max="100"
                min="1"
                size="small"
                type="number"
                v-model:value="fightCount"
                :placeholder="t('peachInfo.duel.countPlaceholder')"
                :step="1"
                @input="validateFightCount"
              ></NInput>
              <div class="fight-count-hint">{{ t("peachInfo.duel.rangeHint") }}</div>
            </div>
            <NButton
              class="mr-8"
              size="small"
              type="tertiary"
              @click="showPlayerInfoModal = false"
            >
              {{ t("peachInfo.common.close") }}
            </NButton>
          </div>
          <NButton
            type="primary"
            :disabled="!isFightCountValid"
            @click="handleDuel"
          >
            {{ t("peachInfo.duel.start") }}
          </NButton>
        </div>

        <!-- 切磋进度和结果 -->
        <div v-if="fightProgress.visible" class="fight-progress">
          <div class="progress-info">
            <div class="progress-title">{{ t("peachInfo.duel.inProgress") }}</div>
            <div class="progress-stats">
              <span>{{ t("peachInfo.duel.totalCount", { count: fightProgress.totalCount }) }}</span>
              <span>{{ t("peachInfo.duel.completedCount", { count: fightProgress.completedCount }) }}</span>
              <span>{{ t("peachInfo.duel.remainingCount", { count: fightProgress.remainingCount }) }}</span>
              <span>{{ t("peachInfo.duel.winCount", { count: fightProgress.winCount }) }}</span>
              <span>{{ t("peachInfo.duel.lossCount", { count: fightProgress.lossCount }) }}</span>
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

        <!-- 最终结果统计 -->
        <div v-if="fightResult.visible" class="fight-result">
          <!-- 结果标题和统计信息 -->
          <div class="result-header">
            <h4 class="result-title">{{ t("peachInfo.duel.resultTitle") }}</h4>
            <div class="result-summary">
              <div class="summary-item">
                <span class="summary-label">{{ t("peachInfo.duel.summary.totalCount") }}</span>
                <span class="summary-value">{{ fightResult.totalCount }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">{{ t("peachInfo.duel.summary.win") }}</span>
                <span class="summary-value win">{{
                  fightResult.winCount
                }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">{{ t("peachInfo.duel.summary.loss") }}</span>
                <span class="summary-value loss">{{
                  fightResult.lossCount
                }}</span>
              </div>
              <div class="summary-item">
                <span class="summary-label">{{ t("peachInfo.duel.summary.winRate") }}</span>
                <span class="summary-value"
                  >{{
                    (
                      (fightResult.winCount / fightResult.totalCount) *
                      100
                    ).toFixed(2)
                  }}%</span
                >
              </div>
              <div class="summary-item">
                <span class="summary-label">{{ t("peachInfo.duel.summary.ourDieRate") }}</span>
                <span class="summary-value"
                  >{{
                    (
                      (dieStats.ourDieHeroGameCount / fightResult.totalCount) *
                      100
                    ).toFixed(2)
                  }}%</span
                >
              </div>
              <div class="summary-item">
                <span class="summary-label">{{ t("peachInfo.duel.summary.enemyDieRate") }}</span>
                <span class="summary-value"
                  >{{
                    (
                      (dieStats.enemyDieHeroGameCount /
                        fightResult.totalCount) *
                      100
                    ).toFixed(2)
                  }}%</span
                >
              </div>
            </div>
          </div>

          <!-- 战斗结果列表 -->
          <div class="result-list">
            <div
              v-for="(battle, index) in fightResult.resultCount"
              :key="index"
              class="battle-result-item"
              :class="[battle.isWin ? 'win' : 'loss']"
            >
              <div class="battle-header">
                <span class="battle-index">{{ t("peachInfo.duel.battleIndex", { index: index + 1 }) }}</span>
                <NTag size="small" :type="battle.isWin ? 'success' : 'error'">
                  {{ battle.isWin ? t("peachInfo.duel.win") : t("peachInfo.duel.loss") }}
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
                    <span class="side-name">{{
                      battle.leftName || t("peachInfo.common.unknown")
                    }}</span>
                    <span class="side-power">{{ t("peachInfo.labels.power", { value: battle.leftpower }) }}</span>
                    <span class="side-die"
                      >{{ t("peachInfo.duel.dieHeroCount", { count: battle.leftDieHero }) }}</span
                    >
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
                    <span class="side-name">{{
                      battle.rightName || t("peachInfo.common.unknown")
                    }}</span>
                    <span class="side-power"
                      >{{ t("peachInfo.labels.power", { value: battle.rightpower }) }}</span
                    >
                    <span class="side-die"
                      >{{ t("peachInfo.duel.dieHeroCount", { count: battle.rightDieHero }) }}</span
                    >
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="result-actions">
            <NButton type="primary" @click="resetFightResult">{{ t("peachInfo.duel.retry") }}</NButton>
            <NButton @click="fightResult.visible = false">{{ t("peachInfo.duel.closeResult") }}</NButton>
          </div>
        </div>

        <div class="player-heroes">
          <h4>{{ t("peachInfo.heroes.title") }}</h4>
          <!-- 添加调试信息 -->
          <div v-if="playerInfo.heroList" class="debug-info debug-info-bottom">
            {{ t("peachInfo.heroes.count", { count: playerInfo.heroList.length }) }}
          </div>
          <div
            v-if="playerInfo.heroList && playerInfo.heroList.length > 0"
            class="hero-list"
          >
            <div
              v-for="(hero, index) in playerInfo.heroList"
              :key="hero.heroId || index"
              class="hero-item"
              @click="selectHeroInfo(hero)"
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
                  <span>{{ t("peachInfo.labels.power", { value: formatPower(hero.power || 0) }) }}</span>
                  <span>{{ t("peachInfo.heroes.star", { value: hero.star || 0 }) }}</span>
                  <span>{{ t("peachInfo.heroes.red", { value: hero.red || 0 }) }}</span>
                  <span>{{ t("peachInfo.heroes.hole", { value: hero.hole || 0 }) }}</span>
                  <span :class="hero.HolyBeast ? 'opened' : 'closed'">
                    {{ hero.HolyBeast ? t("peachInfo.heroes.holyBeastOpened") : t("peachInfo.heroes.holyBeastClosed") }}
                  </span>
                  <span v-if="hero.HolyBeast"
                    >{{ t("peachInfo.heroes.holyBeastLevel", { value: hero.HBlevel || 0 }) }}</span
                  >
                </div>
              </div>
            </div>
          </div>
          <div v-else class="empty-heroes">
            <p>{{ t("peachInfo.heroes.empty") }}</p>
            <!-- 添加调试信息 -->
            <div v-if="playerInfo.heroList" class="debug-info debug-info-top">
              {{ t("peachInfo.heroes.listEmpty") }}
            </div>
            <div v-else class="debug-info debug-info-top">{{ t("peachInfo.heroes.listUndefined") }}</div>
          </div>
        </div>
      </div>
    </NModal>

    <!-- 武将详情模态框 -->
    <NModal
      class="hero-detail-modal modal-w-600"
      preset="card"
      v-model:show="showHeroModal"
      :bordered="false"
      :segmented="{ content: 'soft', footer: 'soft' }"
      :title="t('peachInfo.heroModal.title')"
    >
      <div v-if="heroModealTemp" class="hero-modal-content">
        <div class="hero-modal-header">
          <NAvatar
            round
            class="hero-modal-avatar"
            :size="80"
            :src="heroModealTemp.heroAvate"
          ></NAvatar>
          <div class="hero-modal-basic">
            <h3 class="hero-modal-name">{{ heroModealTemp.heroName }}</h3>
            <div class="hero-modal-stats">
              <span class="stat-item">{{
                formatPower(heroModealTemp.power)
              }}</span>
              <span class="stat-item">{{ t("peachInfo.heroModal.level", { value: heroModealTemp.level }) }}</span>
              <span class="stat-item">{{ t("peachInfo.heroModal.star", { value: heroModealTemp.star }) }}</span>
              <NTag :type="heroModealTemp.HolyBeast ? 'success' : 'warning'">
                {{ heroModealTemp.HolyBeast ? t("peachInfo.heroModal.activated") : t("peachInfo.heroModal.notActivated") }}
              </NTag>
            </div>
          </div>
        </div>

        <div class="hero-modal-details">
          <NDescriptions bordered column="3" label-placement="left">
            <NDescriptionsItem :label="t('peachInfo.heroModal.labels.power')">
              {{ formatPower(heroModealTemp.power) }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('peachInfo.heroModal.labels.level')">
              {{ heroModealTemp.level }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('peachInfo.heroModal.labels.star')">
              {{ heroModealTemp.star }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('peachInfo.heroModal.labels.hole')">
              {{ heroModealTemp.hole }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('peachInfo.heroModal.labels.red')">
              {{ heroModealTemp.red }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('peachInfo.heroModal.labels.holyBeastStatus')">
              {{ heroModealTemp.HolyBeast ? t("peachInfo.heroModal.activated") : t("peachInfo.heroModal.notActivated") }}
            </NDescriptionsItem>
            <NDescriptionsItem v-if="heroModealTemp.HolyBeast" :label="t('peachInfo.heroModal.labels.holyBeastLevel')">
              {{ heroModealTemp.HBlevel }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('peachInfo.heroModal.labels.fishInfo')">
              {{
                heroModealTemp?.PearlInfo?.FishInfo?.name !== undefined
                  ? heroModealTemp.PearlInfo?.FishInfo?.name
                  : t("peachInfo.common.none")
              }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('peachInfo.heroModal.labels.pearlSkill')">
              {{
                heroModealTemp?.PearlInfo?.PearlSkill?.name !== undefined
                  ? heroModealTemp.PearlInfo?.PearlSkill?.name
                  : t("peachInfo.common.none")
              }}
            </NDescriptionsItem>
            <NDescriptionsItem :label="t('peachInfo.heroModal.labels.pearlWash')">
              <div v-if="heroModealTemp?.PearlInfo?.slotMap?.length > 0">
                <div
                  v-for="item in heroModealTemp.PearlInfo.slotMap"
                  :key="item.id"
                  class="ModalEquipment"
                  :style="{ '--equip-color': item.value }"
                ></div>
              </div>
              <div v-else>{{ t("peachInfo.common.none") }}</div>
            </NDescriptionsItem>
          </NDescriptions>
        </div>

        <div class="hero-modal-equipment">
          <h4 class="section-title">{{ t("peachInfo.heroModal.equipmentTitle") }}</h4>
          <div class="equipment-grid">
            <div class="equipment-item">
              <span class="equipment-label">{{ t("peachInfo.heroModal.equipment.weapon") }}</span>
              <div class="equipment-slots">
                <div
                  v-for="(item, idx) in Object.values(
                    Object.values(heroModealTemp.equipment)[0]?.quenches || {},
                  )"
                  :key="idx"
                  class="equipment-slot"
                  :class="{ 'red-slot': item.colorId === 6 }"
                ></div>
              </div>
            </div>
            <div class="equipment-item">
              <span class="equipment-label">{{ t("peachInfo.heroModal.equipment.clothes") }}</span>
              <div class="equipment-slots">
                <div
                  v-for="(item, idx) in Object.values(
                    Object.values(heroModealTemp.equipment)[1]?.quenches || {},
                  )"
                  :key="idx"
                  class="equipment-slot"
                  :class="{ 'red-slot': item.colorId === 6 }"
                ></div>
              </div>
            </div>
            <div class="equipment-item">
              <span class="equipment-label">{{ t("peachInfo.heroModal.equipment.helmet") }}</span>
              <div class="equipment-slots">
                <div
                  v-for="(item, idx) in Object.values(
                    Object.values(heroModealTemp.equipment)[2]?.quenches || {},
                  )"
                  :key="idx"
                  class="equipment-slot"
                  :class="{ 'red-slot': item.colorId === 6 }"
                ></div>
              </div>
            </div>
            <div class="equipment-item">
              <span class="equipment-label">{{ t("peachInfo.heroModal.equipment.mount") }}</span>
              <div class="equipment-slots">
                <div
                  v-for="(item, idx) in Object.values(
                    Object.values(heroModealTemp.equipment)[3]?.quenches || {},
                  )"
                  :key="idx"
                  class="equipment-slot"
                  :class="{ 'red-slot': item.colorId === 6 }"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <template #footer>
        <NButton @click="showHeroModal = false">{{ t("peachInfo.common.close") }}</NButton>
      </template>
    </NModal>
  </div>
</template>

<script setup>
import {
  computed,
  h,
  nextTick,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  watch,
} from "vue";
import {
  NAvatar,
  NButton,
  NDataTable,
  NDescriptions,
  NDescriptionsItem,
  NEmpty,
  NIcon,
  NInput,
  NModal,
  NProgress,
  NSpin,
  NTag,
  useMessage,
} from "naive-ui/es";
import { Copy, Refresh } from "@vicons/ionicons5";
import { useTokenStore } from "@/stores/tokenStore";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import { downloadCanvasAsPagedImages } from "@/utils/imageExport";
import {
  getLineupType,
  HERO_DICT,
  HeroFillInfo,
  legacycolor,
  LINEUP_RULES,
} from "@/utils/HeroList";
import { useI18n } from "vue-i18n";

const message = useMessage();
const { t, locale } = useI18n();
const tokenStore = useTokenStore();
const info = computed(() => tokenStore.gameData?.legionInfo || null);
const club = computed(() => info.value?.info || null);
const exportDom = ref(null);
const isMobile = ref(false);

const getLastSunday = () => {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=周日, 1=周一, ..., 6=周六
  const hour = today.getHours();

  let daysToSubtract = 0;
  if (dayOfWeek === 0) {
    // 今天是周日
    if (hour < 18) {
      // 18:00 之前，返回上周日
      daysToSubtract = 7;
    } else {
      // 18:00 之后，返回今天
      daysToSubtract = 0;
    }
  } else {
    // 周一到周六，计算距离上周日的天数
    daysToSubtract = dayOfWeek;
  }

  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() - daysToSubtract);

  const targetYear = targetDate.getFullYear();
  const targetMonth = String(targetDate.getMonth() + 1).padStart(2, "0");
  const targetDay = String(targetDate.getDate()).padStart(2, "0");

  return `${targetYear}/${targetMonth}/${targetDay}`;
};

// Helper: Format Power
const formatPower = (power) => {
  if (!power) return "0";
  if (power >= 100000000) {
    return t("peachInfo.power.billion", {
      value: (power / 100000000).toFixed(1),
    });
  }
  if (power >= 10000) {
    return t("peachInfo.power.tenThousand", {
      value: (power / 10000).toFixed(1),
    });
  }
  return power.toString();
};

const updateMobileFlag = () => {
  const ua = navigator.userAgent || "";
  const isDesktopUA =
    /Windows NT|Macintosh|X11|Linux x86_64/i.test(ua) &&
    !/Android|iPhone|iPad|Mobile/i.test(ua);

  // 桌面环境强制走PC表格视图，避免显示移动端头像序号
  if (isDesktopUA) {
    isMobile.value = false;
    return;
  }

  isMobile.value = window.innerWidth <= 768;
};

// Helper: Disabled Date (Only Sundays)
const disabledDate = (ts) => {
  const date = new Date(ts);
  return date.getDay() !== 0 || date > Date.now();
};

const formatDateToShort = (dateStr) => {
  if (!dateStr) return "";
  const parts = dateStr.split("/");
  if (parts.length !== 3) return dateStr;
  const [year, month, day] = parts;
  return year.slice(2) + month + day;
};

const getUniqueRoleIdsFromKillRecords = (records = []) => {
  const ids = new Set();
  records.forEach((record) => {
    const roleId = record?.roleInfo?.roleId;
    if (roleId != null) {
      ids.add(String(roleId));
    }
  });
  return Array.from(ids);
};

const getLegionMemberCount = (legionData, killRecords = []) => {
  const members = legionData?.members;
  if (members && typeof members === "object") {
    return Object.keys(members).length;
  }
  return getUniqueRoleIdsFromKillRecords(killRecords).length;
};

const getUniqueMemberIds = (...idLists) => {
  const ids = new Set();
  idLists.forEach((list) => {
    (list || []).forEach((id) => {
      if (id != null && `${id}`.trim()) {
        ids.add(String(id));
      }
    });
  });
  return Array.from(ids);
};

// Helper: Check if Sunday 18:00 - 20:30
const isSundayBattleTime = () => {
  const now = new Date();
  const day = now.getDay();
  const hour = now.getHours();
  const minute = now.getMinutes();
  return (
    day === 0 && ((hour >= 18 && hour < 20) || (hour === 20 && minute <= 30))
  );
};

// Helper: Check if date string is today
// State
const loading = ref(false);
const battleInfo = ref(null); // Opponent Club Info
const opponentMembers = ref([]);
const queryDate = ref(getLastSunday());

// 新增查询对手相关状态
const queryLoading = ref(false);
const queryTargetId = ref("");
// 玩家信息模态框状态
const showPlayerInfoModal = ref(false);
const playerInfo = ref(null);

// 新增切磋次数相关状态
const fightCount = ref(1);
const isFightCountValid = ref(true);

// 切磋进度状态
const fightProgress = reactive({
  visible: false,
  totalCount: 0,
  completedCount: 0,
  remainingCount: 0,
  winCount: 0,
  lossCount: 0,
  percentage: 0,
});

// 最终结果状态
const fightResult = reactive({
  visible: false,
  totalCount: 0,
  winCount: 0,
  lossCount: 0,
  winRate: 0,
  ourDieRate: 0,
  enemyDieRate: 0,
  resultCount: [], // 存储每场战斗的详细结果
});

// 切磋历史记录
const fightHistory = ref([]);

// 掉将统计
const dieStats = reactive({
  ourDieHeroGameCount: 0,
  enemyDieHeroGameCount: 0,
});

// 武将详情模态框状态
const showHeroModal = ref(false);
// 选中的武将信息
const heroModealTemp = ref(null);

// 选择武将信息，显示详情模态框
const selectHeroInfo = (heroInfo) => {
  showHeroModal.value = true;
  heroModealTemp.value = heroInfo;
};

// 获取装备信息红数和孔数
const getEquipment = (equipment) => {
  let redCount = 0;
  let holeCount = 0;
  // 遍历4件装备
  Object.values(equipment).forEach((equ) => {
    // 遍历每件装备的属性
    Object.values(equ.quenches).forEach((item) => {
      holeCount++;
      if (item.colorId === 6) {
        redCount++;
      }
    });
  });
  return { redCount, holeCount };
};

// 提取英雄信息
const getHeroInfo = (heroObj) => {
  // 统计总红数
  let redCount = 0;
  let holeCount = 0;
  let heroList = [];

  try {
    // 检查英雄数据结构，确保可以遍历
    let heroesToProcess = [];

    if (Array.isArray(heroObj)) {
      // 如果是数组，直接使用
      heroesToProcess = heroObj;
    } else if (typeof heroObj === "object" && heroObj !== null) {
      // 如果是对象，转换为数组
      heroesToProcess = Object.values(heroObj);
    } else {
      console.error("英雄数据格式错误:", typeof heroObj);
      return { redCount, holeCount, heroList };
    }

    heroesToProcess.forEach((hero, index) => {
      // 跳过无效英雄数据
      if (!hero) return;

      const heroInfo = HERO_DICT[hero.heroId] || {};
      const equipmentInfo = hero.equipment
        ? getEquipment(hero.equipment)
        : { redCount: 0, holeCount: 0 };

      // 检查英雄基本信息
      const heroId = hero.heroId || `unknown_${index}`;
      const heroName = hero.heroName || heroInfo.name || t("peachInfo.fallbacks.unknownHero", { index });

      const tempObj = {
        heroId, // 英雄ID
        artifactId: hero.artifactId || "", // 英雄装备ID，用于匹配鱼灵信息
        power: hero.power || 0, // 英雄战力
        star: hero.star || 0, // 英雄星级
        equipment: hero.equipment, // 英雄具体孔数和红数
        heroName, // 英雄姓名
        heroAvate: hero.heroAvate || heroInfo.avatar || "",
        level: hero.level || 0, // 英雄等级
        hole: equipmentInfo.holeCount, // 英雄开孔数量
        red: equipmentInfo.redCount, // 英雄红数
        HolyBeast: hero.hB?.active === true, // 激活四圣
        HBlevel: hero.hB?.order || 0, // 四圣等级
        // 添加英雄详情信息
        skillList: hero.skillList || [],
        attributeList: hero.attributeList || [],
        battleTeamSlot: hero.battleTeamSlot, // 阵容站位
      };

      // 只添加有效的英雄
      if (heroId && heroName) {
        redCount += tempObj.red;
        holeCount += tempObj.hole;
        heroList.push(tempObj);
      }
    });
  } catch (error) {
    console.error("处理英雄信息时发生错误:", error);
    heroList = [];
  }
  heroList.sort((a, b) => a.battleTeamSlot - b.battleTeamSlot);
  return { redCount, holeCount, heroList };
};

// 验证切磋次数
const validateFightCount = (value) => {
  const num = Number.parseInt(value);
  isFightCountValid.value = !Number.isNaN(num) && num >= 1 && num <= 100;
};

const getLineupTagColorProps = (type) => {
  const rule = LINEUP_RULES.find((r) => r.name === type);
  return (
    rule?.colorProps || {
      color: "#f5f5f5",
      textColor: "#666",
    }
  );
};

const enforceAvatarColumnDisplay = async () => {
  await nextTick();
  if (isMobile.value || !exportDom.value) return;

  const root = exportDom.value;
  const table = root.querySelector(".n-data-table");
  if (!table) return;

  // 强制修正头像列表头文案，兼容旧缓存列定义
  const ths = table.querySelectorAll("th");
  ths.forEach((th) => {
    const txt = (th.textContent || "").trim();
    if (txt === "序号/头像") {
      th.textContent = "头像";
    }
  });

  // 强制清理头像列里多余的数字/文本节点，仅保留头像元素
  const tds = table.querySelectorAll("td");
  tds.forEach((td) => {
    const hasAvatar =
      td.querySelector(".member-avatar-cell") ||
      td.querySelector(".member-avatar-placeholder-cell");
    if (!hasAvatar) return;

    Array.from(td.childNodes).forEach((node) => {
      // 保留头像元素，清理其它文本和节点
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node;
        if (
          el.classList?.contains("member-avatar-cell") ||
          el.classList?.contains("member-avatar-placeholder-cell")
        ) {
          return;
        }
        el.remove();
        return;
      }
      if (node.nodeType === Node.TEXT_NODE && (node.textContent || "").trim()) {
        node.parentNode?.removeChild(node);
      }
    });
  });
};

// 重置切磋结果
const resetFightResult = () => {
  fightResult.visible = false;
  fightProgress.visible = false;
  fightHistory.value = [];
  dieStats.ourDieHeroGameCount = 0;
  dieStats.enemyDieHeroGameCount = 0;
  fightCount.value = 1;
  validateFightCount(1);
};

// 更新切磋进度
const updateFightProgress = (completedCount, winCount, lossCount) => {
  fightProgress.completedCount = completedCount;
  fightProgress.winCount = winCount;
  fightProgress.lossCount = lossCount;
  fightProgress.remainingCount = fightProgress.totalCount - completedCount;
  fightProgress.percentage = Math.round(
    (completedCount / fightProgress.totalCount) * 100,
  );
};

// 计算最终结果
const calculateFinalResult = (winCount, lossCount, resultCount) => {
  fightResult.totalCount = fightProgress.totalCount;
  fightResult.winCount = winCount;
  fightResult.lossCount = lossCount;
  fightResult.winRate = Math.round((winCount / fightProgress.totalCount) * 100);
  fightResult.ourDieRate = Math.round(
    (dieStats.ourDieHeroGameCount / fightProgress.totalCount) * 100,
  );
  fightResult.enemyDieRate = Math.round(
    (dieStats.enemyDieHeroGameCount / fightProgress.totalCount) * 100,
  );
  fightResult.resultCount = resultCount; // 存储每场战斗的详细结果
  fightResult.visible = true;
  fightProgress.visible = false;
};

// 新增查询对手信息功能
const fetchTargetInfo = async (roleId) => {
  if (!tokenStore.selectedToken) {
    message.warning(t("peachInfo.messages.selectRoleFirst"));
    return;
  }

  const tokenId = tokenStore.selectedToken.id;

  // 检查WebSocket连接
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error(t("peachInfo.messages.wsDisconnectedQueryRecord"));
    return;
  }

  // 重置之前的切磋结果
  resetFightResult();

  queryLoading.value = true;
  queryTargetId.value = roleId;

  try {
    const result = await tokenStore.sendMessageWithPromise(
      tokenId,
      "rank_getroleinfo",
      {
        bottleType: 0,
        includeBottleTeam: false,
        isSearch: false,
        roleId,
        includeHero: true,
        includeHeroDetail: true,
        includePearl: true,
      },
      5000,
    );

    if (!result.roleInfo) {
      message.warning(t("peachInfo.messages.opponentNotFound"));
      return;
    }

    // 处理鱼灵信息
    const fishInfo = HeroFillInfo(result.roleInfo);

    // 获取英雄信息
    let heroAndholdAndRed = { redCount: 0, holeCount: 0, heroList: [] };
    if (result.roleInfo.heroes) {
      try {
        heroAndholdAndRed = getHeroInfo(result.roleInfo.heroes);
      } catch (error) {
        console.error("处理英雄信息失败:", error);
        heroAndholdAndRed = { redCount: 0, holeCount: 0, heroList: [] };
      }
    }

    // 将鱼灵信息添加到英雄列表中
    heroAndholdAndRed.heroList.forEach((hero) => {
      hero.PearlInfo = fishInfo[hero.artifactId] || {};
    });

    // 计算总红数和总开孔数
    const totalRedCount = heroAndholdAndRed.redCount;
    const totalHoleCount = heroAndholdAndRed.holeCount;

    // 从角色信息中获取红淬数据
    const roleRedQuench = result.roleInfo.red || 0;
    const roleMaxRed = result.roleInfo.maxRed || 0;

    // 从俱乐部信息中获取红淬数据（如果有）
    const legionRedQuench =
      result.legionInfo?.statistics?.["battle:red:quench"] || roleRedQuench;
    const legionMaxRed =
      result.legionInfo?.statistics?.["red:quench"] || roleMaxRed;
    const legionMaxPower =
      result.legionInfo?.statistics?.["max:power"] ||
      result.roleInfo.maxPower ||
      0;

    const playerData = {
      id: roleId,
      name: result.roleInfo.name,
      headImg: result.roleInfo.headImg,
      power: result.roleInfo.power,
      level: result.roleInfo.level,
      serverName: result.roleInfo.serverName,
      legionName: result.legionInfo?.name || t("peachInfo.common.none"),
      // 显示角色的红淬数
      redQuench: roleRedQuench,
      // 四圣数统计
      holyBeast: heroAndholdAndRed.heroList.filter((hero) => hero.HolyBeast)
        .length,
      // 俱乐部历史最高战力
      maxPower: formatPower(legionMaxPower),
      // 当前红鼓和最大红鼓
      currentRedDrum: roleRedQuench,
      maxRedDrum: roleMaxRed,
      // 总红数和总开孔数
      totalRedCount,
      totalHoleCount,
      // 俱乐部红淬数据
      legionRedQuench,
      legionMaxRed,
      // 英雄列表
      heroList: heroAndholdAndRed.heroList,
      legacy: result.roleInfo.legacy?.color || 0, // 功法等级
    };

    playerInfo.value = playerData;
    showPlayerInfoModal.value = true;
    message.success(t("peachInfo.messages.querySuccess"));
  } catch (error) {
    message.error(t("peachInfo.messages.queryFailed", { error: error.message }));
    console.error("查询失败详细信息:", error);
  } finally {
    queryLoading.value = false;
  }
};

// 车头头像点击处理
// 切磋功能处理 - 支持连续切磋
const handleDuel = async () => {
  if (!playerInfo.value) return;

  // 验证切磋次数
  validateFightCount(fightCount.value);
  if (!isFightCountValid.value) {
    message.error(t("peachInfo.messages.invalidFightCount"));
    return;
  }

  const totalCount = Number.parseInt(fightCount.value);
  message.info(t("peachInfo.messages.duelStarted", {
    name: playerInfo.value.name,
    count: totalCount,
  }));

  if (!tokenStore.selectedToken) {
    message.warning(t("peachInfo.messages.selectRoleFirst"));
    return;
  }

  const tokenId = tokenStore.selectedToken.id;

  // 检查WebSocket连接
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error(t("peachInfo.messages.wsDisconnectedDuel"));
    return;
  }

  queryLoading.value = true;

  // 初始化切磋进度
  fightProgress.visible = true;
  fightProgress.totalCount = totalCount;
  fightProgress.completedCount = 0;
  fightProgress.remainingCount = totalCount;
  fightProgress.winCount = 0;
  fightProgress.lossCount = 0;
  fightProgress.percentage = 0;

  // 重置掉将统计
  dieStats.ourDieHeroGameCount = 0;
  dieStats.enemyDieHeroGameCount = 0;

  // 重置历史记录
  fightHistory.value = [];

  try {
    let winCount = 0;
    let lossCount = 0;
    const resultCount = []; // 存储每场战斗的详细结果

    // 重置掉将统计
    dieStats.ourDieHeroGameCount = 0;
    dieStats.enemyDieHeroGameCount = 0;

    // 执行连续切磋
    for (let i = 0; i < totalCount; i++) {
      message.info(t("peachInfo.messages.duelRunning", {
        current: i + 1,
        total: totalCount,
      }));

      // 调用实际的切磋API
      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "fight_startpvp",
        {
          targetId: playerInfo.value.id,
        },
        10000,
      );

      console.log(`第 ${i + 1} 场切磋结果:`, result);

      if (result && result.battleData) {
        // 处理掉将情况
        let leftCount = 0;
        let rightCount = 0;

        // 检查我方掉将情况
        if (result.battleData.result?.sponsor?.teamInfo) {
          result.battleData.result.sponsor.teamInfo.forEach((item) => {
            if (item.hp === 0) {
              leftCount++;
            }
          });
        }

        // 检查敌方掉将情况
        if (result.battleData.result?.accept?.teamInfo) {
          result.battleData.result.accept.teamInfo.forEach((item) => {
            if (item.hp === 0) {
              rightCount++;
            }
          });
        }

        // 构建战斗结果对象
        const battleResult = {
          isWin: result.battleData.result?.isWin || false,
          leftName: result.battleData.leftTeam?.name || t("peachInfo.common.unknown"),
          leftheadImg: result.battleData.leftTeam?.headImg || "",
          leftpower: formatPower(result.battleData.leftTeam?.power || 0),
          leftDieHero: leftCount,
          rightName: result.battleData.rightTeam?.name || t("peachInfo.common.unknown"),
          rightheadImg: result.battleData.rightTeam?.headImg || "",
          rightpower: formatPower(result.battleData.rightTeam?.power || 0),
          rightDieHero: rightCount,
        };

        // 保存到结果数组
        resultCount.push(battleResult);

        // 更新掉将统计
        if (leftCount > 0) {
          dieStats.ourDieHeroGameCount++;
        }
        if (rightCount > 0) {
          dieStats.enemyDieHeroGameCount++;
        }

        // 更新胜负计数
        if (battleResult.isWin) {
          winCount++;
        } else {
          lossCount++;
        }

        // 更新切磋进度
        updateFightProgress(i + 1, winCount, lossCount);

        // 短暂延迟，避免请求过于频繁
        if (i < totalCount - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      } else {
        // 单场切磋失败，继续下一场
        message.warning(
          t("peachInfo.messages.duelSingleFailed", {
            current: i + 1,
            error: result?.message || t("peachInfo.messages.noBattleData"),
          }),
        );
        lossCount++;
        updateFightProgress(i + 1, winCount, lossCount);
      }
    }

    // 所有切磋完成，计算最终结果
    calculateFinalResult(winCount, lossCount, resultCount);

    message.success(t("peachInfo.messages.duelFinished", { count: totalCount }));
  } catch (error) {
    console.error("连续切磋失败:", error);
    message.error(
      t("peachInfo.messages.duelFailed", {
        error: error.message || t("peachInfo.messages.networkError"),
      }),
    );
    fightProgress.visible = false;
  } finally {
    queryLoading.value = false;
    // 不关闭模态框，让用户可以继续查看或再次切磋
  }
};

// Columns Definition
const columns = computed(() => [
  {
    title: t("peachInfo.table.columns.index"),
    key: "index",
    width: 60,
    align: "center",
    render: (_, index) => index + 1,
  },
  {
    title: t("peachInfo.table.columns.avatar"),
    key: "headImg",
    width: 60,
    align: "center",
    render: (row) => {
      if (row.headImg) {
        return h("img", {
          src: row.headImg,
          class: "member-avatar-cell",
          alt: row.name,
        });
      }
      return h(
        "div",
        {
          class: "member-avatar-placeholder-cell",
        },
        row.name?.charAt(0) || "?",
      );
    },
  },
  {
    title: t("peachInfo.table.columns.roleName"),
    key: "name",
    width: 150,
    align: "center",
    render: (row) => {
      return h(
        "span",
        {
          style: {
            cursor: "pointer",
            color: "#1890ff",
            textDecoration: "underline",
          },
          onClick: () => fetchTargetInfo(row.id),
        },
        row.name,
      );
    },
  },
  {
    title: t("peachInfo.table.columns.power"),
    key: "power",
    width: 100,
    align: "center",
    render: (row) => formatPower(row.power),
  },
  {
    title: t("peachInfo.table.columns.redQuench"),
    key: "redQuench",
    width: 80,
    align: "center",
    render: (row) => h("span", { style: { color: "#ff4d4f" } }, row.redQuench),
  },
  {
    title: t("peachInfo.table.columns.lineup"),
    key: "lineup",
    align: "left",
    render: (row) => {
      const heroes = row.heroList || [];
      const nodes = [];

      heroes.forEach((hero, index) => {
        // 英雄名字
        nodes.push(h("span", { style: { color: "#40a9ff" } }, hero.heroName));

        // 红数 (红色)
        nodes.push(h("span", { style: { color: "#ff4d4f" } }, `(${hero.red})`));

        // 四圣等级 (绿色)
        if (hero.HolyBeast) {
          nodes.push(
            h("span", { style: { color: "#52c41a" } }, `[${hero.HBlevel}]`),
          );
        }

        // 分隔符
        if (index < heroes.length - 1) {
          nodes.push(", ");
        }
      });

      return h("span", { style: { fontSize: "12px" } }, nodes);
    },
  },
  {
    title: t("peachInfo.table.columns.lineupType"),
    key: "lineupType",
    width: 100,
    align: "center",
    render: (row) => {
      const type = row.lineupType;
      // 从配置中查找对应的颜色，默认灰色
      const rule = LINEUP_RULES.find((r) => r.name === type);
      const colorProps = rule?.colorProps || {
        color: "#f5f5f5",
        textColor: "#666",
      };

      return h(
        NTag,
        { color: colorProps, size: "small", bordered: false },
        { default: () => type || t("peachInfo.common.unknown") },
      );
    },
  },
]);

// 日期选择时调用查询战绩方法
const fetchBattleRecordsByDate = (val) => {
  if (val !== undefined) {
    queryDate.value = val;
  } else {
    queryDate.value = getLastSunday();
  }
  fetchBattleInfo();
};

// Fetch Data
const fetchBattleInfo = async () => {
  if (!tokenStore.selectedToken) {
    message.warning(t("peachInfo.messages.selectRoleFirst"));
    return;
  }

  const tokenId = tokenStore.selectedToken.id;
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error(t("peachInfo.messages.wsDisconnectedQuery"));
    return;
  }

  loading.value = true;
  opponentMembers.value = [];
  try {
    let opponentLegionId;
    let ownLegionId;
    let memberIds = [];
    const shortDate = formatDateToShort(queryDate.value);
    const killRes = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legion_getpayloadkillrecord",
      { date: shortDate },
      10000,
    );

    // Time-based Logic
    // If selected date is today AND it is currently battle time, fetch live data
    if (queryDate.value === getLastSunday() && isSundayBattleTime()) {
      // Sunday 18:00-20:30: Use legion_getpayloadbf
      const res = await tokenStore.sendMessageWithPromise(
        tokenId,
        "legion_getpayloadbf",
        {},
        10000,
      );
      if (!res || !res.legions) {
        message.error(t("peachInfo.messages.battlefieldMissing"));
        loading.value = false;
        return;
      }
      ownLegionId = club.value.id;
      opponentLegionId = res.legions[0].id;
      if (ownLegionId === opponentLegionId) {
        opponentLegionId = res.legions[1].id;
      }
      if (!opponentLegionId) {
        message.error(t("peachInfo.messages.opponentClubIdMissing"));
        return;
      }
    } else {
      // Other times: Use legion_getpayloadrecord + legion_getpayloadkillrecord
      // 1. Get Task (for own ID reference, though not strictly needed if we trust the map)
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "legion_getpayloadtask",
        {},
        10000,
      );

      // 2. Get Record Map
      ownLegionId = club.value.id;
      const res = await tokenStore.sendMessageWithPromise(
        tokenId,
        "legion_getpayloadrecord",
        {},
        10000,
      );
      if (!res || !res.enemyLegionMap) {
        message.warning(t("peachInfo.messages.historyMissing"));
        loading.value = false;
        return;
      }
      const record = res.enemyLegionMap[shortDate];
      if (record) {
        opponentLegionId = record.id;
      } else {
        message.warning(t("peachInfo.messages.recordNotFound", { date: queryDate.value }));
        loading.value = false;
        return;
      }
      if (!opponentLegionId) {
        message.error(t("peachInfo.messages.opponentClubIdMissing"));
        return;
      }
    }

    // Get Opponent Club Details (Name, Logo, etc.)
    const ownLegionIdInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legion_getinfobyid",
      { legionId: ownLegionId },
      10000,
    );
    const clubInfoRes = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legion_getinfobyid",
      { legionId: opponentLegionId },
      10000,
    );

    if (!clubInfoRes || !clubInfoRes.legionData) {
      message.error(t("peachInfo.messages.opponentClubDetailMissing"));
      loading.value = false;
      return;
    }

    const ownKillRecords = killRes?.recordsMap?.[ownLegionId] || [];
    const opponentKillRecords = killRes?.recordsMap?.[opponentLegionId] || [];
    const opponentLegionMembers = clubInfoRes?.legionData?.members || {};
    const opponentClubMemberIds = Object.keys(opponentLegionMembers);
    const opponentKillMemberIds = getUniqueRoleIdsFromKillRecords(opponentKillRecords);
    memberIds = getUniqueMemberIds(opponentClubMemberIds, opponentKillMemberIds);

    // Set Battle Info (Header)
    battleInfo.value = {
      ownClub: {
        id: ownLegionId,
        name: ownLegionIdInfo?.legionData?.name || t("peachInfo.fallbacks.ownClub"),
        level: ownLegionIdInfo?.legionData?.level || 0,
        power: ownLegionIdInfo?.legionData?.power || 0,
        serverId: ownLegionIdInfo?.legionData?.serverId || "",
        logo: ownLegionIdInfo?.legionData?.logo || "",
        quenchNum: ownLegionIdInfo?.legionData?.quenchNum || 0,
        announcement: ownLegionIdInfo?.legionData?.announcement || "",
        memberCount: getLegionMemberCount(ownLegionIdInfo?.legionData, ownKillRecords),
      },
      opponentClub: {
        id: opponentLegionId,
        name: clubInfoRes?.legionData?.name || t("peachInfo.fallbacks.opponentClub"),
        level: clubInfoRes?.legionData?.level || 0,
        power: clubInfoRes?.legionData?.power || 0,
        serverId: clubInfoRes?.legionData?.serverId || "",
        logo: clubInfoRes?.legionData?.logo || "",
        quenchNum: clubInfoRes?.legionData?.quenchNum || 0,
        announcement: clubInfoRes?.legionData?.announcement || "",
        memberCount: getLegionMemberCount(clubInfoRes?.legionData, opponentKillRecords),
      },
    };

    // Get Members List
    // If we didn't get memberIds from killrecord (e.g. Live mode or empty kill record), fallback to club info
    if (memberIds.length === 0) {
      memberIds = Object.keys(opponentLegionMembers);
    }

    const totalMembers = memberIds.length;

    // Fetch details for each member
    // We'll process them in chunks to avoid overwhelming the server/client
    const chunkSize = 5;
    for (let i = 0; i < totalMembers; i += chunkSize) {
      const chunk = memberIds.slice(i, i + chunkSize);
      const promises = chunk.map(async (roleId) => {
        const fallbackMember = opponentLegionMembers?.[roleId] || {};
        try {
          const roleRes = await tokenStore.sendMessageWithPromise(
            tokenId,
            "rank_getroleinfo",
            {
              roleId: Number.parseInt(roleId),
              includeBottleTeam: false,
              isSearch: false, // Need equipment for red count
              bottleType: 0,
              includeHero: true,
              includeHeroDetail: true,
              includePearl: true,
            },
            5000,
          );

          if (roleRes && roleRes.roleInfo) {
            // Process Heroes
            let heroList = [];
            let totalRed = 0;

            if (roleRes.roleInfo.heroes) {
              const heroes = Object.values(roleRes.roleInfo.heroes);
              heroList = heroes
                .map((h) => {
                  // Calculate Red for this hero
                  let heroRed = 0;
                  if (h.equipment) {
                    Object.values(h.equipment).forEach((eq) => {
                      if (eq.quenches) {
                        Object.values(eq.quenches).forEach((q) => {
                          if (q.colorId === 6) heroRed++;
                        });
                      }
                    });
                  }
                  totalRed += heroRed;

                  return {
                    heroId: h.heroId,
                    heroName: HERO_DICT[h.heroId]?.name || t("peachInfo.common.unknown"),
                    red: heroRed,
                    power: h.power,
                    battleTeamSlot: h.battleTeamSlot,
                    HolyBeast: h.hB?.active === true,
                    HBlevel: h.hB?.order || 0,
                  };
                })
                .sort((a, b) => a.battleTeamSlot - b.battleTeamSlot);
            }

            return {
              id: roleRes.roleInfo.roleId,
              name: roleRes.roleInfo.name,
              headImg: roleRes.roleInfo.headImg,
              power: roleRes.roleInfo.power,
              legacy: roleRes.roleInfo.legacy?.color || 0,
              redQuench: totalRed,
              heroList,
              lineupType: getLineupType(heroList),
            };
          }

          // 查询成功但无详细数据时，回退到俱乐部成员信息，确保导出人数完整
          return {
            id: Number.parseInt(roleId, 10),
            name: fallbackMember.name || fallbackMember.custom?.name || roleId,
            headImg: fallbackMember.headImg || fallbackMember.custom?.headImg || "",
            power: fallbackMember.power || 0,
            legacy: fallbackMember.custom?.legacy || 0,
            redQuench: fallbackMember.custom?.red_quench_cnt || 0,
            heroList: [],
            lineupType: t("peachInfo.common.unknown"),
          };
        } catch (e) {
          console.error(`Failed to fetch info for ${roleId}`, e);
          return {
            id: Number.parseInt(roleId, 10),
            name: fallbackMember.name || fallbackMember.custom?.name || roleId,
            headImg: fallbackMember.headImg || fallbackMember.custom?.headImg || "",
            power: fallbackMember.power || 0,
            legacy: fallbackMember.custom?.legacy || 0,
            redQuench: fallbackMember.custom?.red_quench_cnt || 0,
            heroList: [],
            lineupType: t("peachInfo.common.unknown"),
          };
        }
      });

      const results = await Promise.all(promises);
      results.forEach((r) => {
        if (r) opponentMembers.value.push(r);
      });
    }

    // Sort by redQuench Descending, then Power Descending
    opponentMembers.value.sort((a, b) => {
      if (b.redQuench !== a.redQuench) {
        return b.redQuench - a.redQuench;
      }
      return b.power - a.power;
    });

    // 导出图和表格保持同一口径：显示当前可见成员数量
    if (battleInfo.value?.opponentClub) {
      battleInfo.value.opponentClub.memberCount = memberIds.length;
    }
  } catch (error) {
    message.error(t("peachInfo.messages.fetchDataFailed", { error: error.message }));
    console.error(error);
  } finally {
    loading.value = false;
  }
};

const handleExportImage = async () => {
  // 校验：确保DOM已正确绑定
  if (!exportDom.value) {
    message.error(t("peachInfo.messages.exportTargetMissing"));
    return;
  }

  const tableContainer = exportDom.value.querySelector(".n-data-table");
  const membersTable = exportDom.value.querySelector(".members-table");
  const rollbackStyleTasks = [];
  const applyTempStyle = (el, stylePatch = {}) => {
    if (!el) return;
    const prev = {};
    Object.keys(stylePatch).forEach((key) => {
      prev[key] = el.style[key];
      el.style[key] = stylePatch[key];
    });
    rollbackStyleTasks.push(() => {
      Object.keys(stylePatch).forEach((key) => {
        if (prev[key]) {
          el.style[key] = prev[key];
        } else {
          el.style.removeProperty(key.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`));
        }
      });
    });
  };

  try {
    message.loading(t("peachInfo.messages.exportGenerating"));

    // 逐层展开容器，防止导出时只截到可视区域
    applyTempStyle(exportDom.value, {
      height: "auto",
      maxHeight: "none",
      overflow: "visible",
    });
    applyTempStyle(membersTable, {
      height: "auto",
      maxHeight: "none",
      overflow: "visible",
      flex: "0 0 auto",
    });
    applyTempStyle(tableContainer, {
      height: "auto",
      maxHeight: "none",
      overflow: "visible",
    });

    if (tableContainer) {
      applyTempStyle(
        tableContainer.querySelector(".n-data-table-wrapper"),
        {
          height: "auto",
          maxHeight: "none",
          overflow: "visible",
        },
      );
      applyTempStyle(
        tableContainer.querySelector(".n-data-table-base-table"),
        {
          height: "auto",
          maxHeight: "none",
          overflow: "visible",
        },
      );
      applyTempStyle(
        tableContainer.querySelector(".n-data-table-base-table-body"),
        {
          height: "auto",
          maxHeight: "none",
          overflow: "visible",
        },
      );
    }

    // 等待DOM更新
    await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 300));

    const renderedRows = exportDom.value.querySelectorAll(
      ".n-data-table-tbody .n-data-table-tr",
    ).length;
    console.info("[PeachInfo export]", {
      opponentClubMemberCount: battleInfo.value?.opponentClub?.memberCount || 0,
      opponentMembersLength: opponentMembers.value.length,
      renderedRows,
    });

    // 5. 用html2canvas渲染DOM为Canvas
    const canvas = await captureWithHtml2canvas(exportDom.value, {
      scale: 2, // 放大2倍，解决图片模糊问题
      useCORS: true, // 允许跨域图片
      backgroundColor: "#ffffff", // 避免透明背景
      logging: false, // 关闭控制台日志
      allowTaint: true, // 允许跨域图片污染画布
    });

    // 6. Canvas转图片链接并下载
    const filenameBase = `${t("peachInfo.export.filenamePrefix")}_${queryDate.value.replace(/\//g, "-")}`;
    const pageCount = downloadCanvasAsPagedImages(canvas, filenameBase, {
      maxHeight: 4200,
    });
    message.success(
      pageCount > 1
        ? t("peachInfo.messages.exportSuccessWithPages", { count: pageCount })
        : t("peachInfo.messages.exportSuccess"),
    );
  } catch (err) {
    console.error("DOM转图片失败：", err);
    message.error(t("peachInfo.messages.exportFailed"));
  } finally {
    rollbackStyleTasks.reverse().forEach((fn) => fn());
  }
};

onMounted(() => {
  updateMobileFlag();
  window.addEventListener("resize", updateMobileFlag);
  queryDate.value = getLastSunday();
  fetchBattleInfo();
});

onUnmounted(() => {
  window.removeEventListener("resize", updateMobileFlag);
});

watch(
  () => [opponentMembers.value.length, isMobile.value],
  () => {
    enforceAvatarColumnDisplay();
  },
  { flush: "post" },
);
</script>

<style scoped lang="scss">
.modal-w-800 {
  width: min(800px, calc(100vw - 24px));
}

.modal-w-600 {
  width: min(600px, calc(100vw - 24px));
}

.modal-w-800 :deep(.n-card),
.modal-w-600 :deep(.n-card) {
  max-height: calc(100dvh - 24px);
  display: flex;
  flex-direction: column;
}

.modal-w-800 :deep(.n-card__content),
.modal-w-600 :deep(.n-card__content) {
  overflow: auto;
  -webkit-overflow-scrolling: touch;
}

.mr-8 {
  margin-right: 8px;
}

.ml-8 {
  margin-left: 8px;
}

.legacy-tag {
  color: #fff;
  background-color: var(--legacy-bg);
}

.fight-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
}

.debug-info {
  font-size: 12px;
  color: #999;
}

.debug-info-bottom {
  margin-bottom: 10px;
}

.debug-info-top {
  margin-top: 10px;
}

.cursor-pointer {
  cursor: pointer;
}

.peach-info-card {
  background: #fff;
  border-radius: 8px;
  padding: 16px;
  min-height: 400px;
  height: 100%;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: auto;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 0 8px;
  flex-shrink: 0;

  .left {
    display: flex;
    align-items: center;
    gap: 8px;

    .title {
      font-size: 14px;
      color: #666;
    }
  }
}

.main-title {
  text-align: center;
  margin: 0 0 16px 0;
  font-size: 20px;
  font-weight: bold;
  color: #333;
}

.header-section {
  text-align: center;
  margin-bottom: 20px;
  background: linear-gradient(to bottom, #fff5f5, #fff);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid #ffccc7;
  flex-shrink: 0;
}

.club-vs-container {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 20px;
  margin-bottom: 10px;
  width: 100%;
}

.club-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.club-info.own {
  justify-self: end;
}

.club-info.opponent {
  justify-self: start;
}

.club-logo {
  border: 4px solid #fff;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  cursor: default;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.2);
    border-color: #1890ff;
  }
}

.club-details {
  text-align: center;
}

.club-name {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}

.club-stats {
  font-size: 14px;
  color: #ff4d4f;

  &.announcement {
    white-space: pre-wrap;
    word-break: break-all;
    max-width: 300px;
    line-height: 1.5;
  }
}

.vs-badge {
  font-size: 32px;
  font-weight: 900;
  color: #ff7875;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.1);
  font-style: italic;
}

.battle-title {
  font-size: 16px;
  color: #666;
  margin-top: 10px;
  font-weight: bold;
}

.loading-state,
.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 300px;
}

.members-table {
  margin-top: 20px;
  flex: 1 1 auto;
  overflow: auto;
  min-height: 0;
  max-height: calc(100dvh - 320px);
  /* Use NDataTable's scroll or auto here */
  display: flex;
  flex-direction: column;
}

.mobile-member-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.mobile-member-card {
  background: #fff;
  border: 1px solid var(--border-light, #eee);
  border-radius: 10px;
  padding: 10px;
}

.mobile-member-head {
  display: flex;
  align-items: center;
  gap: 8px;
}

.mobile-member-meta {
  min-width: 0;
  flex: 1;
}

.mobile-member-name {
  font-weight: 700;
  color: #1890ff;
  text-decoration: underline;
}

.mobile-member-power {
  font-size: 12px;
  color: #666;
}

.mobile-member-lineup {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.mobile-member-lineup-type {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

.mobile-hero-chip {
  font-size: 12px;
  border: 1px solid #eee;
  border-radius: 999px;
  padding: 2px 6px;
  background: #fafafa;
}

.mobile-hero-empty {
  font-size: 12px;
  color: #999;
}

.table-title {
  font-size: 16px;
  font-weight: bold;
  color: #333;
  margin-bottom: 10px;
  padding-left: 8px;
  border-left: 4px solid #1890ff;
}

:deep(.n-data-table) {
  height: 100%;
}

:deep(.n-data-table-wrapper) {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

:deep(.n-data-table .n-data-table-th) {
  background-color: #fafafa;
  font-weight: bold;
}

/* 兜底：头像列只显示头像，不显示任何额外数字文本 */
:deep(.n-data-table-tbody .n-data-table-td:nth-child(2)) {
  font-size: 0;
  line-height: 0;
}

/* 兜底：头像列出现旧版序号节点时，强制隐藏所有非头像元素 */
:deep(
  .n-data-table-tbody
    .n-data-table-td:nth-child(2)
    > *:not(.member-avatar-cell):not(.member-avatar-placeholder-cell)
) {
  display: none !important;
}

:deep(.n-data-table-tbody .n-data-table-td:nth-child(2) [class*="index"]) {
  display: none !important;
}

:deep(.n-data-table-tbody .n-data-table-td:nth-child(2) span) {
  display: none !important;
}

:deep(.n-data-table-tbody .n-data-table-td:nth-child(2) .member-avatar-cell) {
  display: block;
  margin: 0 auto;
}

:deep(.member-avatar-cell) {
  width: 32px;
  height: 32px;
  border-radius: 50% !important;
  object-fit: cover;
  border: 2px solid #eee;
  transition: all 0.2s;
  display: block;
  margin: 0 auto;

  &:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    border-color: #1890ff;
  }
}

:deep(.member-avatar-placeholder-cell) {
  width: 32px;
  height: 32px;
  border-radius: 50% !important;
  background: linear-gradient(135deg, #1890ff 0%, #69c0ff 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: bold;
  border: 2px solid #eee;
  margin: 0 auto;
}

// 模态框样式
.player-info-content {
  padding: 20px;
}

.player-info-main {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 20px;
  padding-bottom: 15px;
  border-bottom: 1px solid var(--border-light, #eee);
}

.player-avatar {
  border: 2px solid var(--primary-color, #1890ff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.player-info-detail h3 {
  margin: 0 0 8px 0;
  font-size: var(--font-size-lg, 16px);
  font-weight: var(--font-weight-bold, bold);
}

.player-info-detail p {
  margin: 0 0 4px 0;
  font-size: var(--font-size-sm, 14px);
  color: var(--text-secondary, #666);
}

.action-section {
  margin: 15px 0;
  display: flex;
  justify-content: flex-start;
}

.fight-count-container {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: auto;
}

.fight-count-label {
  font-size: var(--font-size-sm, 14px);
  color: var(--text-primary, #333);
  font-weight: var(--font-weight-medium, 500);
  white-space: nowrap;
}

.fight-count-input {
  width: 100px;
}

.fight-count-hint {
  font-size: var(--font-size-xs, 12px);
  color: var(--text-secondary, #999);
}

.fight-count-error {
  font-size: var(--font-size-xs, 12px);
  color: var(--error-color, #ff4d4f);
  margin-left: 4px;
}

.fight-progress {
  margin: 15px 0;
  padding: 15px;
  background: var(--bg-secondary, #f9f9f9);
  border-radius: var(--border-radius-sm, 4px);
  border: 1px solid var(--border-light, #eee);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-title {
  font-size: var(--font-size-sm, 14px);
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #333);
}

.progress-stats {
  display: flex;
  gap: 15px;
  font-size: var(--font-size-xs, 12px);
  color: var(--text-secondary, #666);
}

.fight-result {
  margin: 15px 0;
  padding: 15px;
  background: var(--bg-secondary, #f9f9f9);
  border-radius: var(--border-radius-sm, 4px);
  border: 1px solid var(--border-light, #eee);
}

.fight-result h4 {
  margin: 0 0 12px 0;
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-bold, bold);
}

.result-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.result-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: var(--font-size-sm, 14px);
}

.result-label {
  color: var(--text-secondary, #666);
}

.result-value {
  font-weight: var(--font-weight-medium, 500);
  color: var(--text-primary, #333);
}

.result-value.win {
  color: var(--success-color, #52c41a);
}

.result-value.loss {
  color: var(--error-color, #ff4d4f);
}

.result-actions {
  margin-top: 15px;
  display: flex;
  justify-content: flex-start;
  gap: 8px;
}

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--bg-secondary, #f9f9f9);
  border-top: 1px solid var(--border-light, #eee);
}

/* 武将详情模态框样式 */
.hero-detail-modal {
  .hero-modal-content {
    padding: 20px 0;
  }

  .hero-modal-header {
    display: flex;
    align-items: center;
    gap: 20px;
    margin-bottom: 20px;
  }

  .hero-modal-avatar {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: var(--bg-secondary, #f9f9f9);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 2px solid var(--border-light, #eee);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hero-placeholder {
      font-size: 36px;
      font-weight: var(--font-weight-bold, bold);
      color: var(--text-secondary, #999);
    }
  }

  .hero-modal-basic {
    flex: 1;
  }

  .hero-modal-name {
    margin: 0 0 10px 0;
    font-size: var(--font-size-lg, 16px);
    font-weight: var(--font-weight-bold, bold);
  }

  .hero-modal-stats {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: var(--font-size-sm, 14px);
    color: var(--text-secondary, #666);

    .stat-item {
      padding: 4px 8px;
      background: var(--bg-secondary, #f9f9f9);
      border-radius: var(--border-radius-sm, 4px);
      border: 1px solid var(--border-light, #eee);
    }
  }

  .hero-modal-details {
    margin-bottom: 20px;

    :deep(.n-descriptions) {
      font-size: var(--font-size-sm, 14px);

      .n-descriptions-item-label {
        font-weight: var(--font-weight-medium, 500);
        color: var(--text-primary, #333);
      }

      .n-descriptions-item-content {
        color: var(--text-secondary, #666);
      }
    }
  }

  .hero-modal-equipment {
    margin-top: 20px;
  }

  .section-title {
    margin: 0 0 15px 0;
    font-size: var(--font-size-base, 14px);
    font-weight: var(--font-weight-bold, bold);
  }

  .equipment-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 15px;
  }

  .equipment-item {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .equipment-label {
    font-size: var(--font-size-sm, 14px);
    color: var(--text-primary, #333);
    font-weight: var(--font-weight-medium, 500);
    width: 60px;
  }

  .equipment-slots {
    display: flex;
    gap: 6px;
  }

  .equipment-slot {
    width: 20px;
    height: 20px;
    border: 1px solid var(--border-light, #eee);
    border-radius: var(--border-radius-sm, 4px);
    background: var(--bg-secondary, #f9f9f9);
  }

  .equipment-slot.red-slot {
    background: var(--error-color, #ff4d4f);
    border-color: var(--error-color, #ff4d4f);
  }

  /* 鱼灵洗练颜色块 */
  .ModalEquipment {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    margin-right: 4px;
    display: inline-block;
    vertical-align: middle;
    background-color: var(--equip-color);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .peach-info-card {
    padding: 10px;
    height: auto;
    min-height: 100%;
    overflow: visible;
  }

  .toolbar {
    flex-wrap: wrap;
    gap: 8px;
    padding: 0;

    .left,
    .right {
      width: 100%;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
  }

  .main-title {
    font-size: 16px;
    line-height: 1.4;
    margin-bottom: 10px;
  }

  .header-section {
    padding: 10px;
    margin-bottom: 12px;
  }

  .club-vs-container {
    grid-template-columns: 1fr;
    gap: 10px;
  }

  .club-info.own,
  .club-info.opponent {
    justify-self: stretch;
  }

  .vs-badge {
    font-size: 22px;
  }

  .club-name {
    font-size: 15px;
  }

  .club-stats {
    font-size: 12px;

    &.announcement {
      max-width: 100%;
    }
  }

  .members-table {
    margin-top: 10px;
    overflow: auto;
    max-height: none;
    flex: 0 0 auto;
  }

  :deep(.n-data-table-table) {
    min-width: 980px;
  }

  :deep(.n-data-table-base-table-body) {
    max-height: none !important;
    overflow: visible !important;
  }

  :deep(.n-data-table-th),
  :deep(.n-data-table-td) {
    white-space: nowrap;
  }

  :deep(.n-modal-body-wrapper) {
    padding: 0;
  }

  .modal-w-800 :deep(.n-card),
  .modal-w-600 :deep(.n-card) {
    max-height: calc(100dvh - 12px);
  }

  .player-info-content {
    padding: 10px;
  }

  .player-info-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .action-section {
    flex-wrap: wrap;
    gap: 8px;
  }

  .fight-inline {
    flex-wrap: wrap;
    width: 100%;
  }

  .fight-count-container {
    flex-wrap: wrap;
    margin-right: 0;
    width: 100%;
  }

  .fight-count-input {
    width: 100%;
    min-width: 0;
  }

  .hero-list {
    grid-template-columns: 1fr;
  }

  .hero-item {
    padding: 10px;
  }

  .hero-detail-modal {
    :deep(.n-modal-content) {
      padding: 0 !important;
    }

    .hero-modal-header {
      flex-direction: column;
      text-align: center;
    }

    .equipment-grid {
      grid-template-columns: 1fr;
    }
  }
}

/* 切磋结果显示样式 */
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
  gap: 15px;
}

.battle-side {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
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

.battle-vs {
  font-size: var(--font-size-sm, 14px);
  font-weight: var(--font-weight-bold, bold);
  color: var(--text-secondary, #999);
  margin: 0 10px;
}

/* 响应式设计 */
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

.player-heroes {
  margin-top: 20px;
}

.player-heroes h4 {
  margin: 0 0 12px 0;
  font-size: var(--font-size-base, 14px);
  font-weight: var(--font-weight-bold, bold);
}

.hero-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.hero-item {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-secondary, #f9f9f9);
  padding: 12px 16px;
  border-radius: var(--border-radius-sm, 4px);
  border: 1px solid var(--border-light, #eee);
  transition: all var(--transition-fast, 0.3s ease);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm, 0 1px 2px rgba(0, 0, 0, 0.1));
    border-color: var(--primary-color, #1890ff);
  }
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.hero-name {
  font-size: var(--font-size-sm, 14px);
  font-weight: var(--font-weight-medium, 500);
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--font-size-xs, 12px);
  color: var(--text-secondary, #666);
}

.hero-stats span {
  padding: 2px 6px;
  background: var(--bg-primary, #fff);
  border-radius: var(--border-radius-full, 99px);
  border: 1px solid var(--border-light, #eee);
}

.hero-stats span.opened {
  background: rgba(82, 196, 26, 0.1);
  color: var(--success-color, #52c41a);
  border-color: var(--success-color, #52c41a);
}

.hero-stats span.closed {
  background: rgba(250, 173, 20, 0.1);
  color: var(--warning-color, #faad14);
  border-color: var(--warning-color, #faad14);
}

.empty-heroes {
  background: var(--bg-secondary, #f9f9f9);
  padding: 30px;
  border-radius: var(--border-radius-sm, 4px);
  border: 1px solid var(--border-light, #eee);
  text-align: center;
  color: var(--text-secondary, #666);
  font-size: var(--font-size-sm, 14px);
}
</style>
