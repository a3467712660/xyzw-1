export const formatClubInfoNumber = (num) => {
  const normalized = Number(num || 0);
  if (normalized >= 1e12) return `${(normalized / 1e12).toFixed(2)}兆`;
  if (normalized >= 1e8) return `${(normalized / 1e8).toFixed(2)}亿`;
  if (normalized >= 1e4) return `${(normalized / 1e4).toFixed(2)}万`;
  return String(normalized);
};

export const getClubJobLabel = (job) => {
  if (job === 1) return "会长";
  if (job === 2) return "副会长";
  return "成员";
};

export const getClubJobTagColor = (job) => {
  if (job === 1) {
    return {
      color: "#fff7e6",
      borderColor: "#ffd591",
      textColor: "#ad6800",
    };
  }
  if (job === 2) {
    return {
      color: "#f0f5ff",
      borderColor: "#adc6ff",
      textColor: "#1d39c4",
    };
  }
  return {
    color: "#f6ffed",
    borderColor: "#b7eb8f",
    textColor: "#237804",
  };
};

export const formatClubRedQuenchLabel = (redQuench) => `${Number(redQuench || 0)}红`;

export const getClubLineupTagColor = (lineupType, lineupRules = []) => {
  if (!lineupType) return {};
  const rule = lineupRules.find((item) => item.name === lineupType);
  return rule?.colorProps || {};
};

export const getClubMemberPowerValue = (member) =>
  Number(member?.power || member?.custom?.s_power || 0);

export const getClubMemberRedQuenchValue = (member) =>
  Number(member?.custom?.red_quench_cnt || 0);

export const sortClubMembersByPriority = (members = []) =>
  [...members].sort((left, right) => {
    const leftJob = left?.job === 0 ? 99 : Number(left?.job || 0);
    const rightJob = right?.job === 0 ? 99 : Number(right?.job || 0);
    if (leftJob !== rightJob) {
      return leftJob - rightJob;
    }

    const leftRed = getClubMemberRedQuenchValue(left);
    const rightRed = getClubMemberRedQuenchValue(right);
    if (leftRed !== rightRed) {
      return rightRed - leftRed;
    }

    return getClubMemberPowerValue(right) - getClubMemberPowerValue(left);
  });
