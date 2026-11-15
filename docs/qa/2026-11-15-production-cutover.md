# TypeFlow 生产切换准备

目标是现有 Vercel `dazi` 项目的 `typing.imlotso.com`，以及 Neon `dazi-production` 项目的 `production` 分支、`dazi_production` 数据库 `public` schema。只读核对显示当前生产数据库为 schema 1，校验和与代码中的旧版完全一致。不得将空的预览 schema 指向生产域名。

## 切换前检查

1. 远程 CI、受保护 Preview 及 SMTP 实际送达均完成后，核对本次待部署提交、项目、域名、生产数据库端点和原 `CODE_SECRET`。预览使用独立 Neon schema，SMTP 已禁用；不要把预览连接串或预览密钥用于生产。
2. 本机隔离 PostgreSQL 18.6 已完成 v1→v2 迁移及同版本 `pg_dump`／`pg_restore` 恢复演练；Neon 生产为 18.7，本机直连端点超时。远端预览使用等价合并基线，另已准备仅含虚构数据的 `typing_upgrade_migrate_ci_20261115` 旧版测试 schema；尚未在那里执行原始迁移。
3. 维护部署设置 `DAZI_MAINTENANCE=true`，使 API 在访问数据库前返回 503；确认生产域名收到维护响应，至少等待旧函数的 60 秒最长执行时间结束，并检查没有其他应用、旧部署或直连写入方。该开关不是数据库层面的全局写锁；无法确认停止写入时不得继续。
4. 停写后对生产 Neon 分支创建可恢复快照并核验状态；快照仅作备份，不用于测试生产用户资料。保留原生产连接信息和 `CODE_SECRET`，并确认回退期间不会丢失维护窗口外的新写入。

## 数据库与发布

- 在已确认的生产库上以事务执行 [schema 2](../../server/postgres/schema.ts)；事务内复核数据库、schema、旧版本和校验和，先取得迁移锁。迁移扩展用户资料、会话、反馈和同步结构，其中替换 `admin_audit` 检查约束以允许反馈审计；不得绕过插件对破坏性 SQL 的操作确认。失败或连接中断时先只读核对版本与提交状态，不盲目重试。
- 生产 SMTP 配置使用用户提供的 Lark 服务；现有生产未发现后台 SMTP 覆盖。只更新本项目生产 SMTP 环境变量，保留 `DATABASE_URL` 和原 `CODE_SECRET`，不输出或提交凭据。配置变更只在后续部署生效。
- 将 `DAZI_MAINTENANCE` 改回 `false`，部署已验证提交；只读检查健康、公开文章、榜单和页面，不创建生产测试用户或成绩。按需再次执行仅限 `typing.imlotso.com` 的 Cloudflare 主机名清理；该域名当前未代理，Vercel 缓存独立于 Cloudflare。

## 回退边界

旧生产函数只接受 schema 1，不能直接连接升级后的 schema 2。迁移失败时保持维护状态，检查快照和数据库事务结果；如必须恢复，使用备份创建独立恢复分支，确认数据与原密钥后再切换数据库连接及旧部署。新版本一旦重新接受生产写入，不得直接回退到旧快照覆盖这些写入；先冻结并制定数据保留或迁移方案。
