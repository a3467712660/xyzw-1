#!/usr/bin/env node

const normalizedMode = String(process.env.BUILD_MODE || process.env.MODE || "production")
  .trim()
  .toLowerCase();

const normalizedDebugProxy = String(process.env.VITE_DEV_DEBUG_PROXY || "")
  .trim()
  .toLowerCase();

const isDebugLikeMode = ["debug", "development", "dev", "local"].includes(normalizedMode);
const isDebugProxyEnabled = ["1", "true", "yes", "on"].includes(normalizedDebugProxy);

if (isDebugLikeMode) {
  console.error(
    `[security:build-mode] blocked: BUILD_MODE/MODE="${normalizedMode}" is not allowed for release gates.`,
  );
  process.exit(1);
}

if (isDebugProxyEnabled) {
  console.error(
    "[security:build-mode] blocked: VITE_DEV_DEBUG_PROXY must stay disabled in release gates.",
  );
  process.exit(1);
}

console.log(
  `[security:build-mode] pass: mode="${normalizedMode}", VITE_DEV_DEBUG_PROXY="${
    normalizedDebugProxy || "unset"
  }".`,
);
