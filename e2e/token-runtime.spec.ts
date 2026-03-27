import { expect, test } from "playwright/test";

const RUNTIME_PATHS = new Set([
  "/xyzw/cocos2d-js-min.js",
  "/xyzw/game-defines.js",
  "/xyzw/index.js",
]);

const disallowedBaseUrl =
  process.env.E2E_DISALLOWED_BASE_URL || "http://127.0.0.1:8088";

const jsonResponse = (payload: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(payload),
});

const stubTokenWorkspaceApis = async (page) => {
  await page.route("**/api/v1/auth/refresh", async (route) => {
    await route.fulfill(
      jsonResponse({
        success: true,
        data: { token: "e2e-access-token" },
      }),
    );
  });

  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill(
      jsonResponse({
        success: true,
        data: {
          id: "user-token-e2e",
          username: "e2e-user",
          email: "e2e@example.com",
          isAdmin: false,
          mfaEnabled: false,
          accessScope: "full",
        },
      }),
    );
  });

  await page.route("**/api/v1/user/preferences/*", async (route) => {
    await route.fulfill(
      jsonResponse({
        success: true,
        data: { value: false },
      }),
    );
  });

  await page.route("**/api/v1/bin-files*", async (route) => {
    await route.fulfill(
      jsonResponse({
        success: true,
        data: [],
      }),
    );
  });

  await page.route("**/api/v1/wechat-proxy/qrconnect*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html; charset=utf-8",
      body: `
        <html>
          <body>
            <img class="auth_qrcode" src="https://example.com/qrcode/e2e-uuid" />
          </body>
        </html>
      `,
    });
  });

  await page.route("**/api/v1/wechat-proxy/qrstatus*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/plain; charset=utf-8",
      body: "window.wx_errcode=404;",
    });
  });
};

const stubRuntimeScripts = async (page, runtimeRequests: string[]) => {
  await page.route("**/xyzw/*.js", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    runtimeRequests.push(pathname);
    await route.fulfill({
      status: 200,
      contentType: "application/javascript; charset=utf-8",
      body: `
        window.__e2eRuntimeLoads = (window.__e2eRuntimeLoads || []);
        window.__e2eRuntimeLoads.push(${JSON.stringify(pathname)});
        window.__require = window.__require || (() => ({}));
      `,
    });
  });
};

const openWxQrcodeImport = async (page) => {
  await expect(page).toHaveURL(/\/tokens$/);
  await expect(page.getByText("添加游戏Token")).toBeVisible();
  await page.locator(".import-method-tabs").getByText("微信扫码获取").click();
  await expect(page.getByText("微信扫码登录流程")).toBeVisible();
};

test("allowed host loads runtime only after entering WeChat QR flow", async ({
  page,
}) => {
  const runtimeRequests: string[] = [];
  const qrConnectRequests: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/v1/wechat-proxy/qrconnect") {
      qrConnectRequests.push(pathname);
    }
  });

  await stubTokenWorkspaceApis(page);
  await stubRuntimeScripts(page, runtimeRequests);

  await page.goto("/tokens");
  await openWxQrcodeImport(page);

  expect(runtimeRequests).toEqual([]);
  expect(qrConnectRequests).toEqual([]);

  await page.getByRole("button", { name: "获取二维码" }).click();

  await expect.poll(() => runtimeRequests.length).toBe(RUNTIME_PATHS.size);
  expect([...new Set(runtimeRequests)].sort()).toEqual(
    [...RUNTIME_PATHS].sort(),
  );
  await expect.poll(() => qrConnectRequests.length).toBe(1);
  await expect(page.locator("#qr-status")).toContainText("请使用微信扫码登录");
});

test("disallowed host blocks runtime and shows runtimeHostNotAllowed", async ({
  page,
}) => {
  const runtimeRequests: string[] = [];
  const qrConnectRequests: string[] = [];

  page.on("request", (request) => {
    const pathname = new URL(request.url()).pathname;
    if (pathname === "/api/v1/wechat-proxy/qrconnect") {
      qrConnectRequests.push(pathname);
    }
  });

  await stubTokenWorkspaceApis(page);
  await stubRuntimeScripts(page, runtimeRequests);

  await page.goto(`${disallowedBaseUrl}/tokens`);
  await openWxQrcodeImport(page);

  expect(runtimeRequests).toEqual([]);
  expect(qrConnectRequests).toEqual([]);

  await page.getByRole("button", { name: "获取二维码" }).click();

  await expect(page.locator("#qr-status")).toContainText(
    "未被允许加载高风险运行时脚本",
  );
  expect(runtimeRequests).toEqual([]);
  expect(qrConnectRequests).toEqual([]);
});
