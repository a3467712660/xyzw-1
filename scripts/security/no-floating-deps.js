import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();
const manifestPaths = [
  path.join(repoRoot, "package.json"),
  path.join(repoRoot, "backend", "package.json"),
];

const dependencySections = new Set([
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "overrides",
]);

const bannedPackages = new Set(["plain-crypto-js"]);
const blockedOverrideVersion = "0.0.0-blocked";
const bannedExactVersions = new Map([
  ["axios", new Set(["1.14.1", "0.30.4"])],
]);

const hasFloatingRange = (specifier) => {
  const normalized = String(specifier || "").trim();
  if (!normalized) {
    return false;
  }
  if (normalized.includes("^")) return "caret range";
  if (normalized.includes("~")) return "tilde range";
  if (/^latest$/i.test(normalized)) return "latest tag";
  if (normalized.includes("*")) return "star wildcard";
  if (/(^|[.\s-])x($|[.\s-])/i.test(normalized)) return "x wildcard";
  return "";
};

const visitDependencyMap = ({
  manifestPath,
  sectionName,
  currentPath,
  value,
  errors,
}) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return;
  }

  for (const [pkgName, pkgValue] of Object.entries(value)) {
    const nextPath = currentPath
      ? `${currentPath}.${pkgName}`
      : `${sectionName}.${pkgName}`;

    if (typeof pkgValue === "string") {
      const bannedReason = hasFloatingRange(pkgValue);
      if (bannedReason) {
        errors.push(
          `${manifestPath}: ${nextPath} uses ${bannedReason} (${pkgValue})`,
        );
      }

      const isBlockedOverride =
        sectionName === "overrides" && pkgValue.trim() === blockedOverrideVersion;
      if (bannedPackages.has(pkgName) && !isBlockedOverride) {
        errors.push(`${manifestPath}: ${nextPath} contains banned package ${pkgName}`);
      }

      const bannedVersions = bannedExactVersions.get(pkgName);
      if (bannedVersions?.has(pkgValue.trim())) {
        errors.push(
          `${manifestPath}: ${nextPath} contains banned version ${pkgName}@${pkgValue.trim()}`,
        );
      }
      continue;
    }

    if (pkgName === "." && typeof pkgValue === "object") {
      visitDependencyMap({
        manifestPath,
        sectionName,
        currentPath: nextPath,
        value: pkgValue,
        errors,
      });
      continue;
    }

    if (typeof pkgValue === "object" && !Array.isArray(pkgValue)) {
      visitDependencyMap({
        manifestPath,
        sectionName,
        currentPath: nextPath,
        value: pkgValue,
        errors,
      });
    }
  }
};

const scanManifest = (manifestFile) => {
  const relativePath = path.relative(repoRoot, manifestFile) || "package.json";
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const errors = [];

  for (const [sectionName, sectionValue] of Object.entries(manifest)) {
    if (!dependencySections.has(sectionName)) {
      continue;
    }

    visitDependencyMap({
      manifestPath: relativePath,
      sectionName,
      currentPath: "",
      value: sectionValue,
      errors,
    });
  }

  return errors;
};

const allErrors = manifestPaths.flatMap((manifestFile) => scanManifest(manifestFile));

if (allErrors.length > 0) {
  console.error("security:no-floating-deps failed:");
  for (const error of allErrors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log("security:no-floating-deps passed");
}
