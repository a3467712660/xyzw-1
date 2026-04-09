# STARTUP (Clean Machine)

本文件用于在全新环境稳定复现启动流程。

## 1. 前置环境

- Node.js >= 20
- npm >= 10
- 包管理器只使用 npm

校验：

```bash
node -v
npm -v
```

## 2. 安装依赖（唯一方式）

在仓库根目录执行：

```bash
npm ci
npm --prefix backend ci
```

说明：

- 根目录使用 `package-lock.json`
- `backend/` 使用 `backend/package-lock.json`
- 不使用 pnpm/yarn，避免依赖漂移

## 3. 配置后端环境变量

```bash
cp backend/.env.example backend/.env
```

必须改掉以下占位值：

- `JWT_SECRET`
- `AES_KEY`

建议配置（可按机器路径调整）：

```env
BACKEND_PORT=8787
JWT_SECRET=replace-with-your-own-long-random-secret
AES_KEY=replace-with-your-own-long-random-secret
CORS_ORIGINS=http://localhost:3000,https://your-single-domain.example
LOG_REQUESTS=true
DB_PATH=./data/xyzw.sqlite.bin
BIN_STORAGE_PATH=./data/bin-storage
```

前端单域安全相关 env：

```env
VITE_XYZW_RUNTIME_ALLOWED_HOSTS=your-single-domain.example
VITE_TRUSTED_IMPORT_API_HOSTS=your-single-domain.example
TRUSTED_IMPORT_API_HOSTS=your-single-domain.example
# 仅在需要对外暴露 dev/preview host 时设置
VITE_DEV_ALLOWED_HOSTS=preview.example.com,.preview.example.com
```

说明：

- 未配置 `VITE_XYZW_RUNTIME_ALLOWED_HOSTS` 时，前端默认仅允许 `localhost`、`127.0.0.1`、`::1`。
- 未配置 `VITE_TRUSTED_IMPORT_API_HOSTS` 时：开发环境前端默认仅允许 `localhost`、`127.0.0.1`、`::1`；生产环境不再隐式允许跨域 loopback。
- 未配置 `TRUSTED_IMPORT_API_HOSTS` 时：开发环境后端 `POST /api/v1/token-import/proxy` 默认仅允许 `localhost`、`127.0.0.1`、`::1`；生产环境默认空白名单并 fail-closed。
- 一旦显式配置上述 env，就严格按配置白名单执行，不再隐式追加 loopback。
- 生产环境必须显式设置 `TRUSTED_IMPORT_API_HOSTS`，且不得包含 `localhost`、`127.0.0.1`、`::1`、`[::1]`。
- `VITE_TRUSTED_IMPORT_API_HOSTS` 是前端白名单，`TRUSTED_IMPORT_API_HOSTS` 是后端代理白名单，两者应保持一致。
- 可用 `node ./scripts/security/check-backend-prod-config.mjs --env backend/.env` 提前校验生产风格配置。

## 4. 启动校验规则

后端启动时会执行以下校验：

- `JWT_SECRET` 为空或仍是占位值 -> 直接报错退出
- `AES_KEY` 为空或仍是占位值 -> 直接报错退出
- `DB_PATH` 指向的文件不存在 -> 输出明确提示（首次启动会自动初始化该数据库文件）
- `BIN_STORAGE_PATH` 目录不存在 -> 自动创建

## 5. 官方唯一开发命令

```bash
# 前端
npm run dev

# 后端
npm run backend:dev

# 联调（同时启动前后端）
npm run dev:all
```

约定：

- 日常联调只使用 `npm run dev:all`
- 浏览器只访问 `http://localhost:3000`
- `/api/v1` 与 `/ws` 通过 Vite 代理进入后端 `http://localhost:8787`

## 6. 健康检查

- 前端：<http://localhost:3000>
- 后端：<http://localhost:8787/health>
- WebSocket：`ws://localhost:8787/ws`

## 7. 锁文件策略

- 保留：
  - `package-lock.json`
  - `backend/package-lock.json`
- 删除并禁止新增：
  - `pnpm-lock.yaml`
  - `yarn.lock`
