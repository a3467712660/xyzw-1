# Refactor Guidelines

这份约束用于控制后续重构方向，避免项目继续长回“页面直连所有层”的状态。

## 目录边界

- `shared/`
  - 只放前后端共用的纯逻辑。
  - 允许：协议解析、Cron 计算、纯函数常量、无浏览器/无 Node 专属副作用的工具。
  - 不允许：DOM、`window`、`localStorage`、Express、数据库访问。

- `src/`
  - 只放前端 UI、交互、状态管理和前端适配层。
  - 页面和组件不直接依赖 `backend/`。

- `backend/`
  - 只放后端服务、路由、调度、仓储。
  - 后端不允许再直接依赖 `src/`。

## 调用规则

- 页面和组件优先通过 `api/`、`services/`、`stores/` 取数据。
- 页面和组件不直接新增业务型 `localStorage`/`sessionStorage` 访问。
- 页面和组件不直接新增 `axios`/跨域 `fetch` 调用。
- Store 以状态管理为主，重副作用优先下沉到 `services/` 或 `composables/`。

## 共享逻辑规则

- 前后端共用逻辑优先落到 `shared/`。
- `src/utils/*` 如果只是共享逻辑的前端入口，应保持为薄转发层。
- 新增共享代码时，优先写成无运行时环境假设的纯模块。

## 重构优先级

1. 先消除跨层反向依赖。
2. 再拆超大文件和超大 store。
3. 最后再做目录归档和测试补齐。
