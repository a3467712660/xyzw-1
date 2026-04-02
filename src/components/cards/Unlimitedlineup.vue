<template>
  <MyCard class="lineup-saver" :statusClass="{ active: state.isRunning }">
    <template #icon>
      <img
        src="/icons/Ob7pyorzmHiJcbab2c25af264d0758b527bc1b61cc3b.png"
        alt="阵容图标"
      />
    </template>
    <template #title>
      <h3>阵容助手</h3>
      <p>保存阵容、快速切换</p>
    </template>
    <template #badge>
      <span>{{ state.isRunning ? "运行中" : "已停止" }}</span>
    </template>
    <template #default>
      <div class="lineup-container">
        <div class="toolbar">
          <n-button
            type="primary"
            size="small"
            @click="refreshTeamInfo"
            :loading="loading"
          >
            刷新数据
          </n-button>
          <n-button
            size="small"
            @click="saveCurrentLineup"
            :disabled="editingHeroes.length === 0"
          >
            保存阵容
          </n-button>
          <n-button
            type="success"
            size="small"
            @click="openAddHeroModal"
            :disabled="editingHeroes.length >= 5"
          >
            上阵英雄
          </n-button>
          <n-button
            type="info"
            size="small"
            @click="savedLineupsModalVisible = true"
          >
            已保存阵容 ({{ savedLineups.length }})
          </n-button>
        </div>

        <div class="quick-switch-section">
          <h4>阵容槽位</h4>
          <div class="team-selector">
            <n-button
              v-for="teamId in availableTeams"
              :key="teamId"
              :type="currentTeamId === teamId ? 'primary' : 'default'"
              size="small"
              @click="switchTeam(teamId)"
              :loading="switchingTeamId === teamId"
            >
              阵容{{ teamId }}
            </n-button>
          </div>
        </div>

        <div class="current-team-section" v-if="currentTeamInfo">
          <h4>
            编辑阵容 (阵容槽位{{ currentTeamId }})
            <span class="drag-tip">拖拽调整站位</span>
          </h4>
          <div class="heroes-grid">
            <div
              v-for="(hero, index) in editingHeroes"
              :key="hero.heroId + '-' + hero.position"
              class="hero-item"
              :class="{
                dragging: draggedHeroId === hero.heroId,
                'drag-over': dragOverPosition === hero.position,
              }"
              draggable="true"
              @dragstart="onDragStart($event, hero)"
              @dragend="onDragEnd"
              @dragover.prevent="onDragOver($event, hero)"
              @dragleave="onDragLeave"
              @drop="onDrop($event, hero)"
            >
              <div class="hero-position">{{ hero.position + 1 }}</div>
              <div class="hero-left" @click="showHeroRefineModal(hero)">
                <div class="hero-avatar">
                  <img
                    v-if="getHeroAvatar(hero.heroId)"
                    :src="getHeroAvatar(hero.heroId)"
                    :alt="getHeroName(hero.heroId)"
                  />
                  <div v-else class="hero-placeholder">
                    {{ getHeroName(hero.heroId)?.substring(0, 2) || "?" }}
                  </div>
                </div>
                <div class="hero-avatar-info">
                  <div class="hero-name-small-inline">
                    {{ getHeroName(hero.heroId) || `武将${hero.heroId}` }}
                  </div>
                  <div class="hero-level-small-inline" v-if="hero.level">
                    Lv.{{ hero.level }}
                  </div>
                </div>
              </div>
              <div class="hero-info" @click="showHeroRefineModal(hero)">
                <div class="hero-fish" v-if="getFishInfo(hero.artifactId)">
                  {{ getFishInfo(hero.artifactId).name }}
                  <span
                    v-if="getPearlSkillNameByArtifactId(hero.artifactId)"
                    class="hero-fish-skill-inline"
                  >
                    {{ getPearlSkillNameByArtifactId(hero.artifactId) }}
                  </span>
                  <span
                    v-if="getSlotColorsByArtifactId(hero.artifactId)"
                    class="hero-fish-slots-inline"
                  >
                    <span
                      v-for="(color, idx) in getSlotColorsByArtifactId(
                        hero.artifactId,
                      )"
                      :key="idx"
                      class="slot-dot-small"
                      :style="{ backgroundColor: color }"
                    ></span>
                  </span>
                </div>
                <div class="hero-stats" v-if="hero.power">
                  <div class="stat-row">
                    <span class="stat-power"
                      >战力{{ formatPower(hero.power) }}</span
                    >
                    <span class="stat-speed" v-if="hero.speed"
                      >速度{{ hero.speed }}</span
                    >
                  </div>
                  <div class="stat-row">
                    <span class="stat-attack" v-if="hero.attack"
                      >攻击{{ formatPower(hero.attack) }}</span
                    >
                    <span class="stat-hp" v-if="hero.hp"
                      >血量{{ formatPower(hero.hp) }}</span
                    >
                  </div>
                </div>
              </div>
              <div class="hero-actions">
                <n-button
                  class="exchange-btn"
                  size="tiny"
                  type="warning"
                  @click.stop="openExchangeModal(hero)"
                >
                  更换
                </n-button>
                <n-button
                  class="remove-btn"
                  size="tiny"
                  type="error"
                  @click.stop="removeHero(hero)"
                >
                  下阵
                </n-button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <n-modal
        v-model:show="savedLineupsModalVisible"
        preset="card"
        title="已保存的阵容"
        style="width: 900px; max-width: 90vw"
        :bordered="false"
      >
        <div v-if="savedLineups.length === 0" class="empty-tip">
          暂无保存的阵容，点击"保存阵容"开始使用
        </div>
        <div v-else class="saved-lineups-modal-content">
          <div class="team-tabs">
            <div class="team-tabs-left">
              <div
                v-for="teamId in availableTeams"
                :key="teamId"
                class="team-tab"
                :class="{ active: selectedTeamTab === teamId }"
                @click="selectedTeamTab = teamId"
              >
                槽位{{ teamId }}
                <span class="tab-count"
                  >({{ getLineupsByTeamId(teamId).length }})</span
                >
              </div>
            </div>
            <div class="team-tabs-right">
              <n-button
                size="tiny"
                :loading="savedLineupsCloudSyncing || savedLineupsCloudLoading"
                @click="syncSavedLineupsCloudNow"
              >
                同步云端
              </n-button>
              <n-button size="tiny" @click="exportLineups"> 导出 </n-button>
              <n-upload
                :show-file-list="false"
                :custom-request="importLineups"
                accept=".json"
              >
                <n-button size="tiny">导入</n-button>
              </n-upload>
            </div>
          </div>
          <div class="lineups-list">
            <div
              v-for="(lineup, index) in getLineupsByTeamId(selectedTeamTab)"
              :key="index"
              class="lineup-card"
            >
              <div class="lineup-title-bar" @click="toggleLineupExpand(lineup)">
                <div class="lineup-title-left">
                  <span class="expand-icon">{{
                    expandedLineup === lineup ? "▼" : "▶"
                  }}</span>
                  <span class="lineup-name">{{ lineup.name }}</span>
                  <span
                    v-if="
                      lineup.weaponId !== undefined && lineup.weaponId !== null
                    "
                    class="lineup-weapon-tag"
                  >
                    {{ weapon[lineup.weaponId] || lineup.weaponId }}
                  </span>
                  <span class="lineup-time">{{
                    formatTime(lineup.savedAt)
                  }}</span>
                </div>
                <div class="lineup-quick-actions">
                  <n-button
                    size="tiny"
                    @click.stop="renameLineup(savedLineups.indexOf(lineup))"
                  >
                    重命名
                  </n-button>
                  <n-button
                    size="tiny"
                    @click.stop="showTechModal(lineup)"
                    :disabled="
                      !lineup.legionResearch ||
                      Object.keys(lineup.legionResearch).length === 0
                    "
                  >
                    科技
                  </n-button>
                  <n-button
                    type="error"
                    size="tiny"
                    @click.stop="deleteLineup(savedLineups.indexOf(lineup))"
                  >
                    删除
                  </n-button>
                  <n-button
                    type="primary"
                    size="tiny"
                    @click.stop="
                      applyLineup(lineup);
                      savedLineupsModalVisible = false;
                    "
                    :loading="lineup.applying"
                    :disabled="lineup.teamId !== currentTeamId"
                  >
                    应用
                  </n-button>
                </div>
              </div>
              <div v-if="expandedLineup === lineup" class="lineup-detail">
                <div class="lineup-heroes-row">
                  <div
                    v-for="(hero, hIdx) in lineup.heroes"
                    :key="hIdx"
                    class="lineup-hero-card"
                  >
                  <img
                      v-if="getHeroAvatar(hero.heroId)"
                      :src="getHeroAvatar(hero.heroId)"
                      class="hero-avatar"
                    />
                    <div v-else class="hero-avatar-placeholder">
                      {{ getHeroName(hero.heroId)?.[0] || "?" }}
                    </div>
                    <div class="hero-info-small">
                      <div class="hero-header-small">
                        <div class="hero-name-small">
                          {{ getHeroName(hero.heroId) || `武将${hero.heroId}` }}
                        </div>
                        <div v-if="hero.level" class="hero-level-small">
                          Lv.{{ formatLevel(hero.level) }}
                        </div>
                      </div>
                      <div v-if="hero.fishId" class="hero-fish-info">
                        <div class="hero-fish-row">
                          <span class="hero-fish-name">
                            {{ getFishNameById(hero.fishId) }}
                            <span
                              v-if="hero.skillId"
                              class="hero-fish-skill-name"
                            >
                              {{ getPearlSkillNameById(hero.skillId) }}
                            </span>
                          </span>
                          <div
                            v-if="getSlotColors(hero.slotMap)"
                            class="hero-fish-slots"
                          >
                            <span
                              v-for="(color, idx) in getSlotColors(
                                hero.slotMap,
                              )"
                              :key="idx"
                              class="slot-dot"
                              :style="{ backgroundColor: color }"
                            ></span>
                          </div>
                        </div>
                      </div>
                      <div v-if="hero.power" class="hero-stats-small">
                        <div class="stat-row-small">
                          <span class="stat-power"
                            >战力{{ formatPower(hero.power) }}</span
                          >
                          <span class="stat-speed" v-if="hero.speed"
                            >速度{{ hero.speed }}</span
                          >
                        </div>
                        <div class="stat-row-small">
                          <span class="stat-attack" v-if="hero.attack"
                            >攻击{{ formatPower(hero.attack) }}</span
                          >
                          <span class="stat-hp" v-if="hero.hp"
                            >血量{{ formatPower(hero.hp) }}</span
                          >
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div
              v-if="getLineupsByTeamId(selectedTeamTab).length === 0"
              class="no-lineup-tip"
            >
              暂无保存的阵容
            </div>
          </div>
        </div>
      </n-modal>

      <n-modal
        v-model:show="applyProgressModalVisible"
        preset="card"
        title="正在应用已保存阵容"
        style="width: 540px; max-width: 92vw"
        :bordered="false"
        :closable="false"
        :mask-closable="false"
        :close-on-esc="false"
      >
        <div class="apply-progress-modal">
          <div class="apply-progress-head">
            <strong class="apply-progress-lineup">{{
              applyProgressLineupName
            }}</strong>
            <span
              class="apply-progress-stage"
              :class="{ 'apply-progress-stage--overdue': applyProgressOverdue }"
            >{{
              applyProgressStageText
            }}</span>
          </div>

          <div class="apply-progress-stats">
            <div class="apply-progress-stat">
              <span class="apply-progress-label">预计耗时</span>
              <strong>{{ applyProgressEstimatedText }}</strong>
            </div>
            <div class="apply-progress-stat">
              <span class="apply-progress-label">已用时</span>
              <strong>{{ applyProgressElapsedText }}</strong>
            </div>
            <div class="apply-progress-stat">
              <span class="apply-progress-label">命令间隔</span>
              <strong>{{ applyProgressDelayRangeText }}</strong>
            </div>
          </div>

          <div class="apply-progress-bar">
            <div
              class="apply-progress-bar__fill"
              :class="{ 'apply-progress-bar__fill--overdue': applyProgressOverdue }"
              :style="{ width: `${applyProgressPercent}%` }"
            ></div>
          </div>

          <p
            class="apply-progress-source"
            :class="{ 'apply-progress-source--overdue': applyProgressOverdue }"
          >
            {{ applyProgressSourceText }}
          </p>

          <div class="apply-progress-warning">
            <strong>应用过程中请不要切到后台，也不要进行其他操作。</strong>
            <span>
              请等待当前阵容、鱼灵、鱼珠技能、科技和玩具同步完成，页面会在最后自动刷新结果。
            </span>
            <span v-if="applyProgressOverdue" class="apply-progress-overdue-tip">
              当前已经超过预计时间，但任务仍在继续执行中，这不会自动取消。
            </span>
          </div>
        </div>
      </n-modal>

      <n-modal
        v-model:show="techModalVisible"
        preset="card"
        title="俱乐部科技"
        style="width: 700px; max-width: 90vw"
        :bordered="false"
      >
        <div v-if="selectedTechData" class="tech-modal-content">
          <div
            v-for="type in [1, 2, 3, 4, 5, 6]"
            :key="type"
            class="tech-type-section"
          >
            <div class="tech-type-header">
              {{ LEGION_TECH_TYPE_NAME[type] }}
            </div>
            <div class="tech-items">
              <div
                v-for="techId in LEGION_TECH_TYPE_MAP[type]"
                :key="techId"
                class="tech-item"
              >
                <span class="tech-name">{{ LEGION_TECH_NAME[techId] }}</span>
                <span class="tech-level">
                  {{ selectedTechData[techId] || 0 }}/{{
                    LEGION_TECH_MAX_LEVEL[techId]
                  }}
                </span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="no-tech-data">暂无科技数据</div>
      </n-modal>

      <n-modal
        v-model:show="refineModalVisible"
        preset="card"
        :title="refineModalTitle"
        style="width: 600px; max-width: 90vw"
        :bordered="false"
      >
        <n-spin :show="refineModalLoading">
          <div v-if="selectedHeroEquipment" class="refine-modal-content">
            <div
              v-for="partId in [1, 2, 3, 4]"
              :key="partId"
              class="equip-refine-section"
            >
              <div class="equip-header">
                <span class="equip-name">{{ partMap[partId] }}</span>
                <span class="equip-level">
                  Lv.{{ selectedHeroEquipment[partId]?.level || 0 }}
                </span>
                <span class="equip-bonus" v-if="selectedHeroEquipment[partId]">
                  +{{ getEquipBonus(partId) }}
                  {{ partId === 1 ? "攻击" : partId === 3 ? "防御" : "血量" }}
                </span>
              </div>
              <div class="slots-container">
                <div
                  v-for="slot in getEquipSlots(partId)"
                  :key="slot.id"
                  class="slot-item"
                  :class="{
                    locked: slot.isLocked,
                    [`color-${slot.colorId}`]: slot.colorId > 0,
                  }"
                >
                  <span class="slot-label">孔{{ slot.id }}</span>
                  <div v-if="slot.attrId" class="slot-attr">
                    <span class="attr-name">{{
                      getAttrName(slot.attrId)
                    }}</span>
                    <span class="attr-value">+{{ slot.attrNum }}%</span>
                  </div>
                  <div v-else class="slot-empty">未淬炼</div>
                  <n-tag v-if="slot.isLocked" size="small" type="warning"
                    >锁定</n-tag
                  >
                </div>
              </div>
            </div>
          </div>
          <div v-else class="no-equipment">暂无装备数据</div>
        </n-spin>
      </n-modal>

      <n-modal
        v-model:show="exchangeModalVisible"
        preset="card"
        :title="exchangeMode === 'add' ? '上阵英雄' : '更换武将'"
        style="width: 700px; max-width: 90vw"
        :bordered="false"
      >
        <div class="exchange-modal-content">
          <div v-if="exchangeMode === 'exchange'" class="current-hero-info">
            <span>当前武将：</span>
            <n-tag type="primary" size="large">
              {{
                getHeroName(exchangeHero?.heroId) ||
                `武将${exchangeHero?.heroId}`
              }}
            </n-tag>
          </div>
          <div v-else class="current-hero-info">
            <span>上阵位置：</span>
            <n-tag type="success" size="large">
              位置 {{ getFirstEmptySlot() + 1 }}
            </n-tag>
          </div>
          <n-input
            v-model:value="heroSearchKeyword"
            placeholder="搜索武将名称..."
            clearable
            style="margin-bottom: 12px"
          />
          <div class="hero-filter-section">
            <div class="filter-label">品质：</div>
            <div class="filter-tags">
              <n-tag
                v-for="q in heroQualities"
                :key="q"
                :type="selectedQuality === q ? 'primary' : 'default'"
                :bordered="false"
                style="cursor: pointer; margin-right: 8px"
                @click="selectedQuality = selectedQuality === q ? '全部' : q"
              >
                {{ q }}
              </n-tag>
            </div>
          </div>
          <div class="hero-filter-section">
            <div class="filter-label">国家：</div>
            <div class="filter-tags">
              <n-tag
                v-for="t in heroCountries"
                :key="t"
                :type="selectedCountry === t ? 'primary' : 'default'"
                :bordered="false"
                style="cursor: pointer; margin-right: 8px"
                @click="selectedCountry = selectedCountry === t ? '全部' : t"
              >
                {{ t }}
              </n-tag>
            </div>
          </div>
          <n-spin :show="exchangeLoading">
            <div class="hero-select-grid">
              <div
                v-for="hero in filteredHeroList"
                :key="hero.id"
                class="hero-select-item"
                :class="{
                  selected: exchangeTargetHeroId === hero.id,
                  'quality-red': hero.quality === '红将',
                  'quality-orange': hero.quality === '橙将',
                  'quality-purple': hero.quality === '紫将',
                }"
                @click="selectExchangeHero(hero)"
              >
                <div class="hero-select-avatar">
                  <img
                    v-if="hero.avatar"
                    :src="hero.avatar"
                    :alt="hero.name"
                  />
                  <div v-else class="hero-placeholder">
                    {{ hero.name?.substring(0, 2) || "?" }}
                  </div>
                </div>
                <div class="hero-select-name">{{ hero.name }}</div>
                <div class="hero-select-tags">
                  <n-tag
                    size="small"
                    :bordered="false"
                    :type="
                      hero.quality === '红将'
                        ? 'error'
                        : hero.quality === '橙将'
                          ? 'warning'
                          : hero.quality === '紫将'
                            ? 'info'
                            : 'default'
                    "
                  >
                    {{ hero.quality }}
                  </n-tag>
                  <n-tag size="small" :bordered="false" type="default">
                    {{ hero.type }}
                  </n-tag>
                </div>
              </div>
            </div>
          </n-spin>
        </div>
        <template #footer>
          <div style="display: flex; justify-content: flex-end; gap: 8px">
            <n-button @click="exchangeModalVisible = false">取消</n-button>
            <n-button
              type="primary"
              @click="confirmHeroAction"
              :loading="exchangeLoading"
              :disabled="!exchangeTargetHeroId"
            >
              {{ exchangeMode === "add" ? "确认上阵" : "确认更换" }}
            </n-button>
          </div>
        </template>
      </n-modal>
    </template>
  </MyCard>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch, h } from "vue";
import { useMessage, useDialog, NInput } from "naive-ui";
import { useTokenStore } from "@/stores/tokenStore";
import { useAuthStore } from "@/stores/auth";
import api from "@/api";
import {
  acquireTokenOperationLock,
  releaseTokenOperationLock,
} from "@/services/token/tokenOperationCoordination";
import MyCard from "../Common/MyCard.vue";
import {
  HERO_DICT,
  FishMap,
  PearlMap,
  LEGION_TECH_MAX_LEVEL,
  LEGION_TECH_TYPE_MAP,
  LEGION_TECH_RESET_TYPE_MAP,
  LEGION_TECH_TYPE_NAME,
  LEGION_TECH_NAME,
  getTechType,
  weapon,
  color,
} from "@/utils/HeroList.js";

const tokenStore = useTokenStore();
const authStore = useAuthStore();
const message = useMessage();
const dialog = useDialog();

const loading = ref(false);
const switchingTeamId = ref(null);
const currentTeamId = ref(1);
const availableTeams = ref([1, 2, 3, 4, 5, 6]);
const currentTeamInfo = ref(null);
const presetTeamData = ref(null);
const savedLineups = ref([]);
const allHeroesData = ref({});
const roleHeroesData = ref({});
const editingTeamHeroes = ref({});
const artifactBooks = ref({});
const pearlMap = ref({});
let lastRefreshTime = 0;
const REFRESH_DEBOUNCE = 3000;
const COMMAND_DELAY = 500;
const APPLY_LINEUP_COMMAND_DELAY_MIN = 2500;
const APPLY_LINEUP_COMMAND_DELAY_MAX = 3500;
const APPLY_LINEUP_STRUCTURAL_DELAY_MIN = 5000;
const APPLY_LINEUP_STRUCTURAL_DELAY_MAX = 7000;
const APPLY_SKIP_WARNING_MAX_RETRIES = 4;
const APPLY_SERVER_WARNING_RETRY_DELAY = 10_000;
const APPLY_SERVER_WARNING_RETRY_DELAY_SLOW = 15_000;
const APPLY_RATE_LIMIT_RETRY_DELAY = 20_000;
const APPLY_DURATION_HISTORY_STORAGE_KEY = "saved_lineups_apply_duration_history";
const APPLY_DURATION_HISTORY_LIMIT = 6;
const APPLY_DIAGNOSTIC_SESSION_KEY = "xyzw:lineup-apply-diagnostics";
const APPLY_DIAGNOSTIC_BUFFER_LIMIT = 200;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const getRandomDelayInRange = (min, max) =>
  min + Math.floor(Math.random() * (max - min + 1));
const APPLY_STRUCTURAL_COMMANDS = new Set([
  "hero_gointobattle",
  "hero_gobackbattle",
  "hero_exchange",
]);

const formatPower = (power) => {
  if (!power) return "0";
  if (power >= 100000000) {
    return `${(power / 100000000).toFixed(2)}亿`;
  }
  if (power >= 10000) {
    return `${(power / 10000).toFixed(2)}万`;
  }
  return power.toString();
};
const getRandomApplyCommandDelay = () =>
  getRandomDelayInRange(
    APPLY_LINEUP_COMMAND_DELAY_MIN,
    APPLY_LINEUP_COMMAND_DELAY_MAX,
  );
const getRandomStructuralApplyCommandDelay = () =>
  getRandomDelayInRange(
    APPLY_LINEUP_STRUCTURAL_DELAY_MIN,
    APPLY_LINEUP_STRUCTURAL_DELAY_MAX,
  );
const getApplyCommandCooldown = (cmd) =>
  APPLY_STRUCTURAL_COMMANDS.has(String(cmd || "").trim())
    ? getRandomStructuralApplyCommandDelay()
    : getRandomApplyCommandDelay();

const formatDurationMs = (durationMs) => {
  const totalSeconds = Math.max(1, Math.round(Number(durationMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) {
    return `${totalSeconds}秒`;
  }
  return `${minutes}分${String(seconds).padStart(2, "0")}秒`;
};

const serializeApplyDiagnosticValue = (value) => {
  if (value === undefined) return null;
  if (value === null) return null;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
};

const getApplyDiagnosticBuffer = () => {
  if (typeof window === "undefined") {
    return [];
  }

  const bufferKey = "__XYZW_LINEUP_APPLY_DIAGNOSTICS__";
  if (!Array.isArray(window[bufferKey])) {
    try {
      const cached = sessionStorage.getItem(APPLY_DIAGNOSTIC_SESSION_KEY);
      window[bufferKey] = cached ? JSON.parse(cached) : [];
    } catch {
      window[bufferKey] = [];
    }
  }

  return window[bufferKey];
};

const appendApplyDiagnosticEntry = (entry) => {
  if (typeof window === "undefined") {
    return entry;
  }

  const buffer = getApplyDiagnosticBuffer();
  buffer.push(entry);
  if (buffer.length > APPLY_DIAGNOSTIC_BUFFER_LIMIT) {
    buffer.splice(0, buffer.length - APPLY_DIAGNOSTIC_BUFFER_LIMIT);
  }

  try {
    sessionStorage.setItem(
      APPLY_DIAGNOSTIC_SESSION_KEY,
      JSON.stringify(buffer),
    );
  } catch {}

  return entry;
};

const generateLineupId = () => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

const state = ref({
  isRunning: false,
});

const refineModalVisible = ref(false);
const refineModalLoading = ref(false);
const refineModalTitle = ref("");
const selectedHeroEquipment = ref(null);

const exchangeModalVisible = ref(false);
const exchangeLoading = ref(false);
const exchangeMode = ref("exchange");
const exchangeHero = ref(null);
const exchangeTargetHeroId = ref(null);
const heroSearchKeyword = ref("");
const selectedQuality = ref("全部");
const selectedCountry = ref("全部");
const savedLineupsModalVisible = ref(false);
const selectedTeamTab = ref(1);
const expandedLineup = ref(null);
const techModalVisible = ref(false);
const selectedTechData = ref(null);

const draggedHeroId = ref(null);
const dragOverPosition = ref(null);

const STORAGE_KEY = "saved_lineups";
const SAVED_LINEUPS_PREF_KEY_PREFIX = "lineup.saved_lineups.v1";
const applyProgressModalVisible = ref(false);
const applyProgressLineupName = ref("");
const applyProgressStage = ref("");
const applyProgressEstimateMs = ref(0);
const applyProgressEstimateSource = ref("");
const applyProgressElapsedMs = ref(0);
let applyProgressStartedAt = 0;
let applyProgressTimer = null;
const savedLineupsCloudLoading = ref(false);
const savedLineupsCloudSyncing = ref(false);
const applyingSavedLineupsCloud = ref(false);
let savedLineupsCloudTimer = null;

const applyProgressOverdue = computed(
  () =>
    applyProgressEstimateMs.value > 0
    && applyProgressElapsedMs.value > applyProgressEstimateMs.value,
);

const applyProgressPercent = computed(() => {
  if (!applyProgressEstimateMs.value) return 0;
  const percent = Math.round(
    (applyProgressElapsedMs.value / applyProgressEstimateMs.value) * 100,
  );
  return Math.min(95, Math.max(6, percent));
});

const applyProgressStageText = computed(() => {
  if (applyProgressOverdue.value) {
    return applyProgressStage.value
      ? `已超出预计时间，仍在继续执行 · ${applyProgressStage.value}`
      : "已超出预计时间，仍在继续执行";
  }
  return applyProgressStage.value || "正在准备";
});

const applyProgressEstimatedText = computed(() =>
  formatDurationMs(applyProgressEstimateMs.value),
);

const applyProgressElapsedText = computed(() =>
  formatDurationMs(applyProgressElapsedMs.value),
);

const applyProgressDelayRangeText = computed(
  () =>
    `${APPLY_LINEUP_COMMAND_DELAY_MIN}-${APPLY_LINEUP_COMMAND_DELAY_MAX}ms 随机`,
);

const applyProgressSourceText = computed(() => {
  if (applyProgressOverdue.value) {
    return "已超过预计时间。任务不会自动中断，请保持前台并继续等待执行完成。";
  }
  return applyProgressEstimateSource.value;
});

const getApplyDurationHistoryKey = (tokenId) =>
  `${APPLY_DURATION_HISTORY_STORAGE_KEY}_${tokenId}`;

const getSavedLineupsCloudScopeId = () => {
  const token = tokenStore.selectedToken;
  if (!token) {
    return "global";
  }
  return String(
    token.activationRoleId
    || token.activationGameAccountId
    || token.roleId
    || token.id
    || "global",
  ).trim() || "global";
};

const getSavedLineupsCloudPrefKey = () =>
  `${SAVED_LINEUPS_PREF_KEY_PREFIX}:${getSavedLineupsCloudScopeId()}`;

const sanitizeSavedLineupHero = (hero, index = 0) => ({
  position: Number(hero?.position ?? index) || 0,
  heroId: Number(hero?.heroId || 0) || 0,
  level: hero?.level != null ? Number(hero.level) || null : null,
  artifactId:
    hero?.artifactId != null && hero.artifactId !== ""
      ? Number(hero.artifactId) || null
      : null,
  attachmentUid:
    hero?.attachmentUid != null && hero.attachmentUid !== ""
      ? Number(hero.attachmentUid) || null
      : null,
  fishId: hero?.fishId != null ? Number(hero.fishId) || null : null,
  pearlId: hero?.pearlId != null ? Number(hero.pearlId) || null : null,
  skillId: hero?.skillId != null ? Number(hero.skillId) || null : null,
  slotMap:
    hero?.slotMap && typeof hero.slotMap === "object"
      ? JSON.parse(JSON.stringify(hero.slotMap))
      : null,
});

const sanitizeSavedLineups = (rawLineups) => {
  if (!Array.isArray(rawLineups)) {
    return [];
  }

  return rawLineups
    .map((lineup, index) => {
      if (!lineup || typeof lineup !== "object") {
        return null;
      }

      const heroes = Array.isArray(lineup.heroes)
        ? lineup.heroes
            .map((hero, heroIndex) => sanitizeSavedLineupHero(hero, heroIndex))
            .filter((hero) => hero.heroId > 0)
        : [];

      return {
        id: String(
          lineup.id
          || `cloud-${index}-${Number(lineup.savedAt || 0) || Number(lineup.teamId || 0)}`,
        ),
        name: String(lineup.name || `阵容${index + 1}`).trim() || `阵容${index + 1}`,
        heroes,
        teamId: Number(lineup.teamId || 1) || 1,
        savedAt: Number(lineup.savedAt || 0) || Date.now(),
        applying: false,
        legionResearch:
          lineup.legionResearch && typeof lineup.legionResearch === "object"
            ? { ...lineup.legionResearch }
            : {},
        weaponId:
          lineup.weaponId !== undefined && lineup.weaponId !== null
            ? Number(lineup.weaponId) || null
            : null,
      };
    })
    .filter((lineup) => lineup && lineup.heroes.length > 0);
};

const getSavedLineupsVersion = (lineups) => {
  const versions = sanitizeSavedLineups(lineups).map((lineup) =>
    Number(lineup?.savedAt || 0),
  );
  return versions.length ? Math.max(...versions) : 0;
};

const mergeSavedLineups = (localLineups, remoteLineups) => {
  const merged = new Map();

  sanitizeSavedLineups(localLineups).forEach((lineup) => {
    merged.set(lineup.id, lineup);
  });

  sanitizeSavedLineups(remoteLineups).forEach((lineup) => {
    const localLineup = merged.get(lineup.id);
    const remoteSavedAt = Number(lineup?.savedAt || 0);
    const localSavedAt = Number(localLineup?.savedAt || 0);
    if (!localLineup || remoteSavedAt >= localSavedAt) {
      merged.set(lineup.id, lineup);
    }
  });

  return Array.from(merged.values()).sort(
    (a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0),
  );
};

const pushSavedLineupsToCloud = async () => {
  if (!authStore.isAuthenticated || !tokenStore.selectedToken) {
    return;
  }

  const payload = {
    version: 1,
    roleId: getSavedLineupsCloudScopeId(),
    updatedAt: Date.now(),
    lineups: sanitizeSavedLineups(savedLineups.value).map((lineup) => ({
      ...lineup,
      applying: false,
    })),
  };

  await api.user.setPreference(getSavedLineupsCloudPrefKey(), payload);
};

const pullSavedLineupsFromCloud = async (silent = true) => {
  if (!authStore.isAuthenticated || !tokenStore.selectedToken) {
    return;
  }

  savedLineupsCloudLoading.value = true;
  try {
    const localLineups = sanitizeSavedLineups(savedLineups.value);
    const res = await api.user.getPreference(getSavedLineupsCloudPrefKey());
    const rawValue = res?.data?.value;
    if (rawValue == null) {
      if (localLineups.length > 0) {
        await pushSavedLineupsToCloud();
        if (!silent) {
          message.success("已将本地已保存阵容上传到云端");
        }
      }
      return;
    }

    const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
    const remoteLineups = sanitizeSavedLineups(parsed?.lineups ?? parsed);
    const mergedLineups = mergeSavedLineups(localLineups, remoteLineups);
    const changed =
      JSON.stringify(mergedLineups) !== JSON.stringify(localLineups);

    if (changed) {
      applyingSavedLineupsCloud.value = true;
      savedLineups.value = mergedLineups;
      saveLineupsToStorage({ scheduleCloudSync: false });
      applyingSavedLineupsCloud.value = false;
      if (!silent) {
        message.success("已从云端同步已保存阵容");
      }
    }

    if (getSavedLineupsVersion(localLineups) > getSavedLineupsVersion(remoteLineups)) {
      await pushSavedLineupsToCloud();
    }
  } catch (error) {
    if (!silent) {
      message.error(`读取云端阵容失败: ${error?.message || error}`);
    }
  } finally {
    savedLineupsCloudLoading.value = false;
  }
};

const scheduleSavedLineupsCloudSync = () => {
  if (
    !authStore.isAuthenticated
    || !tokenStore.selectedToken
    || applyingSavedLineupsCloud.value
  ) {
    return;
  }

  if (savedLineupsCloudTimer) {
    clearTimeout(savedLineupsCloudTimer);
  }

  savedLineupsCloudTimer = setTimeout(async () => {
    savedLineupsCloudTimer = null;
    savedLineupsCloudSyncing.value = true;
    try {
      await pushSavedLineupsToCloud();
    } catch (error) {
      console.warn("同步已保存阵容到云端失败:", error?.message || error);
    } finally {
      savedLineupsCloudSyncing.value = false;
    }
  }, 300);
};

const syncSavedLineupsCloudNow = async () => {
  if (!authStore.isAuthenticated) {
    message.warning("请先登录后再同步云端阵容");
    return;
  }
  if (!tokenStore.selectedToken) {
    message.warning("请先选择Token");
    return;
  }

  savedLineupsCloudSyncing.value = true;
  try {
    await pushSavedLineupsToCloud();
    message.success("已保存阵容已同步到云端");
  } catch (error) {
    message.error(`同步云端阵容失败: ${error?.message || error}`);
  } finally {
    savedLineupsCloudSyncing.value = false;
  }
};

const loadApplyDurationHistory = (tokenId) => {
  if (!tokenId || typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(getApplyDurationHistoryKey(tokenId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((item) => Number(item)).filter((item) => Number.isFinite(item) && item > 0)
      : [];
  } catch {
    return [];
  }
};

const saveApplyDurationHistory = (tokenId, durationMs) => {
  if (!tokenId || typeof window === "undefined" || !durationMs) return;
  try {
    const history = loadApplyDurationHistory(tokenId);
    history.push(Math.round(durationMs));
    localStorage.setItem(
      getApplyDurationHistoryKey(tokenId),
      JSON.stringify(history.slice(-APPLY_DURATION_HISTORY_LIMIT)),
    );
  } catch {
    // ignore storage failures
  }
};

const estimateApplyDurationFromLineup = (lineup) => {
  const heroCount = Array.isArray(lineup?.heroes) ? lineup.heroes.length : 0;
  const hasLevelData = lineup?.heroes?.some((hero) => hero.level && hero.level > 0);
  const hasFishData = lineup?.heroes?.some((hero) => hero.pearlId || hero.fishId);
  const hasResearchData =
    lineup?.legionResearch && Object.keys(lineup.legionResearch).length > 0;
  const hasWeaponData =
    lineup?.weaponId !== undefined && lineup?.weaponId !== null;

  let commandCount = 16 + heroCount * 3;
  if (hasLevelData) commandCount += heroCount * 4;
  if (hasFishData) commandCount += heroCount * 4;
  if (hasResearchData) commandCount += 14;
  if (hasWeaponData) commandCount += 2;

  const averageCommandDelay =
    (APPLY_LINEUP_COMMAND_DELAY_MIN + APPLY_LINEUP_COMMAND_DELAY_MAX) / 2;
  const estimatedMs = commandCount * (averageCommandDelay + 350);
  return Math.max(45_000, Math.round(estimatedMs));
};

const buildApplyEstimate = (lineup) => {
  const tokenId = tokenStore.selectedToken?.id;
  const history = loadApplyDurationHistory(tokenId);
  if (history.length > 0) {
    const recent = history.slice(-APPLY_DURATION_HISTORY_LIMIT);
    const average =
      recent.reduce((sum, value) => sum + value, 0) / recent.length;
    return {
      durationMs: Math.max(30_000, Math.round(average * 1.12)),
      source: `基于当前角色最近 ${recent.length} 次应用耗时估算`,
    };
  }

  return {
    durationMs: estimateApplyDurationFromLineup(lineup),
    source: "当前还没有历史记录，先按阵容复杂度粗略估算",
  };
};

const clearApplyProgressTimer = () => {
  if (applyProgressTimer) {
    clearInterval(applyProgressTimer);
    applyProgressTimer = null;
  }
};

const startApplyProgress = (lineup) => {
  const estimate = buildApplyEstimate(lineup);
  applyProgressLineupName.value = lineup?.name || "已保存阵容";
  applyProgressStage.value = "正在准备应用流程";
  applyProgressEstimateMs.value = estimate.durationMs;
  applyProgressEstimateSource.value = estimate.source;
  applyProgressElapsedMs.value = 0;
  applyProgressStartedAt = Date.now();
  applyProgressModalVisible.value = true;
  clearApplyProgressTimer();
  applyProgressTimer = setInterval(() => {
    applyProgressElapsedMs.value = Date.now() - applyProgressStartedAt;
  }, 1000);
};

const setApplyProgressStage = (stage) => {
  applyProgressStage.value = stage;
  if (applyProgressStartedAt) {
    applyProgressElapsedMs.value = Date.now() - applyProgressStartedAt;
  }
};

const finishApplyProgress = ({ recordDuration = false } = {}) => {
  const elapsed = applyProgressStartedAt
    ? Date.now() - applyProgressStartedAt
    : 0;

  if (recordDuration && tokenStore.selectedToken?.id && elapsed > 0) {
    saveApplyDurationHistory(tokenStore.selectedToken.id, elapsed);
  }

  clearApplyProgressTimer();
  applyProgressModalVisible.value = false;
  applyProgressLineupName.value = "";
  applyProgressStage.value = "";
  applyProgressEstimateMs.value = 0;
  applyProgressEstimateSource.value = "";
  applyProgressElapsedMs.value = 0;
  applyProgressStartedAt = 0;
};

const syncLegionResearch = async (
  tokenId,
  targetResearch,
  waitAfterCommand = async () => {
    await delay(COMMAND_DELAY);
  },
) => {
  if (!targetResearch || Object.keys(targetResearch).length === 0) {
    return { success: true, message: "无科技数据需要同步" };
  }

  const roleInfo = await tokenStore.sendMessageWithPromise(
    tokenId,
    "role_getroleinfo",
    {},
  );
  await waitAfterCommand();
  const role = roleInfo?.role || roleInfo;
  const currentResearch = role?.legionResearch || {};

  const typesToReset = new Set();
  const typesToResetResearch = new Set();

  for (const type of [1, 2, 3, 4, 5, 6]) {
    const techIds = LEGION_TECH_RESET_TYPE_MAP[type];
    for (const techId of techIds) {
      const currentLevel = currentResearch[techId] || 0;
      const targetLevel = targetResearch[techId] || 0;
      if (
        currentLevel !== targetLevel &&
        (currentLevel > 0 || targetLevel > 0)
      ) {
        typesToResetResearch.add(type);
        break;
      }
    }
    const techIds2 = LEGION_TECH_TYPE_MAP[type];
    for (const techId of techIds2) {
      const currentLevel = currentResearch[techId] || 0;
      const targetLevel = targetResearch[techId] || 0;
      if (
        currentLevel !== targetLevel &&
        (currentLevel > 0 || targetLevel > 0)
      ) {
        typesToReset.add(type);
        break;
      }
    }
  }

  if (typesToResetResearch.size === 0 && typesToReset.size === 0) {
    return { success: true, message: "科技配置已匹配，无需调整" };
  }

  const errors = [];

  for (const type of typesToResetResearch) {
    try {
      await tokenStore.sendMessageWithPromise(tokenId, "legion_resetresearch", {
        advanced: false,
        type: type,
      });
    } catch (err) {}
    await waitAfterCommand();
  }

  const sortedTypes = [...typesToReset].sort((a, b) => a - b);
  console.log(sortedTypes);

  for (const type of sortedTypes) {
    const techIds2 = LEGION_TECH_TYPE_MAP[type];
    for (const techId of techIds2) {
      const targetLevel = targetResearch[techId] || 0;
      if (targetLevel > 0) {
        const maxLevel = LEGION_TECH_MAX_LEVEL[techId];
        const isMax = targetLevel >= maxLevel;
        if (isMax) {
          try {
            await tokenStore.sendMessageWithPromise(
              tokenId,
              "legion_research",
              {
                isMax: true,
                researchId: techId,
              },
            );
          } catch (err) {}
          await waitAfterCommand();
        } else {
          for (let i = 0; i < targetLevel; i++) {
            try {
              await tokenStore.sendMessageWithPromise(
                tokenId,
                "legion_research",
                {
                  isMax: false,
                  researchId: techId,
                },
              );
            } catch (err) {}
            await waitAfterCommand();
          }
        }
      }
    }
  }

  return { success: true, message: "科技配置已同步" };
};

const partMap = {
  1: "武器",
  2: "铠甲",
  3: "头冠",
  4: "坐骑",
};

const attrMap = {
  1: "攻击",
  2: "血量",
  3: "防御",
  4: "速度",
  5: "破甲",
  6: "破甲抵抗",
  7: "精准",
  8: "格挡",
  9: "减伤",
  10: "暴击",
  11: "暴击抵抗",
  12: "爆伤",
  13: "爆伤抵抗",
  14: "技能伤害",
  15: "免控",
  16: "眩晕免疫",
  17: "冰冻免疫",
  18: "沉默免疫",
  19: "流血免疫",
  20: "中毒免疫",
  21: "灼烧免疫",
};

const heroQualities = computed(() => {
  return ["全部", "红将", "橙将", "紫将"];
});

const heroCountries = computed(() => {
  const countries = new Set(["全部"]);
  Object.values(HERO_DICT).forEach((hero) => {
    if (hero.type) countries.add(hero.type);
  });
  return Array.from(countries);
});

const getHeroQuality = (heroId) => {
  const prefix = Math.floor(heroId / 100);
  if (prefix === 1) return "红将";
  if (prefix === 2) return "橙将";
  if (prefix === 3) return "紫将";
  return "其他";
};

const getFishInfo = (artifactId) => {
  if (!artifactId || artifactId === -1) return null;

  for (const [fishId, book] of Object.entries(artifactBooks.value)) {
    if (book.artifactId === artifactId) {
      const fishData = FishMap[fishId];
      return {
        fishId: Number(fishId),
        name: fishData?.name || `鱼灵${fishId}`,
        artifactId: book.artifactId,
        star: book.claimedStar || 0,
      };
    }
  }
  return null;
};

const getFishNameByArtifactId = (artifactId) => {
  const fishInfo = getFishInfo(artifactId);
  return fishInfo ? fishInfo.name : null;
};

const getFishNameById = (fishId) => {
  if (!fishId) return null;
  const fishData = FishMap[fishId];
  return fishData ? fishData.name : `鱼灵${fishId}`;
};

const getPearlSkillNameById = (skillId) => {
  if (!skillId) return null;
  const skillData = PearlMap[skillId];
  return skillData ? skillData.name : null;
};

const getSlotColors = (slotMap) => {
  if (!slotMap) return null;
  const colors = [];
  for (const slot of Object.values(slotMap)) {
    if (slot.colorId) {
      const colorData = color[slot.colorId];
      colors.push(colorData ? colorData.value : "white");
    }
  }
  return colors.length > 0 ? colors : null;
};

const getPearlDataByArtifactId = (artifactId) => {
  if (!artifactId || artifactId === -1) return null;
  for (const [pearlId, pearlData] of Object.entries(pearlMap.value)) {
    if (pearlData.artifactId === artifactId) {
      return pearlData;
    }
  }
  return null;
};

const getPearlSkillNameByArtifactId = (artifactId) => {
  const pearlData = getPearlDataByArtifactId(artifactId);
  if (!pearlData || !pearlData.skillId) return null;
  const skillData = PearlMap[pearlData.skillId];
  return skillData ? skillData.name : null;
};

const getSlotColorsByArtifactId = (artifactId) => {
  const pearlData = getPearlDataByArtifactId(artifactId);
  if (!pearlData || !pearlData.slotMap) return null;
  const colors = [];
  for (const slot of Object.values(pearlData.slotMap)) {
    if (slot.colorId) {
      const colorData = color[slot.colorId];
      colors.push(colorData ? colorData.value : "white");
    }
  }
  return colors.length > 0 ? colors : null;
};

const allHeroList = computed(() => {
  const heroes = Object.entries(roleHeroesData.value).map(([id, hero]) => {
    const heroInfo = HERO_DICT[hero.heroId] || {};
    return {
      id: Number(hero.heroId),
      name: heroInfo.name || `武将${hero.heroId}`,
      type: heroInfo.type || "未知",
      avatar: heroInfo.avatar || null,
      quality: getHeroQuality(Number(hero.heroId)),
      artifactId: hero.artifactId || null,
      attachmentUid: hero.attachmentUid || null,
      heroData: hero,
    };
  });

  const countryOrder = { 魏国: 1, 蜀国: 2, 吴国: 3, 群雄: 4 };
  const qualityOrder = { 红将: 1, 橙将: 2, 紫将: 3, 其他: 4 };

  return heroes.sort((a, b) => {
    const countryA = countryOrder[a.type] || 99;
    const countryB = countryOrder[b.type] || 99;
    if (countryA !== countryB) return countryA - countryB;

    const qualityA = qualityOrder[a.quality] || 99;
    const qualityB = qualityOrder[b.quality] || 99;
    if (qualityA !== qualityB) return qualityA - qualityB;

    return a.id - b.id;
  });
});

const filteredHeroList = computed(() => {
  let list = allHeroList.value;

  if (selectedQuality.value !== "全部") {
    list = list.filter((hero) => hero.quality === selectedQuality.value);
  }

  if (selectedCountry.value !== "全部") {
    list = list.filter((hero) => hero.type === selectedCountry.value);
  }

  if (heroSearchKeyword.value) {
    const keyword = heroSearchKeyword.value.toLowerCase();
    list = list.filter((hero) => hero.name.toLowerCase().includes(keyword));
  }

  const editingHeroIds = new Set(editingHeroes.value.map((hero) => hero.heroId));
  if (exchangeMode.value === "exchange" && exchangeHero.value?.heroId) {
    editingHeroIds.delete(exchangeHero.value.heroId);
  }

  list = list.filter((hero) => !editingHeroIds.has(hero.id));

  return list;
});

const currentTeamHeroes = computed(() => {
  if (!currentTeamInfo.value) return [];
  const teamInfo = currentTeamInfo.value;
  return Object.entries(teamInfo)
    .map(([key, hero]) => {
      const heroData = roleHeroesData.value[String(hero?.heroId || hero?.id)];
      return {
        position: hero?.battleTeamSlot ?? Number(key),
        heroId: hero?.heroId || hero?.id,
        level: hero?.level || null,
        artifactId: hero?.artifactId || null,
        attachmentUid: hero?.attachmentUid || null,
        power: heroData?.power || null,
        attack: heroData?.attack || null,
        hp: heroData?.hp || null,
        speed: heroData?.speed || null,
      };
    })
    .filter((h) => h.heroId)
    .sort((a, b) => a.position - b.position);
});

const editingHeroes = computed(() => {
  if (Object.keys(editingTeamHeroes.value).length > 0) {
    return Object.entries(editingTeamHeroes.value)
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([pos, hero]) => {
        const heroData = roleHeroesData.value[String(hero?.heroId)];
        return {
          position: Number(pos),
          heroId: hero?.heroId,
          level: hero?.level || null,
          artifactId: hero?.artifactId || null,
          attachmentUid: hero?.attachmentUid || null,
          power: heroData?.power || null,
          attack: heroData?.attack || null,
          hp: heroData?.hp || null,
          speed: heroData?.speed || null,
        };
      })
      .filter((h) => h.heroId);
  }
  return currentTeamHeroes.value;
});

const getFirstEmptySlot = () => {
  for (let i = 0; i < 5; i++) {
    const hero = editingHeroes.value.find((h) => h.position === i);
    if (!hero) return i;
  }
  return 0;
};

const getLineupsByTeamId = (teamId) => {
  return savedLineups.value.filter((lineup) => lineup.teamId === teamId);
};

const toggleLineupExpand = (lineup) => {
  if (expandedLineup.value === lineup) {
    expandedLineup.value = null;
  } else {
    expandedLineup.value = lineup;
  }
};

const hasEditingChanges = computed(() => {
  if (Object.keys(editingTeamHeroes.value).length === 0) return false;
  const current = JSON.stringify(
    currentTeamHeroes.value
      .map((h) => `${h.position}:${h.heroId}`)
      .sort()
      .join(","),
  );
  const editing = JSON.stringify(
    editingHeroes.value
      .map((h) => `${h.position}:${h.heroId}`)
      .sort()
      .join(","),
  );
  return current !== editing;
});

const getHeroName = (heroId) => {
  if (!heroId) return null;
  return HERO_DICT[heroId]?.name || null;
};

const getHeroAvatar = (heroId) => {
  if (!heroId) return null;
  return HERO_DICT[heroId]?.avatar || null;
};

const formatTime = (timestamp) => {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const formatLevel = (level) => {
  if (!level) return "";
  return String(level);
};

const getAttrName = (attrId) => {
  return attrMap[attrId] || `属性${attrId}`;
};

const getEquipBonus = (partId) => {
  if (!selectedHeroEquipment.value || !selectedHeroEquipment.value[partId]) {
    return 0;
  }
  const equip = selectedHeroEquipment.value[partId];
  const bonusType =
    partId === 1
      ? "quenchAttackExt"
      : partId === 3
        ? "quenchDefenseExt"
        : "quenchHpExt";
  return equip[bonusType] || 0;
};

const getEquipSlots = (partId) => {
  if (!selectedHeroEquipment.value || !selectedHeroEquipment.value[partId]) {
    return [];
  }
  const quenches = selectedHeroEquipment.value[partId].quenches || {};
  const slotList = [];
  const slotKeys = Object.keys(quenches).sort((a, b) => Number(a) - Number(b));

  for (const key of slotKeys) {
    const slotId = Number(key);
    const slot = quenches[key];
    slotList.push({
      id: slotId,
      attrId: slot.attrId || null,
      attrNum: slot.attrNum || 0,
      isLocked: slot.isLocked || slot.locked || false,
      colorId: slot.colorId || 0,
    });
  }

  return slotList;
};

const showHeroRefineModal = async (hero) => {
  refineModalTitle.value = `${getHeroName(hero.heroId) || `武将${hero.heroId}`} - 装备洗练`;
  refineModalVisible.value = true;
  refineModalLoading.value = true;
  selectedHeroEquipment.value = null;

  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    refineModalLoading.value = false;
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法获取装备信息");
    refineModalLoading.value = false;
    return;
  }

  try {
    const heroData = allHeroesData.value[String(hero.heroId)];
    if (heroData?.equipment) {
      selectedHeroEquipment.value = heroData.equipment;
    } else {
      const roleInfo = await tokenStore.sendMessageWithPromise(
        tokenId,
        "role_getroleinfo",
        {},
      );
      const role = roleInfo?.role || roleInfo;
      const heroes = role?.heroes || {};
      allHeroesData.value = heroes;

      const currentHero = heroes[String(hero.heroId)];
      selectedHeroEquipment.value = currentHero?.equipment || null;
    }

    if (!selectedHeroEquipment.value) {
      message.warning("未找到该武将的装备数据");
    }
  } catch (error) {
  } finally {
    refineModalLoading.value = false;
  }
  await delay(COMMAND_DELAY);
};

const openExchangeModal = (hero) => {
  exchangeMode.value = "exchange";
  exchangeHero.value = hero;
  exchangeTargetHeroId.value = null;
  heroSearchKeyword.value = "";
  selectedQuality.value = "全部";
  selectedCountry.value = "全部";
  exchangeModalVisible.value = true;
};

const openAddHeroModal = () => {
  if (editingHeroes.value.length >= 5) {
    message.warning("阵容已满，无法上阵更多英雄");
    return;
  }
  exchangeMode.value = "add";
  exchangeHero.value = null;
  exchangeTargetHeroId.value = null;
  heroSearchKeyword.value = "";
  selectedQuality.value = "全部";
  selectedCountry.value = "全部";
  exchangeModalVisible.value = true;
};

const selectExchangeHero = (hero) => {
  exchangeTargetHeroId.value = hero.id;
};

const confirmHeroAction = () => {
  if (!exchangeTargetHeroId.value) {
    message.warning("请选择武将");
    return;
  }

  if (Object.keys(editingTeamHeroes.value).length === 0) {
    currentTeamHeroes.value.forEach((h) => {
      editingTeamHeroes.value[h.position] = {
        heroId: h.heroId,
        level: h.level || null,
        artifactId: h.artifactId || null,
        attachmentUid: h.attachmentUid || null,
      };
    });
  }

  const occupiedHeroIds = new Set(
    Object.values(editingTeamHeroes.value)
      .map((hero) => hero?.heroId)
      .filter(Boolean),
  );

  if (exchangeMode.value === "exchange" && exchangeHero.value?.heroId) {
    occupiedHeroIds.delete(exchangeHero.value.heroId);
  }

  if (occupiedHeroIds.has(exchangeTargetHeroId.value)) {
    message.warning("该武将已在当前阵容中，不能重复上阵");
    return;
  }

  if (exchangeMode.value === "add") {
    const slot = getFirstEmptySlot();
    const targetHeroData =
      roleHeroesData.value[String(exchangeTargetHeroId.value)];
    const currentTeamHeroInfo = currentTeamInfo.value?.[slot];
    editingTeamHeroes.value[slot] = {
      heroId: exchangeTargetHeroId.value,
      level: currentTeamHeroInfo?.level || targetHeroData?.level || null,
      artifactId: targetHeroData?.artifactId || null,
      attachmentUid: targetHeroData?.attachmentUid || null,
    };
    message.success(
      `${getHeroName(exchangeTargetHeroId.value)} 已上阵到位置 ${slot + 1}`,
    );
  } else {
    if (!exchangeHero.value) {
      message.warning("请选择要更换的武将");
      return;
    }
    const originalArtifactId = exchangeHero.value.artifactId;
    const originalAttachmentUid = exchangeHero.value.attachmentUid;
    const targetHeroData =
      roleHeroesData.value[String(exchangeTargetHeroId.value)];
    editingTeamHeroes.value[exchangeHero.value.position] = {
      heroId: exchangeTargetHeroId.value,
      level: targetHeroData?.level || null,
      artifactId: originalArtifactId,
      attachmentUid: originalAttachmentUid,
    };
    message.success(
      `已将 ${getHeroName(exchangeHero.value.heroId)} 更换为 ${getHeroName(exchangeTargetHeroId.value)}`,
    );
  }

  exchangeModalVisible.value = false;
};

const removeHero = (hero) => {
  if (Object.keys(editingTeamHeroes.value).length === 0) {
    currentTeamHeroes.value.forEach((h) => {
      editingTeamHeroes.value[h.position] = {
        heroId: h.heroId,
        level: h.level || null,
        artifactId: h.artifactId || null,
        attachmentUid: h.attachmentUid || null,
      };
    });
  }

  delete editingTeamHeroes.value[hero.position];
  message.success(`${getHeroName(hero.heroId)} 已下阵`);
};

const onDragStart = (event, hero) => {
  draggedHeroId.value = hero.heroId;
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", JSON.stringify(hero));
};

const onDragEnd = () => {
  draggedHeroId.value = null;
  dragOverPosition.value = null;
};

const onDragOver = (event, hero) => {
  if (draggedHeroId.value !== hero.heroId) {
    dragOverPosition.value = hero.position;
  }
};

const onDragLeave = () => {
  dragOverPosition.value = null;
};

const onDrop = (event, targetHero) => {
  event.preventDefault();
  dragOverPosition.value = null;

  if (!draggedHeroId.value || draggedHeroId.value === targetHero.heroId) {
    return;
  }

  const draggedHero = editingHeroes.value.find(
    (h) => h.heroId === draggedHeroId.value,
  );
  if (!draggedHero) return;

  if (Object.keys(editingTeamHeroes.value).length === 0) {
    currentTeamHeroes.value.forEach((h) => {
      editingTeamHeroes.value[h.position] = {
        heroId: h.heroId,
        level: h.level || null,
        artifactId: h.artifactId || null,
        attachmentUid: h.attachmentUid || null,
      };
    });
  }

  const draggedPos = draggedHero.position;
  const targetPos = targetHero.position;

  const draggedHeroData = editingTeamHeroes.value[draggedPos];
  const targetHeroData = editingTeamHeroes.value[targetPos];

  editingTeamHeroes.value[draggedPos] = targetHeroData;
  editingTeamHeroes.value[targetPos] = draggedHeroData;

  message.success(
    `已将 ${getHeroName(draggedHero.heroId)} 与 ${getHeroName(targetHero.heroId)} 交换位置`,
  );

  draggedHeroId.value = null;
};

const loadSavedLineups = () => {
  try {
    const token = tokenStore.selectedToken;
    if (!token) return;
    const key = `${STORAGE_KEY}_${token.id}`;
    const data = localStorage.getItem(key);
    if (data) {
      savedLineups.value = sanitizeSavedLineups(JSON.parse(data));
    } else {
      savedLineups.value = [];
    }
  } catch (e) {
    console.error("加载保存的阵容失败:", e);
    savedLineups.value = [];
  }
};

const saveLineupsToStorage = ({ scheduleCloudSync = true } = {}) => {
  try {
    const token = tokenStore.selectedToken;
    if (!token) return;
    const key = `${STORAGE_KEY}_${token.id}`;
    savedLineups.value = sanitizeSavedLineups(savedLineups.value);
    localStorage.setItem(key, JSON.stringify(savedLineups.value));
    if (scheduleCloudSync) {
      scheduleSavedLineupsCloudSync();
    }
  } catch (e) {
    console.error("保存阵容到缓存失败:", e);
    message.error("保存阵容失败");
  }
};

const refreshTeamInfo = async () => {
  const now = Date.now();
  if (now - lastRefreshTime < REFRESH_DEBOUNCE) {
    return;
  }
  lastRefreshTime = now;

  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法获取数据");
    return;
  }

  loading.value = true;
  try {
    let presetTeamResult = await tokenStore.sendMessageWithPromise(
      tokenId,
      "presetteam_getinfo",
      {},
    );

    const teamsFromGame =
      presetTeamResult?.presetTeamInfo?.presetTeamInfo || {};
    const gameTeamIds = Object.keys(teamsFromGame)
      .filter((k) => /^\d+$/.test(k))
      .map(Number)
      .sort((a, b) => a - b);
    const availableTeamIds = gameTeamIds.length
      ? gameTeamIds
      : [1, 2, 3, 4, 5, 6];

    let targetTeamId = presetTeamResult?.presetTeamInfo?.useTeamId || 1;
    if (!availableTeamIds.includes(targetTeamId)) {
      targetTeamId = availableTeamIds[0];
    }

    const currentIndex = availableTeamIds.indexOf(targetTeamId);
    const otherTeamId =
      availableTeamIds[currentIndex === 0 ? 1 : currentIndex - 1] ||
      availableTeamIds[0];

    if (otherTeamId !== targetTeamId && availableTeamIds.length > 1) {
      await tokenStore.sendMessageWithPromise(tokenId, "presetteam_saveteam", {
        teamId: otherTeamId,
      });

      await delay(COMMAND_DELAY);

      await tokenStore.sendMessageWithPromise(tokenId, "presetteam_saveteam", {
        teamId: targetTeamId,
      });

      await delay(COMMAND_DELAY);
    }

    presetTeamResult = await tokenStore.sendMessageWithPromise(
      tokenId,
      "presetteam_getinfo",
      {},
    );
    await delay(COMMAND_DELAY);

    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
    );
    await delay(COMMAND_DELAY);
    const role = roleInfo?.role || roleInfo;
    roleHeroesData.value = role?.heroes || {};
    allHeroesData.value = role?.heroes || {};
    artifactBooks.value = role?.artifactBooks || {};
    pearlMap.value = role?.pearlMap || {};

    presetTeamData.value = presetTeamResult?.presetTeamInfo;

    if (presetTeamResult) {
      tokenStore.$patch((state) => {
        state.gameData = {
          ...(state.gameData ?? {}),
          presetTeam: presetTeamResult,
        };
      });
    }

    if (presetTeamData.value) {
      const updatedTeamsFromGame = presetTeamData.value.presetTeamInfo || {};
      currentTeamId.value = presetTeamData.value.useTeamId || 1;
      availableTeams.value = availableTeamIds;

      const currentTeam =
        updatedTeamsFromGame[currentTeamId.value] ||
        updatedTeamsFromGame[String(currentTeamId.value)];
      currentTeamInfo.value = currentTeam?.teamInfo || {};
      editingTeamHeroes.value = {};
    }

    message.success("数据已刷新");
  } catch (error) {
    message.error(`获取数据失败: ${error.message}`);
  } finally {
    loading.value = false;
  }
};

const saveCurrentLineup = async () => {
  if (editingHeroes.value.length === 0) {
    message.warning("当前阵容为空，无法保存");
    return;
  }

  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法保存阵容");
    return;
  }

  loading.value = true;

  try {
    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
    );
    await delay(COMMAND_DELAY);

    const role = roleInfo?.role || roleInfo;
    const legionResearch = role?.legionResearch || {};
    const currentArtifactBooks = role?.artifactBooks || {};
    const currentHeroes = role?.heroes || {};
    const pearlMap = role?.pearlMap || {};

    const presetTeamResult = await tokenStore.sendMessageWithPromise(
      tokenId,
      "presetteam_getinfo",
      {},
    );
    await delay(COMMAND_DELAY);

    const presetInfo =
      presetTeamResult?.presetTeamInfo?.presetTeamInfo ||
      presetTeamResult?.presetTeamInfo ||
      {};
    const teamData =
      presetInfo[currentTeamId.value] ||
      presetInfo[String(currentTeamId.value)];
    const weaponId = teamData?.weapon?.weaponId || null;
    const teamInfo = teamData?.teamInfo || {};

    const lineupName = `阵容${currentTeamId.value} - ${new Date().toLocaleTimeString()}`;

    const fishAssignments = {};
    for (const [fishId, book] of Object.entries(currentArtifactBooks)) {
      if (book.artifactId && book.artifactId !== -1) {
        fishAssignments[book.artifactId] = Number(fishId);
      }
    }

    const heroesData = editingHeroes.value.map((hero) => {
      const heroData = currentHeroes[String(hero.heroId)];
      const artifactId = heroData?.artifactId || hero.artifactId || null;
      const teamHeroInfo = teamInfo[hero.position];
      const fishId = artifactId ? fishAssignments[artifactId] : null;
      const pearlId = teamHeroInfo?.pearlId || null;
      const pearlData = pearlMap[pearlId];
      const slotMap = pearlData?.slotMap || null;
      return {
        position: hero.position,
        heroId: hero.heroId,
        level: teamHeroInfo?.level || null,
        attachmentUid: hero.attachmentUid || null,
        fishId: fishId || null,
        pearlId: pearlId,
        skillId: pearlData?.skillId || null,
        slotMap: slotMap,
        power: heroData?.power || null,
        attack: heroData?.attack || null,
        hp: heroData?.hp || null,
        speed: heroData?.speed || null,
      };
    });

    savedLineups.value.unshift({
      id: generateLineupId(),
      name: lineupName,
      heroes: heroesData,
      teamId: currentTeamId.value,
      savedAt: Date.now(),
      applying: false,
      legionResearch: legionResearch,
      weaponId: weaponId,
    });

    saveLineupsToStorage();
    message.success(`阵容已保存: ${lineupName}`);
  } catch (error) {
    message.error(`保存阵容失败: ${error.message}`);
  } finally {
    loading.value = false;
  }
};

const LEVEL_ORDER_THRESHOLDS = [
  { level: 100, order: 1 },
  { level: 200, order: 2 },
  { level: 300, order: 3 },
  { level: 500, order: 4 },
  { level: 700, order: 5 },
  { level: 900, order: 6 },
  { level: 1100, order: 7 },
  { level: 1300, order: 8 },
  { level: 1500, order: 9 },
  { level: 1800, order: 10 },
  { level: 2100, order: 11 },
  { level: 2400, order: 12 },
  { level: 2800, order: 13 },
  { level: 3200, order: 14 },
  { level: 3600, order: 15 },
  { level: 4000, order: 16 },
  { level: 4500, order: 17 },
  { level: 5000, order: 18 },
  { level: 5500, order: 19 },
];

const UPGRADE_OPTIONS = [50, 10, 5, 1];

const getNextOrderLevel = (currentLevel) => {
  for (const threshold of LEVEL_ORDER_THRESHOLDS) {
    if (currentLevel < threshold.level) {
      return threshold.level;
    }
  }
  return null;
};

const getOrder = (level) => {
  let order = 0;
  for (const threshold of LEVEL_ORDER_THRESHOLDS) {
    if (level >= threshold.level) {
      order = threshold.order;
    } else {
      break;
    }
  }
  return order;
};

const getPendingOrderThreshold = (level, order) => {
  for (const threshold of LEVEL_ORDER_THRESHOLDS) {
    if (level <= threshold.level && Number(order || 0) < threshold.order) {
      return threshold;
    }
  }
  return null;
};

const applyHeroLevel = async (
  tokenId,
  heroId,
  targetLevel,
  currentLevel,
  currentOrder = 0,
  slot = -1,
  waitAfterCommand = async () => {
    await delay(COMMAND_DELAY);
  },
) => {
  if (!targetLevel || targetLevel <= 0)
    return { success: true, message: "无目标等级" };

  let actualCurrentLevel = currentLevel;
  let actualCurrentOrder = currentOrder;
  const shouldRestoreToSlotAfterRebirth = slot >= 0 && actualCurrentLevel > targetLevel;

  if (actualCurrentLevel > targetLevel) {
    if (slot >= 0) {
      try {
        await tokenStore.sendMessageWithPromise(tokenId, "hero_gobackbattle", {
          slot,
        });
      } catch {}
      await waitAfterCommand();
    }

    try {
      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_rebirth",
        {
          heroId,
        },
      );
      if (result?.role?.heroes?.[heroId]?.level !== undefined) {
        actualCurrentLevel = result.role.heroes[heroId].level;
      } else {
        actualCurrentLevel = 1;
      }
      if (result?.role?.heroes?.[heroId]?.order !== undefined) {
        actualCurrentOrder = result.role.heroes[heroId].order;
      } else {
        actualCurrentOrder = 0;
      }
    } catch (err) {
      return {
        success: false,
        message: err?.message || "武将重生失败",
      };
    }
    await waitAfterCommand();
  }

  const expectedOrder = getOrder(actualCurrentLevel);
  if (actualCurrentOrder < expectedOrder) {
    try {
      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_heroupgradeorder",
        {
          heroId,
        },
      );
      if (result?.role?.heroes?.[heroId]?.order !== undefined) {
        actualCurrentOrder = result.role.heroes[heroId].order;
      } else {
        actualCurrentOrder = expectedOrder;
      }
    } catch (err) {
      return {
        success: false,
        message: err?.message || "武将进阶失败",
      };
    }
    await waitAfterCommand();
  }

  while (actualCurrentLevel < targetLevel) {
    const pendingOrderThreshold = getPendingOrderThreshold(
      actualCurrentLevel,
      actualCurrentOrder,
    );

    if (
      pendingOrderThreshold
      && actualCurrentLevel >= pendingOrderThreshold.level
    ) {
      try {
        const result = await tokenStore.sendMessageWithPromise(
          tokenId,
          "hero_heroupgradeorder",
          {
            heroId,
          },
        );
        if (result?.role?.heroes?.[heroId]?.order !== undefined) {
          actualCurrentOrder = result.role.heroes[heroId].order;
        } else {
          actualCurrentOrder = pendingOrderThreshold.order;
        }
      } catch (err) {
        return {
          success: false,
          message:
            err?.message
            || `武将在 ${pendingOrderThreshold.level} 级需要先完成进阶`,
        };
      }
      await waitAfterCommand();
      continue;
    }

    const nextOrderLevel = pendingOrderThreshold?.level ?? null;
    const maxAllowed = nextOrderLevel
      ? nextOrderLevel - actualCurrentLevel
      : targetLevel - actualCurrentLevel;
    const remaining = targetLevel - actualCurrentLevel;
    const stepLimit = Math.min(maxAllowed, remaining);

    if (stepLimit <= 0) {
      return {
        success: false,
        message: "当前等级受进阶限制，无法继续升级",
      };
    }

    let upgradeNum = 1;
    for (const num of UPGRADE_OPTIONS) {
      if (num <= stepLimit) {
        upgradeNum = num;
        break;
      }
    }

    try {
      await tokenStore.sendMessageWithPromise(
        tokenId,
        "hero_heroupgradelevel",
        {
          heroId,
          upgradeNum,
        },
      );
      actualCurrentLevel += upgradeNum;
    } catch (err) {
      return {
        success: false,
        message: err?.message || "武将升级失败",
      };
    }
    await waitAfterCommand();

    if (
      pendingOrderThreshold
      && actualCurrentLevel >= pendingOrderThreshold.level
    ) {
      try {
        const result = await tokenStore.sendMessageWithPromise(
          tokenId,
          "hero_heroupgradeorder",
          {
            heroId,
          },
        );
        if (result?.role?.heroes?.[heroId]?.order !== undefined) {
          actualCurrentOrder = result.role.heroes[heroId].order;
        } else {
          actualCurrentOrder = pendingOrderThreshold.order;
        }
      } catch (err) {
        return {
          success: false,
          message:
            err?.message
            || `武将在 ${pendingOrderThreshold.level} 级需要先完成进阶`,
        };
      }
      await waitAfterCommand();
    }
  }

  if (shouldRestoreToSlotAfterRebirth) {
    try {
      await tokenStore.sendMessageWithPromise(tokenId, "hero_gointobattle", {
        heroId,
        slot,
      });
    } catch (err) {
      return {
        success: false,
        message: err?.message || "武将重生后重新上阵失败",
      };
    }
    await waitAfterCommand();
  }

  return {
    success: true,
    message:
      actualCurrentLevel === currentLevel
        ? "等级已达标"
        : `等级已升至 ${actualCurrentLevel}`,
  };
};

const applyLineup = async (lineup) => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法应用阵容");
    return;
  }

  if (lineup.teamId !== currentTeamId.value) {
    message.warning(
      `此阵容仅适用于阵容槽位 ${lineup.teamId}，当前槽位为 ${currentTeamId.value}`,
    );
    return;
  }

  const getBusySourceText = (lock) => {
    if (!lock) {
      return "其他流程";
    }
    if (lock.source === "task-control") {
      return "任务控制";
    }
    if (lock.source === "lineup-apply") {
      return "另一个阵容应用流程";
    }
    return lock.meta?.label || lock.source || "其他流程";
  };

  const lockResult = acquireTokenOperationLock(tokenId, "lineup-apply", {
    lineupId: lineup.id || null,
    lineupName: lineup.name || "",
    label: `阵容应用:${lineup.name || lineup.id || "未命名阵容"}`,
  });
  if (!lockResult.ok) {
    message.warning(
      `当前账号正在执行${getBusySourceText(lockResult.current)}，请等待完成后再应用阵容`,
    );
    return;
  }
  const applyOperationLockId = lockResult.lock.lockId;

  lineup.applying = true;
  state.value.isRunning = true;
  startApplyProgress(lineup);
  const errors = [];
  let shouldRecordDuration = false;
  const applyRunId =
    `lineup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const logApplyDiagnostic = (event, details = {}, level = "info") => {
    const entry = appendApplyDiagnosticEntry({
      time: new Date().toISOString(),
      runId: applyRunId,
      event,
      level,
      tokenId,
      lineupId: lineup.id || null,
      lineupName: lineup.name || "",
      teamId: Number(lineup.teamId || 0) || 0,
      currentTeamId: Number(currentTeamId.value || 0) || 0,
      stage: applyProgressStage.value || "",
      details: serializeApplyDiagnosticValue(details),
    });

    const cmd = entry?.details?.cmd ? ` cmd=${entry.details.cmd}` : "";
    const attempt =
      entry?.details?.attempt != null ? ` attempt=${entry.details.attempt}` : "";
    const retryType = entry?.details?.retryType
      ? ` retry=${entry.details.retryType}`
      : "";
    const errorMessage = entry?.details?.errorMessage
      ? ` error=${entry.details.errorMessage}`
      : "";
    const warningMessage = entry?.details?.skippedWarning?.message
      ? ` warning=${entry.details.skippedWarning.message}`
      : "";
    const heroId =
      entry?.details?.params?.heroId != null
        ? ` heroId=${entry.details.params.heroId}`
        : entry?.details?.heroId != null
          ? ` heroId=${entry.details.heroId}`
          : "";
    const slot =
      entry?.details?.params?.slot != null
        ? ` slot=${entry.details.params.slot}`
        : entry?.details?.slot != null
          ? ` slot=${entry.details.slot}`
          : "";
    const targetHeroId =
      entry?.details?.params?.targetHeroId != null
        ? ` targetHeroId=${entry.details.params.targetHeroId}`
        : "";
    const phase = entry?.details?.phase ? ` phase=${entry.details.phase}` : "";
    const stage = entry?.stage ? ` stage=${entry.stage}` : "";
    const summary =
      `[LineupApplyDiag] ${event}${cmd}${attempt}${heroId}${slot}${targetHeroId}${retryType}${phase}${warningMessage}${errorMessage}${stage}`;

    const logger =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.info;
    logger(summary, entry);
    return entry;
  };

  logApplyDiagnostic("apply-start", {
    heroCount: Array.isArray(lineup.heroes) ? lineup.heroes.length : 0,
    heroIds: Array.isArray(lineup.heroes)
      ? lineup.heroes.map((hero) => Number(hero.heroId || 0)).filter(Boolean)
      : [],
    savedAt: Number(lineup.savedAt || 0) || null,
  });

  const getTeamHeroes = (teamInfo) => {
    if (!teamInfo) return [];
    return Object.entries(teamInfo)
      .map(([key, hero]) => ({
        position: hero?.battleTeamSlot ?? Number(key),
        heroId: hero?.heroId || hero?.id,
        artifactId: hero?.artifactId || null,
        attachmentUid: hero?.attachmentUid || null,
      }))
      .filter((h) => h.heroId)
      .sort((a, b) => a.position - b.position);
  };

  const getSkippedWarningForAttempt = (attemptStartedAt) => {
    const warning = tokenStore.getSkippedMessageWarning(tokenId);
    if (!warning) {
      return null;
    }
    if (Number(warning.timestamp || 0) < attemptStartedAt) {
      return null;
    }
    return warning;
  };

  const isServerTransientWarning = (value) => {
    const messageText = String(value || "").toLowerCase();
    return (
      messageText.includes("200020")
      || messageText.includes("出了点小问题")
      || messageText.includes("重启游戏解决")
    );
  };

  const isRateLimitWarning = (value) => {
    const messageText = String(value || "").toLowerCase();
    return (
      messageText.includes("200400")
      || messageText.includes("操作太快")
      || messageText.includes("请稍后再试")
    );
  };

  const getApplyRetryDelay = (cmd, warningText = "", shouldWaitForServerRetry = false) => {
    if (isRateLimitWarning(warningText)) {
      return APPLY_RATE_LIMIT_RETRY_DELAY;
    }
    if (shouldWaitForServerRetry) {
      return APPLY_STRUCTURAL_COMMANDS.has(String(cmd || "").trim())
        ? APPLY_SERVER_WARNING_RETRY_DELAY_SLOW
        : APPLY_SERVER_WARNING_RETRY_DELAY;
    }
    return getApplyCommandCooldown(cmd);
  };

  const isApplyCommandNoopWarning = (cmd, value) => {
    const messageText = String(value || "").toLowerCase();
    if (!messageText) {
      return false;
    }

    if (
      cmd === "artifact_unload"
      && (
        messageText.includes("未装备鱼灵")
        || messageText.includes("该英雄未装备鱼灵")
        || messageText.includes("400150")
      )
    ) {
      return true;
    }

    return false;
  };

  const createApplyAbortError = (cmd, messageText, extra = {}) => {
    const error = new Error(messageText);
    error.__applyAbort = true;
    error.__applyAbortCmd = cmd;
    error.__applyAbortMeta = extra;
    return error;
  };

  const rethrowIfApplyMustAbort = (error) => {
    if (error?.__applyAbort) {
      throw error;
    }
  };

  const readLatestStateSnapshot = async () => {
    try {
      const roleInfo = await tokenStore.sendMessageWithPromise(
        tokenId,
        "role_getroleinfo",
        {},
      );
      await delay(COMMAND_DELAY);
      const presetTeam = await tokenStore.sendMessageWithPromise(
        tokenId,
        "presetteam_getinfo",
        {},
      );
      await delay(COMMAND_DELAY);
      const heroes = roleInfo?.role?.heroes || roleInfo?.heroes || {};
      const pearlMapData = roleInfo?.role?.pearlMap || roleInfo?.pearlMap || {};
      const artifactBooksData =
        roleInfo?.role?.artifactBooks || roleInfo?.artifactBooks || {};
      const team =
        presetTeam?.presetTeamInfo?.presetTeamInfo?.[currentTeamId.value]
        || presetTeam?.presetTeamInfo?.presetTeamInfo?.[String(currentTeamId.value)];
      return {
        heroes,
        teamInfo: team?.teamInfo || {},
        pearlMap: pearlMapData,
        artifactBooks: artifactBooksData,
      };
    } catch {
      return null;
    }
  };

  const sendApplyCommand = async (cmd, params = {}, options = {}) => {
    const verifyApplied =
      typeof options?.verifyApplied === "function" ? options.verifyApplied : null;

    for (let attempt = 1; attempt <= APPLY_SKIP_WARNING_MAX_RETRIES; attempt++) {
      if (attempt > 1 && verifyApplied) {
        const alreadyApplied = await verifyApplied({
          cmd,
          params,
          attempt,
          phase: "before-attempt",
        });
        if (alreadyApplied) {
          logApplyDiagnostic("command-attempt-precheck-success", {
            cmd,
            attempt,
          });
          return {
            success: true,
            verifiedBeforeRetry: true,
          };
        }
      }

      tokenStore.clearSkippedMessageWarning(tokenId);
      const attemptStartedAt = Date.now();
      let shouldRetry = false;

      logApplyDiagnostic("command-attempt-start", {
        cmd,
        attempt,
        maxRetries: APPLY_SKIP_WARNING_MAX_RETRIES,
        params,
      });

      try {
        const result = await tokenStore.sendMessageWithPromise(tokenId, cmd, params);
        const skippedWarning = getSkippedWarningForAttempt(attemptStartedAt);

        if (!skippedWarning) {
          logApplyDiagnostic("command-attempt-success", {
            cmd,
            attempt,
            durationMs: Date.now() - attemptStartedAt,
          });
          return result;
        }

        const shouldWaitForServerRetry = isServerTransientWarning(
          skippedWarning.message,
        );
        const shouldTreatAsNoop = isApplyCommandNoopWarning(
          cmd,
          skippedWarning?.message,
        );

        logApplyDiagnostic(
          "command-attempt-warning",
          {
            cmd,
            attempt,
            durationMs: Date.now() - attemptStartedAt,
            retryType: shouldTreatAsNoop
              ? "noop-warning"
              : shouldWaitForServerRetry
                ? "server-warning-200020"
                : "skipped-message",
            skippedWarning,
          },
          "warn",
        );

        if (shouldTreatAsNoop) {
          logApplyDiagnostic("command-attempt-noop-success", {
            cmd,
            attempt,
            durationMs: Date.now() - attemptStartedAt,
            reason: skippedWarning?.message || "",
          });
          return {
            success: true,
            noop: true,
          };
        }

        if (verifyApplied) {
          const verifiedApplied = await verifyApplied({
            cmd,
            params,
            attempt,
            skippedWarning,
          });
          if (verifiedApplied) {
            logApplyDiagnostic("command-attempt-verified-success", {
              cmd,
              attempt,
              durationMs: Date.now() - attemptStartedAt,
              verifiedAfter: "warning",
            });
            return result;
          }
        }

        if (attempt >= APPLY_SKIP_WARNING_MAX_RETRIES) {
          const finalMessage =
            `命令 ${cmd} 多次出现消息处理跳过：${skippedWarning.message || "未知原因"}`;
          logApplyDiagnostic(
            "command-attempt-max-retries",
            {
              cmd,
              attempt,
              skippedWarning,
              finalMessage,
            },
            "error",
          );
          throw createApplyAbortError(cmd, finalMessage, {
            type: "skipped-warning-max-retries",
            skippedWarning,
          });
        }

        shouldRetry = true;
        const retryDelayMs = getApplyRetryDelay(
          cmd,
          skippedWarning?.message || "",
          shouldWaitForServerRetry,
        );
        setApplyProgressStage(
          shouldWaitForServerRetry
            ? `服务器提示“出了点小问题”，等待 10 秒后重试当前命令（${attempt}/${APPLY_SKIP_WARNING_MAX_RETRIES}）`
            : `检测到消息处理跳过，正在等待后重试（${attempt}/${APPLY_SKIP_WARNING_MAX_RETRIES}）`,
        );
        logApplyDiagnostic(
          "command-attempt-retry-scheduled",
          {
            cmd,
            attempt,
            retryDelayMs,
            retryType: shouldWaitForServerRetry ? "server-warning-200020" : "skipped-message",
          },
          "warn",
        );
        await delay(retryDelayMs);
      } catch (error) {
        const skippedWarning = getSkippedWarningForAttempt(attemptStartedAt);
        const shouldWaitForServerRetry = isServerTransientWarning(
          skippedWarning?.message || error?.message,
        );
        const shouldTreatAsNoop = isApplyCommandNoopWarning(
          cmd,
          skippedWarning?.message || error?.message,
        );

        logApplyDiagnostic(
          "command-attempt-error",
          {
            cmd,
            attempt,
            durationMs: Date.now() - attemptStartedAt,
            errorMessage: error?.message || String(error),
            retryType: shouldTreatAsNoop
              ? "noop-warning"
              : shouldWaitForServerRetry
                ? "server-warning-200020"
                : "non-transient",
            skippedWarning,
          },
          shouldWaitForServerRetry || skippedWarning ? "warn" : "error",
        );

        if (shouldTreatAsNoop) {
          logApplyDiagnostic("command-attempt-noop-success", {
            cmd,
            attempt,
            durationMs: Date.now() - attemptStartedAt,
            reason: skippedWarning?.message || error?.message || "",
          });
          return {
            success: true,
            noop: true,
          };
        }

        if (!skippedWarning && !shouldWaitForServerRetry) {
          throw error;
        }

        if (verifyApplied) {
          const verifiedApplied = await verifyApplied({
            cmd,
            params,
            attempt,
            skippedWarning,
            error,
          });
          if (verifiedApplied) {
            logApplyDiagnostic("command-attempt-verified-success", {
              cmd,
              attempt,
              durationMs: Date.now() - attemptStartedAt,
              verifiedAfter: "error",
            });
            return {
              success: true,
              verifiedAfterWarning: true,
            };
          }
        }

        if (attempt >= APPLY_SKIP_WARNING_MAX_RETRIES) {
          const finalMessage =
            `命令 ${cmd} 多次出现消息处理跳过：${skippedWarning?.message || error?.message || "未知原因"}`;
          logApplyDiagnostic(
            "command-attempt-max-retries",
            {
              cmd,
              attempt,
              skippedWarning,
              errorMessage: error?.message || String(error),
              finalMessage,
            },
            "error",
          );
          throw createApplyAbortError(cmd, finalMessage, {
            type: shouldWaitForServerRetry
              ? "server-warning-max-retries"
              : "skipped-warning-max-retries",
            skippedWarning,
            errorMessage: error?.message || String(error),
          });
        }

        shouldRetry = true;
        const retryDelayMs = getApplyRetryDelay(
          cmd,
          skippedWarning?.message || error?.message || "",
          shouldWaitForServerRetry,
        );
        setApplyProgressStage(
          shouldWaitForServerRetry
            ? `服务器提示“出了点小问题”，等待 10 秒后重试当前命令（${attempt}/${APPLY_SKIP_WARNING_MAX_RETRIES}）`
            : `检测到消息处理跳过，正在等待后重试（${attempt}/${APPLY_SKIP_WARNING_MAX_RETRIES}）`,
        );
        logApplyDiagnostic(
          "command-attempt-retry-scheduled",
          {
            cmd,
            attempt,
            retryDelayMs,
            retryType: shouldWaitForServerRetry ? "server-warning-200020" : "skipped-message",
            errorMessage: error?.message || String(error),
          },
          "warn",
        );
        await delay(retryDelayMs);
      } finally {
        if (!shouldRetry) {
          await delay(getApplyCommandCooldown(cmd));
        }
      }

      if (shouldRetry) {
        continue;
      }
    }

    throw new Error(`命令 ${cmd} 重试后仍未成功执行`);
  };

  const waitApplyCommandDelay = async () => {
    await delay(getApplyCommandCooldown("hero_gointobattle"));
  };

  const fetchLatestData = async (teamId = null) => {
    const roleInfo = await sendApplyCommand("role_getroleinfo", {});
    const presetTeam = await sendApplyCommand("presetteam_getinfo", {});
    const heroes = roleInfo?.role?.heroes || roleInfo?.heroes || {};
    const pearlMapData = roleInfo?.role?.pearlMap || roleInfo?.pearlMap || {};
    const artifactBooksData =
      roleInfo?.role?.artifactBooks || roleInfo?.artifactBooks || {};
    roleHeroesData.value = heroes;
    const targetTeamId = teamId || currentTeamId.value;
    const team =
      presetTeam?.presetTeamInfo?.presetTeamInfo?.[targetTeamId] ||
      presetTeam?.presetTeamInfo?.presetTeamInfo?.[String(targetTeamId)];
    return {
      heroes,
      teamInfo: team?.teamInfo || {},
      pearlMap: pearlMapData,
      artifactBooks: artifactBooksData,
    };
  };

  const isTargetLineupMatched = (heroesToCheck, targetHeroes) => {
    if (heroesToCheck.length !== targetHeroes.length) {
      return false;
    }
    const targetMap = new Map(
      targetHeroes.map((hero) => [Number(hero.position), Number(hero.heroId)]),
    );
    return heroesToCheck.every(
      (hero) => targetMap.get(Number(hero.position)) === Number(hero.heroId),
    );
  };

  const targetHeroes = [...lineup.heroes];
  const targetByPosition = new Map(
    targetHeroes.map((hero) => [Number(hero.position), hero]),
  );
  const getLineupSlotCandidates = (heroesInTeam = []) => {
    const positions = [
      ...heroesInTeam.map((hero) => Number(hero.position)),
      ...targetHeroes.map((hero) => Number(hero.position)),
    ].filter((position) => Number.isFinite(position));
    const slotBase = positions.some((position) => position === 0) ? 0 : 1;
    return Array.from({ length: 5 }, (_, index) => slotBase + index);
  };

  const ensureFinalLineupMatches = async () => {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const latestData = await fetchLatestData();
      const latestHeroes = getTeamHeroes(latestData.teamInfo);
      if (isTargetLineupMatched(latestHeroes, targetHeroes)) {
        return {
          success: true,
          repaired: attempt > 1,
        };
      }

      setApplyProgressStage(`正在复核最终阵容（${attempt}/2）`);
      const currentByPosition = new Map(
        latestHeroes.map((hero) => [Number(hero.position), hero]),
      );
      const currentByHeroId = new Map(
        latestHeroes.map((hero) => [Number(hero.heroId), hero]),
      );

      for (const targetHero of targetHeroes) {
        const heroAtPosition = currentByPosition.get(Number(targetHero.position));
        if (heroAtPosition?.heroId === targetHero.heroId) {
          continue;
        }

        const displacedHero =
          heroAtPosition && Number(heroAtPosition.heroId) !== Number(targetHero.heroId)
            ? heroAtPosition
            : null;
        const targetCurrentHero = currentByHeroId.get(Number(targetHero.heroId)) || null;
        const targetOriginalSlot =
          targetCurrentHero && Number(targetCurrentHero.position) !== Number(targetHero.position)
            ? Number(targetCurrentHero.position)
            : null;

        if (displacedHero && !targetCurrentHero) {
          try {
            await sendApplyCommand("hero_exchange", {
              heroId: displacedHero.heroId,
              targetHeroId: targetHero.heroId,
            }, {
              verifyApplied: () =>
                verifyHeroAppliedToSlot(targetHero.heroId, targetHero.position),
            });
            const appliedHero = {
              position: Number(targetHero.position),
              heroId: Number(targetHero.heroId),
              artifactId: null,
              attachmentUid: null,
            };
            currentByPosition.set(Number(targetHero.position), appliedHero);
            currentByHeroId.delete(Number(displacedHero.heroId));
            currentByHeroId.set(Number(targetHero.heroId), appliedHero);
            await waitApplyCommandDelay();
            continue;
          } catch (error) {
            throw error;
          }
        }

        if (displacedHero) {
          await sendApplyCommand("hero_gobackbattle", {
            slot: displacedHero.position,
          });
          currentByPosition.delete(Number(displacedHero.position));
          currentByHeroId.delete(Number(displacedHero.heroId));
        }

        if (targetOriginalSlot != null) {
          await sendApplyCommand("hero_gobackbattle", {
            slot: targetOriginalSlot,
          });
          currentByPosition.delete(Number(targetOriginalSlot));
          currentByHeroId.delete(Number(targetHero.heroId));
        }

        try {
          await sendApplyCommand("hero_gointobattle", {
            heroId: targetHero.heroId,
            slot: targetHero.position,
          }, {
            verifyApplied: () =>
              verifyHeroAppliedToSlot(targetHero.heroId, targetHero.position),
          });
          const appliedHero = {
            position: Number(targetHero.position),
            heroId: Number(targetHero.heroId),
            artifactId: targetCurrentHero?.artifactId || null,
            attachmentUid: targetCurrentHero?.attachmentUid || null,
          };
          currentByPosition.set(Number(targetHero.position), appliedHero);
          currentByHeroId.set(Number(targetHero.heroId), appliedHero);
        } catch (error) {
          if (targetOriginalSlot != null) {
            await tryRestoreHeroToSlot(
              targetHero.heroId,
              targetOriginalSlot,
              "final-lineup-restore-target-hero",
            );
          }
          if (displacedHero) {
            await tryRestoreHeroToSlot(
              displacedHero.heroId,
              displacedHero.position,
              "final-lineup-restore-displaced-hero",
            );
          }
          throw error;
        }

        await waitApplyCommandDelay();
      }
    }

    const finalData = await fetchLatestData();
    return {
      success: isTargetLineupMatched(
        getTeamHeroes(finalData.teamInfo),
        targetHeroes,
      ),
      repaired: false,
    };
  };

  const getCurrentFishIdByHeroId = (artifactBooks = {}, heroes = {}, heroId) => {
    const heroData = heroes[String(heroId)] || heroes[heroId];
    const artifactId = Number(heroData?.artifactId || 0) || null;
    if (!artifactId) {
      return null;
    }

    for (const [fishId, book] of Object.entries(artifactBooks)) {
      if (Number(book?.artifactId || 0) === artifactId) {
        return Number(fishId || 0) || null;
      }
    }
    return null;
  };

  const getArtifactIdByFishId = (artifactBooks = {}, fishId) => {
    if (!fishId && fishId !== 0) {
      return null;
    }

    const book = artifactBooks[String(fishId)] || artifactBooks[fishId] || null;
    const artifactId = Number(book?.artifactId || 0) || null;
    if (!artifactId || artifactId === -1) {
      return null;
    }
    return artifactId;
  };

  const verifyArtifactAppliedToHero = async (heroId, artifactId, pearlId) => {
    const snapshot = await readLatestStateSnapshot();
    if (!snapshot) {
      return false;
    }

    const heroData = snapshot.heroes?.[String(heroId)] || snapshot.heroes?.[heroId] || null;
    const currentArtifactId = Number(heroData?.artifactId || 0) || null;
    if (currentArtifactId !== Number(artifactId || 0)) {
      return false;
    }

    const teamHero = Object.values(snapshot.teamInfo || {}).find(
      (item) => Number(item?.heroId || item?.id || 0) === Number(heroId),
    );
    const currentPearlId = Number(teamHero?.pearlId || 0) || null;
    return currentPearlId === (Number(pearlId || 0) || null);
  };

  const verifyHeroAppliedToSlot = async (heroId, slot) => {
    const snapshot = await readLatestStateSnapshot();
    if (!snapshot) {
      return false;
    }

    const teamHero =
      snapshot.teamInfo?.[slot]
      || snapshot.teamInfo?.[String(slot)]
      || null;
    return Number(teamHero?.heroId || teamHero?.id || 0) === Number(heroId || 0);
  };

  const getPearlIdByArtifactId = (pearlMap = {}, artifactId) => {
    const targetArtifactId = Number(artifactId || 0) || null;
    if (!targetArtifactId) {
      return null;
    }

    for (const [pearlId, pearlData] of Object.entries(pearlMap)) {
      if (Number(pearlData?.artifactId || 0) === targetArtifactId) {
        return Number(pearlId || 0) || null;
      }
    }

    return null;
  };

  const tryRestoreHeroToSlot = async (heroId, slot, reason) => {
    if (!heroId && heroId !== 0) {
      return false;
    }

    try {
      logApplyDiagnostic(
        "hero-rollback-start",
        {
          heroId,
          slot,
          reason,
        },
        "warn",
      );
      await sendApplyCommand("hero_gointobattle", {
        heroId,
        slot,
      }, {
        verifyApplied: () => verifyHeroAppliedToSlot(heroId, slot),
      });
      logApplyDiagnostic("hero-rollback-success", {
        heroId,
        slot,
        reason,
      });
      return true;
    } catch (restoreError) {
      logApplyDiagnostic(
        "hero-rollback-failed",
        {
          heroId,
          slot,
          reason,
          errorMessage: restoreError?.message || String(restoreError),
        },
        "error",
      );
      return false;
    }
  };

  const tryRestoreArtifactToHero = async (
    heroId,
    artifactId,
    pearlId,
    reason,
  ) => {
    if (!heroId || !artifactId || !pearlId) {
      return false;
    }

    try {
      logApplyDiagnostic(
        "artifact-rollback-start",
        {
          heroId,
          artifactId,
          pearlId,
          reason,
        },
        "warn",
      );
      await sendApplyCommand("artifact_load", {
        heroId,
        itemId: artifactId,
        pearlId,
      });
      logApplyDiagnostic("artifact-rollback-success", {
        heroId,
        artifactId,
        pearlId,
        reason,
      });
      return true;
    } catch (restoreError) {
      logApplyDiagnostic(
        "artifact-rollback-failed",
        {
          heroId,
          artifactId,
          pearlId,
          reason,
          errorMessage: restoreError?.message || String(restoreError),
        },
        "error",
      );
      return false;
    }
  };

  const getTargetFishRequirements = (pearlMap = {}, artifactBooks = {}) =>
    targetHeroes.map((hero) => {
      const pearlId = Number(hero?.pearlId || 0) || null;
      const fishId = hero?.fishId != null ? Number(hero.fishId) || null : null;
      const pearlData = pearlId ? pearlMap[pearlId] : null;
      const artifactId =
        getArtifactIdByFishId(artifactBooks, fishId)
        || Number(pearlData?.artifactId || 0) || null;
      return {
        heroId: Number(hero.heroId),
        position: Number(hero.position),
        pearlId,
        skillId: hero?.skillId != null ? Number(hero.skillId) || null : null,
        fishId,
        artifactId,
      };
    });

  const isTargetFishConfigMatched = (
    teamInfo = {},
    heroes = {},
    pearlMap = {},
    artifactBooks = {},
  ) => {
    const requirements = getTargetFishRequirements(pearlMap, artifactBooks);

    return requirements.every((requirement) => {
      const teamHero =
        teamInfo?.[requirement.position] || teamInfo?.[String(requirement.position)] || null;

      if (Number(teamHero?.heroId || teamHero?.id || 0) !== Number(requirement.heroId)) {
        return false;
      }

      const currentPearlId = Number(teamHero?.pearlId || 0) || null;
      if ((requirement.pearlId || null) !== currentPearlId) {
        return false;
      }

      const currentHeroData =
        heroes[String(requirement.heroId)] || heroes[requirement.heroId] || null;
      const currentArtifactId = Number(currentHeroData?.artifactId || 0) || null;

      if ((requirement.artifactId || null) !== currentArtifactId) {
        return false;
      }

      if (requirement.fishId) {
        const currentFishId = getCurrentFishIdByHeroId(
          artifactBooks,
          heroes,
          requirement.heroId,
        );
        if (currentFishId !== requirement.fishId) {
          return false;
        }
      }

      const currentSkillId =
        currentPearlId && pearlMap[currentPearlId]
          ? Number(pearlMap[currentPearlId]?.skillId || 0) || null
          : null;

      return (requirement.skillId || null) === currentSkillId;
    });
  };

  const ensureFinalFishArtifactsMatch = async () => {
    const initialData = await fetchLatestData();

    for (let attempt = 1; attempt <= 2; attempt++) {
      const latestData = attempt === 1 ? initialData : await fetchLatestData();
      const latestTeamInfo = latestData.teamInfo || {};
      const latestHeroesData = latestData.heroes || {};
      const latestPearlMap = latestData.pearlMap || {};
      const latestArtifactBooks = latestData.artifactBooks || {};

      if (
        isTargetFishConfigMatched(
          latestTeamInfo,
          latestHeroesData,
          latestPearlMap,
          latestArtifactBooks,
        )
      ) {
        return {
          success: true,
          repaired: attempt > 1,
        };
      }

      setApplyProgressStage(`正在复核最终鱼灵（${attempt}/2）`);

      const requirements = getTargetFishRequirements(
        latestPearlMap,
        latestArtifactBooks,
      );
      const artifactToHero = {};
      for (const [heroId, hero] of Object.entries(latestHeroesData)) {
        if (hero?.artifactId && hero.artifactId !== -1) {
          artifactToHero[Number(hero.artifactId)] = Number(heroId);
        }
      }

      for (const requirement of requirements) {
        const currentTeamHero =
          latestTeamInfo?.[requirement.position]
          || latestTeamInfo?.[String(requirement.position)]
          || null;
        const latestHeroData =
          latestHeroesData[String(requirement.heroId)] || latestHeroesData[requirement.heroId];
        const currentArtifactId = Number(latestHeroData?.artifactId || 0) || null;
        const currentPearlId = Number(currentTeamHero?.pearlId || 0) || null;
        const currentSkillId =
          currentPearlId && latestPearlMap[currentPearlId]
            ? Number(latestPearlMap[currentPearlId]?.skillId || 0) || null
            : null;

        if (!requirement.artifactId) {
          if (currentArtifactId) {
            await sendApplyCommand("artifact_unload", {
              heroId: requirement.heroId,
            });
          }
          continue;
        }

        const currentHolderId = artifactToHero[requirement.artifactId];
        const rollbackPearlId = getPearlIdByArtifactId(
          latestPearlMap,
          requirement.artifactId,
        );
        const targetRollbackPearlId =
          currentPearlId
          || getPearlIdByArtifactId(latestPearlMap, currentArtifactId);
        if (currentHolderId && currentHolderId !== requirement.heroId) {
          await sendApplyCommand("artifact_unload", {
            heroId: currentHolderId,
          });
          delete artifactToHero[requirement.artifactId];
        }

        if (
          currentArtifactId
          && currentArtifactId !== Number(requirement.artifactId)
        ) {
          await sendApplyCommand("artifact_unload", {
            heroId: requirement.heroId,
          });
          delete artifactToHero[currentArtifactId];
        }

        if (
          currentArtifactId !== Number(requirement.artifactId)
          || currentPearlId !== Number(requirement.pearlId)
        ) {
          try {
            await sendApplyCommand("artifact_load", {
              heroId: requirement.heroId,
              itemId: requirement.artifactId,
              pearlId: requirement.pearlId || 0,
            }, {
              verifyApplied: () =>
                verifyArtifactAppliedToHero(
                  requirement.heroId,
                  requirement.artifactId,
                  requirement.pearlId || 0,
                ),
            });
            artifactToHero[requirement.artifactId] = requirement.heroId;
          } catch (error) {
            if (currentHolderId && currentHolderId !== requirement.heroId) {
              await tryRestoreArtifactToHero(
                currentHolderId,
                requirement.artifactId,
                rollbackPearlId || requirement.pearlId,
                "final-fish-verify-load-failed",
              );
            }
            if (
              currentArtifactId
              && currentArtifactId !== Number(requirement.artifactId)
            ) {
              await tryRestoreArtifactToHero(
                requirement.heroId,
                currentArtifactId,
                targetRollbackPearlId,
                "final-fish-verify-restore-target-artifact",
              );
            }
            throw error;
          }
        }

        if (
          requirement.pearlId
          && (requirement.skillId || null) !== (currentSkillId || null)
        ) {
          if (!requirement.skillId) {
            if (currentSkillId) {
              await sendApplyCommand("pearl_unloadskill", {
                pearlId: requirement.pearlId,
              });
            }
          } else {
            await sendApplyCommand("pearl_replaceskill", {
              pearlId: requirement.pearlId,
              skillId: requirement.skillId,
            });
          }
        }
      }

      await waitApplyCommandDelay();
    }

    const finalData = await fetchLatestData();
    return {
      success: isTargetFishConfigMatched(
        finalData.teamInfo || {},
        finalData.heroes || {},
        finalData.pearlMap || {},
        finalData.artifactBooks || {},
      ),
      repaired: false,
    };
  };

  try {
    const buildAttachmentToHeroMap = (heroesData = {}) => {
      const result = {};
      for (const [id, hero] of Object.entries(heroesData)) {
        if (hero?.attachmentUid && hero.attachmentUid !== -1) {
          result[hero.attachmentUid] = Number(id);
        }
      }
      return result;
    };

    const refreshApplyState = async () => {
      const latestData = await fetchLatestData();
      const latestHeroes = getTeamHeroes(latestData.teamInfo);
      return {
        data: latestData,
        teamHeroes: latestHeroes,
        heroIds: new Set(latestHeroes.map((hero) => Number(hero.heroId))),
        byPosition: new Map(
          latestHeroes.map((hero) => [Number(hero.position), hero]),
        ),
        attachmentToHero: buildAttachmentToHeroMap(latestData.heroes || {}),
      };
    };

    setApplyProgressStage("正在读取当前阵容数据");
    let applyState = await refreshApplyState();
    let currentHeroes = applyState.teamHeroes;
    const targetHeroIds = new Set(targetHeroes.map((h) => Number(h.heroId)));
    const deferredAttachmentTargets = [];
    const pendingRepositionTargets = [];

    setApplyProgressStage("正在整理武将站位");
    for (const targetHero of targetHeroes) {
      if (!targetHero.attachmentUid || targetHero.attachmentUid === -1)
        continue;

      const currentHolderId = applyState.attachmentToHero[targetHero.attachmentUid];

      if (currentHolderId && currentHolderId !== targetHero.heroId) {
        const holderInTeam = applyState.heroIds.has(currentHolderId);
        const targetInTeam = applyState.heroIds.has(targetHero.heroId);

        if (!holderInTeam && !targetInTeam) {
          const canUseTemporarySlots = currentHeroes.length <= 3;
          const allSlots = getLineupSlotCandidates(currentHeroes);
          const occupiedSlots = new Set(
            currentHeroes.map((hero) => Number(hero.position)),
          );
          const emptySlots = allSlots.filter(
            (slot) => !occupiedSlots.has(slot),
          );
          if (!canUseTemporarySlots || emptySlots.length < 2) {
            deferredAttachmentTargets.push(targetHero);
            logApplyDiagnostic(
              "attachment-resolution-deferred",
              {
                heroId: targetHero.heroId,
                currentHolderId,
                currentHeroCount: currentHeroes.length,
                emptySlots: emptySlots.length,
                reason: !canUseTemporarySlots
                  ? "lineup-has-too-many-active-heroes"
                  : "not-enough-empty-slots",
              },
              "warn",
            );
            continue;
          }

          const [holderTempSlot, targetTempSlot] = emptySlots;
          await sendApplyCommand("hero_gointobattle", {
            heroId: currentHolderId,
            slot: holderTempSlot,
          }, {
            verifyApplied: () =>
              verifyHeroAppliedToSlot(currentHolderId, holderTempSlot),
          });
          await waitApplyCommandDelay();
          applyState = await refreshApplyState();
          currentHeroes = applyState.teamHeroes;

          await sendApplyCommand("hero_gointobattle", {
            heroId: targetHero.heroId,
            slot: targetTempSlot,
          }, {
            verifyApplied: () =>
              verifyHeroAppliedToSlot(targetHero.heroId, targetTempSlot),
          });
          await waitApplyCommandDelay();
          applyState = await refreshApplyState();
          currentHeroes = applyState.teamHeroes;
        }

        if (!holderInTeam && targetInTeam) {
          deferredAttachmentTargets.push(targetHero);
          logApplyDiagnostic(
            "attachment-resolution-deferred",
            {
              heroId: targetHero.heroId,
              currentHolderId,
              currentHeroCount: currentHeroes.length,
              reason: "target-already-in-team-holder-off-team",
            },
            "warn",
          );
          continue;
        }

        if (holderInTeam && targetInTeam) {
          deferredAttachmentTargets.push(targetHero);
          logApplyDiagnostic(
            "attachment-resolution-deferred",
            {
              heroId: targetHero.heroId,
              currentHolderId,
              currentHeroCount: currentHeroes.length,
              reason: "both-heroes-already-in-team",
            },
            "warn",
          );
          continue;
        }

        await sendApplyCommand("hero_exchange", {
          heroId: currentHolderId,
          targetHeroId: targetHero.heroId,
        });
        await waitApplyCommandDelay();
        applyState = await refreshApplyState();
        currentHeroes = applyState.teamHeroes;
      }
    }

    setApplyProgressStage("正在下阵非目标武将");
    const heroesToRemove = [...currentHeroes].filter(
      (hero) => !targetHeroIds.has(hero.heroId),
    );
    const shouldDeferLastRemoval =
      currentHeroes.length > 0 && heroesToRemove.length === currentHeroes.length;
    let deferredRemovalHero = null;

    if (shouldDeferLastRemoval) {
      deferredRemovalHero = heroesToRemove.pop() || null;
      if (deferredRemovalHero) {
        logApplyDiagnostic(
          "lineup-delay-last-removal",
          {
            heroId: deferredRemovalHero.heroId,
            position: deferredRemovalHero.position,
          },
          "warn",
        );
      }
    }

    for (const hero of heroesToRemove) {
      await sendApplyCommand("hero_gobackbattle", {
        slot: hero.position,
      });
      await waitApplyCommandDelay();
    }

    applyState = await refreshApplyState();
    currentHeroes = applyState.teamHeroes;

    setApplyProgressStage("正在补齐并修正目标阵容");
    for (const targetHero of targetHeroes) {
      if (
        deferredRemovalHero
        && Number(targetHero.position) === Number(deferredRemovalHero.position)
      ) {
        continue;
      }
      currentHeroes = applyState.teamHeroes;
      const currentHero = currentHeroes.find(
        (hero) => Number(hero.heroId) === Number(targetHero.heroId),
      );
      if (currentHero?.position === Number(targetHero.position)) {
        continue;
      }

      const heroAtTargetSlot =
        applyState.byPosition.get(Number(targetHero.position)) || null;
      if (
        heroAtTargetSlot
        && Number(heroAtTargetSlot.heroId) !== Number(targetHero.heroId)
        && targetHeroIds.has(Number(heroAtTargetSlot.heroId))
      ) {
        pendingRepositionTargets.push(targetHero);
        continue;
      }

      if (!currentHero) {
        if (
          heroAtTargetSlot
          && Number(heroAtTargetSlot.heroId) !== Number(targetHero.heroId)
          && !targetHeroIds.has(Number(heroAtTargetSlot.heroId))
        ) {
          await sendApplyCommand("hero_exchange", {
            heroId: heroAtTargetSlot.heroId,
            targetHeroId: targetHero.heroId,
          }, {
            verifyApplied: () =>
              verifyHeroAppliedToSlot(targetHero.heroId, targetHero.position),
          });
        } else {
          await sendApplyCommand("hero_gointobattle", {
            heroId: targetHero.heroId,
            slot: targetHero.position,
          }, {
            verifyApplied: () =>
              verifyHeroAppliedToSlot(targetHero.heroId, targetHero.position),
          });
        }
      } else if (currentHero.position !== targetHero.position) {
        const originalSlot = currentHero.position;
        if (
          heroAtTargetSlot
          && Number(heroAtTargetSlot.heroId) !== Number(targetHero.heroId)
          && !targetHeroIds.has(Number(heroAtTargetSlot.heroId))
        ) {
          await sendApplyCommand("hero_exchange", {
            heroId: heroAtTargetSlot.heroId,
            targetHeroId: targetHero.heroId,
          }, {
            verifyApplied: () =>
              verifyHeroAppliedToSlot(targetHero.heroId, targetHero.position),
          });
        } else {
          await sendApplyCommand("hero_gobackbattle", {
            slot: currentHero.position,
          });
          try {
            await sendApplyCommand("hero_gointobattle", {
              heroId: targetHero.heroId,
              slot: targetHero.position,
            }, {
              verifyApplied: () =>
                verifyHeroAppliedToSlot(targetHero.heroId, targetHero.position),
            });
          } catch (err) {
            await tryRestoreHeroToSlot(
              targetHero.heroId,
              originalSlot,
              "main-lineup-move-failed",
            );
            rethrowIfApplyMustAbort(err);
          }
        }
      }

      await waitApplyCommandDelay();
      applyState = await refreshApplyState();
    }

    if (deferredRemovalHero) {
      setApplyProgressStage("正在处理最后一个保留武将");
      applyState = await refreshApplyState();
      currentHeroes = applyState.teamHeroes;
      const deferredCurrentHero = currentHeroes.find(
        (hero) => Number(hero.position) === Number(deferredRemovalHero.position),
      );
      const deferredTargetHero =
        targetByPosition.get(Number(deferredRemovalHero.position)) || null;

      if (
        deferredCurrentHero
        && deferredTargetHero
        && Number(deferredCurrentHero.heroId) !== Number(deferredTargetHero.heroId)
      ) {
        await sendApplyCommand("hero_exchange", {
          heroId: deferredCurrentHero.heroId,
          targetHeroId: deferredTargetHero.heroId,
        }, {
          verifyApplied: () =>
            verifyHeroAppliedToSlot(
              deferredTargetHero.heroId,
              deferredTargetHero.position,
            ),
        });
      } else {
        if (
          deferredCurrentHero
          && (!deferredTargetHero
            || Number(deferredCurrentHero.heroId) !== Number(deferredTargetHero.heroId))
        ) {
          await sendApplyCommand("hero_gobackbattle", {
            slot: deferredCurrentHero.position,
          });
        }

        if (deferredTargetHero) {
          await sendApplyCommand("hero_gointobattle", {
            heroId: deferredTargetHero.heroId,
            slot: deferredTargetHero.position,
          }, {
            verifyApplied: () =>
              verifyHeroAppliedToSlot(
                deferredTargetHero.heroId,
                deferredTargetHero.position,
              ),
          });
        }
      }

      await waitApplyCommandDelay();
      applyState = await refreshApplyState();
    }

    if (pendingRepositionTargets.length > 0) {
      setApplyProgressStage("正在补齐剩余目标武将");
      applyState = await refreshApplyState();
      currentHeroes = applyState.teamHeroes;

      for (const targetHero of pendingRepositionTargets) {
        const currentHero = currentHeroes.find(
          (hero) => Number(hero.heroId) === Number(targetHero.heroId),
        );
        if (currentHero?.position === Number(targetHero.position)) {
          continue;
        }
        const heroAtTargetSlot =
          applyState.byPosition.get(Number(targetHero.position)) || null;
        if (
          heroAtTargetSlot
          && Number(heroAtTargetSlot.heroId) !== Number(targetHero.heroId)
          && !targetHeroIds.has(Number(heroAtTargetSlot.heroId))
        ) {
          await sendApplyCommand("hero_exchange", {
            heroId: heroAtTargetSlot.heroId,
            targetHeroId: targetHero.heroId,
          }, {
            verifyApplied: () =>
              verifyHeroAppliedToSlot(targetHero.heroId, targetHero.position),
          });
        } else {
          await sendApplyCommand("hero_gointobattle", {
            heroId: targetHero.heroId,
            slot: targetHero.position,
          }, {
            verifyApplied: () =>
              verifyHeroAppliedToSlot(targetHero.heroId, targetHero.position),
          });
        }
        await waitApplyCommandDelay();
        applyState = await refreshApplyState();
        currentHeroes = applyState.teamHeroes;
      }
    }

    if (deferredAttachmentTargets.length > 0) {
      setApplyProgressStage("正在补正延后处理的附件归属");
      applyState = await refreshApplyState();
      for (const targetHero of deferredAttachmentTargets) {
        const latestCurrentHolderId =
          applyState.attachmentToHero[targetHero.attachmentUid];
        if (!latestCurrentHolderId || latestCurrentHolderId === targetHero.heroId) {
          continue;
        }
        if (!applyState.heroIds.has(Number(targetHero.heroId))) {
          logApplyDiagnostic(
            "attachment-resolution-still-deferred",
            {
              heroId: targetHero.heroId,
              currentHolderId: latestCurrentHolderId,
              reason: "target-not-in-team-after-lineup",
            },
            "warn",
          );
          continue;
        }
        if (!applyState.heroIds.has(Number(latestCurrentHolderId))) {
          logApplyDiagnostic(
            "attachment-resolution-still-deferred",
            {
              heroId: targetHero.heroId,
              currentHolderId: latestCurrentHolderId,
              reason: "holder-not-in-team-after-lineup",
            },
            "warn",
          );
          continue;
        }
        await sendApplyCommand("hero_exchange", {
          heroId: latestCurrentHolderId,
          targetHeroId: targetHero.heroId,
        }, {
          verifyApplied: () =>
            verifyHeroAppliedToSlot(targetHero.heroId, targetHero.position),
        });
        await waitApplyCommandDelay();
        applyState = await refreshApplyState();
      }
    }

    const hasLevelData = lineup.heroes.some((h) => h.level && h.level > 0);
    if (hasLevelData) {
      setApplyProgressStage("正在同步武将等级");
      const levelData = await fetchLatestData();
      const currentHeroesData = levelData.heroes;

      let levelApplied = 0;
      for (const targetHero of targetHeroes) {
        if (!targetHero.level || targetHero.level <= 0) continue;

        const heroData = currentHeroesData[String(targetHero.heroId)];
        const currentLevel = heroData?.level || 1;
        const currentOrder = heroData?.order || 0;

        if (currentLevel !== targetHero.level) {
          const result = await applyHeroLevel(
            tokenId,
            targetHero.heroId,
            targetHero.level,
            currentLevel,
            currentOrder,
            targetHero.position,
            waitApplyCommandDelay,
          );

          if (result.success) {
            levelApplied++;
          } else {
            errors.push(
              `${getHeroName(targetHero.heroId) || targetHero.heroId} 等级同步失败：${result.message}`,
            );
          }
        }
      }

      if (levelApplied > 0) {
        message.success(`已应用 ${levelApplied} 个武将等级配置`);
      }
    }

    setApplyProgressStage("正在预先复核阵容");
    const preFishLineupCheck = await ensureFinalLineupMatches();
    if (!preFishLineupCheck.success) {
      throw createApplyAbortError(
        "lineup-pre-fish-check",
        "鱼灵同步前复核阵容失败：当前上阵结果与已保存阵容不一致",
        {
          type: "lineup-pre-fish-check-failed",
        },
      );
    }
    if (preFishLineupCheck.repaired) {
      message.success("阵容预复核完成，已先补正上阵结果");
    }

    const hasFishData = lineup.heroes.some((h) => h.pearlId || h.fishId);
    if (hasFishData) {
      setApplyProgressStage("正在同步鱼灵配置");
      const fishData = await fetchLatestData();
      const currentHeroes = fishData.heroes;
      const pearlMap = fishData.pearlMap || {};
      const artifactBooks = fishData.artifactBooks || {};

      const artifactToHero = {};
      for (const [heroId, hero] of Object.entries(currentHeroes)) {
        if (hero.artifactId && hero.artifactId !== -1) {
          artifactToHero[hero.artifactId] = Number(heroId);
        }
      }

      const fishToArtifact = {};
      for (const [fishId, book] of Object.entries(artifactBooks)) {
        if (book?.artifactId && book.artifactId !== -1) {
          fishToArtifact[Number(fishId)] = book.artifactId;
        }
      }

      let fishApplied = 0;
      for (const targetHero of targetHeroes) {
        if (!targetHero.fishId && !targetHero.pearlId) continue;

        let artifactId = null;
        let pearlId = Number(targetHero.pearlId || 0) || 0;

        if (targetHero.fishId) {
          artifactId = fishToArtifact[Number(targetHero.fishId)];
        }

        if (!artifactId && targetHero.pearlId) {
          const pearlData = pearlMap[targetHero.pearlId];
          if (pearlData?.artifactId && pearlData.artifactId !== -1) {
            artifactId = pearlData.artifactId;
          }
        }

        if (!artifactId) continue;

        const currentHolderId = artifactToHero[artifactId];
        const rollbackPearlId = getPearlIdByArtifactId(pearlMap, artifactId);
        const currentHeroData = currentHeroes[String(targetHero.heroId)] || {};
        const currentArtifactId = Number(currentHeroData?.artifactId || 0) || null;
        const currentTeamHero =
          fishData.teamInfo?.[targetHero.position]
          || fishData.teamInfo?.[String(targetHero.position)]
          || null;
        const currentPearlId = Number(currentTeamHero?.pearlId || 0) || null;
        const targetRollbackPearlId =
          currentPearlId || getPearlIdByArtifactId(pearlMap, currentArtifactId);

        if (
          currentHolderId === targetHero.heroId
          && currentArtifactId === Number(artifactId)
          && currentPearlId === (Number(pearlId || 0) || null)
        ) {
          continue;
        }

        if (currentHolderId && currentHolderId !== targetHero.heroId) {
          try {
            await sendApplyCommand("artifact_unload", {
              heroId: currentHolderId,
            });
            delete artifactToHero[artifactId];
          } catch (err) {
            rethrowIfApplyMustAbort(err);
          }
        }

        if (currentArtifactId && currentArtifactId !== Number(artifactId)) {
          try {
            await sendApplyCommand("artifact_unload", {
              heroId: targetHero.heroId,
            });
            delete artifactToHero[currentArtifactId];
          } catch (err) {
            rethrowIfApplyMustAbort(err);
          }
        }

        try {
          await sendApplyCommand("artifact_load", {
            heroId: targetHero.heroId,
            itemId: artifactId,
            pearlId: pearlId,
          }, {
            verifyApplied: () =>
              verifyArtifactAppliedToHero(
                targetHero.heroId,
                artifactId,
                pearlId,
              ),
          });
          artifactToHero[artifactId] = Number(targetHero.heroId);
          fishApplied++;
        } catch (err) {
          if (currentHolderId && currentHolderId !== targetHero.heroId) {
            await tryRestoreArtifactToHero(
              currentHolderId,
              artifactId,
              rollbackPearlId || pearlId,
              "main-fish-load-failed",
            );
          }
          if (currentArtifactId && currentArtifactId !== Number(artifactId)) {
            await tryRestoreArtifactToHero(
              targetHero.heroId,
              currentArtifactId,
              targetRollbackPearlId,
              "main-fish-restore-target-artifact",
            );
          }
          rethrowIfApplyMustAbort(err);
        }
      }

      if (fishApplied > 0) {
        message.success(`已应用 ${fishApplied} 个鱼灵配置`);
      }

      setApplyProgressStage("正在同步鱼珠技能");
      let skillApplied = 0;
      const skillData = await fetchLatestData();
      const latestPearlMap = skillData.pearlMap || {};

      const processedPearlIds = new Set();
      const pearlIdsToHandle = targetHeroes
        .filter((hero) => hero.pearlId)
        .map((hero) => Number(hero.pearlId));

      for (const pearlId of pearlIdsToHandle) {
        if (processedPearlIds.has(pearlId)) continue;

        const targetHero = targetHeroes.find(
          (hero) => Number(hero.pearlId) === Number(pearlId),
        );
        const currentPearlData = latestPearlMap[pearlId];
        const currentSkillId = currentPearlData?.skillId || null;
        const targetSkillId = targetHero?.skillId || null;

        if (!targetSkillId) {
          if (currentSkillId) {
            try {
              await sendApplyCommand("pearl_unloadskill", {
                pearlId: pearlId,
              });
              skillApplied++;
              processedPearlIds.add(pearlId);
            } catch (err) {
              rethrowIfApplyMustAbort(err);
            }
          }
          continue;
        }

        if (currentSkillId === targetSkillId) {
          continue;
        }

        const holderPearlId = Object.keys(latestPearlMap).find((pid) => {
          if (Number(pid) === pearlId) return false;
          const data = latestPearlMap[pid];
          return data?.skillId === targetSkillId;
        });

        if (holderPearlId && !processedPearlIds.has(Number(holderPearlId))) {
          try {
            await sendApplyCommand("pearl_exchangeskill", {
              pearlId1: pearlId,
              pearlId2: Number(holderPearlId),
            });
            skillApplied += 2;
            processedPearlIds.add(pearlId);
            processedPearlIds.add(Number(holderPearlId));
          } catch (err) {
            rethrowIfApplyMustAbort(err);
          }
        } else {
          try {
            await sendApplyCommand("pearl_replaceskill", {
              pearlId: pearlId,
              skillId: targetSkillId,
            });
            skillApplied++;
            processedPearlIds.add(pearlId);
          } catch (err) {
            rethrowIfApplyMustAbort(err);
          }
        }
      }

      if (skillApplied > 0) {
        message.success(`已切换 ${skillApplied} 个鱼珠技能`);
      }
    }

    if (
      lineup.legionResearch &&
      Object.keys(lineup.legionResearch).length > 0
    ) {
      setApplyProgressStage("正在同步俱乐部科技");
      const syncResult = await syncLegionResearch(
        tokenId,
        lineup.legionResearch,
        waitApplyCommandDelay,
      );
      if (syncResult.success) {
        if (syncResult.message !== "科技配置已匹配，无需调整") {
          message.success(syncResult.message);
        }
      } else {
      }
    }

    if (lineup.weaponId !== undefined && lineup.weaponId !== null) {
      setApplyProgressStage("正在同步默认玩具");
      const currentPresetTeam = await sendApplyCommand(
        "presetteam_getinfo",
        {},
      );
      const currentPresetInfo =
        currentPresetTeam?.presetTeamInfo?.presetTeamInfo ||
        currentPresetTeam?.presetTeamInfo ||
        {};
      const currentTeamData =
        currentPresetInfo[currentTeamId.value] ||
        currentPresetInfo[String(currentTeamId.value)];
      const currentWeaponId = currentTeamData?.weapon?.weaponId || null;

      if (currentWeaponId !== lineup.weaponId) {
        try {
          await sendApplyCommand("lordweapon_changedefaultweapon", {
            weaponId: lineup.weaponId,
          });
          message.success(
            `玩具已切换为: ${weapon[lineup.weaponId] || lineup.weaponId}`,
          );
        } catch (err) {
          rethrowIfApplyMustAbort(err);
        }
      }
    }

    setApplyProgressStage("正在复核最终阵容");
    const finalLineupCheck = await ensureFinalLineupMatches();
    if (!finalLineupCheck.success) {
      errors.push("最终阵容复核失败：当前上阵结果与已保存阵容仍不一致");
    } else if (finalLineupCheck.repaired) {
      message.success("最终阵容复核完成，已自动补正上阵结果");
    }

    const finalFishCheck = await ensureFinalFishArtifactsMatch();
    if (!finalFishCheck.success) {
      errors.push("最终鱼灵复核失败：当前鱼灵结果与已保存阵容仍不一致");
    } else if (finalFishCheck.repaired) {
      message.success("最终鱼灵复核完成，已自动补正鱼灵结果");
    }

    if (errors.length > 0) {
      logApplyDiagnostic(
        "apply-finished-with-warnings",
        {
          errors,
          shouldRecordDuration,
        },
        "warn",
      );
      message.warning(`阵容已应用，但有部分错误:\n${errors.join("\n")}`);
    } else {
      logApplyDiagnostic("apply-finished-success", {
        shouldRecordDuration,
      });
      message.success(`阵容 "${lineup.name}" 已应用`);
    }

    setApplyProgressStage("正在刷新阵容结果");
    lastRefreshTime = 0;
    await refreshTeamInfo();
    shouldRecordDuration = true;
  } catch (error) {
    if (error?.__applyAbort) {
      logApplyDiagnostic(
        "apply-aborted",
        {
          abortCmd: error?.__applyAbortCmd || "",
          errorMessage: error?.message || String(error),
        },
        "error",
      );
    }

    lastRefreshTime = 0;
    await refreshTeamInfo();

    const hasTargetFishData = targetHeroes.some(
      (hero) => hero.pearlId || hero.fishId,
    );
    await delay(1500);
    const actualState = await readLatestStateSnapshot();
    const actualLineupMatched = actualState
      ? isTargetLineupMatched(
        getTeamHeroes(actualState.teamInfo || {}),
        targetHeroes,
      )
      : false;
    const actualFishMatched = hasTargetFishData
      ? Boolean(
        actualState
        && isTargetFishConfigMatched(
          actualState.teamInfo || {},
          actualState.heroes || {},
          actualState.pearlMap || {},
          actualState.artifactBooks || {},
        ),
      )
      : true;

    if (actualLineupMatched && actualFishMatched) {
      logApplyDiagnostic(
        "apply-abort-verified-success",
        {
          abortCmd: error?.__applyAbortCmd || "",
          errorMessage: error?.message || String(error),
          actualLineupMatched,
          actualFishMatched,
        },
        "warn",
      );
      shouldRecordDuration = true;
      message.success(`阵容 "${lineup.name}" 已应用`);
      return;
    }

    logApplyDiagnostic(
      "apply-failed",
      {
        errorMessage: error?.message || String(error),
        errors,
        actualLineupMatched,
        actualFishMatched,
      },
      "error",
    );
    message.error(`应用阵容失败: ${error.message}`);
  } finally {
    logApplyDiagnostic("apply-finally", {
      recordDuration: shouldRecordDuration,
      finalStage: applyProgressStage.value || "",
    });
    finishApplyProgress({ recordDuration: shouldRecordDuration });
    lineup.applying = false;
    state.value.isRunning = false;
    releaseTokenOperationLock(tokenId, applyOperationLockId);
  }
};

const showTechModal = (lineup) => {
  selectedTechData.value = lineup.legionResearch || null;
  techModalVisible.value = true;
};

const renameLineup = (index) => {
  const currentName = savedLineups.value[index].name;
  let newName = currentName;
  dialog.create({
    title: "重命名阵容",
    content: () =>
      h(NInput, {
        defaultValue: currentName,
        onInput: (val) => {
          newName = val;
        },
        placeholder: "请输入阵容名称",
      }),
    positiveText: "确定",
    negativeText: "取消",
    onPositiveClick: () => {
      if (newName && newName.trim()) {
        savedLineups.value[index].name = newName.trim();
        saveLineupsToStorage();
        message.success("阵容名称已更新");
      }
    },
  });
};

const deleteLineup = (index) => {
  dialog.warning({
    title: "删除阵容",
    content: `确定要删除阵容 "${savedLineups.value[index].name}" 吗？`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: () => {
      savedLineups.value.splice(index, 1);
      saveLineupsToStorage();
      message.success("阵容已删除");
    },
  });
};

const exportLineups = async () => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法导出");
    return;
  }

  try {
    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
    );
    const role = roleInfo?.role || roleInfo;
    const roleId = role?.roleId || role?.id;

    if (!roleId) {
      message.error("无法获取角色ID");
      return;
    }

    const exportData = {
      roleId: roleId,
      exportTime: Date.now(),
      lineups: savedLineups.value,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `阵容配置_${roleId}_${new Date().toLocaleDateString().replace(/\//g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);

    message.success(`已导出 ${savedLineups.value.length} 个阵容`);
  } catch (error) {
    message.error(`导出失败: ${error.message}`);
  }
};

const importLineups = async ({ file }) => {
  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法导入");
    return;
  }

  try {
    const roleInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "role_getroleinfo",
      {},
    );
    const role = roleInfo?.role || roleInfo;
    const currentRoleId = role?.roleId || role?.id;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);

        if (!importData.roleId || !importData.lineups) {
          message.error("无效的阵容文件格式");
          return;
        }

        const processImport = (lineupsToImport) => {
          const existingIds = new Set(savedLineups.value.map((l) => l.id));
          const newLineups = [];
          const duplicateLineups = [];

          for (const lineup of lineupsToImport) {
            if (lineup.id && existingIds.has(lineup.id)) {
              duplicateLineups.push(lineup);
            } else {
              newLineups.push({
                ...lineup,
                id: lineup.id || generateLineupId(),
                savedAt: Date.now(),
                applying: false,
              });
            }
          }

          if (duplicateLineups.length > 0) {
            dialog.warning({
              title: "发现重复阵容",
              content: `发现 ${duplicateLineups.length} 个已存在的阵容，是否覆盖？`,
              positiveText: "覆盖",
              negativeText: "跳过重复",
              onPositiveClick: () => {
                for (const dupLineup of duplicateLineups) {
                  const index = savedLineups.value.findIndex(
                    (l) => l.id === dupLineup.id,
                  );
                  if (index !== -1) {
                    savedLineups.value[index] = {
                      ...dupLineup,
                      savedAt: Date.now(),
                      applying: false,
                    };
                  }
                }
                savedLineups.value = [...savedLineups.value, ...newLineups];
                saveLineupsToStorage();
                message.success(
                  `已导入 ${newLineups.length + duplicateLineups.length} 个阵容`,
                );
              },
              onNegativeClick: () => {
                savedLineups.value = [...savedLineups.value, ...newLineups];
                saveLineupsToStorage();
                message.success(
                  `已导入 ${newLineups.length} 个阵容，跳过 ${duplicateLineups.length} 个重复`,
                );
              },
            });
          } else {
            savedLineups.value = [...savedLineups.value, ...newLineups];
            saveLineupsToStorage();
            message.success(`已导入 ${newLineups.length} 个阵容`);
          }
        };

        if (importData.roleId !== currentRoleId) {
          dialog.warning({
            title: "角色不匹配",
            content: `该阵容文件来自其他角色，是否继续导入？`,
            positiveText: "导入",
            negativeText: "取消",
            onPositiveClick: () => {
              processImport(importData.lineups);
            },
          });
        } else {
          processImport(importData.lineups);
        }
      } catch (parseError) {
        message.error("解析文件失败，请检查文件格式");
      }
    };
    reader.readAsText(file.file);
  } catch (error) {
    message.error(`导入失败: ${error.message}`);
  }
};

const switchTeam = async (teamId) => {
  if (teamId === currentTeamId.value) return;

  const token = tokenStore.selectedToken;
  if (!token) {
    message.warning("请先选择Token");
    return;
  }

  const tokenId = token.id;
  const status = tokenStore.getWebSocketStatus(tokenId);
  if (status !== "connected") {
    message.error("WebSocket未连接，无法切换阵容");
    return;
  }

  switchingTeamId.value = teamId;
  state.value.isRunning = true;

  try {
    await tokenStore.sendMessageWithPromise(tokenId, "presetteam_saveteam", {
      teamId,
    });

    await delay(COMMAND_DELAY);

    currentTeamId.value = teamId;
    message.success(`已切换到阵容 ${teamId}`);

    await refreshTeamInfo();
  } catch (error) {
    message.error(`切换阵容失败: ${error.message}`);
  } finally {
    switchingTeamId.value = null;
    state.value.isRunning = false;
  }
};

watch(
  () => authStore.isAuthenticated,
  (isAuthenticated, wasAuthenticated) => {
    if (isAuthenticated && !wasAuthenticated && tokenStore.selectedToken) {
      void pullSavedLineupsFromCloud(true);
    }
  },
);

watch(
  () => tokenStore.selectedToken,
  async (newToken, oldToken) => {
    if (newToken && newToken.id !== oldToken?.id) {
      loadSavedLineups();
      await pullSavedLineupsFromCloud(true);
      currentTeamInfo.value = null;
      presetTeamData.value = null;
      allHeroesData.value = {};
      currentTeamId.value = 1;

      const status = tokenStore.getWebSocketStatus(newToken.id);
      if (status === "connected") {
        refreshTeamInfo();
      }
    }
  },
);

watch(
  () =>
    tokenStore.selectedToken
      ? tokenStore.getWebSocketStatus(tokenStore.selectedToken.id)
      : null,
  (newStatus, oldStatus) => {
    if (
      newStatus === "connected" &&
      oldStatus !== "connected" &&
      tokenStore.selectedToken
    ) {
      setTimeout(() => {
        refreshTeamInfo();
      }, 500);
    }
  },
);

onMounted(() => {
  loadSavedLineups();
  void pullSavedLineupsFromCloud(true);

  const token = tokenStore.selectedToken;
  if (token) {
    const status = tokenStore.getWebSocketStatus(token.id);
    if (status === "connected") {
      refreshTeamInfo();
    }
  }
});

onBeforeUnmount(() => {
  clearApplyProgressTimer();
  if (savedLineupsCloudTimer) {
    clearTimeout(savedLineupsCloudTimer);
    savedLineupsCloudTimer = null;
  }
});
</script>

<style scoped lang="scss">
.lineup-saver {
  min-height: 300px;
}

.lineup-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.toolbar {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.current-team-section {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);

  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }

  .drag-tip {
    font-size: var(--font-size-xs);
    color: var(--text-tertiary);
    font-weight: normal;
  }
}

.heroes-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.hero-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: var(--bg-primary);
  border-radius: var(--border-radius-small);
  padding: var(--spacing-xs) var(--spacing-sm);
  width: 100%;
  transition: all 0.2s;
  cursor: grab;
  border: 2px solid transparent;

  &:hover {
    background: var(--primary-color-light);
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  &.dragging {
    opacity: 0.5;
    cursor: grabbing;
  }

  &.drag-over {
    border-color: var(--primary-color);
    background: var(--primary-color-light);
  }
}

.hero-actions {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
  margin-left: auto;
  min-width: 60px;
  justify-content: center;
}

.hero-position {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--primary-color);
  color: white;
  font-size: 10px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.hero-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.hero-placeholder {
  font-size: 12px;
  color: var(--text-secondary);
}

.hero-left {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  cursor: pointer;
}

.hero-avatar-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 100%;
}

.hero-name-small-inline {
  font-size: var(--font-size-xs);
  color: var(--text-primary);
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-level-small-inline {
  font-size: 10px;
  color: white;
  font-weight: 600;
  white-space: nowrap;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  padding: 2px 6px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(240, 147, 251, 0.3);
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
  flex: 1;
}

.hero-header {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 4px;
}

.hero-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.hero-level {
  font-size: var(--font-size-xs);
  color: var(--text-accent);
  font-weight: 500;
}

.hero-fish {
  font-size: var(--font-size-xs);
  color: var(--primary-color);
  background: linear-gradient(
    135deg,
    rgba(114, 46, 209, 0.15) 0%,
    rgba(114, 46, 209, 0.08) 100%
  );
  border: 1px solid rgba(114, 46, 209, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  align-self: flex-start;
  margin-bottom: 6px;
  font-weight: 500;
}

.hero-stats {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 3px;

  .stat-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  span {
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
    white-space: nowrap;
    min-width: 90px;
    text-align: center;
  }

  .stat-power {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
    color: white;
    font-size: 12px;
  }

  .stat-attack {
    background: linear-gradient(135deg, #ffa940 0%, #fa8c16 100%);
    color: white;
  }

  .stat-hp {
    background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
    color: white;
  }

  .stat-speed {
    background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
    color: white;
  }
}

.hero-fish-skill-inline {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: white;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 500;
}

.hero-fish-slots-inline {
  display: inline-flex;
  gap: 3px;
  margin-left: 4px;
  padding-left: 6px;
  border-left: 1px solid rgba(114, 46, 209, 0.2);
}

.slot-dot-small {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.hero-artifact {
  font-size: var(--font-size-xs);
}

.exchange-btn {
  flex-shrink: 0;
  width: 100%;
}

.remove-btn {
  flex-shrink: 0;
  width: 100%;
}

.saved-lineups-section {
  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
}

.empty-tip {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-lg);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
}

.saved-lineups-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.saved-lineup-item {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-sm);
}

.lineup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-xs);
}

.lineup-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.lineup-time {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.lineup-heroes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.lineup-heroes-row {
  display: flex;
  gap: var(--spacing-md);
  justify-content: center;
  margin-bottom: var(--spacing-sm);
}

.lineup-hero-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 110px;
  padding: 8px 6px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-small);
}

.hero-avatar {
  width: 60px;
  height: 60px;
  border-radius: var(--border-radius-small);
  object-fit: cover;
  border: 2px solid var(--border-color);
}

.hero-avatar-placeholder {
  width: 60px;
  height: 60px;
  border-radius: var(--border-radius-small);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
  border: 2px solid var(--border-color);
}

.hero-info-small {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
}

.hero-header-small {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  margin-bottom: 4px;
}

.hero-name-small {
  font-size: 13px;
  color: var(--text-primary);
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-level-small {
  font-size: 12px;
  color: white;
  font-weight: 600;
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  padding: 2px 6px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(240, 147, 251, 0.3);
}

.hero-fish-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 4px;
  gap: 2px;
  background: linear-gradient(
    135deg,
    rgba(114, 46, 209, 0.12) 0%,
    rgba(114, 46, 209, 0.06) 100%
  );
  border: 1px solid rgba(114, 46, 209, 0.18);
  border-radius: 6px;
  padding: 4px 8px;
  width: 100%;
}

.hero-fish-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.hero-stats-small {
  font-size: 10px;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 3px;
  width: 100%;

  .stat-row-small {
    display: flex;
    justify-content: center;
    gap: 4px;
  }

  span {
    padding: 3px 5px;
    border-radius: 4px;
    font-weight: 500;
    white-space: nowrap;
    min-width: 70px;
    text-align: center;
  }

  .stat-power {
    background: linear-gradient(135deg, #ff6b6b 0%, #ee5a5a 100%);
    color: white;
  }

  .stat-attack {
    background: linear-gradient(135deg, #ffa940 0%, #fa8c16 100%);
    color: white;
  }

  .stat-hp {
    background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
    color: white;
  }

  .stat-speed {
    background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
    color: white;
  }
}

.hero-fish-name {
  font-size: 11px;
  color: var(--primary-color);
  font-weight: 500;
}

.hero-fish-skill-name {
  font-size: 10px;
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
  color: white;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
  font-weight: 500;
}

.hero-fish-slots {
  display: flex;
  gap: 4px;
  justify-content: center;
  padding-top: 3px;
}

.lineup-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.quick-switch-section {
  h4 {
    margin: 0 0 var(--spacing-sm) 0;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
  }
}

.team-selector {
  display: flex;
  gap: var(--spacing-xs);
}

.refine-modal-content {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--spacing-md);
}

.equip-refine-section {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-sm);
}

.equip-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  padding-bottom: var(--spacing-xs);
  border-bottom: 1px solid var(--border-light);
}

.equip-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.equip-level {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.equip-bonus {
  font-size: var(--font-size-xs);
  color: var(--primary-color);
  margin-left: auto;
}

.slots-container {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.slot-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--border-radius-small);
  border-left: 3px solid var(--border-light);

  &.locked {
    border-left-color: var(--primary-color);
    background: var(--primary-color-light);
  }

  &.color-1 {
    border-left-color: #ffffff;
    background: rgba(255, 255, 255, 0.1);
  }

  &.color-2 {
    border-left-color: #4caf50;
    background: rgba(76, 175, 80, 0.1);
  }

  &.color-3 {
    border-left-color: #2196f3;
    background: rgba(33, 150, 243, 0.1);
  }

  &.color-4 {
    border-left-color: #9c27b0;
    background: rgba(156, 39, 176, 0.1);
  }

  &.color-5 {
    border-left-color: #ff9800;
    background: rgba(255, 152, 0, 0.1);
  }

  &.color-6 {
    border-left-color: #f44336;
    background: rgba(244, 67, 54, 0.1);
  }
}

.slot-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  min-width: 30px;
}

.slot-attr {
  flex: 1;
  display: flex;
  justify-content: space-between;
  font-size: var(--font-size-sm);
}

.attr-name {
  color: var(--text-primary);
}

.attr-value {
  color: var(--primary-color);
  font-weight: var(--font-weight-medium);
}

.slot-empty {
  flex: 1;
  color: var(--text-tertiary);
  font-size: var(--font-size-xs);
}

.no-equipment {
  text-align: center;
  color: var(--text-secondary);
  padding: var(--spacing-lg);
}

.exchange-modal-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.current-hero-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
}

.hero-filter-section {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);

  .filter-label {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    flex-shrink: 0;
  }

  .filter-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
  }
}

.hero-select-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: var(--spacing-sm);
  max-height: 400px;
  overflow-y: auto;
  padding: var(--spacing-xs);
}

.hero-select-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;

  &:hover {
    background: var(--bg-secondary);
    transform: translateY(-2px);
  }

  &.selected {
    border-color: var(--primary-color);
    background: var(--primary-color-light);
  }

  &.quality-red {
    border-color: rgba(245, 34, 45, 0.3);

    &:hover {
      border-color: rgba(245, 34, 45, 0.6);
      background: rgba(245, 34, 45, 0.1);
    }

    &.selected {
      border-color: #f5222d;
      background: rgba(245, 34, 45, 0.15);
    }
  }

  &.quality-orange {
    border-color: rgba(250, 173, 20, 0.3);

    &:hover {
      border-color: rgba(250, 173, 20, 0.6);
      background: rgba(250, 173, 20, 0.1);
    }

    &.selected {
      border-color: #faad14;
      background: rgba(250, 173, 20, 0.15);
    }
  }

  &.quality-purple {
    border-color: rgba(114, 46, 209, 0.3);

    &:hover {
      border-color: rgba(114, 46, 209, 0.6);
      background: rgba(114, 46, 209, 0.1);
    }

    &.selected {
      border-color: #722ed1;
      background: rgba(114, 46, 209, 0.15);
    }
  }
}

.hero-select-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.hero-select-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  text-align: center;
}

.hero-select-tags {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
  justify-content: center;
}

.hero-artifact-id {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  margin-top: 2px;
}

.saved-lineups-modal-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.team-tabs {
  display: flex;
  gap: var(--spacing-xs);
  border-bottom: 1px solid var(--border-color);
  padding-bottom: var(--spacing-sm);
  justify-content: space-between;
  align-items: center;
}

.team-tabs-left {
  display: flex;
  gap: var(--spacing-xs);
}

.team-tabs-right {
  display: flex;
  gap: var(--spacing-xs);
}

.team-tab {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--border-radius-medium);
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  transition: all 0.2s;

  &:hover {
    background: var(--bg-tertiary);
    color: var(--text-primary);
  }

  &.active {
    background: var(--primary-color);
    color: white;
  }
}

.tab-count {
  font-size: var(--font-size-xs);
  opacity: 0.8;
}

.lineups-list {
  max-height: 50vh;
  overflow-y: auto;
}

.lineup-card {
  background: var(--bg-tertiary);
  border-radius: var(--border-radius-medium);
  margin-bottom: var(--spacing-sm);
  overflow: hidden;
}

.lineup-title-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-sm);
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: var(--bg-secondary);
  }
}

.lineup-title-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.expand-icon {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
  width: 12px;
}

.lineup-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.lineup-time {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.lineup-weapon-tag {
  font-size: var(--font-size-xs);
  color: var(--primary-color);
  background: rgba(var(--primary-color-rgb, 0, 122, 255), 0.1);
  padding: 1px 6px;
  border-radius: var(--border-radius-small);
  margin-left: var(--spacing-xs);
}

.lineup-quick-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.lineup-detail {
  padding: var(--spacing-sm);
  padding-top: 0;
  border-top: 1px solid var(--border-color);
}

.lineup-heroes-detail {
  display: flex;
  flex-wrap: wrap;
  gap: var(--spacing-xs);
  margin-bottom: var(--spacing-sm);
}

.lineup-hero-item {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: var(--border-radius-small);
}

.hero-pos {
  color: var(--text-tertiary);
}

.hero-name {
  color: var(--text-primary);
}

.hero-artifact {
  color: var(--primary-color);
  font-size: var(--font-size-xs);
}

.hero-fish-tag {
  color: var(--success-color);
  font-size: var(--font-size-xs);
  background: rgba(var(--success-color-rgb, 0, 128, 0), 0.1);
  padding: 1px 4px;
  border-radius: var(--border-radius-small);
  margin-left: 4px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.hero-fish-skill {
  color: var(--primary-color);
  font-weight: normal;
}

.hero-fish-slots {
  display: inline-flex;
  gap: 2px;
  margin-left: 4px;
}

.slot-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.3);
}

.apply-progress-modal {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.apply-progress-head {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.apply-progress-lineup {
  font-size: var(--font-size-lg);
  color: var(--text-primary);
}

.apply-progress-stage {
  font-size: var(--font-size-sm);
  color: var(--primary-color);
}

.apply-progress-stage--overdue {
  color: var(--warning-color);
}

.apply-progress-stats {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--spacing-sm);
}

.apply-progress-stat {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--spacing-sm);
  border-radius: var(--border-radius-medium);
  background: var(--bg-tertiary);
}

.apply-progress-label {
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.apply-progress-bar {
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(var(--primary-color-rgb, 0, 122, 255), 0.14);
}

.apply-progress-bar__fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--primary-color), var(--success-color));
  transition: width 0.6s ease;
}

.apply-progress-bar__fill--overdue {
  background: linear-gradient(90deg, var(--warning-color), var(--error-color));
}

.apply-progress-source {
  margin: 0;
  font-size: var(--font-size-xs);
  color: var(--text-tertiary);
}

.apply-progress-source--overdue {
  color: var(--warning-color);
}

.apply-progress-warning {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--border-radius-medium);
  background: rgba(255, 193, 7, 0.12);
  color: var(--text-primary);
}

.apply-progress-warning strong {
  color: var(--warning-color);
}

.apply-progress-overdue-tip {
  color: var(--warning-color);
}

.tech-modal-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md);
}

.tech-type-section {
  border: 1px solid var(--border-color);
  border-radius: var(--border-radius);
  overflow: hidden;
}

.tech-type-header {
  background: var(--bg-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-weight: bold;
  color: var(--primary-color);
}

.tech-items {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1px;
  background: var(--border-color);
}

.tech-item {
  display: flex;
  justify-content: space-between;
  padding: var(--spacing-xs) var(--spacing-sm);
  background: var(--bg-primary);
  font-size: var(--font-size-sm);
}

.tech-name {
  color: var(--text-secondary);
}

.tech-level {
  color: var(--text-primary);
  font-weight: 500;
}

.no-tech-data {
  text-align: center;
  color: var(--text-tertiary);
  padding: var(--spacing-lg);
}

.lineup-actions {
  display: flex;
  gap: var(--spacing-xs);
}

.no-lineup-tip {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  text-align: center;
  padding: var(--spacing-lg);
}

@media (max-width: 640px) {
  .apply-progress-stats {
    grid-template-columns: 1fr;
  }
}
</style>
