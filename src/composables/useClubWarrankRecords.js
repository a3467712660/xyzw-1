import { ref } from "vue";

function createEmptyClubRecord(club) {
  return {
    ...club,
    redQuench: 0,
    power: 0,
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

function sortClubsByAlliance(clubsWithAlliance) {
  const allianceStats = {};
  clubsWithAlliance.forEach((club) => {
    allianceStats[club.alliance] = (allianceStats[club.alliance] || 0) + 1;
  });

  let maxAlliance = "";
  let maxCount = 0;
  for (const [alliance, count] of Object.entries(allianceStats)) {
    if (count > maxCount) {
      maxCount = count;
      maxAlliance = alliance;
    }
  }

  const allianceGroups = {};
  clubsWithAlliance.forEach((club) => {
    if (!allianceGroups[club.alliance]) {
      allianceGroups[club.alliance] = [];
    }
    allianceGroups[club.alliance].push(club);
  });

  for (const alliance in allianceGroups) {
    allianceGroups[alliance].sort(
      (a, b) => (b.redQuench || 0) - (a.redQuench || 0),
    );
  }

  const sortedLegionList = [];
  if (maxAlliance && allianceGroups[maxAlliance]) {
    sortedLegionList.push(...allianceGroups[maxAlliance]);
    delete allianceGroups[maxAlliance];
  }

  Object.keys(allianceGroups)
    .sort()
    .forEach((alliance) => {
      sortedLegionList.push(...allianceGroups[alliance]);
    });

  return sortedLegionList;
}

export function useClubWarrankRecords({
  allianceincludes,
  captureWithHtml2canvas,
  copyToClipboard,
  downloadCanvasAsImage,
  formatTimestamp1,
  formatWarrankRecordsForExport,
  getLastSaturday,
  gettoday,
  message,
  tokenStore,
}) {
  const ScoreShow = ref(1);
  const exportmethod = ref(["2"]);
  const exportDom = ref(null);
  const loading1 = ref(false);
  const battleRecords1 = ref(null);
  const queryDate = ref("");
  const inputDate1 = ref(getLastSaturday());

  const disabledDate = (current) => {
    return (
      (current.getDay() !== 6 && current.getDay() !== 0) || current > Date.now()
    );
  };

  const fetchClubDetails = async (tokenId, club, score) => {
    try {
      const detail = await tokenStore.sendMessageWithPromise(
        tokenId,
        "legion_getinfobyid",
        { legionId: club.id },
        5000,
      );
      if (!detail) {
        return createEmptyClubRecord(club);
      }

      const topHeroes = [];
      for (const [roleId, memberData] of Object.entries(
        detail?.legionData?.members || {},
      )) {
        const tempRoleInfo = await tokenStore.sendMessageWithPromise(
          tokenId,
          "rank_getroleinfo",
          {
            bottleType: 0,
            includeBottleTeam: false,
            isSearch: false,
            roleId,
          },
          5000,
        );

        let holyBeast = 0;
        for (const [, heroData] of Object.entries(
          tempRoleInfo?.roleInfo?.heroes || {},
        )) {
          if (heroData.hB?.active !== undefined) {
            holyBeast++;
          }
        }

        topHeroes.push({
          id: roleId,
          name: memberData.name || memberData.custom?.name || "未知",
          headImg: memberData.headImg || memberData.custom?.headImg || "",
          power: tempRoleInfo?.roleInfo?.power || 0,
          redQuench: memberData.custom?.red_quench_cnt || 0,
          holyBeast,
        });
      }

      topHeroes.sort((a, b) => b.redQuench - a.redQuench);
      const top3Heroes = topHeroes.slice(0, 3);
      const redQuenchCounts = top3Heroes.map((hero) => `${hero.redQuench}红`);
      const holyBeastNum = top3Heroes.map((hero) => hero.holyBeast);

      return {
        ...club,
        sRScore: score,
        redQuench: detail?.legionData?.quenchNum || 0,
        power: detail?.legionData?.power || 0,
        announcement: detail?.legionData?.announcement || 0,
        redno: redQuenchCounts || 0,
        redno1: redQuenchCounts[0] || "0红",
        redno2: redQuenchCounts[1] || "0红",
        redno3: redQuenchCounts[2] || "0红",
        hb1: holyBeastNum[0] || 0,
        hb2: holyBeastNum[1] || 0,
        hb3: holyBeastNum[2] || 0,
        topHeroes: top3Heroes,
        level: 30,
      };
    } catch (error) {
      console.error(`查询俱乐部${club.id}详情失败:`, error);
      return createEmptyClubRecord({ ...club, sRScore: score });
    }
  };

  const enrichAndSortLegionList = async (tokenId, clubs, scoreResolver) => {
    const processedClubs = await Promise.all(
      clubs.map((club) => fetchClubDetails(tokenId, club, scoreResolver(club))),
    );

    const clubsWithAlliance = processedClubs.map((club) => ({
      ...club,
      alliance: allianceincludes(club.announcement),
    }));

    return sortClubsByAlliance(clubsWithAlliance);
  };

  const fetchBattleRecords1 = async () => {
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

    loading1.value = true;
    queryDate.value = formatTimestamp1(inputDate1.value);

    try {
      if (gettoday() === queryDate.value && new Date().getHours() < 21) {
        const battlefield = await tokenStore.sendMessageWithPromise(
          tokenId,
          "legion_getbattlefield",
          {},
          10000,
        );
        if (!battlefield.info) {
          battleRecords1.value = null;
          message.warning("未查询到盐场匹配数据");
          return;
        }

        const result = await tokenStore.sendMessageWithPromise(
          tokenId,
          "legion_getopponent",
          {
            phase: battlefield.info.phase,
            battlefieldId: battlefield.info.battlefieldId,
          },
          10000,
        );
        if (!result?.opponentList) {
          battleRecords1.value = null;
          message.warning("未查询到盐场匹配数据");
          return;
        }

        ScoreShow.value = 1;
        battleRecords1.value = {
          ...result,
          legionRankList: await enrichAndSortLegionList(
            tokenId,
            result.opponentList,
            (club) => club.sRScore ?? -1,
          ),
        };
      } else {
        const result = await tokenStore.sendMessageWithPromise(
          tokenId,
          "legion_getwarrank",
          { date: queryDate.value },
          10000,
        );
        if (!result?.legionRankList) {
          battleRecords1.value = null;
          message.warning("未查询到盐场匹配数据");
          return;
        }

        ScoreShow.value = 0;
        battleRecords1.value = {
          ...result,
          legionRankList: await enrichAndSortLegionList(
            tokenId,
            result.legionRankList,
            () => -1,
          ),
        };
      }

      message.success("盐场匹配数据加载成功");
    } catch (error) {
      console.error("查询失败:", error);
      message.error(`查询失败: ${error.message}`);
      battleRecords1.value = null;
    } finally {
      loading1.value = false;
    }
  };

  const fetchBattleRecordsByDate = (value) => {
    inputDate1.value = value !== undefined ? value : getLastSaturday();
    fetchBattleRecords1();
  };

  const handleRefresh1 = () => {
    fetchBattleRecords1();
  };

  const exportToImage = async () => {
    if (!exportDom.value) {
      throw new Error("未找到要导出的DOM元素");
    }

    const tableContainer = exportDom.value.querySelector(".table-container");
    const scrollTop = tableContainer ? tableContainer.scrollTop : 0;

    try {
      exportDom.value.style.height = "auto";
      exportDom.value.style.overflow = "visible";

      if (tableContainer) {
        tableContainer.dataset.originalHeight = tableContainer.style.height;
        tableContainer.dataset.originalOverflow = tableContainer.style.overflow;
        tableContainer.style.height = "auto";
        tableContainer.style.overflow = "visible";
      }

      await new Promise((resolve) => setTimeout(resolve, 100));

      const canvas = await captureWithHtml2canvas(exportDom.value, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
        height: exportDom.value.scrollHeight,
        width: exportDom.value.scrollWidth,
        windowWidth: exportDom.value.scrollWidth,
        windowHeight: exportDom.value.scrollHeight,
        allowTaint: true,
      });

      const filename = `${queryDate.value.replace("/", "年").replace("/", "月")}日盐场匹配信息.png`;
      downloadCanvasAsImage(canvas, filename);
    } catch (error) {
      console.error("DOM转图片失败：", error);
      throw new Error("导出图片失败，请重试");
    } finally {
      exportDom.value.style.removeProperty("height");
      exportDom.value.style.removeProperty("overflow");

      if (tableContainer) {
        if (tableContainer.dataset.originalHeight) {
          tableContainer.style.height = tableContainer.dataset.originalHeight;
        } else {
          tableContainer.style.removeProperty("height");
        }

        if (tableContainer.dataset.originalOverflow) {
          tableContainer.style.overflow = tableContainer.dataset.originalOverflow;
        } else {
          tableContainer.style.removeProperty("overflow");
        }

        delete tableContainer.dataset.originalHeight;
        delete tableContainer.dataset.originalOverflow;
        tableContainer.scrollTop = scrollTop;
      }
    }
  };

  const handleExport1 = async () => {
    if (!battleRecords1.value?.legionRankList) {
      message.warning("没有可导出的数据");
      return;
    }

    try {
      if (exportmethod.value.includes("1")) {
        const exportText = await formatWarrankRecordsForExport(
          battleRecords1.value.legionRankList,
          queryDate.value,
        );
        await copyToClipboard(exportText);
      }
      if (exportmethod.value.includes("2")) {
        await exportToImage();
      }
      message.success("导出成功");
    } catch (error) {
      console.error("导出失败:", error);
      message.error("导出失败，请重试");
    }
  };

  return {
    ScoreShow,
    battleRecords1,
    disabledDate,
    exportDom,
    exportmethod,
    fetchBattleRecords1,
    fetchBattleRecordsByDate,
    handleExport1,
    handleRefresh1,
    inputDate1,
    loading1,
    queryDate,
  };
}
