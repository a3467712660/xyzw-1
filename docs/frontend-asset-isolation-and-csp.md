# 前端高风险资产分域与 CSP 加固（L1）

最后更新：2026-03-21

## 已落地改动

1. 高风险脚本不再全站预加载
   - 已移除 `index.html` 中全局注入的以下脚本：
     - `/xyzw/cocos2d-js-min.js`
     - `/xyzw/game-defines.js`
     - `/xyzw/index.js`
   - 现改为仅在微信扫码导入页面（`/tokens` -> `wxqrcode.vue`）按需加载。

2. 静态网关 CSP 收紧
   - `connect-src` 从全局 `https: wss:` 收紧为：
     - `'self'`
     - `https://*.hortorgames.com`
     - `wss://*.hortorgames.com`
   - 对管理后台高敏路由单独下发更严格 CSP（`connect-src 'self'`）：
     - `/admin/admin-users*`
     - `/admin/admin-invites*`
     - `/admin/feedback-tickets*`
     - `/admin/task-control-logs*`
     - `/admin/changelog-broadcast*`

3. 兼容 CSP 的基础改造
   - `index.html` 的内联样式已迁移到 `src/assets/styles/global.scss`，减少对内联样式依赖。

4. CSP 回退防护门禁
   - 已新增 `npm run security:csp`（`scripts/security/check-csp.mjs`）自动校验以下不可回退项：
     - 全局 `script-src` 禁止 `unsafe-inline` / `unsafe-eval`
     - 全局 `connect-src` 禁止 `https:` / `wss:` / `*` 这类宽松写法
     - 高敏 admin 路由的 `connect-src` 必须严格等于 `'self'`
   - 该检查已接入 `security:sca`，在 CI 中作为门禁执行。

5. 高风险运行时域名门禁（新增）
   - 微信扫码导入页加载 `/xyzw/*.js` 前，会先校验当前 `hostname` 是否在 `VITE_XYZW_RUNTIME_ALLOWED_HOSTS` 白名单内。
   - 本地开发（`localhost` / `127.0.0.1` / `::1`）默认允许。
   - 非白名单域会直接拒绝加载脚本并报错，防止高风险运行时在管理域误执行。

## 分域部署建议（推荐）

目标是把“高风险功能页”与“管理后台”拆到不同子域，降低同源 XSS 横向影响面。

推荐域名规划：

- 高风险游戏功能域：`app.example.com`
  - 承载 `/tokens`、`/admin/game-features`、`/admin/legion-war` 等依赖游戏脚本或复杂协议的页面
- 管理后台域：`admin.example.com`
  - 承载 `/admin/admin-users`、`/admin/admin-invites`、`/admin/feedback-tickets`、`/admin/task-control-logs`、`/admin/changelog-broadcast`

落地要点：

1. Cookie 隔离
   - 后端将管理后台会话 cookie 尽量限制在 `admin.example.com`。
   - 可通过 `ACCESS_COOKIE_DOMAIN`、`REFRESH_COOKIE_DOMAIN`、`CSRF_COOKIE_DOMAIN` 固化到管理域。
   - 高风险域使用独立会话或最小权限 token。

2. CORS 白名单最小化
   - `CORS_ORIGINS` 分别列出 `app.example.com` 与 `admin.example.com`，不要使用泛域通配。

3. CSP 按子域分模板
   - `admin.example.com` 使用更严格 `connect-src 'self'` 与更少外连域。
   - `app.example.com` 只开放业务必须外连目标。

4. 前端运行时门禁
   - 在高风险域部署中设置：
     - `VITE_XYZW_RUNTIME_ALLOWED_HOSTS=app.example.com,.app.example.com`
   - 不要把 `admin.example.com` 放入该白名单。

## SRI（子资源完整性）实施建议

当前高风险脚本为同源托管（`/xyzw/*.js`），短期建议：

- 保持同源托管，避免第三方 CDN 注入风险。
- 若后续改为外部脚本，必须启用 `integrity` + `crossorigin`。
- 将 SRI 哈希计算纳入构建/发布流程（发布时自动更新 HTML 模板）。

## `style-src 'unsafe-inline'` 中长期收敛路线

当前保留 `style-src 'unsafe-inline'` 是为了兼容现有 UI 组件运行时样式注入，属于可接受的工程折中。建议按以下节奏推进：

1. L1（短期，监控）
   - 保持现状不阻断业务，先通过发布前 E2E/回归清点主要内联样式来源（框架运行时、第三方组件、业务自定义）。
   - 对新增页面要求优先使用外链样式文件或构建产物样式，禁止新写内联 `style=""`。

2. L2（中期，改造）
   - 引入 nonce 或 hash 的试点页面（优先 admin 高敏页），验证组件兼容性与构建链路改造成本。
   - 将可迁移的动态样式逐步改为 class 切换 + 预编译样式。

3. L3（长期，收口）
   - 在确认兼容后，移除 `style-src 'unsafe-inline'`，切换到 `style-src 'self' 'nonce-<...>'`（或 hash 白名单）。
   - 将 nonce/hash 注入与校验纳入 CI/CD，避免策略回退。

## 验证清单

1. 构建产物脚本来源检查

```bash
grep -RIn "<script" dist | head
```

2. 管理后台路由验证

- 访问 `/admin/admin-users` 等页面
- 浏览器 DevTools 确认响应头 CSP 为 `connect-src 'self'`
- 控制台无 CSP 误伤

3. 高风险页面验证

- 访问 `/tokens`，点击微信扫码导入流程
- 首次进入后脚本按需加载成功
- 登录、下载、WS 等关键链路不回归
