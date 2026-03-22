/**
 * 竞技场阵容预置（统一数据源）
 * 供竞技场卡片、任务控制、批量设置复用，避免多处维护不一致。
 */
export const ARENA_LINEUP_PRESET_VALUES = [
  "吕赵",
  "吕布华佗",
  "吕布",
  "赵云",
  "典韦",
  "姜维",
  "三蜀",
  "关羽",
  "吴",
  "毒",
  "俱乐部",
  "未知",
];

export const ARENA_LINEUP_PRESET_OPTIONS = ARENA_LINEUP_PRESET_VALUES.map(
  (text) => ({
    label: text,
    value: text,
  }),
);

export const ARENA_DEFAULT_SKIP_LINEUPS = ["吕赵", "关羽"];
