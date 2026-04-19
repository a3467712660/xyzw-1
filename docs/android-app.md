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
- Release 默认：`https://xyzw.xq5007.fun`

构建时可通过 Gradle 属性覆盖：

```bash
cd android
./gradlew assembleDebug -PAPI_BASE_URL=http://10.0.2.2:8787
./gradlew assembleRelease -PAPI_BASE_URL=https://xyzw.xq5007.fun
```

## WS_ORIGIN 配置

Android 原生 `/ws` 握手现在会显式发送 `Origin` header。

`DEFAULT_WS_ORIGIN` 的构建时优先级如下：

1. `-PwsOrigin=...`
2. `-PWS_ORIGIN=...`
3. `local.properties` 中的 `wsOrigin=...`
4. `local.properties` 中的 `WS_ORIGIN=...`
5. build type 默认值

构建示例：

```bash
cd android
./gradlew assembleDebug -PAPI_BASE_URL=http://10.0.2.2:8787 -PwsOrigin=http://localhost:3000
./gradlew assembleRelease -PAPI_BASE_URL=https://xyzw.xq5007.fun -PwsOrigin=https://xyzw.xq5007.fun
```

约束：

- Android `/ws` 的 `Origin` 必须位于后端 `CORS_ORIGINS` allowlist 中
- Debug 推荐使用 `http://localhost:3000`
- Release 默认使用 `https://xyzw.xq5007.fun`，且必须与生产环境 `CORS_ORIGINS` 保持一致
- Release 默认不会回退到 `http://10.0.2.2` 这类 loopback HTTP Origin

应用启动时会把默认值写入 DataStore：

- `api_base_url`
- `theme_mode`

运行时 Retrofit 实际访问的是：

- `${API_BASE_URL}/api/v1/*`

WebSocket 实际访问的是：

- `${API_BASE_URL}` 同源下的 `/ws`
- 握手请求会额外带上构建时注入的 `Origin: ${DEFAULT_WS_ORIGIN}`

## Debug / Release 约束

### Debug

- 模拟器访问本机后端请使用 `http://10.0.2.2:8787`
- `android/app/src/debug/res/xml/debug_network_security_config.xml` 已允许 `10.0.2.2`、`127.0.0.1`、`localhost` 明文流量

### Release

- Release 构建禁止明文 HTTP
- `AppContainer` 会校验 Release 环境下的 `API_BASE_URL` 必须是 HTTPS
- 若仍提供 HTTP 地址，应用会在启动容器时直接拒绝使用

### Release 签名

本机 release 签名配置从 `android/local.properties` 读取：

- `RELEASE_STORE_FILE`
- `RELEASE_STORE_PASSWORD`
- `RELEASE_KEY_ALIAS`
- `RELEASE_KEY_PASSWORD`

签名 keystore 应放在 `android/.release-signing/` 下。该目录已被 `.gitignore` 忽略，不要提交到仓库。后续升级同一个安装包时必须继续使用同一个 keystore，否则用户手机上会被视为不同签名应用。

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
- 若 `DEFAULT_WS_ORIGIN` 非空，握手会显式设置 `Origin`

因此后端需要满足：

- Android 构建配置出来的 `Origin` 必须位于 `CORS_ORIGINS` 白名单中
- Debug 推荐配置为本地前端开发地址 `http://localhost:3000`
- Release 默认配置为生产 HTTPS Origin `https://xyzw.xq5007.fun`，不能使用 `http://10.0.2.2`
- 无 `Origin` + Bearer-only 的握手不作为 Android 正式认证方案
- Android 正式方案仍是登录后复用 access cookie 进行 WS 握手

## Web 下载入口

Web 端公开下载页为 `/android-app`。生产构建通过 `.env.production.local` 中的配置开放下载按钮：

```env
VITE_ANDROID_APP_DOWNLOAD_URL=/downloads/xyzw-helper.apk
```

构建 release 后，把 signed APK 复制到：

- `public/downloads/xyzw-helper.apk`

执行 `npm run build` 后，Vite 会把它复制到：

- `dist/downloads/xyzw-helper.apk`

## 本地构建

```bash
cd android
./gradlew clean
./gradlew testDebugUnitTest
./gradlew assembleDebug
./gradlew assembleRelease -PAPI_BASE_URL=https://xyzw.xq5007.fun -PwsOrigin=https://xyzw.xq5007.fun
```

当前工程默认包名：

- `com.xyzw.helper`

应用名：

- `XYZW Helper`

## V2 功能清单

V2 继续保持原生 Android 实现，不使用 WebView、Capacitor 或 Cordova，也不嵌入现有 Vue 页面。

已实现：

- 统一 Material 3 Design System：light/dark theme、typography、shapes、卡片、入口卡片、统计卡片、状态 chip、空态、错误态、loading、确认弹窗、snackbar、敏感值脱敏展示。
- 主导航：控制台、工作台、任务、通知、我的五个底部 tab；当前 tab 重复点击不重复压栈；通知 tab 显示未读 badge。
- 控制台：展示当前用户、WebSocket 状态、角色数、本地 Token 数、任务完成率、未读通知数、后端版本和快捷入口。
- Token 管理：手动导入名称和 Token 内容、URL proxy 导入、BIN scoped-storage 上传、download-ticket 下载、Token/BIN 删除确认、敏感 Token 默认脱敏。
- 角色管理：角色列表、新增、编辑、详情弹窗、删除确认、刷新、错误提示。
- 日常任务：角色选择、状态摘要、任务列表、手动完成、启用/自动执行切换、delay/notification/cronExpr 配置、历史记录加载更多。
- 任务控制：读取和保存任务控制状态、保存时保留后端未知配置字段、日志刷新、本地状态筛选、清空日志确认、WebSocket 任务状态刷新。
- 通知中心：全部/未读筛选、单条已读、全部已读、清空确认、WebSocket 新通知刷新、未读 badge。
- 反馈中心：反馈列表、创建反馈、状态展示、管理员备注展示、长文本展开/收起。
- 个人中心：资料展示和修改、修改密码前二次确认、主题偏好、Debug API 地址编辑、Release API 地址只读、最近安全事件、退出登录。
- 推广中心：推广资料、生成推广码、推广概览、转化记录、Android 系统分享。
- 管理员模块：入口分区、非管理员拦截、用户搜索/筛选、权限和上限调整、重置密码、吊销会话、删除用户、邀请码/激活码创建禁用解绑删除、reveal 410 友好提示、工单处理、任务日志筛选、更新广播、微信联系人维护、推广归因和转化处理。
- 统一错误处理：401 仍由 `SessionAuthenticator` refresh 一次；403/404/409/429/500 和非标准错误 body 会显示面向用户的友好文案。

## V2.1 修复清单

V2.1 是在 V2 主体功能上的收口修复，仍然保持原生 Android 实现，不改变现有 Web 前端和后端安全基线。

已修复：

- 密码和恢复码输入默认隐藏：Profile 当前密码、新密码、用户二次确认密码、管理员确认密码、恢复码、MFA 恢复码均不明文显示。
- 反馈提交失败不清空表单：只有后端返回成功后才清空标题和内容；失败会保留用户输入并显示错误反馈。
- 危险操作确认：角色删除、BIN 删除、通知清空、任务日志清空、退出登录均需要二次确认。
- 日常任务配置：移动端只展示后端模型已有的 `enabled`、`autoExecute`、`delay`、`cronExpr`、`notification` 字段，保存后刷新任务列表和状态。
- BIN 上传：继续使用 Android scoped storage，不读取文件绝对路径；上传前检查文件大小，超过 32MB 会给出友好提示；正常上传使用 streaming `RequestBody`，避免一次性读入内存。
- 推广分享：推广中心使用系统 `Intent.ACTION_SEND` 分享推广链接或推广码，不使用 WebView。
- 敏感内容展示：Token 内容默认脱敏，只能通过眼睛按钮临时显示。

尚未实现或受后端限制：

- 管理员后台没有追求 Web 后台的全量复杂配置项，只覆盖移动端高频操作。
- TaskControl 高级任务配置仍以保留后端原始 JSON 为主，Android 端只暴露启用和 cron 等移动端常用字段，避免覆盖 Web 端高级配置。
- release 包的 API 地址运行时修改被禁用；如需切换生产域名，必须通过 Gradle 属性重新打包。
- WebSocket 真机连通性依赖后端 `CORS_ORIGINS`、Cookie secure、域名和内网穿透配置正确。

## 内网穿透打包方式

Debug 包可连接本机或内网穿透后端：

```bash
cd android
./gradlew assembleDebug \
  -PAPI_BASE_URL=https://your-domain.example \
  -PwsOrigin=https://your-domain.example
```

Release 包必须使用 HTTPS：

```bash
cd android
./gradlew assembleRelease \
  -PAPI_BASE_URL=https://your-domain.example \
  -PwsOrigin=https://your-domain.example
```

注意：`API_BASE_URL` 是服务端根地址，不要写成 `/api/v1`；应用内部会自动访问 `${API_BASE_URL}/api/v1/*`。

## 真机验收清单

- 冷启动后进入登录页，登录成功后进入五 tab 主界面。
- 控制台能显示用户、角色数、Token 数、未读通知数、任务完成率和后端版本。
- Token 页面能手动导入、URL 导入、上传 BIN、下载 BIN、删除前弹确认。
- Token 手动输入和列表展示不暴露完整敏感值；需要查看时必须点击眼睛按钮。
- BIN 上传大文件时显示大小上限提示，正常大小文件可通过系统文件选择器上传。
- 无角色时日常任务页显示创建角色引导；有角色时能加载状态、列表和历史。
- 日常任务配置能保存 delay、cronExpr 和通知开关，保存后列表与状态刷新。
- 通知 WebSocket 消息到达后通知中心刷新，底部导航未读 badge 更新。
- 反馈提交失败时标题和内容仍保留，成功后才清空。
- Profile 修改密码前必须出现二次确认，退出登录后 Cookie、session 和 WebSocket 都被清理。
- Profile 当前密码、新密码、确认密码和恢复码输入必须隐藏显示。
- 非管理员不能进入管理员中心；管理员高危写操作必须先完成管理员确认。
- 深色/浅色/跟随系统主题切换后主要文本和状态 chip 仍可读。

## 常见错误

- `API_BASE_URL` 写成 `/api/v1`：应填写服务端根地址，例如 `https://your-domain.example`。
- `wsOrigin` 写成 `wss://`：Origin 是 HTTP Origin，应写 `https://your-domain.example`。
- `CORS_ORIGINS` 未包含 `wsOrigin`：后端会拒绝 Android `/ws` 握手。
- 反馈提交失败后表单被清空：这是异常行为，V2.1 要求失败保留标题和内容，成功后才清空。
- 密码输入明文显示：这是异常行为，Profile、管理员确认、恢复码等敏感输入都必须隐藏。
- Cookie secure 配置错误：HTTPS 生产环境必须正确设置 secure cookie；HTTP debug 环境不要误用生产 secure 策略。
- ngrok 返回 warning HTML：后端 API 会收到 HTML 而非 JSON，Android 会显示解析/服务器异常；需要配置 ngrok 跳过 warning 或使用稳定域名。
- App 保存了旧 `api_base_url`：Debug 包可在个人中心修改；也可以清除 App 数据后重新启动写入默认值。
