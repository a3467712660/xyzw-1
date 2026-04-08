<template>
  <div
    class="game-status-shell"
    :class="{
      'game-status-shell--no-rail': !showModuleRail,
      'game-status-shell--no-intel': !showIntelPanel,
    }"
  >
    <GameStatusModuleRail
      v-if="showModuleRail"
      v-model="activeModule"
      :drawer-title="t('gameStatus.navigation.drawerTitle')"
      :mobile-button-label="t('gameStatus.navigation.mobileButton')"
      :modules="modules"
      :subtitle="t('gameStatus.navigation.subtitle')"
      :title="t('gameStatus.navigation.title')"
    ></GameStatusModuleRail>

    <GameStatusModuleStage
      v-model="activeSection"
      :compact-label="t('gameStatus.stage.compactLabel')"
      :drawer-title="t('gameStatus.stage.drawerTitle')"
      :embedded="isEmbeddedWorkbench"
      :mobile-button-label="t('gameStatus.stage.mobileButton')"
      :module="currentModule"
      :nav-label="t('gameStatus.stage.navLabel')"
      :sections="currentModule?.sections || []"
      :show-header="!isEmbeddedWorkbench"
      :title="t('gameStatus.stage.title')"
    >
      <div
        class="game-status-container"
        :class="{
          'full-grid':
            activeSection === 'fightPvp'
              || activeSection === 'arenaPvp'
              || activeSection === 'resourceChanges'
              || activeSection === 'goldFishCalc'
              || activeSection === 'tenHall',
          'full-page-mode':
            activeSection === 'saltFieldGroup'
              || activeSection === 'peachGroup'
              || activeSection === 'rankGroup',
          'club-mode': activeSection === 'club',
        }"
      >
        <TeamFormation
          v-show="activeSection === 'daily'"
          :panel-active="activeSection === 'daily'"
        ></TeamFormation>
        <DailyTaskStatus
          v-show="activeSection === 'daily'"
          :panel-active="activeSection === 'daily'"
        ></DailyTaskStatus>

        <TowerStatus
          v-if="mountedSections.dailyExtras && isShowTowerStatus"
          v-show="activeSection === 'daily'"
          :panel-active="activeSection === 'daily'"
        ></TowerStatus>
        <WeirdTowerStatus
          v-if="mountedSections.dailyExtras"
          v-show="activeSection === 'daily'"
          :panel-active="activeSection === 'daily'"
        ></WeirdTowerStatus>
        <BottleHelperCard
          v-if="mountedSections.dailyExtras"
          v-show="activeSection === 'daily'"
          :panel-active="activeSection === 'daily'"
        ></BottleHelperCard>
        <HangUpStatusCard
          v-if="mountedSections.dailyExtras"
          v-show="activeSection === 'daily'"
          :panel-active="activeSection === 'daily'"
        ></HangUpStatusCard>

        <BoxHelperCard
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></BoxHelperCard>
        <FishHelperCard
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></FishHelperCard>
        <RecruitHelperCard
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></RecruitHelperCard>
        <StarUpgradeCard
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></StarUpgradeCard>
        <FightHelperCard
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></FightHelperCard>
        <DreamHelperCard
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></DreamHelperCard>
        <HeroUpgradeCard
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></HeroUpgradeCard>
        <RefineHelperCard
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></RefineHelperCard>
        <ConsumptionProgressCard
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></ConsumptionProgressCard>
        <BossTower
          v-if="mountedSections.tools"
          v-show="activeSection === 'tools'"
          :panel-active="activeSection === 'tools'"
        ></BossTower>

        <div
          v-if="ENABLE_LEGION_MATCH && activeSection === 'club'"
          class="gwb2-mini-card legion-match-card"
          :class="{ 'gwb2-mini-card--active': legionMatch.isRegistered }"
        >
          <div class="gwb2-mini-card__surface">
            <div class="gwb2-mini-card__toolbar">
              <div class="gwb2-mini-card__toolbar-main">
                <img
                  class="status-icon"
                  src="/icons/1733492491706152.png"
                  :alt="t('gameStatus.legionMatch.iconAlt')"
                >
                <div class="status-info">
                  <h3>{{ t("gameStatus.legionMatch.title") }}</h3>
                  <p>{{ t("gameStatus.legionMatch.subtitle") }}</p>
                </div>
              </div>
              <div class="gwb2-mini-card__toolbar-side">
                <div class="gwb2-mini-card__chip legion-card__chip">
                  <div class="gwb2-mini-card__chip-dot"></div>
                  <span>{{
                    legionMatch.isRegistered
                      ? t("gameStatus.legionMatch.statusRegistered")
                      : t("gameStatus.legionMatch.statusNotRegistered")
                  }}</span>
                </div>
              </div>
            </div>

            <div class="gwb2-mini-card__list legion-card__body">
              <p class="description">
                {{ t("gameStatus.legionMatch.descriptionLine1") }}<br>
                {{ t("gameStatus.legionMatch.descriptionLine2") }}
              </p>
            </div>
          </div>
          <div class="gwb2-mini-card__actions legion-card__actions">
            <n-button
              type="primary"
              :disabled="legionMatch.isRegistered"
              @click="registerLegionMatch"
            >
              {{
                legionMatch.isRegistered
                  ? t("gameStatus.legionMatch.actionRegistered")
                  : t("gameStatus.legionMatch.actionRegister")
              }}
            </n-button>
          </div>
        </div>

        <div
          v-if="ENABLE_LEGION_SIGNIN_CARD && activeSection === 'club'"
          class="gwb2-mini-card legion-signin-card"
          :class="{ 'gwb2-mini-card--active': legionSignin.isSignedIn }"
        >
          <div class="gwb2-mini-card__surface">
            <div class="gwb2-mini-card__toolbar">
              <div class="gwb2-mini-card__toolbar-main">
                <img
                  class="status-icon"
                  src="/icons/1733492491706148.png"
                  :alt="t('gameStatus.legionSignin.iconAlt')"
                >
                <div class="status-info">
                  <h3>{{ t("gameStatus.legionSignin.title") }}</h3>
                  <p>{{ t("gameStatus.legionSignin.subtitle") }}</p>
                </div>
              </div>
              <div class="gwb2-mini-card__toolbar-side">
                <div class="gwb2-mini-card__chip legion-card__chip">
                  <div class="gwb2-mini-card__chip-dot"></div>
                  <span>{{
                    legionSignin.isSignedIn
                      ? t("gameStatus.legionSignin.statusSigned")
                      : t("gameStatus.legionSignin.statusPending")
                  }}</span>
                </div>
              </div>
            </div>

            <div
              v-if="legionSignin.clubName"
              class="gwb2-mini-card__metric legion-card__metric"
            >
              <span class="metric-label">{{ t("gameStatus.legionSignin.currentClub") }}</span>
              <strong class="metric-value">{{ legionSignin.clubName }}</strong>
            </div>
            <div
              v-else
              class="gwb2-mini-card__empty legion-card__empty"
            >
              <p class="description">{{ t("gameStatus.legionSignin.noClub") }}</p>
            </div>
          </div>
          <div class="gwb2-mini-card__actions legion-card__actions">
            <n-button
              type="primary"
              :disabled="legionSignin.isSignedIn"
              @click="signInLegion"
            >
              {{
                legionSignin.isSignedIn
                  ? t("gameStatus.legionSignin.actionSigned")
                  : t("gameStatus.legionSignin.actionSign")
              }}
            </n-button>
          </div>
        </div>

        <ClubInfo
          v-if="canAccessRestrictedGameSections && activeSection === 'club'"
        ></ClubInfo>
        <ClubCarKing
          v-if="canAccessRestrictedGameSections && activeSection === 'club'"
        ></ClubCarKing>

        <MonthlyTasksCard
          v-if="mountedSections.activity"
          v-show="activeSection === 'activity'"
          :panel-active="activeSection === 'activity'"
        ></MonthlyTasksCard>
        <StudyChallengeCard
          v-if="mountedSections.activity"
          v-show="activeSection === 'activity'"
          :panel-active="activeSection === 'activity'"
        ></StudyChallengeCard>
        <SkinChallengeCard
          v-if="mountedSections.activity"
          v-show="activeSection === 'activity'"
          :panel-active="activeSection === 'activity'"
        ></SkinChallengeCard>

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
    </GameStatusModuleStage>

    <GameStatusIntelPanel
      v-if="showIntelPanel"
      :drawer-title="t('gameStatus.intel.drawerTitle')"
      :facts="intelFacts"
      :mobile-button-label="t('gameStatus.intel.mobileButton')"
      :show-identity-card="showIdentityCard"
      :subtitle="t('gameStatus.intel.subtitle')"
      :title="t('gameStatus.intel.title')"
    ></GameStatusIntelPanel>
  </div>
</template>

<script setup>
import {
  computed,
  defineAsyncComponent,
  defineEmits,
  defineProps,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue";
import { useI18n } from "vue-i18n";
import GameStatusIntelPanel from "@/components/game-status/GameStatusIntelPanel.vue";
import GameStatusModuleRail from "@/components/game-status/GameStatusModuleRail.vue";
import GameStatusModuleStage from "@/components/game-status/GameStatusModuleStage.vue";
import {
  buildGameStatusModules,
  findGameStatusModuleById,
  findGameStatusSectionMeta,
  GAME_STATUS_MODULE_IDS,
  getDefaultSectionForModule,
} from "@/components/game-status/moduleMeta";
import { useAuthStore } from "@/stores/auth";
import { useTokenStore } from "@/stores/tokenStore";
import { hasGameFeatureAccess } from "@/utils/accessScope";

const props = defineProps({
  activeModule: {
    type: String,
    default: null,
  },
  showModuleRail: {
    type: Boolean,
    default: true,
  },
  showIntelPanel: {
    type: Boolean,
    default: true,
  },
  showIdentityCard: {
    type: Boolean,
    default: true,
  },
});

const emit = defineEmits(["update:activeModule"]);

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

const internalActiveModule = ref(GAME_STATUS_MODULE_IDS.daily);
const moduleSectionState = ref({});
const saltFieldSubTab = ref("warrank");
const peachSubTab = ref("peach");
const rankSubTab = ref("serverrank");
const mountedSections = ref({
  activity: false,
  dailyExtras: false,
  tools: false,
});
let deferredDailyExtrasHandle = null;
let deferredDailyExtrasMode = "";

const activeModule = computed({
  get: () => props.activeModule ?? internalActiveModule.value,
  set: (value) => {
    if (props.activeModule == null) {
      internalActiveModule.value = value;
    }
    emit("update:activeModule", value);
  },
});

const canAccessRestrictedGameSections = computed(() =>
  hasGameFeatureAccess(authStore.user),
);

const roleInfo = computed(() => tokenStore.gameData?.roleInfo || null);

const modules = computed(() =>
  buildGameStatusModules(t, {
    canAccessRestrictedGameSections: canAccessRestrictedGameSections.value,
    enableToolsTab: ENABLE_TOOLS_TAB,
  }),
);

const currentModule = computed(() =>
  findGameStatusModuleById(modules.value, activeModule.value) || modules.value[0] || null,
);

const activeSection = computed({
  get: () => {
    const module = currentModule.value;
    if (!module) {
      return "daily";
    }

    const savedSection = moduleSectionState.value[module.id];
    if (module.sections.some((section) => section.id === savedSection)) {
      return savedSection;
    }

    return getDefaultSectionForModule(module);
  },
  set: (value) => {
    const module = currentModule.value;
    if (!module || !module.sections.some((section) => section.id === value)) {
      return;
    }

    moduleSectionState.value = {
      ...moduleSectionState.value,
      [module.id]: value,
    };
  },
});

const currentSectionMeta = computed(() =>
  findGameStatusSectionMeta(currentModule.value, activeSection.value),
);

const isEmbeddedWorkbench = computed(() =>
  !props.showModuleRail && !props.showIntelPanel,
);

const mountedSummary = computed(() => {
  const labels = [];
  if (mountedSections.value.dailyExtras) {
    labels.push(t("gameStatus.intel.loaded.dailyExtras"));
  }
  if (mountedSections.value.activity) {
    labels.push(t("gameStatus.intel.loaded.activity"));
  }
  if (mountedSections.value.tools) {
    labels.push(t("gameStatus.intel.loaded.tools"));
  }
  return labels.length ? labels.join(" / ") : t("gameStatus.intel.loaded.none");
});

const getTodayTimestamp = () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() / 1000;
};

const legionMatch = computed(() => {
  const todayTimestamp = getTodayTimestamp();
  return {
    isRegistered:
      Number(roleInfo.value?.role?.statistics?.["last:legion:match:sign:up:time"]) > todayTimestamp,
  };
});

const legionSignin = computed(() => {
  const todayTimestamp = getTodayTimestamp();
  const legionInfo
    = roleInfo.value?.legionInfo
      || roleInfo.value?.role?.legionInfo
      || null;

  return {
    clubName:
      legionInfo?.name
      || legionInfo?.legionName
      || roleInfo.value?.role?.legionName
      || "",
    isSignedIn:
      Number(roleInfo.value?.role?.statisticsTime?.["legion:sign:in"]) > todayTimestamp,
  };
});

const intelFacts = computed(() => [
  {
    label: t("gameStatus.intel.facts.currentModule"),
    value: currentModule.value?.label || "-",
    meta: currentModule.value?.description || "",
  },
  {
    label: t("gameStatus.intel.facts.currentSection"),
    value: currentSectionMeta.value?.label || "-",
    meta: currentSectionMeta.value?.description || "",
  },
  {
    label: t("gameStatus.intel.facts.accessScope"),
    value: canAccessRestrictedGameSections.value
      ? t("gameStatus.intel.facts.accessFull")
      : t("gameStatus.intel.facts.accessRestricted"),
    meta: canAccessRestrictedGameSections.value
      ? t("gameStatus.intel.facts.accessFullMeta")
      : t("gameStatus.intel.facts.accessRestrictedMeta"),
  },
  {
    label: t("gameStatus.intel.facts.loadedPanels"),
    value: mountedSummary.value,
    meta: t("gameStatus.intel.facts.loadedPanelsMeta"),
  },
]);

const isShowTowerStatus = computed(() => {
  const tower = roleInfo.value?.role?.tower;
  const towerId = tower?.id;
  const floor = Math.floor(towerId / 10) + 1;
  if (floor > 450) {
    return false;
  }
  return true;
});

const clearDeferredDailyExtrasMount = () => {
  if (deferredDailyExtrasHandle == null || typeof window === "undefined") {
    return;
  }

  if (
    deferredDailyExtrasMode === "idle"
    && typeof window.cancelIdleCallback === "function"
  ) {
    window.cancelIdleCallback(deferredDailyExtrasHandle);
  } else {
    window.clearTimeout(deferredDailyExtrasHandle);
  }

  deferredDailyExtrasHandle = null;
  deferredDailyExtrasMode = "";
};

const scheduleDailyExtrasMount = () => {
  if (mountedSections.value.dailyExtras || deferredDailyExtrasHandle != null) {
    return;
  }

  const commitMount = () => {
    deferredDailyExtrasHandle = null;
    deferredDailyExtrasMode = "";
    mountedSections.value.dailyExtras = true;
  };

  if (
    typeof window !== "undefined"
    && typeof window.requestIdleCallback === "function"
  ) {
    deferredDailyExtrasMode = "idle";
    deferredDailyExtrasHandle = window.requestIdleCallback(commitMount, {
      timeout: 400,
    });
    return;
  }

  if (typeof window !== "undefined") {
    deferredDailyExtrasMode = "timeout";
    deferredDailyExtrasHandle = window.setTimeout(commitMount, 120);
    return;
  }

  commitMount();
};

const prepareSectionMount = (section) => {
  if (section === "daily") {
    scheduleDailyExtrasMount();
    return;
  }

  if (section === "tools" || section === "activity") {
    mountedSections.value[section] = true;
  }
};

const ENABLE_LEGION_MATCH = false;
const ENABLE_LEGION_SIGNIN_CARD = false;
const ENABLE_TOOLS_TAB = true;

watch(
  modules,
  (nextModules) => {
    if (!nextModules.length) {
      return;
    }

    const nextState = { ...moduleSectionState.value };
    nextModules.forEach((module) => {
      if (!module.sections.some((section) => section.id === nextState[module.id])) {
        nextState[module.id] = getDefaultSectionForModule(module);
      }
    });
    moduleSectionState.value = nextState;

    if (!nextModules.some((module) => module.id === activeModule.value)) {
      activeModule.value = nextModules[0].id;
    }
  },
  { immediate: true },
);

watch(
  [activeModule, canAccessRestrictedGameSections],
  ([moduleId, canAccess]) => {
    if (canAccess) {
      return;
    }
    if (moduleId === GAME_STATUS_MODULE_IDS.legionOps) {
      activeModule.value = GAME_STATUS_MODULE_IDS.daily;
    }
  },
  { immediate: true },
);

watch(
  activeSection,
  (section) => {
    prepareSectionMount(section);
  },
  { immediate: true },
);

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

onMounted(() => {
  if (
    tokenStore.selectedToken
    && tokenStore.getWebSocketStatus(tokenStore.selectedToken.id) === "connected"
  ) {
    const tokenId = tokenStore.selectedToken.id;
    tokenStore.sendMessage(tokenId, "legion_getinfo");
    hasFetchedLegionOnce.value = true;
  }
});

onUnmounted(() => {
  clearDeferredDailyExtrasMount();
});
</script>

<style scoped lang="scss">
.game-status-shell {
  display: grid;
  grid-template-columns: minmax(228px, 260px) minmax(0, 1fr) minmax(260px, 320px);
  gap: 18px;
  align-items: start;
}

.game-status-shell--no-rail {
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
}

.game-status-shell--no-intel {
  grid-template-columns: minmax(228px, 260px) minmax(0, 1fr);
}

.game-status-shell--no-rail.game-status-shell--no-intel {
  grid-template-columns: minmax(0, 1fr);
}

.sub-nav-center {
  padding: 8px;
  background: var(--n-color);
  display: flex;
  justify-content: center;
}

.game-status-container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--spacing-lg);
  padding: var(--spacing-lg);
  overflow-x: hidden;
  align-items: start;

  @media (min-width: 1800px) {
    grid-template-columns: repeat(3, 1fr);
  }

  @media (max-width: 959px) {
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

  @media (max-width: 959px) {
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

.legion-card__body,
.legion-card__empty {
  min-height: 96px;
}

.legion-card__body .description,
.legion-card__empty .description {
  margin: 0;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
  line-height: 1.6;
}

.legion-card__metric {
  align-items: stretch;
}

.legion-card__metric .metric-label {
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.legion-card__metric .metric-value {
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-semibold);
  text-align: right;
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

@media (max-width: 1280px) {
  .game-status-shell {
    grid-template-columns: minmax(220px, 248px) minmax(0, 1fr);
  }

  .game-status-shell--no-rail {
    grid-template-columns: minmax(0, 1fr);
  }

  .game-status-shell--no-intel {
    grid-template-columns: minmax(220px, 248px) minmax(0, 1fr);
  }
}

@media (max-width: 959px) {
  .game-status-shell,
  .game-status-shell--no-rail,
  .game-status-shell--no-intel {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 959px) {
  .sub-nav-center {
    justify-content: flex-start;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }

  .legion-card__metric {
    flex-direction: column;
  }

  .legion-card__metric .metric-value {
    text-align: left;
  }
}
</style>
