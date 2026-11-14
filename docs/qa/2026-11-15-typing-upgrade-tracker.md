# typing 训练体验升级：需求与验证记录

基线：`imlotso/typing` 的 `main`，`0fa93ee17948e6edfb4570eea5db5bd40df2d365`；开发分支 `codex/typing-experience-upgrade`。基线通过 `npm run typecheck`、`npm test`（30 个测试文件、282 项）。这些测试不等于本任务的浏览器验收。以下状态是开发前对任务书整体验收条件的判断；“待完善”包括已有局部能力但尚未满足全部验收条件。提交栏仅在对应改动提交后填写，验证栏只记录实际证据。

| 编号 | 基线状态 | 对应提交 | 验证结果 / 剩余问题 |
| --- | --- | --- | --- |
| A01 | 待完善 | `8ce5874`、`0705057`、`e6dac69` | 账号设置、记录、个人数据、反馈和退出入口已接入；待稳定路由及完整角色回归。 |
| A02 | 待完善 | `4af0e6b`、`8ce5874` | 登录、注册、重置及修改密码表单已有显隐；修改密码表单尚需完整显隐验收。 |
| A03 | 待完善 | `8ce5874` | 已有当前密码复验、唯一性、并发检查及页面流程；待完整跨设备回归。 |
| A04 | 待完善 | `226f2a9` | 已有密码复验、绑定账号和目标的验证码、事务换绑及会话撤销；真实 SMTP 连接和投递尚未验证。 |
| A05 | 待完善 | `8ce5874` | 已有登录后修改、全部会话撤销及重新登录提示；待完整安全回归。 |
| A06 | 待完善 | `4af0e6b`、`226f2a9` | 已增加分邮箱、用途冷却和一致的发送错误响应；真实邮件投递尚待验收。 |
| A07 | 待完善 | `d30b251` | 已有设备列表、单设备及其他设备撤销、旧会话迁移；待最终回归。 |
| A08 | 待完善 | `8ce5874` | 独立昵称、内置头像及旧账号迁移已实现；待历史快照、跨设备和全部角色回归。 |
| A09 | 未实现 | — | 缺账号注销及其数据删除流程。 |
| B01 | 待完善 | `d26f532` | 已有页脚、帮助、联系及可维护的政策草案；运营主体、联系邮箱和正式生效日期待提供，稳定路由及后续功能说明待完善。 |
| B02 | 待完善 | `0705057` | 已有反馈、截图、游客登录交接、去重及访问控制；待最终回归。 |
| B03 | 待完善 | `0705057` | 已有筛选、回复、内部备注、状态及版本冲突处理；待最终回归。 |
| B04 | 待完善 | `0705057` | 已有个人列表、详情、状态变化和补充；待完整路由及最终回归。 |
| B05 | 待完善 | `0705057` | 练习页关联公开文章快照，后台可进入对应文章；待最终回归。 |
| C01 | 待完善 | `bfdaa46` | 已显示错误、待同步数量、上次云端项目数和最近成功时间；待最终跨设备及容量场景回归。 |
| C02 | 待完善 | — | 服务端 2,000 项、32 MiB 上限；删除标记占项目数，缺安全回收协议。 |
| C03 | 待完善 | `e6dac69` | 已有版本化 JSON、记录 CSV、完整历史分页及缺失项报告；待最终跨设备和失败场景回归。 |
| C04 | 待完善 | 本阶段提交 | 已有退出清理选项、未同步保护、按账号本机清理及新版标签页迟到写入阻断；旧版独立资料检查及旧客户端兼容待完善。 |
| C05 | 待完善 | — | 游客与账号数据隔离；缺显式导入、去重与恢复。 |
| D01 | 待完善 | — | `/admin` 有入口，主要前台视图由组件状态切换，缺稳定路由。 |
| D02 | 待完善 | — | 服务端设置已实施；前台缺完整公开配置及预提示。 |
| D03 | 待完善 | — | 已有历史详情及部分去重，缺全面筛选、删除和成绩撤回。 |
| D04 | 待完善 | — | 有部分成绩和复核状态，缺统一状态与公开处理说明。 |
| D05 | 待完善 | — | 草稿有恢复成绩入口；历史详情尚无对应入口。 |
| D06 | 待完善 | — | 私人文章已有编辑和快照，编辑防丢失需补齐。 |
| E01 | 未实现 | — | 缺按完整练习条件的个人最佳与比较。 |
| E02 | 待完善 | — | 已有累计错字专项；缺本轮复练和状态管理。 |
| E03 | 未实现 | — | 缺命名预设及跨设备同步。 |
| E04 | 未实现 | — | 缺目标配速。 |
| E05 | 待完善 | — | 有 Escape 暂停；缺命令面板和可配置快捷键。 |
| E06 | 未实现 | — | 缺独立实时指标显示设置。 |
| E07 | 待完善 | — | 已有错字专项，缺独立数字、标点与词组素材。 |
| E08 | 未实现 | — | 缺练习设置和预设的版本化导入导出。 |
| F01 | 待完善 | — | 已有 7/30 天概览；缺完整趋势、组合筛选及覆盖范围。 |
| F02 | 未实现 | — | 缺活动日历、连续天数、目标及账号统计时区。 |
| F03 | 未实现 | — | 旧记录无过程采样；缺有界持久化采样及稳定性计算。 |
| F04 | 未实现 | — | 缺成绩分享卡预览、下载和复制。 |
| G01 | 后置未实施 | — | 快速测试及定量练习不在本次默认实施范围。 |
| G02 | 后置未实施 | — | 慢词识别不在本次默认实施范围。 |
| G03 | 后置未实施 | — | 完整过程回放不在本次默认实施范围。 |
| G04 | 后置未实施 | — | 音效及更多光标样式不在本次默认实施范围。 |

## 基线观察

- 前台以视图状态切换页面；登录用户的账号按钮直接调用退出。现有自动测试通过不能证明新增需求已经验收。
- 数据保存在按用户 ID 隔离的 IndexedDB／降级存储和 SQLite 工作区。服务端验证工作区项目并剔除未声明字段，因此新增同步字段必须同时更新前后端校验。
- `workspace_items` 的删除标记仍占用项目配额。仅根据时间删除标记会允许离线旧设备复活旧数据。
- 账号使用 Argon2、哈希会话令牌、统一登录和一次性验证码；敏感操作需要在异步身份验证之后重新检查当前账号状态并以事务更新。
- 公开文章保留来源与快照；练习、恢复和排行榜由服务端校验。新增功能不得绕过这些约束。
- 构建存在既有的客户端包大于 500 kB 提示；真实性能影响尚未测量。
- 联系方式、运营主体、政策生效日期和真实 SMTP 投递尚无可验证配置；不得虚构。

## 验证日志

| 阶段 | 命令或实际流程 | 结果 |
| --- | --- | --- |
| 基线 | `npm run typecheck` | 通过。 |
| 基线 | `npm test` | 30 个测试文件、282 项通过。 |
| 基线 | `npm run build`；`npm run test:sites` | 通过；构建提示客户端包大于 500 kB。 |
| 基线 | `npm run test:e2e` | 22 项通过；仅模拟中文输入法，不代表真实系统输入法验收。 |
| 密码显隐、验证码 | `npx vitest run tests/auth-code-cooldown.test.tsx tests/auth-code-enumeration.test.ts tests/auth-password-visibility.test.tsx` | 6 项通过，覆盖显隐、焦点、重发倒计时及已注册／未注册邮箱冷却。 |
| 密码显隐 | `npx playwright test e2e/auth-visibility.e2e.ts` | 1 项通过；测试了真实 Chromium 无障碍名称、焦点、选区及隐藏。 |
| 密码显隐、验证码 | 隔离测试服务桌面日间、390 px 夜间实际页面 | 已查看登录页面和验证码冷却；[桌面截图](screenshots/auth-desktop-light.png)、[手机截图](screenshots/auth-mobile-dark.png)。测试邮箱使用内存邮件服务，未验证 SMTP 投递。 |
| 账号资料 | `npm run typecheck`、`npm test` | 通过；36 个测试文件、296 项通过。 |
| 账号资料 | `npm run build`、`npm run test:sites` | 通过；构建继续提示客户端包大于 500 kB。 |
| 账号资料 | `npx playwright test e2e/account.e2e.ts e2e/practice.e2e.ts -g 'updates account identity\|manages a live account'` | 2 项通过；包含资料刷新、密码更改后另一会话失效以及后台文章流程。 |
| 账号资料 | 完整 `npm run test:e2e` | 本次运行 23 项通过、1 项因旧测试仍按旧“直接退出”按钮查找失败；已更新测试并在上述定向浏览器运行中通过。完整套件需最终重跑。 |
| 账号资料 | 隔离测试服务桌面夜间、390 px 日间实际页面 | 已查看账号设置，表单可滚动；[桌面截图](screenshots/account-desktop-dark.png)、[手机截图](screenshots/account-mobile-light.png)。 |
| 邮箱与账号表单 | `npm run typecheck`、`npm test` | 类型检查通过；37 个测试文件、305 项通过，包括错误／过期验证码、不同账号、并发争用、发送失败和已撤销会话。 |
| 邮箱与账号表单 | `npm run build`；`npx playwright test e2e/account.e2e.ts` | 构建通过，2 项浏览器测试通过，包含换绑前后登录、另一会话失效、键盘焦点和密码显隐复位。 |
| 邮箱与账号表单 | 隔离测试服务 390 px 日间实际页面 | 已查看分组后的[账号设置](screenshots/account-mobile-grouped.png)及[更换邮箱](screenshots/email-mobile-grouped.png)。使用测试邮件，不代表真实 SMTP 送达。 |
| 反馈 | `npx playwright test e2e/feedback.e2e.ts` | 1 项通过：游客草稿和截图经登录提交，管理员处理后用户查看公开回复及补充。 |
| 反馈 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；40 个测试文件、317 项通过；构建仍有既有大包提示。 |
| 反馈 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker` | 通过；临时卷中的反馈图片在容器替换和 SQLite 备份恢复后字节一致。镜像构建后调整了处理人显示，最终须按交付版本重跑。 |
| 反馈 | 隔离测试服务实际页面 | 已查看[手机反馈表单](screenshots/feedback-mobile-light.png)、[手机后台列表](screenshots/feedback-admin-mobile.png)及[桌面夜间后台详情](screenshots/feedback-admin-desktop-dark.png)。截图中的反馈和账号均为测试数据。 |
| 帮助与政策 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；41 个测试文件、318 项通过。 |
| 帮助与政策 | `npx playwright test e2e/site-info.e2e.ts e2e/feedback.e2e.ts` | 2 项通过，包含手机页面跳转、练习暂停保留及反馈流程。 |
| 帮助与政策 | Docker 测试构建及 `DAZI_TEST_IMAGE=typing-upgrade-config-ci:local npm run test:docker` | 通过；测试配置已进入构建，Compose 配置检查通过，容器替换与备份恢复包含反馈附件。配置值为测试数据。 |
| 帮助与政策 | 隔离测试服务实际页面 | 已查看[桌面夜间帮助](screenshots/help-desktop-dark.png)和[手机夜间隐私政策](screenshots/privacy-mobile-dark.png)。 |
| 登录设备 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；42 个测试文件、323 项通过。 |
| 登录设备 | `npx playwright test e2e/account.e2e.ts` | 3 项通过；包含其他会话和当前会话撤销。 |
| 登录设备 | 隔离测试服务 390 px 日间实际页面 | 已查看[登录设备列表](screenshots/sessions-mobile-light.png)，账号和会话均为测试数据。 |
| 个人数据导出 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；45 个测试文件、327 项通过。 |
| 个人数据导出 | `npx playwright test e2e/personal-export.e2e.ts` | 1 项通过；实际下载 JSON 和 CSV，检查私人文章、草稿、背景、记录、反馈图片、密钥剔除及 CSV 公式保护。 |
| 个人数据导出 | 隔离测试服务 390 px 日间实际页面 | 已查看[个人数据入口](screenshots/personal-data-mobile.png)。 |
| 同步详情 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；46 个测试文件、330 项通过。 |
| 同步详情 | `npx playwright test e2e/sync-details.e2e.ts e2e/personal-export.e2e.ts` | 2 项通过；包含失败原因、待同步数、重试及导出。 |
| 本机清理 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；48 个测试文件、335 项通过。 |
| 本机清理 | `npx playwright test e2e/local-cleanup.e2e.ts e2e/background.e2e.ts` | 6 项通过；包含两个标签页、游客隔离、云端保留、重新登录恢复和背景回归。 |
| 本机清理 | `npx playwright test e2e/local-cleanup.e2e.ts` | 2 项通过；另外验证未同步提醒、重试同步和清理前确认。 |
