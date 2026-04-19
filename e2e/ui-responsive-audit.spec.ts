import { expect, test, type Page } from "playwright/test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

type AuditRoute = {
  path: string;
  label: string;
  auth?: "user" | "admin";
  allowRedirectTo?: string[];
};

type ViewportSpec = {
  name: string;
  width: number;
  height: number;
};

const AUDIT_DIR = path.resolve(process.cwd(), "artifacts/ui-audit");
const PUBLIC_ROUTES: AuditRoute[] = [
  { path: "/", label: "home" },
  { path: "/login", label: "login" },
  { path: "/register", label: "register" },
  { path: "/forgot-password", label: "forgot-password" },
  { path: "/pricing", label: "pricing" },
  { path: "/changelog", label: "changelog" },
  { path: "/wx/ui-audit-missing", label: "public-wechat-contact" },
];
const AUTH_ROUTES: AuditRoute[] = [
  { path: "/tokens", label: "token-import", auth: "user" },
  { path: "/admin/dashboard", label: "dashboard", auth: "user" },
  { path: "/admin/profile", label: "profile", auth: "user" },
  { path: "/admin/feedback", label: "feedback", auth: "user" },
  { path: "/admin/referral-center", label: "referral-center", auth: "user" },
  { path: "/admin/task-control", label: "task-control", auth: "user", allowRedirectTo: ["/tokens"] },
  { path: "/admin/daily-tasks", label: "daily-tasks", auth: "user", allowRedirectTo: ["/tokens", "/admin/task-control"] },
  { path: "/admin/game-features", label: "game-features", auth: "user", allowRedirectTo: ["/tokens"] },
  { path: "/admin/battle-reports", label: "battle-reports", auth: "user", allowRedirectTo: ["/tokens", "/admin/task-control"] },
  { path: "/admin/lineup-assistant", label: "lineup-assistant", auth: "user", allowRedirectTo: ["/tokens"] },
  { path: "/admin/admin-users", label: "admin-users", auth: "admin", allowRedirectTo: ["/admin/profile"] },
  { path: "/admin/admin-invites", label: "admin-invites", auth: "admin", allowRedirectTo: ["/admin/profile"] },
  { path: "/admin/activation-codes", label: "activation-codes", auth: "admin", allowRedirectTo: ["/admin/profile"] },
  { path: "/admin/feedback-tickets", label: "feedback-tickets", auth: "admin", allowRedirectTo: ["/admin/profile"] },
  { path: "/admin/task-control-logs", label: "task-control-logs", auth: "admin", allowRedirectTo: ["/admin/profile"] },
  { path: "/admin/changelog-broadcast", label: "changelog-broadcast", auth: "admin", allowRedirectTo: ["/admin/profile"] },
  { path: "/admin/wechat-contacts", label: "wechat-contacts", auth: "admin", allowRedirectTo: ["/admin/profile"] },
  { path: "/admin/referrals", label: "admin-referrals", auth: "admin", allowRedirectTo: ["/admin/profile"] },
];
const VIEWPORTS: ViewportSpec[] = [
  { name: "phone-375", width: 375, height: 812 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1366", width: 1366, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const username = process.env.UI_AUDIT_USERNAME || "";
const password = process.env.UI_AUDIT_PASSWORD || "";
const mfaSecret = process.env.UI_AUDIT_MFA_SECRET || "";
const hasAuditLogin = Boolean(username && password);

const normalizeBase32Secret = (secret: string) =>
  secret.toUpperCase().replace(/[^A-Z2-7]/g, "");

const decodeBase32 = (secret: string) => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const clean = normalizeBase32Secret(secret);
  let bits = "";
  for (const char of clean) {
    const value = alphabet.indexOf(char);
    if (value < 0) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
};

const generateTotp = (secret: string, timestamp = Date.now()) => {
  const key = decodeBase32(secret);
  const counter = Math.floor(timestamp / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter), 0);
  const hmac = crypto.createHmac("sha1", key).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = (
    ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff)
  ) % 1_000_000;
  return String(code).padStart(6, "0");
};

const waitForStableLayout = async (page: Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle", { timeout: 1_200 }).catch(() => undefined);
  await page.waitForTimeout(220);
};

const dismissKnownOverlays = async (page: Page) => {
  await page.waitForTimeout(250);
  const buttons = [
    page.getByRole("button", { name: /我知道了|知道了|确定|OK/i }),
    page.getByRole("button", { name: /^close$/i }),
  ];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    for (const button of buttons) {
      if (await button.first().isVisible().catch(() => false)) {
        await button.first().click({ force: true }).catch(() => undefined);
        await page.waitForTimeout(150);
      }
    }
    await page.waitForTimeout(150);
  }
};

const loginIfConfigured = async (page: Page) => {
  if (!hasAuditLogin) return false;

  await page.goto("/login");
  await waitForStableLayout(page);
  await dismissKnownOverlays(page);
  await page.locator('input[name="username"]').fill(username);
  await page.locator('input[name="password"]').fill(password);
  await dismissKnownOverlays(page);
  await page.locator(".login-button").click();
  await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => undefined);

  const totpInput = page.locator('input[name="mfa-totp-code"]');
  await totpInput.waitFor({ state: "visible", timeout: 5_000 }).catch(() => undefined);
  if (await totpInput.isVisible().catch(() => false)) {
    if (!mfaSecret) {
      throw new Error("UI_AUDIT_MFA_SECRET is required for this audit account.");
    }
    await totpInput.fill(generateTotp(mfaSecret));
    await page.locator(".login-button").click();
    await page.waitForLoadState("networkidle", { timeout: 2_000 }).catch(() => undefined);
  }

  await page.waitForTimeout(600);
  await dismissKnownOverlays(page);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  return true;
};

const classifyLayout = async (page: Page) =>
  page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const pageWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body?.scrollWidth || 0,
    );
    const tolerance = 3;
    const allowedContainers = [
      ".app-scroll-x",
      ".table-wrap",
      ".style2-table-wrapper",
      ".members-table-wrapper",
      ".n-data-table-wrapper",
      ".arco-table-container",
      ".sub-tabs",
      ".sub-nav-center",
      ".game-module-rail",
      ".game-module-dock__panel",
      ".result-table",
    ];
    const isVisible = (element: Element, rect: DOMRect) => {
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0
        && rect.height > 0
        && style.display !== "none"
        && style.visibility !== "hidden"
        && Number.parseFloat(style.opacity || "1") > 0.02
      );
    };
    const hasAllowedScrollableAncestor = (element: Element) =>
      allowedContainers.some((selector) => element.closest(selector));
    const isDecorative = (element: Element) =>
      Boolean(
        element.closest("[aria-hidden='true']")
        || element.closest(".app-flow-bg")
        || element.closest(".public-brand-bg")
        || element.closest(".home-bg")
        || element.closest(".login-bg")
        || element.closest(".register-bg")
        || element.closest(".forgot-password-bg")
        || element.closest(".pricing-page__bg")
        || element.closest(".changelog-page__bg"),
      );
    const offenders = Array.from(document.body.querySelectorAll("*"))
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ element, rect }) => {
        if (!isVisible(element, rect)) return false;
        if (isDecorative(element)) return false;
        if (hasAllowedScrollableAncestor(element)) return false;
        return rect.right > viewportWidth + tolerance || rect.left < -tolerance;
      })
      .slice(0, 8)
      .map(({ element, rect }) => ({
        tag: element.tagName.toLowerCase(),
        className: String((element as HTMLElement).className || "").slice(0, 160),
        text: String(element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
        rect: {
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        },
      }));
    const clippedText = Array.from(document.body.querySelectorAll("button, a, span, strong, p, h1, h2, h3, td, th"))
      .map((element) => {
        const node = element as HTMLElement;
        const rect = node.getBoundingClientRect();
        const style = window.getComputedStyle(node);
        return { element: node, rect, style };
      })
      .filter(({ element, rect, style }) => {
        if (!isVisible(element, rect)) return false;
        if (isDecorative(element)) return false;
        if (hasAllowedScrollableAncestor(element)) return false;
        if (!["hidden", "clip"].includes(style.overflowX)) return false;
        return element.scrollWidth > element.clientWidth + tolerance;
      })
      .slice(0, 8)
      .map(({ element }) => ({
        tag: element.tagName.toLowerCase(),
        className: String(element.className || "").slice(0, 160),
        text: String(element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 120),
      }));

    return {
      viewportWidth,
      pageWidth,
      pageOverflow: pageWidth > viewportWidth + tolerance,
      offenders,
      clippedText,
    };
  });

test.describe("responsive UI audit", () => {
  test.setTimeout(240_000);

  test("target pages avoid page-level overflow across mobile and desktop", async ({ browser }, testInfo) => {
    fs.mkdirSync(AUDIT_DIR, { recursive: true });
    const failures: unknown[] = [];
    const skipped: unknown[] = [];
    const auditedRoutes = hasAuditLogin ? [...PUBLIC_ROUTES, ...AUTH_ROUTES] : PUBLIC_ROUTES;
    let storageState: { cookies: unknown[]; origins: unknown[] } | undefined;

    if (hasAuditLogin) {
      const loginContext = await browser.newContext({
        viewport: { width: VIEWPORTS[0].width, height: VIEWPORTS[0].height },
      });
      const loginPage = await loginContext.newPage();
      await loginIfConfigured(loginPage);
      storageState = await loginContext.storageState();
      await loginContext.close();
    }

    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: viewport.width, height: viewport.height },
        storageState,
      });
      const page = await context.newPage();

      for (const route of auditedRoutes) {
        if (route.auth && !storageState) {
          skipped.push({ viewport: viewport.name, route: route.path, reason: "auth-not-configured" });
          continue;
        }
        await page.goto(route.path);
        await waitForStableLayout(page);
        const currentPath = new URL(page.url()).pathname;
        const allowedRedirects = route.allowRedirectTo || [];
        if (currentPath !== route.path && allowedRedirects.includes(currentPath)) {
          skipped.push({
            viewport: viewport.name,
            route: route.path,
            landedOn: currentPath,
            reason: "expected-local-state-redirect",
          });
          continue;
        }
        const result = await classifyLayout(page);
        const hasFailure = result.pageOverflow || result.offenders.length > 0;
        if (hasFailure) {
          const screenshotName = `${viewport.name}-${route.label}.png`;
          const screenshotPath = path.join(AUDIT_DIR, screenshotName);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          failures.push({
            viewport,
            route,
            currentPath,
            screenshot: screenshotPath,
            ...result,
          });
        }
      }

      await context.close();
    }

    const reportPath = path.join(AUDIT_DIR, "responsive-report.json");
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify({ failures, skipped, generatedAt: new Date().toISOString() }, null, 2)}\n`,
    );
    await testInfo.attach("responsive-report", {
      path: reportPath,
      contentType: "application/json",
    });

    expect(failures).toEqual([]);
  });
});
