# TypeLune 部署安全检查清单

以下操作需要正式后台权限、生产环境信息或部署授权。当前工作保存在本地审计分支，没有执行真实迁移、账号操作、密钥轮换、线上配置变更、生产攻击扫描或压力测试。明确授权一个与生产隔离的 Preview 后，再执行该环境的验证清单。 [本次审计](./security-audit.md)

## Vercel

- [ ] 人工确认项目归属、Preview 保护、生产域名和默认 Vercel 别名。限制受保护部署的访问方式，明确默认域是否仍能直接到达 API。按实际套餐评估 Vercel Firewall、Trusted Sources 或同等入口保护，逐项验证现行登录和 API，同源 Cookie 与重写请求均需通过。 [部署保护](https://vercel.com/docs/deployment-protection) · [Vercel Firewall](https://vercel.com/docs/vercel-firewall)
- [ ] 分别确认 Production 和 Preview 的 DATABASE_URL、CODE_SECRET、SMTP 及管理员身份。仅汇报变量存在、用途、版本和项目归属。拓扑应确保服务端秘密不会流入 VITE_ 变量、客户端 sourcemap、命令参数或公开构建日志。测试邮箱使用收件箱隔离或内部假邮件。 [环境变量](https://vercel.com/docs/environment-variables)
- [ ] 用 Preview 测试 Secure、HttpOnly、SameSite=Strict 和 host-only Cookie，核对原始 Host、协议及客户端地址由哪一层写入。Vercel 默认覆盖 X-Forwarded-For。代理链有额外自定义鉴权或地址转发时，按实际信任拓扑验证单跳入口策略，避免正常用户被合并到同一个 CDN 出口的限额。 [请求头](https://vercel.com/docs/headers/request-headers)
- [ ] 验证 Preview 首页、后台登录、SEO、公开壁纸、私密背景文件、同步 API 和错误页。检查静态哈希资源 immutable、HTML 重验证、CSP 主题哈希、个人数据及错误 no-store、公开壁纸浏览器和 Vercel 边缘缓存的不同 TTL。比较 Accept-Encoding、Vary 和 Content-Encoding，确认压缩没有在多层代理重复处理。 [Vercel 缓存头优先级](https://vercel.com/docs/caching/cache-control-headers)
- [ ] 在授权 Preview 的 Functions 中测量到同环境 Neon 的实际 sin1 首包、SQL 执行及冷启动时间，记录 P50/P95、Function 执行时间、容量和连接等待。生产区域按授权日志与用户分布评估，当前代码保留既有区域。 [部署说明](./vercel-neon.md)
- [ ] 设置只采集允许字段的监控。按实际流量建立并审阅 5xx、数据库超时与连接错误、持续 429、验证码发送失败和慢查询阈值。对照 X-Request-Id、Vercel 请求 ID 与代理请求 ID，禁止采集 Cookie、验证码、密码、邮箱、私人文章正文、连接串和完整请求体。原始日志访问与保留期按运维角色设置。 [错误事件](../server/error-reporting.ts)

## Cloudflare 或其他边缘代理

- [ ] 确认自定义域实际代理商、CNAME 链、TLS 证书和控制面归属。仓库记录的既有 DNS 结果显示 Vercel 前有另一层代理，不能由品牌名或 Alt-Svc 推断 Cloudflare 已接管。若实际由 ESA、Cloudflare 或多层代理提供服务，分别核对公开域和默认 Vercel 域的入口覆盖。此次不修改域名、DNS 或架构。 [既有检查](./qa/2026-11-19-results-admin.md)
- [ ] 查明 TLS 最低版本、HTTPS 跳转和现有 HSTS。仅在所有相关子域均可保障 TLS 时才人工考虑 includeSubDomains，预加载另行审批。 [HSTS](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [ ] 核查两层 CDN 的缓存规则。私密 API、含 Cookie 的会话响应与错误保持 no-store。公开壁纸仅按同路径及尺寸缓存，恢复错误应能快速重试。使用 Preview 检查缓存命中、年龄、跨设备会话及部署切换，保留前一版资产的安全切换窗口。 [缓存规范](https://www.rfc-editor.org/rfc/rfc9111)
- [ ] 检查可信入站和出站路径。协议、Host 与客户端 IP 只由可信入口提供。若网络启用了远端 DNS 解析的出站代理，该代理需限制公网固定目标、禁止访问内网或云元数据，并保留证书验证。 [出站约束](../server/wallpapers.ts)
- [ ] 历史 HTTP/2 错误只在已授权 Preview 对固定健康请求复核。分别核对浏览器到边缘、边缘到 Vercel 的 ALPN 和回源协议，比较 HTTP/1.1、HTTP/2，在直达 UDP 443 的环境验证 HTTP/3 握手。采集出错 URL、时间、状态、编码、回源长度与请求 ID，观察是否出现响应截断或压缩不一致。现有 Fastify API 可继续 HTTP 请求模式，缺少采用 gRPC 或 WebSocket 的业务需求。 [协议排查](./vercel-neon.md) · [Cloudflare 回源 HTTP/2](https://developers.cloudflare.com/speed/optimization/protocol/http2-to-origin/)

## Neon

- [ ] 核对运行时角色、迁移角色、应用 schema 与公共 schema 的授权。确认运行时不持有 owner、超级用户、创建角色或跨 schema 许可等非必要权限，核查表、序列、辅助函数的读写权。按实际运行路径在隔离分支验证后，才安排正式调整。可从 current_user、pg_roles、pg_namespace、has_schema_privilege、has_table_privilege 和序列授权只读采集，避免输出连接串。 [Neon 连接与角色](https://neon.com/docs/manage/roles)
- [ ] 核对连接池路径、数据库区域、最大连接数、TLS、空闲回收、Gen/Preview 隔离和连接数预算。同步、排行榜与限流写入按真实负载分析，先收集语句等待、锁等待和表增长，再决定是否调整。 [池化连接](https://neon.com/docs/connect/connection-pooling)
- [ ] 确认 Preview 使用独立 Neon 分支或项目、独立用户及合成数据。新建分支、操作付费资源或复制含真实用户数据的分支，单独经业务和权限方批准。仓库迁移脚本只能在操作人确认目标后执行，本次补丁无需迁移。 [部署与迁移](./vercel-neon.md)
- [ ] 核对备份保留窗、点时间恢复能力和访问权限，确保备份覆盖背景分块及文件、反馈附件、访问统计、SEO、注册策略和限流表。把数据库快照、应用提交、schema 版本与对应密钥版本关联存档。在隔离空库执行恢复并对照行数、业务读取、登录和加密设置的兼容性。 [备份与恢复](./vercel-neon.md) · [Neon 即时恢复](https://neon.com/docs/introduction/branch-restore)

## 授权 Preview 的验收与回滚

1. 确认目标 URL 和独立数据库，使用本次提交构建。先验证健康和 SEO noindex，再验证普通用户、另一个用户、管理员三种边界。
2. 用合成账号重复登录、改密撤销、分块图片、断网续练、跨设备草稿冲突和排行榜重复提交。用两个 Preview 实例核实共享限流与错误返回。
3. 检查桌面、移动、主题初始化、请求头和静态资源。记录请求 ID、冷热延时、CDN 是否命中。只在授权 Preview 做限量诊断。
4. 部署监测前确认回滚对象和权限。代码可逆序 revert 已列提交，schema 未变化。正式生产的发布、回退、变更入口保护和配置由操作人决定。
