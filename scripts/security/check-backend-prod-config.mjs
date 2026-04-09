import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const defaultEnvPath = path.resolve(cwd, "backend/.env.example");

const parseArgs = () => {
  const args = process.argv.slice(2);
  const envFlagIndex = args.findIndex((item) => item === "--env");
  if (envFlagIndex >= 0 && args[envFlagIndex + 1]) {
    return path.resolve(cwd, args[envFlagIndex + 1]);
  }
  return defaultEnvPath;
};

const parseEnvFile = (filePath) => {
  const raw = fs.readFileSync(filePath, "utf8");
  const output = {};
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) return;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();
    output[key] = value;
  });
  return output;
};

const isLoopbackHost = (hostname = "") => {
  const normalized = String(hostname || "").trim().toLowerCase();
  return (
    normalized === "localhost"
    || normalized === "127.0.0.1"
    || normalized === "::1"
    || normalized === "[::1]"
  );
};

const assertHttpsOrigin = (value, label) => {
  let url;
  try {
    url = new URL(String(value || "").trim());
  } catch {
    throw new Error(`${label} must be a valid absolute HTTPS origin`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${label} must use HTTPS`);
  }
  if (isLoopbackHost(url.hostname)) {
    throw new Error(`${label} must not use localhost/loopback`);
  }
};

const parseCsv = (value) =>
  String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const assertTrustedImportHosts = (patterns) => {
  patterns.forEach((pattern) => {
    const normalized = String(pattern || "").trim().replace(/^\./, "");
    if (!normalized) return;
    if (isLoopbackHost(normalized)) {
      throw new Error("TRUSTED_IMPORT_API_HOSTS must not include localhost/loopback");
    }
    if (!/^[a-z0-9.-]+$/i.test(normalized)) {
      throw new Error(`TRUSTED_IMPORT_API_HOSTS contains invalid host pattern: ${pattern}`);
    }
  });
};

const assertTrustProxy = (value) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    throw new Error("TRUST_PROXY must be explicitly set");
  }
};

const targetEnvPath = parseArgs();
if (!fs.existsSync(targetEnvPath)) {
  throw new Error(`env file not found: ${targetEnvPath}`);
}

const env = parseEnvFile(targetEnvPath);
const corsOrigins = parseCsv(env.CORS_ORIGINS);
if (corsOrigins.length === 0) {
  throw new Error("CORS_ORIGINS must include at least one origin");
}
corsOrigins.forEach((origin) => assertHttpsOrigin(origin, "CORS_ORIGINS entry"));
assertHttpsOrigin(env.PUBLIC_APP_ORIGIN, "PUBLIC_APP_ORIGIN");
assertHttpsOrigin(env.ADMIN_APP_ORIGIN, "ADMIN_APP_ORIGIN");
assertTrustedImportHosts(parseCsv(env.TRUSTED_IMPORT_API_HOSTS));
assertTrustProxy(env.TRUST_PROXY);

console.log(`[prod-config-check] ok: ${targetEnvPath}`);
