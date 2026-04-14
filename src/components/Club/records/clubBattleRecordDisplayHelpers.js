export const getClubBattleAvatarText = (name) =>
  String(name || "").trim().charAt(0) || "?";

export const getClubBattleAverageValue = (
  total,
  count,
  digits = 1,
) => {
  const normalizedCount = Number(count) || 0;
  if (!normalizedCount) {
    return Number(0).toFixed(digits);
  }
  return (Number(total || 0) / normalizedCount).toFixed(digits);
};

export const buildClubBattleStatItems = (entries = []) =>
  entries.map((entry) => ({
    label: entry.label,
    value: entry.value ?? 0,
  }));

export const buildClubBattleTopPanel = ({
  items = [],
  keyPrefix = "rank",
  limit = 3,
  title,
  valueKey,
  valueFormatter = (value) => value,
}) => ({
  items: items.slice(0, limit).map((item, index) => ({
    avatar: item.avatar || "",
    key: `${keyPrefix}-${item.key || item.roleId || index}`,
    name: item.name || "未知成员",
    value: valueFormatter(item[valueKey] ?? 0, item),
  })),
  title,
});

export const buildClubBattleTopPanels = (definitions = []) =>
  definitions.map(buildClubBattleTopPanel);
