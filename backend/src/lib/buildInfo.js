import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentFile = fileURLToPath(import.meta.url);
const currentDir = path.dirname(currentFile);
const backendRoot = path.resolve(currentDir, "..", "..");
const repoRoot = path.resolve(backendRoot, "..");

const readPackageVersion = (filePath, fallback) => {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return String(parsed?.version || "").trim() || fallback;
  } catch {
    return fallback;
  }
};

const normalize = (value, fallback = "unknown") => {
  const raw = String(value || "").trim();
  return raw || fallback;
};

export const buildInfo = Object.freeze({
  appVersion: readPackageVersion(path.join(repoRoot, "package.json"), "unknown"),
  backendVersion: readPackageVersion(path.join(backendRoot, "package.json"), "unknown"),
  gitSha: normalize(
    process.env.BUILD_GIT_SHA || process.env.GITHUB_SHA || process.env.VITE_BUILD_GIT_SHA,
    "",
  ),
  buildId: normalize(
    process.env.BUILD_ID || process.env.GITHUB_RUN_ID || process.env.VITE_BUILD_ID,
    "",
  ),
  buildTime: normalize(
    process.env.BUILD_TIME || process.env.VITE_BUILD_TIME,
    "",
  ),
});

export const publicBuildInfo = Object.freeze({
  appVersion: buildInfo.appVersion,
  backendVersion: buildInfo.backendVersion,
  gitSha: buildInfo.gitSha,
  buildId: buildInfo.buildId,
  buildTime: buildInfo.buildTime,
});

const INVALID_PRODUCTION_GIT_SHA = new Set(["", "dev", "unknown", "local"]);
const INVALID_PRODUCTION_BUILD_ID = new Set(["", "local", "unknown", "dev"]);
const INVALID_PRODUCTION_BUILD_TIME = new Set(["", "unknown", "local", "dev"]);

export const assertProductionBuildInfoReady = (nodeEnv) => {
  if (String(nodeEnv || "").trim() !== "production") {
    return;
  }

  const gitSha = String(buildInfo.gitSha || "").trim().toLowerCase();
  const buildId = String(buildInfo.buildId || "").trim().toLowerCase();

  if (INVALID_PRODUCTION_GIT_SHA.has(gitSha)) {
    throw new Error(
      `Production startup blocked: BUILD_GIT_SHA is still a placeholder value (${buildInfo.gitSha}).`,
    );
  }

  if (INVALID_PRODUCTION_BUILD_ID.has(buildId)) {
    throw new Error(
      `Production startup blocked: BUILD_ID is still a placeholder value (${buildInfo.buildId}).`,
    );
  }

  const buildTime = String(buildInfo.buildTime || "").trim().toLowerCase();
  if (INVALID_PRODUCTION_BUILD_TIME.has(buildTime)) {
    throw new Error(
      `Production startup blocked: BUILD_TIME is missing or still a placeholder value (${buildInfo.buildTime}).`,
    );
  }
};
