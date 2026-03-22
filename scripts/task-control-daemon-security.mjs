import fs from "fs";
import process from "process";

export const USER_DATA_DIR_MODE = 0o700;

export const parseBool = (input, fallback = false) => {
  const raw = String(input ?? "").trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
};

export const isLoopbackBaseUrl = (baseUrl) => {
  try {
    const parsed = new URL(baseUrl);
    const host = String(parsed.hostname || "").toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
  } catch {
    return false;
  }
};

export const assertSandboxPolicy = ({ disableSandbox, isProduction, baseUrl }) => {
  if (!disableSandbox) return;
  if (isProduction) {
    throw new Error("production 环境禁止启用 TASK_DAEMON_DISABLE_SANDBOX");
  }
  if (!isLoopbackBaseUrl(baseUrl)) {
    throw new Error("仅允许在 localhost/127.0.0.1 场景启用 TASK_DAEMON_DISABLE_SANDBOX");
  }
};

export const ensureSecureUserDataDir = ({
  persistSession,
  userDataDir,
  platform = process.platform,
  fsModule = fs,
}) => {
  if (!persistSession) return;
  if (!userDataDir) {
    throw new Error("persistSession=true 时必须提供 userDataDir");
  }

  if (!fsModule.existsSync(userDataDir)) {
    fsModule.mkdirSync(userDataDir, { recursive: true, mode: USER_DATA_DIR_MODE });
  }

  if (platform === "win32") {
    return;
  }

  const mode = fsModule.statSync(userDataDir).mode & 0o777;
  if ((mode & 0o077) !== 0) {
    throw new Error(`userDataDir 权限过宽 (${mode.toString(8)})：${userDataDir}，请执行 chmod 700`);
  }
};
