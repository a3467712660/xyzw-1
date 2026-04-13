<template>
  <div class="club-warrank-container">
    <div class="club-warrank-card">
      <!-- 头部信息区 -->
      <div class="header-section">
        <div class="header-left">
          <img
            alt="俱乐部图标"
            class="header-icon"
            src="/icons/moonPalace.png"
          >
          <div class="header-title">
            <h2>伟大航路积分榜</h2>
            <p v-if="currentWarType">
              当前岛屿：{{ getRankParams(currentWarType).name }}
            </p>
            <p v-else>俱乐部积分排名</p>
          </div>
        </div>

        <!-- 数据统计区 -->
        <div
          v-if="battleRecords1 && battleRecords1.legionRankList"
          class="stats-section"
        >
          <div class="stat-item">
            <span class="stat-label">总俱乐部数:</span>
            <n-tag type="success">{{ rankList.length }}</n-tag>
          </div>
        </div>
      </div>

      <!-- 功能操作区 -->
      <div class="function-section">
        <div class="function-right">
          <n-button
            class="action-btn refresh-btn"
            size="small"
            :disabled="loading1"
            @click="handleRefresh1"
          >
            <template #icon>
              <n-icon>
                <Refresh></Refresh>
              </n-icon> </template
            >查询
          </n-button>
          <n-button
            class="action-btn export-btn"
            size="small"
            type="primary"
            :disabled="!battleRecords1 || loading1"
            @click="handleExport1"
          >
            <template #icon>
              <n-icon>
                <Copy></Copy>
              </n-icon> </template
            >导出
          </n-button>
        </div>
      </div>

      <!-- 表格内容区 -->
      <div ref="exportDom" class="table-content">
        <!-- 加载状态 -->
        <div v-if="loading1" class="loading-state">
          <n-spin size="large">
            <template #description> 正在加载俱乐部数据... </template>
          </n-spin>
        </div>

        <!-- 匹配列表 -->
        <div
          v-else-if="battleRecords1 && battleRecords1.legionRankList"
          class="table-container"
        >
          <!-- 表格标题行 -->
          <div class="table-header">
            <div class="table-cell rank">排名</div>
            <div class="table-cell alliance">联盟</div>
            <div class="table-cell server">服务器</div>
            <div class="table-cell avatar">头像</div>
            <div class="table-cell name">名称</div>
            <div class="table-cell red-quench">红淬</div>
            <div class="table-cell score">积分</div>
            <div class="table-cell first-3">前三车头</div>
            <div class="table-cell power">战力</div>
            <div class="table-cell level">等级</div>
            <div class="table-cell announcement">公告</div>
          </div>

          <!-- 表格数据行 -->
          <div
            v-for="member in filteredLegionList"
            :key="member.id"
            class="table-row"
            :class="getAllianceClass(allianceincludes(member.announcement))"
          >
            <div class="table-cell rank">
              <div class="rank-container">
                <span v-if="member.rank === 1" class="rank-medal gold"></span>
                <span
                  v-else-if="member.rank === 2"
                  class="rank-medal silver"
                ></span>
                <span
                  v-else-if="member.rank === 3"
                  class="rank-medal bronze"
                ></span>
                <span v-else class="rank-number">{{ member.rank }}</span>
              </div>
            </div>
            <div class="table-cell alliance">
              <span class="alliance-tag">{{
                allianceincludes(member.announcement) || "未知联盟"
              }}</span>
            </div>
            <div class="table-cell server">{{ member.serverId || 0 }}</div>
            <div class="table-cell avatar">
              <img
                v-if="member.logo"
                class="member-avatar"
                :alt="member.name"
                :src="member.logo"
                @error="handleImageError"
              >
              <div v-else class="member-avatar-placeholder">
                {{ member.name?.charAt(0) || "?" }}
              </div>
            </div>
            <div class="table-cell name">{{ member.name }}</div>
            <div class="table-cell red-quench">{{ member.redQuench || 0 }}</div>
            <div class="table-cell score">
              {{ formatScore(member.sRScore) }}
            </div>
            <div class="table-cell first-3">
              <div class="hero-avatars">
                <div
                  v-for="(hero, heroIndex) in member.topHeroes"
                  :key="heroIndex"
                  class="hero-card"
                >
                  <div
                    class="hero-avatar-container"
                    @click="handleHeroClick(hero)"
                  >
                    <img
                      v-if="hero.headImg"
                      class="hero-avatar"
                      :alt="hero.name"
                      :src="hero.headImg"
                    >
                    <div v-else class="hero-avatar-placeholder">
                      {{ hero.name?.charAt(0) || "?" }}
                    </div>
                  </div>
                  <div class="hero-info">
                    <div class="hero-name">{{ hero.name || "未知" }}</div>
                    <div class="hero-stats">
                      <span class="hero-power">{{
                        formatPower(hero.power)
                      }}</span>
                      <span
                        class="hero-redquench"
                        :class="getRedQuenchClass(hero.redQuench)"
                        >{{ hero.redQuench }}红</span
                      >
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div class="table-cell power">
              {{ formatPower(member.power) || 0 }}
            </div>
            <div class="table-cell level">
              <span>{{ member.level || 30 }}</span>
            </div>
            <div class="table-cell announcement">
              {{ member.announcement || "" }}
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else-if="!loading1" class="empty-state">
          <n-empty description="暂无俱乐部数据" size="large">
            <template #icon>
              <n-icon>
                <DocumentText></DocumentText>
              </n-icon>
            </template>
          </n-empty>
        </div>
      </div>

      <!-- 分页组件 -->
      <div v-if="totalClubs > 0" class="pagination-container">
        <NPagination
          show-quick-jumper
          v-model:page="currentPage"
          :page-count="Math.ceil(totalClubs / pageSize)"
          :page-size="pageSize"
          @update:page="handlePageChange"
        ></NPagination>
      </div>
    </div>

    <ClubRankFightPanel
      v-model:fight-count="fightCount"
      v-model:show="showPlayerInfoModal"
      :die-stats="dieStats"
      :fight-progress="fightProgress"
      :fight-result="fightResult"
      :format-power="formatPower"
      :is-fight-count-valid="isFightCountValid"
      :legacycolor="legacycolor"
      :player-info="playerInfo"
      @hide-result="fightResult.visible = false"
      @reset-fight="resetFightResult"
      @select-hero="selectHeroInfo"
      @start-duel="handleDuel"
      @validate-fight-count="validateFightCount"
    ></ClubRankFightPanel>

    <ClubRankHeroDetailModal
      v-model:show="showHeroModal"
      :format-power="formatPower"
      :hero="heroModealTemp"
    ></ClubRankHeroDetailModal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from "vue";
import { NPagination, useMessage } from "naive-ui/es";
import ClubRankFightPanel from "@/components/Club/rank/ClubRankFightPanel.vue";
import ClubRankHeroDetailModal from "@/components/Club/rank/ClubRankHeroDetailModal.vue";
import {
  formatClubRankPower,
  formatClubRankScore,
  getClubRankAllianceClass,
  getClubRankRedQuenchClass,
} from "@/components/Club/rank/clubRankFormatters.js";
import { useClubWarrankDuel } from "@/composables/useClubWarrankDuel";
import { useTokenStore } from "@/stores/tokenStore";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import { downloadCanvasAsImage } from "@/utils/imageExport";
import { Copy, DocumentText, Refresh } from "@vicons/ionicons5";
import {
  getFirstSaturdayOfMonth,
  getRankParams,
  getRankQueryDate,
} from "@/utils/clubBattleUtils";
import { allianceincludes } from "@/utils/clubWarrankUtils";
import { HERO_DICT, HeroFillInfo, legacycolor } from "@/utils/HeroList";

defineProps({
  inline: {
    type: Boolean,
    default: false,
  },
});

const exportDom = ref(null);
const message = useMessage();
const tokenStore = useTokenStore();

const loading1 = ref(false);
const rankList = ref([]);
const battleRecords1 = ref(null);
const fullRankList = ref([]);
const currentPage = ref(1);
const pageSize = 20;
const totalClubs = computed(() => fullRankList.value.length);
const currentWarType = ref(null);
const currentTargetDate = ref("");
const queryDate = ref("");

// 新增联盟筛选功能
const activeAlliance = ref("all");

const formatPower = formatClubRankPower;
const formatScore = formatClubRankScore;
const getAllianceClass = getClubRankAllianceClass;
const getRedQuenchClass = getClubRankRedQuenchClass;

const {
  dieStats,
  fightCount,
  fightProgress,
  fightResult,
  handleDuel,
  handleHeroClick,
  heroModealTemp,
  isFightCountValid,
  playerInfo,
  resetFightResult,
  selectHeroInfo,
  showHeroModal,
  showPlayerInfoModal,
  validateFightCount,
} = useClubWarrankDuel({
  HERO_DICT,
  HeroFillInfo,
  formatPower,
  message,
  tokenStore,
});

// 联盟筛选计算属性
const filteredLegionList = computed(() => {
  if (!battleRecords1.value?.legionRankList) {
    return [];
  }

  if (activeAlliance.value === "all") {
    return battleRecords1.value.legionRankList;
  }

  return battleRecords1.value.legionRankList.filter((member) => {
    const memberAlliance = allianceincludes(member.announcement);
    if (activeAlliance.value === "空白") {
      return (
        !member.announcement ||
        member.announcement === 0 ||
        member.announcement === "0"
      );
    }
    return memberAlliance === activeAlliance.value;
  });
});

// 处理图片加载错误
const handleImageError = (event) => {
  event.target.style.display = "none";
};

const pageCache = ref(new Map());

// 分页加载数据
const loadPageData = async (page) => {
  if (fullRankList.value.length === 0) {
    battleRecords1.value = null;
    return;
  }

  // Check cache first
  if (pageCache.value.has(page)) {
    const cachedData = pageCache.value.get(page);
    battleRecords1.value = {
      legionRankList: cachedData,
    };
    return;
  }

  loading1.value = true;
  try {
    const tokenId = tokenStore.selectedToken.id;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const pageItems = fullRankList.value.slice(start, end);

    // Process pageItems (which are rank items)
    const detailPromises = pageItems.map(async (item) => {
      try {
        const detail = await tokenStore.sendMessageWithPromise(
          tokenId,
          "legion_getinfobyid",
          { legionId: item.id },
          10000,
        );

        if (!detail) {
          return {
            ...item,
            id: item.id,
            rank: item.rank || 0,
            redQuench: item.redQuench || 0,
            power: item.power || 0,
            announcement: "未知",
            redno: 0,
            redno1: "0红",
            redno2: "0红",
            redno3: "0红",
            hb1: 0,
            hb2: 0,
            hb3: 0,
            topHeroes: [],
            level: 30,
          };
        }

        const topHeroes = [];
        const members = detail?.legionData?.members || {};

        for (const [roleId, memberData] of Object.entries(members)) {
          topHeroes.push({
            id: roleId,
            name: memberData.name || memberData.custom?.name || "未知",
            headImg: memberData.headImg || memberData.custom?.headImg || "",
            power: memberData?.power || 0,
            redQuench: memberData.custom?.red_quench_cnt || 0,
            holyBeast: memberData.custom?.holy_beast_cnt || 0,
          });
        }

        // Sort and slice top 3
        topHeroes.sort((a, b) => b.redQuench - a.redQuench);
        const top3Heroes = topHeroes.slice(0, 3);

        const redQuenchCounts = top3Heroes.map((hero) => `${hero.redQuench}红`);
        const HolyBeastNum = top3Heroes.map((hero) => hero.holyBeast);

        return {
          ...item,
          id: item.id,
          rank: item.rank || 0,
          serverId: detail?.legionData?.serverId || item.serverId || 0,
          name: detail?.legionData?.name || item.name,
          logo: detail?.legionData?.logo || item.logo,
          redQuench: detail?.legionData?.quenchNum || item.redQuench || 0,
          power: detail?.legionData?.power || item.power || 0,
          sRScore: item.score || 0,
          announcement: detail?.legionData?.announcement || "",
          redno: redQuenchCounts,
          redno1: redQuenchCounts[0] || "0红",
          redno2: redQuenchCounts[1] || "0红",
          redno3: redQuenchCounts[2] || "0红",
          hb1: HolyBeastNum[0] || 0,
          hb2: HolyBeastNum[1] || 0,
          hb3: HolyBeastNum[2] || 0,
          topHeroes: top3Heroes,
          level: detail?.legionData?.level || 30,
        };
      } catch (error) {
        console.error(`查询俱乐部${item.id}详情失败:`, error);
        return {
          ...item,
          id: item.id,
          redQuench: item.redQuench || 0,
          power: item.power || 0,
          topHeroes: [],
          level: 30,
          announcement: "",
        };
      }
    });

    const processedClubs = await Promise.all(detailPromises);

    const sortedLegionList = processedClubs.map((club) => ({
      ...club,
      alliance: allianceincludes(club.announcement),
    }));

    // Save to cache
    pageCache.value.set(page, sortedLegionList);

    battleRecords1.value = {
      legionRankList: sortedLegionList,
    };
  } catch (error) {
    console.error("加载分页数据失败:", error);
    message.error("加载分页数据失败");
  } finally {
    loading1.value = false;
  }
};

const handlePageChange = (page) => {
  currentPage.value = page;
  loadPageData(page);
};

// 查询战绩
const fetchBattleRecords1 = async () => {
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

  loading1.value = true;
  try {
    // 1. Check Date
    const firstSaturday = getFirstSaturdayOfMonth();
    // Simple date comparison: YYYY/MM/DD
    const today = new Date();
    const firstSatDate = new Date(firstSaturday);

    // Reset time to 00:00:00 for accurate date comparison
    const todayDate = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
    );
    const targetDate = new Date(
      firstSatDate.getFullYear(),
      firstSatDate.getMonth(),
      firstSatDate.getDate(),
    );

    if (todayDate < targetDate) {
      message.warning(
        `当前日期在当月第一个周六(${firstSaturday})之前，不可查询`,
      );
      return;
    }

    // 2. Get War Type
    const warTypeResult = await tokenStore.sendMessageWithPromise(
      tokenId,
      "saltroad_getwartype",
      { date: firstSaturday },
      10000,
    );

    if (!warTypeResult || !warTypeResult.warType) {
      message.error("获取岛屿类型失败");
      return;
    }

    const warType = warTypeResult.warType;
    currentWarType.value = warType;

    const rankParams = getRankParams(warType);

    if (!rankParams) {
      message.error("当前榜单只允许青铜、秘蓝、月宫、天宫查询");
      return;
    }

    currentTargetDate.value = rankParams.name;

    // 3. Get Rank List
    queryDate.value = getRankQueryDate();

    const rankResult = await tokenStore.sendMessageWithPromise(
      tokenId,
      "saltroad_getsaltroadwartotalrank",
      {
        date: queryDate.value,
        startRank: rankParams.startRank,
        endRank: rankParams.endRank,
      },
      20000,
    );

    if (
      !rankResult ||
      !rankResult.legionList ||
      rankResult.legionList.length === 0
    ) {
      message.warning("未查询到榜单数据");
      battleRecords1.value = null;
      fullRankList.value = [];
      pageCache.value.clear(); // Clear cache on new search
      return;
    }

    fullRankList.value = rankResult.legionList;
    rankList.value = fullRankList.value;
    pageCache.value.clear(); // Clear cache on new search

    // 4. Load First Page
    currentPage.value = 1;
    await loadPageData(1);

    message.success(`查询成功，共 ${fullRankList.value.length} 条数据`);
  } catch (error) {
    console.error("查询失败:", error);
    message.error(`查询失败: ${error.message}`);
    battleRecords1.value = null;
  } finally {
    loading1.value = false;
  }
};
// 刷新战绩
const handleRefresh1 = () => {
  fetchBattleRecords1();
};

// 导出战绩
const handleExport1 = async () => {
  if (!battleRecords1.value || !battleRecords1.value.legionRankList) {
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

const exportToImage = async () => {
  // 校验：确保DOM已正确绑定
  if (!exportDom.value) {
    throw new Error("未找到要导出的DOM元素");
  }

  try {
    // 获取实际的滚动容器
    const tableContainer = exportDom.value.querySelector(".table-container");
    const realHeight = tableContainer
      ? tableContainer.scrollHeight
      : exportDom.value.scrollHeight;
    const realWidth = tableContainer
      ? tableContainer.scrollWidth
      : exportDom.value.scrollWidth;

    // 5. 用html2canvas渲染DOM为Canvas
    const canvas = await captureWithHtml2canvas(exportDom.value, {
      scale: 2, // 放大2倍，解决图片模糊问题
      useCORS: true, // 允许跨域图片（若DOM内有远程图片，需开启）
      backgroundColor: "#ffffff", // 避免透明背景（默认透明）
      logging: false, // 关闭控制台日志
      height: realHeight, // 确保捕获完整高度
      width: realWidth, // 确保捕获完整宽度
      windowWidth: realWidth, // 设置窗口宽度
      windowHeight: realHeight, // 设置窗口高度
      allowTaint: true, // 允许跨域图片污染画布
      onclone: (clonedDoc) => {
        // 处理外层容器
        const clonedContent = clonedDoc.querySelector(".table-content");
        if (clonedContent) {
          clonedContent.style.height = "auto";
          clonedContent.style.overflow = "visible";
        }

        // 处理滚动容器
        const clonedContainer = clonedDoc.querySelector(".table-container");
        if (clonedContainer) {
          clonedContainer.style.height = "auto";
          clonedContainer.style.overflow = "visible";
        }

        // 处理表头吸顶问题
        const clonedHeader = clonedDoc.querySelector(".table-header");
        if (clonedHeader) {
          clonedHeader.style.position = "static";
        }
      },
    });

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const filename = `${year}年${month}月${getRankParams(currentWarType.value).name}.png`;
    downloadCanvasAsImage(canvas, filename);
  } catch (err) {
    console.error("DOM转图片失败：", err);
    throw new Error("导出图片失败，请重试");
  }
};

// 暴露方法给父组件
defineExpose({
  fetchBattleRecords1,
});

// Inline 模式：挂载后自动拉取
onMounted(() => {
  fetchBattleRecords1();
});
</script>

<style scoped lang="scss">
.modal-w-800 {
  width: min(800px, calc(100vw - 24px));
}

.modal-w-600 {
  width: min(600px, calc(100vw - 24px));
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
  border-bottom: 1px solid var(--border-light);
}

.player-avatar {
  border: 2px solid var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.player-info-detail h3 {
  margin: 0 0 8px 0;
  font-size: var(--font-size-lg);
  font-weight: var(--font-weight-bold);
}

.player-info-detail p {
  margin: 0 0 4px 0;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
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
  font-size: var(--font-size-sm);
  color: var(--text-primary);
  font-weight: var(--font-weight-medium);
  white-space: nowrap;
}

.fight-count-input {
  width: 100px;
}

.fight-count-hint {
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.fight-count-error {
  font-size: var(--font-size-xs);
  color: var(--error-color);
  margin-left: 4px;
}

.fight-progress {
  margin: 15px 0;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.progress-title {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.progress-stats {
  display: flex;
  gap: 15px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.fight-result {
  margin: 15px 0;
  padding: 15px;
  background: var(--bg-secondary);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
}

.fight-result h4 {
  margin: 0 0 12px 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
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
  font-size: var(--font-size-sm);
}

.result-label {
  color: var(--text-secondary);
}

.result-value {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.result-value.win {
  color: var(--success-color);
}

.result-value.loss {
  color: var(--error-color);
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
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-light);
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
    background: var(--bg-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    border: 2px solid var(--border-light);

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .hero-placeholder {
      font-size: 36px;
      font-weight: var(--font-weight-bold);
      color: var(--text-secondary);
    }
  }

  .hero-modal-basic {
    flex: 1;
  }

  .hero-modal-name {
    margin: 0 0 10px 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-bold);
  }

  .hero-modal-stats {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: var(--font-size-sm);
    color: var(--text-secondary);

    .stat-item {
      padding: 4px 8px;
      background: var(--bg-secondary);
      border-radius: var(--border-radius-sm);
      border: 1px solid var(--border-light);
    }
  }

  .hero-modal-details {
    margin-bottom: 20px;

    :deep(.n-descriptions) {
      font-size: var(--font-size-sm);

      .n-descriptions-item-label {
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
      }

      .n-descriptions-item-content {
        color: var(--text-secondary);
      }
    }
  }

  .hero-modal-equipment {
    margin-top: 20px;
  }

  .section-title {
    margin: 0 0 15px 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-bold);
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
    font-size: var(--font-size-sm);
    color: var(--text-primary);
    font-weight: var(--font-weight-medium);
    width: 60px;
  }

  .equipment-slots {
    display: flex;
    gap: 6px;
  }

  .equipment-slot {
    width: 20px;
    height: 20px;
    border: 1px solid var(--border-light);
    border-radius: var(--border-radius-sm);
    background: var(--bg-secondary);
  }

  .equipment-slot.red-slot {
    background: var(--error-color);
    border-color: var(--error-color);
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
  background: var(--bg-secondary);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
}

.result-header {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border-light);
}

.result-title {
  margin: 0;
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
  color: var(--text-primary);
}

.result-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, max-content));
  gap: 10px 18px;
  font-size: var(--font-size-sm);
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
  color: var(--text-secondary);
}

.summary-value {
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
}

.summary-value.win {
  color: var(--success-color);
}

.summary-value.loss {
  color: var(--error-color);
}

.result-list {
  margin-bottom: 15px;
}

.battle-result-item {
  margin-bottom: 10px;
  padding: 12px;
  background: var(--bg-primary);
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
  border-left: 4px solid var(--border-light);
  transition: all var(--transition-fast);
}

.battle-result-item.win {
  border-left-color: var(--success-color);
  background: rgba(var(--success-color-rgb), 0.03);
}

.battle-result-item.loss {
  border-left-color: var(--error-color);
  background: rgba(var(--error-color-rgb), 0.03);
}

.battle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.battle-index {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
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
  font-size: var(--font-size-sm);
}

.side-name {
  display: block;
  font-weight: var(--font-weight-medium);
  color: var(--text-primary);
  margin-bottom: 3px;
}

.side-power {
  display: block;
  color: var(--text-secondary);
  margin-bottom: 2px;
}

.side-die {
  display: block;
  color: var(--text-secondary);
  font-size: var(--font-size-xs);
}

.battle-vs {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
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
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-bold);
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
  background: var(--bg-secondary);
  padding: 12px 16px;
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
  transition: all var(--transition-fast);

  &:hover {
    transform: translateY(-2px);
    box-shadow: var(--shadow-sm);
    border-color: var(--primary-color);
  }
}

.hero-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
}

.hero-name {
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: var(--font-size-xs);
  color: var(--text-secondary);
}

.hero-stats span {
  padding: 2px 6px;
  background: var(--bg-primary);
  border-radius: var(--border-radius-full);
  border: 1px solid var(--border-light);
}

.hero-stats span.opened {
  background: rgba(var(--success-color-rgb), 0.1);
  color: var(--success-color);
  border-color: var(--success-color);
}

.hero-stats span.closed {
  background: rgba(var(--warning-color-rgb), 0.1);
  color: var(--warning-color);
  border-color: var(--warning-color);
}

.empty-heroes {
  background: var(--bg-secondary);
  padding: 30px;
  border-radius: var(--border-radius-sm);
  border: 1px solid var(--border-light);
  text-align: center;
  color: var(--text-secondary);
  font-size: var(--font-size-sm);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.player-id {
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
}

// 主容器样式
// 主容器样式
.club-warrank-container {
  width: 100%;
  height: 100%;
  padding: 0;
  box-sizing: border-box;
  background: var(--bg-primary);
  color: var(--text-primary);
  overflow: hidden;
}

// 卡片样式
.club-warrank-card {
  width: 100%;
  height: 100%;
  background: var(--bg-primary);
  border-radius: 0;
  box-shadow: none;
  overflow: hidden;
  display: flex;
  flex-direction: column;
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
  justify-content: flex-end;
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
        box-shadow: var(--shadow-medium);
      }

      &.refresh-btn {
        background: var(--bg-primary);
        border: 1px solid var(--border-medium);
      }

      &.export-btn {
        background: var(--primary-color);
        color: white;

        &:hover {
          background: var(--primary-color-hover);
        }
      }

      &.sort-btn {
        background: var(--info-color-light);
        color: var(--info-color);
        border: 1px solid var(--info-color);

        &:hover {
          background: var(--info-color-hover);
          color: white;
        }
      }
    }
  }
}

// 公告区域
.announcement-section {
  background: linear-gradient(
    135deg,
    var(--primary-color-light) 0%,
    var(--primary-color) 100%
  );
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  border-radius: var(--border-radius-md);
  box-shadow: var(--shadow-sm);
  flex-shrink: 0;

  .announcement-content {
    display: flex;
    justify-content: center;
    align-items: center;

    .announcement-text {
      color: white;
      font-size: var(--font-size-sm);
      font-weight: var(--font-weight-medium);
      text-align: center;
      line-height: 1.5;
      max-width: 800px;
    }
  }
}

// 联盟分类标签栏
.alliance-tabs-section {
  display: flex;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: var(--spacing-xs);
  gap: var(--spacing-xs);
  flex-shrink: 0;

  .alliance-tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-xs);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius-md);
    font-size: var(--font-size-sm);
    font-weight: var(--font-weight-medium);
    color: white;
    cursor: pointer;
    transition: all var(--transition-fast);
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid transparent;

    &:hover {
      background: rgba(255, 255, 255, 0.25);
      transform: translateY(-1px);
    }

    &.active {
      background: white;
      color: var(--primary-color);
      box-shadow: var(--shadow-medium);
      transform: translateY(-2px);
    }

    &.all {
      background: rgba(255, 255, 255, 0.2);

      &:hover {
        background: rgba(255, 255, 255, 0.3);
      }

      &.active {
        background: white;
        color: var(--primary-color);
      }
    }

    .tab-text {
      font-size: var(--font-size-sm);
    }

    .tab-count {
      font-size: var(--font-size-xs);
      background: rgba(255, 255, 255, 0.3);
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: var(--font-weight-bold);

      .alliance-tab.active & {
        background: var(--primary-color);
        color: white;
      }
    }
  }
}

// 表格内容区
.table-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  height: calc(100% - 200px);

  // 加载状态
  .loading-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    background: var(--bg-primary);
    height: 100%;

    :deep(.n-spin) {
      font-size: var(--font-size-lg);

      .n-spin-description {
        font-size: var(--font-size-sm);
        color: var(--text-secondary);
      }
    }
  }

  // 空状态
  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1;
    background: var(--bg-primary);
    height: 100%;

    :deep(.n-empty) {
      font-size: var(--font-size-sm);

      .n-empty-description {
        color: var(--text-secondary);
      }
    }
  }

  // 表格容器
  .table-container {
    flex: 1;
    overflow: auto;
    background: var(--bg-primary);
    height: 100%;

    // 滚动条样式
    ::-webkit-scrollbar {
      width: 8px;
      height: 8px;
    }

    ::-webkit-scrollbar-track {
      background: var(--bg-secondary);
      border-radius: var(--border-radius-sm);
    }

    ::-webkit-scrollbar-thumb {
      background: var(--border-medium);
      border-radius: var(--border-radius-sm);

      &:hover {
        background: var(--border-dark);
      }
    }

    // 表格标题行
    .table-header {
      display: flex;
      background: linear-gradient(
        180deg,
        var(--bg-secondary) 0%,
        var(--bg-primary) 100%
      );
      border-bottom: 2px solid var(--border-medium);
      font-weight: var(--font-weight-bold);
      color: var(--text-primary);
      font-size: var(--font-size-sm);
      padding: var(--spacing-xs) var(--spacing-sm);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

      // 确保所有标题头居中对齐
      .table-cell {
        justify-content: center;
      }
    }

    // 表格数据行
    .table-row {
      display: flex;
      align-items: center;
      padding: var(--spacing-xs) var(--spacing-sm);
      border-bottom: 1px solid var(--border-light);
      transition: all var(--transition-fast);
      background: var(--bg-primary);

      &:hover {
        background: var(--bg-secondary);
        transform: translateX(2px);
        box-shadow: inset 3px 0 0 var(--primary-color);
      }

      &:last-child {
        border-bottom: none;
      }

      // 联盟样式类
      &.alliance-large {
        .alliance-tag {
          background: var(--primary-color);
        }
      }

      &.alliance-dream {
        .alliance-tag {
          background: var(--success-color);
        }
      }

      &.alliance-xin-justice {
        .alliance-tag {
          background: var(--info-color);
        }
      }

      &.alliance-dragon {
        .alliance-tag {
          background: var(--error-color);
        }
      }

      &.alliance-unknown {
        .alliance-tag {
          background: var(--warning-color);
        }
      }

      &.alliance-other {
        .alliance-tag {
          background: var(--text-secondary);
        }
      }
    }

    // 表格单元格
    .table-cell {
      display: flex;
      align-items: center;
      padding: 0 var(--spacing-xs);
      font-size: var(--font-size-sm);
      color: var(--text-primary);

      // 单元格宽度分配
      &.rank {
        width: 90px;
        min-width: 90px;
        justify-content: center;
        font-weight: var(--font-weight-bold);
        color: var(--text-primary);
        padding: 4px 8px;

        .rank-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          padding: 4px 0;
        }

        .rank-medal {
          position: relative;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: var(--font-size-base);
          color: white;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
          margin: 0 6px;

          &::before {
            content: attr(data-rank);
          }

          &.gold {
            background: linear-gradient(135deg, #ffd700 0%, #ffa500 100%);

            &::before {
              content: "1";
            }
          }

          &.silver {
            background: linear-gradient(135deg, #c0c0c0 0%, #a9a9a9 100%);

            &::before {
              content: "2";
            }
          }

          &.bronze {
            background: linear-gradient(135deg, #cd7f32 0%, #b87333 100%);

            &::before {
              content: "3";
            }
          }
        }

        .rank-number {
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-bold);
          color: var(--text-primary);
          margin: 0 6px;
        }
      }

      &.alliance {
        width: 80px;
        min-width: 80px;

        .alliance-tag {
          display: inline-block;
          padding: 3px 8px;
          border-radius: var(--border-radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          color: white;
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
          transition: all var(--transition-fast);

          &:hover {
            transform: scale(1.05);
            box-shadow: var(--shadow-medium);
          }
        }
      }

      &.avatar {
        width: 50px;
        min-width: 50px;
        justify-content: center;

        .member-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--border-light);
          transition: all var(--transition-fast);

          &:hover {
            transform: scale(1.2);
            box-shadow: var(--shadow-medium);
            border-color: var(--primary-color);
          }
        }

        .member-avatar-placeholder {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            var(--primary-color) 0%,
            var(--primary-color-light) 100%
          );
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--font-size-md);
          font-weight: var(--font-weight-bold);
          border: 2px solid var(--border-light);
        }
      }

      &.name {
        width: 120px;
        min-width: 120px;
        font-weight: var(--font-weight-medium);
        color: var(--text-primary);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      &.red-quench {
        width: 80px;
        min-width: 80px;
        color: var(--primary-color);
        font-weight: var(--font-weight-medium);
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 4px;

        &::before {
          content: "";
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--error-color);
        }
      }

      &.score {
        width: 80px;
        min-width: 80px;
        font-weight: var(--font-weight-medium);
        color: var(--warning-color);
        justify-content: center;
        text-align: center;
      }

      &.first-3 {
        width: 350px;
        min-width: 405px;

        .hero-avatars {
          display: flex;
          gap: var(--spacing-xs);
          align-items: center;
          justify-content: flex-start;
          width: 100%;
          flex-wrap: nowrap;
          padding: var(--spacing-xs) 0;
          overflow: hidden;
        }

        .hero-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: calc(var(--spacing-xs) / 2);
          padding: calc(var(--spacing-xs) / 2);
          background: var(--bg-secondary);
          border-radius: var(--border-radius-sm);
          border: 1px solid var(--border-light);
          transition: all var(--transition-fast);
          min-width: 120px;
          flex: 1;
          max-width: 130px;
          cursor: pointer;

          &:hover {
            background: var(--bg-primary);
            transform: translateY(-2px);
            box-shadow: var(--shadow-medium);
            border-color: var(--primary-color);
          }

          &:active {
            transform: translateY(0);
            box-shadow: var(--shadow-sm);
          }
        }

        /* 覆盖全局hero-stats span样式，确保战力和红数正常显示 */
        .hero-stats span {
          padding: 0;
          background: none;
          border: none;
          border-radius: 0;
        }

        .hero-avatar-container {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          cursor: pointer;
        }

        .hero-avatar {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          object-fit: cover;
          border: 2px solid var(--border-light);
          transition: all var(--transition-fast);
          cursor: pointer;

          &:hover {
            transform: scale(1.1);
            border-color: var(--primary-color);
          }

          &:active {
            transform: scale(0.95);
          }
        }

        .hero-avatar-placeholder {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(
            135deg,
            var(--primary-color) 0%,
            var(--primary-color-light) 100%
          );
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: var(--font-size-sm);
          font-weight: var(--font-weight-bold);
          border: 2px solid var(--border-light);
          cursor: pointer;
          transition: all var(--transition-fast);

          &:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          }

          &:active {
            transform: scale(0.95);
          }
        }

        .hero-holy-beast {
          position: absolute;
          right: -5px;
          bottom: -5px;
          display: flex;
          align-items: center;
          gap: 2px;
          background: linear-gradient(135deg, #ff6b6b, #ee5a24);
          color: white;
          padding: 2px 6px;
          border-radius: var(--border-radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-bold);
          box-shadow: var(--shadow-sm);
          border: 2px solid var(--bg-primary);
          z-index: 10;

          .holy-beast-icon {
            font-size: var(--font-size-sm);
          }

          .holy-beast-count {
            font-size: var(--font-size-xs);
          }
        }

        .hero-info {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          width: 100%;
        }

        .hero-name {
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          color: var(--text-primary);
          text-align: center;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          width: 100%;
        }

        .hero-stats {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: var(--spacing-xs);
          font-size: var(--font-size-xs);
        }

        .hero-power,
        .hero-redquench {
          display: inline-block;
        }

        .hero-power {
          color: var(--text-primary);
          font-weight: var(--font-weight-medium);
        }

        .hero-redquench {
          font-weight: var(--font-weight-bold);
          padding: 1px 6px;
          border-radius: var(--border-radius-full);

          &.redquench-high {
            color: var(--error-color);
            background: rgba(var(--error-color-rgb), 0.1);
          }

          &.redquench-medium {
            color: var(--warning-color);
            background: rgba(var(--warning-color-rgb), 0.1);
          }

          &.redquench-low {
            color: var(--success-color);
            background: rgba(var(--success-color-rgb), 0.1);
          }
        }
      }

      &.power {
        width: 100px;
        min-width: 100px;
        justify-content: center;
        font-weight: var(--font-weight-bold);
        color: var(--primary-color);
        font-size: var(--font-size-base);
        text-align: center;
      }

      &.level {
        width: 70px;
        min-width: 70px;
        justify-content: center;

        &::before {
          content: "Lv.";
          font-size: var(--font-size-xs);
          color: var(--text-secondary);
          margin-right: 2px;
        }

        span {
          display: inline-block;
          padding: 2px 8px;
          background: linear-gradient(
            135deg,
            var(--primary-color-light) 0%,
            var(--primary-color) 100%
          );
          color: white;
          border-radius: var(--border-radius-full);
          font-weight: var(--font-weight-bold);
          font-size: var(--font-size-sm);
        }
      }

      &.server {
        width: 80px;
        min-width: 80px;
        justify-content: center;
        color: var(--text-secondary);
        font-size: var(--font-size-sm);
        text-align: center;
      }

      &.announcement {
        flex: 1;
        min-width: 150px;
        color: var(--text-secondary);
        white-space: normal;
        overflow: visible;
        text-overflow: clip;
        font-size: var(--font-size-xs);
        line-height: 1.4;
        min-height: 24px;
        word-break: break-all;
      }
    }
  }
}

// 按钮样式调整
:deep(.n-button) {
  font-size: var(--font-size-sm);
  padding: 6px 12px;
  border-radius: var(--border-radius-sm);

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

// 输入框样式调整
:deep(.n-input-wrapper) {
  font-size: var(--font-size-sm);
}

// 响应式设计
@media (max-width: 1200px) {
  .header-section {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);

    .stats-section {
      width: 100%;
      justify-content: flex-start;
    }
  }

  .function-section {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-md);

    .function-right {
      width: 100%;
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: var(--spacing-sm);
    }
  }

  .alliance-tabs-section {
    overflow-x: auto;
    justify-content: flex-start;

    .alliance-tab {
      flex: 0 0 auto;
      white-space: nowrap;
    }
  }

  .table-container {
    font-size: var(--font-size-xs);

    .table-header {
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .table-row {
      padding: var(--spacing-xs) var(--spacing-sm);
    }

    .table-cell {
      padding: 0 var(--spacing-xs);
      font-size: var(--font-size-xs);

      &.rank {
        width: 50px;
        min-width: 50px;
      }

      &.alliance {
        width: 100px;
        min-width: 100px;
      }

      &.avatar {
        width: 50px;
        min-width: 50px;

        .member-avatar,
        .member-avatar-placeholder {
          width: 32px;
          height: 32px;
        }
      }

      &.name {
        width: 120px;
        min-width: 120px;
      }

      &.score,
      &.red-quench {
        width: 80px;
        min-width: 80px;
      }

      &.first-3 {
        width: 350px;
        min-width: 350px;

        .hero-card {
          min-width: 80px;

          .hero-avatar,
          .hero-avatar-placeholder {
            width: 40px;
            height: 40px;
          }

          .hero-name {
            font-size: var(--font-size-xs);
          }

          .hero-stats {
            font-size: var(--font-size-xs);
          }
        }
      }

      &.power {
        width: 100px;
        min-width: 100px;
      }

      &.level,
      &.server {
        width: 70px;
        min-width: 70px;
      }

      &.announcement {
        min-width: 150px;
      }
    }
  }
}

@media (max-width: 768px) {
  .club-warrank-container {
    padding: var(--spacing-xs);
  }

  .header-section {
    padding: var(--spacing-md);
  }

  .function-section {
    padding: var(--spacing-xs) var(--spacing-md);
  }

  .function-section .function-right {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--spacing-xs);
  }

  .function-section .function-right .action-btn {
    width: 100%;
    margin: 0;
    justify-content: center;
  }

  .function-section .function-right :deep(.n-date-picker) {
    grid-column: 1 / -1;
    width: 100% !important;
    max-width: 100%;
  }

  .alliance-tabs-section {
    padding: var(--spacing-xs) var(--spacing-xs);
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  .alliance-tabs-section .alliance-tab {
    flex: 0 0 auto;
    white-space: nowrap;
  }
}

.pagination-container {
  display: flex;
  justify-content: center;
  margin-top: 16px;
  padding: 10px 0;
}
</style>
