# Build Governance Phase 1 Baseline

## Summary

- 本轮只处理构建链低风险治理，不调整运行时 chunk 语义，不改业务逻辑。
- 默认 `npm run build` 已去掉两类计划内噪声：
  - 可选 Vite 插件缺失提示
  - `src/assets/styles/workbench.scss` 的全局 `:deep(...)` 语法提示
- 当前默认构建仍会保留 chunk size 警告；这不是 Phase 1 的处理目标。

## Phase 1 Changes

- `vite.config.js`
  - `@vitejs/plugin-basic-ssl` 改为仅在显式设置 `VITE_DEV_HTTPS=true` 时尝试加载。
  - `vite-plugin-vue-devtools` 改为仅在显式设置 `VITE_DEVTOOLS=true` 时尝试加载。
  - 新增 `VITE_BUILD_ANALYZE=true` 分支，在分析构建时挂载 `rollup-plugin-visualizer`。
- `src/assets/styles/workbench.scss`
  - 将 4 处全局 `:deep(...)` 选择器改为等价普通后代选择器。
- `package.json`
  - 新增 `npm run build:analyze`，统一输出分析产物到 `artifacts/build-analysis/`。

## Build Output Snapshot

分析命令：

```bash
npm run build
npm run build:analyze
```

分析产物：

- `artifacts/build-analysis/treemap.html`
- `artifacts/build-analysis/stats.json`

说明：

- `artifacts/` 已被 `.gitignore` 忽略，因此分析产物用于本地/CI 复现，不作为仓库提交物。
- `stats.json` 当前为 `rollup-plugin-visualizer` 的 `raw-data` 输出，可用于后续机器比较。

## Current Largest Output Files

按本轮 `dist/assets` 产物大小排序，当前最值得关注的是：

| Asset | Size | Note |
| --- | ---: | --- |
| `task-control-runner-*.js` | 1,163.23 kB | 当前最大运行时 chunk，优先检查批处理页面壳、编排逻辑、工具依赖是否绑定过重 |
| `excelExport.worker-*.js` | 938.91 kB | 特殊用途 worker，体积大但不属于首屏共享包 |
| `i18n-*.js` | 425.79 kB | 国际化运行时与消息资源包，需评估按路由或命名空间分片空间 |
| `vendor-arco-*.css` | 392.93 kB | 全局样式成本高，需评估是否继续让非主组件库支付全局入口成本 |
| `vendor-arco-*.js` | 278.35 kB | Arco 运行时体积仍偏大 |
| `FightPvp-*.js` | 266.24 kB | 页面级重模块，后续再看是否有进一步边界可拆 |
| `vendor-vue-*.js` | 206.66 kB | 当前仍包含 `naive-ui`，需要作为 Phase 2 首个共享包拆分点 |
| `vendor-capture-*.js` | 199.57 kB | `html2canvas` 等捕获能力，需确认是否已充分按需加载 |

## Phase 2 Priority

第二阶段默认按以下顺序推进：

1. 把 `naive-ui` 从 `vendor-vue` 脱钩，先降低首页、登录、注册、价格页的共享包负担。
2. 评估 `task-control-runner` 的进一步拆分边界，优先拆页面壳与重编排/重工具依赖。
3. 评估 `vendor-arco` / `vendor-arco.css` 是否仍值得继续作为全局入口成本存在。
4. 在完成真实瘦身之后，再讨论是否需要调整 `chunkSizeWarningLimit`。

约束：

- 第二阶段不得先调高阈值再把问题标记为“已解决”。
- 第二阶段应继续优先做结构性瘦身，而不是把告警静默化。

## Notes

- 本轮未处理 `.vue` 文件中的 `:deep()`。
  - 当前仓库中 `:deep()` 共有 238 处，其中 234 处位于 Vue SFC，4 处位于全局 `workbench.scss`。
  - 本轮只修真正触发构建语法告警的全局样式文件，避免扩大为大面积样式治理。
- 本轮也未调整 `manualChunks`。
  - 这是刻意保留给 Phase 2 的工作，不应与“构建噪声清理”混做一轮。
