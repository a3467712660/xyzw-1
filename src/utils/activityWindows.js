const THREE_WEEK_ACTIVITY_START = new Date("2025-12-12T12:00:00");
const ACTIVITY_WEEK_DURATION = 7 * 24 * 60 * 60 * 1000;
const THREE_WEEK_ACTIVITY_CYCLE_DURATION = 3 * ACTIVITY_WEEK_DURATION;

const normalizeDate = (value) => {
  if (value instanceof Date) {
    return value;
  }
  return new Date(value);
};

export const getThreeWeekActivityCycle = (
  now = new Date(),
  start = THREE_WEEK_ACTIVITY_START,
) => {
  const currentNow = normalizeDate(now);
  const cycleStart = normalizeDate(start);
  const elapsed = currentNow.getTime() - cycleStart.getTime();

  if (elapsed < 0) {
    return null;
  }

  const cyclePosition = elapsed % THREE_WEEK_ACTIVITY_CYCLE_DURATION;
  if (cyclePosition < ACTIVITY_WEEK_DURATION) {
    return "黑市周";
  }
  if (cyclePosition < 2 * ACTIVITY_WEEK_DURATION) {
    return "招募周";
  }
  return "宝箱周";
};

export const isWeirdTowerActivityOpen = (
  now = new Date(),
  currentActivityWeek = getThreeWeekActivityCycle(now),
) => {
  if (currentActivityWeek !== "黑市周") {
    return false;
  }

  const currentNow = normalizeDate(now);
  const day = currentNow.getDay();
  const hour = currentNow.getHours();

  if (day === 5) {
    return hour >= 12;
  }

  return true;
};
