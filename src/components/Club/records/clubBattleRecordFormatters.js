export const formatClubBattlePower = (power) => {
  if (!power) {
    return "0";
  }

  if (power >= 100000000) {
    return `${(power / 100000000).toFixed(2)}亿`;
  }

  if (power >= 10000) {
    return `${(power / 10000).toFixed(2)}万`;
  }

  return String(power);
};

export const formatClubBattleCompactDate = (dateStr) => {
  if (!dateStr) {
    return "";
  }

  const parts = String(dateStr).split("/");
  if (parts.length !== 3) {
    return String(dateStr);
  }

  const [year, month, day] = parts;
  return `${year.slice(2)}${month}${day}`;
};

export const formatClubBattleShortDate = (dateStr) => {
  if (!dateStr) {
    return "";
  }

  const parts = String(dateStr).split("/");
  if (parts.length !== 3) {
    return String(dateStr);
  }

  return parts.slice(1).join("/");
};

export const formatClubBattleKD = (kills, deaths) =>
  Number.parseFloat(
    Number(kills) && Number(deaths) ? Number(kills) / Number(deaths) : 0,
  ).toFixed(2);

export const formatClubBattleRate = (wins, lossesOrTotal, mode = "ratio") => {
  const left = Number(wins) || 0;
  const right = Number(lossesOrTotal) || 0;
  if (mode === "win-rate") {
    if (left + right === 0) {
      return "0.0";
    }
    return ((left / (left + right)) * 100).toFixed(1);
  }

  if (right === 0) {
    return "0.0";
  }

  return ((left / right) * 100).toFixed(1);
};

const getThresholdColor = (
  value,
  {
    high = Number.POSITIVE_INFINITY,
    medium = Number.POSITIVE_INFINITY,
    highColor,
    mediumColor,
  },
) => {
  const normalizedValue = Number(value) || 0;
  if (normalizedValue >= high) {
    return highColor;
  }
  if (normalizedValue >= medium) {
    return mediumColor;
  }
  return "transparent";
};

export const getClubBattleKillColor = (value, thresholds = {}) =>
  getThresholdColor(value, {
    high: 50,
    medium: 20,
    highColor: "rgba(76, 175, 80, 0.3)",
    mediumColor: "rgba(139, 195, 74, 0.3)",
    ...thresholds,
  });

export const getClubBattleOccupyColor = (value, thresholds = {}) =>
  getThresholdColor(value, {
    high: 100,
    medium: 50,
    highColor: "rgba(255, 204, 128, 0.3)",
    mediumColor: "rgba(255, 224, 178, 0.3)",
    ...thresholds,
  });

export const getClubBattleDeathColor = (value, thresholds = {}) =>
  getThresholdColor(value, {
    high: 20,
    medium: 10,
    highColor: "rgba(239, 154, 154, 0.3)",
    mediumColor: "rgba(255, 205, 210, 0.3)",
    ...thresholds,
  });

export const getClubBattleReviveColor = (value, thresholds = {}) =>
  getThresholdColor(value, {
    high: 5,
    medium: Number.POSITIVE_INFINITY,
    highColor: "rgba(200, 230, 201, 0.3)",
    mediumColor: "transparent",
    ...thresholds,
  });

export const getClubBattleRankMedal = (index) => {
  if (index === 0) return "🥇";
  if (index === 1) return "🥈";
  if (index === 2) return "🥉";
  return "";
};
