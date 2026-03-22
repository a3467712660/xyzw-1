#!/usr/bin/env node

import fs from "fs";
import path from "path";
import process from "process";
import { chromium } from "playwright";
import {
  assertSandboxPolicy,
  ensureSecureUserDataDir,
  parseBool,
} from "./task-control-daemon-security.mjs";

const HEADLESS = String(process.env.TASK_DAEMON_HEADLESS || "true").toLowerCase() !== "false";
const DEFAULT_BASE_URL = String(process.env.TASK_DAEMON_BASE_URL || "http://127.0.0.1:3000").replace(/\/+$/, "");
const DEFAULT_CHECK_INTERVAL_MS = Math.max(
  5000,
  Number.parseInt(String(process.env.TASK_DAEMON_CHECK_INTERVAL_MS || "15000"), 10) || 15000,
);
const DEFAULT_PERSIST_SESSION = parseBool(process.env.TASK_DAEMON_PERSIST_SESSION, false);
const DEFAULT_USER_DATA_DIR = String(
  process.env.TASK_DAEMON_USER_DATA_DIR || ".runtime/task-daemon-profile",
);
const DISABLE_SANDBOX = parseBool(process.env.TASK_DAEMON_DISABLE_SANDBOX, false);
const isProduction = String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";

const accountStates = new Map();
let exiting = false;

const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

const normalizeEnvKey = (accountId) =>
  String(accountId || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "_");

const log = (message, accountId = "system") => {
  const ts = new Date().toISOString();
  // eslint-disable-next-line no-console
  console.log(`[task-daemon][${accountId}] ${ts} ${message}`);
};

const getAccounts = () => {
  const accountListRaw = String(process.env.TASK_DAEMON_ACCOUNTS || "").trim();
  if (!accountListRaw) {
    return [
      {
        id: "default",
        username: String(process.env.TASK_DAEMON_USERNAME || "").trim(),
        password: String(process.env.TASK_DAEMON_PASSWORD || "").trim(),
        baseUrl: DEFAULT_BASE_URL,
        checkIntervalMs: DEFAULT_CHECK_INTERVAL_MS,
        persistSession: DEFAULT_PERSIST_SESSION,
        userDataDir: path.resolve(process.cwd(), DEFAULT_USER_DATA_DIR),
      },
    ];
  }

  const ids = [...new Set(accountListRaw.split(",").map((item) => item.trim()).filter(Boolean))];
  return ids.map((id) => {
    const envKey = normalizeEnvKey(id);
    const username = String(process.env[`TASK_DAEMON_${envKey}_USERNAME`] || "").trim();
    const password = String(process.env[`TASK_DAEMON_${envKey}_PASSWORD`] || "").trim();
    const baseUrl = String(
      process.env[`TASK_DAEMON_${envKey}_BASE_URL`] || DEFAULT_BASE_URL,
    ).replace(/\/+$/, "");
    const checkIntervalMs = Math.max(
      5000,
      Number.parseInt(
        String(
          process.env[`TASK_DAEMON_${envKey}_CHECK_INTERVAL_MS`] || DEFAULT_CHECK_INTERVAL_MS,
        ),
        10,
      ) || DEFAULT_CHECK_INTERVAL_MS,
    );
    const userDataDir = path.resolve(
      process.cwd(),
      String(
        process.env[`TASK_DAEMON_${envKey}_USER_DATA_DIR`] ||
          `.runtime/task-daemon-profile-${id}`,
      ),
    );
    const persistSession = parseBool(
      process.env[`TASK_DAEMON_${envKey}_PERSIST_SESSION`],
      DEFAULT_PERSIST_SESSION,
    );

    return { id, username, password, baseUrl, checkIntervalMs, persistSession, userDataDir };
  });
};

const isLoggedIn = async (state) => {
  const { page, account } = state;
  if (!page || page.isClosed()) return false;
  const url = page.url();
  if (!url.startsWith(account.baseUrl)) return false;
  if (url.includes("/login")) return false;

  try {
    const authCheck = await page.evaluate(async () => {
      try {
        const res = await fetch("/api/v1/auth/me", {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });
        if (!res.ok) {
          return false;
        }
        const body = await res.json().catch(() => null);
        return Boolean(body?.success);
      } catch {
        return false;
      }
    });
    return Boolean(authCheck);
  } catch {
    return false;
  }
};

const doLoginIfNeeded = async (state) => {
  const { page, account } = state;
  await page.goto(`${account.baseUrl}/admin/task-control`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);

  if (!page.url().includes("/login")) {
    return;
  }

  if (!account.username || !account.password) {
    throw new Error(
      `账号 ${account.id} 未登录，且缺少对应用户名密码环境变量`,
    );
  }

  log("发现未登录，执行自动登录", account.id);
  await page.fill('input[placeholder="用户名或邮箱"]', account.username);
  await page.fill('input[placeholder="密码"]', account.password);
  await page.getByRole("button", { name: "登录", exact: true }).click();

  const gotDialog = await page
    .getByRole("button", { name: "我知道了", exact: true })
    .isVisible()
    .catch(() => false);

  if (gotDialog) {
    await page.getByRole("button", { name: "我知道了", exact: true }).click();
  }

  await page.waitForURL((url) => !url.href.includes("/login"), { timeout: 30000 });
  log("自动登录成功", account.id);
};

const ensureTaskControlPage = async (state) => {
  const { context, account } = state;

  if (!state.page || state.page.isClosed()) {
    state.page = await context.newPage();
    state.page.on("pageerror", (err) => log(`pageerror: ${err?.message || err}`, account.id));
    state.page.on("console", (msg) => {
      const type = msg.type();
      if (type === "error" || type === "warning") {
        log(`browser:${type}: ${msg.text()}`, account.id);
      }
    });
  }

  const loggedIn = await isLoggedIn(state);
  if (!loggedIn) {
    await doLoginIfNeeded(state);
  }

  if (!state.page.url().includes("/admin/task-control")) {
    await state.page.goto(`${account.baseUrl}/admin/task-control`, { waitUntil: "domcontentloaded" });
  }

  await state.page.waitForSelector(".task-control-panel", { timeout: 30000 });
};

const heartbeat = async (accountId) => {
  if (exiting) return;
  const state = accountStates.get(accountId);
  if (!state) return;
  try {
    await ensureTaskControlPage(state);
  } catch (error) {
    log(`heartbeat failed: ${error?.message || error}`, accountId);
  }
};

const shutdown = async (signal = "SIGTERM") => {
  if (exiting) return;
  exiting = true;
  log(`收到 ${signal}，准备退出`);
  for (const [accountId, state] of accountStates.entries()) {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    try {
      if (state.context) {
        await state.context.close();
      }
      if (state.browser) {
        await state.browser.close();
      }
    } catch (error) {
      log(`关闭 context 失败: ${error?.message || error}`, accountId);
    }
  }
  process.exit(0);
};

const bootstrapAccount = async (account) => {
  assertSandboxPolicy({
    disableSandbox: DISABLE_SANDBOX,
    isProduction,
    baseUrl: account.baseUrl,
  });
  ensureSecureUserDataDir({
    persistSession: account.persistSession,
    userDataDir: account.userDataDir,
    platform: process.platform,
    fsModule: fs,
  });

  log(
    `启动账号守护，BASE_URL=${account.baseUrl} PERSIST_SESSION=${account.persistSession} USER_DATA_DIR=${account.persistSession ? account.userDataDir : "(ephemeral)"} INTERVAL=${account.checkIntervalMs}ms`,
    account.id,
  );

  const launchArgs = [
    "--disable-dev-shm-usage",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--disable-backgrounding-occluded-windows",
    ...(DISABLE_SANDBOX ? ["--no-sandbox"] : []),
  ];

  let browser = null;
  let context = null;
  if (account.persistSession) {
    context = await chromium.launchPersistentContext(account.userDataDir, {
      headless: HEADLESS,
      viewport: { width: 1366, height: 768 },
      args: launchArgs,
    });
  } else {
    browser = await chromium.launch({
      headless: HEADLESS,
      args: launchArgs,
    });
    context = await browser.newContext({
      viewport: { width: 1366, height: 768 },
    });
  }

  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();
  page.on("pageerror", (err) => log(`pageerror: ${err?.message || err}`, account.id));

  const state = { account, browser, context, page, timer: null };
  accountStates.set(account.id, state);

  await ensureTaskControlPage(state);
  state.timer = setInterval(() => {
    heartbeat(account.id);
  }, account.checkIntervalMs);
  if (typeof state.timer.unref === "function") state.timer.unref();

  log("守护就绪，任务控制页已常驻", account.id);
};

const main = async () => {
  const accounts = getAccounts();
  if (accounts.length === 0) {
    throw new Error("未配置任何守护账号");
  }

  log(
    `启动守护进程，账号数=${accounts.length} HEADLESS=${HEADLESS} DEFAULT_PERSIST_SESSION=${DEFAULT_PERSIST_SESSION}`,
  );
  for (const account of accounts) {
    try {
      await bootstrapAccount(account);
    } catch (error) {
      log(`账号启动失败: ${error?.message || error}`, account.id);
    }
  }

  if (accountStates.size === 0) {
    throw new Error("所有账号启动失败");
  }

  while (!exiting) {
    await sleep(60_000);
  }
};

process.on("SIGINT", () => {
  shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  shutdown("SIGTERM");
});

main().catch((error) => {
  log(`启动失败: ${error?.stack || error?.message || error}`);
  process.exit(1);
});
