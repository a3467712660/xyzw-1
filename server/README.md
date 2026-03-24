# server (legacy, do not deploy)

`server/` 是历史 Flask 兼容服务目录，禁止用于生产部署，也不应进入生产镜像、压缩包或网关转发链。

## 状态

- 生产主链路：`backend/`（Node 后端）。
- `server/` 仅允许在短期迁移验证时临时启用，且只能内网/回环访问。
- 生产打包链、Docker 上下文与 CI 产物检查均应排除 `server/`。
- Legacy Flask 存在已知高风险能力，不满足生产安全基线（如历史 URL token 链路、上传入口、历史接口兼容面较大）。

## 强制约束

- `server/app.py` 在**模块导入阶段**即校验 `ENABLE_LEGACY_FLASK=1`。  
  这同时覆盖 `python app.py` 与 WSGI 方式（如 `gunicorn server.app:app`）。
- 历史 `/<token>/<bin_param>/<key>` URL token 路由默认返回 `410 Gone`；只有显式设置 `ENABLE_LEGACY_FILE_TOKEN_ROUTE=1` 才允许临时恢复。
- 默认仅允许 `127.0.0.1` 监听；若要绑定非回环地址，需显式设置 `ALLOW_LEGACY_FLASK_PUBLIC_BIND=1`。
- 默认不启用 CORS。仅在设置 `LEGACY_CORS_ORIGINS` 后按白名单启用。  
  若 `LEGACY_CORS_SUPPORTS_CREDENTIALS=true`，禁止使用 `*` 通配符源。

## 临时迁移用法（仅内部）

```bash
cd server
pip install -r requirements.txt
ENABLE_LEGACY_FLASK=1 FLASK_RUN_HOST=127.0.0.1 FLASK_RUN_PORT=5000 python app.py
```

## 一键安全启动（推荐）

```bash
cd server
pip install -r requirements.txt
bash ./start-safe.sh
```

`start-safe.sh` 默认行为：

- 必须由调用方显式传入 `ENABLE_LEGACY_FLASK=1`
- 仅监听 `127.0.0.1`（禁止公网绑定）
- `LEGACY_MAX_CONTENT_LENGTH=2097152`（2MB 上传上限）
- `LEGACY_HTTP_TIMEOUT_SECONDS=8`（外部请求超时）
- `SESSION_COOKIE_HTTPONLY=true`、`SESSION_COOKIE_SAMESITE=Strict`

如需临时调整，可在命令前覆盖环境变量，例如：

```bash
ENABLE_LEGACY_FLASK=1 SESSION_COOKIE_SECURE=true LEGACY_MAX_CONTENT_LENGTH=1048576 bash ./start-safe.sh
```

如果你需要外网服务入口，请在网关层仅暴露 `backend/`，并确保 legacy 路由统一返回 `404` 或 `410`。
