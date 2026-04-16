import { buildDuelDetailReport } from "@/utils/duelBattleDetailReport";
import {
  createFightPvpExactBattleInput,
} from "@/services/replay/fightPvpExactBattleInput.js";
import {
  createFightPvpReplayRecordFromBattleInput,
} from "@/services/replay/fightPvpReplayNormalizer.js";
import {
  readFightPvpRuntimeMapIdContext,
} from "@/services/replay/fightPvpRuntimeMapIdBridge.js";
import {
  getFightPvpRuntimeRoleMapIdReasonMessageKey,
  resolveFightPvpMapIdForLiveCapture,
} from "@/services/replay/fightPvpRuntimeRoleMapIdResolver.js";

export function useFightPvpActions({
  tokenStore,
  message,
  t,
  gettoday,
  formatPower,
  formatWeapon,
  getLineupType,
  HeroFillInfo,
  countPearlOrangeSlots,
  getHeroInfo,
  HERO_DICT,
  loading1,
  loadingText,
  queryDate,
  targetId,
  memberData,
  fightNum,
  fightResult,
  lastTargetRawInfo,
  topranklist,
  addFightHistoryRecord,
}) {
  const ensureConnectedToken = () => {
    if (!tokenStore.selectedToken) {
      message.warning(t("fightPvpCard.messages.selectRoleFirst"));
      return null;
    }

    const tokenId = tokenStore.selectedToken.id;
    const wsStatus = tokenStore.getWebSocketStatus(tokenId);
    if (wsStatus !== "connected") {
      message.error(t("fightPvpCard.messages.wsDisconnectedQueryRecord"));
      return null;
    }

    return tokenId;
  };

  const getReplayRuntimeLabels = () => ({
    stageNameStr: t("fightPvpCard.title"),
    startTipTopName: t("fightPvpCard.title"),
    startTipStage: t("fightPvpCard.actions.startFight"),
  });

  const buildLiveMapIdFailureMessage = (mapResolution) => {
    const detailParts = [];
    if (mapResolution?.runtimeRolePath) {
      detailParts.push(`runtimeRolePath=${mapResolution.runtimeRolePath}`);
    }
    if (mapResolution?.selfRoleContextSource) {
      detailParts.push(`selfRoleContextSource=${mapResolution.selfRoleContextSource}`);
    }
    if (typeof mapResolution?.runtimeRoleAvailable === "boolean") {
      detailParts.push(`runtimeRoleAvailable=${mapResolution.runtimeRoleAvailable}`);
    }
    if (typeof mapResolution?.battleInputAvailable === "boolean") {
      detailParts.push(`battleInputAvailable=${mapResolution.battleInputAvailable}`);
    }
    if (mapResolution?.dressPvpMapUsedId) {
      detailParts.push(`dressPvpMapUsedId=${mapResolution.dressPvpMapUsedId}`);
    }

    const lead = t(
      getFightPvpRuntimeRoleMapIdReasonMessageKey(mapResolution?.reason),
    );
    return detailParts.length > 0
      ? `${lead} (${detailParts.join(", ")})`
      : lead;
  };

  const resolveLiveMapIdForFightPvp = ({
    battleInput,
  } = {}) =>
    resolveFightPvpMapIdForLiveCapture({
      runtimeContext: readFightPvpRuntimeMapIdContext(),
      battleInput,
    });

  const buildReplayOptions = (result) =>
    new Map([
      [
        "targetRole",
        result?.targetRole || {
          roleId: String(memberData.value?.roleId || targetId.value || ""),
          name: memberData.value?.name || "",
          headImg: memberData.value?.headImg || "",
        },
      ],
      ["selfScore", result?.selfScore ?? null],
      ["oppoScore", result?.oppoScore ?? null],
    ]);

  const fetchfightPVP = async () => {
    const tokenId = ensureConnectedToken();
    if (!tokenId)
      return;

    loading1.value = true;
    loadingText.value = t("fightPvpCard.messages.loadingFight");
    queryDate.value = gettoday();

    if (memberData.value) {
      addFightHistoryRecord({
        id: memberData.value.roleId || targetId.value,
        name: memberData.value.name,
        red: memberData.value.red,
        headImg: memberData.value.headImg,
        serverName: memberData.value.serverName,
      });
    }

    try {
      let winCount = 0;
      let ourTotalDieHeroCount = 0;
      let enemyTotalDieHeroCount = 0;
      const resultCount = [];
      const rawBattles = [];
      const replays = [];
      let selfRoleRaw = null;
      let selfPresetTeamRaw = null;
      let firstReplayFailureMessage = "";

      const [roleInfoResult, presetTeamResult] = await Promise.allSettled([
        tokenStore.sendGetRoleInfo(tokenId),
        tokenStore.sendMessageWithPromise(tokenId, "presetteam_getinfo", {}, 8000),
      ]);

      if (roleInfoResult.status === "fulfilled") {
        selfRoleRaw = roleInfoResult.value;
      } else {
        console.error("[FightPvp report] failed to load self role info:", roleInfoResult.reason);
      }

      if (presetTeamResult.status === "fulfilled") {
        selfPresetTeamRaw = presetTeamResult.value;
      } else {
        console.error("[FightPvp report] failed to load self preset team:", presetTeamResult.reason);
      }

      for (let i = 0; i < fightNum.value; i++) {
        const result = await tokenStore.sendMessageWithPromise(
          tokenId,
          "fight_startpvp",
          {
            targetId: targetId.value,
          },
          5000,
        );

        if (!result.battleData) {
          fightResult.value = null;
          message.warning(t("fightPvpCard.messages.fightError"));
          return;
        }

        rawBattles.push(result.battleData);
        const mapResolution = resolveLiveMapIdForFightPvp({
          battleInput: result,
        });
        const liveMapIdFailureMessage = !mapResolution.ok
          ? buildLiveMapIdFailureMessage(mapResolution)
          : "";
        const exactBattleInputData = createFightPvpExactBattleInput({
          battleData: result.battleData,
          battleResult: result.battleResult,
          mapId: mapResolution.mapId,
          mapIdSource: mapResolution.mapIdSource || mapResolution.source,
          mapIdResolveReason: mapResolution.reason,
          runtimeRoleAvailable: mapResolution.runtimeRoleAvailable,
          runtimeRolePath: mapResolution.runtimeRolePath,
          ...getReplayRuntimeLabels(),
          options: buildReplayOptions(result),
        }, {
          mutate: true,
        });
        const replay = createFightPvpReplayRecordFromBattleInput({
          exactBattleInputData,
          tokenId,
          targetId: targetId.value,
          targetName: memberData.value?.name,
          leftContext:
            selfRoleRaw?.role
            || selfRoleRaw?.roleInfo
            || tokenStore.selectedTokenRoleInfo?.role
            || tokenStore.selectedTokenRoleInfo
            || tokenStore.gameData?.roleInfo?.role
            || tokenStore.gameData?.roleInfo
            || null,
          rightContext: memberData.value,
          selfRoleRaw,
          roleInfo: tokenStore.gameData?.roleInfo || null,
          mapId: mapResolution.mapId,
          pvpMapId: mapResolution.pvpMapId,
          mapIdSource: mapResolution.mapIdSource || mapResolution.source,
          pvpMapIdSource: mapResolution.pvpMapIdSource || mapResolution.source,
          disabledReason: liveMapIdFailureMessage,
          mapIdResolveReason: mapResolution.reason,
          dressPvpMapUsedId: mapResolution.dressPvpMapUsedId,
          selfRoleContextSource: mapResolution.selfRoleContextSource,
          runtimeRoleAvailable: mapResolution.runtimeRoleAvailable,
          runtimeRolePath: mapResolution.runtimeRolePath,
          battleInputAvailable: mapResolution.battleInputAvailable,
          mapResolution,
        });
        if (!replay.isPlayable && !firstReplayFailureMessage) {
          firstReplayFailureMessage = replay.disabledReason || liveMapIdFailureMessage;
        }
        replays.push(replay);

        const sponsorTeamInfo = Object.values(
          result.battleData?.result?.sponsor?.teamInfo || {},
        );
        const acceptTeamInfo = Object.values(
          result.battleData?.result?.accept?.teamInfo || {},
        );

        let leftCount = 0;
        sponsorTeamInfo.forEach((item) => {
          if (item.hp == 0)
            leftCount++;
        });
        ourTotalDieHeroCount += leftCount;

        let rightCount = 0;
        acceptTeamInfo.forEach((item) => {
          if (item.hp == 0)
            rightCount++;
        });
        enemyTotalDieHeroCount += rightCount;

        const tempObj = {
          leftName: result.battleData.leftTeam.name,
          leftheadImg: result.battleData.leftTeam.headImg,
          leftpower: formatPower(result.battleData.leftTeam.power),
          rightName: result.battleData.rightTeam.name,
          rightheadImg: result.battleData.rightTeam.headImg,
          rightpower: formatPower(result.battleData.rightTeam.power),
          leftDieHero: leftCount,
          rightDieHero: rightCount,
          isWin: !!result.battleData.result.isWin,
          replay,
        };

        if (result.battleData.result.isWin)
          winCount++;

        resultCount.push(tempObj);
      }

      let report = null;
      if (rawBattles.length > 0) {
        try {
          report = buildDuelDetailReport({
            selfRoleRaw,
            selfPresetTeamRaw,
            enemyRoleRaw: lastTargetRawInfo.value,
            battleResults: rawBattles,
            formatPower,
            HERO_DICT,
            HeroFillInfo,
          });
        } catch (reportError) {
          console.error("[FightPvp report]", reportError);
        }
      }

      const teamData = {
        winCount,
        ourTotalDieHeroCount,
        enemyTotalDieHeroCount,
        resultCount,
        rawBattles,
        replays,
        report,
      };
      fightResult.value = teamData;
      if (firstReplayFailureMessage) {
        message.warning(firstReplayFailureMessage);
      }
      message.success(t("fightPvpCard.messages.fightDone"));
      return teamData;
    } catch (error) {
      message.error(t("fightPvpCard.messages.queryFailed", { error: error.message }));
      topranklist.value = null;
    } finally {
      loading1.value = false;
      loadingText.value = t("fightPvpCard.messages.loadingTarget");
    }
  };

  const fetchTargetInfo = async () => {
    const tokenId = ensureConnectedToken();
    if (!tokenId)
      return;

    fightResult.value = null;
    loading1.value = true;
    loadingText.value = t("fightPvpCard.messages.loadingTarget");
    queryDate.value = gettoday();

    try {
      const result = await tokenStore.sendMessageWithPromise(
        tokenId,
        "rank_getroleinfo",
        {
          bottleType: 0,
          includeBottleTeam: false,
          isSearch: false,
          includeHero: true,
          includeHeroDetail: true,
          includePearl: true,
          roleId: targetId.value,
        },
        5000,
      );
      lastTargetRawInfo.value = result;

      if (!result.roleInfo && !result.legionInfo) {
        memberData.value = null;
        message.warning(t("fightPvpCard.messages.targetNotFound"));
        return;
      }

      const teamData = {};
      const heroAndholdAndRed = getHeroInfo(result.roleInfo.heroes);
      const fishInfo = HeroFillInfo(result.roleInfo);
      let totalOrangeCount = 0;

      heroAndholdAndRed.heroList.forEach((hero) => {
        hero.PearlInfo = fishInfo[hero.artifactId] || {};
        const pearlOrange = countPearlOrangeSlots(hero.PearlInfo?.slotMap || []);
        hero.pearlOrange = pearlOrange;
        hero.orange = (Number(hero.orange) || 0) + pearlOrange;
        totalOrangeCount += Number(hero.orange) || 0;
      });

      teamData.legionName = result.legionInfo?.name || t("fightPvpCard.common.noClub");
      teamData.legionRed
        = result.legionInfo?.statistics["battle:red:quench"] || t("fightPvpCard.common.none");
      teamData.legionMaxRed = result.legionInfo?.statistics["red:quench"] || t("fightPvpCard.common.none");
      teamData.MaxPower = formatPower(
        result.legionInfo?.statistics["max:power"] || "0",
      );
      teamData.heroList = heroAndholdAndRed.heroList;
      teamData.headImg = result.roleInfo.headImg;
      teamData.lordWeaponId = formatWeapon(result.roleInfo.lordWeaponId);
      teamData.roleId = String(result.roleInfo.roleId || targetId.value || "");
      teamData.name = result.roleInfo.name;
      teamData.power = formatPower(result.roleInfo.power);
      teamData.serverName = result.roleInfo.serverName;
      teamData.hole = heroAndholdAndRed.holeCount;
      teamData.red = heroAndholdAndRed.redCount;
      teamData.orange = totalOrangeCount;
      teamData.legacy = result.roleInfo.legacy?.color || 0;
      teamData.lineupType = getLineupType(heroAndholdAndRed.heroList);

      memberData.value = teamData;
      addFightHistoryRecord({
        id: teamData.roleId,
        name: teamData.name,
        red: teamData.red,
        headImg: teamData.headImg,
        serverName: teamData.serverName,
      });
      message.success(t("fightPvpCard.messages.targetLoaded"));
      return teamData;
    } catch (error) {
      message.error(t("fightPvpCard.messages.queryFailed", { error: error.message }));
      topranklist.value = null;
    } finally {
      loading1.value = false;
      loadingText.value = t("fightPvpCard.messages.loadingTarget");
    }
  };

  return {
    fetchfightPVP,
    fetchTargetInfo,
  };
}
