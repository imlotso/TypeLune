# Docker + PostgreSQL 18 自托管

这是与 [Vercel + PostgreSQL / Neon](vercel-neon.md)并行的路线，不是把 Vercel 替换为 Docker，也不删除原 SQLite 兼容路线。使用仓库根目录的 `compose.postgres.yaml`；不带 `-f` 的 `docker compose` 仍使用 SQLite。

**本轮状态：隔离容器实测已完成。** 候选 `788982a` 在独立临时环境中通过真实 Docker/Compose + PostgreSQL 18.7、Caddy HTTP、容器替换持久化及新卷备份恢复；详见[实机记录](qa/2026-11-16-docker-runtime.md)。本文是安全操作指南，不表示每一条示例命令已原样执行，更不代表公网 TLS、真实邮件或生产迁移已验证。生产上线仍须明确批准。

## 文件、版本和持久卷

| 文件 / 服务 | 作用 |
| --- | --- |
| `compose.postgres.yaml` | `postgres`、`app`、`caddy` 与显式 `db-init` 操作器 |
| `postgres:18.7` | 本候选固定的官方 PostgreSQL 18 镜像，不使用 19 预览版；PostgreSQL 不称为 LTS |
| `postgres_data:/var/lib/postgresql` | 数据库持久卷，默认实际名称带 Compose 项目前缀 |
| `caddy_data` / `caddy_config` | HTTPS 证书及代理配置持久卷，不是数据库备份 |
| `Dockerfile` | 沿用 Node 26 镜像，包含 `scripts/postgres-database.mjs` 操作器及 support/SEO SQL；Vercel 继续用 Node 22 |
| `server/postgres/seo-settings.sql` | 独立、可选的 SEO 配置表；显式安装，不改既有运行设置或迁移校验值 |
| `server/postgres/support-settings.sql` | 独立、可选的二维码配置表，不修改既有 schema 1/2 校验值 |

官方 PostgreSQL 18 镜像的卷挂载点为 `/var/lib/postgresql`，默认 `PGDATA` 为 `/var/lib/postgresql/18/docker`，与 17 及更早镜像不同。不要直接套用旧镜像的挂载目录。[官方镜像说明](https://hub.docker.com/_/postgres)

数据库没有发布宿主机端口，应用通过内部 `postgres:5432` 访问；只有 Caddy 发布 80/443。应用容器不保存数据库。固定 Compose 项目名与配置文件，重建应用不得换成一个意外的新项目/卷。普通重启或升级不要使用 `down -v`、删除卷或 `volume prune`。

## 私密配置与目标确认

以下示例使用 **Bash**，在仓库根目录执行。先准备 Docker Engine / Compose，核对当前 Docker context/引擎确实是选定的隔离机器，再选择与已有 SQLite 项目不同的项目名。本文不会自动切换 Docker context。不要在本机预览阶段启动面向公网的 Caddy。

使用私密编辑器填写 `.env.postgres`，限制文件权限，不提交、不截图、不输出整个文件。该文件已被 Git 和 Docker 构建上下文忽略。以下字段故意留空，不提供可用于生产的默认口令或密钥：

```dotenv
POSTGRES_PASSWORD=
DATABASE_URL=
CODE_SECRET=
SITE_DOMAIN=
```

- `POSTGRES_PASSWORD`：独立生成的高强度随机值，建议使用十六进制以避免 URL 转义错误。
- `DATABASE_URL`：`postgresql://typelune:<同一个数据库密码>@postgres:5432/typelune`。用户名、数据库名和主机与本 Compose 固定值匹配；不要粘贴到日志或命令参数。
- `CODE_SECRET`：至少 32 字符的另一独立随机值。新安装使用新值；恢复或迁入已有数据必须安全保留原值，否则已保存的 SMTP 密码不能解密。
- `SITE_DOMAIN`：未来获批公开服务的域名；隔离演练使用独立测试值，不修改生产 DNS。
- SMTP、管理员邮箱和公开 `VITE_*` 站点信息按需配置。`VITE_*` 会进入前端，绝不能填入密钥。

```bash
set -euo pipefail
chmod 600 .env.postgres
PG_PROJECT=typelune-pg
private_compose() {
  env -u DATABASE_URL -u POSTGRES_PASSWORD -u CODE_SECRET \
    -u SMTP_HOST -u SMTP_PORT -u SMTP_SECURE -u SMTP_USER -u SMTP_PASSWORD -u SMTP_FROM \
    -u ADMIN_EMAIL -u SITE_DOMAIN -u COMPOSE_PROFILES -u COMPOSE_ENV_FILES \
    -u VITE_SITE_OPERATOR -u VITE_SITE_CONTACT_EMAIL -u VITE_PRIVACY_VERSION \
    -u VITE_PRIVACY_EFFECTIVE_DATE -u VITE_TERMS_VERSION -u VITE_TERMS_EFFECTIVE_DATE \
    docker compose "$@"
}
pgc() {
  private_compose --project-name "$PG_PROJECT" --env-file .env.postgres \
    -f compose.postgres.yaml "$@"
}
pgc config --quiet
```

`--env-file` **不能覆盖宿主已导出的同名变量**。因此 `pgc` 和下方 `pgr` 都必须经 `private_compose`：它仅在子进程中清除本 Compose 使用的连接串、密钥、SMTP 及构建变量，再从指定私密文件取值，不修改当前 shell 或生产配置。不得跳过这个包装直接运行恢复应用，避免把之前导出的生产连接串带入演练。环境文件应填写完整字面值，不引用其他会话变量。[Compose 变量优先级](https://docs.docker.com/compose/how-tos/environment-variables/variable-interpolation/)

这里只用 `config --quiet`，避免完整 Compose 输出展开密码。已存在的数据库不会因修改 `POSTGRES_PASSWORD` 环境变量而自动改密；凭据轮换需要单独规划，不能通过删除卷“修复”。官方镜像默认初始化的 `typelune` 角色具有超级用户权限，本配置不是最小权限安全加固的完成证明；正式部署前应另行验收运行角色、运维权限和备份访问控制。[官方镜像变量说明](https://hub.docker.com/_/postgres)

## 首次初始化与已有站点升级

**仅用于已经确认的全新空安装**：

```bash
pgc --profile setup build app db-init
pgc up -d --wait postgres
pgc exec -T postgres pg_isready -U typelune -d typelune
pgc --profile setup run --rm db-init
```

`db-init` 按顺序显式运行 `migrate`、`support`、`seo`、`seed`。操作器核对主机、数据库与 schema，确认目标为 `postgres/typelune/public`；应用启动不静默迁移 PostgreSQL。`seed` 只允许空文章库，所以**整个 `db-init` 不是可以在已有站点反复执行的升级命令**。初始化中断后先检查实际状态，不删除数据、不盲目重试种子步骤。

如需导入旧 SQLite 数据，应在迁移及 support/SEO 建表后使用 `import` 操作，而不是先 `seed`；保持目标无应用写入，包括健康检查。导入要求目标为空，旧源没有 support 表也不能覆盖目标已有的支持配置。目标检查与回滚细节见 [PostgreSQL 操作说明](vercel-neon.md)。

已有 PostgreSQL 站点升级本轮支持入口时，先按下节备份并验证恢复，再在批准的维护范围单独执行：

```bash
pgc --profile setup build app db-init
pgc --profile setup run --rm db-init node scripts/postgres-database.mjs support
pgc --profile setup run --rm db-init node scripts/postgres-database.mjs seo
```

`support` 只做独立表的 `CREATE TABLE IF NOT EXISTS`，可重复执行；不清空设置、不改旧迁移校验值。若尚未安装，公开支持入口隐藏，后台支持设置返回 503，其余功能继续可用。`migrate` 只在版本确实需要且已核验目标时单独执行，已有数据不要运行 `seed`。

`seo` 显式添加独立的 `seo_settings` 表，不向旧 `site_settings` JSON 添加字段。可重复执行，安装后刷新后台 SEO 栏目即可使用；未安装时网站继续使用公开部署默认值，后台写入返回 `503 / SEO_STORAGE_NOT_READY`，应用启动不自动建 PostgreSQL 表。通过后台配置正式域名、双语元数据、Logo/favicon/分享图、索引与 sitemap；首次安装前的 canonical 域名可由构建参数 `VITE_SITE_URL` 提供。旧应用可以保留并忽略独立表，避免回滚破坏运行设置。

需要首位管理员时，使用同一个 PostgreSQL 操作器；密码走标准输入，命令拒绝覆盖已有账号或已有管理员：

```bash
read -r -p '首位管理员用户名: ' ADMIN_USERNAME
read -r -p '首位管理员邮箱: ' ADMIN_EMAIL
read -r -s -p '首位管理员密码: ' admin_password; printf '\n'
printf '%s\n' "$admin_password" | pgc --profile setup run --rm -T \
  -e "ADMIN_USERNAME=$ADMIN_USERNAME" -e "ADMIN_EMAIL=$ADMIN_EMAIL" \
  db-init node scripts/postgres-database.mjs bootstrap
unset admin_password
```

完成隔离验收、确认域名和上线授权后才启动公开入口：`pgc up -d app caddy`。不要使用 README 中的 SQLite `bootstrap-admin.mjs` 或 `backup.mjs` 操作 PostgreSQL。

## PostgreSQL 备份

1. 确认项目、数据库及目标卷。变更或恢复前先为**当前状态**另存备份，不覆盖旧备份。生产切换还需停写或维护窗口，确认没有其他应用/脚本写入；普通 `pg_dump` 是一致性时间点快照，不代表备份之后的新写入也已保存。
2. 用与服务器相同主版本、最好同一小版本的工具。本示例直接使用 `postgres:18.7` 数据库容器内的工具。不要用旧主版本 `pg_dump` 导出新主版本服务器，也不保证新版本导出可恢复到更旧的主版本；跨主版本升级需单独演练，不能直接把 PG18 数据目录交给别的主版本启动。[pg_dump 版本说明](https://www.postgresql.org/docs/18/app-pgdump.html)
3. 采用完整单库逻辑备份，包含 `support_settings`、`seo_settings`、私人空间、账号、SMTP 密文、审计记录和序列，不按旧表名单过滤。它不包含集群级角色/表空间、部署环境文件或 `CODE_SECRET`，这些须另行安全保存。本例不保留原对象属主和 ACL，恢复后须重新核验授权。

下列命令创建新的私密备份目录，不使用 PowerShell 文本重定向处理二进制归档。先核实第一条查询的输出，再继续：

```bash
pgc exec -T postgres psql -X -U typelune -d typelune -Atc \
  'SELECT current_database(), version();'
pgc exec -T postgres pg_dump --version
umask 077
backup_dir="$(mktemp -d "$HOME/typelune-pg-backup.XXXXXXXX")"
container_backup="$(pgc exec -T postgres mktemp /tmp/typelune-backup.pgdump.XXXXXXXX)"
pgc exec -T postgres pg_dump -U typelune -d typelune \
  --format=custom --no-owner --no-acl --file="$container_backup"
pgc exec -T postgres pg_restore --list "$container_backup" > "$backup_dir/contents.txt"
pgc cp "postgres:$container_backup" "$backup_dir/database.pgdump"
chmod 600 "$backup_dir/database.pgdump" "$backup_dir/contents.txt"
test -s "$backup_dir/database.pgdump"
(cd "$backup_dir" && sha256sum database.pgdump > SHA256SUMS)
```

确认每一步成功，检查清单含本次需要的表。`pg_restore --list` 和校验和只能证明归档可读取及字节一致，**不能代替恢复演练**。归档、清单及临时容器文件均含敏感资料；加密异地保存并制定保留策略。在确认外部副本及恢复结果前保留原卷、原备份与原密钥，不将备份提交到仓库或公开附件。这里只是逻辑备份流程，不是自动备份、增量归档或时间点恢复服务。

## 先在全新隔离目标恢复

只恢复自己可信来源的备份。恢复过程会执行归档内 SQL，不把第三方未知备份当作安全数据。[pg_restore 安全说明](https://www.postgresql.org/docs/18/app-pgrestore.html)

以下仍在同一 Bash 会话中运行，`backup_dir` 指向刚核验的备份。旧源库、旧卷不改动。创建一个**从未使用过的项目名**和仓库之外的私密恢复环境文件；使用新的数据库密码，`DATABASE_URL` 与该密码匹配，安全保留备份对应的原 `CODE_SECRET`。不要借用生产环境文件或改写源站 `.env.postgres`。隔离目标不启动 Caddy、不发布数据库端口、不发送真实邮件。

```bash
PG_RESTORE_PROJECT="typelune-restore-$(date -u +%Y%m%d%H%M%S)"
PG_RESTORE_ENV="$HOME/private-typelune/restore.env"
# 先用私密编辑器按上方字段准备该文件，再继续。
chmod 600 "$PG_RESTORE_ENV"
pgr() {
  private_compose --project-name "$PG_RESTORE_PROJECT" --env-file "$PG_RESTORE_ENV" \
    -f compose.postgres.yaml "$@"
}
test -z "$(docker ps -aq --filter "label=com.docker.compose.project=$PG_RESTORE_PROJECT")"
test -z "$(docker volume ls -q --filter "label=com.docker.compose.project=$PG_RESTORE_PROJECT")"
pgr config --quiet
pgr up -d --wait postgres
pgr exec -T postgres pg_isready -h 127.0.0.1 -U typelune -d typelune
table_count="$(pgr exec -T postgres psql -X -U typelune -d typelune -Atc \
  "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema');")"
test "$table_count" = 0
(cd "$backup_dir" && sha256sum --check SHA256SUMS)
pgr cp "$backup_dir/database.pgdump" postgres:/tmp/typelune-restore.pgdump
pgr exec -T postgres pg_restore -U typelune -d typelune \
  --exit-on-error --single-transaction --no-owner --no-acl \
  /tmp/typelune-restore.pgdump
```

任一检查不通过立即停止，保留源、备份与目标用于调查。**不要在恢复前跑 `db-init`/`seed`，不要添加 `--clean` 来强行覆盖非空目标，也不要删除源卷后恢复。** 单事务恢复在失败时回滚本次 SQL，不意味着可以略过目标核验。[pg_restore 单事务选项](https://www.postgresql.org/docs/18/app-pgrestore.html)

恢复后比较迁移版本/校验值、逐表数量与关键记录、序列及权限，特别核对 `seo_settings` 的 revision、双语标题、图片及 sitemap 配置，并核对 `support_settings` 的存在、revision、开关和实际二维码图片。用隔离应用验证登录、私人空间、练习记录和支持入口，并以原 `CODE_SECRET` 验证 SMTP 密文可读；这不代表邮件真实送达。容器重启与**删除后重建容器但复用原卷**也需验证。全部通过、完成切换前最后一次备份、确认停写和另获上线授权后，才讨论将流量切到新目标。

## 回滚与验收差异

- 应用回滚不等于数据库时间回退。旧兼容应用可以忽略独立 `support_settings` 与 `seo_settings`，无需删表；先核验实际目标版本的兼容性，保留新版本已接收的写入。
- 不把旧快照覆盖到正在使用的数据库。若数据库已接受新数据，先停写、备份并确定数据保全方案，再切换；SQLite 往返导入/导出是另外的受保护操作，不代替 PostgreSQL 灾备。
- 后端分支真实 PG18.7 测试为 130 文件 / 634 项；最终集成候选 `143b9bb` 的真实 PG + SQLite 共 142 文件 / 680 项，全部通过。Node 22.23.5 的 Vercel 专项另有 14 项通过。完整 Chrome 130 项在临时 SQLite 上通过，不声称它们本轮全部在 PG 上重跑。
- Docker + PG 的待验收命令：先 `docker build -t dazi-ci:local .`，再 `DAZI_TEST_IMAGE=dazi-ci:local npm run test:docker:postgres`。该脚本使用唯一测试容器/卷/网络，测试初始化、登录、二维码权限和重启持久化，最后只清理其自己创建的测试资源；**它不覆盖 Compose/Caddy、容器替换或本页备份恢复流程**。
- 现有 GitHub Actions Docker job 仍只调用 SQLite `test:docker`。PG smoke 尚未接入该 job，本轮没有触发 Actions。任何 SQLite 绿灯均不能作为 Docker + PG 的验收证据。
- 早期宿主尝试因无 Docker 引擎报 `docker ENOENT`；后续已在独立环境完成真实容器及备份恢复验证，记录明确区分候选提交。尚未用这些测试证明真实公网 HTTPS、真实邮件或生产迁移。

详见[双路线验证记录](qa/2026-11-16-dual-postgres.md)与[最终集成记录](qa/2026-11-16-nightly-integration.md)。生产数据、域名、当前部署和截图均未因本次文档补充而改变。
