export const formatClubRankPower = (power) => {
  if (!power) {
    return "0";
  }
  if (power >= 100000000) {
    return `${(power / 100000000).toFixed(2)}亿`;
  }
  if (power >= 10000) {
    return `${(power / 10000).toFixed(2)}万`;
  }
  return power.toString();
};

export const formatClubRankScore = (score) => {
  return score ? score.toFixed(0).toString() : "0";
};

export const getClubRankAllianceClass = (alliance) => {
  switch (alliance) {
    case "大联盟":
      return "alliance-large";
    case "梦盟":
      return "alliance-dream";
    case "正义联盟":
      return "alliance-xin-justice";
    case "龙盟":
      return "alliance-dragon";
    case "未知联盟":
      return "alliance-unknown";
    default:
      return "alliance-other";
  }
};

export const getClubRankRedQuenchClass = (redQuench) => {
  if (redQuench >= 60) {
    return "redquench-high";
  }
  if (redQuench >= 50) {
    return "redquench-medium";
  }
  return "redquench-low";
};

export const getClubRankLineupTagColor = (lineupType, lineupRules = []) => {
  const rule = lineupRules.find((item) => item.name === lineupType);
  return rule?.colorProps || { color: "#595959", textColor: "#fff" };
};
