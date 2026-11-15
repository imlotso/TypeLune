# TypeLune 验收记录（进行中）

本记录不代表发布验收通过。基线 PR #8 head 为 `1903c3fefeda182e1fccb81182fd1ef41c87e8eb`；该提交的 GitHub Actions application/browser、Docker smoke 和 Vercel Preview 状态成功。此前文档中的 TypeFlow 是旧品牌，不应视为当前品牌决定。

## 本机

- 工作树在上述基线上修改了品牌文字；已接入用户提供的 TypeLune 黑色衬线字标原图，并将其用于 favicon；品牌及最终验收仍未完成。
- `npx vitest run tests/share-card.test.ts tests/smtp-wire.test.ts tests/share-card-ui.test.tsx`：3 个文件、5 项通过；`npm run typecheck` 和 `npm run build` 通过。清理、导航及站点信息的定向浏览器套件 21 项通过，另一个无 Navigation API 前进用例单独通过；相关单元测试 5 个文件、11 项通过。构建有大于 500 kB 的包体提示。
- `npx playwright test e2e/site-info.e2e.ts` 首次使用旧 dist 失败；重新构建后 1 项通过。该结果不等于完整视觉验收；另以本地 Chromium 截图检查桌面及手机的日夜练习首页，字标可见、夜间无水平溢出，未覆盖所有页面及流程。
- 清理时最后一次读取与 IndexedDB 删除现在在同一读写事务中核对；若账号工作区发生变化，退出后保留数据并提示重新登录同步或导出。该保护仅覆盖当前退出清理流程的 IndexedDB 窗口；极旧标签页仍可在清理完成后写入，且旧生产代码会将多账号历史存入同一 localStorage 数组并截取前 50 条。新客户端按 owner 读取不能约束已加载旧代码，也不能保证其他账号历史或未保存内容不丢失，仍是上线阻塞项。
- 不支持 Navigation API 且目标条目没有应用序号时，保存失败不再覆盖该历史条目；当前练习和输入留在内存，但地址暂时指向历史目标，刷新或关闭页面仍有未保存数据丢失风险。已在 Chromium 中模拟缺少 Navigation API，覆盖未标记前进、后退及恢复后的历史往返；其他浏览器仍需验证。
- G01–G04 继续后置。

## Preview 与隔离迁移

- 此前 Preview 使用独立 Neon schema 的合并初始化；虚构游客榜单检查和本机 SMTP 投递证据见 [Vercel／Neon 记录](2026-11-15-vercel-neon-upgrade.md)及[邮件记录](2026-11-15-smtp-validation.md)。它们不证明 Neon 原始 1→2 迁移或 Vercel 到 SMTP 的真实投递。
- 只读确认隔离目标为 Neon 项目 `dazi-preview`、分支 `preview`、数据库 `dazi_preview`、schema `typing_upgrade_migrate_ci_20261115`；其中用户、会话、工作区条目、SMTP 配置各 1 条。用户确认后，以插件事务执行仓库原始 schema 2 的 32 条 SQL，含约束替换和版本校验和登记。用户、会话、工作区旧字段及 SMTP 配置的迁移前后摘要一致。原整段 SQL 因插件预处理限制失败，版本仍为 1；拆分后事务成功。反馈类型可通过约束、无效类型遭拒且事务回滚未留测试行。本机直连 Neon 首次 `ETIMEDOUT`；使用已配置的 HTTP 代理后，实际 `migratePostgres` 入口对版本 2 重复执行成功，复核版本及四组摘要保持不变。以错误目标调用实际入口时被拒绝并回滚。使用 Preview 分支 11:35 UTC 的隔离快照 `snap-morning-salad-aom78e48` 恢复到新分支 `typelune-test-v1-restore-20261115`；恢复后为版本 1，四组旧数据摘要均与迁移前一致。这是测试库恢复，不是生产备份。尚未验证迁移中途断连的所有结果，不可扩大为全部故障场景均已通过。

- 该 PR 分支原有 Preview 的 SMTP_HOST 和 SMTP_FROM 为空；现已仅为该 Preview 分支配置 SMTP 并重新部署旧 head `1903c3f`（部署 `dpl_34bhg4uTAqU6yT5v1Lm1s3ioAWzW`）。2026-11-15 12:36 UTC，隔离 Preview 的验证码接口返回 200，指定 Outlook 邮箱实际收到邮件，From 域名为 `imlotso.com`；主题仍为旧版 TypeFlow。邮箱连接器未提供原始认证头，SPF/DKIM 及最终提交的 TypeLune 邮件尚未验证。临时 Preview 访问链接已撤销。首次尝试的短期链接令牌意外出现在工具输出后已立即撤销。

## 生产

- Vercel 只读检查显示 `typing.imlotso.com` 在 `dazi` 项目中已验证，当前生产部署为 `06a9e5139abd8dc43d107649b468f5e992021fea`；Neon `dazi-production` 的 `production` 分支及 `dazi_production.public` 经只读核对仍为 schema 1；Vercel 生产环境存在数据库连接和 `CODE_SECRET` 配置项，但当前部署与原密钥的关联尚未核实。切换方案见[生产切换准备](2026-11-15-production-cutover.md)。
- 尚未核实所有写入入口和停写效果，尚未创建或验证本次生产备份，未演练本次回滚，未运行生产迁移或部署，也未核验线上新版本。生产写入开始后不得直接用旧快照覆盖新数据。
- 最终提交、最终 CI、最终提交的 Preview 邮件及来源认证、登录／同步／榜单和完整桌面手机显示均待完成。不得以此前 CI 或本机邮件成功替代这些验收。

## 后续验证（2026-11-15）

- PR 代码提交 `208d9a71d4e1efc924cc1c589d6d191fdaaf362c` 的 GitHub Actions 应用／浏览器测试和 Docker 冒烟均通过；该提交的 Vercel Preview 状态通过。验收记录若有后续提交，仍须检查最终 head 的 CI。
- 同一提交的受保护 Preview 在桌面和手机加载所选字标，手机未观察到水平溢出。验证码请求返回 200，指定 Outlook 收到主题为 TypeLune 的邮件，发件地址域名为 `imlotso.com`；连接器不提供认证头，SPF／DKIM 未核验。
- Preview 的游客成绩提交显示待复核且未显示在公开榜单；但该操作未在预期的测试 schema 查询到对应新记录，故运行时数据库归属尚未确认，已停止进一步 Preview 写入。为虚构账号写入预期测试 schema 后，Preview 登录返回 401；不能判定登录或同步通过，也不能排除测试账号位于错误数据库。
- 新增的 IndexedDB 清理竞态和旧浏览器历史前进、后退用例已通过定向测试。清理后极旧标签页对共享历史的写入仍无法完全约束，不能保证其不会挤掉其他账号的本机记录。
- Neon 生产分支已创建并列出停写前参考快照 `snap-polished-unit-aox33o7k`；这不是停写后的切换备份，尚未验证生产写入全部停止，也未以生产用户数据演练恢复。虚构资料的独立测试快照恢复已验证。线上仍是旧部署，未进行生产迁移或切换。
