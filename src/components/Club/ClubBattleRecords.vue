<template>
  <div class="records-container">
    <!-- 头部信息区 -->
    <div class="header-section">
      <div class="header-left">
        <img alt="俱乐部图标" class="header-icon" src="/icons/moonPalace.png">
        <div class="header-title">
          <h2>俱乐部盐场战绩</h2>
          <p>查看俱乐部成员的详细战绩数据</p>
        </div>
      </div>

      <!-- 数据统计区 -->
      <div
        v-if="battleRecords && battleRecords.roleDetailsList"
        class="stats-section"
      >
        <div class="stat-item">
          <span class="stat-label">查询日期:</span>
          <ClubBattleResultBadge tone="info" :text="queryDate"></ClubBattleResultBadge>
        </div>
        <div class="stat-item">
          <span class="stat-label">总人数:</span>
          <ClubBattleResultBadge
            tone="success"
            :text="String(battleRecords.roleDetailsList.length)"
          ></ClubBattleResultBadge>
        </div>
      </div>
    </div>

    <!-- 功能操作区 -->
    <ClubBattleRecordToolbar
      :can-export="Boolean(battleRecords)"
      :current-style="currentStyle"
      :disabled-date="disabledDate"
      :export-methods="exportmethod"
      :loading="loading"
      :query-date="queryDate"
      :show-export-methods="true"
      :style-options="styleOptions"
      @change-date="fetchBattleRecordsByDate"
      @export="handleExport"
      @refresh="handleRefresh"
      @update:current-style="currentStyle = $event"
      @update:export-methods="exportmethod = $event"
      @update:query-date="queryDate = $event"
    ></ClubBattleRecordToolbar>

    <div class="battle-records-content">
      <!-- 加载状态 -->
      <div v-if="loading" class="loading-state">
        <n-spin size="large">
          <template #description>正在加载战绩数据...</template>
        </n-spin>
      </div>

      <!-- 战绩列表 -->
      <div
        v-else-if="battleRecords && battleRecords.roleDetailsList"
        class="records-wrapper"
      >
        <!-- 样式一 -->
        <div
          ref="exportDom"
          v-if="currentStyle === 'style1'"
          class="records-list style-1"
        >
          <!-- 头部信息 -->
          <div class="style1-header">
            <h2>{{ queryDate }} {{ club?.name || "俱乐部" }}盐场周报</h2>
          </div>

          <div class="style1-content">
            <ClubBattleRecordTable
              variant="style1"
              :get-death-color="getDeathColor"
              :get-kill-color="getKillColor"
              :get-occupy-color="getOccupyColor"
              :get-revive-color="getReviveColor"
              :rows="playerRows"
              @image-error="handleImageError"
            ></ClubBattleRecordTable>

            <!-- 右侧统计 -->
            <div class="style1-summary">
              <ClubBattleSummaryPanel
                :rank-panels="style1SummaryPanels"
                :stats="style1SummaryStats"
                @image-error="handleImageError"
              ></ClubBattleSummaryPanel>
            </div>
          </div>
        </div>

        <!-- 样式二 -->
        <div
          ref="exportDom"
          v-else-if="currentStyle === 'style2'"
          class="records-list style-2"
        >
          <div class="style2-header">
            <div class="style2-title">
              <span class="trophy-icon">🏆</span>
              <div class="title-text">
                <h2>{{ club?.name || "俱乐部" }} 盐场周报</h2>
                <div class="date-text">{{ queryDate }}</div>
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
            :max-deaths="maxDeaths"
            :max-kills="maxKills"
            :max-occupies="maxOccupies"
            :rows="playerRows"
            @image-error="handleImageError"
          ></ClubBattleRecordTable>
        </div>

        <!-- 样式三 -->
        <div
          ref="exportDom"
          v-else-if="currentStyle === 'style3'"
          class="records-list"
        >
          <ClubBattleStyle3Panel
            kicker="本周战报"
            :metrics="style3Metrics"
            :mvp="mvpPlayer"
            :player-rows="playerRows"
            :podium-players="killRank"
            :title="`${queryDate} ${club?.name || '俱乐部'} 军团战报`"
            @image-error="handleImageError"
          ></ClubBattleStyle3Panel>
        </div>

        <!-- 样式四 -->
        <div
          ref="exportDom"
          v-else
          class="records-list"
        >
          <ClubBattleStyle4Panel
            eyebrow="战术视图"
            status-label="总 K/D"
            :metrics="style4Metrics"
            :player-rows="playerRows"
            :rank-panels="style4DisplayPanels"
            :status-value="totalKD"
            :title="`${club?.name || '俱乐部'} 盐场战术面板`"
            @image-error="handleImageError"
          ></ClubBattleStyle4Panel>
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
</template>

<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { useMessage } from "naive-ui/es";
import ClubBattleRecordToolbar from "@/components/Club/records/ClubBattleRecordToolbar.vue";
import ClubBattleResultBadge from "@/components/Club/records/ClubBattleResultBadge.vue";
import ClubBattleSummaryPanel from "@/components/Club/records/ClubBattleSummaryPanel.vue";
import ClubBattleRecordTable from "@/components/Club/records/ClubBattleRecordTable.vue";
import ClubBattleStatsPanel from "@/components/Club/records/ClubBattleStatsPanel.vue";
import ClubBattleStyle3Panel from "@/components/Club/records/ClubBattleStyle3Panel.vue";
import ClubBattleStyle4Panel from "@/components/Club/records/ClubBattleStyle4Panel.vue";
import ClubBattleTopRanksPanel from "@/components/Club/records/ClubBattleTopRanksPanel.vue";
import {
  buildClubBattleStatItems,
  buildClubBattleTopPanels,
} from "@/components/Club/records/clubBattleRecordDisplayHelpers.js";
import { buildClubBattleStyle4DisplayPanels } from "@/components/Club/records/clubBattleRecordLayoutHelpers.js";
import {
  buildClubBattleDashboardStatRows,
  buildClubBattleMvpModel,
  buildClubBattleTopRankCards,
} from "@/components/Club/records/clubBattleRecordStatsHelpers.js";
import {
  formatClubBattleKD,
  getClubBattleDeathColor,
  getClubBattleKillColor,
  getClubBattleOccupyColor,
  getClubBattleReviveColor,
} from "@/components/Club/records/clubBattleRecordFormatters.js";
import {
  getClubBattleTopRows,
  normalizeClubBattleRows,
} from "@/components/Club/records/useClubBattleRecordRows.js";
import { useTokenStore } from "@/stores/tokenStore";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import { downloadCanvasAsImage } from "@/utils/imageExport";
import {
  getStringPreference,
  setStringPreference,
} from "@/services/preferences/localPreferences";
import { DocumentText } from "@vicons/ionicons5";
import {
  copyToClipboard,
  formatBattleRecordsForExport,
  getLastSaturday,
} from "@/utils/clubBattleUtils";

const currentStyle = ref(
  getStringPreference("club_battle_records_style", "style1"),
);

const styleOptions = [
  { label: "经典榜单", value: "style1" },
  { label: "仪表看板", value: "style2" },
  { label: "海报卡片", value: "style3" },
  { label: "战术面板", value: "style4" },
];

watch(currentStyle, (newStyle) => {
  setStringPreference("club_battle_records_style", newStyle);
});

const exportmethod = ref(["2"]);
const exportDom = ref(null);

const message = useMessage();
const tokenStore = useTokenStore();
const info = computed(() => tokenStore.gameData?.legionInfo || null);
const club = computed(() => info.value?.info || null);

const loading = ref(false);
const battleRecords = ref(null);
const queryDate = ref(getLastSaturday());

const playerRows = computed(() => {
  return normalizeClubBattleRows(battleRecords.value?.roleDetailsList || [], {
    extraGetter: (member) => ({
      buildingCnt: member.buildingCnt || 0,
      headImg: member.headImg || "",
      roleId: member.roleId,
      loseCnt: member.loseCnt || 0,
      survivalCnt: member.loseCnt || 0,
      winCnt: member.winCnt || 0,
    }),
    killGetter: (member) => member.winCnt || 0,
    occupyGetter: (member) => member.buildingCnt || 0,
  });
});

// 计算属性：总击杀
const totalKills = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  return battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.winCnt || 0),
    0,
  );
});

// 计算属性：总复活
const totalRevives = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  return battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + Math.max((member.loseCnt || 0) - 6, 0),
    0,
  );
});

// 计算属性：总K/D
const totalKD = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  const totalKills = battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.winCnt || 0),
    0,
  );
  const totalLosses = battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.loseCnt || 0),
    0,
  );
  if (totalLosses === 0) return 0;
  return formatClubBattleKD(totalKills, totalLosses);
});

const style1SummaryStats = computed(() =>
  buildClubBattleStatItems([
    { label: "总人数", value: battleRecords.value?.roleDetailsList?.length || 0 },
    { label: "总击杀", value: totalKills.value },
    { label: "总死亡", value: totalDeaths.value },
    { label: "总复活丹", value: totalRevives.value },
    { label: "总 K/D", value: totalKD.value },
  ]),
);

// 计算属性：击杀榜 Top3
const killRank = computed(() => {
  return getClubBattleTopRows(playerRows.value, "killCnt");
});

// 计算属性：K/D榜 Top3
const kdRank = computed(() => {
  return getClubBattleTopRows(playerRows.value, "kd");
});

// 计算属性：复活榜 Top3
const reviveRank = computed(() => {
  return getClubBattleTopRows(playerRows.value, "reviveCnt");
});

const style1SummaryPanels = computed(() =>
  buildClubBattleTopPanels([
    {
      items: killRank.value,
      keyPrefix: "kill",
      title: "击杀前3",
      valueKey: "killCnt",
    },
    {
      items: occupyRank.value,
      keyPrefix: "occupy",
      title: "攻城前3",
      valueKey: "occupyCnt",
    },
    {
      items: kdRank.value,
      keyPrefix: "kd",
      title: "KD 前3",
      valueKey: "kd",
    },
    {
      items: reviveRank.value,
      keyPrefix: "revive",
      title: "复活丹前3",
      valueKey: "reviveCnt",
    },
  ]),
);

// --- 新增计算属性和方法 ---

// 攻城榜 Top3
const occupyRank = computed(() => {
  return getClubBattleTopRows(playerRows.value, "occupyCnt");
});

// 死亡榜 Top3
const deathRank = computed(() => {
  return getClubBattleTopRows(playerRows.value, "deathCnt");
});

// 生存榜 Top3 (以死亡数少排序，且至少有1次击杀或攻城)
const survivalRank = computed(() => {
  if (!playerRows.value.length) return [];
  return [...playerRows.value]
    .filter((p) => p.killCnt > 0 || p.occupyCnt > 0)
    .sort((a, b) => (a.deathCnt || 0) - (b.deathCnt || 0))
    .slice(0, 3)
    .map((p) => ({ ...p, survivalCnt: p.deathCnt }));
});

const totalDeaths = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  return battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.loseCnt || 0),
    0,
  );
});

const totalBuilding = computed(() => {
  if (!battleRecords.value?.roleDetailsList) return 0;
  return battleRecords.value.roleDetailsList.reduce(
    (sum, member) => sum + (member.buildingCnt || 0),
    0,
  );
});

const totalWinRate = computed(() => {
  const kills = totalKills.value;
  const deaths = totalDeaths.value;
  if (kills + deaths === 0) return "0.0";
  return ((kills / (kills + deaths)) * 100).toFixed(1);
});

const avgKills = computed(() => {
  if (
    !battleRecords.value?.roleDetailsList ||
    battleRecords.value.roleDetailsList.length === 0
  )
    return 0;
  return (
    totalKills.value / battleRecords.value.roleDetailsList.length
  ).toFixed(1);
});

const mvpPlayer = computed(() => {
  if (!playerRows.value.length) return null;
  return playerRows.value[0];
});

const style2StatRows = computed(() =>
  buildClubBattleDashboardStatRows({
    avgKills: avgKills.value,
    totalBuilding: totalBuilding.value,
    totalDeaths: totalDeaths.value,
    totalKills: totalKills.value,
    totalKD: totalKD.value,
    totalMembers: battleRecords.value?.roleDetailsList?.length || 0,
    totalRevives: totalRevives.value,
    totalWinRate: totalWinRate.value,
  }),
);

const style2Mvp = computed(() =>
  buildClubBattleMvpModel(mvpPlayer.value, {
    label: "本周 MVP",
  }),
);

const style2TopRankCards = computed(() =>
  buildClubBattleTopRankCards({
    deathRank: deathRank.value,
    kdRank: kdRank.value,
    killRank: killRank.value,
    occupyRank: occupyRank.value,
    reviveRank: reviveRank.value,
    survivalRank: survivalRank.value,
  }),
);

const maxKills = computed(() =>
  Math.max(
    ...(battleRecords.value?.roleDetailsList?.map((p) => p.winCnt || 0) || [0]),
  ),
);
const maxDeaths = computed(() =>
  Math.max(
    ...(battleRecords.value?.roleDetailsList?.map((p) => p.loseCnt || 0) || [
      0,
    ]),
  ),
);
const maxOccupies = computed(() =>
  Math.max(
    ...(battleRecords.value?.roleDetailsList?.map(
      (p) => p.buildingCnt || 0,
    ) || [0]),
  ),
);

const style3Metrics = computed(() => [
  {
    label: "总击杀",
    meta: "本周火力总量",
    tone: "danger",
    value: totalKills.value,
  },
  {
    label: "总攻城",
    meta: "推进节点贡献",
    tone: "warning",
    value: totalBuilding.value,
  },
  {
    label: "总 K/D",
    meta: "全队压制效率",
    tone: "success",
    value: totalKD.value,
  },
  {
    label: "总复活丹",
    meta: "高压补给消耗",
    tone: "accent",
    value: totalRevives.value,
  },
]);

const style4Metrics = computed(() => [
  {
    label: "总击杀",
    meta: "输出压制",
    value: totalKills.value,
  },
  {
    label: "总死亡",
    meta: "承压总量",
    value: totalDeaths.value,
  },
  {
    label: "总攻城",
    meta: "推进效率",
    value: totalBuilding.value,
  },
  {
    label: "总胜率",
    meta: "击杀 / 击杀+死亡",
    value: `${totalWinRate.value}%`,
  },
]);

const style4RankPanels = computed(() => [
  {
    getValue: (player) => player.killCnt || player.winCnt || 0,
    icon: "⚔️",
    key: "kill",
    players: killRank.value,
    title: "击杀尖兵",
  },
  {
    getValue: (player) => player.occupyCnt || player.buildingCnt || 0,
    icon: "🏰",
    key: "occupy",
    players: occupyRank.value,
    title: "攻城骨干",
  },
  {
    getValue: (player) => player.kd,
    icon: "📈",
    key: "kd",
    players: kdRank.value,
    title: "效率核心",
  },
  {
    getValue: (player) => player.reviveCnt,
    icon: "💊",
    key: "revive",
    players: reviveRank.value,
    title: "复活消耗",
  },
]);

const style4DisplayPanels = computed(() =>
  buildClubBattleStyle4DisplayPanels(style4RankPanels.value),
);

const getKillColor = (val) => getClubBattleKillColor(val);

const getOccupyColor = (val) => getClubBattleOccupyColor(val);

const getDeathColor = (val) => getClubBattleDeathColor(val);

const getReviveColor = (val) => getClubBattleReviveColor(val);

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = "none";
};

const disabledDate = (current) => {
  return current.getDay() !== 6 || current > Date.now();
};

// 日期选择时调用查询战绩方法
const fetchBattleRecordsByDate = (val) => {
  if (val !== undefined) {
    queryDate.value = val;
  } else {
    queryDate.value = getLastSaturday();
  }
  fetchBattleRecords();
};

// 查询战绩
const fetchBattleRecords = async () => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择游戏角色");
    return;
  }

  const tokenId = tokenStore.selectedToken.id;

  // 检查WebSocket连接
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error("WebSocket未连接，无法查询战绩");
    return;
  }

  loading.value = true;

  try {
    const result = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legionwar_getdetails",
      { date: queryDate.value },
      10000,
    );

    if (result && result.roleDetailsList) {
      // 按击杀数从高到低排序
      const sortedRoleDetailsList = [...result.roleDetailsList].sort((a, b) => {
        return (b.winCnt || 0) - (a.winCnt || 0);
      });
      battleRecords.value = {
        ...result,
        roleDetailsList: sortedRoleDetailsList,
      };
      message.success("战绩加载成功，已按击杀数从高到低排序");
    } else {
      battleRecords.value = null;
      message.warning("未查询到战绩数据");
    }
  } catch (error) {
    console.error("查询战绩失败:", error);
    message.error(`查询失败: ${error.message}`);
    battleRecords.value = null;
  } finally {
    loading.value = false;
  }
};

// 刷新战绩
const handleRefresh = () => {
  fetchBattleRecords();
};

// 导出战绩
const handleExport = async () => {
  if (!battleRecords.value || !battleRecords.value.roleDetailsList) {
    message.warning("没有可导出的数据");
    return;
  }

  try {
    if (exportmethod.value.includes("1")) {
      const exportText = await formatBattleRecordsForExport(
        battleRecords.value.roleDetailsList,
        queryDate.value,
      );
      await copyToClipboard(exportText);
      message.success("战绩已复制到剪贴板");
    }
    if (exportmethod.value.includes("2")) {
      await exportToImage();
    }
    if (!exportmethod.value.includes("1")) {
      message.success("导出成功");
    }
  } catch (error) {
    console.error("导出失败:", error);
    message.error("导出失败，请重试");
  }
};

const exportToImage = async () => {
  // 校验：确保DOM已正确绑定
  if (!exportDom.value) {
    throw new Error("未找到要导出的DOM元素");
  }

  try {
    // 临时移除战神榜内容区域的最大高度限制，确保所有内容都可见
    const godRankingContents = exportDom.value.querySelectorAll(
      ".god-ranking-content",
    );
    const originalStyles = [];

    godRankingContents.forEach((content) => {
      originalStyles.push({
        element: content,
        maxHeight: content.style.maxHeight,
        overflow: content.style.overflow,
      });
      content.style.maxHeight = "none";
      content.style.overflow = "visible";
    });

    // 5. 用html2canvas渲染DOM为Canvas
    const canvas = await captureWithHtml2canvas(exportDom.value, {
      scale: 2, // 放大2倍，解决图片模糊问题
      useCORS: true, // 允许跨域图片（若DOM内有远程图片，需开启）
      backgroundColor: "#ffffff", // 避免透明背景（默认透明）
      logging: false, // 关闭控制台日志
    });

    // 恢复战神榜内容区域的原始样式
    originalStyles.forEach(({ element, maxHeight, overflow }) => {
      element.style.maxHeight = maxHeight;
      element.style.overflow = overflow;
    });

    // 6. Canvas转图片链接并下载
    const filename = `${queryDate.value.replace("/", "年").replace("/", "月")}日盐场战报.png`;
    downloadCanvasAsImage(canvas, filename);
  } catch (err) {
    console.error("DOM转图片失败：", err);
    throw new Error("导出图片失败，请重试");
  }
};

// 暴露方法给父组件
defineExpose({
  fetchBattleRecords,
});

// 初始化：挂载后自动拉取
onMounted(() => {
  fetchBattleRecords();
});
</script>

<style scoped lang="scss">
.records-container {
  background: var(--bg-primary);
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
}

// 头部信息区
.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;

  .header-left {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }

  .header-icon {
    width: 40px;
    height: 40px;
    object-fit: contain;
    border-radius: var(--border-radius-md);
    background: var(--bg-secondary);
    padding: var(--spacing-xs);
    box-sizing: border-box;
  }

  .header-title {
    h2 {
      margin: 0;
      font-size: var(--font-size-xl);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
    }

    p {
      margin: var(--spacing-xs) 0 0 0;
      font-size: var(--font-size-sm);
      color: var(--text-secondary);
    }
  }

  // 数据统计区
  .stats-section {
    display: flex;
    gap: var(--spacing-lg);
    align-items: center;

    .stat-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);

      .stat-label {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
        font-weight: var(--font-weight-medium);
      }

      :deep(.n-tag) {
        font-size: var(--font-size-sm);
        padding: 4px 8px;
      }
    }
  }
}

// 功能操作区
.function-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-md) var(--spacing-lg);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-light);
  flex-shrink: 0;

  .function-left {
    .export-options {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);

      :deep(.n-checkbox-group) {
        display: flex;
        gap: var(--spacing-md);

        .n-checkbox {
          font-size: var(--font-size-sm);
          color: var(--text-primary);
        }
      }
    }
  }

  .function-right {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);

    :deep(.n-date-picker) {
      font-size: var(--font-size-sm);
      width: 200px;

      .n-input-wrapper {
        font-size: var(--font-size-sm);
      }
    }

    .action-btn {
      font-size: var(--font-size-sm);
      padding: 6px 12px;
      border-radius: var(--border-radius-sm);
      transition: all var(--transition-fast);

      &:hover {
        transform: translateY(-1px);
      }
    }
  }
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

/* 响应式设计 */
@media (max-width: 768px) {
  .header-section {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);

    .stats-section {
      width: 100%;
      justify-content: space-between;
    }
  }

  .function-section {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);

    .function-left,
    .function-right {
      width: 100%;
      justify-content: space-between;
    }
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

.style1-summary {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 15px;
  min-width: 250px;
}

/* ================== 样式二 (Style 2) ================== */
.style-2 {
  background: #eef2f7;
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  border-radius: 8px;
}

.style2-header {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
  background: #fff;
  padding: 15px;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.style2-title {
  display: flex;
  align-items: center;
  gap: 15px;
}

.trophy-icon {
  font-size: 36px;
}

.title-text h2 {
  font-size: 22px;
  color: #333;
  margin: 0;
  font-weight: 800;
}

.date-text {
  font-size: 14px;
  color: #888;
  margin-top: 4px;
}

.rank-card-title-s2 {
  font-size: 14px;
  font-weight: bold;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  gap: 8px;
  color: #444;
}

.rank-list-s2 {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rank-item-s2 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
}

.rank-num-s2 {
  width: 16px;
  height: 16px;
  background: #eee;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #666;
  margin-right: 8px;
}

.rank-item-s2:nth-child(1) .rank-num-s2 {
  background: #ffd700;
  color: #fff;
}
.rank-item-s2:nth-child(2) .rank-num-s2 {
  background: #c0c0c0;
  color: #fff;
}
.rank-item-s2:nth-child(3) .rank-num-s2 {
  background: #cd7f32;
  color: #fff;
}

.rank-player-s2 {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.rank-player-s2 .name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.avatar-xxs {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}

.rank-val-s2 {
  font-weight: bold;
}
.rank-val-s2.red {
  color: #ff5252;
}
.rank-val-s2.orange {
  color: #ffab40;
}
.rank-val-s2.green {
  color: #4caf50;
}
.rank-val-s2.gray {
  color: #757575;
}
.rank-val-s2.purple {
  color: #9c27b0;
}
.rank-val-s2.blue {
  color: #2196f3;
}

.style2-table-wrapper {
  background: #fff;
  padding: 0;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  overflow: hidden;
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
}

.style2-table th:nth-child(2) {
  text-align: left;
  padding-left: 20px;
}

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
  font-size: 16px;
}
.rank-num-plain {
  font-weight: bold;
  color: #888;
}

.player-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-start;
  padding-left: 10px;
}

.player-name-s2 {
  font-weight: 600;
  color: #333;
}

.avatar-xs {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
}

.avatar-placeholder-xs {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
}

.bar-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  max-width: 150px;
}

.bar-val {
  width: 30px;
  text-align: right;
  font-weight: bold;
  font-size: 12px;
}
.bar-val.red {
  color: #ff5252;
}
.bar-val.gray {
  color: #9e9e9e;
}
.bar-val.orange {
  color: #ffab40;
}

.progress-bg {
  flex: 1;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  width: var(--fill-width);
  height: 100%;
  border-radius: 3px;
}
.progress-fill.red {
  background: #ff5252;
}
.progress-fill.orange {
  background: #ffab40;
}
.progress-fill.gray {
  background: #9e9e9e;
}

.kd-val {
  font-weight: bold;
  color: #4caf50;
}

@media (max-width: 768px) {
  .style1-content {
    flex-direction: column;
  }
  .style1-summary {
    width: 100%;
  }
}
</style>
