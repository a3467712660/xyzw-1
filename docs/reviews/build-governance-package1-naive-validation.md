# Build Governance Package 1 Validation

## Summary

- 本包保留的有效改动只有一项：将 `naive-ui` 从 `vendor-vue` 的手工分组中脱钩，单独命名为 `vendor-naive`。
- 这一步没有改变业务逻辑、路由流程、页面行为或视觉语义。
- 但验证结果同时说明：在当前仓库里，这一步**还不足以带来首屏启动链路的真实瘦身**。

## Landed Change

- `vite.config.js`
  - `naive-ui` 不再并入 `vendor-vue`，改为单独输出 `vendor-naive`。

当前构建结果中：

- `vendor-naive-*.js`: `206.66 kB`
- `vendor-vue-*.js`: 当前未形成独立输出文件

说明：

- 这轮实现的是“Naive UI 独立命名/归属”，不是“首屏已显著减重”。
- 当前 Rolldown 产物没有继续显式保留 `vendor-vue` 文件，说明 `vue` 核心依赖仍未形成我们预期的稳定独立边界。

## Validated Facts

以下事实已经通过实际构建产物确认：

1. 根入口仍然同步依赖 `vendor-naive`
   - `src/App.vue` 在根层直接挂载 `n-config-provider / n-message-provider / n-loading-bar-provider / n-notification-provider / n-dialog-provider`
   - 因此 `vendor-naive` 目前仍属于启动期依赖，而不是单纯的按页懒加载依赖

2. 首页 HTML 仍存在较大的全局预加载图
   - 当前 `dist/index.html` 会直接注入以下 `modulepreload`
   - `vendor-naive`
   - `task-control-runner`
   - `vendor-arco`
   - `vendor-i18n`
   - 以及若干启动期共享包

3. `main.js` 仍全局引入 `@arco-design/web-vue/dist/arco.css`
   - 这意味着 Arco 样式成本仍然由主入口统一支付

4. 当前最大真正未收口的前端块仍然不是 `vendor-naive`
   - `task-control-runner-*.js`: `1,163.23 kB`
   - `i18n-*.js`: `425.79 kB`
   - `vendor-arco-*.js`: `278.35 kB`
   - `vendor-naive-*.js`: `206.66 kB`

## Rejected Direction

本轮还做过一个未保留的验证：

- 尝试直接移除 `task-control-runner` 的手工分组，想让 bundler 回到更自然的拆分边界

结果：

- `vendor-naive` 膨胀到 `702.34 kB`
- 入口预加载图进一步恶化

结论：

- 在当前构建器行为下，不能粗暴移除 `task-control-runner` 分组来换取首屏收益
- 这条路已验证为回归风险更高，因此没有保留到当前代码

## Next Package Recommendation

下一包不应再把重点放在“继续调 `vendor-naive` 名字”上，而应直接转向启动链路治理：

1. 先审计 `index` 入口同步 import 链，找出为什么 `task-control-runner` 会进入根入口依赖图
2. 评估 `build.modulePreload.resolveDependencies` 是否适合只收敛 HTML 首屏预加载，而不破坏运行时模块图
3. 重新评估 `App.vue` 根层 Naive provider 与 `main.js` 全局 Arco 样式的启动期必要性
4. 在确认真实收益点之前，不继续把“拆 `naive-ui`”当成默认最高优先级

## Verification Commands

```bash
npm run build
npm run build:analyze
```

本轮分析产物：

- `artifacts/build-analysis/treemap.html`
- `artifacts/build-analysis/stats.json`
