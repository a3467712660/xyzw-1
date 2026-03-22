import fs from "fs";
import path from "path";
import { env } from "../config/env.js";

const BACKEND_ERROR_LOG_PATH = env.backendErrorLogPath;
const BACKEND_ERROR_LOG_MAX_BYTES = env.backendErrorLogMaxBytes;
const BACKEND_ERROR_LOG_MAX_FILES = env.backendErrorLogMaxFiles;
const BACKEND_ERROR_LOG_FILE_MODE = env.backendErrorLogFileMode;
const BACKEND_ERROR_LOG_DIR_MODE = env.backendErrorLogDirMode;

const ensureOwnerOnlyPath = (targetPath, mode) => {
  const currentMode = fs.statSync(targetPath).mode & 0o777;
  if (currentMode !== mode) {
    fs.chmodSync(targetPath, mode);
  }
};

const rotateErrorLogIfNeeded = (incomingBytes = 0) => {
  if (!fs.existsSync(BACKEND_ERROR_LOG_PATH)) {
    return;
  }

  const currentSize = fs.statSync(BACKEND_ERROR_LOG_PATH).size;
  if (currentSize + incomingBytes <= BACKEND_ERROR_LOG_MAX_BYTES) {
    return;
  }

  for (let index = BACKEND_ERROR_LOG_MAX_FILES; index >= 1; index -= 1) {
    const source = `${BACKEND_ERROR_LOG_PATH}.${index}`;
    const target = `${BACKEND_ERROR_LOG_PATH}.${index + 1}`;
    if (!fs.existsSync(source)) continue;
    if (index === BACKEND_ERROR_LOG_MAX_FILES) {
      fs.rmSync(source, { force: true });
      continue;
    }
    fs.renameSync(source, target);
  }

  fs.renameSync(BACKEND_ERROR_LOG_PATH, `${BACKEND_ERROR_LOG_PATH}.1`);
};

const appendBackendErrorLog = (line) => {
  const logDir = path.dirname(BACKEND_ERROR_LOG_PATH);
  fs.mkdirSync(logDir, { recursive: true, mode: BACKEND_ERROR_LOG_DIR_MODE });
  ensureOwnerOnlyPath(logDir, BACKEND_ERROR_LOG_DIR_MODE);

  rotateErrorLogIfNeeded(Buffer.byteLength(line, "utf8"));

  if (!fs.existsSync(BACKEND_ERROR_LOG_PATH)) {
    fs.writeFileSync(BACKEND_ERROR_LOG_PATH, "", {
      encoding: "utf8",
      mode: BACKEND_ERROR_LOG_FILE_MODE,
    });
  } else {
    ensureOwnerOnlyPath(BACKEND_ERROR_LOG_PATH, BACKEND_ERROR_LOG_FILE_MODE);
  }

  fs.appendFileSync(BACKEND_ERROR_LOG_PATH, line, "utf8");
};

export function registerErrorHandler(app) {
  app.use((err, _req, res, _next) => {
    try {
      const line = `${new Date().toISOString()} ${err?.stack || err?.message || String(err)}\n`;
      appendBackendErrorLog(line);
    } catch {
      // ignore log write errors
    }

    if (String(err?.message || "").startsWith("CORS origin denied:")) {
      return res
        .status(403)
        .json({ success: false, message: "CORS origin not allowed" });
    }

    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, message: "服务器内部错误" });
  });
}
