import { ref } from "vue";
import {
  normalizeExportAvatarUrl,
  resolveExportAvatarDataUrls,
} from "@/utils/exportAvatarDataUrls";

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
  api,
  allianceincludes,
  copyToClipboard,
  downloadBlobAsImage,
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
  const isExporting1 = ref(false);
  const battleRecords1 = ref(null);
  const queryDate = ref("");
  const inputDate1 = ref(getLastSaturday());

  const isExportSafeTextCodePoint = (code) => {
    if (!Number.isFinite(code) || code < 32 || (code >= 127 && code <= 159)) return false;
    if (code === 0xFFFD) return false;
    if (code >= 0xE000 && code <= 0xF8FF) return false;
    if (code >= 0x25A0 && code <= 0x25FF) return false;
    if (code >= 0x1F000 && code <= 0x1FAFF) return false;
    if (code >= 0x2600 && code <= 0x27BF) return false;
    return (
      (code >= 0x20 && code <= 0x7E) ||
      (code >= 0x00B7 && code <= 0x00B7) ||
      (code >= 0x2010 && code <= 0x2026) ||
      (code >= 0x3000 && code <= 0x303F) ||
      (code >= 0x3040 && code <= 0x30FF) ||
      (code >= 0x3400 && code <= 0x4DBF) ||
      (code >= 0x4E00 && code <= 0x9FFF) ||
      (code >= 0xAC00 && code <= 0xD7AF) ||
      (code >= 0xFF00 && code <= 0xFFEF)
    );
  };

  const stripUnsafeTextChars = (value) =>
    Array.from(String(value ?? ""))
      .map((char) => (isExportSafeTextCodePoint(char.codePointAt(0)) ? char : " "))
      .join("");

  const isPlaceholderTextChar = (char) =>
    char === "?" || char === "？" || char === "□" || char === "■";

  const stripPlaceholderRuns = (value) => {
    const chars = Array.from(String(value ?? ""));
    let output = "";
    let run = "";
    const flushRun = () => {
      if (!run) return;
      output += run.length >= 2 ? " " : run;
      run = "";
    };
    chars.forEach((char) => {
      if (isPlaceholderTextChar(char)) {
        run += char;
        return;
      }
      flushRun();
      output += char;
    });
    flushRun();
    return output;
  };

  const isMostlyPlaceholderText = (value) => {
    const chars = Array.from(String(value ?? "").replace(/\s+/g, ""));
    if (chars.length < 2) return false;
    const placeholderCount = chars.filter(isPlaceholderTextChar).length;
    return placeholderCount >= 2 && placeholderCount / chars.length >= 0.5;
  };

  const toExportText = (value, maxLength = 32, fallback = "-") => {
    const raw = stripUnsafeTextChars(value);
    const text = stripPlaceholderRuns(raw)
      .replace(/\s+/g, " ")
      .trim() || fallback;
    if (isMostlyPlaceholderText(raw) || isMostlyPlaceholderText(text)) {
      return fallback;
    }
    return Array.from(text).slice(0, maxLength).join("");
  };

  const getAvatarFallback = (name) =>
    Array.from(String(name || "?").trim() || "?").slice(0, 2).join("");

  const formatExportDateTime = (date = new Date()) => {
    const pad = (value) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const formatPowerText = (power) => {
    const value = Number(power) || 0;
    if (value >= 100000000) {
      return `${(value / 100000000).toFixed(2)}亿`;
    }
    if (value >= 10000) {
      return `${(value / 10000).toFixed(2)}万`;
    }
    return String(value);
  };

  const formatScoreText = (score) => {
    if (Number(score) === -1) {
      return "-";
    }
    return Number(score || 0).toFixed(0);
  };

  const disabledDate = (current) => {
    return current.getDay() !== 6 || current > Date.now();
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

  const buildWarrankExportPayload = async (exportedAt) => {
    const clubs = (battleRecords1.value?.legionRankList || []).slice(0, 220);
    const clubAvatarDataUrls = await resolveExportAvatarDataUrls(clubs, {
      urlGetter: (club) => club.logo,
    });
    const flattenedHeroes = clubs.flatMap((club, clubIndex) =>
      (club.topHeroes || []).slice(0, 3).map((hero, heroIndex) => ({
        clubIndex,
        hero,
        heroIndex,
      })));
    const heroAvatarDataUrls = await resolveExportAvatarDataUrls(flattenedHeroes, {
      maxBytes: 45 * 1024,
      urlGetter: (item) => item.hero?.headImg || "",
    });
    const heroAvatarByKey = new Map(
      flattenedHeroes.map((item, index) => [
        `${item.clubIndex}:${item.heroIndex}`,
        heroAvatarDataUrls[index] || "",
      ]),
    );
    const rows = clubs.map((club, index) => {
      const allianceText = allianceincludes(club.announcement || "");
      const redQuenchText = toExportText(club.redQuench || 0, 32, "0");
      const powerText = toExportText(formatPowerText(club.power), 32, "0");
      return {
        index: index + 1,
        name: toExportText(club.name, 80, "未知俱乐部"),
        roleId: toExportText(club.id, 64),
        avatarText: toExportText(getAvatarFallback(club.name), 8, "?"),
        avatarUrl: toExportText(normalizeExportAvatarUrl(club.logo), 2048, ""),
        avatarDataUrl: clubAvatarDataUrls[index] || "",
        killText: redQuenchText,
        metric2Text: powerText,
        metric3Text: toExportText(formatScoreText(club.sRScore), 32, "-"),
        kdText: toExportText(club.level || 30, 32, "30"),
        noteText: toExportText(allianceText, 32),
        serverText: toExportText(club.serverId || 0, 32, "0"),
        redQuenchText,
        powerText,
        announcementText: toExportText(club.announcement || "暂无公告", 120),
        allianceText: toExportText(allianceText, 32),
        topHeroes: (club.topHeroes || []).slice(0, 3).map((hero, heroIndex) => ({
          name: toExportText(hero.name, 80, "未知"),
          avatarText: toExportText(getAvatarFallback(hero.name), 8, "?"),
          avatarUrl: toExportText(normalizeExportAvatarUrl(hero.headImg), 2048, ""),
          avatarDataUrl: heroAvatarByKey.get(`${index}:${heroIndex}`) || "",
          holyBeastText: toExportText(hero.holyBeast || 0, 16, "0"),
          redQuenchText: toExportText(`${hero.redQuench || 0}红`, 16, "0红"),
        })),
      };
    });
    const allianceCounts = rows.reduce((acc, row) => {
      acc[row.noteText] = (acc[row.noteText] || 0) + 1;
      return acc;
    }, {});
    const stats = [
      { label: "俱乐部数", value: String(rows.length) },
      { label: "大联盟", value: String(allianceCounts["大联盟"] || 0) },
      { label: "梦盟", value: String(allianceCounts["梦盟"] || 0) },
      { label: "正义联盟", value: String(allianceCounts["正义联盟"] || 0) },
      { label: "龙盟", value: String(allianceCounts["龙盟"] || 0) },
      { label: "未知联盟", value: String(allianceCounts["未知联盟"] || 0) },
    ];
    return {
      reportType: "salt-field",
      title: `${queryDate.value} 盐场匹配信息`,
      subtitle: ScoreShow.value === 1 ? "实时匹配详情" : "历史匹配详情",
      badgeLabel: "俱乐部数",
      badgeValue: `${rows.length} 家`,
      reportDate: queryDate.value,
      exportedAt,
      sections: [
        {
          title: "盐场匹配信息详情",
          subtitle: `共 ${rows.length} 家俱乐部`,
          tone: "salt",
          layout: "warrank",
          primaryLabel: "红淬",
          metric2Label: "战力",
          metric3Label: "积分",
          stats,
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
      isExporting1.value = true;
      message.loading("正在生成战报图片，请稍候...");
      const exportedAt = formatExportDateTime();
      const result = await api.battleReports.exportImage(
        tokenId,
        await buildWarrankExportPayload(exportedAt),
      );
      if (!result?.success || !result.data) {
        throw new Error(result?.message || "后端图片生成失败");
      }
      const blob = new Blob([result.data], { type: "image/png" });
      const filename = `${queryDate.value.replace("/", "年").replace("/", "月")}日盐场匹配信息.png`;
      downloadBlobAsImage(blob, filename);
    } catch (error) {
      console.error("后端生成盐场匹配图片失败：", error);
      throw new Error("导出图片失败，请重试");
    } finally {
      isExporting1.value = false;
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
    isExporting1,
    loading1,
    queryDate,
  };
}
