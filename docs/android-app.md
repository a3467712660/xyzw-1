# Android Native App Bootstrap

## 说明

`android/` 目录下新增的是一个真正的 Android 原生应用工程：

- UI 使用 Kotlin + Jetpack Compose + Material 3 实现
- 导航使用 Navigation Compose
- 业务状态通过 ViewModel + Coroutines 驱动
- 网络直接复用现有 `backend/` 的 `/api/v1/*` 与 `/ws`

它不是 WebView 壳，也没有使用 Capacitor、Cordova，且没有把现有 Vue 页面嵌进 APP。

如需微信或其他外部授权，Android 端只能使用系统浏览器 / Custom Tabs / 深链回跳完成授权，不用于承载主业务页面。

## API_BASE_URL 配置

Android 端把服务端根地址视为 `API_BASE_URL`，例如：

- Debug 默认：`http://10.0.2.2:8787`
- Release 必须是：`https://your-domain.example`

构建时可通过 Gradle 属性覆盖：

```bash
cd android
./gradlew assembleDebug -PAPI_BASE_URL=http://10.0.2.2:8787
./gradlew assembleRelease -PAPI_BASE_URL=https://your-domain.example
```

应用启动时会把默认值写入 DataStore：

- `api_base_url`
- `theme_mode`

运行时 Retrofit 实际访问的是：

- `${API_BASE_URL}/api/v1/*`

WebSocket 实际访问的是：

- `${API_BASE_URL}` 同源下的 `/ws`

## Debug / Release 约束

### Debug

- 模拟器访问本机后端请使用 `http://10.0.2.2:8787`
- `android/app/src/debug/res/xml/debug_network_security_config.xml` 已允许 `10.0.2.2`、`127.0.0.1`、`localhost` 明文流量

### Release

- Release 构建禁止明文 HTTP
- `AppContainer` 会校验 Release 环境下的 `API_BASE_URL` 必须是 HTTPS
- 若仍提供 HTTP 地址，应用会在启动容器时直接拒绝使用

## Cookie 与 CSRF

Android 端当前会话策略与现有 Web 前端保持一致：

- 认证以 Cookie 为主，不依赖把 access token 明文落本地
- Cookie 由 OkHttp `CookieJar` 管理
- 持久化使用 `EncryptedSharedPreferences`，底层依赖 Android Keystore
- 不明文保存敏感 Cookie
- 登录成功依赖后端 `Set-Cookie` 下发 access cookie 与 refresh cookie

### CSRF 处理逻辑

写请求 `POST / PUT / PATCH / DELETE` 会经过 `CsrfInterceptor`：

1. 从 `CookieJar` 读取 `xyzw_csrf_token`
2. 若不存在，再读取 `__Host-xyzw_csrf_token`
3. 将 token 写入请求头 `X-CSRF-Token`

认证类写接口在提交前会先由 `AuthBootstrapHelper` 调用：

- `GET /api/v1/auth/csrf`

目前已覆盖：

- `/auth/login`
- `/auth/mfa/verify`
- `/auth/register`
- `/auth/password-reset`
- `/auth/logout`
- `/auth/refresh`

### 401 刷新逻辑

当非启动型请求收到 `401` 时：

1. `SessionAuthenticator` 调用 `POST /api/v1/auth/refresh`
2. 若刷新成功，自动重试原请求一次
3. 若刷新失败，清空本地 Cookie 与会话状态，并回到登录页

注意：

- `/auth/refresh` 仍然只依赖 refresh cookie 判断刷新资格
- 但因为后端全局 CSRF 中间件仍然生效，Android 调 refresh 时也必须继续保留 CSRF cookie 与 `X-CSRF-Token`
- Android 不为刷新流程单独绕过 CSRF

## WebSocket `/ws`

Android 端已提供 `WsSessionManager` 基础设施，复用同一个 OkHttpClient / CookieJar。

连接要求：

- URL：`/ws`
- 握手 Cookie 由同一个 `CookieJar` 自动带上
- 原生客户端默认不主动设置 `Origin`

因此后端需要满足：

- 浏览器场景仍然必须带合法 `Origin`，并继续受 `CORS_ORIGINS` 白名单约束
- 无 `Origin` 的非浏览器客户端仅在携带 access cookie 时才允许握手
- 无 `Origin` + Bearer-only 的握手不作为 Android 正式认证方案，服务端会拒绝
- Android 正式方案仍是登录后复用 access cookie 进行 WS 握手

## 本地构建

```bash
cd android
./gradlew testDebugUnitTest
./gradlew assembleDebug
```

当前工程默认包名：

- `com.xyzw.helper`

应用名：

- `XYZW Helper`
