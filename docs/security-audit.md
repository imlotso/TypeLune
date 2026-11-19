# TypeLune 安全审计

本次从生产对应代码 7eeaf258a778ccad31cff68730b7edf479ac9a5f 建立本地审计分支。先读仓库、路由、部署文档及现有测试，再修复证据明确的缺口。验证使用 SQLite、回环 PostgreSQL 18 和本地 Chromium。审计范围参考 OWASP Web 和 API 规范。 [OWASP Top 10:2025](https://owasp.org/Top10/2025/) · [OWASP API Security Top 10](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)

状态为 **已验证**、**缺口已修复**、**需环境验证** 或 **不适用**。本次隔离验证未取得可将运行时缺口定为可利用 P0 漏洞的证据。Q01 有一项已确认的开发依赖公告。

OWASP Web 注入与认证风险对应 S01–S05，配置、供应链、密码学和异常处理对应 S09–S10 与 Q01–Q02。API 的对象级授权、功能级授权、请求资源消耗、敏感业务流程及 SSRF 分别对应 S04、S06、S08 和 S07。

## 数据流与信任边界

- 浏览器通过同源 API 调用 Fastify。Vercel Function 接收改写的 API、SEO 路由，Vite 生成浏览器资源。离线草稿及同步队列在浏览器按身份区分，服务端按归属、版本和删除标记处理同步和恢复。SQLite 和 PostgreSQL 共用应用数据层接口。 [路由](../vercel.json) · [应用](../server/app.ts) · [客户端工作区](../src/lib/workspace.ts) · [数据层](../server/database)
- Argon2id 校验密码，验证码通过 SMTP 发送，数据库保存摘要及有效期。Cookie 绑定账号会话或签名游客身份。管理员和敏感写操作另外检查角色或认证版本。 [认证](../server/app.ts#L318) · [账户](../server/account.ts) · [会话](../server/account-sessions.ts)
- 头像、反馈和背景经容量及格式检查、位图重编码和归属校验进入存储。Wallhaven 和 SMTP 定义各自的出站边界。关键服务端依赖为 Fastify、pg、better-sqlite3、argon2、sharp、undici 和 zod。前端为 React、Vite。 [上传](../server/feedback-images.ts) · [背景](../server/background-files.ts) · [壁纸](../server/wallpaper-images.ts) · [SMTP](../server/smtp.ts) · [依赖清单](../package.json)

## P0 证据与处理

| 编号 | 状态 | 位置、影响和证据 |
| --- | --- | --- |
| S01 SQL 注入 | 已验证 · 缺口已修复 · 需环境验证 | 审阅 SQLite 预编译语句、pg 及适配层。文章搜索、后台筛选、排行分页、同步和账号值走参数绑定。排序及列片段来自固定选择，schema 名称经正则校验。旧转换器可在引号或注释内改写固定语法，且未识别美元引号、嵌套注释及转义引号。修复在语法边界转换，测试引号、Unicode 参数、注释及异常参数。生产账号及 schema 权限需授权核查。 [SQL 编译器](../server/postgres/sql.ts) · [PG 适配器](../server/database/postgres.ts) · [目录查询](../server/catalog.ts#L178) · [回归](../tests/postgres-sql.test.ts) |
| S02 XSS | 已验证 · 缺口已修复 | 审阅动态渲染与 HTML 入口。昵称、个人介绍相关展示、私人及公开文章、反馈和公告按 JSX 文本显示。文章源链接仅允许 HTTP(S)，拒绝认证信息。当前正文无需富文本。SEO 已转义，但旧字符串替换会解释替换标记并可能改变模板结构，已改用回调，新增持久化后再渲染的字面文本检查。 [文章输入](../server/catalog.ts) · [SEO](../server/seo.ts) · [构建模板](../scripts/build-seo.mjs) · [回归](../tests/seo-api.test.ts) |
| S03 会话与账号 | 已验证 · 缺口已修复 | Argon2id、随机会话与摘要存储、30 天会话、host-only、HttpOnly、SameSite=Strict 和生产 Secure 已有。验证码有时效、次数、冷却、原子消费和防枚举应答。旧代码先将用途转字符串校验、后以原值使用，现仅接收精确枚举并于 DB、邮件前校验。测试覆盖改密、撤销、停用、删号、账号切换和验证码并发。 [认证](../server/app.ts#L445) · [邮箱变更](../server/account-email.ts) · [枚举检查](../tests/auth-code-enumeration.test.ts) · [会话](../tests/account-sessions.test.ts) · [PG 集成](../tests/postgres-app.test.ts) |
| S04 越权 | 已验证 | 管理员前置钩子覆盖整个子路由。历史、同步、背景、反馈、附件、练习按身份、归属或公开状态控制。包括权限撤销时的并发提交与永久删除测试。权限矩阵见下。 [后台钩子](../server/app.ts#L402) · [反馈](../server/feedback.ts#L120) · [背景](../server/background-files.ts#L86) · [公开个人页](../server/profile.ts) · [PG 竞态](../tests/postgres-app.test.ts) |
| S05 CSRF 与 CORS | 已验证 · 缺口已修复 · 需环境验证 | 写请求拒绝 cross-site 和同站兄弟来源，具有 Origin 时要求规范同源协议与 Host。保持已支持的无浏览器头非浏览器请求。SameSite=Strict 与同源策略叠加，当前无新 CSRF token 需求。GET 无账号、草稿、排行等敏感业务修改，鉴权可更新限频会话活跃时间。正式代理的 Host 与协议转发待授权验证。 [来源校验](../server/app.ts#L312) · [安全头回归](../tests/web-hardening.test.ts) |
| S06 限流 | 已验证 · 缺口已修复 · 需环境验证 | 保留每分钟 180 次 API 默认限流及验证码、登录、注册、重置、上传等独立限制。PG 原子窗口计数跨实例共享，按路由摘要地址并清理到期记录。生产入口仅信任相邻受信代理，避免把调用者附加的远端链直接用于限流。本地覆盖代理前缀、429、Retry-After 和多实例共享。实际入口拓扑、地址来源和 CDN 转发待核查。 [限流注册](../server/app.ts#L290) · [PG 限流](../server/postgres/rate-limit.ts) · [多实例回归](../tests/postgres-rate-limit.test.ts) |
| S07 上传与 SSRF | 已验证 · 缺口已修复 · 需环境验证 | 头像、背景、反馈和 SEO 位图已有字节、格式、像素限制及重编码。TXT 只在浏览器读取。Wallhaven 固定 HTTPS 域名、拒绝重定向并限制体积及时间。图片转换已有独立并发限制。补上每日壁纸元数据每进程最多 8 个未决查询的约束，相同查询仍共享请求，满载返回 503 和 Retry-After。直连现要求 DNS 结果均为公网，连接使用该次解析结果。SMTP 沿用公网校验及解析固定。配置了 HTTP 出站代理时，代理负责远端解析和内网阻断。 [出站](../server/wallpapers.ts) · [地址规则](../server/public-address.ts) · [上传回归](../tests/feedback-upload-api.test.ts) · [背景回归](../tests/background-files.test.ts) · [壁纸回归](../tests/wallpaper-images.test.ts) |
| S08 排行榜 | 已验证 | 用服务端文章、计时和字符比对算分。owner、恢复 claim、状态及版本在事务内检查。暂停、恢复和缺少活跃证据等进入复核。验证重放、重复提交、跨设备恢复和并发撤权。浏览器输入行为无法完全证明，人工复核仍是信任边界。 [完成与提交](../server/app.ts#L1080) · [PG 集成](../tests/postgres-app.test.ts) |
| S09 私密信息 | 已验证 · 需环境验证 | VITE 变量只用于公开信息。连接串、SMTP 和会话密钥来自服务端。通用异常回应不含 SQL 或堆栈，P2 新增脱敏错误关联 ID。Gitleaks 扫描可见 Git 历史和构建后的浏览器资源，未检出匹配的密钥。Preview 与生产密钥隔离和第三方采集策略需配置权限。 [变量示例](../.env.example) · [Vercel 入口](../server/vercel.ts) · [错误日志](../server/error-reporting.ts) |
| S10 部署 | 已验证 · 缺口已修复 · 需环境验证 | Fastify 和仓库 Vercel 配置都启用同源脚本 CSP，内联主题初始化用固定哈希，图像限同源与 data/blob，禁止对象和框架。React 动态样式仍需内联样式许可。私密 API 及错误默认 no-store，P1 仅公开壁纸成功图像可共享缓存。TLS、HSTS、外层代理及默认 Vercel 域的正式配置需授权核查。 [CSP](../server/security-headers.ts) · [Vercel 配置](../vercel.json) · [回归](../tests/web-hardening.test.ts) |

## 接口权限矩阵

框架自动注册的 HEAD 与对应 GET 采用相同授权。账号工作区身份提示须与当前会话匹配。匿名练习按签名游客归属和后台启用条件判断。

| 方法 | 路径 | 游客 | 普通账号 | 管理员 |
| --- | --- | --- | --- | --- |
| GET | /api/health、/api/articles、/api/site/{features,support,wallpaper,seo}、/api/site/seo/page、/api/site/seo/images/:name、/api/wallpapers/daily、/api/wallpapers/image/:id | 公开 | 公开 | 公开 |
| POST | /api/site/visit | 同源匿名统计 | 同左 | 同左 |
| GET | /api/me | 空会话资料 | 自己 | 自己 |
| POST | /api/auth/{code,register,login,login-code,reset,logout} | 按验证码、凭证和限流规则 | 同左，退出撤销当前会话 | 同左 |
| GET | /api/profiles/:id、/api/backgrounds/files/:id | 公开个人页及其引用的背景 | 自己及公开资料 | 自己及公开资料 |
| GET | /api/account/sessions、/api/workspace、/api/workspace/usage、/api/history、/api/backgrounds/state | 拒绝 | 自己 | 自己 |
| POST | /api/account/{username,password,profile,delete}、/api/account/email/{code,confirm}、/api/account/sessions/{revoke,revoke-others}、/api/workspace/{sync,compact}、/api/history/delete、/api/backgrounds/uploads/{chunks,complete,discard} | 拒绝 | 自己，敏感操作额外校验凭证或版本 | 同左 |
| GET | /api/feedback、/api/feedback/:id | 拒绝 | 自己 | 前台自己 |
| GET | /api/feedback/:id/attachments/:attachmentId | 拒绝 | 自己，附件须属于反馈 | 可看反馈附件 |
| POST | /api/feedback、/api/feedback/uploads、/api/feedback/:id/messages | 拒绝 | 自己 | 前台自己 |
| POST | /api/tests/{start,recover} | 启用时允许，恢复须验证归属和凭证 | 自己 | 自己 |
| GET | /api/tests/:id、/api/tests/:id/score-status | 自己的游客练习 | 自己 | 自己 |
| POST | /api/tests/:id/{pause,resume,checkpoint,finish} | 自己的游客练习 | 自己 | 自己 |
| GET | /api/leaderboard | 公开排行 | 同左及本人标记 | 同左 |
| POST | /api/leaderboard | 启用时仅本人有效练习 | 仅本人有效练习 | 同左 |

后台路径均加 /api/admin 前缀，游客及普通账号被拒绝，管理员写入另受目标、版本、撤权和审计约束。

| 方法 | 路径 |
| --- | --- |
| GET | /overview、/users、/users/:id、/users/registration-policy、/scores、/review、/audit |
| POST | /users/:id/{status,role,delete,sessions/revoke}、/users/registration-policy、/scores/moderate、/scores/cleanup、/scores/cleanup/preview、/review/:id、/remove/:id |
| GET | /articles、/articles/:id、/feedback、/feedback/:id |
| POST | /articles、/articles/:id、/articles/:id/{status,delete}、/feedback/:id/handle |
| GET、POST | /settings/site、/settings/seo、/nicknames、/support、/wallpaper、/smtp |
| POST | /wallpaper/refresh、/smtp/{reset,verify} |

/api/handler 是 Vercel 内部函数转发入口，允许的改写路径仍进入 Fastify 的同一鉴权链。私人文章和草稿在本人工作区，无按第三方 ID 公查接口。个人数据导出由本地数据和授权工作区接口组成。测试取验证码接口只在 E2E 服务注册。 [函数入口](../server/vercel.ts) · [管理员接口](../server/admin.ts) · [测试服务](../e2e/server.ts)

## P2 与持续回归

- **Q01 已修复开发依赖公告。** npm audit 起初报 2 项 high，分别为 path-to-regexp 及受影响的开发父包 @vercel/routing-utils。仅把该父包的 6.x 依赖覆盖为 6.3.0。全量与运行时复查均为 0，路由转换回归通过。CI 已固定所用 GitHub Actions 并使用 npm ci。Dependabot 可由仓库维护者决定是否启用。 [漏洞公告](https://github.com/advisories/GHSA-9wv6-86v2-598j) · [CI](../.github/workflows/ci.yml)
- **Q02 已验证错误关联。** 意外 500 和 Function 503 返回通用信息及 X-Request-Id。日志只含事件、作用域、数据库或应用分类及 ID。业务拒绝和限流继续使用 HTTP 状态，异常登录、数据库故障、持续 429 的监控阈值需在授权环境按流量设定。 [错误日志](../server/error-reporting.ts) · [脱敏回归](../tests/web-hardening.test.ts)
- **Q03 恢复演练见性能报告。** 生产恢复窗口、保留期及外部备份权限由管理员核查。此次无 schema 变化。加密 SMTP 配置须与相应环境的 CODE_SECRET 版本共同保管，复原在隔离环境验证。 [Neon 备份流程](./vercel-neon.md) · [Docker 恢复流程](./docker-postgres.md)

新增及已有安全回归都进入现有 Vitest、Playwright CI。具体测试结果和生产权限项见配套文件。 [性能与验收](./performance-audit.md) · [人工清单](./deployment-security-checklist.md)
