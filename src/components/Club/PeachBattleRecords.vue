<template>
  <div class="records-container">
    <!-- 头部信息区 -->
    <div class="header-section">
      <div class="header-left">
        <img
          alt="蟠桃图标"
          class="header-icon"
          src="/icons/1733492491706152.png"
        >
        <div class="header-title">
          <h2>蟠桃园战绩</h2>
          <p>查看蟠桃园对战详细数据</p>
        </div>
      </div>

      <!-- 数据统计区 -->
      <div v-if="battleRecords && battleRecords.ownClub" class="stats-section">
        <div class="stat-item">
          <span class="stat-label">查询日期:</span>
          <ClubBattleResultBadge tone="info" :text="queryDate"></ClubBattleResultBadge>
        </div>
      </div>
    </div>

    <!-- 功能操作区 -->
    <ClubBattleRecordToolbar
      :can-export="Boolean(battleRecords)"
      :current-style="currentStyle"
      :disabled-date="disabledDate"
      :loading="loading"
      :query-date="queryDate"
      :style-options="styleOptions"
      @change-date="fetchBattleRecordsByDate"
      @export="handleExport"
      @refresh="handleRefresh"
      @update:current-style="currentStyle = $event"
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
        ref="exportDom"
        v-else-if="
          battleRecords && battleRecords.ownClub && battleRecords.opponentClub
        "
        class="records-wrapper"
      >
        <div v-if="currentStyle === 'default'" class="style-default">
          <PeachBattleHeaderPanel
            :opponent-club="battleRecords.opponentClub"
            :own-club="battleRecords.ownClub"
            :query-date="queryDate"
          ></PeachBattleHeaderPanel>

          <div class="overall-stats">
            <PeachBattleDefaultStatsPanel
              title="我方总体数据"
              tone="own"
              :stats="peachDefaultOwnStats"
            ></PeachBattleDefaultStatsPanel>
            <PeachBattleDefaultStatsPanel
              title="敌方总体数据"
              tone="opponent"
              :stats="peachDefaultOpponentStats"
            ></PeachBattleDefaultStatsPanel>
          </div>

          <PeachBattleRankPanels
            :groups="peachDefaultRankGroups"
            @image-error="handleImageError"
          ></PeachBattleRankPanels>

          <div class="god-rankings">
            <PeachBattleGodRankPanel
              title="我方战神榜"
              tone="own"
              :players="battleRecords.ownClub.godRank"
              @image-error="handleImageError"
            ></PeachBattleGodRankPanel>
            <PeachBattleGodRankPanel
              title="敌方战神榜"
              tone="opponent"
              :players="battleRecords.opponentClub.godRank"
              @image-error="handleImageError"
            ></PeachBattleGodRankPanel>
          </div>
        </div>

        <!-- Style 1 -->
        <div v-if="currentStyle === 'style1'" class="style-1-wrapper">
          <PeachBattleHeaderPanel
            :opponent-club="battleRecords.opponentClub"
            :own-club="battleRecords.ownClub"
            :query-date="queryDate"
          ></PeachBattleHeaderPanel>
          <PeachBattleDualColumnLayout
            variant="style1"
            :opponent-title="battleRecords.opponentClub.name"
            :own-title="battleRecords.ownClub.name"
          >
            <template #own>
              <div class="style1-content">
                <PeachBattleSummaryPanel
                  tone="own"
                  variant="style1"
                  :rank-panels="ownClubView.panels"
                  :stats="ownClubView.stats"
                  @image-error="handleImageError"
                ></PeachBattleSummaryPanel>
                <PeachBattleRecordTable
                  tone="own"
                  variant="style1"
                  :rows="ownClubView.rows"
                  @image-error="handleImageError"
                ></PeachBattleRecordTable>
              </div>
            </template>
            <template #opponent>
              <div class="style1-content">
                <PeachBattleSummaryPanel
                  tone="opponent"
                  variant="style1"
                  :rank-panels="opponentClubView.panels"
                  :stats="opponentClubView.stats"
                  @image-error="handleImageError"
                ></PeachBattleSummaryPanel>
                <PeachBattleRecordTable
                  tone="opponent"
                  variant="style1"
                  :rows="opponentClubView.rows"
                  @image-error="handleImageError"
                ></PeachBattleRecordTable>
              </div>
            </template>
          </PeachBattleDualColumnLayout>
        </div>

        <!-- Style 2 -->
        <div v-if="currentStyle === 'style2'" class="style-2-wrapper">
          <PeachBattleHeaderPanel
            :opponent-club="battleRecords.opponentClub"
            :own-club="battleRecords.ownClub"
            :query-date="queryDate"
          ></PeachBattleHeaderPanel>
          <PeachBattleDualColumnLayout
            opponent-subtitle="敌方战绩"
            own-subtitle="我方战绩"
            variant="style2"
            :opponent-title="battleRecords.opponentClub.name"
            :own-title="battleRecords.ownClub.name"
          >
            <template #own>
              <PeachBattleSummaryPanel
                tone="own"
                variant="style2"
                :rank-panels="ownClubView.panels"
                :stats="ownClubView.stats"
                @image-error="handleImageError"
              ></PeachBattleSummaryPanel>
              <PeachBattleRecordTable
                tone="own"
                variant="style2"
                :max-kills="ownClubView.maxKill"
                :rows="ownClubView.rows"
                @image-error="handleImageError"
              ></PeachBattleRecordTable>
            </template>
            <template #opponent>
              <PeachBattleSummaryPanel
                tone="opponent"
                variant="style2"
                :rank-panels="opponentClubView.panels"
                :stats="opponentClubView.stats"
                @image-error="handleImageError"
              ></PeachBattleSummaryPanel>
              <PeachBattleRecordTable
                tone="opponent"
                variant="style2"
                :max-kills="opponentClubView.maxKill"
                :rows="opponentClubView.rows"
                @image-error="handleImageError"
              ></PeachBattleRecordTable>
            </template>
          </PeachBattleDualColumnLayout>
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
import PeachBattleDefaultStatsPanel from "@/components/Club/records/PeachBattleDefaultStatsPanel.vue";
import PeachBattleDualColumnLayout from "@/components/Club/records/PeachBattleDualColumnLayout.vue";
import PeachBattleGodRankPanel from "@/components/Club/records/PeachBattleGodRankPanel.vue";
import PeachBattleHeaderPanel from "@/components/Club/records/PeachBattleHeaderPanel.vue";
import PeachBattleRankPanels from "@/components/Club/records/PeachBattleRankPanels.vue";
import PeachBattleSummaryPanel from "@/components/Club/records/PeachBattleSummaryPanel.vue";
import PeachBattleRecordTable from "@/components/Club/records/PeachBattleRecordTable.vue";
import {
  formatClubBattleCompactDate,
  formatClubBattleKD,
} from "@/components/Club/records/clubBattleRecordFormatters.js";
import {
  buildClubBattleStatItems,
  buildClubBattleTopPanels,
  getClubBattleAverageValue,
} from "@/components/Club/records/clubBattleRecordDisplayHelpers.js";
import {
  buildPeachBattleDefaultStats,
  buildPeachBattleRankGroups,
} from "@/components/Club/records/clubBattleRecordStatsHelpers.js";
import {
  getClubBattleTopRows,
  normalizeClubBattleRows,
} from "@/components/Club/records/useClubBattleRecordRows.js";
import { useTokenStore } from "@/stores/tokenStore";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import { downloadCanvasAsPagedImages } from "@/utils/imageExport";
import {
  getStringPreference,
  setStringPreference,
} from "@/services/preferences/localPreferences";
import { DocumentText } from "@vicons/ionicons5";

// 获取最近的周日日期
// 如果今天是周日，返回今天的日期；否则返回上周日的日期
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

const currentStyle = ref(
  getStringPreference("peach_battle_records_style", "default"),
);

const styleOptions = [
  { label: "默认", value: "default" },
  { label: "样式一", value: "style1" },
  { label: "样式二", value: "style2" },
];

watch(currentStyle, (newStyle) => {
  setStringPreference("peach_battle_records_style", newStyle);
});

const exportDom = ref(null);

const message = useMessage();
const tokenStore = useTokenStore();

const loading = ref(false);
const battleRecords = ref(null);
const queryDate = ref(getLastSunday());

const formatDateToShort = formatClubBattleCompactDate;

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = "none";
};

const disabledDate = (current) => {
  return current.getDay() !== 0 || current > Date.now();
};

const buildPeachBattleClubView = (clubData) => {
  const rows = normalizeClubBattleRows(clubData?.killRank || [], {
    avatarGetter: (player) => player?.roleInfo?.headImg || "",
    deathGetter: (player) => player?.reviveCnt ?? 0,
    extraGetter: (player) => ({
      carCnt: player?.carCnt || 0,
      roleInfo: player?.roleInfo || {},
    }),
    killGetter: (player) => player?.killCnt ?? 0,
    killStreakGetter: (player) => player?.mCKCnt ?? 0,
    nameGetter: (player) => player?.roleInfo?.name || "未知成员",
    occupyGetter: (player) => player?.carCnt ?? 0,
    reviveGetter: (player) => player?.reviveCnt ?? 0,
  });

  const maxKill = Math.max(...rows.map((item) => item.killCnt || 0), 0);

  return {
    maxKill,
    panels: buildClubBattleTopPanels([
      {
        items: getClubBattleTopRows(rows, "killCnt"),
        keyPrefix: "kill",
        title: "击杀 Top3",
        valueKey: "killCnt",
      },
      {
        items: getClubBattleTopRows(rows, "kd"),
        keyPrefix: "kd",
        title: "KD Top3",
        valueKey: "kd",
      },
      {
        items: getClubBattleTopRows(rows, "reviveCnt"),
        keyPrefix: "revive",
        title: "复活 Top3",
        valueKey: "reviveCnt",
      },
      {
        items: getClubBattleTopRows(rows, "killStreakCnt"),
        keyPrefix: "killstreak",
        title: "连杀 Top3",
        valueKey: "killStreakCnt",
      },
    ]),
    rows,
    stats: buildClubBattleStatItems([
      {
        label: "总 K/D",
        value: clubData?.totalKD ?? 0,
      },
      {
        label: "总击杀",
        value: clubData?.totalKills ?? 0,
      },
      {
        label: "总复活",
        value: clubData?.totalRevives ?? 0,
      },
      {
        label: "人均击杀",
        value: getClubBattleAverageValue(
          clubData?.totalKills,
          clubData?.memberCount,
        ),
      },
    ]),
  };
};

const ownClubView = computed(() =>
  buildPeachBattleClubView(battleRecords.value?.ownClub),
);

const opponentClubView = computed(() =>
  buildPeachBattleClubView(battleRecords.value?.opponentClub),
);

const peachDefaultOwnStats = computed(() =>
  buildPeachBattleDefaultStats({
    totalKD: battleRecords.value?.ownClub?.totalKD ?? 0,
    totalKills: battleRecords.value?.ownClub?.totalKills ?? 0,
    totalRevives: battleRecords.value?.ownClub?.totalRevives ?? 0,
  }),
);

const peachDefaultOpponentStats = computed(() =>
  buildPeachBattleDefaultStats({
    totalKD: battleRecords.value?.opponentClub?.totalKD ?? 0,
    totalKills: battleRecords.value?.opponentClub?.totalKills ?? 0,
    totalRevives: battleRecords.value?.opponentClub?.totalRevives ?? 0,
  }),
);

const peachDefaultRankGroups = computed(() =>
  buildPeachBattleRankGroups({
    opponentClub: battleRecords.value?.opponentClub,
    ownClub: battleRecords.value?.ownClub,
  }),
);

// 日期选择时调用查询战绩方法
const fetchBattleRecordsByDate = (val) => {
  if (val !== undefined) {
    queryDate.value = val;
  } else {
    queryDate.value = getLastSunday();
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
    const payloadTaskRes = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legion_getpayloadtask",
      {},
      10000,
    );
    if (!payloadTaskRes) {
      message.error("未获取到对战俱乐部");
      return;
    }
    const firstLegionId = payloadTaskRes.firstLegionId;
    const payloadrecord = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legion_getpayloadrecord",
      {},
      10000,
    );
    if (!payloadrecord) {
      message.error("未获取到对战俱乐部");
      return;
    }
    const shortDate = formatDateToShort(queryDate.value);
    if (
      !payloadrecord.enemyLegionMap ||
      !payloadrecord.enemyLegionMap[shortDate]
    ) {
      message.warning(`未找到日期 ${queryDate.value} 的对战记录`);
      battleRecords.value = null;
      return;
    }
    const secondLegionId = payloadrecord.enemyLegionMap[shortDate].id;
    if (!firstLegionId || !secondLegionId) {
      message.error("未获取到对战俱乐部ID");
      return;
    }
    // 获取俱乐部的详细信息
    const firstLegionIdInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legion_getinfobyid",
      { legionId: firstLegionId },
      10000,
    );
    const secondLegionIdInfo = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legion_getinfobyid",
      { legionId: secondLegionId },
      10000,
    );
    const result = await tokenStore.sendMessageWithPromise(
      tokenId,
      "legion_getpayloadkillrecord",
      { date: formatDateToShort(queryDate.value) },
      10000,
    );
    if (!result) {
      message.error("未获取到对战俱乐部战绩");
      return;
    }

    // 处理我方战绩
    const ownRecords =
      result.recordsMap && result.recordsMap[Number(firstLegionId)]
        ? [...result.recordsMap[Number(firstLegionId)]]
        : [];
    // 处理敌方战绩
    const opponentRecords =
      result.recordsMap && result.recordsMap[Number(secondLegionId)]
        ? [...result.recordsMap[Number(secondLegionId)]]
        : [];

    // 计算每个玩家的K/D值
    const calculateKD = (player) => {
      const killCnt = player.killCnt || 0;
      const reviveCnt = player.reviveCnt || 0;
      return reviveCnt > 0
        ? Number.parseFloat((killCnt / reviveCnt).toFixed(2))
        : 0;
    };

    // 处理我方数据
    const processedOwnRecords = ownRecords.map((player) => ({
      ...player,
      kd: calculateKD(player),
    }));

    // 处理敌方数据
    const processedOpponentRecords = opponentRecords.map((player) => ({
      ...player,
      kd: calculateKD(player),
    }));

    // 生成我方榜单
    const ownKillRank = [...processedOwnRecords].sort(
      (a, b) => (b.killCnt || 0) - (a.killCnt || 0),
    );
    const ownKdRank = [...processedOwnRecords].sort((a, b) => b.kd - a.kd);
    const ownReviveRank = [...processedOwnRecords].sort(
      (a, b) => (b.reviveCnt || 0) - (a.reviveCnt || 0),
    );
    const ownKillStreakRank = [...processedOwnRecords].sort(
      (a, b) => (b.mCKCnt || 0) - (a.mCKCnt || 0),
    );
    const ownGodRank = [...processedOwnRecords].sort(
      (a, b) => (b.killCnt || 0) - (a.killCnt || 0),
    );

    // 生成敌方榜单
    const opponentKillRank = [...processedOpponentRecords].sort(
      (a, b) => (b.killCnt || 0) - (a.killCnt || 0),
    );
    const opponentKdRank = [...processedOpponentRecords].sort(
      (a, b) => b.kd - a.kd,
    );
    const opponentReviveRank = [...processedOpponentRecords].sort(
      (a, b) => (b.reviveCnt || 0) - (a.reviveCnt || 0),
    );
    const opponentKillStreakRank = [...processedOpponentRecords].sort(
      (a, b) => (b.mCKCnt || 0) - (a.mCKCnt || 0),
    );
    const opponentGodRank = [...processedOpponentRecords].sort(
      (a, b) => (b.killCnt || 0) - (a.killCnt || 0),
    );

    // 计算我方总体数据
    const ownTotalKills = processedOwnRecords.reduce(
      (sum, player) => sum + (player.killCnt || 0),
      0,
    );
    const ownTotalRevives = processedOwnRecords.reduce(
      (sum, player) => sum + (player.reviveCnt || 0),
      0,
    );
    const ownTotalKD =
      ownTotalRevives > 0
        ? Number(formatClubBattleKD(ownTotalKills, ownTotalRevives))
        : 0;
    const ownTotalPower = processedOwnRecords.reduce(
      (sum, player) => sum + (player.roleInfo.power || 0),
      0,
    );

    // 计算敌方总体数据
    const opponentTotalKills = processedOpponentRecords.reduce(
      (sum, player) => sum + (player.killCnt || 0),
      0,
    );
    const opponentTotalRevives = processedOpponentRecords.reduce(
      (sum, player) => sum + (player.reviveCnt || 0),
      0,
    );
    const opponentTotalKD =
      opponentTotalRevives > 0
        ? Number(formatClubBattleKD(opponentTotalKills, opponentTotalRevives))
        : 0;
    const opponentTotalPower = processedOpponentRecords.reduce(
      (sum, player) => sum + (player.roleInfo.power || 0),
      0,
    );

    // 构建最终数据结构
    battleRecords.value = {
      ownClub: {
        id: firstLegionId,
        name: firstLegionIdInfo?.legionData?.name || "我方俱乐部",
        level: firstLegionIdInfo?.legionData?.level || 0,
        power: firstLegionIdInfo?.legionData?.power || 0,
        serverId: firstLegionIdInfo?.legionData?.serverId || "",
        logo: firstLegionIdInfo?.legionData?.logo || "",
        quenchNum: firstLegionIdInfo?.legionData?.quenchNum || 0,
        announcement: firstLegionIdInfo?.legionData?.announcement || "",
        memberCount: processedOwnRecords.length,
        totalPower: ownTotalPower,
        totalKills: ownTotalKills,
        totalRevives: ownTotalRevives,
        totalKD: ownTotalKD,
        killRank: ownKillRank,
        kdRank: ownKdRank,
        reviveRank: ownReviveRank,
        killStreakRank: ownKillStreakRank,
        godRank: ownGodRank,
      },
      opponentClub: {
        id: secondLegionId,
        name: secondLegionIdInfo?.legionData?.name || "敌方俱乐部",
        level: secondLegionIdInfo?.legionData?.level || 0,
        power: secondLegionIdInfo?.legionData?.power || 0,
        serverId: secondLegionIdInfo?.legionData?.serverId || "",
        logo: secondLegionIdInfo?.legionData?.logo || "",
        quenchNum: secondLegionIdInfo?.legionData?.quenchNum || 0,
        announcement: secondLegionIdInfo?.legionData?.announcement || "",
        memberCount: processedOpponentRecords.length,
        totalPower: opponentTotalPower,
        totalKills: opponentTotalKills,
        totalRevives: opponentTotalRevives,
        totalKD: opponentTotalKD,
        killRank: opponentKillRank,
        kdRank: opponentKdRank,
        reviveRank: opponentReviveRank,
        killStreakRank: opponentKillStreakRank,
        godRank: opponentGodRank,
      },
    };

    message.success("战绩加载成功");
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
  if (!battleRecords.value) {
    message.warning("没有可导出的数据");
    return;
  }

  try {
    await exportToImage();
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
    const filenameBase = `${queryDate.value.replace("/", "年").replace("/", "月")}日蟠桃园战报`;
    const pageCount = downloadCanvasAsPagedImages(canvas, filenameBase, {
      maxHeight: 4200,
    });
    message.success(
      pageCount > 1 ? `导出成功，共 ${pageCount} 张图片` : "导出成功",
    );
  } catch (err) {
    console.error("DOM转图片失败：", err);
    throw new Error("导出图片失败，请重试");
  }
};

// 暴露方法给父组件
defineExpose({
  fetchBattleRecords,
});

// 挂载后自动拉取
onMounted(() => {
  queryDate.value = getLastSunday();
  fetchBattleRecords();
});
</script>

<style scoped lang="scss">
/* Removed inline styles */

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
  overflow-x: auto;
  padding: var(--spacing-md);
  min-height: 200px;
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
  gap: var(--spacing-md);
}

/* 总体数据统计 */
.overall-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-md);
}

.stats-side {
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.stats-title {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-sm);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-light);
  text-align: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--spacing-sm);
}

.stat-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--border-radius-sm);
}

.stat-label {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.stat-value {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-lg);
}

/* 统计项颜色区分 */
.stat-kills {
  border-left: 4px solid var(--error-color);
}

.stat-kills .stat-value {
  color: var(--error-color);
}

.stat-revives {
  border-left: 4px solid var(--warning-color);
}

.stat-revives .stat-value {
  color: var(--warning-color);
}

.stat-kd {
  border-left: 4px solid var(--success-color);
}

.stat-kd .stat-value {
  color: var(--success-color);
}

/* 各种榜单 */
.battle-rankings {
  margin-bottom: var(--spacing-md);
}

.ranking-card {
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-md);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.ranking-title {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-light);
  text-align: center;
}

.ranking-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.ranking-side {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.ranking-subtitle {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--spacing-sm);
}

.ranking-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--border-radius-sm);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.rank-number {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
}

.ranking-item:nth-of-type(2) .rank-number {
  background: #ffd700;
  color: #000;
}

.ranking-item:nth-of-type(3) .rank-number {
  background: #c0c0c0;
  color: #000;
}

.ranking-item:nth-of-type(4) .rank-number {
  background: #cd7f32;
  color: #000;
}

.player-avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.player-avatar-placeholder {
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

.player-name {
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-value {
  font-weight: var(--font-weight-bold);
  font-size: var(--font-size-sm);
}

/* 战神榜 */
.god-rankings {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--spacing-md);
}

.god-ranking {
  background: var(--bg-secondary);
  border-radius: var(--border-radius-medium);
  padding: var(--spacing-md);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.god-ranking-title {
  font-weight: var(--font-weight-semibold);
  margin-bottom: var(--spacing-md);
  padding-bottom: var(--spacing-sm);
  border-bottom: 1px solid var(--border-light);
  text-align: center;
}

.god-ranking-content {
  max-height: 400px;
  overflow-y: auto;
  padding-right: var(--spacing-xs);
}

.god-ranking-content::-webkit-scrollbar {
  width: 6px;
}

.god-ranking-header {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-sm);
  background: var(--bg-primary);
  border-radius: var(--border-radius-sm);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.header-avatar {
  width: 32px;
  flex-shrink: 0;
}

.player-avatar-cell {
  width: 32px;
  flex-shrink: 0;
}

.header-player {
  width: 140px;
  padding-left: var(--spacing-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.header-id {
  flex: 0 0 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-stat {
  width: 50px;
  text-align: center;
  flex-shrink: 0;
}

.god-ranking-item {
  display: flex;
  align-items: center;
  padding: var(--spacing-sm);
  margin-bottom: var(--spacing-xs);
  border-radius: var(--border-radius-sm);
  background: var(--bg-primary);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.god-rank-number {
  width: 32px;
  height: 24px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
  background: #696969;
  color: #fff;
}

.god-ranking-header > .god-rank-number {
  background: transparent !important;
  color: var(--text-secondary) !important;
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-sm);
}

.god-ranking-item:nth-of-type(2) .god-rank-number {
  background: #ffd700;
  color: #000;
}

.god-ranking-item:nth-of-type(3) .god-rank-number {
  background: #c0c0c0;
  color: #000;
}

.god-ranking-item:nth-of-type(4) .god-rank-number {
  background: #cd7f32;
  color: #000;
}

.player-id {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
  flex: 0 0 100px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-name {
  width: 140px;
  padding-left: var(--spacing-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.player-stat {
  font-weight: var(--font-weight-medium);
  font-size: var(--font-size-sm);
  width: 50px;
  text-align: center;
  flex-shrink: 0;
}

.god-ranking-content::-webkit-scrollbar-track {
  background: var(--bg-primary);
  border-radius: 3px;
}

.god-ranking-content::-webkit-scrollbar-thumb {
  background: var(--border-light);
  border-radius: 3px;
}

.god-ranking-content::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .overall-stats {
    grid-template-columns: 1fr;
  }

  .ranking-content {
    grid-template-columns: 1fr;
  }

  .god-rankings {
    grid-template-columns: 1fr;
  }

}

@media (max-width: 768px) {
  .records-container {
    min-width: 0;
  }

  .header-section {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
    padding: var(--spacing-md);
  }

  .function-section {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-sm);

    .function-left,
    .function-right {
      width: 100%;
    }

    .function-right {
      flex-wrap: wrap;
    }
  }

  .battle-records-content {
    padding: var(--spacing-sm);
    overflow-x: auto;
  }

  .records-wrapper,
  .style-default,
  .style-1-wrapper,
  .style-2-wrapper {
    min-width: 980px;
  }

  .inline-header {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-sm);
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }

  .stats-grid {
    grid-template-columns: 1fr;
  }

  .ranking-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  .god-ranking-item {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-xs);
  }

  .player-stat {
    min-width: auto;
    text-align: left;
  }
}

/* Style 1 */
.style-1-wrapper {
  background: #fff;
  padding: 20px;
  color: #333;
  font-family: Arial, sans-serif;
}

.style1-content {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

/* Style 1 */
.style-1-wrapper {
  background: #eef2f7;
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  border-radius: 8px;
}

/* Style 2 */
.style-2-wrapper {
  background: #eef2f7;
  padding: 20px;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
  border-radius: 8px;
}
</style>
