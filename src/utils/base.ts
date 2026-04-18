const DAY_MS = 24 * 60 * 60 * 1000;

const normalizeWeekStart = (weekStart: number) => {
  if (!Number.isInteger(weekStart)) {
    return 1;
  }
  return ((weekStart % 7) + 7) % 7;
};

const getLocalWeekStart = (date: Date, weekStart: number) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);

  const day = start.getDay();
  const diff = (day - weekStart + 7) % 7;
  start.setDate(start.getDate() - diff);

  return start;
};

// 判断当前时间是否在本周内（默认周一00点重置）
export const isInCurrentWeek = (timestamp: number, weekStart = 1) => {
  const target = new Date(timestamp);
  if (Number.isNaN(target.getTime())) {
    return false;
  }

  const normalizedWeekStart = normalizeWeekStart(weekStart);
  const currentWeekStart = getLocalWeekStart(new Date(), normalizedWeekStart);
  const currentWeekEnd = currentWeekStart.getTime() + 7 * DAY_MS;
  const targetTime = target.getTime();

  return targetTime >= currentWeekStart.getTime() && targetTime < currentWeekEnd;
};

/** 生成 [min,max] 的随机整数 */
export const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

/** Promise 版 sleep */
export const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));
