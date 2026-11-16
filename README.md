# TypeLune

一个轻松的中英文打字练习网站。内置中文和英文各 21 篇有作者及原文出处的公版长文，偏重亲情、友情、思念、孤独、遗憾和成长，分别覆盖入门、进阶和挑战三个阶段。每篇中文至少 1000 个汉字，英文至少 1000 词；不靠重复或拼接凑长度。测试默认 5 分钟，可手动设置 1–60 分钟，并支持日间和夜间模式。打完当前文章或时间到时立即展示结果。

中文选文来自维基文库，英文选文来自 Project Gutenberg；页面展示作者、情感主题和原文链接。字数、来源和转写处理说明见[中文选文清单](docs/chinese-article-sources.md)与[英文选文清单](docs/english-article-sources.md)。文库更新前已保存的练习仍使用当时的正文和标题，重新开始后切换到新版文章。

练习区采用「一行原文 + 一行输入」的逐行跟打方式：输入首个字符时自动开始计时，当前行高亮，打满后自动进入下一行并跟随滚动；英文按单词分行，空格保持留白，原文换行显示为 `↵`。空行退格可返回上一行，`Esc` 可暂停，只有原文要求换行或 Tab 时才需要输入对应按键。窗口变化会重新排版，输入法候选词编辑期间保持当前输入框稳定。

练习中可暂停续练、确认后重新开始或提前结束并保存当前成绩。公开文章在建档中断或离开页面后可恢复在线练习并提交排行；无法完整验证的恢复成绩进入人工复核。未完成的长文按轮次保存草稿，结束后可继续本篇；续练只对本轮新输入计算速度。成绩包含整篇进度、本轮字数、速度、准确率、退格次数和错误对照。

游客可练习、保存本机记录并提交排行榜；注册用户可用用户名或邮箱加密码、或邮箱验证码登录。个人文章、收藏、设置、草稿和记录保存在 IndexedDB，登录后与服务端同步；浏览器不支持 IndexedDB 时使用本地存储。游客资料和不同账号的数据保持隔离，不自动合并。

## 功能入口

| 功能 | 入口与行为 |
| --- | --- |
| 文章查找与收藏 | 文章库：标题/作者搜索，情绪、难度、篇幅筛选，中英文分别浏览。 |
| 长文续练 | 成绩中的“继续本篇”或“更多 → 草稿箱”；不同轮次独立保存。 |
| 错字复练 | 成绩页可复练本轮错字；更多 → 错字本可筛选、选择、标记掌握或忽略。数字、标点及词组专项在练习页选择，均为个人练习。 |
| 历史详情 | 我的记录：按文章、日期和练习条件筛选，查看文章快照、成绩状态和误输，重练、续练或恢复符合条件的在线成绩。删除会撤回关联公开成绩并重算统计。 |
| 进步统计 | 更多 → 统计：按语言、文章和规则分组比较速度与准确率；支持较长或自定义日期范围、活动日历、统计时区和每日目标。未完整读取时标明覆盖范围。 |
| 练习规则 | 更多 → 设置：限时/整篇、严格纠错、自动暂停、实时指标、目标配速及命名预设；支持配置导入/导出。整篇模式的安全上限为 24 小时有效用时。 |
| 阅读与专注 | 设置中的字号、行距、可见行数与专注入口；支持浏览器全屏，受限的嵌入环境使用专注布局。 |
| 过程与分享 | 新练习按有效时间采样，结果和历史展示速度趋势与错误分布；旧记录不会虚构过程。成绩卡可选择是否展示昵称和文章标题，并下载或复制图片。 |
| 快捷操作 | 更多 → 功能面板：搜索可点击的功能并查看快捷键；新增快捷键可在设置中关闭，组合输入和其他表单受保护。 |
| 自定义背景 | 更多 → 设置 → 背景图：分别设置日间/夜间图片，支持选择或拖入、预览、填满/完整显示、水平/垂直位置、模糊与遮罩；保存后生效，也可恢复默认。 |
| 私人文章库 | 文章库 → 我的文章：新建、编辑、删除、TXT 导入；正文上限 20,000 UTF-16 单元，文件上限 100 KB。 |
| 账号与反馈 | 账号菜单提供资料、用户名、邮箱、密码及会话管理；我的反馈可提交截图、查看状态和回复，管理员在独立后台处理。 |
| 跨设备同步 | 登录后自动同步；设置中可查看状态和手动重试。网络故障保留本地数据。 |
| 个人数据 | 账号菜单 → 个人数据：导出可读取的个人资料 JSON、记录 CSV，按类型管理工作区容量，显式导入游客资料或清除此设备的账号缓存。未同步资料可先同步、导出或确认放弃。 |
| 注销账号 | 账号设置 → 注销账号：可先导出，验证当前密码并确认后删除账号、云资料和公开成绩。永久离线设备及既有备份中的副本不会即时清除。 |
| 扩展排行 | 按近 7 天/近 30 天/全部、文章、模式、规则及语言难度筛选，显示个人名次。 |

已结束的轮次保留独立历史。符合条件的公开文章草稿可通过现有认领和恢复校验在另一设备继续；私人文章或无法恢复在线资格的进度可作为个人轮次继续，不会重复计入继承的字数。删除标记按草稿轮次保持有效，编辑或删除私人文章不会改写已有草稿和历史快照。

排行榜只接收服务端复算的公开文章成绩，并分别展示游客榜和用户榜。新提交的游客昵称以 `visitor` 开头，游客成绩默认待审核；注册用户的普通成绩默认直接发布，异常成绩仍须复核。自定义、错字专项和接续产生的个人新轮次不参与排行；整篇排行要求全文完成，严格模式要求完成时无未改正错误。筛选条件保存在页面地址中，每个分组在所选时间范围内取每位用户的最佳已发布成绩。旧版数据无法区分的已下架/已被替代成绩不会被重新发布。

## 同步与部署说明

同步请求按当前账号校验，使用 Fastify API 和 SQLite 或 PostgreSQL；单次最多 100 项或 4 MiB，每账号普通工作区上限 2,000 项和 32 MiB 内容。数据按页读取，中断时保留本机资料；无效单项保留在本机并报告失败。同步协议使用代次、项目修订和删除标记；整理标记后，旧设备须先保留未同步资料并重新同步，旧客户端的不安全写入会被拒绝。经核验的旧记录关联标记单独计数。协议、容量边界与回退说明见[同步记录](docs/qa/2026-11-15-workspace-protocol.md)和[旧记录兼容](docs/qa/2026-11-15-legacy-workspace-records.md)。

背景支持 JPG、PNG、WebP，原图不超过 10 MiB 或 4000 万像素。浏览器将其重新编码为不超过 2560 px 长边、768 KiB 的静态图片；不保留原始图片元数据。服务端核对编码中的实际尺寸，拒绝外链、SVG、动画和超限背景。访客仅保存在本机，登录后随当前账号同步；日夜背景独立保存，取消编辑不改变原图。恢复默认会同步到其他设备，之后可以重新上传。背景以独立项目保存，普通练习同步通过版本摘要复用未修改的背景，避免反复传输图片。

Node/Docker 和 Vercel 部署提供完整 API。受保护的 Sites Worker 仍为静态资源服务：若使用纯静态托管，账号、云端同步和排行需要另行连接同源 API；本地练习可独立使用。真实邮件投递仍需配置 SMTP，开发邮箱不向外发送邮件。

## 本地开发

Vercel 使用 Node.js 22.x；本地开发至少需要 Node.js 22.13，现有 Docker 镜像使用 Node.js 26：

```bash
npm ci
npm run dev:api
```

另开一个终端运行：

```bash
npm run dev
```

打开终端显示的本地地址。账号验证码需要配置 SMTP；未配置时相关请求会明确失败。开发服务不把验证码写入日志，自动化测试使用隔离的内存邮箱。

```bash
npm run typecheck
npm test
npm run build
npm run test:sites
```

PR 和 `main` 的 CI 还会运行 Chromium 端到端测试，以及 Docker 容器替换、数据卷持久化和 SQLite 备份恢复检查。本地运行这些检查需要先构建项目，并安装 Playwright 的 Chromium：

```bash
PLAYWRIGHT_SKIP_BROWSER_GC=1 npx playwright install chromium
npm run test:e2e
docker build -t dazi-ci:local .
npm run test:docker
```

常规浏览器测试模拟输入法组合事件，账号流程使用测试邮箱。可选的 `scripts/verify-system-ime.sh` 使用独立 Xvfb、Fcitx5 拼音和临时测试服务验证真实 Linux 输入法事件；依赖与范围见[验收记录](docs/qa/2026-11-15-system-ime.md)。这些测试不能替代其他系统输入法、真实 SMTP 投递和公网 HTTPS 的实机验证。

## 部署路线

以下两条 PostgreSQL 路线同时保留，不互相替代：

| 路线 | 入口与数据持久化 | 操作说明 |
| --- | --- | --- |
| Vercel + PostgreSQL / Neon | `vercel.json`，独立 PostgreSQL 数据库 | [Vercel + Neon](docs/vercel-neon.md) |
| 自托管 Docker + PostgreSQL 18 | `compose.postgres.yaml`，`postgres_data` 持久卷 | [初始化、升级、备份恢复与回滚](docs/docker-postgres.md) |
| SQLite 兼容路线 | 原 `compose.yaml`，`typing_data` 持久卷 | 本文下方 SQLite 章节 |

不带 `-f` 的 `docker compose` 命令仍选择 SQLite，**不是 Docker + PostgreSQL**。PostgreSQL 路线必须显式选择 `compose.postgres.yaml`，不能使用下方 SQLite 备份脚本替代 PostgreSQL 备份。

真实 PostgreSQL 的 Node HTTP / Vercel handler 与 SQLite 集成测试已通过。独立临时环境也已完成 **Docker + PostgreSQL 18.7 的实际镜像构建、Compose/Caddy、容器重建持久化与备份恢复**，并复验 SQLite 容器兼容路线。所测提交和边界见 [Docker 实机记录](docs/qa/2026-11-16-docker-runtime.md)、[账号语言验证](docs/qa/2026-11-16-account-language.md)及[双 PostgreSQL 路线记录](docs/qa/2026-11-16-dual-postgres.md)。公网 TLS、真实邮件/支付与生产上线不由本地测试代替；生产发布须明确批准。

## Docker Compose 部署（SQLite 兼容路线）

准备一台已安装 Docker 和 Compose 的服务器，并将域名解析到服务器，开放 80 和 443 端口。内地服务器请按服务商要求完成备案。Caddy 在域名和端口可用时自动申请 HTTPS 证书。

```bash
cp .env.example .env
openssl rand -hex 32
```

将生成的随机值填入 `.env` 的 `CODE_SECRET`，填写 `SITE_DOMAIN`，然后按需填写 SMTP 和管理员邮箱。切勿提交 `.env` 或泄露密钥。

`VITE_SITE_OPERATOR`、`VITE_SITE_CONTACT_EMAIL`、`VITE_PRIVACY_VERSION`、`VITE_PRIVACY_EFFECTIVE_DATE`、`VITE_TERMS_VERSION` 和 `VITE_TERMS_EFFECTIVE_DATE` 是公开的构建配置，可在 `.env` 中填写后重新构建；日期使用 `YYYY-MM-DD`。未设置时采用站点维护者提供的公开资料和政策版本，默认值、政策与帮助内容在 `src/data/site-content.ts` 维护，更新后需重新构建。站内反馈入口始终可用。不要在这些公开变量中填写密码或其他密钥。

```bash
docker compose up -d --build
docker compose logs -f app
```

邮件服务未配置时，游客练习和排行榜仍可使用，已注册用户仍可用密码登录；注册、邮箱验证码登录和找回密码需要可用的 SMTP 服务。SMTP 服务通常要求验证发信域名，使用前请确认供应商的账号资格和费用。

## 管理后台

首页统一使用现有登录按钮：普通账号登录后继续练习，管理员登录后自动进入独立管理界面，刷新也会按当前账号角色恢复。前台导航不显示“管理后台”。管理员可主动“预览网站”，再通过前台账号按钮返回管理界面；退出登录后回到普通首页。`/admin` 仍可作为后台书签，使用同一套登录流程。

`ADMIN_EMAIL` 用于初始化首个管理员。升级时会识别已用该邮箱注册的账号。新站点可以用该邮箱完成验证注册。后续角色保存在数据库中，由现任管理员在用户页面管理。

SMTP 尚未配置时，SQLite 路线先启动服务以初始化数据库，再在部署机器上用以下方式创建首个管理员。PostgreSQL 必须使用 [Docker PostgreSQL 操作器](docs/docker-postgres.md)或 [Vercel / Neon 操作器](docs/vercel-neon.md)，不要使用下面的 SQLite 脚本。填写真实邮箱。脚本通过标准输入读取密码，拒绝覆盖已有账号或在已有管理员时创建第二个管理员。

```bash
read -rsp '管理员密码（至少 10 位）: ' dazi_admin_password
printf '\n'
printf '%s\n' "$dazi_admin_password" | docker compose exec -T \
  -e ADMIN_USERNAME=dazi_admin -e ADMIN_EMAIL=admin@example.com \
  app node scripts/bootstrap-admin.mjs
unset dazi_admin_password
```

本机 Node 部署可以直接运行 `node scripts/bootstrap-admin.mjs`，通过环境变量提供 `ADMIN_USERNAME`、`ADMIN_EMAIL` 和服务使用的 `DATABASE_PATH`。

- 概览展示账号、近 7 天服务端记录的练习、公开文章和成绩数据。
- 用户页面支持搜索、筛选、查看账号摘要、停用和启用账号、授予和撤销管理员角色、结束账号的全部会话。权限或账号状态变动会注销该账号的会话。管理员无法停用自己的账号或撤销自己的管理权限。
- 文章页面可以保存草稿、编辑、发布、归档和删除。发布需要作者、主题、可复用授权、原文链接和至少 1,000 个汉字或英文单词。每种语言须保留至少 20 篇已发布文章，并覆盖全部难度。文章编辑和归档不改变已保存的草稿、练习记录或成绩快照。
- 成绩页面可按状态、语言和难度筛选成绩，单独或批量通过、拒绝及下架，操作须填写原因。
- 反馈页面按分类、状态和时间查看反馈与截图，支持公开回复、内部备注及处理状态；并发更新会检查版本。
- 站点设置可控制注册、游客在线练习及上榜，调整游客和注册用户的默认审核策略、榜单展示天数以及中英文速度复核阈值；已创建的练习仍可恢复。成绩页可按本地日期和榜单类型筛选，预览后撤下该范围的公开成绩；个人历史保留。
- 邮件页面可配置 SMTP 主机、端口、加密方式、发件人及账号密码，测试连接后保存即可生效，也可恢复部署配置。后台配置只允许解析到公网的 SMTP 域名和常见邮件端口；内网邮件服务请使用部署环境变量。测试连接不发送邮件，实际投递仍需使用真实邮箱验证。
- 后台 SMTP 密码加密保存在数据库中，密钥由 `CODE_SECRET` 派生，不会在页面或日志中回显。备份数据库时须安全保存原 `CODE_SECRET`；更换密钥后需要在后台重新填写 SMTP 密码。
- 操作日志记录操作者、时间、对象及填写的原因。后台用户详情只展示账号信息与练习统计。

## Vercel 与 Neon

Vercel Node.js Functions + PostgreSQL 与 Docker + PostgreSQL 是并行支持的路线，另保留 SQLite 兼容方式。隔离环境、服务端密钥、迁移、备份、恢复和回滚步骤见 [Vercel + Neon 操作说明](docs/vercel-neon.md)。实际部署前须先完成隔离 Preview 验证。

## 数据备份与恢复（仅 SQLite）

本节只适用于 `compose.yaml` 的 SQLite。PostgreSQL 请分别使用 [Docker 的完整逻辑备份与隔离恢复流程](docs/docker-postgres.md)或 [Vercel / Neon 备份恢复说明](docs/vercel-neon.md)。

数据库保存在 `typing_data` Docker 卷里。在线备份使用 SQLite 的备份接口，而不是直接复制运行中的数据库：

```bash
docker compose exec app node scripts/backup.mjs /app/data/backup.sqlite
docker compose cp app:/app/data/backup.sqlite ./backup.sqlite
```

恢复前先备份当前数据，确认恢复文件无误，再停止应用。以下命令会用备份覆盖当前数据库，并移除原数据库的 WAL 辅助文件：

```bash
docker compose stop app
docker compose cp ./backup.sqlite app:/app/data/dazi.sqlite
docker compose run --rm --no-deps --user root --entrypoint sh app -c 'chown node:node /app/data/dazi.sqlite && rm -f /app/data/dazi.sqlite-wal /app/data/dazi.sqlite-shm'
docker compose up -d app
```

请定期将备份复制到服务器之外。`docker compose down -v` 会删除数据卷，普通重启无需使用 `-v`。

## 计分说明

已确认上屏的字符逐个与题目比较；字符包含空格和标点。每分钟正确字符数为 CPM，英文 WPM 按每 5 个正确字符折算一个标准词，即 CPM 除以 5；两种速度都只计算有效练习时间。准确率按最终输入内容计算。中文输入法候选尚未上屏时不计入成绩，编辑候选词使用的退格也不计入文章退格次数。页面同时展示文章字数、已打字数、当前错误字数和退格次数。在线挑战由服务端复算并检查时间、练习进度、重复提交及异常数据；暂停或恢复过的成绩以及超过后台配置阈值的成绩会进入人工复核。浏览器环境无法彻底杜绝自动化作弊。
