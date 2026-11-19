# 成绩页与后台验收

本轮在云环境的独立数据库和工作分支验证，生产环境等待截图确认。成绩页参考用户提供的《A Service of Love》画面，以 TypeLune 配色重排标题、概览、过程、错字、四项统计及底部操作。英文 CPM 和计算说明保留，概览曲线来自实际过程采样。成绩状态、上榜提交、个人最佳与课程信息可在成绩弹窗内向下查看。

| 范围 | 验证 |
| --- | --- |
| 成绩 | Chromium 完成《A Service of Love》并捕获桌面和手机截图。浏览器用例覆盖继续本篇、上榜提交、错字、跨设备过程数据、英文双速度、PNG 下载与剪贴板复制。 |
| SEO | Chromium 切换页面和语言核对实时预览。输入多行抓取规则并保存，公开 `robots.txt` 与后台一致。现有浏览器用例核对双语 HTML、图片上传、Sitemap 和重载。 |
| 用户 | Chromium 验证规则界面、保存和重载、账号删除及会话失效。SQLite 和 PostgreSQL 验证名单优先级、子域、注册两个入口、管理员保护、并发删除、审计和数据库互转。 |
| 概览 | Chromium 验证前台访问上报、7 天和 30 天切换、国家和省州切换、趋势明细及手机布局。地区画面使用本地测试请求头，已注明测试数据。SQLite 和 PostgreSQL 验证聚合、数据迁移及隐私控制。 |
| 网络 | 云端代理路径对首页、`/api/health`、`/sitemap.xml` 的 HTTP/1.1、HTTP/2 GET 均返回 200。公网 DNS CNAME 在 Vercel 前还有一层代理。响应公布 HTTP/3，QUIC 握手未在当前代理路径验证，既往浏览器报错未复现。见 [Vercel 与 Neon 部署说明](../vercel-neon.md)。 |

SQLite 和隔离 PostgreSQL 均通过相关浏览器用例。Vercel 函数产物通过 Node 22 导入检查。未来切换需在目标 Neon schema 安装 `dashboard` 和 `registration-policy` 扩展，并用隔离 Preview 核对地理来源及实际域名连接协议。

最终在 Node 22 上运行类型检查、生产构建、Sites 包装及 Vercel 模块导入检查。带隔离 PostgreSQL 的完整 Vitest 运行共通过 864 项，跳过 4 项。SQLite 相关浏览器用例通过 9 项，PostgreSQL 相关浏览器用例通过 6 项。云环境截图原件与预览服务独立保留在工作区，未纳入仓库变更。
