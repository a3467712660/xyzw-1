<template>
  <div class="status-card main-card ten-hall-card">
    <div class="card-header">
      <img class="status-icon" src="/icons/1733492491706148.png" :alt="t('tenHallTeamBattleCard.iconAlt')">
      <div class="status-info">
        <span class="card-header__eyebrow">十殿争锋</span>
        <h3>{{ t("tenHallTeamBattleCard.title") }}</h3>
        <p>{{ t("tenHallTeamBattleCard.subtitle") }}</p>
      </div>
      <div class="status-badge" :class="{ active: isConnected }">
        <span>
          {{ isConnected ? t("tenHallTeamBattleCard.status.connected") : t("tenHallTeamBattleCard.status.disconnected") }}
        </span>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-item">
        <span class="label">{{ t("tenHallTeamBattleCard.summary.connectionStatus") }}</span>
        <span class="value" :class="isConnected ? 'ok' : 'danger'">{{ isConnected ? t("tenHallTeamBattleCard.status.connected") : t("tenHallTeamBattleCard.status.disconnected") }}</span>
      </div>
      <div class="summary-item">
        <span class="label">{{ t("tenHallTeamBattleCard.summary.myTeamId") }}</span>
        <span class="value">{{ currentTeamId || "-" }}</span>
      </div>
      <div class="summary-item">
        <span class="label">{{ t("tenHallTeamBattleCard.summary.roomId") }}</span>
        <span class="value">{{ currentRoomId || "-" }}</span>
      </div>
      <div class="summary-item">
        <span class="label">{{ t("tenHallTeamBattleCard.summary.currentStage") }}</span>
        <span class="value">{{ t("tenHallTeamBattleCard.summary.stageValue", { value: currentStage }) }}</span>
      </div>
      <div class="summary-item">
        <span class="label">{{ t("tenHallTeamBattleCard.summary.teamSize") }}</span>
        <span class="value">{{ teamMemberCount }}/5</span>
      </div>
    </div>

    <div class="stage-row">
      <button
        v-for="n in 8"
        :key="n"
        class="stage-chip"
        type="button"
        :class="{ active: n === currentStage }"
      >
        {{ n }}
      </button>
    </div>

    <div class="panel-grid">
      <section class="panel">
        <div class="panel-title">{{ t("tenHallTeamBattleCard.panels.teamDetails") }}</div>
        <div class="search-row">
          <n-input clearable v-model:value="searchTeamId" :placeholder="t('tenHallTeamBattleCard.placeholders.teamId')"></n-input>
          <n-button :loading="loadingSearch" @click="searchTeam">{{ t("tenHallTeamBattleCard.actions.search") }}</n-button>
        </div>

        <div class="recommended-title">{{ t("tenHallTeamBattleCard.sections.recommendedTeams") }}</div>
        <div class="search-row">
          <n-button :loading="loadingRecommend" @click="refreshRecommendTeams">{{ t("tenHallTeamBattleCard.actions.refreshRecommended") }}</n-button>
          <n-button type="warning" :loading="creatingTeam" @click="createTeam">{{ t("tenHallTeamBattleCard.actions.createTeam") }}</n-button>
        </div>

        <div v-if="recommendedTeams.length" class="team-list">
          <div v-for="team in recommendedTeams" :key="team.teamId" class="team-item">
            <div class="team-main">
              <div class="team-name">{{ team.setting?.name || t("tenHallTeamBattleCard.labels.teamFallback", { id: team.teamId }) }}</div>
              <div class="team-meta">{{ team.teamId }} · {{ team.fightRoleBase?.length || 0 }}/5</div>
            </div>
            <n-button size="small" :loading="applyingTeamId === team.teamId" @click="applyJoin(team.teamId)">
              {{ t("tenHallTeamBattleCard.actions.apply") }}
            </n-button>
          </div>
        </div>
        <div v-else class="muted">{{ t("tenHallTeamBattleCard.empty.recommendedTeams") }}</div>

        <div v-if="searchedTeam" class="searched-card">
          <div class="team-name">{{ searchedTeam.setting?.name || t("tenHallTeamBattleCard.labels.teamFallback", { id: searchedTeam.teamId }) }}</div>
          <div class="team-meta">{{ t("tenHallTeamBattleCard.labels.teamMeta", { id: searchedTeam.teamId, serverId: searchedTeam.serverId }) }}</div>
          <div class="search-row">
            <n-button size="small" :loading="applyingTeamId === searchedTeam.teamId" @click="applyJoin(searchedTeam.teamId)">{{ t("tenHallTeamBattleCard.actions.applyJoin") }}</n-button>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title">{{ t("tenHallTeamBattleCard.panels.myTeam") }}</div>
        <div class="form-row">
          <span>{{ t("tenHallTeamBattleCard.fields.teamName") }}</span>
          <n-input v-model:value="teamName" :placeholder="t('tenHallTeamBattleCard.placeholders.teamName')"></n-input>
        </div>
        <div class="form-row">
          <span>{{ t("tenHallTeamBattleCard.fields.allowApply") }}</span>
          <n-switch v-model:value="allowApply"></n-switch>
        </div>
        <div class="form-row">
          <span>{{ t("tenHallTeamBattleCard.fields.secretOnly") }}</span>
          <n-switch v-model:value="secretOnly"></n-switch>
        </div>
        <div class="search-row">
          <n-button :loading="savingSetting" @click="saveTeamSetting">{{ t("tenHallTeamBattleCard.actions.saveSettings") }}</n-button>
          <n-button type="success" :loading="openingTrial" @click="openTrial">{{ t("tenHallTeamBattleCard.actions.startTrial") }}</n-button>
          <n-button type="warning" :loading="stoppingTrial" @click="stopTrial">{{ t("tenHallTeamBattleCard.actions.stop") }}</n-button>
          <n-button type="error" :loading="dismissingTeam" @click="dismissTeam">{{ t("tenHallTeamBattleCard.actions.dismiss") }}</n-button>
        </div>

        <div class="recommended-title">{{ t("tenHallTeamBattleCard.sections.applyList") }}</div>
        <div v-if="applyList.length" class="team-list">
          <div v-for="item in applyList" :key="item.roleId" class="team-item">
            <div class="team-main">
              <div class="team-name">{{ item.name || item.roleId }}</div>
              <div class="team-meta">{{ t("tenHallTeamBattleCard.labels.roleMeta", { roleId: item.roleId, power: formatPower(item.power) }) }}</div>
            </div>
            <n-button size="small" :loading="agreeingRoleId === item.roleId" @click="agreeApply(item.roleId)">
              {{ t("tenHallTeamBattleCard.actions.approve") }}
            </n-button>
          </div>
        </div>
        <div v-else class="muted">{{ t("tenHallTeamBattleCard.empty.applyList") }}</div>
      </section>
    </div>

    <section class="panel full">
      <div class="panel-title">{{ t("tenHallTeamBattleCard.panels.lineupAndFight") }}</div>
      <div class="lineup-row">
        <n-button :loading="loadingPreset" @click="readPresetTeamNow">{{ t("tenHallTeamBattleCard.actions.readCurrentLineup") }}</n-button>
        <n-select
          style="min-width: 140px"
          v-model:value="selectedFormationId"
          :options="formationOptions"
          :placeholder="t('tenHallTeamBattleCard.placeholders.selectFormation')"
        ></n-select>
        <n-button :loading="switchingFormation" @click="switchFormation">{{ t("tenHallTeamBattleCard.actions.switchFormation") }}</n-button>
        <n-button type="warning" :loading="savingLineup" @click="syncLineupToTenHall">{{ t("tenHallTeamBattleCard.actions.syncLineup") }}</n-button>
      </div>

      <div v-if="lineupRows.length" class="lineup-table">
        <div v-for="row in lineupRows" :key="row.pos" class="lineup-item">
          <span>{{ t("tenHallTeamBattleCard.labels.position", { value: row.pos }) }}</span>
          <span>{{ row.name }} · Lv.{{ row.level > 0 ? row.level : "-" }}</span>
        </div>
      </div>
      <div v-else class="muted">{{ t("tenHallTeamBattleCard.empty.lineup") }}</div>

      <div class="recommended-title">{{ t("tenHallTeamBattleCard.sections.lineupTemplates") }}</div>
      <div class="lineup-row">
        <n-input v-model:value="templateName" :placeholder="t('tenHallTeamBattleCard.placeholders.templateName')"></n-input>
        <n-button @click="saveCurrentTemplate">{{ t("tenHallTeamBattleCard.actions.saveTemplate") }}</n-button>
        <n-button :loading="templateCloudSyncing || templateCloudLoading" @click="syncTemplateCloudNow">
          {{ t("tenHallTeamBattleCard.actions.syncTemplateToPhone") }}
        </n-button>
      </div>
      <div class="lineup-row">
        <n-select
          clearable
          v-model:value="selectedTemplateId"
          :options="templateOptions"
          :placeholder="t('tenHallTeamBattleCard.placeholders.selectTemplate')"
        ></n-select>
        <n-button type="success" @click="applyTemplate">{{ t("tenHallTeamBattleCard.actions.applyTemplate") }}</n-button>
        <n-button type="warning" :loading="exchangingHeroes" @click="applyTemplateByHeroExchange">{{ t("tenHallTeamBattleCard.actions.exchangeByTemplate") }}</n-button>
        <n-button type="error" @click="deleteTemplate">{{ t("tenHallTeamBattleCard.actions.deleteTemplate") }}</n-button>
      </div>
      <div v-if="lineupRows.length" class="lineup-table">
        <div v-for="row in lineupRows" :key="`edit-${row.pos}`" class="lineup-item">
          <span>{{ t("tenHallTeamBattleCard.labels.position", { value: row.pos }) }}</span>
          <n-select
            size="small"
            style="width: 180px"
            :options="heroSelectOptions"
            :value="lineupBattleTeam[String(row.pos - 1)] || 0"
            @update:value="(val) => updateLineupSlot(row.pos - 1, Number(val || 0))"
          ></n-select>
        </div>
      </div>

      <div class="lineup-row">
        <n-select v-model:value="selectedFighterRoleId" :options="fighterOptions" :placeholder="t('tenHallTeamBattleCard.placeholders.selectFighter')"></n-select>
        <n-button :loading="settingFighter" @click="setFighter">{{ t("tenHallTeamBattleCard.actions.setFighter") }}</n-button>
        <n-button type="info" :loading="preparingFight" @click="prepareFight">{{ t("tenHallTeamBattleCard.actions.prepare") }}</n-button>
        <n-button type="primary" :loading="fighting" @click="startFight">{{ t("tenHallTeamBattleCard.actions.startFight") }}</n-button>
      </div>
    </section>

    <section class="panel full">
      <div class="panel-title">{{ t("tenHallTeamBattleCard.panels.realtimeLogs") }}</div>
      <div class="log-list">
        <div v-for="item in logs" :key="item.id" class="log-item">
          <span class="time">{{ item.time }}</span>
          <span class="text">{{ item.text }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { useDialog, useMessage } from "naive-ui/es";
import { useI18n } from "vue-i18n";
import { useTokenStore } from "@/stores/tokenStore";
import { useAuthStore } from "@/stores/auth";
import { HERO_DICT } from "@/utils/HeroList.js";
import api from "@/api";
import {
  getJsonPreference,
  setJsonPreference,
} from "@/services/preferences/localPreferences";

type TeamInfo = Record<string, any>;

interface LogItem { id: number; time: string; text: string }

const tokenStore = useTokenStore();
const authStore = useAuthStore();
const message = useMessage();
const dialog = useDialog();
const { t, locale } = useI18n();

const loadingSearch = ref(false);
const loadingRecommend = ref(false);
const creatingTeam = ref(false);
const applyingTeamId = ref("");
const savingSetting = ref(false);
const openingTrial = ref(false);
const stoppingTrial = ref(false);
const dismissingTeam = ref(false);
const loadingPreset = ref(false);
const savingLineup = ref(false);
const switchingFormation = ref(false);
const exchangingHeroes = ref(false);
const settingFighter = ref(false);
const preparingFight = ref(false);
const fighting = ref(false);
const agreeingRoleId = ref(0);

const searchTeamId = ref("");
const searchedTeam = ref<TeamInfo | null>(null);
const recommendedTeams = ref<TeamInfo[]>([]);
const myTeam = ref<TeamInfo | null>(null);
const roomInfo = ref<Record<string, any> | null>(null);

const teamName = ref("");
const allowApply = ref(true);
const secretOnly = ref(true);

const lineupBattleTeam = ref<Record<string, number>>({});
const lineupHeroLevel = ref<Record<string, number>>({
  0: 0,
  1: 0,
  2: 0,
  3: 0,
  4: 0,
});
const selectedFighterRoleId = ref<number | null>(null);
const templateName = ref("");
const selectedTemplateId = ref<string | null>(null);
const selectedFormationId = ref<number>(1);
const templateStorageKey = ref("xyzw-tenhall-lineups-global");
const lineupTemplates = ref<Record<string, { name: string; battleTeam: Record<string, number>; updatedAt: number }>>({});
const knownHeroLevelById = ref<Record<string, number>>({});
const presetReadReqId = ref(0);
const currentRoleId = ref(0);
const templateCloudLoading = ref(false);
const templateCloudSyncing = ref(false);
const applyingTemplateCloud = ref(false);
let templateCloudTimer: ReturnType<typeof setTimeout> | null = null;

const logs = ref<LogItem[]>([]);
const TEMPLATE_PREF_KEY_PREFIX = "tenhall_lineup_templates_v1";
const TENHALL_LORD_WEAPON_ID = 8;
const COMMAND_PRE_DELAY_MS = 350;

const wsStatus = computed(() => {
  if (!tokenStore.selectedToken)
    return "disconnected";
  return tokenStore.getWebSocketStatus(tokenStore.selectedToken.id);
});
const isConnected = computed(() => wsStatus.value === "connected");

const currentTeamId = computed(() => String(myTeam.value?.teamId || ""));
const currentRoomId = computed(() => String(roomInfo.value?.roomId || ""));
const currentStage = computed(() => Number(roomInfo.value?.curMonsterCfgId || 1));
const teamMemberCount = computed(() => Number((myTeam.value?.fightRoleBase || []).length || 0));

const lineupRows = computed(() => {
  return [1, 2, 3, 4, 5]
    .map((pos) => {
      const heroId = Number(lineupBattleTeam.value[String(pos - 1)] || 0);
      const heroMeta = heroId ? HERO_DICT[heroId] : null;
      return {
        pos,
        heroId,
        name: heroMeta?.name || t("tenHallTeamBattleCard.labels.unset"),
        level: Number(lineupHeroLevel.value[String(pos - 1)] || 0),
      };
    });
});

const templateOptions = computed(() => {
  return Object.entries(lineupTemplates.value)
    .sort((a, b) => Number(b[1].updatedAt || 0) - Number(a[1].updatedAt || 0))
    .map(([id, item]) => ({
      label: item.name || t("tenHallTeamBattleCard.labels.templateFallback", { id }),
      value: id,
    }));
});

const formationOptions = computed(() => {
  return [1, 2, 3, 4, 5, 6].map((v) => ({
    label: t("tenHallTeamBattleCard.labels.formation", { value: v }),
    value: v,
  }));
});

const heroSelectOptions = computed(() => {
  const heroIds = new Set<number>();
  Object.values(lineupBattleTeam.value).forEach((id) => {
    const n = Number(id || 0);
    if (n > 0)
      heroIds.add(n);
  });
  Object.keys(knownHeroLevelById.value).forEach((id) => {
    const n = Number(id || 0);
    if (n > 0)
      heroIds.add(n);
  });
  const opts = Array.from(heroIds).map((heroId) => ({
    label: t("tenHallTeamBattleCard.labels.heroOption", {
      name: HERO_DICT[heroId]?.name || t("tenHallTeamBattleCard.labels.heroFallback", { id: heroId }),
      level: Number(knownHeroLevelById.value[String(heroId)] || 0) || "-",
    }),
    value: heroId,
  }));
  opts.sort((a, b) => String(a.label).localeCompare(String(b.label), locale.value));
  return [{ label: t("tenHallTeamBattleCard.actions.clear"), value: 0 }, ...opts];
});

const fighterOptions = computed(() => {
  const members = roomInfo.value?.fightRoleBase || myTeam.value?.fightRoleBase || [];
  return members.map((it: any) => ({
    label: `${it.name || it.roleId} (${it.roleId})`,
    value: Number(it.roleId),
  }));
});

const applyList = computed(() => {
  return myTeam.value?.setting?.applyList || myTeam.value?.matchTeamData?.setting?.applyList || [];
});

const formatPower = (value: number) => {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toLocaleString() : "0";
};

const addLog = (text: string) => {
  logs.value.unshift({
    id: Date.now() + Math.floor(Math.random() * 1000),
    time: new Date().toLocaleTimeString(),
    text,
  });
  if (logs.value.length > 120)
    logs.value = logs.value.slice(0, 120);
};

const syncGlobalPresetSnapshot = (snapshot: any) => {
  if (!snapshot || typeof snapshot !== "object")
    return;
  tokenStore.$patch((state: any) => {
    state.gameData = { ...(state.gameData || {}), presetTeam: snapshot };
  });
};

const syncGlobalPresetUseTeamId = (teamId: number) => {
  const target = Number(teamId || 1) || 1;
  tokenStore.$patch((state: any) => {
    const current = state.gameData?.presetTeam;
    if (!current || typeof current !== "object")
      return;
    const next = { ...current };
    if (typeof next.useTeamId === "number")
      next.useTeamId = target;
    if (next.presetTeamInfo && typeof next.presetTeamInfo === "object") {
      next.presetTeamInfo = { ...next.presetTeamInfo, useTeamId: target };
    }
    state.gameData = { ...(state.gameData || {}), presetTeam: next };
  });
};

const getTokenId = () => {
  const tokenId = tokenStore.selectedToken?.id;
  if (!tokenId) {
    message.warning(t("tenHallTeamBattleCard.messages.selectTokenFirst"));
    return "";
  }
  if (!isConnected.value) {
    message.warning(t("tenHallTeamBattleCard.messages.wsDisconnected"));
    return "";
  }
  return tokenId;
};

const sendCmd = async (cmd: string, body: Record<string, any>, timeout = 10000) => {
  const tokenId = getTokenId();
  if (!tokenId)
    return null;
  // 给每条指令增加前置间隔，避免连续发包过快导致偶发失败
  await sleep(COMMAND_PRE_DELAY_MS);
  const result = await tokenStore.sendMessageWithPromise(tokenId, cmd, body, timeout);
  addLog(t("tenHallTeamBattleCard.logs.commandSent", { cmd }));
  return result;
};

const applyTeamInfo = (team: any) => {
  if (!team)
    return;
  myTeam.value = team.matchTeamData ? team.matchTeamData : team;
  const setting = myTeam.value?.setting || {};
  teamName.value = setting.name || teamName.value || t("tenHallTeamBattleCard.defaults.myTeam");
  allowApply.value = Number(setting.apply ?? 1) === 1;
  secretOnly.value = Number(setting.secret ?? 1) === 1;
};

const extractBody = (msg: any) => {
  if (!msg || typeof msg !== "object")
    return null;
  if (msg.rawData !== undefined)
    return msg.rawData;
  if (msg.decodedBody !== undefined)
    return msg.decodedBody;
  if (typeof msg.getData === "function")
    return msg.getData();
  return msg.body || null;
};

const searchTeam = async () => {
  if (!searchTeamId.value.trim()) {
    message.warning(t("tenHallTeamBattleCard.messages.enterTeamId"));
    return;
  }
  loadingSearch.value = true;
  try {
    const data: any = await sendCmd("matchteam_getteaminfo", { teamId: searchTeamId.value.trim() });
    searchedTeam.value = data?.teamInfo || data?.matchTeamData || null;
    if (searchedTeam.value)
      message.success(t("tenHallTeamBattleCard.messages.searchSuccess"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.searchFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    loadingSearch.value = false;
  }
};

const refreshRecommendTeams = async () => {
  loadingRecommend.value = true;
  try {
    const data: any = await sendCmd("matchteam_getrandteamlist", { teamCfgId: 1 });
    recommendedTeams.value = data?.teamInfo || [];
    if (!Array.isArray(recommendedTeams.value))
      recommendedTeams.value = [];
  } catch (error: any) {
    message.warning(t("tenHallTeamBattleCard.messages.recommendPending", { error: error?.message || t("tenHallTeamBattleCard.common.failed") }));
  } finally {
    loadingRecommend.value = false;
  }
};

const createTeam = async () => {
  creatingTeam.value = true;
  try {
    const payload = {
      teamCfgId: 1,
      setting: {
        apply: allowApply.value ? 1 : 0,
        applyList: [],
        name: teamName.value || t("tenHallTeamBattleCard.defaults.myTeam"),
        notice: "",
        secret: secretOnly.value ? 1 : 0,
      },
    };
    const data: any = await sendCmd("matchteam_create", payload);
    applyTeamInfo(data?.teamInfo || data?.matchTeamData || data);
    message.success(t("tenHallTeamBattleCard.messages.createAttempted"));
  } catch (error: any) {
    message.warning(t("tenHallTeamBattleCard.messages.createPending", { error: error?.message || t("tenHallTeamBattleCard.common.failed") }));
  } finally {
    creatingTeam.value = false;
  }
};

const applyJoin = async (teamId: string) => {
  if (!teamId)
    return;
  applyingTeamId.value = String(teamId);
  try {
    const data: any = await sendCmd("matchteam_join", { teamId: String(teamId) });
    applyTeamInfo(data?.teamInfo || data?.matchTeamData || data);
    message.success(t("tenHallTeamBattleCard.messages.applySent"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.applyFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    applyingTeamId.value = "";
  }
};

const saveTeamSetting = async () => {
  if (!currentTeamId.value) {
    message.warning(t("tenHallTeamBattleCard.messages.noTeamId"));
    return;
  }
  savingSetting.value = true;
  try {
    await sendCmd("matchteam_setting", {
      teamId: currentTeamId.value,
      setting: {
        apply: allowApply.value ? 1 : 0,
        applyList: [],
        name: teamName.value || t("tenHallTeamBattleCard.defaults.myTeam"),
        notice: "",
        secret: secretOnly.value ? 1 : 0,
      },
    });
    message.success(t("tenHallTeamBattleCard.messages.settingsSaved"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.settingsSaveFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    savingSetting.value = false;
  }
};

const agreeApply = async (roleId: number) => {
  if (!currentTeamId.value) {
    message.warning(t("tenHallTeamBattleCard.messages.noTeamId"));
    return;
  }
  agreeingRoleId.value = Number(roleId);
  try {
    await sendCmd("matchteam_agree", { teamId: currentTeamId.value, roleId: Number(roleId) });
    message.success(t("tenHallTeamBattleCard.messages.applyApproved"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.applyApproveFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    agreeingRoleId.value = 0;
  }
};

const openTrial = async () => {
  if (!currentTeamId.value)
    return message.warning(t("tenHallTeamBattleCard.messages.noTeamId"));
  if (teamMemberCount.value <= 2) {
    return message.warning(t("tenHallTeamBattleCard.messages.teamTooSmall"));
  }
  openingTrial.value = true;
  try {
    await sendCmd("matchteam_openteam", { teamId: currentTeamId.value, extParam: 0 });
    message.success(t("tenHallTeamBattleCard.messages.trialStarted"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.trialStartFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    openingTrial.value = false;
  }
};

const stopTrial = async () => {
  if (!currentTeamId.value)
    return message.warning(t("tenHallTeamBattleCard.messages.noTeamId"));
  stoppingTrial.value = true;
  try {
    await sendCmd("matchteam_leaderstop", { teamId: currentTeamId.value });
    message.success(t("tenHallTeamBattleCard.messages.trialStopped"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.stopFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    stoppingTrial.value = false;
  }
};

const dismissTeam = async () => {
  if (!currentTeamId.value)
    return message.warning(t("tenHallTeamBattleCard.messages.noTeamId"));
  dismissingTeam.value = true;
  try {
    await sendCmd("matchteam_dismiss", { teamId: currentTeamId.value });
    message.success(t("tenHallTeamBattleCard.messages.teamDismissed"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.dismissFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    dismissingTeam.value = false;
  }
};

const normalizePresetTeam = (raw: any) => {
  const root = raw?.presetTeamInfo ?? raw ?? {};
  const useTeamId = Number(root.useTeamId || 1);
  const teamInfo = root?.[useTeamId]?.teamInfo || root?.presetTeamInfo?.[useTeamId]?.teamInfo || {};
  const battleTeam: Record<string, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
  for (const [k, v] of Object.entries(teamInfo)) {
    const heroId = Number((v as any)?.heroId || (v as any)?.id || v || 0);
    const rawIdx = Number(k);
    const idx = rawIdx >= 0 && rawIdx <= 4 ? rawIdx : rawIdx >= 1 && rawIdx <= 5 ? rawIdx - 1 : -1;
    if (idx >= 0 && idx <= 4)
      battleTeam[String(idx)] = heroId > 0 ? heroId : 0;
  }
  return battleTeam;
};

const parsePresetTeamBundle = (raw: any) => {
  const root = raw?.presetTeamInfo ?? raw ?? {};
  const findUseIdRec = (obj: any): number | null => {
    if (!obj || typeof obj !== "object")
      return null;
    if (typeof obj.useTeamId === "number")
      return obj.useTeamId;
    for (const k of Object.keys(obj)) {
      const v = findUseIdRec((obj as any)[k]);
      if (v)
        return v;
    }
    return null;
  };
  const useTeamId = Number(
    root.useTeamId ?? root.presetTeamInfo?.useTeamId ?? findUseIdRec(root) ?? 1,
  ) || 1;

  const dict = root.presetTeamInfo ?? root;
  const teams: Record<number, Record<string, any>> = {};
  const ids = Object.keys(dict || {}).filter((k) => /^\d+$/.test(k));
  for (const idStr of ids) {
    const id = Number(idStr);
    const node = dict[idStr];
    if (!node) {
      teams[id] = {};
      continue;
    }
    if (node.teamInfo) {
      teams[id] = node.teamInfo;
      continue;
    }
    if (Array.isArray(node.heroes)) {
      const teamInfo: Record<string, any> = {};
      node.heroes.forEach((h: any, idx: number) => {
        teamInfo[String(idx + 1)] = h;
      });
      teams[id] = teamInfo;
      continue;
    }
    if (typeof node === "object") {
      const hasHero = Object.values(node).some(
        (v: any) => v && typeof v === "object" && ("heroId" in v || "id" in v),
      );
      teams[id] = hasHero ? node : {};
      continue;
    }
    teams[id] = {};
  }
  return { useTeamId, teams };
};

const getMainlinePresetTeam = async (expectTeamId?: number) => {
  const tokenId = getTokenId();
  if (!tokenId)
    return null;
  const presetData: any = await tokenStore.sendMessageWithPromise(
    tokenId,
    "presetteam_getinfo",
    {},
    8000,
  );
  syncGlobalPresetSnapshot(presetData);
  const { useTeamId, teams } = parsePresetTeamBundle(presetData);
  const teamId = Number(expectTeamId || useTeamId || 1);
  const teamInfo = teams[teamId] || {};
  const battleTeam: Record<string, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
  const levelMap: Record<string, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
  for (const [k, v] of Object.entries(teamInfo)) {
    const rawIdx = Number(k);
    const idx = rawIdx >= 0 && rawIdx <= 4 ? rawIdx : rawIdx >= 1 && rawIdx <= 5 ? rawIdx - 1 : -1;
    const heroId = Number((v as any)?.heroId || (v as any)?.id || 0);
    if (idx >= 0 && idx <= 4) {
      battleTeam[String(idx)] = heroId > 0 ? heroId : 0;
      levelMap[String(idx)] = Number((v as any)?.level || 0);
    }
  }
  return { battleTeam, levelMap, teamId, useTeamId };
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const normalizeTargetTeam = (raw: any) => {
  const teamInfo = raw?.teamInfo?.team || raw?.team || {};
  const battleTeam: Record<string, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
  const levelMap: Record<string, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
  };
  for (const [k, v] of Object.entries(teamInfo)) {
    const idx = Number(k);
    const heroId = Number((v as any)?.id || (v as any)?.heroId || v || 0);
    if (idx >= 0 && idx <= 4)
      battleTeam[String(idx)] = heroId > 0 ? heroId : 0;
    levelMap[String(idx)] = Number((v as any)?.level || 0);
  }
  return { battleTeam, levelMap };
};

const updateKnownHeroLevels = (levelMap: Record<string, number>, battleTeam: Record<string, number>) => {
  const next = { ...knownHeroLevelById.value };
  for (let i = 0; i < 5; i += 1) {
    const posKey = String(i);
    const heroId = Number(battleTeam[posKey] || 0);
    if (heroId > 0) {
      const lv = Number(levelMap[posKey] || 0);
      if (lv > 0)
        next[String(heroId)] = lv;
    }
  }
  knownHeroLevelById.value = next;
};

const updateLineupSlot = (pos: number, heroId: number) => {
  const key = String(pos);
  lineupBattleTeam.value = {
    ...lineupBattleTeam.value,
    [key]: Number(heroId || 0),
  };
  lineupHeroLevel.value = {
    ...lineupHeroLevel.value,
    [key]: Number(knownHeroLevelById.value[String(heroId)] || 0),
  };
};

const calcTenHallTeamPower = async (battleTeam: Record<string, number>) => {
  try {
    const data: any = await sendCmd(
      "hero_calcpowerbyteam",
      {
        battleTeam,
        lordWeaponId: TENHALL_LORD_WEAPON_ID,
      },
      6000,
    );
    const power = Number(data?.power || 0);
    if (power > 0)
      addLog(t("tenHallTeamBattleCard.logs.powerEstimate", { power: formatPower(power) }));
  } catch {
    // 试算失败不阻塞主流程
  }
};

const getCurrentRoleId = async () => {
  const cachedRoleId = Number(tokenStore.gameData?.roleInfo?.role?.roleId || 0);
  if (cachedRoleId > 0)
    return cachedRoleId;
  const tokenId = getTokenId();
  if (!tokenId)
    return 0;
  const roleInfo: any = await tokenStore.sendMessageWithPromise(
    tokenId,
    "role_getroleinfo",
    {},
    8000,
  );
  return Number(roleInfo?.role?.roleId || 0);
};

const getTemplateCloudPrefKey = () => {
  const rid = Number(currentRoleId.value || 0);
  return `${TEMPLATE_PREF_KEY_PREFIX}:${rid > 0 ? rid : "global"}`;
};

const sanitizeTemplateMap = (raw: any) => {
  const result: Record<string, { name: string; battleTeam: Record<string, number>; updatedAt: number }> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    return result;
  Object.entries(raw).forEach(([id, item]) => {
    const node: any = item || {};
    if (!node || typeof node !== "object")
      return;
    result[String(id)] = {
      name: String(node?.name || t("tenHallTeamBattleCard.labels.templateFallback", { id })),
      battleTeam: {
        0: Number(node?.battleTeam?.["0"] || 0),
        1: Number(node?.battleTeam?.["1"] || 0),
        2: Number(node?.battleTeam?.["2"] || 0),
        3: Number(node?.battleTeam?.["3"] || 0),
        4: Number(node?.battleTeam?.["4"] || 0),
      },
      updatedAt: Number(node?.updatedAt || 0),
    };
  });
  return result;
};

const getTemplateMapVersion = (map: Record<string, { updatedAt: number }>) => {
  const versions = Object.values(map || {}).map((item) => Number(item?.updatedAt || 0));
  return versions.length ? Math.max(...versions) : 0;
};

const mergeTemplateMaps = (
  localMap: Record<string, { name: string; battleTeam: Record<string, number>; updatedAt: number }>,
  remoteMap: Record<string, { name: string; battleTeam: Record<string, number>; updatedAt: number }>,
) => {
  const merged = { ...(localMap || {}) };
  Object.entries(remoteMap || {}).forEach(([id, item]) => {
    const local = merged[id];
    const remoteAt = Number(item?.updatedAt || 0);
    const localAt = Number(local?.updatedAt || 0);
    if (!local || remoteAt >= localAt)
      merged[id] = item;
  });
  return merged;
};

const pushTemplateCloud = async () => {
  if (!authStore.isAuthenticated)
    return;
  const prefKey = getTemplateCloudPrefKey();
  const payload = {
    version: 1,
    roleId: Number(currentRoleId.value || 0),
    updatedAt: Date.now(),
    templates: lineupTemplates.value,
  };
  await api.user.setPreference(prefKey, payload);
};

const pullTemplateCloud = async (silent = true) => {
  if (!authStore.isAuthenticated)
    return;
  templateCloudLoading.value = true;
  try {
    const prefKey = getTemplateCloudPrefKey();
    const res = await api.user.getPreference(prefKey);
    const rawValue = res?.data?.value;
    if (rawValue == null)
      return;
    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    const remoteMap = sanitizeTemplateMap(parsed?.templates ?? parsed);
    const localMap = sanitizeTemplateMap(lineupTemplates.value);
    const merged = mergeTemplateMaps(localMap, remoteMap);
    const remoteVersion = getTemplateMapVersion(remoteMap);
    const localVersion = getTemplateMapVersion(localMap);
    const changed = JSON.stringify(merged) !== JSON.stringify(localMap);
    if (changed) {
      applyingTemplateCloud.value = true;
      lineupTemplates.value = merged;
      setJsonPreference(templateStorageKey.value, lineupTemplates.value);
      applyingTemplateCloud.value = false;
    }
    if (localVersion > remoteVersion) {
      await pushTemplateCloud();
    }
    if (!silent && changed)
      message.success(t("tenHallTeamBattleCard.messages.templateSyncedFromCloud"));
  } catch (error: any) {
    if (!silent)
      message.error(t("tenHallTeamBattleCard.messages.templateCloudReadFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    templateCloudLoading.value = false;
  }
};

const scheduleTemplateCloudSync = () => {
  if (!authStore.isAuthenticated || applyingTemplateCloud.value)
    return;
  if (templateCloudTimer)
    clearTimeout(templateCloudTimer);
  templateCloudTimer = setTimeout(async () => {
    templateCloudTimer = null;
    templateCloudSyncing.value = true;
    try {
      await pushTemplateCloud();
      addLog(t("tenHallTeamBattleCard.logs.templateSyncedToCloud"));
    } catch (error: any) {
      addLog(t("tenHallTeamBattleCard.logs.templateCloudSyncFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
    } finally {
      templateCloudSyncing.value = false;
    }
  }, 300);
};

const syncTemplateCloudNow = async () => {
  if (!authStore.isAuthenticated) {
    message.warning(t("tenHallTeamBattleCard.messages.loginBeforeSync"));
    return;
  }
  templateCloudSyncing.value = true;
  try {
    await pushTemplateCloud();
    message.success(t("tenHallTeamBattleCard.messages.templateSyncedToPhone"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.templateSyncFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    templateCloudSyncing.value = false;
  }
};

const loadTemplateStore = () => {
  try {
    lineupTemplates.value = sanitizeTemplateMap(
      getJsonPreference(templateStorageKey.value, {}),
    );
  } catch {
    lineupTemplates.value = {};
  }
};

const saveTemplateStore = () => {
  setJsonPreference(templateStorageKey.value, lineupTemplates.value);
  scheduleTemplateCloudSync();
};

const setupTemplateStore = (roleId: number) => {
  currentRoleId.value = Number(roleId || 0);
  templateStorageKey.value = `xyzw-tenhall-lineups-${roleId || "global"}`;
  loadTemplateStore();
};

const saveCurrentTemplate = () => {
  const validHeroIds = Object.values(lineupBattleTeam.value).map((id) => Number(id || 0)).filter((id) => id > 0);
  if (!validHeroIds.length)
    return message.warning(t("tenHallTeamBattleCard.messages.emptyLineupCannotSave"));
  const id = `tpl_${Date.now()}`;
  const name = (templateName.value || "").trim() || t("tenHallTeamBattleCard.labels.templateAutoName", {
    value: Object.keys(lineupTemplates.value).length + 1,
  });
  lineupTemplates.value[id] = {
    name,
    battleTeam: { ...lineupBattleTeam.value },
    updatedAt: Date.now(),
  };
  saveTemplateStore();
  selectedTemplateId.value = id;
  templateName.value = "";
  message.success(t("tenHallTeamBattleCard.messages.templateSaved"));
};

const applyTemplate = () => {
  if (!selectedTemplateId.value)
    return message.warning(t("tenHallTeamBattleCard.messages.selectTemplateFirst"));
  const tpl = lineupTemplates.value[selectedTemplateId.value];
  if (!tpl)
    return message.warning(t("tenHallTeamBattleCard.messages.templateMissing"));
  lineupBattleTeam.value = {
    0: Number(tpl.battleTeam["0"] || 0),
    1: Number(tpl.battleTeam["1"] || 0),
    2: Number(tpl.battleTeam["2"] || 0),
    3: Number(tpl.battleTeam["3"] || 0),
    4: Number(tpl.battleTeam["4"] || 0),
  };
  lineupHeroLevel.value = {
    0: Number(knownHeroLevelById.value[String(lineupBattleTeam.value["0"] || 0)] || 0),
    1: Number(knownHeroLevelById.value[String(lineupBattleTeam.value["1"] || 0)] || 0),
    2: Number(knownHeroLevelById.value[String(lineupBattleTeam.value["2"] || 0)] || 0),
    3: Number(knownHeroLevelById.value[String(lineupBattleTeam.value["3"] || 0)] || 0),
    4: Number(knownHeroLevelById.value[String(lineupBattleTeam.value["4"] || 0)] || 0),
  };
  message.success(t("tenHallTeamBattleCard.messages.templateApplied"));
  void calcTenHallTeamPower(lineupBattleTeam.value);
};

const applyTemplateByHeroExchange = async () => {
  if (!selectedTemplateId.value)
    return message.warning(t("tenHallTeamBattleCard.messages.selectTemplateFirst"));
  const tpl = lineupTemplates.value[selectedTemplateId.value];
  if (!tpl)
    return message.warning(t("tenHallTeamBattleCard.messages.templateMissing"));

  const mainline = await getMainlinePresetTeam(Number(selectedFormationId.value || 1));
  if (!mainline)
    return;
  const currentTeam = { ...mainline.battleTeam };
  const targetTeam = {
    0: Number(tpl.battleTeam["0"] || 0),
    1: Number(tpl.battleTeam["1"] || 0),
    2: Number(tpl.battleTeam["2"] || 0),
    3: Number(tpl.battleTeam["3"] || 0),
    4: Number(tpl.battleTeam["4"] || 0),
  };

  const exchanges: Array<{ heroId: number; targetHeroId: number }> = [];
  const plannedKeys = new Set<string>();
  for (let i = 0; i < 5; i += 1) {
    const key = String(i);
    const fromId = Number(currentTeam[key] || 0);
    const toId = Number(targetTeam[key] || 0);
    if (fromId > 0 && toId > 0 && fromId !== toId) {
      const directKey = `${fromId}->${toId}`;
      const reverseKey = `${toId}->${fromId}`;
      if (!plannedKeys.has(directKey) && !plannedKeys.has(reverseKey)) {
        exchanges.push({ heroId: fromId, targetHeroId: toId });
        plannedKeys.add(directKey);
      }
    }
  }
  if (!exchanges.length)
    return message.info(t("tenHallTeamBattleCard.messages.templateAlreadyMatched"));

  const toHeroName = (heroId: number) => HERO_DICT[heroId]?.name || t("tenHallTeamBattleCard.labels.heroFallback", { id: heroId });
  const previewText = exchanges
    .map((item, idx) => `${idx + 1}. ${toHeroName(item.heroId)} -> ${toHeroName(item.targetHeroId)}`)
    .join("\n");

  dialog.warning({
    title: t("tenHallTeamBattleCard.dialogs.exchangeTitle"),
    content: t("tenHallTeamBattleCard.dialogs.exchangeContent", { preview: previewText }),
    positiveText: t("tenHallTeamBattleCard.dialogs.confirm"),
    negativeText: t("tenHallTeamBattleCard.dialogs.cancel"),
    onPositiveClick: async () => {
      exchangingHeroes.value = true;
      try {
        for (const item of exchanges) {
          await sendCmd(
            "hero_exchange",
            {
              heroId: item.heroId,
              targetHeroId: item.targetHeroId,
            },
            10000,
          );
          addLog(t("tenHallTeamBattleCard.logs.heroExchanged", {
            from: item.heroId,
            to: item.targetHeroId,
          }));
        }
        message.success(t("tenHallTeamBattleCard.messages.exchangeSucceeded", { count: exchanges.length }));
        await loadPresetTeam();
      } catch (error: any) {
        message.error(t("tenHallTeamBattleCard.messages.exchangeFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
      } finally {
        exchangingHeroes.value = false;
      }
    },
  });
};

const deleteTemplate = () => {
  if (!selectedTemplateId.value)
    return message.warning(t("tenHallTeamBattleCard.messages.selectTemplateFirst"));
  if (!lineupTemplates.value[selectedTemplateId.value])
    return message.warning(t("tenHallTeamBattleCard.messages.templateMissing"));
  delete lineupTemplates.value[selectedTemplateId.value];
  saveTemplateStore();
  selectedTemplateId.value = null;
  message.success(t("tenHallTeamBattleCard.messages.templateDeleted"));
};

const restoreTeamState = async () => {
  try {
    const roleId = await getCurrentRoleId();
    if (!roleId)
      return;
    setupTemplateStore(roleId);
    await pullTemplateCloud(true);
    const roleTeamData: any = await sendCmd("matchteam_getroleteaminfo", { roleID: roleId }, 8000);
    const gdMap = roleTeamData?.roleMTData?.gDMTData || roleTeamData?.gDMTData || {};
    let teamId = "";
    if (typeof gdMap === "object" && gdMap) {
      const values = Object.values(gdMap as Record<string, any>);
      if (values.length) {
        teamId = String(values[0]?.teamId || "");
      }
      if (!teamId) {
        const keys = Object.keys(gdMap);
        if (keys.length)
          teamId = String(keys[0] || "");
      }
    }
    if (!teamId && roleTeamData?.teamInfo?.teamId) {
      teamId = String(roleTeamData.teamInfo.teamId);
    }
    if (!teamId)
      return;
    const teamData: any = await sendCmd("matchteam_getteaminfo", { teamId }, 8000);
    const teamInfo = teamData?.teamInfo || teamData?.matchTeamData || teamData;
    applyTeamInfo(teamInfo);
    addLog(t("tenHallTeamBattleCard.logs.teamRestored", { teamId }));
    const memberWithBattle = (teamInfo?.fightRoleBase || []).find((it: any) => it?.battleData?.team);
    if (memberWithBattle) {
      roomInfo.value = {
        ...(roomInfo.value || {}),
        fightRoleBase: teamInfo?.fightRoleBase || [],
      };
      addLog(t("tenHallTeamBattleCard.logs.roomMembersRestored"));
    }
  } catch (error: any) {
    addLog(t("tenHallTeamBattleCard.logs.restoreStateFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  }
};

const loadPresetTeam = async (expectTeamId?: number, silent = false) => {
  const reqId = ++presetReadReqId.value;
  loadingPreset.value = true;
  try {
    const targetTeamId = expectTeamId ? Number(expectTeamId || 1) : undefined;
    const mainline = await getMainlinePresetTeam(targetTeamId);
    if (!mainline)
      return;
    if (reqId !== presetReadReqId.value)
      return;
    lineupBattleTeam.value = mainline.battleTeam;
    lineupHeroLevel.value = mainline.levelMap;
    selectedFormationId.value = Number(mainline.teamId || selectedFormationId.value || 1);
    updateKnownHeroLevels(mainline.levelMap, mainline.battleTeam);
    addLog(
      t("tenHallTeamBattleCard.logs.lineupRead", {
        formation: selectedFormationId.value,
        useTeamId: mainline.useTeamId,
        lineup: [0, 1, 2, 3, 4]
          .map((i) => Number(mainline.battleTeam[String(i)] || 0))
          .join(","),
      }),
    );
    const validCount = Object.values(lineupBattleTeam.value).filter((id) => Number(id) > 0).length;
    if (!silent) {
      if (validCount !== 5) {
        message.warning(t("tenHallTeamBattleCard.messages.lineupReadPartial", {
          formation: selectedFormationId.value,
          count: validCount,
        }));
      } else {
        message.success(t("tenHallTeamBattleCard.messages.lineupReadSuccess", { formation: selectedFormationId.value }));
      }
    }
  } catch (error: any) {
    if (!silent)
      message.error(t("tenHallTeamBattleCard.messages.lineupReadFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    if (reqId === presetReadReqId.value)
      loadingPreset.value = false;
  }
};

const readPresetTeamNow = async () => {
  const targetTeamId = Number(selectedFormationId.value || 1);
  loadingPreset.value = true;
  try {
    // 某些区服在“当前阵容未切换”的情况下不会立即返回最新快照，先激活一次当前阵容号
    await sendCmd("presetteam_saveteam", { teamId: targetTeamId }, 8000).catch(() => null);
    syncGlobalPresetUseTeamId(targetTeamId);

    // 轮询几次，避免拿到旧缓存
    for (let i = 0; i < 3; i += 1) {
      await loadPresetTeam(targetTeamId, i < 2);
      if (i < 2)
        await sleep(180);
    }
  } finally {
    loadingPreset.value = false;
  }
};

const switchFormation = async () => {
  const teamId = Number(selectedFormationId.value || 1);
  switchingFormation.value = true;
  try {
    await sendCmd("presetteam_saveteam", { teamId }, 10000);
    syncGlobalPresetUseTeamId(teamId);
    // 部分区服切换阵容生效存在延迟，轮询确认 useTeamId 避免读到旧数据
    let confirmed = false;
    for (let i = 0; i < 5; i += 1) {
      const now = await getMainlinePresetTeam();
      if (Number(now?.useTeamId || 0) === teamId) {
        confirmed = true;
        break;
      }
      await sleep(220);
    }
    if (!confirmed) {
      addLog(t("tenHallTeamBattleCard.logs.switchConfirmTimeout", { teamId }));
    }
    message.success(t("tenHallTeamBattleCard.messages.switchSucceeded", { teamId }));
    await loadPresetTeam(teamId);
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.switchFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    switchingFormation.value = false;
  }
};

const syncLineupToTenHall = async () => {
  if (!Object.keys(lineupBattleTeam.value).length) {
    message.warning(t("tenHallTeamBattleCard.messages.readLineupFirst"));
    return;
  }
  const validHeroIds = Object.values(lineupBattleTeam.value)
    .map((id) => Number(id || 0))
    .filter((id) => id > 0);
  if (validHeroIds.length !== 5) {
    message.warning(t("tenHallTeamBattleCard.messages.invalidLineupCount", { count: validHeroIds.length }));
    return;
  }
  if (new Set(validHeroIds).size !== validHeroIds.length) {
    message.warning(t("tenHallTeamBattleCard.messages.duplicateHeroes"));
    return;
  }
  savingLineup.value = true;
  try {
    await sendCmd("team_setteam", {
      battleTeam: lineupBattleTeam.value,
      cCMonsterId: 0,
      lordWeaponId: TENHALL_LORD_WEAPON_ID,
      teamType: 3,
    });
    await calcTenHallTeamPower(lineupBattleTeam.value);
    message.success(t("tenHallTeamBattleCard.messages.lineupSynced"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.lineupSyncFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    savingLineup.value = false;
  }
};

const setFighter = async () => {
  if (!currentRoomId.value || !selectedFighterRoleId.value) {
    return message.warning(t("tenHallTeamBattleCard.messages.selectRoomMemberFirst"));
  }
  settingFighter.value = true;
  try {
    await sendCmd("nightmare_setfighter", {
      roomId: currentRoomId.value,
      roleId: Number(selectedFighterRoleId.value),
    });
    message.success(t("tenHallTeamBattleCard.messages.fighterSet"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.setFighterFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    settingFighter.value = false;
  }
};

const prepareFight = async () => {
  if (!currentTeamId.value) {
    return message.warning(t("tenHallTeamBattleCard.messages.noTeamId"));
  }
  preparingFight.value = true;
  try {
    await sendCmd(
      "matchteam_memberprepare",
      {
        teamId: currentTeamId.value,
      },
      10000,
    );
    message.success(t("tenHallTeamBattleCard.messages.prepareSent"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.prepareFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    preparingFight.value = false;
  }
};

const startFight = async () => {
  if (!currentRoomId.value || !selectedFighterRoleId.value) {
    return message.warning(t("tenHallTeamBattleCard.messages.selectRoomMemberFirst"));
  }
  fighting.value = true;
  try {
    await sendCmd("nightmare_fight", {
      roomId: currentRoomId.value,
      roleId: Number(selectedFighterRoleId.value),
    }, 20000);
    message.success(t("tenHallTeamBattleCard.messages.fightStarted"));
  } catch (error: any) {
    message.error(t("tenHallTeamBattleCard.messages.fightFailed", { error: error?.message || t("tenHallTeamBattleCard.common.unknownError") }));
  } finally {
    fighting.value = false;
  }
};

watch(
  () => {
    const tokenId = tokenStore.selectedToken?.id;
    if (!tokenId)
      return null;
    return tokenStore.wsConnections?.[tokenId]?.lastMessage;
  },
  (msg) => {
    if (!msg?.data)
      return;
    const rawCmd = String(msg.data?.cmd || msg.cmd || "");
    const cmd = rawCmd.toLowerCase();
    const body = extractBody(msg.data) || {};

    if (cmd === "matchteam_notify") {
      applyTeamInfo(body?.matchTeamData || body?.teamInfo || body);
      addLog(t("tenHallTeamBattleCard.logs.teamStatusNotify"));
    }
    if (cmd === "nightmare_roominfo_notify") {
      roomInfo.value = body?.roomInfo || body;
      addLog(t("tenHallTeamBattleCard.logs.roomUpdated", { roomId: roomInfo.value?.roomId || "-" }));
    }
    if (cmd === "nightmare_fightresp" || cmd === "nightmare_fightnotify") {
      addLog(t("tenHallTeamBattleCard.logs.fightResultNotify"));
    }
    if (cmd === "matchteam_memberprepareresp" || cmd === "matchteam_memberpreparenotify") {
      addLog(t("tenHallTeamBattleCard.logs.prepareStatusNotify"));
    }
    if (cmd === "matchteam_getrandteamlistresp") {
      recommendedTeams.value = body?.teamInfo || [];
      addLog(t("tenHallTeamBattleCard.logs.recommendedUpdated"));
    }
    if (cmd === "hall_getinforesp") {
      addLog(t("tenHallTeamBattleCard.logs.hallInfoNotify"));
    }
  },
  { deep: true },
);

onMounted(() => {
  addLog(t("tenHallTeamBattleCard.logs.viewReady"));
  restoreTeamState();
  loadPresetTeam();
});

watch(
  () => tokenStore.selectedToken?.id,
  (newId, oldId) => {
    if (!newId || newId === oldId)
      return;
    myTeam.value = null;
    roomInfo.value = null;
    lineupBattleTeam.value = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    lineupHeroLevel.value = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    restoreTeamState();
    loadPresetTeam();
  },
);

watch(
  () => authStore.isAuthenticated,
  (isAuthed) => {
    if (!isAuthed)
      return;
    if (currentRoleId.value > 0)
      pullTemplateCloud(true);
  },
);
</script>

<style scoped lang="scss">
.ten-hall-card.main-card {
  gap: 14px;
}

.ten-hall-card {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 8px;
}

.summary-item {
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 8px;
  padding: 8px;
  background: var(--bg-secondary, #f8fafc);
}

.label {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.value {
  font-weight: 600;
}

.value.ok {
  color: #16a34a;
}

.value.danger {
  color: #dc2626;
}

.stage-row {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.stage-chip {
  width: 30px;
  height: 30px;
  border-radius: 999px;
  border: 1px solid #caa470;
  background: color-mix(in srgb, var(--bg-secondary) 78%, #f5c97e 22%);
  color: #7c4a14;
  font-weight: 600;
}

.stage-chip.active {
  background: #f59e0b;
  color: #fff;
  border-color: #f59e0b;
}

.panel-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 12px;
}

.panel {
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 10px;
  padding: 10px;
  background: var(--surface-glass-strong, var(--bg-elevated));
}

.panel.full {
  grid-column: 1 / -1;
}

.panel-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 8px;
}

.search-row,
.lineup-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.recommended-title {
  font-size: 13px;
  font-weight: 600;
  margin: 6px 0;
}

.team-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.team-item {
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 8px;
  padding: 8px;
  background: var(--surface-glass, var(--bg-secondary));
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.team-main {
  min-width: 0;
}

.team-name {
  font-size: 13px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team-meta {
  font-size: 12px;
  color: var(--text-secondary, #64748b);
}

.searched-card {
  margin-top: 8px;
  border: 1px dashed #f59e0b;
  border-radius: 8px;
  padding: 8px;
  background: color-mix(in srgb, var(--bg-secondary) 84%, #f59e0b 16%);
}

.form-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.lineup-table {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.lineup-item {
  border: 1px solid var(--border-light, #e5e7eb);
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  background: var(--surface-glass, var(--bg-secondary));
  display: flex;
  justify-content: space-between;
}

.log-list {
  max-height: 240px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.log-item {
  font-size: 12px;
  display: flex;
  gap: 8px;
}

.log-item .time {
  color: var(--text-tertiary, #64748b);
  flex: 0 0 auto;
}

.log-item .text {
  color: var(--text-primary, #0f172a);
}

.muted {
  color: #94a3b8;
  font-size: 12px;
}
</style>
