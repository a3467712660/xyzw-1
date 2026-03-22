# test (legacy scripts)

`test/` 目前是历史手动脚本测试目录。

- 不是自动化测试主入口。
- 历史脚本可通过根目录脚本命令触发：
  - `npm run test:legacy:role-token`
  - `npm run test:legacy:token`

自动化测试主入口目前在 `backend`：`npm --prefix backend test`。
