import { formatClubBattlePower } from "./clubBattleRecordFormatters.js";

const normalizeName = (value, fallback) => {
  const text = String(value || "").trim();
  return text || fallback;
};

const toNumber = (value) => Number(value) || 0;

export const buildPeachBattleHeaderTitle = (
  queryDate,
  ownName,
  opponentName,
) =>
  `${String(queryDate || "").trim()} ${normalizeName(ownName, "我方俱乐部")} VS ${normalizeName(opponentName, "敌方俱乐部")} 蟠桃大会对战战绩`.trim();

export const buildPeachBattleClubMeta = (club) => {
  const name = normalizeName(club?.name, "未知俱乐部");
  const serverId = club?.serverId ? `${club.serverId}服` : "";
  return {
    idText: `ID: ${club?.id ?? "-"}`,
    nameText: `${serverId} ${name}`.trim(),
    summaryText: `${toNumber(club?.memberCount)}人 | ${toNumber(club?.quenchNum)}红 | ${formatClubBattlePower(club?.totalPower || 0)}`,
  };
};

export const buildClubBattleStyle3MvpMeta = (player) =>
  `击杀 ${toNumber(player?.killCnt ?? player?.winCnt)} · 攻城 ${toNumber(player?.occupyCnt ?? player?.buildingCnt)}`;

export const buildClubBattleStyle4DisplayPanels = (panels = []) =>
  panels.map((panel) => ({
    icon: panel.icon,
    key: panel.key,
    items: (panel.players || []).map((player, index) => ({
      key: player.key || player.roleId || `${panel.key}-${index}`,
      name: player.name || "未知成员",
      value:
        typeof panel.getValue === "function"
          ? panel.getValue(player)
          : player.value ?? 0,
    })),
    title: panel.title,
  }));
