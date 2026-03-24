#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const configPath = path.resolve(process.cwd(), "staticwebapp.config.json");
const nginxConfigPath = path.resolve(process.cwd(), "docker", "nginx.conf");

const requiredAdminRoutes = new Set([
  "/admin/admin-users*",
  "/admin/admin-invites*",
  "/admin/activation-codes*",
  "/admin/feedback-tickets*",
  "/admin/task-control-logs*",
  "/admin/changelog-broadcast*",
]);

const parseDirectives = (rawCsp) => {
  const directives = new Map();
  for (const segment of String(rawCsp || "").split(";")) {
    const value = segment.trim();
    if (!value) continue;
    const [name, ...parts] = value.split(/\s+/);
    if (!name) continue;
    directives.set(name, parts);
  }
  return directives;
};

const hasToken = (arr, token) => Array.isArray(arr) && arr.includes(token);
const isExplicitConnectSrc = (connectSrc) =>
  !connectSrc.includes("https:")
  && !connectSrc.includes("http:")
  && !connectSrc.includes("wss:")
  && !connectSrc.includes("ws:")
  && !connectSrc.includes("*");

const errorMessages = [];
const addError = (message) => errorMessages.push(`[security:csp] ${message}`);

let raw;
try {
  raw = fs.readFileSync(configPath, "utf8");
} catch (error) {
  console.error(`[security:csp] failed to read ${configPath}: ${error.message}`);
  process.exit(1);
}

let config;
try {
  config = JSON.parse(raw);
} catch (error) {
  console.error(`[security:csp] invalid JSON in staticwebapp.config.json: ${error.message}`);
  process.exit(1);
}

const globalCsp = config?.globalHeaders?.["Content-Security-Policy"];
if (!globalCsp) {
  addError("missing global Content-Security-Policy header");
} else {
  const directives = parseDirectives(globalCsp);
  const scriptSrc = directives.get("script-src") || [];
  const connectSrc = directives.get("connect-src") || [];
  const objectSrc = directives.get("object-src") || [];
  const frameAncestors = directives.get("frame-ancestors") || [];

  if (hasToken(scriptSrc, "'unsafe-inline'") || hasToken(scriptSrc, "'unsafe-eval'")) {
    addError("global script-src must not include 'unsafe-inline' or 'unsafe-eval'");
  }
  if (!isExplicitConnectSrc(connectSrc)) {
    addError("global connect-src must use explicit allowlist entries (no protocol wildcards or *)");
  }
  if (!hasToken(objectSrc, "'none'")) {
    addError("global object-src must include 'none'");
  }
  if (!hasToken(frameAncestors, "'none'")) {
    addError("global frame-ancestors must include 'none'");
  }
}

const routes = Array.isArray(config?.routes) ? config.routes : [];
for (const route of routes) {
  const routePath = String(route?.route || "");
  if (!requiredAdminRoutes.has(routePath)) continue;

  const routeCsp = route?.headers?.["Content-Security-Policy"];
  if (!routeCsp) {
    addError(`${routePath}: missing route-level Content-Security-Policy`);
    continue;
  }

  const directives = parseDirectives(routeCsp);
  const connectSrc = directives.get("connect-src") || [];

  if (connectSrc.length !== 1 || connectSrc[0] !== "'self'") {
    addError(`${routePath}: connect-src must be exactly "'self'"`);
  }
}

for (const routePath of requiredAdminRoutes) {
  const exists = routes.some((route) => String(route?.route || "") === routePath);
  if (!exists) {
    addError(`missing required admin CSP route: ${routePath}`);
  }
}

let rawNginx;
try {
  rawNginx = fs.readFileSync(nginxConfigPath, "utf8");
} catch (error) {
  console.error(`[security:csp] failed to read ${nginxConfigPath}: ${error.message}`);
  process.exit(1);
}

const extractNginxCsp = (variableName) => {
  const escapedVariable = variableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`set\\s+\\$${escapedVariable}\\s+"([^"]+)"`, "m");
  const match = rawNginx.match(regex);
  return match?.[1] || "";
};

const nginxHasHeader = (name, value) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`add_header\\s+${escapedName}\\s+"${escapedValue}"\\s+always;`, "m").test(rawNginx);
};

const globalNginxCsp = extractNginxCsp("xyzw_csp");
if (!globalNginxCsp) {
  addError("docker/nginx.conf: missing global $xyzw_csp policy");
} else {
  const directives = parseDirectives(globalNginxCsp);
  const scriptSrc = directives.get("script-src") || [];
  const connectSrc = directives.get("connect-src") || [];
  const objectSrc = directives.get("object-src") || [];
  const frameAncestors = directives.get("frame-ancestors") || [];

  if (hasToken(scriptSrc, "'unsafe-inline'") || hasToken(scriptSrc, "'unsafe-eval'")) {
    addError("docker/nginx.conf: global script-src must not include 'unsafe-inline' or 'unsafe-eval'");
  }
  if (!isExplicitConnectSrc(connectSrc)) {
    addError("docker/nginx.conf: global connect-src must use explicit allowlist entries (no protocol wildcards or *)");
  }
  if (!hasToken(objectSrc, "'none'")) {
    addError("docker/nginx.conf: global object-src must include 'none'");
  }
  if (!hasToken(frameAncestors, "'none'")) {
    addError("docker/nginx.conf: global frame-ancestors must include 'none'");
  }
}

const adminNginxCsp = [...rawNginx.matchAll(/set\s+\$xyzw_csp\s+"([^"]+)"/g)].map((match) => match[1])[1] || "";
if (!adminNginxCsp) {
  addError("docker/nginx.conf: missing stricter admin $xyzw_csp policy");
} else {
  const directives = parseDirectives(adminNginxCsp);
  const connectSrc = directives.get("connect-src") || [];
  if (connectSrc.length !== 1 || connectSrc[0] !== "'self'") {
    addError("docker/nginx.conf: admin connect-src must be exactly \"'self'\"");
  }
}

if (!nginxHasHeader("X-Frame-Options", "DENY")) {
  addError("docker/nginx.conf: missing X-Frame-Options DENY");
}
if (!nginxHasHeader("Referrer-Policy", "strict-origin-when-cross-origin")) {
  addError("docker/nginx.conf: missing Referrer-Policy strict-origin-when-cross-origin");
}
if (!/add_header\s+Content-Security-Policy\s+\$xyzw_csp\s+always;/m.test(rawNginx)) {
  addError("docker/nginx.conf: missing Content-Security-Policy response header");
}

if (errorMessages.length > 0) {
  console.error(errorMessages.join("\n"));
  process.exit(1);
}

console.log("[security:csp] CSP policy check passed");
