import cron from "node-cron";
import { nowIso, randomId } from "../db/sql.js";
import { taskRepository } from "../repositories/taskRepository.js";
import { broadcastToUser } from "./wsHub.js";

const DEFAULT_TASKS = [
  {
    taskKey: "daily_signin",
    title: "每日签到",
    subtitle: "登录游戏获取签到奖励",
    cronExpr: "0 6 * * *",
    autoExecute: 0,
  },
  {
    taskKey: "daily_quest",
    title: "完成日常任务",
    subtitle: "完成5个日常任务获得奖励",
    cronExpr: "30 6 * * *",
    autoExecute: 0,
  },
  {
    taskKey: "guild_contribution",
    title: "公会贡献",
    subtitle: "为公会贡献资源获得贡献点",
    cronExpr: "0 7 * * *",
    autoExecute: 0,
  },
];

const jobs = new Map();

const jobKey = (userId, roleId, taskConfigId) => `${userId}:${roleId}:${taskConfigId}`;

export const ensureRoleTasks = (userId, roleId) => {
  const existing = taskRepository.listRoleTaskKeys({ userId, roleId });
  const existingKeys = new Set(existing.map((item) => item.taskKey));

  DEFAULT_TASKS.forEach((task) => {
    if (existingKeys.has(task.taskKey)) return;

    const ts = nowIso();
    taskRepository.createTaskConfig({
      id: randomId("task"),
      userId,
      roleId,
      taskKey: task.taskKey,
      title: task.title,
      subtitle: task.subtitle,
      autoExecute: task.autoExecute,
      cronExpr: task.cronExpr,
      updatedAt: ts,
      createdAt: ts,
    });
  });
};

export const listTasksByRole = (userId, roleId) => {
  ensureRoleTasks(userId, roleId);

  const taskRows = taskRepository.listTasksWithLatestRun({ userId, roleId });

  return taskRows.map((row) => ({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    icon: "/icons/ta.png",
    completed: row.lastStatus === "success",
    canExecute: Number(row.enabled) === 1,
    progress: { current: row.lastStatus === "success" ? 1 : 0, total: 1 },
    reward: "自动结算",
    nextReset: null,
    settings: {
      autoExecute: Number(row.autoExecute) === 1,
      delay: Number(row.delaySeconds || 0),
      notification: Number(row.notification) === 1,
      enabled: Number(row.enabled) === 1,
      cronExpr: row.cronExpr,
    },
    details: [],
    logs: row.lastRunAt
      ? [
          {
            id: `${row.id}_${row.lastRunAt}`,
            timestamp: new Date(row.lastRunAt).getTime(),
            type: row.lastStatus === "success" ? "success" : "error",
            message: row.lastMessage || "任务执行完成",
          },
        ]
      : [],
  }));
};

export const updateTaskConfig = (userId, roleId, taskConfigId, patch) => {
  const existing = taskRepository.findTaskConfigByOwner({
    id: taskConfigId,
    userId,
    roleId,
  });

  if (!existing) {
    return null;
  }

  taskRepository.patchTaskConfig({
    id: taskConfigId,
    enabled: patch.enabled,
    autoExecute: patch.autoExecute,
    delaySeconds: patch.delaySeconds,
    notification: patch.notification,
    cronExpr: patch.cronExpr,
    updatedAt: nowIso(),
  });

  syncScheduledJobsForUser(userId);
  return taskRepository.findTaskConfigById(taskConfigId);
};

export const recordTaskRun = (userId, roleId, taskConfigId, status, message, source) => {
  taskRepository.createTaskRun({
    id: randomId("run"),
    userId,
    roleId,
    taskConfigId,
    status,
    message,
    runAt: nowIso(),
    source,
  });
};

export const executeTaskNow = (userId, roleId, taskConfigId, source = "manual") => {
  const task = taskRepository.findTaskExecutionTarget({
    id: taskConfigId,
    userId,
    roleId,
  });

  if (!task) {
    return { success: false, message: "任务不存在" };
  }

  const delay = Number(task.delaySeconds || 0);
  const at = new Date(Date.now() + delay * 1000).toISOString();
  const msg = `任务 ${task.title} 执行成功 (${source})`;

  recordTaskRun(userId, roleId, taskConfigId, "success", `${msg} @ ${at}`, source);

  broadcastToUser(userId, {
    type: "task:done",
    roleId,
    taskConfigId,
    source,
    at,
    message: msg,
  });

  return { success: true, message: msg };
};

export const listTaskHistory = (userId, roleId, page = 1, limit = 20) => {
  const safePage = Math.max(1, Number(page) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 20));
  const offset = (safePage - 1) * safeLimit;

  return taskRepository.listTaskRunsByRole({
    userId,
    roleId,
    limit: safeLimit,
    offset,
  });
};

const buildJobsForRows = (rows) => {
  rows.forEach((row) => {
    const key = jobKey(row.userId, row.roleId, row.id);
    const enabled = Number(row.enabled) === 1;
    const autoExecute = Number(row.autoExecute) === 1;

    if (!enabled || !autoExecute) {
      if (jobs.has(key)) {
        jobs.get(key).stop();
        jobs.delete(key);
      }
      return;
    }

    if (jobs.has(key)) {
      jobs.get(key).stop();
      jobs.delete(key);
    }

    if (!cron.validate(row.cronExpr)) {
      return;
    }

    const job = cron.schedule(row.cronExpr, () => {
      executeTaskNow(row.userId, row.roleId, row.id, "cron");
    });

    jobs.set(key, job);
  });
};

export const stopScheduledJobs = () => {
  jobs.forEach((job) => job.stop());
  jobs.clear();
};

export const syncScheduledJobs = () => {
  const rows = taskRepository.listTaskConfigsForSchedule();

  stopScheduledJobs();

  buildJobsForRows(rows);
};

export const syncScheduledJobsForUser = (userId) => {
  for (const [key, job] of jobs.entries()) {
    if (key.startsWith(`${userId}:`)) {
      job.stop();
      jobs.delete(key);
    }
  }

  const rows = taskRepository.listTaskConfigsForSchedule(userId);

  buildJobsForRows(rows);
};
