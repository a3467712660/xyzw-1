import { test } from "node:test";
import assert from "node:assert/strict";
import path from "path";
import { spawnSync } from "node:child_process";

const backendDir = path.resolve(import.meta.dirname, "..");

const importEnvExpectFailure = (extraEnv) => {
  const child = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", "import './src/config/env.js';"],
    {
      cwd: backendDir,
      env: {
        ...process.env,
        JWT_SECRET: "test-jwt-secret",
        AES_KEY: "test-aes-key",
        ...extraEnv,
      },
      encoding: "utf8",
    },
  );
  return child;
};

test("__Host- refresh cookie requires REFRESH_COOKIE_PATH=/ at startup", () => {
  const result = importEnvExpectFailure({
    REFRESH_COOKIE_NAME: "__Host-test_refresh_token",
    REFRESH_COOKIE_PATH: "/api/v1/auth",
    REFRESH_COOKIE_SECURE: "true",
  });

  assert.notEqual(result.status, 0, "expected env import to fail");
  const output = `${result.stdout || ""}\n${result.stderr || ""}`;
  assert.match(output, /REFRESH_COOKIE_PATH must be '\/'/);
});

