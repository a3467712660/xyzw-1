import { formatClubBattleKD } from "./clubBattleRecordFormatters.js";

const toNumber = (value) => Number(value) || 0;

const defaultNameGetter = (player) =>
  player?.name || player?.roleInfo?.name || "未知成员";

const defaultAvatarGetter = (player) =>
  player?.headImg || player?.roleInfo?.headImg || "";

export const normalizeClubBattleRows = (players = [], options = {}) => {
  const {
    avatarGetter = defaultAvatarGetter,
    deathGetter = (player) => player?.loseCnt ?? player?.reviveCnt ?? 0,
    extraGetter = () => ({}),
    kdGetter,
    killGetter = (player) => player?.winCnt ?? player?.killCnt ?? 0,
    killStreakGetter = (player) => player?.mCKCnt ?? 0,
    nameGetter = defaultNameGetter,
    occupyGetter = (player) => player?.buildingCnt ?? player?.carCnt ?? 0,
    reviveGetter = (player) => Math.max(toNumber(player?.loseCnt) - 6, 0),
  } = options;

  return players.map((player, index) => {
    const killCnt = toNumber(killGetter(player));
    const deathCnt = toNumber(deathGetter(player));
    const reviveCnt = toNumber(reviveGetter(player));
    const occupyCnt = toNumber(occupyGetter(player));
    const killStreakCnt = toNumber(killStreakGetter(player));
    const kd = kdGetter
      ? kdGetter(player, {
          deathCnt,
          killCnt,
          killStreakCnt,
          occupyCnt,
          reviveCnt,
        })
      : formatClubBattleKD(killCnt, deathCnt);

    return {
      avatar: avatarGetter(player),
      deathCnt,
      kd,
      key:
        player?.roleId ||
        player?.id ||
        player?.rid ||
        `${index}-${String(nameGetter(player)).trim()}`,
      killCnt,
      killStreakCnt,
      name: nameGetter(player),
      occupyCnt,
      rank: index + 1,
      raw: player,
      reviveCnt,
      ...extraGetter(player, {
        deathCnt,
        killCnt,
        killStreakCnt,
        occupyCnt,
        reviveCnt,
      }),
    };
  });
};

export const getClubBattleTopRows = (
  rows = [],
  field,
  { limit = 3, order = "desc" } = {},
) => {
  const direction = order === "asc" ? 1 : -1;
  return [...rows]
    .sort((left, right) => {
      const leftValue = toNumber(left?.[field]);
      const rightValue = toNumber(right?.[field]);
      if (leftValue === rightValue) {
        return (left?.rank || 0) - (right?.rank || 0);
      }
      return (leftValue - rightValue) * direction;
    })
    .slice(0, limit);
};

export const sortClubBattleRowsByKd = (rows = []) =>
  [...rows]
    .sort((left, right) => {
      const leftValue = toNumber(left?.kd);
      const rightValue = toNumber(right?.kd);
      if (leftValue === rightValue) {
        return (left?.rank || 0) - (right?.rank || 0);
      }
      return rightValue - leftValue;
    })
    .map((row, index) => ({
      ...row,
      rank: index + 1,
    }));
