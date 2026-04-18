/* eslint-disable test/no-import-node-test */
import test from "node:test";
import assert from "node:assert/strict";
import jiti from "jiti";

const loadModule = jiti(import.meta.url, { interopDefault: true });
const { publicRoutes } = loadModule("../../src/router/modules/public.routes.js");
const {
  getAndroidAppDownloadConfig,
} = loadModule("../../src/utils/androidAppDownload.js");
const {
  ANDROID_APP_MENU_ROUTE,
  ANDROID_APP_USER_ACTION,
  createSupportMenuOptions,
  createUserMenuOptions,
} = loadModule("../../src/layout/appShellNavigation.js");

test("public routes expose the android app download page", () => {
  const route = publicRoutes.find(item => item.path === "/android-app");

  assert.ok(route);
  assert.equal(route.name, "AndroidAppDownload");
  assert.equal(route.meta.layout, "public");
});

test("android app download config stays unavailable when no download url is configured", () => {
  const config = getAndroidAppDownloadConfig({});

  assert.equal(config.isConfigured, false);
  assert.equal(config.downloadUrl, "");
});

test("android app download config accepts both hosted and external package urls", () => {
  const hostedConfig = getAndroidAppDownloadConfig({
    VITE_ANDROID_APP_DOWNLOAD_URL: "/downloads/xyzw-helper.apk",
  });
  const externalConfig = getAndroidAppDownloadConfig({
    VITE_ANDROID_APP_DOWNLOAD_URL: "https://downloads.example.com/xyzw-helper.apk",
  });

  assert.equal(hostedConfig.isConfigured, true);
  assert.equal(hostedConfig.downloadUrl, "/downloads/xyzw-helper.apk");
  assert.equal(hostedConfig.isExternal, false);
  assert.equal(externalConfig.isConfigured, true);
  assert.equal(externalConfig.isExternal, true);
});

test("authenticated shell exposes android app entry in support and user menus", () => {
  const supportOptions = createSupportMenuOptions(() => "icon");
  const userOptions = createUserMenuOptions();

  assert.ok(
    supportOptions.some(item => item.key === ANDROID_APP_MENU_ROUTE && item.label === "Android App 下载"),
  );
  assert.ok(
    userOptions.some(item => item.key === ANDROID_APP_USER_ACTION && item.label === "Android App 下载"),
  );
});
