const toArenaPositiveInteger = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return 0;
  }
  return Math.trunc(numeric);
};

export const formatArenaRankLabel = (rank, dashText = "-") => {
  const rankValue = toArenaPositiveInteger(rank);
  return rankValue > 0 ? `#${rankValue}` : dashText;
};

export const getArenaRecordTypeLabelText = (
  type,
  labels = { attack: "攻", defense: "守", unknown: "?" },
) => {
  const normalizedType = String(type || "");
  if (normalizedType.includes("攻")) return labels.attack;
  if (normalizedType.includes("守")) return labels.defense;
  return labels.unknown;
};

export const getArenaRankBadgeClass = (rank) => {
  const rankValue = toArenaPositiveInteger(rank);
  if (rankValue === 1) return "top1";
  if (rankValue === 2) return "top2";
  if (rankValue === 3) return "top3";
  return "normal";
};

export const getArenaRankRowClass = (rank) => {
  const rankValue = toArenaPositiveInteger(rank);
  if (rankValue === 1) return "row-top1";
  if (rankValue === 2) return "row-top2";
  if (rankValue === 3) return "row-top3";
  return "";
};

export const getArenaLineupClass = (lineupType, unknownText = "未知") => {
  const text = String(lineupType || unknownText).trim();
  if (text.includes("吕布华佗")) return "red";
  if (text.includes("吕赵")) return "red";
  if (text.includes("吕布")) return "red";
  if (text.includes("赵云") && text.includes("吕")) return "red";
  if (text.includes("典韦")) return "blue";
  if (text.includes("司马懿")) return "blue";
  if (text.includes("姜维")) return "green";
  if (text.includes("三蜀")) return "green";
  if (text.includes("关羽")) return "green";
  if (text.includes("吴")) return "red";
  if (text.includes("俱乐部")) return "pink";
  if (text.includes("毒")) return "purple";
  return "gray";
};

export const formatArenaScoreDelta = (scoreDelta, dashText = "-") => {
  const numeric = Number(scoreDelta);
  if (!Number.isFinite(numeric)) {
    return dashText;
  }
  const rounded = Math.trunc(numeric);
  return `${rounded > 0 ? "+" : ""}${rounded}`;
};

export const getArenaScoreDeltaClass = (scoreDelta) => {
  const numeric = Number(scoreDelta);
  if (!Number.isFinite(numeric) || numeric === 0) {
    return "neutral";
  }
  return numeric > 0 ? "positive" : "negative";
};

export const getArenaAvatarFallbackText = (name) =>
  String(name || "?").slice(0, 1);
