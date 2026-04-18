import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const repoRoot = process.cwd();

const read = (relativePath) =>
  fs.readFileSync(path.resolve(repoRoot, relativePath), "utf8");

const exists = (relativePath) =>
  fs.existsSync(path.resolve(repoRoot, relativePath));

test("production docker artifacts exist with healthchecks and without config-shadowing volumes", () => {
  assert.equal(exists("Dockerfile.backend"), true, "expected Dockerfile.backend");
  assert.equal(exists("Dockerfile.frontend"), true, "expected Dockerfile.frontend");
  assert.equal(
    exists("docker-compose.prod.example.yml"),
    true,
    "expected docker-compose.prod.example.yml",
  );
  assert.equal(
    exists("deploy/nginx/xyzw-container-frontend.conf"),
    true,
    "expected container nginx config",
  );

  const backendDockerfile = read("Dockerfile.backend");
  assert.match(backendDockerfile, /FROM\s+node:22-bookworm-slim/i);
  assert.match(backendDockerfile, /HEALTHCHECK/i);
  assert.match(backendDockerfile, /127\.0\.0\.1:8787\/health/);
  assert.match(backendDockerfile, /\bUSER\s+node\b/i);
  assert.doesNotMatch(backendDockerfile, /COPY\s+.*server\//i);
  assert.doesNotMatch(backendDockerfile, /COPY\s+.*backend\/data/i);
  assert.doesNotMatch(backendDockerfile, /COPY\s+.*\.env/i);

  const frontendDockerfile = read("Dockerfile.frontend");
  assert.match(frontendDockerfile, /FROM\s+node:22/i);
  assert.match(frontendDockerfile, /nginx.*unprivileged/i);
  assert.match(frontendDockerfile, /EXPOSE\s+8080/i);
  assert.match(frontendDockerfile, /HEALTHCHECK/i);
  assert.match(frontendDockerfile, /127\.0\.0\.1:8080\/healthz/);

  const compose = read("docker-compose.prod.example.yml");
  assert.match(compose, /^\s*frontend:\s*$/m);
  assert.match(compose, /^\s*backend:\s*$/m);
  assert.match(compose, /env_file:\s*\n\s*-\s*\.\/backend\/\.env/i);
  assert.match(compose, /read_only:\s*true/i);
  assert.match(compose, /tmpfs:/i);
  assert.match(compose, /8080:8080/i);

  const localDockerfile = read("docker/dockerfile");
  assert.doesNotMatch(localDockerfile, /VOLUME\s+\/etc\/nginx\/conf\.d/i);
  assert.doesNotMatch(localDockerfile, /VOLUME\s+\/app\/web/i);

  const containerNginx = read("deploy/nginx/xyzw-container-frontend.conf");
  assert.match(containerNginx, /location\s*=\s*\/healthz/i);
  assert.match(containerNginx, /proxy_pass\s+http:\/\/backend:8787;/i);
  assert.match(containerNginx, /proxy_pass\s+http:\/\/backend:8787\/ws;/i);
});

test("workflow hardening artifacts exist and all external actions are full SHA pinned", () => {
  const workflowPaths = [
    ".github/workflows/ci.yml",
    ".github/workflows/security-sca.yml",
    ".github/workflows/codeql.yml",
    ".github/workflows/dependency-review.yml",
    ".github/workflows/sbom.yml",
  ];

  for (const workflowPath of workflowPaths) {
    assert.equal(exists(workflowPath), true, `expected ${workflowPath}`);
    const content = read(workflowPath);
    const useLines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("uses: "));
    assert.ok(useLines.length > 0, `${workflowPath} should contain action uses`);
    for (const useLine of useLines) {
      const target = useLine.replace(/^uses:\s*/, "").trim();
      if (target.startsWith("./")) continue;
      assert.match(
        target,
        /^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)+@[0-9a-f]{40}$/,
        `${workflowPath} has non-pinned action: ${target}`,
      );
    }
  }
});

test("sbom generation and docker build context guards are wired into repo config", () => {
  const packageJson = JSON.parse(read("package.json"));
  assert.equal(
    typeof packageJson.scripts?.["sbom:generate"],
    "string",
    "expected sbom:generate script",
  );
  assert.match(packageJson.scripts["sbom:generate"], /cyclonedx/i);

  const dockerignore = read(".dockerignore");
  assert.match(dockerignore, /^server\/$/m);
  assert.match(dockerignore, /^dist\/?$/m);
  assert.match(dockerignore, /^backend\/data\/?$/m);
  assert.match(dockerignore, /^node_modules\/?$/m);
  assert.match(dockerignore, /^backend\/node_modules\/?$/m);
  assert.match(dockerignore, /^\.env$/m);

  const gitignore = read(".gitignore");
  assert.match(gitignore, /^artifacts\/$/m);
  assert.match(gitignore, /^artifacts\/sbom\/$/m);
});
