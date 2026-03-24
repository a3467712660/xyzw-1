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
    "dev",
  ),
  buildId: normalize(
    process.env.BUILD_ID || process.env.GITHUB_RUN_ID || process.env.VITE_BUILD_ID,
    "local",
  ),
  buildTime: normalize(
    process.env.BUILD_TIME || process.env.VITE_BUILD_TIME,
    new Date().toISOString(),
  ),
});

export const publicBuildInfo = Object.freeze({
  appVersion: buildInfo.appVersion,
  backendVersion: buildInfo.backendVersion,
  gitSha: buildInfo.gitSha,
  buildId: buildInfo.buildId,
  buildTime: buildInfo.buildTime,
});
