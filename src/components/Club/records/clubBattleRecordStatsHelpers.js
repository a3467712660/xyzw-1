import { buildClubBattleStatItems } from "./clubBattleRecordDisplayHelpers.js";

const toNumber = (value) => Number(value) || 0;

const getMetricValue = (player, field) => player?.[field] ?? 0;

export const buildClubBattleDashboardStatRows = ({
  avgKills = "0.0",
  totalBuilding = 0,
  totalDeaths = 0,
  totalKills = 0,
  totalKD = "0.00",
  totalMembers = 0,
  totalRevives = 0,
  totalWinRate = "0.0",
} = {}) => [
  buildClubBattleStatItems([
    { label: "总 K/D", value: totalKD },
    { label: "总胜率", value: `${totalWinRate}%` },
    { label: "参战人数", value: totalMembers },
    { label: "总复活丹", value: totalRevives },
  ]),
  buildClubBattleStatItems([
    { label: "总击杀", value: totalKills },
    { label: "总死亡", value: totalDeaths },
    { label: "总攻城", value: totalBuilding },
    { label: "人均击杀", value: avgKills },
  ]),
];

export const buildClubBattleMvpModel = (
  player,
  { label = "本周 MVP" } = {},
) => {
  if (!player) {
    return null;
  }

  return {
    avatar: player.avatar || player.headImg || "",
    label,
    name: player.name || "未知成员",
    summary: `击杀 ${toNumber(player.killCnt || player.winCnt)} · 攻城 ${toNumber(player.occupyCnt || player.buildingCnt)}`,
  };
};

export const buildClubBattleTopRankCards = ({
  deathRank = [],
  kdRank = [],
  killRank = [],
  occupyRank = [],
  reviveRank = [],
  survivalRank = [],
} = {}) => [
  {
    icon: "⚔️",
    items: killRank,
    key: "kill",
    title: "击杀前三",
    tone: "red",
    valueFormatter: (player) => getMetricValue(player, "killCnt"),
  },
  {
    icon: "💣",
    items: occupyRank,
    key: "occupy",
    title: "攻城前三",
    tone: "orange",
    valueFormatter: (player) => getMetricValue(player, "occupyCnt"),
  },
  {
    icon: "📊",
    items: kdRank,
    key: "kd",
    title: "KD 前三",
    tone: "green",
    valueFormatter: (player) => getMetricValue(player, "kd"),
  },
  {
    icon: "💀",
    items: deathRank,
    key: "death",
    title: "死亡前三",
    tone: "gray",
    valueFormatter: (player) => getMetricValue(player, "deathCnt"),
  },
  {
    icon: "💊",
    items: reviveRank,
    key: "revive",
    title: "复活丹前三",
    tone: "purple",
    valueFormatter: (player) => getMetricValue(player, "reviveCnt"),
  },
  {
    icon: "🛡️",
    items: survivalRank,
    key: "survival",
    title: "生存前三",
    tone: "blue",
    valueFormatter: (player) => getMetricValue(player, "survivalCnt"),
  },
].map((card) => ({
  ...card,
  items: card.items.map((player, index) => ({
    avatar: player.avatar || player.headImg || "",
    key: player.key || player.roleId || `${card.key}-${index}`,
    name: player.name || "未知成员",
    value: card.valueFormatter(player),
  })),
}));

export const buildPeachBattleDefaultStats = ({
  totalKD = 0,
  totalKills = 0,
  totalRevives = 0,
} = {}) => [
  {
    label: "总击杀",
    tone: "kills",
    value: totalKills,
  },
  {
    label: "总复活",
    tone: "revives",
    value: totalRevives,
  },
  {
    label: "总K/D",
    tone: "kd",
    value: totalKD,
  },
];

export const buildPeachBattleRankGroups = ({
  ownClub,
  opponentClub,
} = {}) => {
  const buildItems = (players = [], valueKey) =>
    players.slice(0, 3).map((player, index) => ({
      avatar: player?.roleInfo?.headImg || "",
      key: player?.roleId || `${valueKey}-${index}`,
      name: player?.roleInfo?.name || "未知成员",
      value: player?.[valueKey] ?? 0,
    }));

  return [
    {
      key: "kill",
      opponentItems: buildItems(opponentClub?.killRank, "killCnt"),
      ownItems: buildItems(ownClub?.killRank, "killCnt"),
      title: "击杀榜",
    },
    {
      key: "kd",
      opponentItems: buildItems(opponentClub?.kdRank, "kd"),
      ownItems: buildItems(ownClub?.kdRank, "kd"),
      title: "K/D榜",
    },
    {
      key: "revive",
      opponentItems: buildItems(opponentClub?.reviveRank, "reviveCnt"),
      ownItems: buildItems(ownClub?.reviveRank, "reviveCnt"),
      title: "复活榜",
    },
  ];
};
