import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertSandboxPolicy,
  ensureSecureUserDataDir,
  isLoopbackBaseUrl,
  parseBool,
} from "../scripts/task-control-daemon-security.mjs";

test("parseBool handles common boolean variants", () => {
  assert.equal(parseBool("true", false), true);
  assert.equal(parseBool("YES", false), true);
  assert.equal(parseBool("0", true), false);
  assert.equal(parseBool("off", true), false);
  assert.equal(parseBool("", true), true);
  assert.equal(parseBool("unknown", false), false);
});

test("isLoopbackBaseUrl only allows localhost loopback hosts", () => {
  assert.equal(isLoopbackBaseUrl("http://localhost:3000"), true);
  assert.equal(isLoopbackBaseUrl("https://127.0.0.1:8787"), true);
  assert.equal(isLoopbackBaseUrl("http://[::1]:3000"), true);
  assert.equal(isLoopbackBaseUrl("https://example.com"), false);
  assert.equal(isLoopbackBaseUrl("not-a-url"), false);
});

test("assertSandboxPolicy enforces production and host boundaries", () => {
  assert.doesNotThrow(() =>
    assertSandboxPolicy({ disableSandbox: false, isProduction: true, baseUrl: "https://example.com" }));

  assert.throws(
    () => assertSandboxPolicy({ disableSandbox: true, isProduction: true, baseUrl: "http://127.0.0.1:3000" }),
    /production 环境禁止启用/,
  );

  assert.throws(
    () => assertSandboxPolicy({ disableSandbox: true, isProduction: false, baseUrl: "https://example.com" }),
    /仅允许在 localhost\/127.0.0.1 场景启用/,
  );

  assert.doesNotThrow(() =>
    assertSandboxPolicy({ disableSandbox: true, isProduction: false, baseUrl: "http://localhost:3000" }));
});

test("ensureSecureUserDataDir creates directory when missing", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "daemon-sec-create-"));
  const userDataDir = path.join(tempRoot, "profile");

  try {
    ensureSecureUserDataDir({ persistSession: true, userDataDir });
    assert.equal(fs.existsSync(userDataDir), true);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("ensureSecureUserDataDir rejects overly permissive mode on posix", { skip: process.platform === "win32" }, () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "daemon-sec-mode-"));
  const userDataDir = path.join(tempRoot, "profile");

  try {
    fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(userDataDir, 0o755);

    assert.throws(
      () => ensureSecureUserDataDir({ persistSession: true, userDataDir }),
      /userDataDir 权限过宽/,
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});

test("ensureSecureUserDataDir skips mode check on windows", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "daemon-sec-win-"));
  const userDataDir = path.join(tempRoot, "profile");

  try {
    fs.mkdirSync(userDataDir, { recursive: true, mode: 0o700 });
    fs.chmodSync(userDataDir, 0o755);
    assert.doesNotThrow(() =>
      ensureSecureUserDataDir({ persistSession: true, userDataDir, platform: "win32" }));
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
});
