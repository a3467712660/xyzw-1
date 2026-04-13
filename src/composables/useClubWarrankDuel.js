import { reactive, ref } from "vue";

export function useClubWarrankDuel({
  buildPlayerInfo,
  HERO_DICT,
  HeroFillInfo,
  formatPower,
  message,
  tokenStore,
}) {
  const queryLoading = ref(false);
  const queryTargetId = ref("");
  const showPlayerInfoModal = ref(false);
  const playerInfo = ref(null);
  const fightCount = ref(1);
  const isFightCountValid = ref(true);
  const fightProgress = reactive({
    visible: false,
    totalCount: 0,
    completedCount: 0,
    remainingCount: 0,
    winCount: 0,
    lossCount: 0,
    percentage: 0,
  });
  const fightResult = reactive({
    visible: false,
    totalCount: 0,
    winCount: 0,
    lossCount: 0,
    winRate: 0,
    ourDieRate: 0,
    enemyDieRate: 0,
    resultCount: [],
  });
  const fightHistory = ref([]);
  const dieStats = reactive({
    ourDieHeroGameCount: 0,
    enemyDieHeroGameCount: 0,
  });
  const showHeroModal = ref(false);
  const heroModealTemp = ref(null);

  const selectHeroInfo = (heroInfo) => {
    showHeroModal.value = true;
    heroModealTemp.value = heroInfo;
  };

  const getEquipment = (equipment) => {
    let redCount = 0;
    let holeCount = 0;
    Object.values(equipment).forEach((equ) => {
      Object.values(equ.quenches).forEach((item) => {
        holeCount++;
        if (item.colorId === 6) {
          redCount++;
        }
      });
    });
    return { redCount, holeCount };
  };

  const getHeroInfo = (heroObj) => {
    let redCount = 0;
    let holeCount = 0;
    let heroList = [];

    try {
      const heroesToProcess = Array.isArray(heroObj)
        ? heroObj
        : typeof heroObj === "object" && heroObj !== null
          ? Object.values(heroObj)
          : [];

      heroesToProcess.forEach((hero, index) => {
        if (!hero) {
          return;
        }

        const heroInfo = HERO_DICT[hero.heroId] || {};
        const equipmentInfo = hero.equipment
          ? getEquipment(hero.equipment)
          : { redCount: 0, holeCount: 0 };
        const heroId = hero.heroId || `unknown_${index}`;
        const heroName = hero.heroName || heroInfo.name || `未知武将_${index}`;

        const tempObj = {
          heroId,
          artifactId: hero.artifactId || "",
          power: hero.power || 0,
          star: hero.star || 0,
          equipment: hero.equipment,
          heroName,
          heroAvate: hero.heroAvate || heroInfo.avatar || "",
          level: hero.level || 0,
          hole: equipmentInfo.holeCount,
          red: equipmentInfo.redCount,
          HolyBeast: hero.hB?.active === true,
          HBlevel: hero.hB?.order || 0,
          skillList: hero.skillList || [],
          attributeList: hero.attributeList || [],
          battleTeamSlot: hero.battleTeamSlot,
        };

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

  const validateFightCount = (value) => {
    const num = Number.parseInt(value);
    isFightCountValid.value = !Number.isNaN(num) && num >= 1 && num <= 100;
  };

  const resetFightResult = () => {
    fightResult.visible = false;
    fightProgress.visible = false;
    fightHistory.value = [];
    dieStats.ourDieHeroGameCount = 0;
    dieStats.enemyDieHeroGameCount = 0;
    fightCount.value = 1;
    validateFightCount(1);
  };

  const updateFightProgress = (completedCount, winCount, lossCount) => {
    fightProgress.completedCount = completedCount;
    fightProgress.winCount = winCount;
    fightProgress.lossCount = lossCount;
    fightProgress.remainingCount = fightProgress.totalCount - completedCount;
    fightProgress.percentage = Math.round(
      (completedCount / fightProgress.totalCount) * 100,
    );
  };

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
    fightResult.resultCount = resultCount;
    fightResult.visible = true;
    fightProgress.visible = false;
  };

  const ensureSelectedConnectedToken = (actionLabel) => {
    if (!tokenStore.selectedToken) {
      message.warning("请先选择游戏角色");
      return null;
    }

    const tokenId = tokenStore.selectedToken.id;
    const wsStatus = tokenStore.getWebSocketStatus(tokenId);
    if (wsStatus !== "connected") {
      message.error(`WebSocket未连接，无法${actionLabel}`);
      return null;
    }

    return tokenId;
  };

  const fetchTargetInfo = async (roleId) => {
    const tokenId = ensureSelectedConnectedToken("查询战绩");
    if (!tokenId) {
      return;
    }

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
        message.warning("未查询到对手信息");
        return;
      }

      const fishInfo = HeroFillInfo(result.roleInfo);
      let heroAndholdAndRed = { redCount: 0, holeCount: 0, heroList: [] };
      if (result.roleInfo.heroes) {
        heroAndholdAndRed = getHeroInfo(result.roleInfo.heroes);
      }

      heroAndholdAndRed.heroList.forEach((hero) => {
        hero.PearlInfo = fishInfo[hero.artifactId] || {};
      });

      const roleRedQuench = result.roleInfo.red || 0;
      const roleMaxRed = result.roleInfo.maxRed || 0;
      const legionRedQuench =
        result.legionInfo?.statistics?.["battle:red:quench"] || roleRedQuench;
      const legionMaxRed =
        result.legionInfo?.statistics?.["red:quench"] || roleMaxRed;
      const legionMaxPower =
        result.legionInfo?.statistics?.["max:power"]
        || result.roleInfo.maxPower
        || 0;

      const basePlayerInfo = {
        id: roleId,
        name: result.roleInfo.name,
        headImg: result.roleInfo.headImg,
        power: result.roleInfo.power,
        level: result.roleInfo.level,
        serverName: result.roleInfo.serverName,
        legionName: result.legionInfo?.name || "无",
        redQuench: roleRedQuench,
        holyBeast: heroAndholdAndRed.heroList.filter((hero) => hero.HolyBeast).length,
        maxPower: formatPower(legionMaxPower),
        currentRedDrum: roleRedQuench,
        maxRedDrum: roleMaxRed,
        totalRedCount: heroAndholdAndRed.redCount,
        totalHoleCount: heroAndholdAndRed.holeCount,
        legionRedQuench,
        legionMaxRed,
        heroList: heroAndholdAndRed.heroList,
        legacy: result.roleInfo.legacy?.color || 0,
      };
      const extraPlayerInfo =
        typeof buildPlayerInfo === "function"
          ? buildPlayerInfo({
              basePlayerInfo,
              heroAndholdAndRed,
              result,
              roleId,
            })
          : {};

      playerInfo.value = {
        ...basePlayerInfo,
        ...(extraPlayerInfo && typeof extraPlayerInfo === "object"
          ? extraPlayerInfo
          : {}),
      };

      showPlayerInfoModal.value = true;
      message.success("查询成功");
    } catch (error) {
      message.error(`查询失败: ${error.message}`);
      console.error("查询失败详细信息:", error);
    } finally {
      queryLoading.value = false;
    }
  };

  const handleHeroClick = (hero) => {
    if (hero.id && !queryLoading.value) {
      message.info(`正在查询车头信息: ${hero.name}`);
      fetchTargetInfo(hero.id);
    } else if (!hero.id) {
      message.error("车头ID不存在，无法查询信息");
      console.error("车头ID不存在", hero);
    }
  };

  const handleDuel = async () => {
    if (!playerInfo.value) {
      return;
    }

    validateFightCount(fightCount.value);
    if (!isFightCountValid.value) {
      message.error("请输入有效的切磋次数 (1-100)");
      return;
    }

    const tokenId = ensureSelectedConnectedToken("发起切磋");
    if (!tokenId) {
      return;
    }

    const totalCount = Number.parseInt(fightCount.value);
    message.info(`开始连续切磋: ${playerInfo.value.name}，共${totalCount}次`);
    queryLoading.value = true;
    fightProgress.visible = true;
    fightProgress.totalCount = totalCount;
    fightProgress.completedCount = 0;
    fightProgress.remainingCount = totalCount;
    fightProgress.winCount = 0;
    fightProgress.lossCount = 0;
    fightProgress.percentage = 0;
    dieStats.ourDieHeroGameCount = 0;
    dieStats.enemyDieHeroGameCount = 0;
    fightHistory.value = [];

    try {
      let winCount = 0;
      let lossCount = 0;
      const resultCount = [];

      for (let i = 0; i < totalCount; i++) {
        message.info(`正在进行第 ${i + 1}/${totalCount} 场切磋`);
        const result = await tokenStore.sendMessageWithPromise(
          tokenId,
          "fight_startpvp",
          { targetId: playerInfo.value.id },
          10000,
        );

        if (result && result.battleData) {
          let leftCount = 0;
          let rightCount = 0;

          result.battleData.result?.sponsor?.teamInfo?.forEach((item) => {
            if (item.hp === 0) {
              leftCount++;
            }
          });
          result.battleData.result?.accept?.teamInfo?.forEach((item) => {
            if (item.hp === 0) {
              rightCount++;
            }
          });

          const battleResult = {
            isWin: result.battleData.result?.isWin || false,
            leftName: result.battleData.leftTeam?.name || "未知",
            leftheadImg: result.battleData.leftTeam?.headImg || "",
            leftpower: formatPower(result.battleData.leftTeam?.power || 0),
            leftDieHero: leftCount,
            rightName: result.battleData.rightTeam?.name || "未知",
            rightheadImg: result.battleData.rightTeam?.headImg || "",
            rightpower: formatPower(result.battleData.rightTeam?.power || 0),
            rightDieHero: rightCount,
          };

          resultCount.push(battleResult);

          if (leftCount > 0) {
            dieStats.ourDieHeroGameCount++;
          }
          if (rightCount > 0) {
            dieStats.enemyDieHeroGameCount++;
          }

          if (battleResult.isWin) {
            winCount++;
          } else {
            lossCount++;
          }

          updateFightProgress(i + 1, winCount, lossCount);

          if (i < totalCount - 1) {
            await new Promise((resolve) => setTimeout(resolve, 500));
          }
        } else {
          message.warning(
            `第 ${i + 1} 场切磋失败: ${result?.message || "未返回战斗数据"}`,
          );
          lossCount++;
          updateFightProgress(i + 1, winCount, lossCount);
        }
      }

      calculateFinalResult(winCount, lossCount, resultCount);
      message.success(`连续切磋完成，共${totalCount}场`);
    } catch (error) {
      console.error("连续切磋失败:", error);
      message.error(`连续切磋失败: ${error.message || "网络错误"}`);
      fightProgress.visible = false;
    } finally {
      queryLoading.value = false;
    }
  };

  return {
    dieStats,
    fetchTargetInfo,
    fightCount,
    fightHistory,
    fightProgress,
    fightResult,
    handleDuel,
    handleHeroClick,
    heroModealTemp,
    isFightCountValid,
    playerInfo,
    queryLoading,
    queryTargetId,
    resetFightResult,
    selectHeroInfo,
    showHeroModal,
    showPlayerInfoModal,
    validateFightCount,
  };
}
