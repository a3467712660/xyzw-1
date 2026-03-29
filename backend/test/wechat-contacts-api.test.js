import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import { createApp } from "../src/app/createApp.js";
import { initDatabase } from "../src/db/database.js";
import { nowIso } from "../src/db/sql.js";
import { query, run } from "../src/db/client.js";
import { createPassword, signJwt } from "../src/lib/crypto.js";
import adminWechatContactsRoutes from "../src/routes/adminWechatContacts.js";
import {
  createMfaSetupPayload,
  encryptMfaSecret,
} from "../src/services/mfaService.js";

const makeBaseUrl = (server) => {
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("test server address unavailable");
  }
  return `http://127.0.0.1:${address.port}`;
};

const createAppServer = async () => {
  const { app } = createApp();
  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const createAdminServer = async () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/admin", adminWechatContactsRoutes);
  const server = await new Promise((resolve, reject) => {
    const next = app.listen(0, "127.0.0.1", () => resolve(next));
    next.on("error", reject);
  });
  return server;
};

const insertWechatContact = ({
  id,
  slug,
  title = "测试联系人",
  subtitle = null,
  contactType = "landing_qr",
  targetUrl = null,
  wechatId = null,
  qrImageDataUrl = null,
  showInPricing = true,
  isActive = true,
  sortOrder = 100,
  createdBy = null,
  updatedBy = null,
}) => {
  const ts = nowIso();
  run(
    `INSERT INTO wechat_contacts (
      id, slug, title, subtitle, contact_type, target_url, wechat_id, qr_image_data_url,
      show_in_pricing, is_active, sort_order, created_by, updated_by, created_at, updated_at
    ) VALUES (
      $id, $slug, $title, $subtitle, $contactType, $targetUrl, $wechatId, $qrImageDataUrl,
      $showInPricing, $isActive, $sortOrder, $createdBy, $updatedBy, $createdAt, $updatedAt
    )`,
    {
      $id: id,
      $slug: slug,
      $title: title,
      $subtitle: subtitle,
      $contactType: contactType,
      $targetUrl: targetUrl,
      $wechatId: wechatId,
      $qrImageDataUrl: qrImageDataUrl,
      $showInPricing: showInPricing ? 1 : 0,
      $isActive: isActive ? 1 : 0,
      $sortOrder: sortOrder,
      $createdBy: createdBy,
      $updatedBy: updatedBy,
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
};

const insertAdminUser = ({ id, username, password }) => {
  const ts = nowIso();
  const passwordMeta = createPassword(password);
  const mfaSetup = createMfaSetupPayload({ username });
  run(
    `INSERT INTO users (
      id, username, email, password_salt, password_hash, token_version, is_admin,
      mfa_enabled, mfa_totp_secret_enc, mfa_recovery_codes_hash, created_at, updated_at
    ) VALUES (
      $id, $username, NULL, $salt, $hash, 0, 1,
      1, $secretEnc, $recoveryHash, $createdAt, $updatedAt
    )`,
    {
      $id: id,
      $username: username,
      $salt: passwordMeta.salt,
      $hash: passwordMeta.hash,
      $secretEnc: encryptMfaSecret(mfaSetup.secret),
      $recoveryHash: JSON.stringify(mfaSetup.recoveryCodeHashes),
      $createdAt: ts,
      $updatedAt: ts,
    },
  );
};

const authHeaders = ({ userId, username }) => {
  const token = signJwt({ sub: userId, username, ver: 0 }, 60 * 10);
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
};

test("GET /api/v1/public/wechat-contacts only returns active + showInPricing rows and detail hides inactive rows", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const slugSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const visibleId = `wechat_visible_${suffix}`;
  const hiddenId = `wechat_hidden_${suffix}`;
  const inactiveId = `wechat_inactive_${suffix}`;
  const visibleSlug = `visible-${slugSuffix}`;
  const hiddenSlug = `hidden-${slugSuffix}`;
  const inactiveSlug = `inactive-${slugSuffix}`;
  const missingSlug = `wechat-missing-${slugSuffix}`;

  run(`DELETE FROM wechat_contacts WHERE id IN ($visibleId, $hiddenId, $inactiveId)`, {
    $visibleId: visibleId,
    $hiddenId: hiddenId,
    $inactiveId: inactiveId,
  });

  insertWechatContact({
    id: visibleId,
    slug: visibleSlug,
    title: "公开可见联系人",
    subtitle: "价格菜单展示",
    contactType: "landing_qr",
    wechatId: "visible-wechat",
    qrImageDataUrl: "data:image/png;base64,QUJDREVGRw==",
    showInPricing: true,
    isActive: true,
    sortOrder: 1,
  });
  insertWechatContact({
    id: hiddenId,
    slug: hiddenSlug,
    title: "隐藏联系人",
    contactType: "external_url",
    targetUrl: "https://example.com/hidden",
    showInPricing: false,
    isActive: true,
    sortOrder: 2,
  });
  insertWechatContact({
    id: inactiveId,
    slug: inactiveSlug,
    title: "停用联系人",
    contactType: "external_url",
    targetUrl: "https://example.com/inactive",
    showInPricing: true,
    isActive: false,
    sortOrder: 3,
  });

  const server = await createAppServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM wechat_contacts WHERE id IN ($visibleId, $hiddenId, $inactiveId)`, {
      $visibleId: visibleId,
      $hiddenId: hiddenId,
      $inactiveId: inactiveId,
    });
  });

  const baseUrl = makeBaseUrl(server);

  const listRes = await fetch(`${baseUrl}/api/v1/public/wechat-contacts`);
  assert.equal(listRes.status, 200);
  const listPayload = await listRes.json();
  const list = Array.isArray(listPayload?.data) ? listPayload.data : [];
  assert.equal(list.length, 1);
  assert.equal(list[0]?.slug, visibleSlug);
  assert.equal("qrImageDataUrl" in list[0], false);

  const visibleDetailRes = await fetch(`${baseUrl}/api/v1/public/wechat-contacts/${encodeURIComponent(visibleSlug)}`);
  assert.equal(visibleDetailRes.status, 200);

  const inactiveDetailRes = await fetch(`${baseUrl}/api/v1/public/wechat-contacts/${encodeURIComponent(inactiveSlug)}`);
  assert.equal(inactiveDetailRes.status, 404);

  const missingDetailRes = await fetch(`${baseUrl}/api/v1/public/wechat-contacts/${encodeURIComponent(missingSlug)}`);
  assert.equal(missingDetailRes.status, 404);
});

test("POST /api/v1/admin/wechat-contacts rejects javascript URL", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const slugSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = {
    id: `wechat_admin_${suffix}`,
    username: `wechat_admin_${suffix}`,
    password: "Admin1234!Aa",
  };

  run(`DELETE FROM admin_audit_logs WHERE admin_user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM user_notifications WHERE user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM security_event_logs WHERE user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM users WHERE id = $adminId`, { $adminId: adminUser.id });
  insertAdminUser(adminUser);

  const server = await createAdminServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM wechat_contacts WHERE created_by = $adminId OR updated_by = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM admin_audit_logs WHERE admin_user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM user_notifications WHERE user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM security_event_logs WHERE user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM users WHERE id = $adminId`, { $adminId: adminUser.id });
  });

  const response = await fetch(`${makeBaseUrl(server)}/api/v1/admin/wechat-contacts`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({
      slug: `external-${slugSuffix}`,
      title: "外部联系",
      subtitle: "",
      contactType: "external_url",
      targetUrl: "javascript:alert(1)",
      wechatId: "",
      qrImageDataUrl: "",
      showInPricing: true,
      isActive: true,
      sortOrder: 10,
    }),
  });

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(String(payload?.message || ""), /https/);
});

test("POST /api/v1/admin/wechat-contacts rejects invalid QR data url", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const slugSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = {
    id: `wechat_admin_qr_${suffix}`,
    username: `wechat_admin_qr_${suffix}`,
    password: "Admin1234!Aa",
  };

  run(`DELETE FROM admin_audit_logs WHERE admin_user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM user_notifications WHERE user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM security_event_logs WHERE user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM users WHERE id = $adminId`, { $adminId: adminUser.id });
  insertAdminUser(adminUser);

  const server = await createAdminServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM wechat_contacts WHERE created_by = $adminId OR updated_by = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM admin_audit_logs WHERE admin_user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM user_notifications WHERE user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM security_event_logs WHERE user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM users WHERE id = $adminId`, { $adminId: adminUser.id });
  });

  const response = await fetch(`${makeBaseUrl(server)}/api/v1/admin/wechat-contacts`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({
      slug: `landing-${slugSuffix}`,
      title: "二维码联系",
      subtitle: "",
      contactType: "landing_qr",
      targetUrl: "",
      wechatId: "wx-landing",
      qrImageDataUrl: "data:image/gif;base64,AAAA",
      showInPricing: true,
      isActive: true,
      sortOrder: 5,
    }),
  });

  assert.equal(response.status, 400);
  const payload = await response.json();
  assert.match(String(payload?.message || ""), /data url/);
});

test("POST /api/v1/admin/wechat-contacts accepts work.weixin.qq.com/kfid url and PUT can update flags", async (t) => {
  await initDatabase();

  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const slugSuffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const adminUser = {
    id: `wechat_admin_ok_${suffix}`,
    username: `wechat_admin_ok_${suffix}`,
    password: "Admin1234!Aa",
  };

  run(`DELETE FROM admin_audit_logs WHERE admin_user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM user_notifications WHERE user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM security_event_logs WHERE user_id = $adminId`, { $adminId: adminUser.id });
  run(`DELETE FROM users WHERE id = $adminId`, { $adminId: adminUser.id });
  insertAdminUser(adminUser);

  const server = await createAdminServer();
  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    run(`DELETE FROM wechat_contacts WHERE created_by = $adminId OR updated_by = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM admin_audit_logs WHERE admin_user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM user_notifications WHERE user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM security_event_logs WHERE user_id = $adminId`, { $adminId: adminUser.id });
    run(`DELETE FROM users WHERE id = $adminId`, { $adminId: adminUser.id });
  });

  const baseUrl = makeBaseUrl(server);
  const createResponse = await fetch(`${baseUrl}/api/v1/admin/wechat-contacts`, {
    method: "POST",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({
      slug: `wecom-${slugSuffix}`,
      title: "企业微信客服",
      subtitle: "自动跳转",
      contactType: "wecom_kf_link",
      targetUrl: "https://work.weixin.qq.com/kfid/kfc1234567890",
      wechatId: "",
      qrImageDataUrl: "",
      showInPricing: true,
      isActive: true,
      sortOrder: 8,
    }),
  });

  assert.equal(createResponse.status, 200);
  const createPayload = await createResponse.json();
  assert.equal(createPayload?.data?.contactType, "wecom_kf_link");
  assert.equal(createPayload?.data?.targetUrl, "https://work.weixin.qq.com/kfid/kfc1234567890");
  const createdId = String(createPayload?.data?.id || "");
  assert.ok(createdId);

  const updateResponse = await fetch(`${baseUrl}/api/v1/admin/wechat-contacts/${createdId}`, {
    method: "PUT",
    headers: authHeaders({ userId: adminUser.id, username: adminUser.username }),
    body: JSON.stringify({
      showInPricing: false,
      isActive: false,
      sortOrder: 88,
    }),
  });

  assert.equal(updateResponse.status, 200);
  const stored = query(
    `SELECT
      show_in_pricing as showInPricing,
      is_active as isActive,
      sort_order as sortOrder
     FROM wechat_contacts
     WHERE id = $id`,
    { $id: createdId },
  )[0];
  assert.equal(Number(stored?.showInPricing), 0);
  assert.equal(Number(stored?.isActive), 0);
  assert.equal(Number(stored?.sortOrder), 88);
});
