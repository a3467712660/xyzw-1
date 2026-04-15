<template>
  <MyCard class="club-info" :status-class="{ active: !!club }">
    <template #icon>
      <img alt="俱乐部图标" src="/icons/1733492491706152.png">
    </template>
    <template #title>
      <h3>俱乐部信息</h3>
      <p>军团/俱乐部概览与成员</p>
    </template>
    <template #badge>
      <span>{{ club ? "已加入" : "暂无俱乐部" }}</span>
    </template>
    <template #default>
      <div v-if="!club" class="empty-club">
        <n-empty description="暂无俱乐部"></n-empty>
        <div class="actions">
          <NButton size="small" @click="refreshClub">刷新</NButton>
        </div>
      </div>
      <div v-else>
        <div class="toolbar">
          <NSpace size="small">
            <!-- 申请列表按钮 -->
            <NButton
v-if="canKick"
size="small"
@click="getApplyList"
              >申请列表</NButton
            >
            <NButton size="small" @click="refreshClub">刷新</NButton>
          </NSpace>
        </div>

        <ClubApplyListModal
          v-model:show="showApplyList"
          :items="applyListItems"
          :loading="loadingApply"
          @approve="approveApply"
          @approve-all="approveAll"
          @reject="rejectApply"
          @reject-all="rejectAll"
        ></ClubApplyListModal>

        <n-tabs animated type="line" v-model:value="activeTab">
          <n-tab-pane display-directive="show:lazy" name="overview" tab="概览">
            <div class="overview">
              <ClubInfoSummaryPanel
                :club="club"
                :club-overview="clubOverview"
                :format-number="formatNumber"
                :leader="leader"
                :legion-signed-in="legionSignedIn"
                :member-count="memberCount"
                @sign-in="signInLegion"
              ></ClubInfoSummaryPanel>
            </div>
          </n-tab-pane>

          <n-tab-pane display-directive="show:lazy" name="members" tab="成员">
            <div ref="exportDom" class="members" :class="{ 'is-exporting-image': isExporting }">
              <ClubMemberListPanel
                flex-height
                show-index
                empty-description="暂无成员"
                title="俱乐部成员详细"
                :is-mobile="isMobileView"
                :mobile-items="clubMobileMembers"
                :row-key="(row) => row.roleId"
                :scroll-x="650"
              :table-columns="memberColumns"
              :table-data="topMembers"
              @action="handleClubMemberAction"
              @select="handleClubMemberSelect"
            >
              <template #toolbar>
                <ClubMemberActionPanel
                  :banner-model="memberExportBannerModel"
                  :export-disabled="isExporting"
                  :fetch-lineup-disabled="batchLoading"
                  :is-exporting="isExporting"
                  @export-image="handleExportImage"
                  @fetch-lineup="fetchAllMembersLineup"
                ></ClubMemberActionPanel>
              </template>
              </ClubMemberListPanel>
            </div>
          </n-tab-pane>

          <n-tab-pane
            display-directive="show:lazy"
            name="history"
            tab="俱乐部历史战绩"
          >
            <ClubHistoryRecords inline></ClubHistoryRecords>
          </n-tab-pane>

          <n-tab-pane
            display-directive="show:lazy"
            name="weirdtower"
            tab="怪异塔信息"
          >
            <ClubWeirdTowerInfo inline></ClubWeirdTowerInfo>
          </n-tab-pane>

          <n-tab-pane
            display-directive="show:lazy"
            name="carsocre"
            tab="赛车积分信息"
          >
            <CarScoreInfo inline></CarScoreInfo>
          </n-tab-pane>
        </n-tabs>
      </div>
    </template>
  </MyCard>

  <!-- 玩家信息模态框 -->
  <ClubMemberDetailModal
    :format-power="formatNumber"
    :legacy-map="legacycolor"
    :player="playerInfo"
    :show="showPlayerInfoModal"
    @select-hero="selectHeroInfo"
    @update:show="showPlayerInfoModal = $event"
  ></ClubMemberDetailModal>

  <ClubRankHeroDetailModal
    :format-power="formatNumber"
    :hero="heroModealTemp"
    :show="showHeroModal"
    @update:show="showHeroModal = $event"
  ></ClubRankHeroDetailModal>
</template>

<script setup>
import { computed, h, nextTick, onMounted, onUnmounted, ref, watch } from "vue";
import {
  NButton,
  NSpace,
  NTag,
  useDialog,
  useMessage,
} from "naive-ui/es";
import { useTokenStore } from "@/stores/tokenStore";
import ClubHistoryRecords from "./ClubHistoryRecords.vue";
import ClubWeirdTowerInfo from "./ClubWeirdTowerInfo.vue";
import CarScoreInfo from "./CarScoreInfo.vue";
import ClubInfoSummaryPanel from "./info/ClubInfoSummaryPanel.vue";
import ClubMemberListPanel from "./info/ClubMemberListPanel.vue";
import ClubMemberDetailModal from "./info/ClubMemberDetailModal.vue";
import ClubMemberActionPanel from "./info/ClubMemberActionPanel.vue";
import ClubApplyListModal from "./info/ClubApplyListModal.vue";
import ClubRankHeroDetailModal from "./rank/ClubRankHeroDetailModal.vue";
import {
  getLineupType,
  HERO_DICT,
  HeroFillInfo,
  legacycolor,
  LINEUP_RULES,
} from "@/utils/HeroList";
import {
  formatClubInfoNumber,
  formatClubRedQuenchLabel,
  getClubJobLabel,
  getClubJobTagColor,
  getClubLineupTagColor,
  getClubMemberPowerValue,
  getClubMemberRedQuenchValue,
  sortClubMembersByPriority,
} from "./info/clubInfoFormatters.js";
import {
  buildClubMemberCardModel,
  buildClubMemberHeroChips,
  getClubMemberAvatarFallback,
} from "./info/clubMemberDisplayHelpers.js";
import {
  buildClubApplyDisplayModel,
  buildClubMemberExportBannerModel,
} from "./info/clubInfoDisplayHelpers.js";
import { useClubAdminActions } from "@/composables/useClubAdminActions";
import { captureWithHtml2canvas } from "@/utils/html2canvasLoader";
import { downloadCanvasAsImage } from "@/utils/imageExport";

const tokenStore = useTokenStore();
const message = useMessage();
const dialog = useDialog();

const info = computed(() => tokenStore.gameData?.legionInfo || null);
const club = computed(() => info.value?.info || null);

const membersObj = computed(() => club.value?.members || {});
const members = computed(() => Object.values(membersObj.value || {}));
const memberCount = computed(() => members.value.length);

const leader = computed(() => {
  const lid = club.value?.leaderId;
  if (!lid) return null;
  return members.value.find((m) => Number(m.roleId) === Number(lid)) || null;
});

const topMembers = computed(() => sortClubMembersByPriority(members.value));

const showPlayerInfoModal = ref(false);
const playerInfo = ref(null);
const queryLoading = ref(false);
const showHeroModal = ref(false);
const heroModealTemp = ref(null);
const batchLoading = ref(false);
const isExporting = ref(false);
const exportDom = ref(null);
const isMobileView = ref(false);
const memberExportTimeText = computed(() => {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
});

const memberExportBannerModel = computed(() =>
  buildClubMemberExportBannerModel({
    clubName: club.value?.name,
    exportedAt: memberExportTimeText.value,
    memberCount: topMembers.value.length,
  }),
);

const applyListItems = computed(() =>
  applyList.value.map((apply) =>
    buildClubApplyDisplayModel(apply, formatNumber),
  ),
);

const clubMobileMembers = computed(() =>
  topMembers.value.map((member) =>
    buildClubMemberCardModel({
      actionLabel: canKick.value && member.job !== 1 ? "踢出成员" : "",
      actionType: "error",
      avatar: member.headImg,
      avatarText: getClubMemberAvatarFallback(member.name),
      badges: [
        {
          color: getClubJobTagColor(member.job),
          text: getClubJobLabel(member.job),
        },
      ],
      id: member.roleId,
      lineupTag: member.lineupType
        ? {
            color: getClubLineupTagColor(member.lineupType, LINEUP_RULES),
            text: member.lineupType,
          }
        : {
            color: {},
            text: "-",
          },
      metrics: [
        {
          label: "战力",
          value: formatClubInfoNumber(getClubMemberPowerValue(member)),
        },
        {
          className: "red",
          label: "红淬",
          value: formatClubRedQuenchLabel(getClubMemberRedQuenchValue(member)),
        },
      ],
      name: member.name,
      raw: member,
      subtext: `ID: ${member.roleId}`,
    }),
  ),
);

const updateViewportMode = () => {
  const ua = navigator.userAgent || "";
  const isMobileUA =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  const isSmallScreen = window.innerWidth <= 900;
  isMobileView.value = isMobileUA || isSmallScreen;
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

      // 兼容 id 和 heroId
      const id = hero.heroId || hero.id;

      const heroInfo = HERO_DICT[id] || {};
      const equipmentInfo = hero.equipment
        ? getEquipment(hero.equipment)
        : { redCount: 0, holeCount: 0 };

      // 检查英雄基本信息
      const heroId = id || `unknown_${index}`;
      const heroName =
        hero.heroName || hero.name || heroInfo.name || `未知武将_${index}`;

      const tempObj = {
        heroId, // 英雄ID
        artifactId: hero.artifactId || "", // 英雄装备ID，用于匹配鱼灵信息
        power: hero.power || 0, // 英雄战力
        star: hero.star || 0, // 英雄星级
        equipment: hero.equipment, // 英雄具体孔数和红数
        heroName, // 英雄姓名
        heroAvate: hero.heroAvate || hero.headImg || heroInfo.avatar || "",
        level: hero.level || 0, // 英雄等级
        hole: equipmentInfo.holeCount, // 英雄开孔数量
        red: equipmentInfo.redCount, // 英雄红数
        // 兼容 hB 和 fourBasest
        HolyBeast: hero.hB?.active === true || hero.fourBasest?.level > 0, // 激活四圣
        HBlevel: hero.hB?.order || hero.fourBasest?.level || 0, // 四圣等级
        // 添加英雄详情信息
        skillList: hero.skillList || [],
        attributeList: hero.attributeList || [],
        battleTeamSlot: hero.battleTeamSlot, // 阵容站位
      };

      // 只添加有效的英雄
      if (heroId) {
        redCount += tempObj.red;
        holeCount += tempObj.hole;
        heroList.push(tempObj);
      }
    });
  } catch (error) {
    console.error("处理英雄信息时发生错误:", error);
    heroList = [];
  }
  // 按站位排序
  heroList.sort((a, b) => a.battleTeamSlot - b.battleTeamSlot);

  return { redCount, holeCount, heroList };
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

const selectHeroInfo = (heroInfo) => {
  showHeroModal.value = true;
  heroModealTemp.value = heroInfo;
};

const handleExportImage = async () => {
  // 校验：确保DOM已正确绑定
  if (!exportDom.value) {
    message.error("未找到要导出的内容");
    return;
  }

  try {
    isExporting.value = true;
    message.loading("正在生成图片，请稍候...");

    // 等待Vue更新DOM（移除操作列等）
    await nextTick();

    const isMobileExport =
      isMobileView.value ||
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent || "",
      );

    // 桌面端临时放大导出区域，避免成员列（尤其阵容）被压缩
    exportDom.value.dataset.originalWidth = exportDom.value.style.width;
    exportDom.value.dataset.originalMinWidth = exportDom.value.style.minWidth;
    exportDom.value.dataset.originalMaxWidth = exportDom.value.style.maxWidth;
    exportDom.value.dataset.originalOverflow = exportDom.value.style.overflow;
    if (!isMobileExport) {
      exportDom.value.style.width = "1200px";
      exportDom.value.style.minWidth = "1200px";
      exportDom.value.style.maxWidth = "none";
      exportDom.value.style.overflow = "visible";
    } else {
      exportDom.value.style.width = "100%";
      exportDom.value.style.minWidth = "0";
      exportDom.value.style.maxWidth = "100%";
      exportDom.value.style.overflow = "visible";
    }

    // 获取 table-container
    const tableContainer = exportDom.value.querySelector(".n-data-table");

    // 临时调整表格容器高度，确保所有内容可见
    if (tableContainer) {
      // 尝试找到 n-data-table 的滚动容器
      const scrollContainer = tableContainer.querySelector(
        ".n-data-table-base-table-body",
      );
      if (scrollContainer) {
        // 保存原始样式
        scrollContainer.dataset.originalHeight = scrollContainer.style.height;
        scrollContainer.dataset.originalOverflow =
          scrollContainer.style.overflow;

        // 强制展开
        scrollContainer.style.height = "auto";
        scrollContainer.style.overflow = "visible";
      }

      // 保存外层table容器的样式
      tableContainer.dataset.originalHeight = tableContainer.style.height;
      tableContainer.dataset.originalWidth = tableContainer.style.width;
      tableContainer.dataset.originalMinWidth = tableContainer.style.minWidth;
      tableContainer.style.height = "auto";
      tableContainer.style.width = "100%";
      tableContainer.style.minWidth = isMobileExport ? "0" : "1180px";
    }

    // 5. 用html2canvas渲染DOM为Canvas
    const canvas = await captureWithHtml2canvas(exportDom.value, {
      scale: isMobileExport ? 3 : 2, // 手机端提高导出清晰度
      useCORS: true, // 允许跨域图片
      backgroundColor: "#ffffff", // 避免透明背景
      logging: false, // 关闭控制台日志
      allowTaint: true, // 允许跨域图片污染画布
    });

    // 6. Canvas转图片链接并下载
    const dateStr = new Date().toLocaleDateString().replace(/\//g, "-");
    const filename = `俱乐部成员信息_${dateStr}.png`;
    downloadCanvasAsImage(canvas, filename);

    message.success("图片导出成功");
  } catch (err) {
    console.error("DOM转图片失败：", err);
    message.error("导出图片失败，请重试");
  } finally {
    // 恢复原始样式
    const tableContainer = exportDom.value?.querySelector(".n-data-table");
    if (tableContainer) {
      const scrollContainer = tableContainer.querySelector(
        ".n-data-table-base-table-body",
      );
      if (scrollContainer) {
        if (scrollContainer.dataset.originalHeight) {
          scrollContainer.style.height = scrollContainer.dataset.originalHeight;
        } else {
          scrollContainer.style.removeProperty("height");
        }

        if (scrollContainer.dataset.originalOverflow) {
          scrollContainer.style.overflow =
            scrollContainer.dataset.originalOverflow;
        } else {
          scrollContainer.style.removeProperty("overflow");
        }

        delete scrollContainer.dataset.originalHeight;
        delete scrollContainer.dataset.originalOverflow;
      }

      // 恢复外层table容器样式
      if (tableContainer.dataset.originalHeight) {
        tableContainer.style.height = tableContainer.dataset.originalHeight;
      } else {
        tableContainer.style.removeProperty("height");
      }
      if (tableContainer.dataset.originalWidth) {
        tableContainer.style.width = tableContainer.dataset.originalWidth;
      } else {
        tableContainer.style.removeProperty("width");
      }
      if (tableContainer.dataset.originalMinWidth) {
        tableContainer.style.minWidth = tableContainer.dataset.originalMinWidth;
      } else {
        tableContainer.style.removeProperty("min-width");
      }
      delete tableContainer.dataset.originalHeight;
      delete tableContainer.dataset.originalWidth;
      delete tableContainer.dataset.originalMinWidth;
    }

    // 恢复导出容器样式
    if (exportDom.value) {
      if (exportDom.value.dataset.originalWidth) {
        exportDom.value.style.width = exportDom.value.dataset.originalWidth;
      } else {
        exportDom.value.style.removeProperty("width");
      }
      if (exportDom.value.dataset.originalMinWidth) {
        exportDom.value.style.minWidth =
          exportDom.value.dataset.originalMinWidth;
      } else {
        exportDom.value.style.removeProperty("min-width");
      }
      if (exportDom.value.dataset.originalMaxWidth) {
        exportDom.value.style.maxWidth =
          exportDom.value.dataset.originalMaxWidth;
      } else {
        exportDom.value.style.removeProperty("max-width");
      }
      if (exportDom.value.dataset.originalOverflow) {
        exportDom.value.style.overflow =
          exportDom.value.dataset.originalOverflow;
      } else {
        exportDom.value.style.removeProperty("overflow");
      }
      delete exportDom.value.dataset.originalWidth;
      delete exportDom.value.dataset.originalMinWidth;
      delete exportDom.value.dataset.originalMaxWidth;
      delete exportDom.value.dataset.originalOverflow;
    }

    isExporting.value = false;
  }
};

// 查询玩家信息
const fetchTargetInfo = async (roleId) => {
  if (!tokenStore.selectedToken) {
    message.warning("请先选择游戏角色");
    return;
  }

  const tokenId = tokenStore.selectedToken.id;
  const wsStatus = tokenStore.getWebSocketStatus(tokenId);
  if (wsStatus !== "connected") {
    message.error("WebSocket未连接，无法查询信息");
    return;
  }

  queryLoading.value = true;

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
      message.warning("未查询到玩家信息");
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

    // 计算阵容类型
    const lineupType = getLineupType(heroAndholdAndRed.heroList);

    // 更新本地成员列表中的阵容信息（如果存在）
    if (
      tokenStore.gameData?.legionInfo?.info?.members &&
      tokenStore.gameData.legionInfo.info.members[roleId]
    ) {
      tokenStore.gameData.legionInfo.info.members[roleId].lineupType =
        lineupType;
    }

    const playerData = {
      id: roleId,
      name: result.roleInfo.name,
      headImg: result.roleInfo.headImg,
      power: result.roleInfo.power,
      level: result.roleInfo.level,
      serverName: result.roleInfo.serverName,
      legionName: result.legionInfo?.name || "无",
      redQuench: roleRedQuench,
      holyBeast: heroAndholdAndRed.heroList.filter((hero) => hero.HolyBeast)
        .length,
      maxPower: formatNumber(legionMaxPower),
      currentRedDrum: roleRedQuench,
      maxRedDrum: roleMaxRed,
      totalRedCount,
      totalHoleCount,
      legionRedQuench,
      legionMaxRed,
      heroList: heroAndholdAndRed.heroList,
      legacy: result.roleInfo.legacy?.color || 0,
      lineupType,
    };

    playerInfo.value = playerData;
    showPlayerInfoModal.value = true;
    message.success("查询成功");
  } catch (error) {
    message.error(`查询失败: ${error.message}`);
    console.error("查询失败详细信息:", error);
  } finally {
    queryLoading.value = false;
  }
};

// 成员表格列定义
const memberColumns = computed(() => {
  const cols = [
    {
      title: "序号",
      key: "index",
      width: 60,
      align: "center",
      render: (_, index) => index + 1,
    },
    {
      title: "头像",
      key: "headImg",
      width: 60,
      align: "center",
      render: (row) => {
        if (row.headImg) {
          return h("img", {
            src: row.headImg,
            class: "member-avatar-cell",
            style: {
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              objectFit: "cover",
            },
            alt: row.name,
          });
        }
        return h(
          "div",
          {
            class: "member-avatar-placeholder-cell",
            style: {
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              background: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              color: "#999",
            },
          },
          row.name?.charAt(0) || "?",
        );
      },
    },
    {
      title: "成员",
      key: "name",
      align: "left",
      minWidth: 150, // 增加最小宽度
      render: (row) => {
        return h(
          "div",
          {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center", // 垂直居中
              cursor: "pointer",
              whiteSpace: isExporting.value ? "normal" : "nowrap",
              wordBreak: isExporting.value ? "break-all" : "normal",
            },
            onClick: () => fetchTargetInfo(row.roleId),
          },
          [
            h(
              "span",
              {
                style: {
                  fontWeight: "500",
                  color: "#1890ff",
                  lineHeight: "1.2",
                },
              },
              row.name,
            ),
            h(
              "span",
              {
                style: {
                  fontSize: "12px",
                  color: "#999",
                  lineHeight: "1.2",
                  marginTop: "2px",
                },
              },
              `ID: ${row.roleId}`,
            ),
          ],
        );
      },
    },
    {
      title: "战力",
      key: "power",
      width: 100,
      align: "center",
      render: (row) => formatNumber(row.power || row.custom?.s_power || 0),
    },
    {
      title: "红淬",
      key: "redQuench",
      width: 80,
      align: "center",
      render: (row) =>
        h(
          "span",
          { style: { color: "#ff4d4f" } },
          redQuenchlabel(row.custom?.red_quench_cnt || 0),
        ),
    },
    {
      title: "阵容",
      key: "lineupType",
      width: 80,
      align: "center",
      render: (row) => {
        if (!row.lineupType) return "-";
        const rule = LINEUP_RULES.find((r) => r.name === row.lineupType);
        const colorProps = rule ? rule.colorProps : {};
        return h(
          NTag,
          {
            size: "small",
            bordered: false,
            color: colorProps,
          },
          { default: () => row.lineupType },
        );
      },
    },
  ];

  cols.push({
    title: "职位",
    key: "job",
    width: 80,
    align: "center",
    render: (row) =>
      h(
        NTag,
        {
          size: "small",
          bordered: false,
          color: getJobTagColor(row.job),
        },
        { default: () => jobLabel(row.job) },
      ),
  });

  if (canKick.value && !isExporting.value) {
    cols.push({
      title: "操作",
      key: "actions",
      width: 80,
      align: "center",
      render: (row) => {
        if (row.job !== 1) {
          return h(
            NButton,
            {
              size: "tiny",
              type: "error",
              ghost: true,
              style: { fontSize: "12px" },
              onClick: () => kickMember(row.roleId, row.name),
            },
            { default: () => "踢出" },
          );
        }
        return null;
      },
    });
  }

  return [
    {
      title: () =>
        h(
          "div",
          {
            style: {
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              width: "100%",
              padding: "0 8px",
            },
          },
          [
            h(
              "span",
              {
                style: { fontSize: "16px", fontWeight: "bold", color: "#333" },
              },
              "俱乐部成员详情",
            ),
          ],
        ),
      key: "title_group",
      align: "center",
      children: cols,
    },
  ];
});

// 获取当前角色在俱乐部中的职位
const currentMemberJob = computed(() => {
  const roleId = tokenStore.gameData?.roleInfo?.role?.roleId;
  if (!roleId) return 0;
  const currentMember = members.value.find(
    (m) => Number(m.roleId) === Number(roleId),
  );
  return currentMember?.job || 0;
});

// 检查是否有踢人权限（会长或副会长）
const canKick = computed(() => {
  return [1, 2].includes(currentMemberJob.value);
});

const activeTab = ref("overview");

// 申请列表状态
const showApplyList = ref(false);
const loadingApply = ref(false);
const applyList = ref([]);

// 组件挂载时添加事件监听器
onMounted(() => {
  updateViewportMode();
  window.addEventListener("resize", updateViewportMode);
  // 监听申请列表响应事件（已改为Promise直接处理，不再监听）
  // $emit.on("legion_applylistresp", handleApplyListResp);
});

watch(activeTab, (val) => {
  if (val === "members" && !batchLoading.value) {
    const hasLineup = members.value.some((m) => m.lineupType);
    if (!hasLineup) {
      fetchAllMembersLineup();
    }
  }
});

// 组件卸载时移除事件监听器
onUnmounted(() => {
  window.removeEventListener("resize", updateViewportMode);
  // 移除申请列表响应事件监听（已改为Promise直接处理，不再监听）
  // $emit.off("legion_applylistresp", handleApplyListResp);
});

// 今日是否已进行俱乐部签到
const legionSignedIn = computed(() => {
  const ts = Number(
    tokenStore.gameData?.roleInfo?.role?.statisticsTime?.["legion:sign:in"] ||
      0,
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todaySec = Math.floor(today.getTime() / 1000);
  return ts > todaySec;
});

const signInLegion = () => {
  const token = tokenStore.selectedToken;
  if (!token || legionSignedIn.value) return;
  tokenStore.sendMessage(token.id, "legion_signin");
  tokenStore.sendMessage(token.id, "role_getroleinfo");
  message.info("俱乐部签到");
};

// 兼容不同服务端字段：从 info.info 和顶层 info 以及 statistics 中聚合
const clubOverview = computed(() => {
  const i = info.value || {};
  const base = i.info || {};
  const boss = base.currentBoss || {};
  const stats = i.statistics || i.stat || {};

  const power = Number(base.power ?? i.power ?? base.s_power ?? i.s_power ?? 0);
  const dan = base.dan ?? i.dan ?? base.rank ?? i.rank ?? "-";
  const redQuench = Number(
    base.redQuenchCnt ??
      i.redQuenchCnt ??
      stats["red:quench"] ??
      stats.red_quench ??
      0,
  );
  const lastWarRank =
    stats["last:war:rank"] ??
    stats.lastWarRank ??
    stats["legion:last:war:rank"] ??
    "-";
  const noApply = Boolean(base.noApply ?? i.noApply);

  const currentHP = formatNumber(boss.currentHP || 0);
  const currentBossId = boss.bossId || 0;
  const unfoughtBosses = [];
  for (let k = 1; k <= 150; k++) {
    if (!tokenStore.gameData?.roleInfo?.role?.statistics[`lb:${k}`]) {
      unfoughtBosses.push(k);
    }
  }

  return {
    power,
    dan: dan ?? "-",
    redQuench,
    lastWarRank,
    noApply,
    currentHP,
    currentBossId,
    unfoughtBosses,
  };
});

const refreshClub = () => {
  const token = tokenStore.selectedToken;
  if (!token) return;
  tokenStore.sendMessage(token.id, "legion_getinfo");

  // 如果当前在成员页，也刷新阵容信息
  if (activeTab.value === "members") {
    fetchAllMembersLineup();
  }
};

const {
  approveAll,
  approveApply,
  fetchAllMembersLineup,
  getApplyList,
  handleApplyListResp,
  kickMember,
  rejectAll,
  rejectApply,
} = useClubAdminActions({
  applyList,
  batchLoading,
  dialog,
  getHeroInfo,
  getLineupType,
  loadingApply,
  members,
  message,
  refreshClub,
  showApplyList,
  tokenStore,
});

const jobLabel = getClubJobLabel;

const getJobTagColor = getClubJobTagColor;

const redQuenchlabel = formatClubRedQuenchLabel;

const getLineupTagColor = (lineupType) =>
  getClubLineupTagColor(lineupType, LINEUP_RULES);

const formatNumber = formatClubInfoNumber;

const handleClubMemberSelect = ({ raw }) => {
  if (raw?.roleId != null) {
    fetchTargetInfo(raw.roleId);
  }
};

const handleClubMemberAction = ({ raw }) => {
  if (raw?.roleId != null && raw?.name) {
    kickMember(raw.roleId, raw.name);
  }
};
</script>

<style scoped lang="scss">
.club-info {
  min-width: 0;
  width: 100%;

  :deep(.n-tabs) {
    min-width: 0;
  }

  :deep(.n-tabs-nav-scroll-wrapper) {
    overflow-x: auto;
    overflow-y: hidden;
    -webkit-overflow-scrolling: touch;
  }

  :deep(.n-tabs-nav-scroll-content) {
    min-width: max-content;
  }

  :deep(.n-tabs-tab) {
    white-space: nowrap;
  }

  :deep(.n-tab-pane) {
    min-width: 0;
  }

  .ml-8 {
    margin-left: 8px;
  }

  .mt-4 {
    margin-top: 4px;
  }

  .mt-8 {
    margin-top: 8px;
  }

  .h-full {
    height: 100%;
  }

  .fw-bold {
    font-weight: 700;
  }

  .toolbar {
    display: flex;
    justify-content: flex-end;
    margin-bottom: var(--spacing-sm);
  }

  .overview {
    /* No specific styles needed for grid layout */
  }

  .overview-header-card :deep(.n-card__content) {
    padding: 16px;
  }

  .club-logo-avatar {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .club-name {
    font-size: 18px;
    font-weight: 700;
  }

  .boss-summary-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
  }

  .boss-summary-meta {
    margin-top: 4px;
    font-size: 12px;
  }

  .boss-missing {
    margin-left: 12px;
    color: #d03050;
  }

  .announcement-text {
    white-space: pre-wrap;
    font-size: 13px;
    line-height: 1.6;
    color: #666;
  }

  .leader-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .leader-avatar {
    border: 2px solid #fff;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .leader-name {
    font-weight: 700;
    font-size: 14px;
  }

  .leader-id {
    font-size: 12px;
    color: #999;
  }

  .member-table {
    height: min(600px, calc(100dvh - 260px));
  }

  .is-exporting-image {
    padding: 16px;
    background: linear-gradient(180deg, #f8fbff 0%, #ffffff 100%);
    border-radius: 16px;
    border: 1px solid #e6edf9;
    box-sizing: border-box;
    box-shadow: 0 10px 24px rgba(31, 63, 116, 0.08);
  }

  .is-exporting-image :deep(.n-data-table) {
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid #e2e8f5;
    box-shadow: 0 4px 12px rgba(15, 35, 75, 0.06);
    background: #fff;
  }

  .is-exporting-image :deep(.n-data-table-th) {
    background: linear-gradient(180deg, #f2f7ff 0%, #eaf2ff 100%);
    color: #294676;
    font-weight: 700;
  }

  .is-exporting-image :deep(.n-data-table-td) {
    border-bottom-color: #edf2fb;
  }

  .is-exporting-image :deep(.members-mobile-list) {
    gap: 12px;
  }

  .is-exporting-image :deep(.member-mobile-item) {
    background: #fff;
    border: 1px solid #e2e8f5;
    box-shadow: 0 4px 12px rgba(15, 35, 75, 0.06);
  }

  .members-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .member-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding: 8px;
    border-radius: 8px;
    background: var(--bg-tertiary);
  }

  .member-row .left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .member-row .right {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-secondary);
  }

  .member-row .name {
    font-weight: var(--font-weight-medium);
  }

  .member-row .power {
    font-feature-settings: "tnum" 1;
    font-variant-numeric: tabular-nums;
  }

  .member-row .red-quench {
    font-feature-settings: "tnum" 1;
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin-top: 8px;
    color: var(--text-tertiary);
    font-size: var(--font-size-xs);
  }

  .empty-club {
    text-align: center;
  }

  .empty-club .actions {
    margin-top: var(--spacing-sm);
  }
}

.status-icon {
  width: 32px;
  height: 32px;
  object-fit: contain;
  border-radius: 8px;
  margin-right: var(--spacing-md);
}

.status-info {
  flex: 1;

  h3 {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  p {
    margin: 0;
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
  }
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);

  &.active {
    background: rgba(24, 160, 88, 0.12);
    color: var(--success-color);
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

/* 玩家信息模态框样式 */
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

.legacy-tag {
  color: #fff;
  background-color: var(--legacy-bg);
}

.player-info-detail p {
  margin: 0 0 4px 0;
  font-size: var(--font-size-sm, 14px);
  color: var(--text-secondary, #666);
}

.player-info-detail .detail-row {
  display: flex;
  gap: 16px;
  margin-bottom: 4px;
  font-size: var(--font-size-sm, 14px);
  color: var(--text-secondary, #666);
}

.red-text {
  color: #ff4d4f;
}
.green-text {
  color: #52c41a;
}
.blue-text {
  color: #1890ff;
}
.highlight {
  color: #1890ff;
  font-weight: bold;
}

/* 武将列表样式 */
.hero-section {
  margin-top: 20px;

  h4 {
    margin: 0 0 12px 0;
    font-size: var(--font-size-base, 14px);
    font-weight: var(--font-weight-bold, bold);
  }
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
  cursor: pointer;

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

  span {
    padding: 2px 6px;
    background: var(--bg-primary, #fff);
    border-radius: var(--border-radius-full, 99px);
    border: 1px solid var(--border-light, #eee);
  }

  span.opened {
    background: rgba(82, 196, 26, 0.1);
    color: var(--success-color, #52c41a);
    border-color: var(--success-color, #52c41a);
  }

  span.closed {
    background: rgba(250, 173, 20, 0.1);
    color: var(--warning-color, #faad14);
    border-color: var(--warning-color, #faad14);
  }
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

@media (max-width: 768px) {
  .club-info {
    overflow-x: hidden;

    :deep(.n-card .n-card__content) {
      padding: 10px;
    }

    :deep(.n-tabs-tab) {
      padding: 6px 8px;
      font-size: 12px;
    }

    :deep(.n-tabs-bar) {
      height: 2px;
    }

    .toolbar {
      width: 100%;
    }

    .toolbar :deep(.n-space) {
      width: 100%;
      flex-wrap: wrap;
    }

    .toolbar :deep(.n-space .n-button) {
      flex: 1 1 120px;
      min-width: 0;
    }

    .member-table {
      height: auto;
      max-height: calc(100dvh - 220px);
    }

    .members {
      overflow-x: visible;
    }

    .toolbar :deep(.n-button) {
      font-size: 12px;
      min-height: 30px;
      padding: 0 10px;
    }
  }
}
</style>
