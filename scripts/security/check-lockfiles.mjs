import fs from "fs";
import path from "path";

const rootDir = process.cwd();

const errors = [];

const requireFile = (relativePath) => {
  const fullPath = path.join(rootDir, relativePath);
  if (!fs.existsSync(fullPath)) {
    errors.push(`missing required file: ${relativePath}`);
    return null;
  }
  return fullPath;
};

const readJson = (relativePath) => {
  const fullPath = requireFile(relativePath);
  if (!fullPath) return null;
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    errors.push(`invalid JSON: ${relativePath} (${error.message})`);
    return null;
  }
};

const rootPkg = readJson("package.json");
const backendPkg = readJson("backend/package.json");
const rootLock = readJson("package-lock.json");
const backendLock = readJson("backend/package-lock.json");

const checkPackageManager = (pkg, label) => {
  if (!pkg) return;
  const manager = String(pkg.packageManager || "").trim();
  if (!manager.startsWith("npm@")) {
    errors.push(`${label} packageManager must start with npm@, got: ${manager || "<empty>"}`);
  }
};

checkPackageManager(rootPkg, "root");
if (backendPkg && backendPkg.packageManager) {
  checkPackageManager(backendPkg, "backend");
}

const checkLockfile = (lock, lockPath, expectedName) => {
  if (!lock) return;
  if (!Number.isInteger(lock.lockfileVersion) || lock.lockfileVersion < 2) {
    errors.push(`${lockPath} lockfileVersion must be >= 2`);
  }
  if (expectedName && String(lock.name || "") !== expectedName) {
    errors.push(`${lockPath} name mismatch: expected ${expectedName}, got ${String(lock.name || "<empty>")}`);
  }
};

checkLockfile(rootLock, "package-lock.json", rootPkg?.name);
checkLockfile(backendLock, "backend/package-lock.json", backendPkg?.name);

const forbiddenLocks = ["pnpm-lock.yaml", "yarn.lock", "backend/pnpm-lock.yaml", "backend/yarn.lock"];
for (const relativePath of forbiddenLocks) {
  if (fs.existsSync(path.join(rootDir, relativePath))) {
    errors.push(`forbidden lockfile exists: ${relativePath}`);
  }
}

if (errors.length > 0) {
  console.error("[security:lockfiles] policy check failed");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("[security:lockfiles] lockfile policy check passed");
