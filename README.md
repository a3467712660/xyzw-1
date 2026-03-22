# XYZW Web Helper

XYZW Web Helper 是一个面向《咸鱼之王》玩家的 Web 工具集，提供 Token 管理、角色管理、日常任务状态、任务控制、工单反馈与后台管理能力。

## 当前推荐模式（2026-03-10）

- 当前推荐开发模式：前端 `Vite`（`http://localhost:3000`）通过开发代理访问后端 `Express`（`http://localhost:8787`）。
- 当前推荐生产模式：前端静态资源独立部署，`/api/v1` 与 `/ws` 由 `backend/`（Express）对外提供。
- Worker 是否启用：默认不启用；Worker 已归档到 `deploy/legacy/worker.js`，不参与日常开发主流程。
- `server/` 与 `backend/` 的关系：`backend/` 是当前正式后端主线；`server/` 是历史 Flask 兼容服务，仅在旧流程迁移或排障时按需启用。

现在本地到底怎么跑：先启动 `backend`（8787），再启动 `vite`（3000），浏览器统一访问 `http://localhost:3000`，由 Vite 代理转发 `/api/v1` 和 `/ws` 到 Express。

最小架构图（开发主链路）：

```text
浏览器
  -> src/ (Vite Dev Server, :3000)
      -> /api/v1 -> backend/ (Express, :8787) -> 数据库
      -> /ws     -> backend/ (Express WebSocket, :8787)
      -> backend/ BIN 文件接口 -> BIN 存储
```

更多说明见：[docs/architecture.md](docs/architecture.md)

新机器首次启动请按：[docs/startup.md](docs/startup.md)
认证流程与 401/403 约定请见：[docs/auth-flow.md](docs/auth-flow.md)
首次接手仓库请先看：[docs/project-structure.md](docs/project-structure.md)
依赖漏洞与供应链治理流程请见：[docs/dependency-security-governance.md](docs/dependency-security-governance.md)
前端高风险资产隔离与 CSP 加固请见：[docs/frontend-asset-isolation-and-csp.md](docs/frontend-asset-isolation-and-csp.md)

## Legacy Flask 风险提示（重要）

- `server/` 是历史兼容服务，仅可用于短期排障/迁移验证，禁止生产部署。
- 即使手动启用 `ENABLE_LEGACY_FLASK=1`，该服务仍有更高风险面（如历史 URL token 链路、上传接口、遗留协议兼容代码）。
- 推荐使用一键安全启动（仅本机回环 + 上传上限 + 请求超时 + 严格 cookie）：

```bash
cd server
pip install -r requirements.txt
bash ./start-safe.sh
```

详细约束见：[server/README.md](server/README.md)

当前仓库是 **前后端一体项目**：
- 前端：Vue 3 + Vite（默认 `http://localhost:3000`）
- 后端：Express + WebSocket + SQLite (`better-sqlite3`)（默认 `http://localhost:8787`）

## 前后端职责边界

- 前端（`src/`）
  - 页面与交互（Vue 组件、路由、状态管理）
  - 调用 `/api/v1` 与 `/ws`，展示任务、角色、反馈、通知等数据
  - 负责本地 UI 偏好（主题、动效）与部分本地缓存
- 后端（`backend/`）
  - 认证鉴权、管理员权限、邀请码机制
  - 业务数据持久化（用户、角色、任务记录、工单、通知等）
  - WebSocket 事件推送、任务调度与日志清理
  - BIN 文件服务与用户隔离存储

后端的详细接口、环境变量与启动说明见：
- [backend/README.md](backend/README.md)

## 功能概览

### 用户侧
- 登录 / 注册 / 忘记密码
- Token 导入（手动、URL、BIN、批量）
- 角色管理（新增、编辑、删除、详情）
- 日常任务状态查看与完成记录
- 任务控制面板（状态持久化 + 日志）
- 反馈中心与通知中心
- 个人资料与偏好设置

### 管理员侧
- 用户列表与管理员权限调整
- 用户密码重置 / 重置码生成
- 邀请码管理
- 工单处理
- 审计日志
- 后端任务日志总览（管理中心）
  - 页面入口：`/admin/task-control-logs`
  - 使用方式：管理员登录后，顶部“管理中心”菜单进入“后端任务日志”，可按账号/任务/状态/内容筛选。

### 系统能力
- `/ws` WebSocket 推送（如任务完成事件）
- BIN 文件存储与清理
- 任务控制日志自动清理
- 可选 24x7 守护模式（PM2 + Playwright）

## 技术栈

- 前端：Vue 3、Vue Router、Pinia、Arco Design、Naive UI、UnoCSS、Axios
- 后端：Node.js、Express、ws、better-sqlite3、node-cron
- 工具：Vite、ESLint、Playwright、PM2（可选）

## 快速开始

### 1. 环境要求

- Node.js `>= 20`
- npm `>= 10`
- 包管理器统一为 `npm`（以根目录 `package-lock.json` 为准）

### 2. 安装依赖

```bash
npm install
npm --prefix backend install
```

### 3. 配置后端环境变量

复制并编辑后端环境变量：

```bash
cp backend/.env.example backend/.env
```

至少需要修改以下字段（否则后端会拒绝启动）：
- `JWT_SECRET`
- `AES_KEY`

常用配置项：

```env
BACKEND_PORT=8787
JWT_SECRET=replace-with-your-own-long-random-secret
AES_KEY=replace-with-your-own-long-random-secret
CORS_ORIGINS=http://localhost:3000,https://xyzw.xq5007.fun
LOG_REQUESTS=true
DB_PATH=/absolute/path/to/backend/data/xyzw.sqlite.bin
BIN_STORAGE_PATH=/absolute/path/to/backend/data/bin-storage
BACKEND_ERROR_LOG_PATH=/absolute/path/to/backend/data/backend-errors.log
BACKEND_ERROR_LOG_MAX_BYTES=5242880
BACKEND_ERROR_LOG_MAX_FILES=5
```

启动校验行为：
- `JWT_SECRET` 为空或占位值：后端直接报错退出
- `AES_KEY` 为空或占位值：后端直接报错退出
- `DB_PATH` 不存在：启动时打印明确提示（首次启动会初始化数据库文件）
- `BIN_STORAGE_PATH` 不存在：启动时自动创建目录

### 4. 启动开发环境

官方唯一开发入口命令：

```bash
# 前端
npm run dev

# 前端（调试模式：允许对外监听 + 开启第三方调试代理）
npm run dev:debug

# 后端
npm run backend:dev

# 联调（同时启动前后端）
npm run dev:all
```

一键启动前后端：

```bash
npm run dev:all
```

或分别启动：

```bash
npm run backend:dev
npm run dev
```

启动后默认地址：
- 前端：`http://localhost:3000`
- 后端健康检查：`http://localhost:8787/health`
- WebSocket：`ws://localhost:8787/ws`

开发安全默认值（前端）：
- `npm run dev` 默认仅监听 `127.0.0.1`，默认不自动打开浏览器。
- 第三方调试代理（如 `/api/weixin*`、`/api/hortor`）默认关闭，仅在 `debug` 模式或显式环境变量开启时启用。
- 如需自定义，可使用环境变量：
  - `VITE_DEV_EXPOSE_HOST=true|false`
  - `VITE_DEV_HOST=0.0.0.0`
  - `VITE_DEV_DEBUG_PROXY=true|false`
  - `VITE_DEV_OPEN=true|false`
  - `VITE_XYZW_RUNTIME_ALLOWED_HOSTS=app.example.com,.app.example.com`（限制 `/tokens` 页高风险运行时仅在指定域加载；本地回环地址默认允许）

## 常用命令

```bash
# 前端开发
npm run dev

# 前后端联调
npm run dev:all

# 构建前端
npm run build

# 本地预览构建产物
npm run preview

# 启动后端（生产方式）
npm run backend:start

# 初始化管理员
npm run backend:init-admin

# 启动任务守护脚本（前台）
npm run task:daemon

# 历史脚本（仅兼容旧流程）
npm run test:role-token
npm run test:token

# 供应链安全门禁（依赖漏洞/许可证/锁文件）
npm run security:sca
```

## 锁文件策略

- 根目录使用 `package-lock.json`
- `backend/` 使用 `backend/package-lock.json`
- 不再使用 `pnpm-lock.yaml`，统一使用 `npm`

## 管理员初始化

一次性初始化管理员（命令行）：

```bash
ADMIN_USERNAME=admin \
ADMIN_EMAIL=admin@example.com \
ADMIN_PASSWORD='YourStrongPassword123!' \
npm --prefix backend run init-admin
```

也可以在启动后端时通过 `BOOTSTRAP_ADMIN_*` 环境变量自动引导管理员。

## 24x7 无人值守（可选）

项目提供 PM2 脚本用于长期运行前端、后端和可选任务守护：

```bash
# 启动
./scripts/start-24x7.sh start

# 查看状态
./scripts/start-24x7.sh status

# 查看日志
./scripts/start-24x7.sh logs

# 停止
./scripts/start-24x7.sh stop
```

启用任务守护（自动保持 task-control 页面在线）：

```bash
ENABLE_TASK_DAEMON=1 \
TASK_DAEMON_USERNAME=your_username \
TASK_DAEMON_PASSWORD=your_password \
./scripts/start-24x7.sh start
```

守护脚本安全默认值（建议保持）：
- `TASK_DAEMON_PERSIST_SESSION=false`（默认）：使用非持久化浏览器上下文，不落盘 Cookie/LocalStorage。
- 仅当确有需要时开启 `TASK_DAEMON_PERSIST_SESSION=true`；此时 `TASK_DAEMON_USER_DATA_DIR` 必须是 owner-only 权限目录（Linux/macOS 建议 `chmod 700`）。
- `TASK_DAEMON_DISABLE_SANDBOX=true` 仅允许在非生产且 `BASE_URL` 指向 `localhost/127.0.0.1` 时启用，生产环境会直接拒绝启动。

多账号模式请使用：
- `TASK_DAEMON_ACCOUNTS=acc1,acc2`
- `TASK_DAEMON_<ID>_USERNAME`
- `TASK_DAEMON_<ID>_PASSWORD`

后端原生调度（Beta）：
- 后端启动后会自动扫描 `任务控制` 配置并按 Cron 触发，无需前台打开网页。
- 当前仅支持：`领取挂机`、`重置罐子`、`领取功法残卷`、`俱乐部商店购买`、`收车`、`智能发车`。
- 其余任务会写入“暂不支持后端执行”的日志，不会静默失败。
- 执行依赖服务端可读取到对应账号的 BIN 文件（`/api/v1/bin-files/:tokenId`）。
- 新增固定禁跑窗口：每周五 `04:50-07:00` 不执行任务；命中后自动延后，并在窗口结束后补跑。
- 多账号执行策略：后端按“全局串行队列”逐个账号执行（同一时刻只执行 1 个账号）。
- 任务日志会记录排队信息（如“前方排队 N 个”），便于观察拥堵情况。

## API 概览（`/api/v1`）

- 认证：`/auth/register` `/auth/login` `/auth/password-reset` `/auth/refresh` `/auth/user`
- 角色：`/gamerole_list` `/gameroles`
- 日常任务：`/daily-tasks` `/daily-tasks/:taskId/complete` `/daily-tasks/history`
- 用户：`/user/profile` `/user/password` `/user/preferences/:key`
- 管理：`/admin/users` `/admin/invite-codes` `/admin/audit-logs` `/admin/task-control/logs`
- 工单与通知：`/feedbacks` `/notifications`
- 任务控制：`/task-control/state` `/task-control/logs`
- 资源变化日志：`/resource-change-logs`
- BIN 文件：`/bin-files`

## 部署说明

### Cloudflare Pages / Worker

当前仓库不把 Worker 作为生产入口，生产主链路是静态前端 + `backend/`。

- `wrangler.toml` 仅保留 Pages 构建配置。
- 历史 Worker 代码已归档到 `deploy/legacy/worker.js`，默认不启用。
- 如需重启 Worker 方案，建议基于归档文件建立新的部署目录，并单独维护环境变量与 CORS 策略。
- `docker/` 目录默认用于本地演示/快速验收；若要作为生产入口，请先按 `docker/README.md` 完成 TLS、反代上游、安全头与缓存策略核对。

### 可选 Python 服务（历史兼容）

`server/app.py` 是历史 Flask 服务（legacy），禁止生产部署。
它不参与默认前后端联调流程，仅允许在短期迁移验证时临时启用，并且必须绑定回环地址：

```bash
cd server
pip install -r requirements.txt
ENABLE_LEGACY_FLASK=1 FLASK_RUN_HOST=127.0.0.1 FLASK_RUN_PORT=5000 python app.py
```

仓库内置了 `npm run guard:legacy` 检查，用于在 CI/CD 阶段阻断 legacy 文件或启动入口混入产物。

## 项目结构

```text
.
├─ docs/                   # 项目文档
│  ├─ project-structure.md # 目录职责与接手入口
│  └─ archive/             # 历史/归档文档
├─ src/                    # 前端源码（views/components/stores/utils）
│  ├─ router/modules/       # 路由按领域拆分
│  └─ stores/modules/       # 状态按领域拆分（新增标准目录）
├─ backend/                # Node.js 后端
│  ├─ src/routes/          # REST API 路由
│  ├─ src/modules/         # 后端业务模块（新增标准目录）
│  ├─ src/services/        # 业务服务（任务、通知、WS 等）
│  ├─ src/db/              # SQLite（better-sqlite3）封装与初始化
│  └─ .env.example         # 后端环境变量模板
├─ server/                 # 历史 Flask 兼容服务（非主链路）
├─ source/                 # 历史源码样本/逆向参考，不参与构建
├─ test/                   # 历史脚本测试目录，不是自动化测试主入口
├─ scripts/                # 24x7 启动与守护脚本
├─ public/                 # 静态资源
├─ deploy/
│  └─ legacy/              # 历史部署文件归档
│     └─ worker.js         # Cloudflare Worker（已归档，默认不启用）
└─ wrangler.toml           # Cloudflare Pages 构建配置（不代表启用 Worker）
```

## 许可证

本项目采用 `CC-BY-NC-SA-4.0`，详见 `LICENSE`。
