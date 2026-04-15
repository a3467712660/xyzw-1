export const formatClubInfoPercent = (value, total, digits = 2) => {
  const normalizedTotal = Number(total || 0);
  if (!normalizedTotal) {
    return `${(0).toFixed(digits)}%`;
  }
  const normalizedValue = Number(value || 0);
  return `${((normalizedValue / normalizedTotal) * 100).toFixed(digits)}%`;
};

export const buildPeachFightSummaryItems = ({
  dieStats = {},
  fightResult = {},
  labels = {},
} = {}) => {
  const totalCount = Number(fightResult.totalCount || 0);
  return [
    {
      className: "",
      label: labels.totalCount || "总场次",
      value: totalCount,
    },
    {
      className: "win",
      label: labels.winCount || "胜利",
      value: Number(fightResult.winCount || 0),
    },
    {
      className: "loss",
      label: labels.lossCount || "失败",
      value: Number(fightResult.lossCount || 0),
    },
    {
      className: "",
      label: labels.winRate || "胜率",
      value: formatClubInfoPercent(fightResult.winCount, totalCount),
    },
    {
      className: "",
      label: labels.ourDieRate || "我方掉将率",
      value: formatClubInfoPercent(dieStats.ourDieHeroGameCount, totalCount),
    },
    {
      className: "",
      label: labels.enemyDieRate || "敌方掉将率",
      value: formatClubInfoPercent(dieStats.enemyDieHeroGameCount, totalCount),
    },
  ];
};

export const buildClubApplyDisplayModel = (
  apply = {},
  formatPower = (value) => String(value || 0),
) => ({
  avatar: apply.headImg || "/icons/xiaoyugan.png",
  levelText: `等级: ${apply.level || 0}`,
  nameText: `${apply.name || "未知成员"}(ID:${apply.roleId || "-"})`,
  powerText: formatPower(apply.power || 0),
  reasonText: apply.applyReason ? `申请留言: ${apply.applyReason}` : "",
  roleId: apply.roleId,
  serverText: apply.serverId ? `服务器: ${apply.serverId}` : "",
});

export const buildClubMemberExportBannerModel = ({
  clubName = "",
  exportedAt = "",
  memberCount = 0,
} = {}) => ({
  clubText: `俱乐部：${clubName || "未知俱乐部"}`,
  metaText: `导出时间 ${exportedAt} · 共 ${Number(memberCount || 0)} 名成员`,
  title: "俱乐部成员信息总览",
});
