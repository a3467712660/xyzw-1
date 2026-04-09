# Tunnel Production Baseline

本文件定义“内网穿透/隧道 -> 网关 -> 应用”的唯一推荐生产拓扑，避免把 legacy Flask 或应用进程直接暴露到公网。

## 强制边界

- Tunnel 入口只能转发到 Nginx。
- Nginx 只能反代到：
  - 单机：`127.0.0.1:8787`
  - 容器：`backend:8787`
- 不允许：
  - Tunnel -> Express 直连
  - Tunnel -> legacy Flask 直连
  - Nginx `proxy_pass` 指向 `:5000`

## Legacy Flask 规则

- `server/` 只用于临时迁移验证，不进入生产暴露面。
- 必须保持：
  - `ENABLE_LEGACY_FLASK=0` 或不设置
  - `ALLOW_LEGACY_FLASK_PUBLIC_BIND=0`
  - `ENABLE_LEGACY_FILE_TOKEN_ROUTE=0`
  - `LEGACY_TRUST_PROXY=false`
- 如需内部临时排障，只允许 loopback 启动，并显式提供 `FLASK_SECRET_KEY`。

## Tunnel / Nginx 基线

- Tunnel 只暴露 HTTPS / WSS。
- Tunnel 侧应加第二层访问控制：IP allowlist、SSO、Access 或 Basic Auth，尤其是管理后台。
- Nginx 统一补齐：
  - `X-Real-IP`
  - `X-Forwarded-For`
  - `X-Forwarded-Proto`
- 生产域名必须是正式域名；不得把 `localhost` / `127.0.0.1` 写进 `CORS_ORIGINS`、`PUBLIC_APP_ORIGIN`、`ADMIN_APP_ORIGIN`、`TRUSTED_IMPORT_API_HOSTS`。

## 边缘限流示例

当前仓库里的 Nginx 文件是 `server {}` 片段，因此不要直接把 `limit_req_zone` / `limit_conn_zone` 塞进去。完整限流应放在 `http {}` 层，例如：

```nginx
http {
  limit_req_zone $binary_remote_addr zone=api_per_ip:10m rate=20r/s;
  limit_req_zone $binary_remote_addr zone=sse_per_ip:10m rate=5r/m;
  limit_conn_zone $binary_remote_addr zone=conn_per_ip:10m;

  server {
    location /api/v1/public/wechat-contacts/stream {
      limit_req zone=sse_per_ip burst=3 nodelay;
      limit_conn conn_per_ip 3;
      proxy_pass http://127.0.0.1:8787;
    }

    location /ws {
      limit_conn conn_per_ip 10;
      proxy_pass http://127.0.0.1:8787/ws;
    }

    location /api/v1/ {
      limit_req zone=api_per_ip burst=40 nodelay;
      proxy_pass http://127.0.0.1:8787;
    }
  }
}
```

## 发布前检查

在仓库根目录执行：

```bash
npm run guard:legacy
npm run security:prod-config
```

真实机器上校验运行时配置：

```bash
node ./scripts/security/check-backend-prod-config.mjs --env backend/.env
```
