# 账号界面语言设置验收（2026-11-16）

隔离分支 `dot/typelune-lessons`，基于 `256d03c`。仅本地开发、一次性测试账号及临时数据库；没有推送、触发 Actions、合并 main 或部署生产。

## 行为与兼容

- 账号设置、练习设置提供 `自动（浏览器语言）`、`中文`、`English`；右上切换共用同一状态。
- 游客沿用本浏览器的独立语言键；登录后只使用当前账号的 workspace 偏好，退出恢复游客选择。
- `ReaderSettings.uiLocale?: 'auto' | 'zh' | 'en'` 是可选字段。无偏好时遵循浏览器，不自动创建/上传默认设置；不需要数据库迁移。
- 只有用户明确操作才局部更新既有设置。首次云读取未完成且没有该账号缓存时禁写；已有缓存可离线保存并重试。版本/代次冲突继续走已有恢复流程，不静默覆盖另一设备的设置。
- 账号设置显示真实同步状态；本地持久化失败显示未保存，网络失败不冒称已同步。后台与前台预览使用同一账号偏好。
- 切换界面语言不改变练习语言、不重建输入或当前练习。便携练习预设仍不携带界面语言。
- 前后端均拒绝非法枚举；旧客户端未提供该字段时保留已有偏好。没有新增公开数据或管理权限。

## 已完成验证

| 验证 | 结果 |
| --- | --- |
| Node 24 + 真实 SQLite / PostgreSQL 18.7，完整 Vitest | 145 文件，704 测试通过，0 跳过，退出 0 |
| 语言组件/校验最新定向复跑 | 2 文件，15 测试通过，退出 0 |
| 真实 SQLite / PG 语言 API 跨实例、隔离、冲突、旧客户端兼容 | 新增 9 项，已包含在完整套件中 |
| 独立 Node 22 + PostgreSQL / Vercel handler 语言专项 | 5 项通过；仅按名称筛选 PG，非跳过失败用例 |
| 新增真实 Chrome 语言流程 | 7 项通过，21.0 秒，正常退出 0 |
| TypeScript、完整 Vite/Sites/server 构建、Sites 测试 | 类型和构建退出 0；Sites 4 项通过；保留既有大 chunk 警告 |
| 全量 Chrome 最终顺序回归 | 137 项通过，5.1 分钟，正常退出 0（含测试服务清理） |

语言浏览器场景包括：两个独立浏览器上下文读写同一账号、自动跟随英文浏览器且零自动写入、活跃输入不丢失、慢云读取不覆盖、缓存离线修改/刷新/重试、竞争版本冲突拒绝覆盖、无缓存首读失败禁写、延迟旧账号响应隔离、退出恢复游客偏好，以及管理员前后台/刷新保持偏好。桌面 1280px 与手机 390px 均实际运行。

复现命令（仅对一次性 loopback 数据库设置测试环境变量，不打印口令）：

```powershell
node node_modules/vitest/vitest.mjs run --exclude tests/sites-worker.test.mjs --maxWorkers=2
node node_modules/typescript/bin/tsc --noEmit
npm run build
node --test tests/sites-worker.test.mjs
$env:PLAYWRIGHT_USE_SYSTEM_CHROME='1'
$env:E2E_PORT='4186'
node scripts/verify-browser-local.mjs e2e/account-locale.e2e.ts
node scripts/verify-browser-local.mjs
```

## 发现与处理

1. 独立审查发现乐观状态可能遮住同账号较新同步值。新增“本次写入通知后又收到较新值，最后 Promise 才完成”的失败复现；修复为持久化写入完成后释放乐观覆盖，以实际 workspace 为准。测试已通过，不再等待恰好观察到相等。
2. 实际截图发现英文导航与长昵称在 1280px 桌面越界，账号按钮右边达到 1375.2px。导航允许换行，并新增精确边界断言，重拍后通过。
3. 最初 3 个新浏览器用例使用 `getByLabel(..., exact:true)` 匹配包裹 select 的完整 label 文本失败。快照中的可访问名称正确，改用精确 `combobox` 角色及名称，值、禁用、同步和隔离断言均保留。
4. 接入真实账号 Provider 后，旧 jsdom 用例默认英文浏览器与其中文断言不一致。新增明确的中文测试浏览器 fixture，语言测试自行覆盖。旧测评账号用例明确设为 `en-US`，而不是错误依赖游客语言键。未删测试或放宽功能断言。
5. 新管理员测试首次误以为刷新会保留前台预览；既有产品规则要求恢复会话进入独立后台。现在明确断言后台仍为英文，再通过“预览网站”进入账号设置核对同一偏好，没有改变管理员路由规则。
6. 首次完整 Chrome 为 135 通过、1 失败：同时启动的布局红灯 runner 共用输出目录，导致另一 runner 关闭 context 时找不到 trace（`ENOENT`）。这是测试编排错误，不是功能断言通过，也没有删改该历史删除用例。最终改为单个 runner 顺序执行，137 项全部通过并正常退出，保留原失败日志。
7. Docker 独立实测发现 PostgreSQL 初始化临时进程可提前通过本地 socket 的 `pg_isready`。Compose 健康检查改为显式 TCP `-h 127.0.0.1`，防止初始化未结束就启动依赖服务；其容器实测结果单独记录。

独立只读复审确认：workspace 持久化操作先更新缓存和同步通知，再完成 Promise，修复后的乐观状态释放时序成立；账号/游客、初次加载门控及同步失败状态未发现新增阻塞。

## 截图与部署边界

真实截图位于 `docs/qa/screenshots/2026-11-16-account-language/`，四张已分别保存至 Library：中文/英文账号设置、手机英文账号设置、英文练习设置。画面中的账号均为一次性 `example.test` 测试账号。原有课程/后台截图保留，未删除用户数据。

Vercel + PostgreSQL 的 handler 路径和 SQLite 兼容已实际测试。Docker + PostgreSQL 18 的真实容器验证由独立运行记录管理：不得把宿主 Node HTTP 或 SQLite 结果当作容器结果；需以该记录明确的候选提交为准。新增语言偏好本身不要求 schema 迁移。生产必须等待用户看图后的明确同意。

## 发布前 PostgreSQL 浏览器预检

用户查看截图后已明确批准生产发布，实际发布结果另行核验。发布前检查发现 PG 浏览器测试启动器只安装核心 schema，遗漏显式安装可选 `support_settings`。已在 loopback 临时库复现后台支持设置无法加载的失败，然后仅在唯一隔离测试 schema 中补装扩展；没有改为生产冷启动自动迁移。

真实 PG18.7 的语言与支持入口浏览器专项 8 项通过，24.1 秒、正常退出 0。较慢的 PG 初始化还暴露新语言测试在账号会话未恢复时操作游客菜单的竞态；测试现明确等待预期账号入口出现再操作，保留全部同步/持久化/冲突断言，没有增加超时或删测。实际应用代码仍为已完成 Docker 验证的 `788982a`；后续差异仅测试夹具和验证文档。

最终 Docker + PG18.7 与 SQLite 容器测试均已完成，详见 [Docker 实机记录](2026-11-16-docker-runtime.md)。

## Release gate: Node 22 ESM

The first remote release CI run (`43789452323`) passed all 704 unit/integration tests, both complete 137-case Chromium runs (SQLite and PostgreSQL), and the Docker smoke test. Its final Node 22 ESM gate correctly rejected the new inline type import in `models.ts` with TS2835: NodeNext requires an explicit `.js` extension. This is a real compatibility defect, not an environment exemption.

Reproduced the same failure locally with Node 22.23.5 before changing the single type-only path to `./ui-locale.js`, consistent with the existing shared-model imports. The unchanged `verify-vercel-esm.mjs` then compiled and imported the emitted Function successfully, both with and without experimental require-module support. Typecheck and production build also passed. No checks, compiler settings, or assertions were loosened. The release must wait for the corrected commit's complete remote CI run.