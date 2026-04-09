# 企业级前端审计报告

- 审计对象：`xyzw-web-qian-acon-ui-refactor`
- 审计日期：`2026-04-09`
- 审计范围：仅基于当前仓库前端代码、样式文件、路由与一次 `npm run build` 结果
- 审计基线：`Vue 3 + Pinia + Vite` 企业级项目标准
- 约束说明：本报告不涉及任何业务代码改造，仅输出治理建议与整改优先级

## 一、执行摘要

当前前端工程已经具备企业化项目的一部分基础能力，包括：

- 路由层面已经做到 `33/33` 页面级懒加载。
- 项目具备统一入口、统一构建链路和基础设计 token 雏形。
- `services/token/*` 已开始承接部分 store 逻辑拆分，说明仓库已经在向分层演进。
- `APP_BREAKPOINTS`、`useResponsive()`、全局样式变量、主题切换机制都已存在，说明多端与主题治理具备进一步收口条件。

但从企业级可维护性与可持续演进角度看，当前主要风险不是“功能缺失”，而是“结构失衡”：

- 大量页面和组件仍直接跨层调用 `store / api / utils / services`，模块边界偏薄。
- `Pinia store` 中仍存在“状态 + 持久化 + 连接编排 + 协议命令 + 运行时同步”混载现象。
- 路由虽然全量懒加载，但共享基础包仍然过大，首屏基础成本偏高。
- `Naive UI` 与 `Arco` 处于混用状态，且混用不是个别遗留点，而是已经进入关键页面。
- 颜色治理虽有 token 基础，但硬编码颜色、`!important`、内联样式和 DOM 直接写样式仍明显偏多。
- PC / 移动端兼容更多依赖页面内媒体查询和局部 `scroll-x` 兜底，尚未形成统一的响应式治理体系。
- 超大体量 `SFC / JS / TS` 文件数量过多，已经进入企业项目常见的维护风险区。

结论：该项目已具备“可运行的中大型前端工程”基础，但距离“可持续治理的企业级前端工程”还有明显差距。最优先的工作不是新增功能，而是统一组件体系、压缩共享基础包、瘦身核心 store、收口样式逃逸、拆分超大文件。

## 二、量化审计快照

### 2.1 工程规模

| 指标 | 当前值 |
| --- | ---: |
| 前端源代码 / 样式文件总数 | 295 |
| `>=300` 行文件数 | 116 |
| `>=500` 行文件数 | 85 |
| `>=800` 行文件数 | 52 |
| `>=1000` 行文件数 | 42 |
| `>=1500` 行文件数 | 21 |
| `>=2000` 行文件数 | 18 |
| `>=3000` 行文件数 | 7 |

### 2.2 路由与首屏加载

| 指标 | 当前值 |
| --- | ---: |
| 路由页面总数 | 33 |
| 懒加载页面数 | 33 |
| 路由懒加载覆盖率 | 100% |
| `vendor-vue` | 724.27 kB |
| `vendor-arco` | 253.77 kB |
| `vendor-arco.css` | 399.57 kB |
| `vendor-misc` | 219.24 kB |
| 构建告警 | 已触发 chunk 过大告警 |

### 2.3 Store / 页面 / 组件边界

| 指标 | 当前值 |
| --- | ---: |
| `view` 文件数 | 37 |
| 直接使用 `store` 的 `view` | 30 |
| 直接导入 `api` 的 `view` | 20 |
| 直接使用 `services` 的 `view` | 5 |
| 直接使用 `utils` 的 `view` | 12 |
| 直接使用 `composables` 的 `view` | 7 |
| `component` 文件数 | 87 |
| 直接使用 `store` 的 `component` | 52 |
| 直接导入 `api` 的 `component` | 4 |
| 直接使用 `services` 的 `component` | 9 |
| 直接使用 `utils` 的 `component` | 35 |
| 直接使用 `composables` 的 `component` | 27 |

### 2.4 UI 组件体系

| 指标 | 当前值 |
| --- | ---: |
| 使用 `Naive UI` 的文件数 | 116 |
| 使用 `Arco` 的文件数 | 11 |
| 同时使用 `Naive UI` 与 `Arco` 的文件数 | 10 |
| `Naive UI` 独占文件数 | 106 |
| `Arco` 独占文件数 | 1 |

### 2.5 样式治理

| 指标 | 当前值 |
| --- | ---: |
| 硬编码颜色（hex）总数 | 1346 |
| 出现硬编码颜色的文件数 | 82 |
| `!important` 总数 | 95 |
| 出现 `!important` 的文件数 | 18 |
| 模板内联样式总数 | 97 |
| DOM `.style.*` 总数 | 255 |
| 存在内联样式或 DOM 直写样式的文件数 | 42 |

### 2.6 响应式兼容

| 指标 | 当前值 |
| --- | ---: |
| `useResponsive()` 调用处 | 10 |
| `scroll-x` 兜底使用处 | 7 |
| 媒体查询总数 | 152 |
| 常见断点媒体查询命中数 | 123 |

## 三、按维度审计结论

### 3.1 架构分层与模块边界

#### 现状

- `docs/project-structure.md` 已将 `src/stores/modules/` 定义为目标标准目录。
- 实际仓库中 `src/stores/modules/` 目前仅有 `README.md`，说明目标结构已声明，但核心状态管理仍未完成模块化迁移。
- 当前页面和组件普遍直接接入 `store`、`api`、`services`、`utils`、`composables`，导致视图层承担了大量编排职责。
- 这类结构在业务迭代前期效率较高，但在中后期会明显放大以下成本：
  - 功能改动时联动面过大。
  - 单点问题难以隔离。
  - 测试与回归验证成本上升。
  - 新人接手需要在单文件中同时理解 UI、状态、协议、权限和异步流程。

#### 判断

- 当前架构不是“完全无分层”，而是处于“分层目标存在、核心链路仍偏扁平”的阶段。
- `services/token/*` 已经是积极信号，但核心 store 与巨型 SFC 尚未完成真正的边界回收。

#### 企业级建议

- 页面层优先只保留：布局、路由态、页面编排、少量用户交互。
- `component` 层优先只保留：展示逻辑、交互事件、有限的本地状态。
- `composables` 承接页面编排与复用流程。
- `services` 承接协议、连接、持久化、远程读写、数据适配。
- `stores` 收敛为：状态容器、计算属性、少量协调动作，不继续承接大段业务流程。

### 3.2 Store 职责是否过重

#### 高风险 store

| 文件 | 行数 | 主要问题 |
| --- | ---: | --- |
| `src/stores/tokenStore.ts` | 1124 | 同时承担状态管理、连接状态、消息发送、数据同步、路由跳转、跨 tab 协调 |
| `src/stores/localTokenManager.js` | 794 | 同时承担迁移、导入导出、清洗、持久化、兼容逻辑 |
| `src/stores/auth.js` | 302 | 同时承担登录态恢复、CSRF、登录注册、MFA、登出与本地清理 |

#### 结论

- `tokenStore.ts` 已超出企业级 store 的合理职责边界。虽然部分能力已经下沉到 `services/token/*`，但当前 store 仍像“运行时总控中心”。
- `localTokenManager.js` 属于典型的“历史兼容 + 安全清洗 + 存储控制”混载文件，适合作为后续拆分对象。
- `auth.js` 风险低于 `tokenStore`，但仍应进一步收缩为“认证状态 + 薄动作层”。

#### 建议

- `tokenStore.ts` 优先拆为：
  - token 基础状态
  - 连接生命周期
  - 游戏命令发送
  - 运行时同步
  - 页面或工作台编排
- `localTokenManager.js` 优先拆为：
  - 导入导出安全清洗
  - 持久化访问层
  - 历史迁移兼容层
- `auth.js` 保留认证状态与少量动作，把细节型网络流程下沉至 `api` / `services`。

### 3.3 首屏性能与懒加载边界

#### 正向结论

- 路由懒加载覆盖率已经做到 `100%`，这点是明显优于许多同规模项目的。

#### 主要风险

- `vite.config.js` 中将 `naive-ui` 并入 `vendor-vue`，导致基础共享包偏大。
- `src/main.js` 全局引入 `@arco-design/web-vue/dist/arco.css`，即使实际 Arco 只在少数页面使用，也会带来全局样式成本。
- `src/router/guards.js` 在首次导航中执行 `authStore.initializeAuth()`，会让首屏用户路径承担额外初始化成本。
- 首页 `Home.vue` 虽然是懒加载页面，但首屏仍会连带消费较重的全局 UI Provider、主题系统和共享 vendor。

#### 企业级判断

- 当前问题不在“有没有懒加载”，而在“共享包划分边界不够精细”。
- 这会带来首屏 JS/CSS 负担偏高、弱网场景波动更大、缓存失效率更高的问题。

#### 建议

- 把 `naive-ui` 从 `vendor-vue` 脱钩，单独成 chunk。
- 评估 Arco 页面是否能收敛到单一迁移批次，避免主入口继续支付 Arco 全局样式成本。
- 将首次导航中的认证恢复优化为“可感知且可降级”的初始化，不让所有公共页面同步等待最重链路。
- 为首页、登录、注册、价格页建立独立 bundle budget。

### 3.4 UI 组件体系是否统一

#### 结论

- 当前不是单一 UI 组件体系。
- 工程主体明显偏向 `Naive UI`，但 `Arco` 仍在关键页面中深用，属于“迁移未收口”的典型状态。

#### 混用重点文件

| 文件 | Naive 命中 | Arco 命中 | 结论 |
| --- | ---: | ---: | --- |
| `src/views/TokenImport/index.vue` | 56 | 10 | 混用严重，且属于关键工作台入口 |
| `src/views/Profile.vue` | 30 | 29 | 双体系并存，迁移边界最不清晰 |
| `src/components/Club/ClubWarrank.vue` | 34 | 1 | 以 Naive 为主但残留 Arco |
| `src/components/TokenManager.vue` | 12 | 1 | 入口组件存在遗留混用 |
| `src/components/Club/ClubBattleRecords.vue` | 10 | 1 | 重型业务组件存在混用痕迹 |
| `src/components/Club/PeachBattleRecords.vue` | 9 | 1 | 重型业务组件存在混用痕迹 |
| `src/views/TokenImport/bin.vue` | 1 | 3 | 以 Arco 为主的旧链路仍在 |
| `src/views/TokenImport/singlebin.vue` | 1 | 3 | 以 Arco 为主的旧链路仍在 |
| `src/views/TokenImport/wxqrcode.vue` | 1 | 2 | 旧导入链路仍依赖 Arco |
| `src/components/Club/PeachInfo.vue` | 1 | 1 | 局部遗留混用 |

#### 企业级建议

- 立即冻结新增 Arco 使用点。
- 将 `TokenImport` 相关页面和 `Profile.vue` 列为 UI 统一第一批改造范围。
- 形成统一规范：
  - 新页面只允许使用主组件库。
  - 遗留组件迁移期间不允许同一页面新增第二套组件。
  - 表单、表格、弹窗、通知、Drawer 的设计语义必须统一。

### 3.5 颜色治理是否收口

#### 正向结论

- `src/assets/styles/variables.scss` 已具备基础 token 雏形，包括主色、辅助色、状态色、中性色、阴影、圆角、间距、字号、深色主题变量。

#### 主要问题

- 设计 token 已存在，但业务页面和大组件仍有大量“绕过 token”的写法。
- `hex`、`!important`、内联样式、DOM 直接写样式同时存在，说明治理尚未进入强约束阶段。

#### 高频硬编码颜色文件

| 文件 | hex 数量 |
| --- | ---: |
| `src/components/Club/ClubBattleRecords.vue` | 114 |
| `src/components/Club/PeachInfo.vue` | 102 |
| `src/components/Club/PeachBattleRecords.vue` | 83 |
| `src/components/Club/ClubInfo.vue` | 81 |
| `src/components/Club/ClubMonthBattleRecords.vue` | 80 |
| `src/components/Setting/RoleProfileCard.vue` | 76 |
| `src/components/Team/TeamStatus.vue` | 64 |
| `src/components/cards/ArenaPvp.vue` | 56 |
| `src/components/Club/LegionWarMap.vue` | 46 |
| `src/components/cards/Unlimitedlineup.vue` | 39 |

#### `!important` 高频文件

| 文件 | `!important` 数量 |
| --- | ---: |
| `src/assets/styles/global.scss` | 29 |
| `src/views/TokenImport/index.vue` | 17 |
| `src/assets/styles/game-workbench-v2.scss` | 9 |
| `src/components/Club/PeachInfo.vue` | 8 |
| `src/views/BatchDailyTasks.vue` | 5 |
| `src/components/Club/PeachBattleRecords.vue` | 4 |
| `src/components/GameStatus.vue` | 4 |

#### 内联样式 / DOM 直接写样式热点

| 文件 | 模板内联样式 | DOM `.style.*` |
| --- | ---: | ---: |
| `src/main.js` | 0 | 119 |
| `src/components/Club/ClubInfo.vue` | 3 | 40 |
| `src/components/Club/ClubBattleRecords.vue` | 7 | 7 |
| `src/components/Club/PeachBattleRecords.vue` | 6 | 7 |
| `src/components/Club/ClubHistoryRecords.vue` | 1 | 12 |
| `src/components/cards/FightPvp.vue` | 2 | 10 |
| `src/components/Task/settings/TaskAdvancedSendCar.vue` | 10 | 0 |
| `src/components/cards/Unlimitedlineup.vue` | 8 | 0 |

#### 企业级判断

- 当前状态属于“已具备 token 能力，但缺乏强制收口机制”。
- 这类项目在继续扩张后，颜色不一致、状态色语义漂移、暗色模式失真、移动端视觉密度失控的风险会持续放大。

### 3.6 PC / 移动端兼容性风险

#### 现状

- `useResponsive()` 只有 `10` 处调用，说明统一响应式能力并未广泛渗透。
- `scroll-x` 作为兜底方案至少出现 `7` 处，典型场景是数据表格和管理台。
- 媒体查询多达 `152` 处，常见断点查询命中 `123` 处，说明大量页面在各自维护响应式规则。

#### 风险判断

- 当前兼容策略更接近“页面自救型响应式”，不是“设计系统型响应式”。
- 对企业级项目来说，这会带来：
  - 同类页面在移动端表现不一致。
  - 表单、列表、表格、侧栏、抽屉的密度标准不统一。
  - 后续新增页面往往继续复制旧模式，而不是复用统一响应式规则。

#### “颜色分别明显、兼容 PC 与移动端”的企业级建议

1. 颜色语义必须分层：
   - 只保留品牌色、辅助色、状态色、中性色四组核心语义。
   - 状态色必须区分 `success / warning / error / info` 的明度和对比度，不允许靠“接近色”混用。
   - 卡片、边框、背景、禁用态必须使用中性色阶，不允许业务组件各自定义“看起来差不多”的灰色。
2. PC 与移动端必须共享同一套 token，而不是两套散落样式：
   - 共享颜色 token。
   - 共享字号、间距、圆角、阴影 token。
   - 只在密度层和布局层做端差异，不在语义颜色层做端差异。
3. 表格到卡片必须有统一退化规则：
   - PC 保持表格。
   - 中屏压缩列与操作区。
   - 移动端自动切卡片或分组列表，不依赖持续加大 `scroll-x`。
4. 固定宽度必须收口：
   - 所有 `min-width`、`max-width`、Drawer 宽度、侧栏宽度进入统一常量或 token。
   - 页面内不再随意写 `280px / 600px / 720px / 1480px` 这类孤立宽度。
5. 响应式策略要从“页面规则”升级为“组件协议”：
   - 表单、详情、数据卡、表格、筛选栏、工具栏各自定义 PC / Tablet / Mobile 的标准布局模式。

### 3.7 大体量 SFC / TS / JS 文件维护风险

#### 超大文件清单

| 文件 | 行数 | 风险判断 |
| --- | ---: | --- |
| `src/components/cards/Unlimitedlineup.vue` | 5760 | 极高，已超出单文件维护上限 |
| `src/views/BatchDailyTasks.vue` | 4164 | 极高，页面编排过重 |
| `src/components/cards/GoldRankListPageCard.vue` | 3400 | 极高，展示、交互、样式耦合重 |
| `src/components/Club/GreatRouteRankListPageCard.vue` | 3302 | 极高，榜单类逻辑过度集中 |
| `src/components/cards/TopClubListPageCard.vue` | 3241 | 极高，榜单类逻辑过度集中 |
| `src/components/cards/FightPvp.vue` | 3141 | 极高，流程和视图耦合重 |
| `src/components/Club/ClubWarrank.vue` | 3064 | 极高，俱乐部复杂视图集中 |
| `src/utils/legionWar.js` | 2973 | 高，工具文件已接近业务核心规模 |
| `src/components/Club/PeachInfo.vue` | 2910 | 高，样式与逻辑负担都重 |
| `src/components/Club/PeachBattleRecords.vue` | 2894 | 高，展示与筛选逻辑高度耦合 |
| `src/components/Club/ClubBattleRecords.vue` | 2832 | 高，颜色和结构都偏重 |
| `src/components/cards/ArenaPvp.vue` | 2799 | 高，组件跨层依赖较多 |
| `src/components/Club/ClubInfo.vue` | 2693 | 高，DOM 样式直写明显 |
| `src/views/TokenImport/index.vue` | 2499 | 高，关键工作区且混用组件库 |

#### 判断

- 当前仓库已经进入“超大文件数量过多”的状态。
- 这类问题不是代码风格问题，而是组织结构问题，会直接影响：
  - 变更风险评估
  - 合并冲突概率
  - 缺陷定位速度
  - 单元测试与回归测试编写难度

## 四、P0 / P1 / P2 整改清单

### P0：立即治理

1. 统一 UI 组件体系，冻结所有新 Arco 入口，明确 Naive UI 为唯一主组件库。
2. 重划共享 chunk，把 `naive-ui` 从 `vendor-vue` 中拆出，降低首页、登录、注册、价格页共享包负担。
3. 建立颜色治理红线，停止新增硬编码 `hex`、`!important`、模板内联样式与 DOM `.style.*`。
4. 对 `src/main.js` 的引导级 DOM 样式写法建立替代策略，避免入口层继续堆积临时视觉逻辑。
5. 为 UI 库使用、样式 token 使用、chunk 大小建立 CI 级治理阈值。

### P1：一阶段结构治理

1. 拆分 `src/stores/tokenStore.ts`，将连接控制、消息派发、同步逻辑进一步下沉。
2. 拆分 `src/stores/localTokenManager.js`，将导入导出、持久化、迁移与清洗解耦。
3. 改造 `src/views/TokenImport/index.vue`，收回组件库混用与页面级过载编排。
4. 改造 `src/views/BatchDailyTasks.vue`，将超大页面拆为页面壳、配置面板、执行面板、结果面板。
5. 改造 `src/components/cards/Unlimitedlineup.vue`，从“巨型总控卡片”切回多个可测试子模块。
6. 把 `component` 直调 `api` 与热点 `store` 的逻辑收回 `composables / services`。

### P2：系统化治理

1. 处理俱乐部 / 榜单类巨型 SFC 的结构与样式债务。
2. 建立统一的表格到卡片响应式退化规则。
3. 为大文件、bundle、样式逃逸建立持续化审计机制。
4. 将本报告沉淀为季度复查模板，形成可重复治理流程。

## 五、最值得优先处理的 10 个文件

| 排名 | 文件 | 原因 |
| --- | --- | --- |
| 1 | `src/views/TokenImport/index.vue` | 关键入口、组件库混用严重、`!important` 多、跨层依赖多 |
| 2 | `src/stores/tokenStore.ts` | 核心状态总控过重，是架构边界问题的核心节点 |
| 3 | `src/components/cards/Unlimitedlineup.vue` | 5760 行巨型 SFC，维护与回归风险极高 |
| 4 | `src/views/BatchDailyTasks.vue` | 4164 行巨型页面，编排与实现耦合 |
| 5 | `src/assets/styles/global.scss` | 全局样式治理核心文件，`!important` 最多 |
| 6 | `vite.config.js` | 共享 chunk 划分与首屏成本的关键控制点 |
| 7 | `src/main.js` | 全局入口引导、Arco CSS、引导级 DOM 样式逻辑集中 |
| 8 | `src/views/Profile.vue` | `Naive UI / Arco` 双轨并存最明显的关键页面 |
| 9 | `src/components/Club/ClubInfo.vue` | 样式逃逸严重，DOM 样式直写多，文件过大 |
| 10 | `src/components/Club/ClubBattleRecords.vue` | 硬编码颜色最多，结构和样式都偏重 |

## 六、哪些地方适合只做样式收口，哪些地方需要架构性拆分

### 6.1 适合只做样式收口

这些文件的主要问题是视觉 token 未收口、局部覆盖过多、表层样式复杂，但暂时不一定需要先做结构重写：

- `src/assets/styles/global.scss`
- `src/assets/styles/game-workbench-v2.scss`
- `src/components/Club/ClubBattleRecords.vue`
- `src/components/Club/PeachInfo.vue`
- `src/components/Club/PeachBattleRecords.vue`
- `src/components/Club/ClubMonthBattleRecords.vue`

建议动作：

- 先替换颜色、边框、阴影、圆角、宽度等散落值。
- 清理 `!important`，统一为 token + 层级规范。
- 将局部样式重构为共享类或共享 section shell。
- 优先解决视觉一致性，不急于一次性重写业务流程。

### 6.2 需要架构性拆分

这些文件的问题不是“样式多”，而是“职责本身已经混载”：

- `src/stores/tokenStore.ts`
- `src/stores/localTokenManager.js`
- `src/views/TokenImport/index.vue`
- `src/views/BatchDailyTasks.vue`
- `src/components/cards/Unlimitedlineup.vue`
- `vite.config.js`

建议动作：

- 先拆职责，再做样式整理。
- 明确子模块边界、数据流和事件流。
- 将网络、存储、协议、连接、编排、展示各自归位。
- 以可测试的中小模块替代当前的“大而全”实现。

## 七、30 / 60 / 90 天整改路线图

### 30 天

- 冻结新增样式逃逸：禁止新增硬编码色值、`!important`、DOM 直写样式。
- 明确 UI 组件库主线：停止新增 Arco 页面。
- 建立 bundle budget：至少覆盖首页、登录、注册、价格页。
- 拆分共享 chunk：优先处理 `naive-ui` 与入口公共依赖。
- 选取 3 个样板页面完成治理试点：
  - `TokenImport/index.vue`
  - `Profile.vue`
  - `AdminUsers.vue` 或 `Home.vue`

### 60 天

- 完成 `tokenStore` 第一轮瘦身。
- 完成 `TokenImport` 第一轮拆分与 UI 统一。
- 完成 `BatchDailyTasks` 第一轮页面壳与业务模块分离。
- 建立统一的 `table / form / card / toolbar / filter` 页面壳组件。
- 建立移动端表格退化协议，不再默认依赖 `scroll-x`。

### 90 天

- 完成排行榜 / 俱乐部 / lineup 大 SFC 模块化拆分。
- 将颜色、间距、宽度、阴影、字体全部纳入设计 token。
- 建立 file size budget、bundle budget、样式预算三类常态治理规则。
- 将本审计文档沉淀为季度复查模板，并纳入版本治理节奏。

## 八、我建议最先动的前 5 项

1. 组件体系统一：冻结新增 Arco，明确单一主组件库。
2. 共享 chunk 拆分：先把 `naive-ui` 从 `vendor-vue` 脱钩，并评估 Arco 全局样式成本。
3. Store 职责瘦身：先拆 `tokenStore.ts`，再拆 `localTokenManager.js`。
4. 颜色治理红线：建立 token 约束，停止新增 `hex / !important / inline style / DOM style`。
5. 超大 SFC 拆分：优先处理 `Unlimitedlineup.vue`、`BatchDailyTasks.vue`、`TokenImport/index.vue`。

## 九、附录：重点量化清单

### 9.1 最大文件清单（节选）

| 文件 | 行数 |
| --- | ---: |
| `src/components/cards/Unlimitedlineup.vue` | 5760 |
| `src/views/BatchDailyTasks.vue` | 4164 |
| `src/components/cards/GoldRankListPageCard.vue` | 3400 |
| `src/components/Club/GreatRouteRankListPageCard.vue` | 3302 |
| `src/components/cards/TopClubListPageCard.vue` | 3241 |
| `src/components/cards/FightPvp.vue` | 3141 |
| `src/components/Club/ClubWarrank.vue` | 3064 |
| `src/utils/legionWar.js` | 2973 |
| `src/components/Club/PeachInfo.vue` | 2910 |
| `src/components/Club/PeachBattleRecords.vue` | 2894 |

### 9.2 Store 文件体量

| 文件 | 行数 |
| --- | ---: |
| `src/stores/tokenStore.ts` | 1124 |
| `src/stores/localTokenManager.js` | 794 |
| `src/stores/auth.js` | 302 |
| `src/stores/legionWarStore.js` | 255 |
| `src/stores/changelogStore.js` | 254 |

### 9.3 组件库使用概况

| 文件 | Naive 命中 | Arco 命中 |
| --- | ---: | ---: |
| `src/views/BatchDailyTasks.vue` | 264 | 0 |
| `src/views/TokenImport/index.vue` | 56 | 10 |
| `src/views/Profile.vue` | 30 | 29 |
| `src/components/Test/MessageTester.vue` | 51 | 0 |
| `src/components/Daily/DailyTaskStatus.vue` | 48 | 0 |
| `src/components/cards/FightPvp.vue` | 42 | 0 |
| `src/components/cards/GoldRankListPageCard.vue` | 36 | 0 |
| `src/components/Club/ClubWarrank.vue` | 34 | 1 |

### 9.4 直接导入 `api` 的组件 / 页面热点

- 页面：
  - `src/views/AdminUsers.vue`
  - `src/views/AdminActivationCodes.vue`
  - `src/views/Profile.vue`
  - `src/views/DailyTasks.vue`
  - `src/views/TokenImport/index.vue`
- 组件：
  - `src/components/cards/ArenaPvp.vue`
  - `src/components/cards/FightPvp.vue`
  - `src/components/cards/TenHallTeamBattleCard.vue`
  - `src/components/cards/Unlimitedlineup.vue`

## 十、最终判断

如果只从“能否继续开发功能”看，当前项目没有立即阻断性问题；但如果从“是否符合企业级前端工程的长期治理标准”看，当前最主要的风险已经不是单点 bug，而是：

- 共享基础包偏大；
- UI 体系未完全统一；
- 核心 store 与关键页面职责过重；
- 颜色和样式治理缺乏硬约束；
- 多端兼容策略尚未平台化；
- 超大文件数量已经超过舒适维护区。

因此，最合理的治理路径不是一次性大重构，而是：

- 先立规矩；
- 再拆入口；
- 再收样式；
- 最后拆巨型模块。

这条路径对当前仓库最稳，也最符合企业项目“可持续治理、不中断业务”的节奏。
