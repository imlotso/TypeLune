# TypeLune

**简体中文** · [English](README.en.md)

TypeLune 是一个支持中文输入法的中英文打字练习网站。可以逐行练习公版长文、学习指法、续练未完成的草稿，或用自己的文章练习。

[在线练习](https://typelune.imlotso.com/) · [新手课程](https://typelune.imlotso.com/lessons) · [文章库](https://typelune.imlotso.com/library) · [排行榜](https://typelune.imlotso.com/rankings)

[![GitHub CI](https://github.com/imlotso/TypeLune/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/imlotso/TypeLune/actions/workflows/ci.yml)

## 网站功能

| 功能 | 使用方式 |
| --- | --- |
| 逐行打字 | 确认首个字符后开始计时，当前行高亮，打完自动跟随下一行。中文拼音组合期间保持输入框稳定。支持限时、整篇、严格纠错、自动暂停和目标配速。限时默认 5 分钟，可设为 1–60 分钟。 |
| 文章库 | 中英文各内置 21 篇公版长文，覆盖入门、进阶、挑战。可按标题、作者查找，按情绪、难度、篇幅筛选，并收藏文章。文章页保留作者和原文链接。 |
| 指法课程和专项 | 「新手课程」提供分章练习、键盘与手指指引、阶段测评。练习页的「专项练习」可选数字、标点、词组等内容。「错字本」可选字复练并标记掌握状态。 |
| 自定义与私人文章 | 练习页可直接粘贴文字。文章库的「我的文章」可新建、编辑、删除或导入 TXT。编辑正文不会改写已有草稿和记录中的文章快照。 |
| 草稿续练 | 「更多 → 草稿箱」支持继续、批量选择和删除。续练会恢复已输入的整行与当前行，光标接在上次的位置。已结束的轮次仍保留历史，新一轮只计算新输入。 |
| 成绩与进步 | 成绩页包含概览、过程、错字和个人最佳，可继续本篇、重练或导出成绩分享图。「我的记录」支持筛选及查看详情，「更多 → 统计」提供趋势、活动日历和每日目标。过程曲线使用实际采样。 |
| 在线排行榜 | 游客榜和用户榜分别展示，按练习语言、难度与日期范围筛选。中文按正确字符/分钟排名，英文按 WPM 排名。服务端复算符合条件的公开文章成绩，异常、恢复或默认需审核的成绩可进入人工复核。 |
| 外观与可读性 | 「外观」提供日间和夜间主题、各自的背景图、预览和透明度设置。可跟随全站壁纸，或关闭跟随后上传 JPG、PNG、WebP 和使用 Wallhaven。站点启用轮换后每 12 小时更新共享壁纸，显示效果可独立调整。字号、行距、专注模式、命名预设和快捷键在设置中管理。 |
| 账号与同步 | 游客可在本机练习和存记录。登录后同步草稿、记录、私人文章、收藏和设置。离线时保留本机资料，联网后可重试同步。可显式导入游客资料、导出 JSON 或 CSV、管理本机缓存及注销账号。 |
| 个人主页与帮助 | 更换头像、设置个人主页的公开状态，或从排行榜查看公开资料。界面支持简体中文、English 和跟随浏览器。页脚可访问帮助、反馈、隐私政策、服务条款及联系信息。反馈支持截图和查看处理进度。 |

英文速度同时显示 CPM 和 WPM。CPM 按有效练习时间内的正确字符计算，WPM 按每 5 个正确字符折算。空格和标点参与比对，未确认的输入法候选词不计分。自定义文章、专项和新建的个人续练轮次用于个人记录。符合资格的在线草稿可恢复原轮次。

同步使用 IndexedDB 保留本机资料，以账号分隔工作区，并通过修订号和删除标记处理冲突。游客与各账号的数据必须显式导入才会合并。隐私设置关闭个人主页后，其他人无法读取主页，已公开的排行榜成绩仍按榜单规则展示。

[中文文章来源](docs/chinese-article-sources.md) · [英文文章来源](docs/english-article-sources.md) · [同步协议与容量限制](docs/qa/2026-11-15-workspace-protocol.md)

## 管理后台

管理员通过网站统一登录入口或 `/admin` 登录。部署时通过 `ADMIN_EMAIL` 或所选数据库路线的首位管理员命令初始化权限。已注册用户可使用用户名或邮箱加密码登录，也可使用邮箱验证码登录。

| 栏目 | 可管理内容 |
| --- | --- |
| 概览 | 账号、练习、文章、成绩、访问趋势与地理汇总。访问统计按日聚合，国家和地区取决于部署平台提供的地理信息。 |
| 用户 | 搜索、筛选、停用、删除普通账号、撤销会话与管理角色。可配置注册邮箱域名白名单、域名黑名单和单个邮箱黑名单。 |
| 内容与审核 | 公开文章草稿、发布、归档和删除，成绩单项或批量审核及下架，反馈截图、公开回复、内部备注与操作日志。 |
| 站点与外观 | 注册、游客练习、排行榜与审核规则，全站默认日夜间配色与透明度设置（含一键恢复默认），页脚五个按钮与 Markdown 页面编辑及扩展链接，昵称词库，SMTP 配置及连接测试，全站壁纸和可选支持入口。 |
| SEO | 按页面和语言编辑标题与描述，实时预览搜索摘要，设置正式网址、索引、robots、Sitemap 以及分享图片。 |

邮件验证码、注册与密码重置需要可用的 SMTP。服务端启动时不会将验证码输出到日志。隔离测试使用内存邮箱。PostgreSQL 上的 SEO、壁纸、概览、注册规则、昵称词库、页脚与外观及支持入口等扩展按部署文档安装。

## 部署方式

前端使用 React、Vite 和 TypeScript，API 使用 Fastify，持久化使用 PostgreSQL。生产网站使用 Vercel + Neon。

| 方式 | 服务范围和存储 | 配置 |
| --- | --- | --- |
| Vercel + PostgreSQL / Neon | Vercel Node.js 22 Functions 提供完整 API，数据保存在独立 PostgreSQL 数据库。 | [Vercel + Neon 操作指南](docs/vercel-neon.md) · [Vercel 配置](vercel.json) |
| Docker Compose + PostgreSQL 18 | 自托管完整应用，Caddy 提供 HTTPS，PostgreSQL 由独立卷持久化。 | [初始化、升级、备份和恢复](docs/docker-postgres.md) · [Compose 配置](compose.postgres.yaml) |
| 直接运行 Node 服务 | 构建后由 Fastify 同源提供页面和 API，通过 `DATABASE_URL` 连接已初始化的 PostgreSQL 数据库。 | [Node 入口](server/index.ts) · [配置示例](.env.example) |
| Sites Worker / 静态托管 | 提供静态页面、本机练习和本机记录。账号、云端同步、在线排行、后台、共享壁纸等需要额外接入同源 API。 | [Worker 入口](worker/index.js) · [Sites 包装脚本](scripts/prepare-sites-build.mjs) |

### 部署前准备

- 完整服务使用稳定的 `CODE_SECRET`，正式环境至少 32 字符。数据库连接串和 SMTP 凭据放在服务端。以 `VITE_` 开头的变量可进入公开构建，其中 `VITE_SITE_URL` 设置默认 canonical 和 Sitemap 地址。
- Vercel 的构建会校验 PostgreSQL schema 并检查应用能否启动。给 Preview 配置独立的数据库或 schema 与密钥。按所选部署指南初始化、升级及恢复，保留数据库备份对应的 `CODE_SECRET`。
- 直接运行 Node 时，先执行 `npm run build`，在服务环境中配置 `NODE_ENV=production`、数据库和密钥，再执行 `npm run start`。公开入口使用 HTTPS。默认 API 端口为 `3001`。
- TypeLune 的 API 走普通 HTTP 请求。浏览器侧 HTTP/2、HTTP/3 与 CDN 回源协议可独立协商。网络排查和反代配置见部署文档。

[部署安全检查清单](docs/deployment-security-checklist.md) · [HTTP 协议与排查](docs/vercel-neon.md#http-协议与排查)

### Docker Compose 速查（PostgreSQL）

在新安装目录中复制配置示例，填入 `SITE_DOMAIN`、PostgreSQL 凭据和独立生成的 `CODE_SECRET`，按需设置 SMTP 和管理员邮箱。域名指向服务器且 80/443 可访问时，Caddy 可自动签发 HTTPS 证书。完整的初始化、迁移、扩展表安装、首位管理员创建及 `pg_dump` 备份恢复步骤见 [PostgreSQL 部署指南](docs/docker-postgres.md)。

```bash
cp .env.example .env
docker compose -f compose.postgres.yaml config --quiet
docker compose -f compose.postgres.yaml up -d --build
```

## 本地开发与测试

本地使用 Node.js 22.13+ 和 npm。Docker 应用镜像使用 Node.js 26。在环境中配置好 `DATABASE_URL` 连接 PostgreSQL 后启动 API，再在第二个终端启动 Vite。

```bash
git clone https://github.com/imlotso/TypeLune.git
cd TypeLune
npm ci
npm run dev:api
```

```bash
npm run dev
```

打开 Vite 显示的地址，默认为 `http://localhost:5173`。前端开发服务会把 `/api` 转发到本机 `3001`。如需测试 SMTP 或 PostgreSQL，从启动 API 的环境提供服务端变量。

```bash
npm run typecheck
npm test
npm run build
npm run test:sites
npm run test:vercel-esm
npx playwright install --with-deps --only-shell chromium
npm run test:e2e
```

[GitHub CI](.github/workflows/ci.yml) 对 PR 和 `main` 执行类型检查、单元与集成测试、生产构建、Sites 包装验证、隔离 PostgreSQL 的 Chromium 端到端测试、Node 22 函数验证与 Docker 容器冒烟测试。PostgreSQL 浏览器测试仅接受回环地址上的一次性测试库。Playwright 模拟的组合输入验证可配合 [Linux 原生输入法验收](docs/qa/2026-11-15-system-ime.md)。

## 许可与文档

代码采用 [GNU GPL v3](LICENSE)。内置文章及可选昵称词库来源见归属文档。Wallhaven 壁纸沿用来源作品的权利与许可，界面提供原图出处。

[中文文章来源](docs/chinese-article-sources.md) · [英文文章来源](docs/english-article-sources.md) · [昵称词库归属](docs/licenses/nickname-wordlists.md) · [安全审计](docs/security-audit.md) · [性能审计](docs/performance-audit.md)
