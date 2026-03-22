<template>
  <div
    class="game-status-container"
    :class="{
      'full-grid':
        activeSection === 'fightPvp' ||
        activeSection === 'arenaPvp' ||
        activeSection === 'resourceChanges' ||
        activeSection === 'goldFishCalc' ||
        activeSection === 'tenHall',
      'full-page-mode':
        activeSection === 'saltFieldGroup' ||
        activeSection === 'peachGroup' ||
        activeSection === 'rankGroup',
      'club-mode': activeSection === 'club',
    }"
  >
    <!-- 身份牌常驻（嵌入式，Tabs 上方） -->
    <IdentityCard embedded></IdentityCard>

    <!-- 下方选卡分区切换（Tabs）：日常｜俱乐部｜活动 -->
    <n-tabs
      animated
      class="section-tabs"
      size="small"
      type="line"
      v-model:value="activeSection"
    >
      <n-tab-pane name="daily" :tab="t('gameStatus.sections.daily')"></n-tab-pane>
      <n-tab-pane
        v-if="canAccessRestrictedGameSections"
        name="club"
        :tab="t('gameStatus.sections.club')"
      ></n-tab-pane>
      <n-tab-pane name="activity" :tab="t('gameStatus.sections.activity')"></n-tab-pane>
      <n-tab-pane v-if="ENABLE_TOOLS_TAB" name="tools" :tab="t('gameStatus.sections.tools')"></n-tab-pane>
      <n-tab-pane
        v-if="canAccessRestrictedGameSections"
        name="saltFieldGroup"
        :tab="t('gameStatus.sections.saltField')"
      ></n-tab-pane>
      <n-tab-pane
        v-if="canAccessRestrictedGameSections"
        name="peachGroup"
        :tab="t('gameStatus.sections.peachGroup')"
      ></n-tab-pane>
      <n-tab-pane name="rankGroup" :tab="t('gameStatus.sections.rankGroup')"></n-tab-pane>
      <n-tab-pane name="fightPvp" :tab="t('gameStatus.sections.fightPvp')"></n-tab-pane>
      <n-tab-pane name="arenaPvp" :tab="t('gameStatus.sections.arenaPvp')"></n-tab-pane>
      <n-tab-pane name="resourceChanges" :tab="t('gameStatus.sections.resourceChanges')"></n-tab-pane>
      <n-tab-pane name="goldFishCalc" :tab="t('gameStatus.sections.goldFishCalc')"></n-tab-pane>
      <n-tab-pane name="tenHall" :tab="t('gameStatus.sections.tenHall')"></n-tab-pane>
    </n-tabs>

    <!-- 阵容（仅日常） -->
    <TeamFormation v-show="activeSection === 'daily'"></TeamFormation>

    <!-- 每日任务状态（仅日常） -->
    <DailyTaskStatus v-show="activeSection === 'daily'"></DailyTaskStatus>

    <!-- 咸将塔状态 -->
    <TowerStatus
      v-show="activeSection === 'daily' && isShowTowerStatus"
    ></TowerStatus>

    <!-- 怪异塔状态 -->
    <WeirdTowerStatus v-show="activeSection === 'daily'"></WeirdTowerStatus>

    <!-- 盐罐机器人状态（提取组件） -->
    <BottleHelperCard v-show="activeSection === 'daily'"></BottleHelperCard>

    <!-- 挂机状态（提取组件） -->
    <HangUpStatusCard v-show="activeSection === 'daily'"></HangUpStatusCard>

    <!-- 宝箱助手（提取组件） -->
    <BoxHelperCard v-show="activeSection === 'tools'"></BoxHelperCard>

    <!-- 钓鱼助手（提取组件） -->
    <FishHelperCard v-show="activeSection === 'tools'"></FishHelperCard>

    <!-- 招募助手（提取组件） -->
    <RecruitHelperCard v-show="activeSection === 'tools'"></RecruitHelperCard>

    <!-- 升星助手（提取组件） -->
    <StarUpgradeCard v-if="activeSection === 'tools'"></StarUpgradeCard>

    <!-- 竞技场助手（提取组件） -->
    <FightHelperCard v-if="activeSection === 'tools'"></FightHelperCard>

    <!-- 梦境助手（提取组件） -->
    <DreamHelperCard v-if="activeSection === 'tools'"></DreamHelperCard>

    <!-- 武将升级助手（提取组件） -->
    <HeroUpgradeCard v-if="activeSection === 'tools'"></HeroUpgradeCard>

    <!-- 洗练助手（提取组件） -->
    <RefineHelperCard v-if="activeSection === 'tools'"></RefineHelperCard>

    <!-- 消耗活动进度（提取组件） -->
    <ConsumptionProgressCard
      v-if="activeSection === 'tools'"
    ></ConsumptionProgressCard>
    <!-- 咸王宝库（提取组件） -->
    <BossTower v-if="activeSection === 'tools'"></BossTower>
    <!-- 俱乐部排位（暂时隐藏） -->
    <div
      v-if="ENABLE_LEGION_MATCH && activeSection === 'club'"
      class="status-card legion-match"
    >
      <div class="card-header">
        <img
          class="status-icon"
          src="/icons/1733492491706152.png"
          :alt="t('gameStatus.legionMatch.iconAlt')"
        >
        <div class="status-info">
          <h3>{{ t("gameStatus.legionMatch.title") }}</h3>
          <p>{{ t("gameStatus.legionMatch.subtitle") }}</p>
        </div>
        <div class="status-badge" :class="{ active: legionMatch.isRegistered }">
          <div class="status-dot"></div>
          <span>{{
            legionMatch.isRegistered
              ? t("gameStatus.legionMatch.statusRegistered")
              : t("gameStatus.legionMatch.statusNotRegistered")
          }}</span>
        </div>
      </div>
      <div class="card-content">
        <p class="description">
          {{ t("gameStatus.legionMatch.descriptionLine1") }}<br>
          {{ t("gameStatus.legionMatch.descriptionLine2") }}
        </p>
        <button
          class="action-button"
          :disabled="legionMatch.isRegistered"
          @click="registerLegionMatch"
        >
          {{
            legionMatch.isRegistered
              ? t("gameStatus.legionMatch.actionRegistered")
              : t("gameStatus.legionMatch.actionRegister")
          }}
        </button>
      </div>
    </div>

    <!-- 俱乐部赛车（合并自俱乐部赛车 + 疯狂赛车） -->

    <!-- 俱乐部签到（已迁移到俱乐部信息-概览，故隐藏原卡片） -->
    <div
      v-if="ENABLE_LEGION_SIGNIN_CARD && activeSection === 'club'"
      class="status-card legion-signin"
    >
      <div class="card-header">
        <img
          class="status-icon"
          src="/icons/1733492491706148.png"
          :alt="t('gameStatus.legionSignin.iconAlt')"
        >
        <div class="status-info">
          <h3>{{ t("gameStatus.legionSignin.title") }}</h3>
          <p>{{ t("gameStatus.legionSignin.subtitle") }}</p>
        </div>
        <div class="status-badge" :class="{ active: legionSignin.isSignedIn }">
          <div class="status-dot"></div>
          <span>{{
            legionSignin.isSignedIn
              ? t("gameStatus.legionSignin.statusSigned")
              : t("gameStatus.legionSignin.statusPending")
          }}</span>
        </div>
      </div>
      <div class="card-content">
        <p v-if="legionSignin.clubName" class="club-name">
          {{ t("gameStatus.legionSignin.currentClub") }}<br>
          <strong>{{ legionSignin.clubName }}</strong>
        </p>
        <p v-else class="description">{{ t("gameStatus.legionSignin.noClub") }}</p>
        <div class="action-row">
          <button
            class="action-button"
            :disabled="legionSignin.isSignedIn"
            @click="signInLegion"
          >
            {{
              legionSignin.isSignedIn
                ? t("gameStatus.legionSignin.actionSigned")
                : t("gameStatus.legionSignin.actionSign")
            }}
          </button>
        </div>
      </div>
    </div>

    <!-- 俱乐部信息与疯狂赛车（同级卡片，仅俱乐部分区） -->
    <ClubInfo
      v-if="canAccessRestrictedGameSections && activeSection === 'club'"
    ></ClubInfo>
    <ClubCarKing
      v-if="canAccessRestrictedGameSections && activeSection === 'club'"
    ></ClubCarKing>

    <!-- 月度任务进度（提取组件） -->
    <MonthlyTasksCard v-show="activeSection === 'activity'"></MonthlyTasksCard>

    <!-- 咸鱼大冲关（提取组件） -->
    <StudyChallengeCard
      v-show="activeSection === 'activity'"
    ></StudyChallengeCard>

    <!-- 换皮闯关 -->
    <SkinChallengeCard
      v-show="activeSection === 'activity'"
    ></SkinChallengeCard>

    <!-- 盐场分组（包含盐场、周战绩、月战绩） -->
    <div
      v-if="canAccessRestrictedGameSections && activeSection === 'saltFieldGroup'"
      class="salt-field-group"
    >
      <div class="sub-nav sub-nav-center">
        <n-tabs
          animated
          class="sub-tabs"
          size="small"
          type="segment"
          v-model:value="saltFieldSubTab"
        >
          <n-tab-pane name="warrank" :tab="t('gameStatus.saltFieldTabs.warrank')"></n-tab-pane>
          <n-tab-pane name="weekBattle" :tab="t('gameStatus.saltFieldTabs.weekBattle')"></n-tab-pane>
          <n-tab-pane name="monthBattle" :tab="t('gameStatus.saltFieldTabs.monthBattle')"></n-tab-pane>
          <n-tab-pane name="legionWarMap" :tab="t('gameStatus.saltFieldTabs.legionWarMap')"></n-tab-pane>
          <n-tab-pane name="legionWarStatistics" :tab="t('gameStatus.saltFieldTabs.legionWarStatistics')"></n-tab-pane>
        </n-tabs>
      </div>

      <div
        v-if="saltFieldSubTab === 'weekBattle'"
        class="warrank-full-container"
      >
        <ClubBattleRecords></ClubBattleRecords>
      </div>

      <div v-if="saltFieldSubTab === 'warrank'" class="warrank-full-container">
        <ClubWarrank></ClubWarrank>
      </div>

      <div
        v-if="saltFieldSubTab === 'monthBattle'"
        class="warrank-full-container"
      >
        <ClubMonthBattleRecords></ClubMonthBattleRecords>
      </div>

      <div
        v-if="saltFieldSubTab === 'legionWarMap'"
        class="warrank-full-container"
      >
        <LegionWarMap></LegionWarMap>
      </div>
      <div
        v-if="saltFieldSubTab === 'legionWarStatistics'"
        class="warrank-full-container"
      >
        <LegionWarStatistics></LegionWarStatistics>
      </div>
    </div>

    <!-- 蟠桃园分组 -->
    <div
      v-if="canAccessRestrictedGameSections && activeSection === 'peachGroup'"
      class="peach-group"
    >
      <div class="sub-nav sub-nav-center">
        <n-tabs
          animated
          class="sub-tabs"
          size="small"
          type="segment"
          v-model:value="peachSubTab"
        >
          <n-tab-pane name="peach" :tab="t('gameStatus.peachTabs.peach')"></n-tab-pane>
          <n-tab-pane name="peachBattle" :tab="t('gameStatus.peachTabs.peachBattle')"></n-tab-pane>
        </n-tabs>
      </div>

      <div v-if="peachSubTab === 'peachBattle'" class="warrank-full-container">
        <PeachBattleRecords></PeachBattleRecords>
      </div>

      <div v-if="peachSubTab === 'peach'" class="warrank-full-container">
        <PeachInfo></PeachInfo>
      </div>
    </div>

    <!-- 排行榜分组 -->
    <div v-if="activeSection === 'rankGroup'" class="rank-group">
      <div class="sub-nav sub-nav-center">
        <n-tabs
          animated
          class="sub-tabs"
          size="small"
          type="segment"
          v-model:value="rankSubTab"
        >
          <n-tab-pane name="serverrank" :tab="t('gameStatus.rankTabs.serverrank')"></n-tab-pane>
          <n-tab-pane name="toprank" :tab="t('gameStatus.rankTabs.toprank')"></n-tab-pane>
          <n-tab-pane name="topclubrank" :tab="t('gameStatus.rankTabs.topclubrank')"></n-tab-pane>
          <n-tab-pane name="goldclubrank" :tab="t('gameStatus.rankTabs.goldclubrank')"></n-tab-pane>
          <n-tab-pane name="greatRouteRank" :tab="t('gameStatus.rankTabs.greatRouteRank')"></n-tab-pane>
        </n-tabs>
      </div>

      <div v-if="rankSubTab === 'serverrank'" class="warrank-full-container">
        <ServerRankList></ServerRankList>
      </div>

      <div v-if="rankSubTab === 'toprank'" class="warrank-full-container">
        <TopRankList></TopRankList>
      </div>

      <div v-if="rankSubTab === 'topclubrank'" class="warrank-full-container">
        <TopClubList></TopClubList>
      </div>

      <div v-if="rankSubTab === 'goldclubrank'" class="warrank-full-container">
        <GoldClubList></GoldClubList>
      </div>

      <div
        v-if="rankSubTab === 'greatRouteRank'"
        class="warrank-full-container"
      >
        <GreatRouteRankList></GreatRouteRankList>
      </div>
    </div>
    <!-- 切磋（提取组件） -->
    <FightPvp v-if="activeSection === 'fightPvp'"></FightPvp>
    <ArenaPvp v-if="activeSection === 'arenaPvp'"></ArenaPvp>
    <ResourceDataChanges
      v-if="activeSection === 'resourceChanges'"
    ></ResourceDataChanges>
    <GoldFishCalculator
      v-if="activeSection === 'goldFishCalc'"
    ></GoldFishCalculator>
    <TenHallTeamBattleCard
      v-if="activeSection === 'tenHall'"
    ></TenHallTeamBattleCard>
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import { useAuthStore } from "@/stores/auth";
import { useTokenStore } from "@/stores/tokenStore";
import { hasGameFeatureAccess } from "@/utils/accessScope";

const BottleHelperCard = defineAsyncComponent(
  () => import("./cards/BottleHelperCard.vue"),
);
const BoxHelperCard = defineAsyncComponent(
  () => import("./cards/BoxHelperCard.vue"),
);
const FishHelperCard = defineAsyncComponent(
  () => import("./cards/FishHelperCard.vue"),
);
const RecruitHelperCard = defineAsyncComponent(
  () => import("./cards/RecruitHelperCard.vue"),
);
const StarUpgradeCard = defineAsyncComponent(
  () => import("./cards/StarUpgradeCard.vue"),
);
const HangUpStatusCard = defineAsyncComponent(
  () => import("./cards/HangUpStatusCard.vue"),
);
const MonthlyTasksCard = defineAsyncComponent(
  () => import("./cards/MonthlyTasksCard.vue"),
);
const StudyChallengeCard = defineAsyncComponent(
  () => import("./cards/StudyChallengeCard.vue"),
);
const SkinChallengeCard = defineAsyncComponent(
  () => import("./cards/SkinChallengeCard.vue"),
);
const ClubWarrank = defineAsyncComponent(
  () => import("./Club/ClubWarrank.vue"),
);
const ClubMonthBattleRecords = defineAsyncComponent(
  () => import("./Club/ClubMonthBattleRecords.vue"),
);
const ClubBattleRecords = defineAsyncComponent(
  () => import("./Club/ClubBattleRecords.vue"),
);
const PeachBattleRecords = defineAsyncComponent(
  () => import("./Club/PeachBattleRecords.vue"),
);
const TopRankList = defineAsyncComponent(
  () => import("./cards/TopRankListPageCard.vue"),
);
const TopClubList = defineAsyncComponent(
  () => import("./cards/TopClubListPageCard.vue"),
);
const GreatRouteRankList = defineAsyncComponent(
  () => import("./Club/GreatRouteRankListPageCard.vue"),
);
const GoldClubList = defineAsyncComponent(
  () => import("./cards/GoldRankListPageCard.vue"),
);
const FightPvp = defineAsyncComponent(() => import("./cards/FightPvp.vue"));
const ResourceDataChanges = defineAsyncComponent(
  () => import("./cards/ResourceDataChanges.vue"),
);
const GoldFishCalculator = defineAsyncComponent(
  () => import("./cards/GoldFishCalculator.vue"),
);
const TenHallTeamBattleCard = defineAsyncComponent(
  () => import("./cards/TenHallTeamBattleCard.vue"),
);
const FightHelperCard = defineAsyncComponent(
  () => import("./cards/FightHelperCard.vue"),
);
const ArenaPvp = defineAsyncComponent(() => import("./cards/ArenaPvp.vue"));
const DreamHelperCard = defineAsyncComponent(
  () => import("./cards/DreamHelperCard.vue"),
);
const HeroUpgradeCard = defineAsyncComponent(
  () => import("./cards/HeroUpgradeCard.vue"),
);
const ConsumptionProgressCard = defineAsyncComponent(
  () => import("./cards/ConsumptionProgressCard.vue"),
);
const RefineHelperCard = defineAsyncComponent(
  () => import("./cards/RefineHelperCard.vue"),
);
const TowerStatus = defineAsyncComponent(
  () => import("./Tower/TowerStatus.vue"),
);
const WeirdTowerStatus = defineAsyncComponent(
  () => import("./Tower/WeirdTowerStatus.vue"),
);
const BossTower = defineAsyncComponent(() => import("./Tower/BossTower.vue"));
const PeachInfo = defineAsyncComponent(() => import("./Club/PeachInfo.vue"));
const ServerRankList = defineAsyncComponent(
  () => import("./cards/ServerRankListPageCard.vue"),
);
const LegionWarMap = defineAsyncComponent(
  () => import("./Club/LegionWarMap.vue"),
);
const LegionWarStatistics = defineAsyncComponent(
  () => import("./Club/LegionWarStatistics.vue"),
);

const tokenStore = useTokenStore();
const authStore = useAuthStore();
const { t } = useI18n();
const legionMatch = ref({
  isRegistered: false,
});

// 响应式数据
const activeSection = ref("daily");
const saltFieldSubTab = ref("warrank");
const peachSubTab = ref("peach");
const rankSubTab = ref("serverrank");

const bottleHelper = ref({
  isRunning: false,
  remainingTime: 0,
  stopTime: 0,
});

const hangUp = ref({
  isActive: false,
  remainingTime: 0,
  elapsedTime: 0,
  lastTime: 0,
  hangUpTime: 0,
  isExtending: false, // 加钟状态
  isClaiming: false, // 领取奖励状态
});

const legionSignin = ref({
  isSignedIn: false,
  clubName: "",
});

// 计算属性
const roleInfo = computed(() => {
  return tokenStore.gameData?.roleInfo || null;
});
const canAccessRestrictedGameSections = computed(() =>
  hasGameFeatureAccess(authStore.user),
);
const isShowTowerStatus = computed(() => {
  const tower = roleInfo.value?.role?.tower;
  const towerId = tower?.id;
  const floor = Math.floor(towerId / 10) + 1;
  if (floor > 450) {
    return false;
  }
  return true;
});

// 更新数据
const updateGameStatus = () => {
  if (!roleInfo.value) return;

  const role = roleInfo.value.role;

  // 更新盐罐机器人状态
  if (role.bottleHelpers) {
    const now = Date.now() / 1000;
    bottleHelper.value.stopTime = role.bottleHelpers.helperStopTime;
    bottleHelper.value.isRunning = role.bottleHelpers.helperStopTime > now;
    // 确保剩余时间为整数秒
    bottleHelper.value.remainingTime = Math.max(
      0,
      Math.floor(role.bottleHelpers.helperStopTime - now),
    );
    // 控制台精简，避免频繁刷屏
  }

  // 更新挂机状态
  if (role.hangUp) {
    const now = Date.now() / 1000;
    hangUp.value.lastTime = role.hangUp.lastTime;
    hangUp.value.hangUpTime = role.hangUp.hangUpTime;

    const elapsed = now - hangUp.value.lastTime;
    if (elapsed <= hangUp.value.hangUpTime) {
      // 确保剩余时间为整数秒
      hangUp.value.remainingTime = Math.floor(
        hangUp.value.hangUpTime - elapsed,
      );
      hangUp.value.isActive = true;
    } else {
      hangUp.value.remainingTime = 0;
      hangUp.value.isActive = false;
    }
    // 确保已挂机时间为整数秒
    hangUp.value.elapsedTime = Math.floor(
      hangUp.value.hangUpTime - hangUp.value.remainingTime,
    );
    // 控制台精简
  }

  // 更新俱乐部排位状态
  if (role.statistics) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime() / 1000;

    legionMatch.value.isRegistered =
      Number(role.statistics["last:legion:match:sign:up:time"]) >
      todayTimestamp;
  }

  // 更新俱乐部签到状态
  if (role.statisticsTime) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime() / 1000;

    legionSignin.value.isSignedIn =
      role.statisticsTime["legion:sign:in"] > todayTimestamp;
  }
};

// 定时器更新
let timer = null;
const startTimer = () => {
  if (timer) clearInterval(timer);
  timer = setInterval(() => {
    // 更新盐罐机器人剩余时间
    if (bottleHelper.value.isRunning && bottleHelper.value.remainingTime > 0) {
      bottleHelper.value.remainingTime = Math.max(
        0,
        bottleHelper.value.remainingTime - 1,
      );
      if (bottleHelper.value.remainingTime <= 0) {
        bottleHelper.value.isRunning = false;
      }
    }

    // 更新挂机剩余时间
    if (hangUp.value.isActive && hangUp.value.remainingTime > 0) {
      hangUp.value.remainingTime = Math.max(0, hangUp.value.remainingTime - 1);
      hangUp.value.elapsedTime = hangUp.value.elapsedTime + 1;
      if (hangUp.value.remainingTime <= 0) {
        hangUp.value.isActive = false;
      }
    }
  }, 1000);
};

// 功能开关：暂时隐藏俱乐部排位与旧签到卡片
const ENABLE_LEGION_MATCH = false;
const ENABLE_LEGION_SIGNIN_CARD = false;
const ENABLE_TOOLS_TAB = true; // 工具分区开关

// 盐场战绩入口已移动至俱乐部信息模块

// 学习答题逻辑已移动到 StudyChallengeCard 组件

// 监听角色信息变化
watch(
  roleInfo,
  (newValue) => {
    if (newValue) {
      updateGameStatus();
    }
  },
  { deep: true, immediate: true },
);

watch(
  [activeSection, canAccessRestrictedGameSections],
  ([section, canAccess]) => {
    if (canAccess) return;
    if (section === "club" || section === "saltFieldGroup" || section === "peachGroup") {
      activeSection.value = "daily";
    }
  },
  { immediate: true },
);

// 监听 WebSocket 连接状态（俱乐部信息）
const hasFetchedLegionOnce = ref(false);
watch(
  () =>
    tokenStore.selectedToken
      ? tokenStore.getWebSocketStatus(tokenStore.selectedToken.id)
      : "disconnected",
  (status) => {
    if (status === "connected") {
      if (!hasFetchedLegionOnce.value && tokenStore.selectedToken) {
        hasFetchedLegionOnce.value = true;
        const tokenId = tokenStore.selectedToken.id;
        tokenStore.sendMessage(tokenId, "legion_getinfo");
      }
    }
  },
);

// 战绩加载逻辑现由俱乐部信息模块负责

// 生命周期
onMounted(() => {
  updateGameStatus();
  startTimer();
  // 获取俱乐部信息
  if (
    tokenStore.selectedToken &&
    tokenStore.getWebSocketStatus(tokenStore.selectedToken.id) === "connected"
  ) {
    const tokenId = tokenStore.selectedToken.id;
    tokenStore.sendMessage(tokenId, "legion_getinfo");
    hasFetchedLegionOnce.value = true;
  }
});

// 组件卸载时清理定时器
onUnmounted(() => {
  if (timer) {
    clearInterval(timer);
  }
});
</script>

<style scoped lang="scss">
.sub-nav-center {
  padding: 8px;
  background: var(--n-color);
  display: flex;
  justify-content: center;
}

.game-status-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  overflow-x: hidden;

  // 在大屏幕上限制最大列数以确保卡片有足够宽度
  @media (min-width: 1400px) {
    grid-template-columns: repeat(3, 1fr);
    max-width: 1400px;
    margin: 0 auto;
  }

  // 在中等屏幕上确保有足够空间
  @media (max-width: 1200px) {
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  }

  // 在较小屏幕上使用单列布局
  @media (max-width: 900px) {
    grid-template-columns: 1fr;
    gap: var(--spacing-md);
  }

  @media (max-width: 768px) {
    grid-template-columns: minmax(0, 1fr);
    padding: var(--spacing-sm);
    gap: var(--spacing-md);
  }
}

.full-grid {
  grid-template-columns: repeat(1, 1fr);
}

.game-status-container.full-page-mode {
  max-width: 100% !important;
  grid-template-columns: 1fr;
  padding: var(--spacing-sm);

  @media (min-width: 1400px) {
    max-width: 100% !important;
  }
}

.game-status-container.club-mode {
  @media (min-width: 1400px) {
    grid-template-columns: repeat(2, 1fr);
    max-width: 100% !important;
  }
}

.section-header {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px var(--spacing-sm);
}

.identity-toggle {
  padding: 6px 12px;
  border: 1px solid var(--border-light);
  border-radius: 999px;
  background: var(--bg-primary);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  cursor: pointer;
}

.section-tabs {
  margin: 0 var(--spacing-sm) var(--spacing-md) var(--spacing-sm);
  grid-column: 1 / -1;
  border-bottom: 1px solid var(--border-light);
  overflow: auto;
}

.section-tabs :deep(.n-tabs-pane-wrapper) {
  display: none;
}

.section-tabs :deep(.n-tabs-nav-scroll-wrapper) {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.section-tabs :deep(.n-tabs-nav-scroll-content) {
  display: inline-flex;
  flex-wrap: nowrap;
  min-width: max-content;
}

.sub-tabs :deep(.n-tabs-nav-scroll-wrapper) {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
}

.sub-tabs :deep(.n-tabs-nav-scroll-content) {
  display: inline-flex;
  flex-wrap: nowrap;
  min-width: max-content;
}

.warrank-full-container {
  grid-column: 1 / -1;
  width: 100%;
  height: calc(100dvh - 200px);
  min-height: 600px;
  overflow: auto;

  @media (max-width: 768px) {
    height: auto;
    min-height: calc(100dvh - 180px);
    overflow: visible;
    padding-bottom: env(safe-area-inset-bottom);
  }
}

.salt-field-group,
.peach-group,
.rank-group {
  grid-column: 1 / -1;
  width: 100%;
  display: flex;
  flex-direction: column;
}

.monthly-tasks .description.muted {
  color: var(--text-tertiary);
  margin-top: var(--spacing-sm);
}

.monthly-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--spacing-xs);
  font-size: var(--font-size-sm);
}

.status-dot {
  &.completed {
    background: var(--success-color);
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
  }
}

.energy-icon {
  width: 16px;
  height: 16px;
  object-fit: contain;
}

.card-content {
  .time-display {
    font-size: 1.5rem;
    /* text-2xl */
    font-weight: 700;
    /* font-bold */
    color: var(--text-primary);
    text-align: center;
    margin-bottom: var(--spacing-md);
    font-family:
      "SF Mono", "Monaco", "Inconsolata", "Roboto Mono", "Consolas", monospace;
    letter-spacing: 0.1em;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    background: var(--bg-tertiary);
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid var(--border-light);
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.1),
      0 1px 2px rgba(0, 0, 0, 0.06);
    transition: all 0.2s ease-in-out;

    &:hover {
      transform: translateY(-1px);
      box-shadow:
        0 4px 6px rgba(0, 0, 0, 0.1),
        0 2px 4px rgba(0, 0, 0, 0.06);
    }
  }

  .description {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    line-height: 1.5;
    margin-bottom: var(--spacing-lg);
  }

  .club-name {
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    margin-bottom: var(--spacing-lg);

    strong {
      color: var(--text-primary);
      font-weight: var(--font-weight-medium);
    }
  }

  .tower-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);

    .label {
      color: var(--text-secondary);
      font-size: var(--font-size-sm);
    }

    .tower-level {
      font-size: var(--font-size-lg);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
    }
  }
}

.action-row {
  display: flex;
  gap: var(--spacing-sm);

  .action-button {
    flex: 1;
  }
}

.loading-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--spacing-xs);
}

.loading-icon {
  width: 16px;
  height: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

// 响应式设计
@media (max-width: 768px) {
  .game-status-container {
    grid-template-columns: 1fr;
    padding: var(--spacing-sm);
  }

  .section-tabs {
    margin: 0 0 var(--spacing-sm) 0;
  }

  .sub-nav-center {
    justify-content: flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .status-card {
    padding: var(--spacing-md);
  }

  .card-header {
    flex-wrap: wrap;
    gap: var(--spacing-sm);

    .status-info {
      flex: 1;
      min-width: 120px;
    }

    .status-badge {
      margin-left: auto;
    }
  }
}
</style>
