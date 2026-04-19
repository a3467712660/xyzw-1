<template>
  <div class="club-month-battle-records-container">
    <div class="club-month-battle-records-card">
      <!-- 头部信息区 -->
      <div class="header-section">
        <div class="header-left">
          <img
            alt="俱乐部图标"
            class="header-icon"
            src="/icons/moonPalace.png"
          >
          <div class="header-title">
            <h2>俱乐部盐场本月战绩</h2>
            <p>俱乐部盐场本月战斗记录详情</p>
          </div>
        </div>

        <!-- 功能操作区 -->
        <ClubBattleRecordToolbar
          :can-export="Object.keys(monthlyBattleRecords || {}).length > 0"
          :current-style="currentStyle"
          :loading="loading || isExporting"
          :show-date-picker="false"
          :style-options="styleOptions"
          @export="handleExport"
          @refresh="handleRefresh"
          @update:current-style="currentStyle = $event"
        >
          <template #right-prefix>
            <ClubBattleResultBadge
              tone="info"
              :text="`统计日期: ${currentMonthDisplay}`"
            ></ClubBattleResultBadge>
            <ClubBattleResultBadge
              tone="warning"
              :text="`总参战成员: ${monthlyStats.totalMembers}`"
            ></ClubBattleResultBadge>
          </template>
        </ClubBattleRecordToolbar>
      </div>

      <div class="battle-records-content">
        <!-- 加载状态 -->
        <div v-if="loading" class="loading-state">
          <n-spin size="large">
            <template #description>正在加载本月战绩数据...</template>
          </n-spin>
        </div>

        <!-- 本月战绩列表 -->
        <div
          ref="exportDom"
          v-else-if="
            monthlyBattleRecords && Object.keys(monthlyBattleRecords).length > 0
          "
          class="records-list"
        >
          <!-- Default Style -->
          <div v-if="currentStyle === 'default'">
            <!-- 本月统计概览 -->
            <div class="monthly-stats-overview">
              <div class="stats-header">
                <h3>本月统计概览</h3>
                <div class="stats-tags">
                  <n-tag type="info">统计日期: {{ currentMonthDisplay }}</n-tag>
                  <n-tag type="warning"
                    >总参战成员: {{ monthlyStats.totalMembers }}</n-tag
                  >
                </div>
              </div>
              <div class="stats-grid">
                <div class="stat-item">
                  <div class="stat-label">总击杀</div>
                  <div class="stat-value win">
                    {{ monthlyStats.totalKills }}
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">总死亡</div>
                  <div class="stat-value loss">
                    {{ monthlyStats.totalDeaths }}
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">总K/D</div>
                  <div class="stat-value KD">
                    {{
                      parseFloat(
                        monthlyStats.totalKills && monthlyStats.totalDeaths
                          ? monthlyStats.totalKills / monthlyStats.totalDeaths
                          : 0.0,
                      ).toFixed(2)
                    }}
                  </div>
                </div>
                <div class="stat-item">
                  <div class="stat-label">总复活丹</div>
                  <div class="stat-value Sscore">
                    {{ monthlyStats.totalResurrection }}
                  </div>
                </div>
              </div>
            </div>

            <!-- 成员总战绩列表 -->
            <div class="members-list">
              <h3>成员战绩详情</h3>
              <div class="members-table-wrapper">
                <table class="members-table">
                  <thead>
                    <tr>
                      <th class="rank-col">排名</th>
                      <th class="member-col">成员</th>
                      <th
                        v-for="date in battleDates"
                        :key="date"
                        class="battle-date-col"
                      >
                        <div class="date-label">
                          {{ formatShortDate(date) }}
                        </div>
                        <div class="date-full">{{ date }}</div>
                      </th>
                      <th class="total-col">本月总计</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr
                      v-for="(member, index) in sortedMembers"
                      :key="member.roleId"
                      class="member-row"
                    >
                      <td class="rank-col">{{ index + 1 }}</td>
                      <td class="member-col">
                        <div class="member-info">
                          <img
                            v-if="member.headImg"
                            class="member-avatar"
                            :alt="member.name"
                            :src="member.headImg"
                            @error="handleImageError"
                          >
                          <div v-else class="member-avatar-placeholder">
                            {{ member.name?.charAt(0) || "?" }}
                          </div>
                          <span class="member-name">{{ member.name }}</span>
                        </div>
                      </td>
                      <td
                        v-for="date in battleDates"
                        :key="date"
                        class="battle-date-col"
                      >
                        <div class="daily-stats">
                          <div class="stat-item win">
                            击杀:
                            {{ getMemberDailyStat(member, date, "winCnt") }}
                          </div>
                          <div class="stat-item loss">
                            死亡:
                            {{ getMemberDailyStat(member, date, "loseCnt") }}
                          </div>
                          <div class="stat-item KD">
                            KD:
                            {{
                              parseFloat(
                                getMemberDailyStat(member, date, "winCnt") &&
                                  getMemberDailyStat(member, date, "loseCnt")
                                  ? getMemberDailyStat(member, date, "winCnt") /
                                      getMemberDailyStat(
                                        member,
                                        date,
                                        "loseCnt",
                                      )
                                  : 0.0,
                              ).toFixed(2)
                            }}
                          </div>
                          <div class="stat-item Sscore">
                            复活丹:
                            {{
                              Math.max(
                                (getMemberDailyStat(member, date, "loseCnt") ||
                                  0) - 6,
                                0,
                              )
                            }}
                          </div>
                        </div>
                      </td>
                      <td class="total-col">
                        <div class="total-stats">
                          <div class="stat-item win">
                            击杀: {{ member.totalWinCnt || 0 }}
                          </div>
                          <div class="stat-item loss">
                            死亡: {{ member.totalLoseCnt || 0 }}
                          </div>
                          <div class="stat-item KD">
                            KD:
                            {{
                              parseFloat(
                                member.totalWinCnt && member.totalLoseCnt
                                  ? member.totalWinCnt / member.totalLoseCnt
                                  : 0.0,
                              ).toFixed(2)
                            }}
                          </div>
                          <div class="stat-item Sscore">
                            复活丹: {{ member.totalResurrection || 0 }}
                          </div>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <!-- Style 1 -->
          <div v-else-if="currentStyle === 'style1'" class="style-1">
            <div class="style1-header">
              <h2>
                {{ currentMonthDisplay }} {{ club?.name || "俱乐部" }}盐场月报
              </h2>
            </div>

            <div class="style1-content">
              <ClubBattleRecordTable
                variant="style1"
                :get-death-color="getDeathColor"
                :get-kill-color="getKillColor"
                :get-occupy-color="getOccupyColor"
                :get-revive-color="getReviveColor"
                :rows="monthlyPlayerRows"
                @image-error="handleImageError"
              ></ClubBattleRecordTable>

              <!-- 右侧统计 -->
              <div class="style1-summary">
                <ClubBattleSummaryPanel
                  :rank-panels="monthlySummaryPanels"
                  :stats="monthlySummaryStats"
                  @image-error="handleImageError"
                ></ClubBattleSummaryPanel>
              </div>
            </div>
          </div>

          <!-- Style 2 -->
          <div v-else-if="currentStyle === 'style2'" class="style-2">
            <div class="style2-header">
              <div class="style2-title">
                <span class="trophy-icon">🏆</span>
                <div class="title-text">
                  <h2>{{ club?.name || "俱乐部" }} 盐场月报</h2>
                  <div class="date-text">{{ currentMonthDisplay }}</div>
                </div>
              </div>
            </div>

            <ClubBattleStatsPanel
              :mvp="style2Mvp"
              :stat-rows="style2StatRows"
              @image-error="handleImageError"
            ></ClubBattleStatsPanel>

            <ClubBattleTopRanksPanel
              :cards="style2TopRankCards"
              @image-error="handleImageError"
            ></ClubBattleTopRanksPanel>

            <ClubBattleRecordTable
              variant="style2"
              :get-death-color="getDeathColor"
              :get-kill-color="getKillColor"
              :get-occupy-color="getOccupyColor"
              :get-revive-color="getReviveColor"
              :max-deaths="monthlyMaxDeaths"
              :max-kills="monthlyMaxKills"
              :max-occupies="monthlyMaxOccupies"
              :rows="monthlyPlayerRows"
              @image-error="handleImageError"
            ></ClubBattleRecordTable>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <n-empty description="暂无战绩数据" size="large">
            <template #icon>
              <n-icon>
                <DocumentText></DocumentText>
              </n-icon>
            </template>
          </n-empty>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import ClubBattleSummaryPanel from "@/components/Club/records/ClubBattleSummaryPanel.vue";
import ClubBattleRecordTable from "@/components/Club/records/ClubBattleRecordTable.vue";
import ClubBattleRecordToolbar from "@/components/Club/records/ClubBattleRecordToolbar.vue";
import ClubBattleResultBadge from "@/components/Club/records/ClubBattleResultBadge.vue";
import ClubBattleStatsPanel from "@/components/Club/records/ClubBattleStatsPanel.vue";
import ClubBattleTopRanksPanel from "@/components/Club/records/ClubBattleTopRanksPanel.vue";
import {
  buildClubBattleStatItems,
  buildClubBattleTopPanels,
} from "@/components/Club/records/clubBattleRecordDisplayHelpers.js";
import {
  buildClubBattleDashboardStatRows,
  buildClubBattleMvpModel,
  buildClubBattleTopRankCards,
} from "@/components/Club/records/clubBattleRecordStatsHelpers.js";
import {
  formatClubBattleKD,
  formatClubBattleShortDate,
  getClubBattleDeathColor,
  getClubBattleKillColor,
  getClubBattleOccupyColor,
  getClubBattleReviveColor,
} from "@/components/Club/records/clubBattleRecordFormatters.js";
import {
  getClubBattleTopRows,
  normalizeClubBattleRows,
} from "@/components/Club/records/useClubBattleRecordRows.js";
import api from "@/api";
import { useTokenStore } from "@/stores/tokenStore";
import { downloadBlobAsImage } from "@/utils/imageExport";
import { resolveExportAvatarDataUrls } from "@/utils/exportAvatarDataUrls";
import {
  getStringPreference,
  setStringPreference,
} from "@/services/preferences/localPreferences";
import { DocumentText } from "@vicons/ionicons5";

defineProps({
  inline: {
    type: Boolean,
    default: false,
  },
});

const exportDom = ref(null);
const message = useMessage();
const tokenStore = useTokenStore();

const loading = ref(false);
const isExporting = ref(false);
const monthlyBattleRecords = ref({});
const battleDates = ref([]);

const toExportText = (value, maxLength = 32, fallback = "-") => {
  const text = String(value ?? "").trim() || fallback;
  return Array.from(text).slice(0, maxLength).join("");
};

const getAvatarFallback = (name) =>
  Array.from(String(name || "?").trim() || "?").slice(0, 2).join("");

const formatExportDateTime = (date = new Date()) => {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

// 计算当月的5个战斗日期
const getCurrentMonthBattleDates = () => {
  const dateObj = new Date();

  const dates = [];
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth();

  // 获取本月的所有周六
  const saturdays = [];
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  for (let i = firstDay.getDate(); i <= lastDay.getDate(); i++) {
    const currentDate = new Date(year, month, i);
    if (currentDate.getDay() === 6) {
      // 6 = 周六
      saturdays.push(currentDate);
    }
  }

  // 取前4个周六
  for (let i = 0; i < Math.min(4, saturdays.length); i++) {
    dates.push(saturdays[i]);
  }

  // 计算第四周的周日
  if (saturdays.length >= 4) {
    const fourthSaturday = saturdays[3];
    const fourthSunday = new Date(fourthSaturday);
    fourthSunday.setDate(fourthSunday.getDate() + 1);
    dates.push(fourthSunday);
  }

  // 格式化日期为 YYYY/MM/DD
  const formattedDates = dates.map((date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}/${m}/${d}`;
  });

  // 过滤掉当前日期之后的战斗日期
  const currentDate = new Date();
  const currentDateStr = `${currentDate.getFullYear()}/${String(currentDate.getMonth() + 1).padStart(2, "0")}/${String(currentDate.getDate()).padStart(2, "0")}`;

  return formattedDates.filter((date) => date <= currentDateStr);
};

// 格式化短日期显示 (MM/DD)
const formatShortDate = formatClubBattleShortDate;

// 本月统计数据
const monthlyStats = computed(() => {
  const stats = {
    totalMembers: 0,
    totalKills: 0,
    totalDeaths: 0,
    totalResurrection: 0,
    totalBuilding: 0,
  };

  if (
    !monthlyBattleRecords.value ||
    Object.keys(monthlyBattleRecords.value).length === 0
  ) {
    return stats;
  }

  // 计算所有成员的统计数据
  const memberStats = {};

  Object.values(monthlyBattleRecords.value).forEach((dailyRecords) => {
    if (dailyRecords && dailyRecords.roleDetailsList) {
      dailyRecords.roleDetailsList.forEach((member) => {
        if (!memberStats[member.roleId]) {
          memberStats[member.roleId] = {
            roleId: member.roleId,
            name: member.name,
            headImg: member.headImg,
            totalWinCnt: 0,
            totalLoseCnt: 0,
            totalResurrection: 0,
            totalBuildingCnt: 0,
            dailyRecords: {},
          };
        }

        memberStats[member.roleId].totalWinCnt += member.winCnt || 0;
        memberStats[member.roleId].totalLoseCnt += member.loseCnt || 0;
        memberStats[member.roleId].totalBuildingCnt += member.buildingCnt || 0;
        memberStats[member.roleId].totalResurrection += Math.max(
          (member.loseCnt || 0) - 6,
          0,
        );

        // 保存每日记录
        memberStats[member.roleId].dailyRecords[dailyRecords.date] = member;
      });
    }
  });

  // 计算总统计
  stats.totalMembers = Object.keys(memberStats).length;

  Object.values(memberStats).forEach((member) => {
    stats.totalKills += member.totalWinCnt;
    stats.totalDeaths += member.totalLoseCnt;
    stats.totalResurrection += member.totalResurrection;
    stats.totalBuilding += member.totalBuildingCnt;
  });

  return stats;
});

const monthlySummaryStats = computed(() =>
  buildClubBattleStatItems([
    { label: "总人数", value: monthlyStats.value.totalMembers },
    { label: "总击杀", value: monthlyStats.value.totalKills },
    { label: "总死亡", value: monthlyStats.value.totalDeaths },
    { label: "总复活丹", value: monthlyStats.value.totalResurrection },
    {
      label: "总 K/D",
      value: formatClubBattleKD(
        monthlyStats.value.totalKills,
        monthlyStats.value.totalDeaths,
      ),
    },
  ]),
);

// 获取成员每日统计数据
const getMemberDailyStat = (member, date, statType) => {
  if (member.dailyRecords && member.dailyRecords[date]) {
    return member.dailyRecords[date][statType] || 0;
  }
  return 0;
};

// 排序后的成员列表
const sortedMembers = computed(() => {
  const memberStats = {};

  if (
    !monthlyBattleRecords.value ||
    Object.keys(monthlyBattleRecords.value).length === 0
  ) {
    return [];
  }

  // 收集所有成员数据
  Object.values(monthlyBattleRecords.value).forEach((dailyRecords) => {
    if (dailyRecords && dailyRecords.roleDetailsList) {
      dailyRecords.roleDetailsList.forEach((member) => {
        if (!memberStats[member.roleId]) {
          memberStats[member.roleId] = {
            roleId: member.roleId,
            name: member.name,
            headImg: member.headImg,
            totalWinCnt: 0,
            totalLoseCnt: 0,
            totalBuildingCnt: 0,
            totalResurrection: 0,
            dailyRecords: {},
          };
        }

        memberStats[member.roleId].totalWinCnt += member.winCnt || 0;
        memberStats[member.roleId].totalLoseCnt += member.loseCnt || 0;
        memberStats[member.roleId].totalBuildingCnt += member.buildingCnt || 0;
        memberStats[member.roleId].totalResurrection += Math.max(
          (member.loseCnt || 0) - 6,
          0,
        );

        // 保存每日记录
        memberStats[member.roleId].dailyRecords[dailyRecords.date] = member;
      });
    }
  });

  // 按击杀数排序
  return Object.values(memberStats).sort(
    (a, b) => b.totalWinCnt - a.totalWinCnt,
  );
});

const monthlyPlayerRows = computed(() =>
  normalizeClubBattleRows(sortedMembers.value, {
    deathGetter: (member) => member.totalLoseCnt || 0,
    extraGetter: (member) => ({
      dailyRecords: member.dailyRecords || {},
      headImg: member.headImg || "",
      roleId: member.roleId,
      survivalCnt: member.totalLoseCnt || 0,
      totalBuildingCnt: member.totalBuildingCnt || 0,
      totalLoseCnt: member.totalLoseCnt || 0,
      totalResurrection: member.totalResurrection || 0,
      totalWinCnt: member.totalWinCnt || 0,
    }),
    killGetter: (member) => member.totalWinCnt || 0,
    occupyGetter: (member) => member.totalBuildingCnt || 0,
    reviveGetter: (member) => member.totalResurrection || 0,
  }),
);

// Style 1 & 2 Support Logic
const currentStyle = ref(
  getStringPreference("club_month_battle_records_style", "default"),
);

const styleOptions = [
  { label: "默认", value: "default" },
  { label: "样式一", value: "style1" },
  { label: "样式二", value: "style2" },
];

watch(currentStyle, (newStyle) => {
  setStringPreference("club_month_battle_records_style", newStyle);
});

const club = computed(() => {
  // Try to get club info from store if available, otherwise mock or empty
  return tokenStore.gameData?.legionInfo?.info || { name: "俱乐部" };
});

const totalWinRate = computed(() => {
  const kills = monthlyStats.value.totalKills;
  const deaths = monthlyStats.value.totalDeaths;
  if (kills + deaths === 0) return "0.0";
  return ((kills / (kills + deaths)) * 100).toFixed(1);
});

const avgKills = computed(() => {
  if (!sortedMembers.value || sortedMembers.value.length === 0) return 0;
  return (monthlyStats.value.totalKills / sortedMembers.value.length).toFixed(
    1,
  );
});

const monthlyMvpPlayer = computed(() => {
  if (!monthlyPlayerRows.value || monthlyPlayerRows.value.length === 0) return null;
  return monthlyPlayerRows.value[0];
});

// Rank Computeds
const monthlyKillRank = computed(() =>
  getClubBattleTopRows(monthlyPlayerRows.value, "killCnt"),
);
const monthlyOccupyRank = computed(() =>
  getClubBattleTopRows(monthlyPlayerRows.value, "occupyCnt"),
);
const monthlyReviveRank = computed(() =>
  getClubBattleTopRows(monthlyPlayerRows.value, "reviveCnt"),
);
const monthlyDeathRank = computed(() =>
  getClubBattleTopRows(monthlyPlayerRows.value, "deathCnt"),
);

const monthlyKDRank = computed(() => {
  return getClubBattleTopRows(monthlyPlayerRows.value, "kd");
});

const monthlySurvivalRank = computed(() => {
  return [...monthlyPlayerRows.value]
    .filter((p) => p.killCnt > 0 || p.occupyCnt > 0)
    .sort((a, b) => (a.deathCnt || 0) - (b.deathCnt || 0))
    .slice(0, 3)
    .map((p) => ({ ...p, survivalCnt: p.deathCnt }));
});

const style2StatRows = computed(() =>
  buildClubBattleDashboardStatRows({
    avgKills: avgKills.value,
    totalBuilding: monthlyStats.value.totalBuilding,
    totalDeaths: monthlyStats.value.totalDeaths,
    totalKills: monthlyStats.value.totalKills,
    totalKD: formatClubBattleKD(
      monthlyStats.value.totalKills,
      monthlyStats.value.totalDeaths,
    ),
    totalMembers: monthlyStats.value.totalMembers,
    totalRevives: monthlyStats.value.totalResurrection,
    totalWinRate: totalWinRate.value,
  }),
);

const style2Mvp = computed(() =>
  buildClubBattleMvpModel(monthlyMvpPlayer.value, {
    label: "本月 MVP",
  }),
);

const style2TopRankCards = computed(() =>
  buildClubBattleTopRankCards({
    deathRank: monthlyDeathRank.value,
    kdRank: monthlyKDRank.value,
    killRank: monthlyKillRank.value,
    occupyRank: monthlyOccupyRank.value,
    reviveRank: monthlyReviveRank.value,
    survivalRank: monthlySurvivalRank.value,
  }),
);

const monthlySummaryPanels = computed(() =>
  buildClubBattleTopPanels([
    {
      items: monthlyKillRank.value,
      keyPrefix: "kill",
      title: "击杀前3",
      valueKey: "killCnt",
    },
    {
      items: monthlyOccupyRank.value,
      keyPrefix: "occupy",
      title: "攻城前3",
      valueKey: "occupyCnt",
    },
    {
      items: monthlyKDRank.value,
      keyPrefix: "kd",
      title: "KD 前3",
      valueKey: "kd",
    },
    {
      items: monthlyReviveRank.value,
      keyPrefix: "revive",
      title: "复活丹前3",
      valueKey: "reviveCnt",
    },
  ]),
);

// Max values for progress bars
const monthlyMaxKills = computed(() =>
  Math.max(...(sortedMembers.value.map((p) => p.totalWinCnt || 0) || [0])),
);
const monthlyMaxDeaths = computed(() =>
  Math.max(...(sortedMembers.value.map((p) => p.totalLoseCnt || 0) || [0])),
);
const monthlyMaxOccupies = computed(() =>
  Math.max(...(sortedMembers.value.map((p) => p.totalBuildingCnt || 0) || [0])),
);

const getPercent = (val, max) => {
  if (!max) return 0;
  return Math.min(100, (val / max) * 100);
};

// Colors
const getKillColor = (val) =>
  getClubBattleKillColor(val, { high: 200, medium: 80 });

const getOccupyColor = (val) =>
  getClubBattleOccupyColor(val, { high: 200, medium: 100 });

const getDeathColor = (val) =>
  getClubBattleDeathColor(val, { high: 80, medium: 40 });

const getReviveColor = (val) =>
  getClubBattleReviveColor(val, { high: 40 });

// 当前月份显示
const currentMonthDisplay = computed(() => {
  const dateObj = new Date();
  const year = dateObj.getFullYear();
  const month = dateObj.getMonth() + 1;
  return `${year}年${month}月`;
});

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = "none";
};

// 查询单日战绩
const fetchBattleRecords = async (date) => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择游戏角色");
    return null;
  }

  const tokenId = tokenStore.selectedToken.id;

  // 检查WebSocket连接
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error("WebSocket未连接，无法查询战绩");
    return null;
  }

  try {
    const result = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legionwar_getdetails",
      { date },
      10000,
    );

    if (result && result.roleDetailsList) {
      // 按击杀数从高到低排序
      const sortedRoleDetailsList = [...result.roleDetailsList].sort((a, b) => {
        return (b.winCnt || 0) - (a.winCnt || 0);
      });
      return {
        ...result,
        roleDetailsList: sortedRoleDetailsList,
        date,
      };
    } else {
      return {
        roleDetailsList: [],
        date,
      };
    }
  } catch (error) {
    console.error(`查询${date}战绩失败:`, error);
    message.error(`查询${date}战绩失败: ${error.message}`);
    return {
      roleDetailsList: [],
      date,
    };
  }
};

// 查询本月战绩
const fetchMonthlyBattleRecords = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择游戏角色");
    return;
  }

  const tokenId = tokenStore.selectedToken.id;
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error("WebSocket未连接，无法查询战绩");
    return;
  }

  loading.value = true;

  try {
    // 获取本月5个战斗日期
    battleDates.value = getCurrentMonthBattleDates();

    // 并行获取所有日期的战绩
    const promises = battleDates.value.map((date) => fetchBattleRecords(date));
    const results = await Promise.all(promises);

    // 整理结果
    const records = {};
    results.forEach((result) => {
      if (result) {
        records[result.date] = result;
      }
    });

    monthlyBattleRecords.value = records;
    message.success("本月战绩加载成功");
  } catch (error) {
    console.error("查询本月战绩失败:", error);
    message.error(`查询本月战绩失败: ${error.message}`);
    monthlyBattleRecords.value = {};
  } finally {
    loading.value = false;
  }
};

// 刷新战绩
const handleRefresh = () => {
  fetchMonthlyBattleRecords();
};

// 导出战绩
const handleExport = async () => {
  if (
    !monthlyBattleRecords.value ||
    Object.keys(monthlyBattleRecords.value).length === 0
  ) {
    message.warning("没有可导出的数据");
    return;
  }

  try {
    await exportToImage();
    message.success("导出成功");
  } catch (error) {
    console.error("导出失败:", error);
    message.error("导出失败，请重试");
  }
};

const buildMonthlyBattleReportExportRows = async () => {
  const rows = monthlyPlayerRows.value.slice(0, 220);
  const avatarDataUrls = await resolveExportAvatarDataUrls(rows, {
    urlGetter: (row) => row.avatar,
  });
  return rows.map((row, index) => ({
    index: index + 1,
    name: toExportText(row.name, 80, "未知成员"),
    roleId: toExportText(row.roleId || row.raw?.roleId || row.key, 64),
    avatarText: toExportText(getAvatarFallback(row.name), 8, "?"),
    avatarUrl: toExportText(row.avatar, 2048, ""),
    avatarDataUrl: avatarDataUrls[index] || "",
    killText: toExportText(row.killCnt, 32, "0"),
    metric2Text: toExportText(row.deathCnt, 32, "0"),
    metric3Text: toExportText(row.occupyCnt, 32, "0"),
    kdText: toExportText(row.kd, 32, "0.00"),
    reviveText: toExportText(row.reviveCnt, 32, "0"),
    noteText: toExportText(`复活丹 ${row.reviveCnt || 0}`, 32),
  }));
};

const buildMonthlyBattleReportExportPayload = async (exportedAt) => {
  const rows = await buildMonthlyBattleReportExportRows();
  const clubName = club.value?.name || "俱乐部";
  const totalKDText = formatClubBattleKD(
    monthlyStats.value.totalKills,
    monthlyStats.value.totalDeaths,
  );
  return {
    reportType: "salt-field",
    title: `${currentMonthDisplay.value} ${clubName}盐场月战报`,
    subtitle: `${clubName} · 盐场月战绩总览`,
    reportDate: currentMonthDisplay.value,
    exportedAt,
    badgeLabel: "总 K/D",
    badgeValue: totalKDText,
    sections: [
      {
        title: `${clubName} 盐场月战报明细`,
        subtitle: `统计 ${battleDates.value.length} 个战斗日 · 共 ${rows.length} 人`,
        tone: "salt",
        layout: "tactical",
        statusLabel: "总 K/D",
        statusValue: totalKDText,
        primaryLabel: "击杀",
        metric2Label: "死亡",
        metric3Label: "攻城",
        metrics: [
          {
            label: "总击杀",
            meta: "",
            value: String(monthlyStats.value.totalKills),
          },
          {
            label: "总死亡",
            meta: "",
            value: String(monthlyStats.value.totalDeaths),
          },
          {
            label: "总攻城",
            meta: "",
            value: String(monthlyStats.value.totalBuilding),
          },
          {
            label: "总胜率",
            meta: "击杀 / 击杀+死亡",
            value: `${totalWinRate.value}%`,
          },
        ],
        rankPanels: [
          {
            key: "kill",
            title: "击杀尖兵",
            items: monthlyKillRank.value.map((item) => ({
              name: toExportText(item.name, 80, "未知成员"),
              value: toExportText(item.killCnt, 32, "0"),
            })),
          },
          {
            key: "occupy",
            title: "攻城骨干",
            items: monthlyOccupyRank.value.map((item) => ({
              name: toExportText(item.name, 80, "未知成员"),
              value: toExportText(item.occupyCnt, 32, "0"),
            })),
          },
          {
            key: "kd",
            title: "K/D前三",
            items: monthlyKDRank.value.map((item) => ({
              name: toExportText(item.name, 80, "未知成员"),
              value: toExportText(item.kd, 32, "0"),
            })),
          },
          {
            key: "revive",
            title: "复活消耗",
            items: monthlyReviveRank.value.map((item) => ({
              name: toExportText(item.name, 80, "未知成员"),
              value: toExportText(item.reviveCnt, 32, "0"),
            })),
          },
        ],
        stats: [
          { label: "参战人数", value: String(rows.length) },
          { label: "总击杀", value: String(monthlyStats.value.totalKills) },
          { label: "总死亡", value: String(monthlyStats.value.totalDeaths) },
          { label: "总攻城", value: String(monthlyStats.value.totalBuilding) },
          { label: "总复活丹", value: String(monthlyStats.value.totalResurrection) },
          {
            label: "总 K/D",
            value: totalKDText,
          },
        ],
        rows,
      },
    ],
  };
};

const exportToImage = async () => {
  const tokenId = tokenStore.selectedToken?.id;
  if (!tokenId) {
    throw new Error("请先选择游戏角色");
  }

  try {
    isExporting.value = true;
    message.loading("正在生成战报图片，请稍候...");
    const exportedAt = formatExportDateTime();
    const result = await api.battleReports.exportImage(
      tokenId,
      await buildMonthlyBattleReportExportPayload(exportedAt),
    );
    if (!result?.success || !result.data) {
      throw new Error(result?.message || "后端图片生成失败");
    }
    const blob = new Blob([result.data], { type: "image/png" });
    const monthYear = currentMonthDisplay.value
      .replace("年", "-")
      .replace("月", "");
    const filename = `${monthYear}月盐场战绩总览.png`;
    downloadBlobAsImage(blob, filename);
  } catch (err) {
    console.error("后端生成月战绩图片失败：", err);
    throw new Error("导出图片失败，请重试");
  } finally {
    isExporting.value = false;
  }
};

// 暴露方法给父组件
defineExpose({
  fetchMonthlyBattleRecords,
});

// 组件挂载时自动拉取数据
onMounted(() => {
  fetchMonthlyBattleRecords();
});
</script>

<style scoped lang="scss">
.club-month-battle-records-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.club-month-battle-records-card {
  background: var(--bg-primary);
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--border-light);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--border-light);
  flex-wrap: wrap;
  gap: var(--spacing-md);
}

.header-left {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.header-icon {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.header-title h2 {
  margin: 0;
  font-size: var(--font-size-xl);
  font-weight: var(--font-weight-bold);
}

.header-title p {
  margin: 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

.header-actions {
  display: flex;
  gap: var(--spacing-sm);
  align-items: center;
}

.battle-records-content {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-md);
}

.loading-state,
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

// 本月统计概览样式
.monthly-stats-overview {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--spacing-md);
  flex-wrap: wrap;
  gap: var(--spacing-sm);
}

.stats-header h3 {
  margin: 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.stats-tags {
  display: flex;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--spacing-md);
}

.stat-item {
  text-align: center;
  padding: var(--spacing-md);
  background: var(--bg-primary);
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--border-light);
}

.stat-label {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  margin-bottom: var(--spacing-xs);
}

.stat-value {
  font-size: var(--font-size-2xl);
  font-weight: var(--font-weight-bold);

  &.win {
    color: #059669;
  }

  &.loss {
    color: #dc2626;
  }

  &.siege {
    color: #d97706;
  }

  &.KD {
    color: #858585;
  }

  &.Sscore {
    color: #fa79ce;
  }
}

.members-list {
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.members-list h3 {
  margin: 0 0 var(--spacing-md) 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-semibold);
}

.members-table-wrapper {
  overflow-x: auto;
  border-radius: var(--border-radius-medium);
  border: 1px solid var(--border-light);
  background: var(--bg-primary);
}

.members-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.members-table th,
.members-table td {
  padding: var(--spacing-sm);
  border-bottom: 1px solid var(--border-light);
}

.members-table th {
  background: var(--bg-secondary);
  font-weight: var(--font-weight-semibold);
  position: sticky;
  top: 0;
  z-index: 10;
}

.rank-col {
  width: 60px;
  text-align: center;
}

.member-col {
  min-width: 150px;
}

.battle-date-col {
  min-width: 120px;
  text-align: center;
}

.total-col {
  min-width: 120px;
  text-align: center;
  font-weight: var(--font-weight-bold);
}

.date-label {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.date-full {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.member-row {
  transition: background-color var(--transition-fast);

  &:hover {
    background-color: var(--bg-secondary);
  }
}

.member-info {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
}

.member-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.member-avatar-placeholder {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

.member-name {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.daily-stats,
.total-stats {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.daily-stats .stat-item,
.total-stats .stat-item {
  padding: 2px 0;
  font-size: var(--font-size-xs);
  text-align: center;
  border-radius: 0;
  border: none;
  background: transparent;

  &.win {
    color: #059669;
  }

  &.loss {
    color: #dc2626;
  }

  &.siege {
    color: #d97706;
  }

  &.KD {
    color: #858585;
  }

  &.Sscore {
    color: #fa79ce;
  }
}

/* 移除总计列字体大小覆盖，保持与日期列一致 */
/* .total-stats .stat-item {
  font-size: var(--font-size-sm);
} */

// 响应式设计
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .stats-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .members-table-wrapper {
    font-size: var(--font-size-xs);
  }

  .member-avatar,
  .member-avatar-placeholder {
    width: 24px;
    height: 24px;
  }

  .daily-stats .stat-item,
  .total-stats .stat-item {
    font-size: 10px;
  }

  .header-section {
    flex-direction: column;
    align-items: flex-start;
  }

  .header-actions {
    width: 100%;
    flex-wrap: wrap;
  }
}

/* ================== 样式一 (Style 1) ================== */
.style-1 {
  background: #fff;
  padding: var(--spacing-md);
  color: #333;
  font-family: Arial, sans-serif;
}

.style1-header h2 {
  text-align: center;
  font-size: 20px;
  margin-bottom: 20px;
  font-weight: bold;
  padding: 10px;
  background: #f3f3f3;
  border-bottom: 3px solid #800080;
}

.style1-content {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.style1-table-container {
  flex: 2;
  overflow-x: auto;
}

.style1-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.style1-table th {
  background: #800080;
  color: #fff;
  padding: 8px;
  text-align: center;
  font-weight: bold;
}

.style1-table td {
  padding: 6px;
  border-bottom: 1px solid #eee;
  text-align: center;
  vertical-align: middle;
  height: 36px;
}

.stat-bg-cell {
  background-color: var(--cell-bg);
}

.style1-table tr:nth-child(even) {
  background-color: #f9f9f9;
}

.col-rank {
  width: 60px;
}
.col-name {
  text-align: left !important;
  padding-left: 10px !important;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 5px;
}

.player-avatar-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}
.player-avatar-placeholder-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ccc;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
}

.rank-medal {
  font-size: 16px;
}

.style1-summary {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-width: 250px;
}

.summary-card {
  border: 1px solid #ccc;
  border-radius: 4px;
  overflow: hidden;
}

.summary-title {
  background: #800080;
  color: #fff;
  padding: 8px;
  font-weight: bold;
  text-align: center;
}

.purple-header .summary-title {
  background: #800080;
}

.summary-item {
  display: flex;
  justify-content: space-between;
  padding: 8px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.top3-item {
  display: flex;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #eee;
  font-size: 13px;
}

.top3-rank {
  width: 30px;
  text-align: center;
}
.rank-medal-small {
  font-size: 14px;
}

.top3-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
}
.player-avatar-xs {
  width: 20px;
  height: 20px;
  border-radius: 50%;
}
.player-avatar-placeholder-xs {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #ccc;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
}
.top3-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 80px;
}

.top3-value {
  font-weight: bold;
}

/* ================== 样式二 (Style 2) ================== */
.style-2 {
  background: #f0f2f5;
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  color: #333;
}

.style2-header {
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 20px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.style2-title {
  display: flex;
  align-items: center;
  gap: 15px;
}
.trophy-icon {
  font-size: 40px;
}
.title-text h2 {
  margin: 0;
  font-size: 24px;
  color: white;
}
.date-text {
  opacity: 0.9;
  font-size: 14px;
  margin-top: 5px;
  color: rgba(255, 255, 255, 0.8);
}

.style2-dashboard {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.dashboard-stats {
  flex: 3;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.stat-card-row {
  display: flex;
  gap: 15px;
}

.stat-card-mini {
  flex: 1;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  text-align: center;
}
.stat-label-mini {
  font-size: 12px;
  color: #888;
  margin-bottom: 5px;
}
.stat-value-mini {
  font-size: 18px;
  font-weight: bold;
  color: #333;
}
.danger-text {
  color: #f5222d;
}
.warning-text {
  color: #fa8c16;
}
.purple-text {
  color: #722ed1;
}

.dashboard-mvp {
  flex: 1;
  background: linear-gradient(180deg, #fff 0%, #fffbf0 100%);
  border: 2px solid #ffd591;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  position: relative;
  box-shadow: 0 4px 12px rgba(250, 173, 20, 0.2);
}

.mvp-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  border: 3px solid #ffd591;
  object-fit: cover;
}
.mvp-avatar-placeholder {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: #ffd591;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30px;
  border: 3px solid #d48806;
}
.mvp-crown {
  font-size: 30px;
  position: absolute;
  top: -15px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}
.mvp-name {
  font-size: 16px;
  font-weight: bold;
  margin-top: 10px;
  color: #d48806;
}
.mvp-label {
  font-size: 12px;
  background: #d48806;
  color: white;
  padding: 2px 8px;
  border-radius: 10px;
  margin-top: 5px;
}

.style2-rankings-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
  margin-bottom: 20px;
}

.rank-card-s2 {
  background: white;
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  border-top: 3px solid #ccc;
}
.red-border {
  border-top-color: #f5222d;
}
.orange-border {
  border-top-color: #fa8c16;
}
.green-border {
  border-top-color: #52c41a;
}
.gray-border {
  border-top-color: #8c8c8c;
}
.purple-border {
  border-top-color: #722ed1;
}
.blue-border {
  border-top-color: #1890ff;
}

.rank-card-title-s2 {
  font-weight: bold;
  font-size: 14px;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.rank-list-s2 {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.rank-item-s2 {
  display: flex;
  align-items: center;
  font-size: 12px;
}
.rank-num-s2 {
  width: 20px;
  font-weight: bold;
  color: #888;
}
.rank-player-s2 {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  overflow: hidden;
}
.avatar-xxs {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}
.rank-player-s2 .name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.rank-val-s2 {
  font-weight: bold;
}
.rank-val-s2.red {
  color: #f5222d;
}
.rank-val-s2.orange {
  color: #fa8c16;
}
.rank-val-s2.green {
  color: #52c41a;
}
.rank-val-s2.gray {
  color: #8c8c8c;
}
.rank-val-s2.purple {
  color: #722ed1;
}
.rank-val-s2.blue {
  color: #1890ff;
}

.style2-table-wrapper {
  background: #fff;
  padding: 0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
  margin-top: 20px;
}

.style2-table {
  width: 100%;
  border-collapse: collapse;
}

.style2-table thead {
  background: #4285f4;
}

.style2-table th {
  color: #fff;
  padding: 12px 8px;
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  border: none;
}

/* Specific alignment for table headers */
.style2-table th:nth-child(2) {
  text-align: left;
  padding-left: 20px;
} /* Member name */

.style2-table td {
  padding: 10px 8px;
  border-bottom: 1px solid #f1f1f1;
  vertical-align: middle;
  text-align: center;
  font-size: 13px;
  color: #444;
}

.style2-table tr:hover {
  background: #f8fbff;
}

.medal-icon {
  font-size: 18px;
}
.rank-num-plain {
  color: #888;
  padding-left: 5px;
}

.player-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  padding-left: 10px;
}
.avatar-xs {
  width: 28px;
  height: 28px;
  border-radius: 50%;
}
.avatar-placeholder-xs {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e6f7ff;
  color: #1890ff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
}
.player-name-s2 {
  font-weight: 500;
}

.bar-cell {
  display: flex;
  flex-direction: column;
  width: 100px;
  margin: 0 auto;
}
.bar-val {
  font-size: 12px;
  margin-bottom: 2px;
  font-weight: bold;
  text-align: left;
}
.bar-val.red {
  color: #f5222d;
}
.bar-val.gray {
  color: #8c8c8c;
}
.bar-val.orange {
  color: #fa8c16;
}

.progress-bg {
  height: 4px;
  background: #f5f5f5;
  border-radius: 2px;
  overflow: hidden;
}
.progress-fill {
  width: var(--fill-width);
  height: 100%;
  border-radius: 2px;
}
.progress-fill.red {
  background: #f5222d;
}
.progress-fill.gray {
  background: #8c8c8c;
}
.progress-fill.orange {
  background: #fa8c16;
}

.kd-val {
  font-weight: bold;
  color: #333;
}

/* Responsive adjustments for Style 1 & 2 */
@media (max-width: 1024px) {
  .style1-content {
    flex-direction: column;
  }
  .style1-summary {
    width: 100%;
    min-width: auto;
  }

  .style2-dashboard {
    flex-direction: column;
  }
  .style2-rankings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 768px) {
  .style2-rankings-grid {
    grid-template-columns: 1fr;
  }
  .stat-card-row {
    flex-wrap: wrap;
  }
  .stat-card-mini {
    min-width: 120px;
  }
}
</style>
