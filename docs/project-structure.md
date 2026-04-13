# Project Structure

本文档用于回答两个问题：
1. 每个目录负责什么。
2. 新人第一次接手应该从哪里下手。

## 新人接手顺序（建议）

1. 先看 [README.md](../README.md)：了解项目运行方式与命令入口。
2. 再看 [startup.md](./startup.md)：按全新机器流程完成本地启动。
3. 再看 [architecture.md](./architecture.md)：理解当前主链路（`Vite -> backend`）。
4. 最后按你的任务类型进入对应目录（前端在 `src/`，后端在 `backend/src/`）。

## 根目录角色说明

- `backend/`
  - 当前正式后端主线（Node.js + Express + WebSocket）。
  - 所有生产 API 主逻辑应优先落在这里。

- `server/`
  - 历史 Flask 兼容服务。
  - 用途：兼容旧 Token URL/BIN 流程或历史排障。
  - 状态：非默认开发链路，默认不启动。

- `source/`
  - 历史源码样本与逆向参考材料（例如大体量 JS 文件）。
  - 状态：不参与当前构建/发布流程。
  - 约束：不要在这里新增业务主代码。

- `test/`
  - 历史脚本测试目录（手动触发脚本）。
  - 状态：不是自动化测试主入口。
  - 说明：当前仓库自动化测试主入口是 `backend` 内的 `npm --prefix backend test`（Node test runner）。

- `src/`
  - 前端主工程目录（Vue + Vite）。

- `docs/`
  - 项目文档统一目录。

- `docs/archive/`
  - 历史或一次性迁移文档归档区。

## 标准目录约定

已统一为以下目录骨架：

- `backend/src/modules/`
  - 后端按业务域拆模块（推荐新功能优先放此处）。

- `backend/src/services/taskControlScheduler/`
  - 任务控制调度的局部 helper 目录。
  - 放 Cron 判定、日志脱敏、网络重试分类等调度专用纯工具；`taskControlSchedulerService.js` 继续保留为入口 facade。

- `src/router/modules/`
  - 前端路由按领域拆分。

- `src/stores/modules/`
  - 前端状态按领域拆分。

- `src/views/batch-daily-tasks/`
  - 批量日常任务页的局部页面块与排序 helper。
  - 用于承接页面壳、账号选择区等视图层拆分，避免主页面文件继续堆积。

## 命名统一约定

- 项目名：`XYZW Web Helper`
- 根目录包名：`xyzw-web-helper`
- 后端包名：`xyzw-web-helper-backend`
- 文档命名：统一放在 `docs/`，使用小写 kebab-case（例如 `auth-flow.md`）。
- 历史脚本命名：使用语义化脚本名（例如 `test:legacy:*`）。

## 当前阶段边界

- 主链路：`src/ + backend/`
- 兼容链路：`server/`
- 参考材料：`source/`
- 历史脚本测试：`test/`

如果后续决定彻底下线兼容链路，可以按里程碑将 `server/`、`source/`、`test/` 再拆分到独立归档仓库。
