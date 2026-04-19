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
    <PeachInfoSummaryPanel
      :battle-info="battleInfo"
      :format-power="formatPower"
      :t="t"
    ></PeachInfoSummaryPanel>

    <!-- Loading State -->
    <div v-if="loading" class="loading-state">
      <NSpin size="large">
        <template #description>{{ t("peachInfo.states.loadingOpponent") }}</template>
      </NSpin>
    </div>

    <!-- Data Table -->
    <ClubMemberListPanel
      v-else-if="opponentMembers.length > 0"
      :empty-description="t('peachInfo.states.noOpponentData')"
      :is-mobile="isMobile"
      :mobile-items="peachMemberCards"
      :scroll-x="1200"
      :table-columns="columns"
      :table-data="opponentMembers"
      :title="t('peachInfo.table.title')"
      @select="handlePeachMemberSelect"
    ></ClubMemberListPanel>

    <!-- Empty State -->
    <div v-else class="empty-state">
      <NEmpty :description="t('peachInfo.states.noOpponentData')"></NEmpty>
    </div>

    <ClubMemberDetailModal
      club-label="俱乐部"
      hero-count-label="武将数量"
      hero-hole-label="开孔"
      hero-power-label="战力"
      hero-red-label="红数"
      hero-star-label="星级"
      holy-beast-label="四圣"
      holy-beast-level-label="四圣等级"
      power-label="战力"
      server-label="服务器"
      total-hole-label="总开孔"
      total-red-label="总红数"
      :close-text="t('peachInfo.common.close')"
      :format-power="formatPower"
      :hero-empty-text="t('peachInfo.heroes.empty')"
      :hero-list-empty-text="t('peachInfo.heroes.listEmpty')"
      :hero-list-undefined-text="t('peachInfo.heroes.listUndefined')"
      :hero-section-title="t('peachInfo.heroes.title')"
      :holy-beast-closed-text="t('peachInfo.heroes.holyBeastClosed')"
      :holy-beast-opened-text="t('peachInfo.heroes.holyBeastOpened')"
      :legacy-map="legacycolor"
      :none-text="t('peachInfo.common.none')"
      :player="playerInfo"
      :show="showPlayerInfoModal"
      :title="t('peachInfo.modals.playerInfoTitle')"
      :unknown-text="t('peachInfo.common.unknown')"
      @select-hero="selectHeroInfo"
      @update:show="showPlayerInfoModal = $event"
    >
      <template #actions>
        <PeachFightActionPanel
          :close-text="t('peachInfo.common.close')"
          :count-label="t('peachInfo.duel.countLabel')"
          :count-placeholder="t('peachInfo.duel.countPlaceholder')"
          :fight-count="fightCount"
          :is-fight-count-valid="isFightCountValid"
          :range-hint="t('peachInfo.duel.rangeHint')"
          :start-text="t('peachInfo.duel.start')"
          @close="showPlayerInfoModal = false"
          @start="handleDuel"
          @update:fight-count="fightCount = $event"
          @validate="validateFightCount"
        ></PeachFightActionPanel>
      </template>
      <template #status>
        <PeachFightProgressPanel
          v-if="fightProgress.visible"
          :percentage="fightProgress.percentage"
          :stats="fightProgressStats"
          :title="t('peachInfo.duel.inProgress')"
        ></PeachFightProgressPanel>

        <PeachFightResultPanel
          v-if="fightResult.visible"
          :battles="fightResult.resultCount"
          :close-text="t('peachInfo.duel.closeResult')"
          :format-battle-index="formatBattleIndexText"
          :format-die-text="formatBattleDieLabel"
          :format-power-text="formatBattlePowerLabel"
          :loss-text="t('peachInfo.duel.loss')"
          :retry-text="t('peachInfo.duel.retry')"
          :summary-items="peachFightSummaryItems"
          :title="t('peachInfo.duel.resultTitle')"
          :unknown-text="t('peachInfo.common.unknown')"
          :win-text="t('peachInfo.duel.win')"
          @close="fightResult.visible = false"
          @retry="resetFightResult"
        ></PeachFightResultPanel>
      </template>
    </ClubMemberDetailModal>

    <ClubRankHeroDetailModal
      :format-power="formatPower"
      :hero="heroModealTemp"
      :show="showHeroModal"
      @update:show="showHeroModal = $event"
    ></ClubRankHeroDetailModal>
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
  NButton,
  NEmpty,
  NIcon,
  NSpin,
  NTag,
  useMessage,
} from "naive-ui/es";
import { Copy, Refresh } from "@vicons/ionicons5";
import api from "@/api";
import { useTokenStore } from "@/stores/tokenStore";
import ClubMemberDetailModal from "./info/ClubMemberDetailModal.vue";
import ClubMemberListPanel from "./info/ClubMemberListPanel.vue";
import PeachInfoSummaryPanel from "./info/PeachInfoSummaryPanel.vue";
import PeachFightActionPanel from "./info/PeachFightActionPanel.vue";
import PeachFightProgressPanel from "./info/PeachFightProgressPanel.vue";
import PeachFightResultPanel from "./info/PeachFightResultPanel.vue";
import ClubRankHeroDetailModal from "./rank/ClubRankHeroDetailModal.vue";
import { downloadBlobAsImage } from "@/utils/imageExport";
import {
  getLineupType,
  HERO_DICT,
  HeroFillInfo,
  legacycolor,
  LINEUP_RULES,
} from "@/utils/HeroList";
import {
  buildClubMemberCardModel,
  buildClubMemberHeroChips,
  getClubMemberAvatarFallback,
} from "./info/clubMemberDisplayHelpers.js";
import { buildPeachFightSummaryItems } from "./info/clubInfoDisplayHelpers.js";
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

const fightProgressStats = computed(() => [
  t("peachInfo.duel.totalCount", { count: fightProgress.totalCount }),
  t("peachInfo.duel.completedCount", { count: fightProgress.completedCount }),
  t("peachInfo.duel.remainingCount", { count: fightProgress.remainingCount }),
  t("peachInfo.duel.winCount", { count: fightProgress.winCount }),
  t("peachInfo.duel.lossCount", { count: fightProgress.lossCount }),
]);

const peachFightSummaryItems = computed(() =>
  buildPeachFightSummaryItems({
    dieStats,
    fightResult,
    labels: {
      enemyDieRate: t("peachInfo.duel.summary.enemyDieRate"),
      lossCount: t("peachInfo.duel.summary.loss"),
      ourDieRate: t("peachInfo.duel.summary.ourDieRate"),
      totalCount: t("peachInfo.duel.summary.totalCount"),
      winCount: t("peachInfo.duel.summary.win"),
      winRate: t("peachInfo.duel.summary.winRate"),
    },
  }),
);

const formatBattleIndexText = (index) =>
  t("peachInfo.duel.battleIndex", { index: index + 1 });

const formatBattlePowerLabel = (value) =>
  t("peachInfo.labels.power", { value });

const formatBattleDieLabel = (count) =>
  t("peachInfo.duel.dieHeroCount", { count });

const toExportText = (value, maxLength, fallback = "-") => {
  const text = String(value ?? "").trim() || fallback;
  const chars = Array.from(text);
  return chars.length > maxLength ? chars.slice(0, maxLength).join("") : text;
};

const formatExportDateTime = (date = new Date()) => {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const normalizeAvatarExportUrl = (value) => {
  const raw = String(value || "")
    .replace(/`/g, "")
    .replace(/^["']+|["']+$/g, "")
    .trim();
  if (!raw) return "";
  if (raw.startsWith("//")) {
    return toExportText(`https:${raw}`, 2048, "");
  }
  if (raw.startsWith("/")) {
    const origin = typeof window !== "undefined" ? window.location?.origin : "";
    return toExportText(origin ? `${origin}${raw}` : raw, 2048, "");
  }
  return toExportText(raw, 2048, "");
};

const AVATAR_EXPORT_DATA_URL_MAX_BYTES = 60 * 1024;
const AVATAR_EXPORT_DATA_URL_TOTAL_BUDGET = 2 * 1024 * 1024;
const AVATAR_EXPORT_CONCURRENCY = 4;

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => resolve("");
    reader.readAsDataURL(blob);
  });

const fetchAvatarDataUrlForExport = async (avatarUrl) => {
  if (!avatarUrl || !/^https?:\/\//i.test(avatarUrl)) return "";
  try {
    const response = await fetch(avatarUrl, {
      credentials: "omit",
      mode: "cors",
      referrerPolicy: "no-referrer",
    });
    if (!response.ok) return "";
    const blob = await response.blob();
    const type = String(blob.type || "").split(";")[0].trim().toLowerCase();
    if (!["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(type)) {
      return "";
    }
    if (!blob.size || blob.size > AVATAR_EXPORT_DATA_URL_MAX_BYTES) {
      return "";
    }
    return await blobToDataUrl(blob);
  } catch {
    return "";
  }
};

const resolveExportAvatarDataUrls = async (members) => {
  const output = new Array(members.length).fill("");
  let cursor = 0;
  let totalSize = 0;
  const workers = Array.from(
    { length: Math.min(AVATAR_EXPORT_CONCURRENCY, members.length) },
    async () => {
      while (cursor < members.length) {
        const index = cursor;
        cursor += 1;
        if (totalSize >= AVATAR_EXPORT_DATA_URL_TOTAL_BUDGET) continue;
        const avatarDataUrl = await fetchAvatarDataUrlForExport(
          normalizeAvatarExportUrl(members[index]?.headImg),
        );
        if (!avatarDataUrl) continue;
        const nextSize = avatarDataUrl.length;
        if (totalSize + nextSize > AVATAR_EXPORT_DATA_URL_TOTAL_BUDGET) {
          continue;
        }
        totalSize += nextSize;
        output[index] = avatarDataUrl;
      }
    },
  );
  await Promise.all(workers);
  return output;
};

const buildPeachInfoExportPayload = async (exportedAt) => {
  const exportMembers = opponentMembers.value.slice(0, 220);
  const avatarDataUrls = await resolveExportAvatarDataUrls(exportMembers);
  const opponentClubName = battleInfo.value?.opponentClub?.name;
  const subtitle = opponentClubName
    ? `${opponentClubName} · ${queryDate.value}`
    : queryDate.value;

  return {
    clubName: "蟠桃园敌对情况",
    subtitle: toExportText(subtitle, 120, t("peachInfo.table.title")),
    exportedAt,
    memberCount: exportMembers.length,
    members: exportMembers.map((member, index) => ({
      index: index + 1,
      name: toExportText(member.name, 80, t("peachInfo.common.unknown")),
      roleId: toExportText(member.id, 64, "unknown"),
      powerText: toExportText(formatPower(member.power), 32),
      redQuenchText: toExportText(
        t("peachInfo.labels.redQuench", { count: member.redQuench || 0 }),
        32,
      ),
      lineupType: toExportText(
        member.lineupType || t("peachInfo.common.unknown"),
        32,
      ),
      jobLabel: "成员",
      avatarText: toExportText(getClubMemberAvatarFallback(member.name), 8, "?"),
      avatarUrl: normalizeAvatarExportUrl(member.headImg),
      avatarDataUrl: avatarDataUrls[index] || "",
    })),
  };
};

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

const peachMemberCards = computed(() =>
  opponentMembers.value.map((member) =>
    buildClubMemberCardModel({
      avatar: member.headImg,
      avatarText: getClubMemberAvatarFallback(member.name),
      badges: [
        {
          text: t("peachInfo.labels.redQuench", { count: member.redQuench || 0 }),
          type: "error",
        },
      ],
      chips: buildClubMemberHeroChips(
        member.heroList || [],
        (hero) => `${hero.heroName}(${hero.red})${hero.HolyBeast ? `[${hero.HBlevel}]` : ""}`,
      ),
      id: member.id,
      lineupTag: {
        color: getLineupTagColorProps(member.lineupType),
        text: member.lineupType || t("peachInfo.common.unknown"),
      },
      metrics: [
        {
          label: "战力",
          value: formatPower(member.power),
        },
      ],
      name: member.name,
      raw: member,
    }),
  ),
);

const handlePeachMemberSelect = ({ raw }) => {
  if (raw?.id != null) {
    fetchTargetInfo(raw.id);
  }
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
  const tokenId = tokenStore.selectedToken?.id;
  if (!tokenId) {
    message.warning("请先选择游戏角色");
    return;
  }
  if (!opponentMembers.value.length) {
    message.error(t("peachInfo.messages.exportTargetMissing"));
    return;
  }

  try {
    message.loading(t("peachInfo.messages.exportGenerating"));
    const exportedAt = formatExportDateTime();
    const payload = await buildPeachInfoExportPayload(exportedAt);
    const result = await api.gameFeatures.exportClubMembersImage(
      tokenId,
      payload,
    );
    if (!result?.success || !result.data) {
      throw new Error(result?.message || "后端图片生成失败");
    }
    const blob = new Blob([result.data], { type: "image/png" });
    const filenameBase = `${t("peachInfo.export.filenamePrefix")}_${queryDate.value.replace(/\//g, "-")}`;
    downloadBlobAsImage(blob, `${filenameBase}.png`);
    message.success(t("peachInfo.messages.exportSuccess"));
  } catch (err) {
    console.error("导出桃园敌方信息图片失败：", err);
    message.error(t("peachInfo.messages.exportFailed"));
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

.modal-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: var(--bg-secondary, #f9f9f9);
  border-top: 1px solid var(--border-light, #eee);
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

  .player-info-content {
    padding: 10px;
  }

  .player-info-main {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }

  .hero-list {
    grid-template-columns: 1fr;
  }

  .hero-item {
    padding: 10px;
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
