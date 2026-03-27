import { expect, test } from "playwright/test";

const jsonResponse = (payload: unknown, status = 200) => ({
  status,
  contentType: "application/json",
  body: JSON.stringify(payload),
});

const stubAuthenticatedAdminApis = async (page) => {
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
          id: "user-admin-e2e",
          username: "e2e-admin",
          email: "e2e@example.com",
          isAdmin: true,
          mfaEnabled: true,
          accessScope: "full",
        },
      }),
    );
  });

  await page.route("**/api/v1/admin/users*", async (route) => {
    await route.fulfill(
      jsonResponse({
        success: true,
        data: [],
      }),
    );
  });
};

test("admin page has no CSP console errors", async ({ page }) => {
  const cspErrors: string[] = [];
  page.on("console", (msg) => {
    const text = msg.text();
    if (
      /content security policy|violates the following directive|refused to/i.test(
        text,
      )
    ) {
      cspErrors.push(text);
    }
  });

  await stubAuthenticatedAdminApis(page);

  const response = await page.goto("/admin/admin-users");
  const cspHeader = response?.headers()["content-security-policy"] || "";

  expect(cspHeader).toContain("script-src 'self'");
  expect(cspHeader).not.toContain("'unsafe-eval'");

  await expect(page).toHaveURL(/\/admin\/admin-users$/);
  await expect(page.locator("h1")).toContainText("账号管理");
  expect(cspErrors).toEqual([]);
});
