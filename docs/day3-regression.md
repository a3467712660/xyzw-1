# Day 3 回归记录

日期：2026-03-11  
环境：本地后端 `http://localhost:9797`，`curl + cookie jar` 回归

## 结果总览

1. 登录成功：通过
2. 刷新页面后仍登录（`refresh -> me`）：通过
3. access token 过期后自动刷新：代码已实现，构建通过
4. refresh token 失效后回登录：通过
5. 登出后不能再刷新恢复：通过
6. 改密码后旧会话全部失效：通过
7. 跨域环境下 Cookie 正常发送（凭证/CORS）：通过
8. 开发者工具 JS 看不到 refresh token 值：通过（`HttpOnly`）

## 关键检查明细

1. refresh token rotation
- `/auth/refresh` 前后对比：cookie 中 `xyzw_refresh_token` 发生变化（旧值 != 新值）。

2. 登出后刷新恢复
- 调用 `/auth/logout` 后，再 `GET /auth/csrf` + `POST /auth/refresh`：
- 返回 `401 AUTH_REFRESH_MISSING`，符合预期。

3. 改密失效链路
- 会话 A / B 同时登录；
- A 调用 `/user/password` 成功后；
- B 调用 `/auth/refresh` 返回 `401 AUTH_REFRESH_REVOKED`，符合“全部旧会话失效”预期。

4. CORS + credentials
- `Origin: http://localhost:3000` 时：
- `Access-Control-Allow-Origin: http://localhost:3000`
- `Access-Control-Allow-Credentials: true`
- `Origin: https://evil.example` 时返回 `403 CORS origin not allowed`。

5. Cookie 安全属性
- 登录响应 `Set-Cookie: xyzw_refresh_token=...` 含 `HttpOnly`。
- `SameSite=Lax` 明确存在。

6. 安全头 / XSS 基线
- 响应头包含 `Content-Security-Policy`，且有 `frame-ancestors 'none'`。
- 响应头包含 `X-Content-Type-Options: nosniff`。
- 响应头包含 `X-Frame-Options: DENY`。
- 代码扫描未发现业务代码使用 `v-html` 或 `innerHTML`（仅第三方/压缩资源中存在）。

## 说明

1. “access token 过期后自动刷新”是通过前端拦截器实现：401 时静默 refresh 一次并重放原请求。
2. 本次已完成后端/API 级验证与前端构建验证；若要录制完整浏览器手工视频，可再补一轮 Playwright 可视化步骤。
