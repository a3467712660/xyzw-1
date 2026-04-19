# Android UI Parity Notes

本文件记录 Android V2.3 第二阶段中未做 Web 组件 1:1 复刻的点。Android 侧保持原生 Compose + Material3，不使用 WebView、Capacitor、Cordova，也不嵌套 Vue 页面。

| Web 组件/能力 | 未 1:1 复刻原因 | Android 替代方式 | 后续优先级 |
| --- | --- | --- | --- |
| 军团战 Web canvas 地图 | Web 端依赖 canvas 绘制、点击定位和浏览器 resize 链路，直接复刻会引入 Web runtime 依赖。 | 使用 Compose Canvas 绘制原生节点、路线、图例和据点列表；点击级地图工具暂不迁移。 | P1 |
| 浏览器 replay/runtime | 回放运行依赖浏览器游戏运行时和渲染探针，Android 不运行浏览器 runtime。 | 后端生成渲染图、摘要和诊断，Android 展示结构化结果和图片。 | P1 |
| 阵容拖拽换位和 Vue modal 细节 | Web 端使用 DOM drag/drop、多弹层和前端实时缓存，移动端精确复刻会降低原生可操作性。 | 使用阵容槽位棋盘、保存方案卡、导入导出面板和阶段调试面板；应用仍走后端 allowlist 编排。 | P2 |
| WebSocket 直接前端命令面板 | Android 不直接暴露 token、cookie、seed、signature，也不直接连接外部游戏 WebSocket。 | Android 只传 tokenId、section/card/action 和必要 payload，由后端受控执行。 | P0 保持 |
| 战报复杂表格密度 | Web 表格在桌面宽屏可承载多列，移动端完整复刻会造成横向滚动和触控问题。 | 使用盐场、蟠桃、军团战专属卡片 + 列表详情，保留日期选择、空态和错误态。 | P2 |
| 装备精炼完整明细 | 当前后端阵容 DTO 只稳定返回 hero、artifact、pearl 等轻字段。 | 展示鱼灵/鱼珠摘要，并明确显示“后端未返回装备详情”。 | P1 |

