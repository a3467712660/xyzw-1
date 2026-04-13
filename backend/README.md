# XYZW Backend

XYZW Web Helper 的 Node.js 后端服务，提供认证、角色管理、任务状态、任务控制、工单通知、后台管理与 WebSocket 推送能力。

## 技术栈

- Node.js + Express
- WebSocket (`ws`)
- SQLite (`better-sqlite3`)
- `node-cron`（定时任务）

## 快速开始

### 1. 安装依赖

```bash
npm --prefix backend ci
```

### 2. 配置环境变量

```bash
cp backend/.env.example backend/.env
```

关键变量：

- `JWT_SECRET`：JWT 签名密钥（必填）
- `AES_KEY`：字段加密密钥（必填）
- `CSRF_SECRET`：CSRF 签名密钥（必填，必须显式设置，不能复用 `JWT_SECRET`）
- `INVITE_CODE_PEPPER`：邀请码 HMAC pepper（必填，独立于其他 secret）
- `ACTIVATION_CODE_PEPPER`：激活码 HMAC pepper（必填，独立于其他 secret）
- `PASSWORD_RESET_CODE_PEPPER`：短时验证码 HMAC pepper（必填，独立于其他 secret）
- `BACKEND_PORT`：服务端口（默认 `8787`）
- `CORS_ORIGINS`：允许跨域来源白名单（逗号分隔）
- `CSP_CONNECT_SRC`：前端 `Content-Security-Policy connect-src` 白名单（逗号分隔，避免使用 `https:`/`wss:`/`ws:` 这类全局放行）
- `TRUSTED_IMPORT_API_HOSTS`：后端 `/api/v1/token-import/proxy` 允许代理的 host 白名单（逗号分隔，支持精确 host 和 `.example.com` 后缀匹配）
- `DB_PATH`：SQLite 数据文件路径
- `BIN_STORAGE_PATH`：BIN 存储目录
- `BACKEND_ERROR_LOG_PATH`：后端错误日志文件路径（默认 `./data/backend-errors.log`）

可选变量：

- `LOG_REQUESTS`：是否打印请求日志（默认 `true`）
- 后端错误日志落盘策略：
  - `BACKEND_ERROR_LOG_MAX_BYTES`（默认 `5242880`，约 5MB）
  - `BACKEND_ERROR_LOG_MAX_FILES`（默认 `5`，保留 `.1` 到 `.5`）
  - `BACKEND_ERROR_LOG_FILE_MODE`（默认 `600`，owner-only）
  - `BACKEND_ERROR_LOG_DIR_MODE`（默认 `700`，owner-only）
- DB 写入安全日志（默认最小化落盘）：
  - `DB_WRITE_SAFETY_LOG_ENABLED`（默认 `true`）
  - `DB_WRITE_SAFETY_INCLUDE_SQL`（默认 `false`，建议仅短期开启排障）
  - `DB_WRITE_SAFETY_PARAMS_TABLES`（默认空，逗号分隔白名单表名）
  - `DB_WRITE_SAFETY_PARAM_MAX_LEN`（默认 `120`）
- 应用内 SQLite 备份：
  - `APP_DB_BACKUP_ENABLED`（示例配置默认 `false`；生产环境仅在显式接受应用内明文备份风险时再 opt-in）
  - `PUBLIC_APP_ORIGIN`（生产环境必填：公开站点地址，用于用户侧链接）
  - `ADMIN_APP_ORIGIN`（生产环境必填：管理站点地址，用于管理员重置链接）
  - 生产建议保持关闭，改用基础设施层的加密快照/加密备份
- `EMAIL_WEBHOOK_URL` / `EMAIL_WEBHOOK_TOKEN` / `EMAIL_FROM`：工单邮件通知
- 日志清理策略（天数）：
  - `LOG_CLEANUP_TASK_CONTROL_DAYS`（默认 `30`）
  - `LOG_CLEANUP_TASK_RUNS_DAYS`（默认 `60`）
  - `LOG_CLEANUP_BIN_DOWNLOAD_AUDITS_DAYS`（默认 `90`）
  - `LOG_CLEANUP_BIN_DOWNLOAD_TICKETS_DAYS`（默认 `14`）
  - `LOG_CLEANUP_READ_NOTIFICATIONS_DAYS`（默认 `90`，仅清理已读通知）
  - `LOG_CLEANUP_SECURITY_EVENTS_DAYS`（默认 `180`）
  - `LOG_CLEANUP_ADMIN_AUDIT_DAYS`（默认 `365`）
- 日志清理执行时间（服务器本地时区）：
  - `LOG_CLEANUP_HOUR`（默认 `3`）
  - `LOG_CLEANUP_MINUTE`（默认 `20`）

启动校验：

- `JWT_SECRET` 为空或占位值会直接拒绝启动
- `AES_KEY` 为空或占位值会直接拒绝启动
- `CSRF_SECRET`、`INVITE_CODE_PEPPER`、`ACTIVATION_CODE_PEPPER`、`PASSWORD_RESET_CODE_PEPPER` 必须显式设置
- `NODE_ENV=production && ACCESS_TOKEN_EXPOSE_IN_BODY=true` 会直接拒绝启动
- `NODE_ENV=production && BOOTSTRAP_ADMIN_PASSWORD` 存在会直接拒绝启动
- `NODE_ENV=production && CORS_ORIGINS` 未显式设置会直接拒绝启动
- `NODE_ENV=production && CORS_ORIGINS` 包含 `localhost/127.0.0.1/::1` 会直接拒绝启动
- `TRUSTED_IMPORT_API_HOSTS` 在开发/测试环境未显式设置时，后端 token-import proxy 默认仅允许 loopback host
- `NODE_ENV=production` 下若未显式设置 `TRUSTED_IMPORT_API_HOSTS`，后端 token-import proxy 默认空白名单并 fail-closed
- `NODE_ENV=production` 下若 `TRUSTED_IMPORT_API_HOSTS` 包含 `localhost/127.0.0.1/::1/[::1]`，会直接拒绝启动
- `NODE_ENV=production` 下 `JWT_SECRET` / `CSRF_SECRET` / 三个 pepper 不能复用同一个值
- `NODE_ENV=production` 下若存在未启用 MFA 的管理员账号，会直接拒绝启动
- `NODE_ENV=production` 下应用内 SQLite 明文备份默认关闭；示例配置也保持 `APP_DB_BACKUP_ENABLED=false`
- 更推荐把备份交给基础设施层的加密快照或加密备份，而不是由应用自己复制明文库文件
- `NODE_ENV=production` 下必须显式提供 `PUBLIC_APP_ORIGIN` 与 `ADMIN_APP_ORIGIN`，不再从请求 `Origin` 推导链接地址
- `DB_PATH` 不存在时会打印清晰提示（首次启动将初始化数据库文件）
- `BIN_STORAGE_PATH` 不存在时会自动创建目录

供应链治理：

- 依赖漏洞与供应链治理流程见：`../docs/dependency-security-governance.md`
- 在仓库根目录执行：`npm run security:sca`（包含 lockfile、许可证、audit 门禁）

### 3. 启动服务

开发模式（watch）：

```bash
npm run backend:dev
```

生产模式：

```bash
npm run backend:start
```

健康检查：

- `GET /health`

## 管理员初始化

### 命令行初始化

```bash
ADMIN_USERNAME=admin \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='YourStrongPassword123!' \
npm --prefix backend run init-admin
```

要求：

- `ADMIN_USERNAME`、`ADMIN_EMAIL`、`ADMIN_PASSWORD` 都必须显式提供
- 不传用户名或邮箱时，初始化脚本会直接失败，不会使用任何默认身份

### 一次性初始化

不要在服务主进程里保留 `BOOTSTRAP_ADMIN_*` 变量。
管理员初始化改为一次性 init job / init script：

```bash
ADMIN_USERNAME=admin \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='YourStrongPassword123!' \
npm --prefix backend run init-admin
```

管理员首次登录后，必须继续完成 MFA 初始化，才能访问 `/api/v1/admin`：

```bash
ADMIN_USERNAME=admin \
ADMIN_EMAIL=admin@example.com \
npm --prefix backend run init-admin-mfa
```

运行时约束：

- `BOOTSTRAP_ADMIN_*` 不再由 `backend/src/index.js` 消费
- 生产环境如果仍设置 `BOOTSTRAP_ADMIN_*`，主进程会直接拒绝启动
- 所有管理员接口现在都要求管理员账号已启用 MFA

## 事故响应脚本

当怀疑数据库、发布制品、备份或密钥发生泄露时，建议至少执行以下两步：

```bash
npm --prefix backend run incident:revoke-all-sessions
npm --prefix backend run incident:invalidate-sensitive-codes
```

作用说明：

- `incident:revoke-all-sessions`
  - 对所有用户执行 `token_version + 1`
  - 撤销所有仍未撤销的 refresh token
- `incident:invalidate-sensitive-codes`
  - 失效所有仍可用的邀请码
  - 失效所有仍可用的激活码
  - 失效所有仍可用的短时密码重置码

这两条脚本不会替你轮换 `JWT_SECRET` / `AES_KEY` / `CSRF_SECRET` / 三个 pepper。密钥轮换仍需在部署平台完成，并在轮换后重启服务。

推荐事故响应顺序：

1. 立即执行：
   `npm --prefix backend run incident:revoke-all-sessions`
   `npm --prefix backend run incident:invalidate-sensitive-codes`
2. 在部署平台轮换：
   `JWT_SECRET`
   `AES_KEY`
   `CSRF_SECRET`
   `INVITE_CODE_PEPPER`
   `ACTIVATION_CODE_PEPPER`
   `PASSWORD_RESET_CODE_PEPPER`
   以上 secret/pepper 必须独立设置，不要复用同一个值
3. 重启后端服务，让新密钥生效。
4. 删除历史敏感制品与备份：
   发布归档
   `backend/data/backups/`
   任何包含旧 `.env`、SQLite、`bin-storage` 的离线拷贝
5. 如怀疑发布包外泄，视同 `bin-storage` 已暴露，按高风险数据处理。

## API 概览

接口统一前缀：`/api/v1`

- 认证：`/auth/register` `/auth/login` `/auth/logout` `/auth/logout-all` `/auth/password-reset` `/auth/refresh` `/auth/csrf` `/auth/me` `/auth/user`
- 用户：`/user/profile` `/user/password` `/user/stats`
- 偏好：`/user/preferences/:key`
- 角色：`/gamerole_list` `/gameroles`
- 日常任务：`/daily-tasks` `/daily-tasks/status` `/daily-tasks/:taskId/complete` `/daily-tasks/history`
- 任务控制：`/task-control/state` `/task-control/logs`
- 资源变化：`/resource-change-logs`
- BIN 文件：`/bin-files`
- 反馈与通知：`/feedbacks` `/notifications`
- 管理员：`/admin/users` `/admin/users/:id/revoke-sessions` `/admin/invite-codes` `/admin/audit-logs` `/admin/task-control/logs`

## 任务控制后端调度说明

- 执行模式：后端扫描任务控制配置后，按 Cron 自动触发。
- 当前支持任务：`daily`、`hangup`、`bottle`、`tower`、`study`、`legacy`、`arena`、`club-store`、`claim-car`、`send-car`。
- 固定禁跑窗口：每周五 `04:50-07:00` 不执行任务，命中后自动延后并在窗口后补跑。
- 多账号执行策略：全局串行队列（同一时间仅执行 1 个账号），避免同刻并发挤压。
- 日志增强：会写入排队信息（如“前方排队 N 个”）与延后/补跑原因。
- 管理中心查看入口：前端管理员页 `GET /admin/task-control-logs`（路由页面），数据接口 `GET /api/v1/admin/task-control/logs`。
- 日志口径：管理员页默认只展示带 `[backend]` 前缀的服务端调度日志，不展示前端手动执行写入的普通任务日志。

认证真相接口：

- `GET /api/v1/auth/me`（前端应以此作为刷新后登录态判断依据）

认证错误响应（401/403）统一结构：

```json
{
  "success": false,
  "message": "需要管理员权限",
  "error": {
    "code": "AUTH_ADMIN_REQUIRED",
    "message": "需要管理员权限"
  }
}
```

会话失效机制：

- Access token 含 `ver`（token version）声明。
- `logout-all`、用户改密、管理员重置密码、管理员强制下线、短码重置密码后，服务端会将用户 `token_version +1`，并撤销该用户 refresh token。

Access/Refresh 传输策略：

- 默认采用 `HttpOnly` cookie 会话：
  - access cookie：`ACCESS_COOKIE_NAME`（默认 `xyzw_access_token`，路径默认 `/`）
  - refresh cookie：`REFRESH_COOKIE_NAME`（默认 `xyzw_refresh_token`，路径默认 `/api/v1/auth`）
- 支持按子域隔离 Cookie（推荐用于 admin/app 分域）：
  - `ACCESS_COOKIE_DOMAIN`、`REFRESH_COOKIE_DOMAIN`、`CSRF_COOKIE_DOMAIN`
  - 示例：仅管理域可见 `admin.example.com`
  - 注意：若 Cookie 名使用 `__Host-` 前缀，必须同时满足：
    - `*_COOKIE_SECURE=true`
    - `*_COOKIE_DOMAIN` 为空（不可设置 Domain）
    - `ACCESS_COOKIE_PATH=/`
    - `REFRESH_COOKIE_PATH=/`
      （后端启动时会强校验，不满足即拒绝启动）
- `POST /api/v1/auth/refresh` 仅依赖 refresh cookie，不要求先携带 access token。
- 默认不在 JSON 响应体返回 access token（`ACCESS_TOKEN_EXPOSE_IN_BODY=false`）。如需兼容旧客户端可显式开启。
- 生产环境部署建议：
  - 强制开启 `REFRESH_COOKIE_SECURE=true`、`ACCESS_COOKIE_SECURE=true`、`CSRF_COOKIE_SECURE=true`
  - 网关层启用 HSTS（本仓库静态网关配置已默认开启）

CSRF 防护：

- 所有写操作接口默认启用 CSRF 校验（`X-CSRF-Token` + signed double-submit cookie）。
- `POST /api/v1/auth/login`、`POST /api/v1/auth/register`、`POST /api/v1/auth/password-reset` 也启用 CSRF 校验（需先调用 `GET /api/v1/auth/csrf` 获取 token/cookies）。
- CSRF 校验失败会写入 `security_event_logs`（事件类型：`csrf_validation_failed`），用于识别自动化探测与被动攻击流量。

敏感文本字段加密：

- 新写入统一使用 AEAD：`AES-256-GCM`（含认证标签，支持篡改检测）。
- 历史 `AES-256-CBC` 文本密文可继续读取，后续写回会自然迁移为 GCM。

## WebSocket

- 连接地址：`ws://localhost:8787/ws`
- 鉴权方式：
  - 握手阶段可读取 `Authorization: Bearer <JWT>` 或 access cookie
  - 浏览器场景使用首帧鉴权：`{"type":"auth","token":"<JWT>"}`
  - 不再接受 `?token=<JWT>` 查询参数
- 握手来源校验：
  - 显式校验 `Origin`，仅允许 `CORS_ORIGINS` 白名单来源建立连接
- 用户身份来源：仅使用 JWT `sub`，不接受客户端传 `userId`
- 用途：服务端实时推送（如任务完成事件）

## 目录结构

```text
backend/
├─ src/
│  ├─ config/        # 环境变量与运行配置
│  ├─ db/            # better-sqlite3 初始化与查询封装
│  ├─ middleware/    # 鉴权、限流、日志
│  ├─ routes/        # REST 路由
│  ├─ services/      # 业务服务
│  ├─ lib/           # 密码策略与加密工具
│  ├─ scripts/       # 管理脚本（含 initAdmin）
│  └─ index.js       # 入口
└─ .env.example      # 环境变量模板
```
