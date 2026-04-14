export const getClubMemberAvatarFallback = (name, maxLength = 1) => {
  const normalizedName = String(name || "").trim();
  if (!normalizedName) {
    return "?";
  }
  return normalizedName.substring(0, maxLength) || "?";
};

export const buildClubMemberHeroChips = (
  heroList = [],
  formatHeroChip = (hero) => hero?.heroName || "",
) =>
  (heroList || [])
    .map((hero) => String(formatHeroChip(hero) || "").trim())
    .filter(Boolean);

export const buildClubMemberCardModel = ({
  actionLabel = "",
  actionType = "default",
  avatar = "",
  avatarText = "?",
  badges = [],
  chips = [],
  id = "",
  lineupTag = null,
  metrics = [],
  name = "",
  raw = null,
  subtext = "",
} = {}) => ({
  actionLabel,
  actionType,
  avatar,
  avatarText,
  badges,
  chips,
  id,
  lineupTag,
  metrics,
  name,
  raw,
  subtext,
});
