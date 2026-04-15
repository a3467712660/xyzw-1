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

## UI 结构治理约束

- 拆 UI 组件时，必须同步迁移与该 DOM 对应的样式，不能只搬 template/script。
- 必须保留原布局 class、wrapper 和 DOM hooks；如果原排版依赖这些 class，就不能在拆分时顺手删掉或改名。
- 结构治理不得改变页面排版；header、toolbar、card、table、modal、footer 的层级、间距、按钮顺序和响应式切换都属于排版 contract。
- 如果样式依赖父级 `scoped` selector，拆分时必须同步处理：
  - 要么把对应样式迁到拥有 DOM 的子组件；
  - 要么用最小范围 `:deep()` 保持父级控制；
  - 不能默认继续把样式留在父组件里。

## UI 回归检查清单

- 新抽 UI 组件前，先检查父页是否存在依赖该 DOM 的 `scoped` selector。
- 新抽 UI 组件时，必须迁移对应样式，或明确保留原 wrapper / class hooks。
- 提交前必须做 dead-selector 检查，确认父页没有残留打不到子组件 DOM 的样式。
- modal 类组件必须保留原宽度、滚动区和高度 contract。
- responsive 规则必须与原页面一致，不能因为拆分而改变移动端 / 桌面端布局切换。
- 结构治理如果没有经过 UI 回归检查，不得继续推进。
