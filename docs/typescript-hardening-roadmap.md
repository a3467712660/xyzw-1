# TypeScript 加固后续路线图

## 当前结论

当前 `npm run typecheck` 只覆盖 staged coverage，不代表整个仓库已经完成 TypeScript 迁移。

- 前端当前 typecheck 入口：`tsconfig.typecheck.json`
- 后端当前 typecheck 入口：`backend/tsconfig.json`
- 后端运行时仍是 `node src/index.js`，尚未切入 `.ts` 直接构建/运行链路

## 下一批优先迁移文件

建议按“先运行时边界，再核心安全链路”的顺序推进：

1. `src/api/index.runtime.js`
2. `src/api/authTransportRuntime.js`
3. `src/stores/auth.runtime.js`
4. `src/stores/localTokenManager.runtime.js`
5. `backend/src/lib/proxySafety.js`
6. `backend/src/config/env.js`
7. `backend/src/middleware/auth.js`

## 迁移原则

- 先迁纯运行时工具、边界适配层和低耦合文件。
- 每次只做一小批、可独立 typecheck、可独立回滚。
- 保持现有 API 语义、路由语义、数据库字段含义不变。
- 安全链路文件迁移时，必须同步补齐测试和验收命令。

## 后端文件的特别约束

`backend/src/lib/proxySafety.js`、`backend/src/config/env.js`、`backend/src/middleware/auth.js` 属于高风险运行时文件。

- 迁移这类文件前，先补后端 TS 构建/运行链路。
- 在未明确引入后端 `.ts` 运行方案前，不要只把单个 `.js` 改为 `.ts`。
- 避免出现“typecheck 能过，但生产仍跑 JS 老文件”的双轨状态。

## 建议推进顺序

### 第一阶段：前端运行时边界

- `src/api/index.runtime.js`
- `src/api/authTransportRuntime.js`
- `src/stores/auth.runtime.js`
- `src/stores/localTokenManager.runtime.js`

目标：先把 API transport、认证状态和本地 token 管理这些边界收紧为可类型检查的稳定层。

### 第二阶段：后端安全与配置边界

- `backend/src/lib/proxySafety.js`
- `backend/src/config/env.js`
- `backend/src/middleware/auth.js`

目标：在补齐后端 TS 运行链路后，再迁移 SSRF 安全、环境配置和鉴权中间件。
