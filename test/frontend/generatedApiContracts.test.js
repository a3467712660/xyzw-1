import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();
const openapiPath = path.resolve(repoRoot, "openapi.json");
const generatedClientPath = path.resolve(repoRoot, "src/api/generated/client.ts");
const generatedIndexPath = path.resolve(repoRoot, "src/api/generated/index.ts");

test("generated hardening API artifacts exist and cover auth/security/proxy endpoints", () => {
  assert.equal(fs.existsSync(openapiPath), true, "expected openapi.json to exist");
  assert.equal(fs.existsSync(generatedClientPath), true, "expected generated client to exist");
  assert.equal(fs.existsSync(generatedIndexPath), true, "expected generated index to exist");

  const document = JSON.parse(fs.readFileSync(openapiPath, "utf8"));
  const paths = document?.paths || {};

  assert.ok(paths["/api/v1/auth/login"]);
  assert.ok(paths["/api/v1/auth/refresh"]);
  assert.ok(paths["/api/v1/auth/mfa/verify"]);
  assert.ok(paths["/api/v1/user/confirm-password"]);
  assert.ok(paths["/api/v1/admin/confirm-password"]);
  assert.ok(paths["/api/v1/token-import/proxy"]);
  assert.ok(paths["/api/v1/wechat-proxy/qrstatus"]);

  const generatedClientSource = fs.readFileSync(generatedClientPath, "utf8");
  assert.equal(generatedClientSource.includes("login"), true);
  assert.equal(generatedClientSource.includes("refreshToken"), true);
  assert.equal(generatedClientSource.includes("verifyMfa"), true);
  assert.equal(generatedClientSource.includes("tokenImportProxyFetch"), true);
});
