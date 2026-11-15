# typing 训练体验升级：需求与验证记录

基线：`imlotso/typing` 的 `main`，`0fa93ee17948e6edfb4570eea5db5bd40df2d365`；开发分支 `codex/typing-experience-upgrade`。基线通过 `npm run typecheck`、`npm test`（30 个测试文件、282 项）。这些测试不等于本任务的浏览器验收。以下状态是开发前对任务书整体验收条件的判断；“待完善”包括已有局部能力但尚未满足全部验收条件。提交栏仅在对应改动提交后填写，验证栏只记录实际证据。

| 编号 | 当前状态 | 对应提交 | 验证结果 / 剩余问题 |
| --- | --- | --- | --- |
| A01 | 已实现且通过验收 | `8ce5874`、`0705057`、`e6dac69`、`bfb2ff5` | 账号菜单、角色入口、键盘和焦点、独立账号地址及退出后的游客隔离已通过接口和浏览器检查。 |
| A02 | 已实现且通过验收 | `4af0e6b`、`8ce5874`、`98b43d0` | 浏览器验证登录、注册、找回及修改密码显隐、焦点、表单关闭后隐藏和 Enter 提交；组件测试覆盖无障碍状态与自动填充。 |
| A03 | 已实现且通过验收 | `8ce5874` | 密码复验、唯一性、并发争用、稳定用户 ID、旧用户名失效和邮箱登录已通过接口及页面检查。 |
| A04 | 已实现且通过验收 | `226f2a9`、`32a9f48`、本次整合 | 密码复验、目标验证码、事务换绑、会话撤销及新旧邮箱登录已验证；隔离账号使用真实 Lark 邮件完成换绑与找回密码，未操作生产账号。 |
| A05 | 已实现且通过验收 | `8ce5874`、`98b43d0` | 当前密码和新密码校验、会话撤销、重新登录及密码显隐已通过接口和浏览器检查。 |
| A06 | 已实现且通过验收 | `4af0e6b`、`226f2a9`、`32a9f48`、本次整合 | 分邮箱与用途冷却、统一响应和发送失败处理已测试；Lark TLS 连接、身份验证及指定测试邮箱的实际收信已分别核实。 |
| A07 | 已实现且通过验收 | `d30b251` | 会话列表、设备撤销、当前设备即时退出和旧会话迁移已通过接口及两设备浏览器检查。 |
| A08 | 已实现且通过验收 | `8ce5874` | 独立昵称、内置头像、旧账号迁移及榜单当前昵称／提交快照已通过检查。 |
| A09 | 待完善 | `a926668` | 已有导出入口、密码确认、事务删除、审计匿名化和最后管理员保护；极旧标签页可能在本机清理后再次写入，见 C04。 |
| B01 | 已实现且通过验收 | `d26f532`、`55f7eea`、本次整合 | 页脚、帮助和政策页面已验证；按用户提供的信息配置运营主体、联系邮箱及 1.0 版政策，生效日期为 2026-11-15，仍可通过构建配置维护。 |
| B02 | 已实现且通过验收 | `0705057` | 反馈、截图、游客登录交接、重试去重和访问控制已通过接口、浏览器及容器持久化检查。 |
| B03 | 已实现且通过验收 | `0705057`、`66f1778` | 筛选、公开回复、内部备注、状态、审计及版本冲突处理已通过接口和浏览器检查。 |
| B04 | 已实现且通过验收 | `0705057`、`7a4bd23` | 个人列表、详情、状态变化、补充及独立详情地址已通过权限和浏览器检查。 |
| B05 | 已实现且通过验收 | `0705057` | 公开文章纠错关联文章和快照，后台可定位，私人正文不自动上传；已通过接口和页面检查。 |
| C01 | 已实现且通过验收 | `bfdaa46` | 同步错误、待处理数量、云端项目数、最近成功时间、部分失败及重试已通过检查。 |
| C02 | 已实现且通过验收 | `7cb5379`、`58fcff1`、`575d48a`、`d113ad3`、`01997fa`、`1c1fa87`、本次整合 | 满额、两设备、离线重连、删除标记回收、旧客户端拒绝及保留导出入口均已在 SQLite 和 PostgreSQL 验证，见[协议](2026-11-15-workspace-protocol.md)。 |
| C03 | 已实现且通过验收 | `e6dac69`、`575d48a`、`2ec14ec` | JSON／CSV、分页、缺失项、冲突副本及认证材料排除已通过接口和两设备浏览器检查，见[说明](2026-11-15-personal-export.md)。 |
| C04 | 待完善 | `a0eeb01`、`47e1d10`、`575d48a` | 已有账号隔离清理、旧版独立资料检查、本机导出及退出前后并发核对；极旧标签页跨存储的最终竞态仍存在，见[说明](2026-11-15-local-cleanup-safety.md)。 |
| C05 | 已实现且通过验收 | `9e0e5a8` | 显式导入、冲突保护、个人成绩隔离、重试去重、云端核对和可选清理已通过检查，见[说明](2026-11-15-guest-import.md)。 |
| D01 | 待完善 | `55f7eea`、`780d58b`、`ff0ca0c`、`7a4bd23`、`bfb2ff5`、`fffd9d5` | 主要页面与详情已有独立地址；支持 Navigation API 的浏览器可保护外部同源历史条目，不支持时仍使用保守回退，见[页面](2026-11-15-main-routes.md)、[文章](2026-11-15-article-routes.md)、[记录](2026-11-15-record-routes.md)、[反馈](2026-11-15-feedback-routes.md)、[账号](2026-11-15-account-route.md)。 |
| D02 | 已实现且通过验收 | `6cb2ae2` | 前台开关联动、获取失败重试和服务端最终限制已通过浏览器及接口检查；已有在线进度可恢复。 |
| D03 | 已实现且通过验收 | `e20806e`、`673152d`、`80c3e2b`、`575d48a`、`d113ad3`、`01997fa`、`1c1fa87`、本次整合 | 筛选、删除、成绩撤回与统计重算已验证；旧记录摘要再次被占用时使用服务端认证的备用标记，保留其他记录并拒绝不兼容客户端。 |
| D04 | 已实现且通过验收 | `da1103e`、`9bf9670` | 结果和历史展示服务端提交、审核、榜单状态及可公开说明；恢复原因和刷新更新已通过检查，见[说明](2026-11-15-score-status.md)。 |
| D05 | 已实现且通过验收 | `9bf9670` | 历史详情复用本机及账号同步草稿的恢复流程，权限、租约和不可恢复原因已通过检查，见[说明](2026-11-15-history-recovery.md)。 |
| D06 | 已实现且通过验收 | `a77e3e9` | 未保存修改、TXT 覆盖、保存失败和删除说明已验证，既有草稿快照保留。 |
| E01 | 已实现且通过验收 | `3608105`、`673152d` | 条件分组、个人最佳、近期比较、分页和删除后重算已通过检查，见[口径](2026-11-15-personal-best.md)。 |
| E02 | 已实现且通过验收 | `7b9bd92` | 本轮复练、重复次数、状态筛选、跨设备同步和截断提示已通过检查，见[说明](2026-11-15-mistake-training.md)。 |
| E03 | 已实现且通过验收 | `d130c2e` | 预设管理、账号同步及进行中切换保留草稿已通过检查，见[说明](2026-11-15-presets-settings-transfer.md)。 |
| E04 | 已实现且通过验收 | `cb2a9b3` | 自定义／上次／最佳目标、有效时间比较、暂停冻结和草稿恢复已通过检查，见[口径](2026-11-15-target-pace.md)。 |
| E05 | 已实现且通过验收 | `ca667cf`、`98b43d0` | 功能面板、快捷键开关、表单保护和重启确认已验证；Linux Fcitx5 拼音组合期间的快捷键保护已实测，见[说明](2026-11-15-command-palette.md)及[系统输入法](2026-11-15-system-ime.md)。 |
| E06 | 已实现且通过验收 | `1026bb0` | 计时、速度、准确率独立显示及同步，结果和专注模式回归通过，见[说明](2026-11-15-live-indicators.md)。 |
| E07 | 已实现且通过验收 | `27313a0` | 中英文数字、标点和词组专项、个人历史及跨设备同步已通过检查，见[说明](2026-11-15-special-training.md)。 |
| E08 | 已实现且通过验收 | `d130c2e` | 独立版本化设置文件、校验、预览、确认导入和草稿保护已通过检查，见[说明](2026-11-15-presets-settings-transfer.md)。 |
| F01 | 已实现且通过验收 | `e35e0e9`、`7c43938` | 长期日期、组合筛选、同条件趋势、分页、覆盖及缺失用时提示已通过检查，见[说明](2026-11-15-long-term-statistics.md)。 |
| F02 | 已实现且通过验收 | `7c43938` | 活动日历、连续天数、目标及账号同步时区已通过两设备和日期边界检查，见[说明](2026-11-15-activity-calendar.md)。 |
| F03 | 已实现且通过验收 | `3f99b38`、`98b43d0` | 有界采样、错误分布、稳定性和两设备恢复已验证；Linux Fcitx5 拼音组合期间采样已实测，见[说明](2026-11-15-process-trace.md)及[系统输入法](2026-11-15-system-ime.md)。 |
| F04 | 已实现且通过验收 | `9cad713` | 成绩卡预览、真实 PNG 下载、剪贴板复制及失败回退已验证，默认隐藏昵称和文章标题，见[说明](2026-11-15-share-card.md)。 |
| G01 | 后置未实施 | — | 快速测试及定量练习不在本次默认实施范围。 |
| G02 | 后置未实施 | — | 慢词识别不在本次默认实施范围。 |
| G03 | 后置未实施 | — | 完整过程回放不在本次默认实施范围。 |
| G04 | 后置未实施 | — | 音效及更多光标样式不在本次默认实施范围。 |

用户随后补充的 TypeFlow 品牌及排行榜分类、游客审核、日期清理需求已实现，并在[排行榜记录](2026-11-15-leaderboard-controls.md)中单独记录；整站最终回归和生产切换仍在进行。

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
| 反馈 | `npx playwright test e2e/feedback.e2e.ts` | 1 项通过：游客草稿和截图经登录提交，管理员处理后用户查看公开回复及补充；测试文件后重命名为 `e2e/z-feedback.e2e.ts`。 |
| 反馈 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；40 个测试文件、317 项通过；构建仍有既有大包提示。 |
| 反馈 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker` | 通过；临时卷中的反馈图片在容器替换和 SQLite 备份恢复后字节一致。镜像构建后调整了处理人显示，最终须按交付版本重跑。 |
| 反馈 | 隔离测试服务实际页面 | 已查看[手机反馈表单](screenshots/feedback-mobile-light.png)、[手机后台列表](screenshots/feedback-admin-mobile.png)及[桌面夜间后台详情](screenshots/feedback-admin-desktop-dark.png)。截图中的反馈和账号均为测试数据。 |
| 帮助与政策 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；41 个测试文件、318 项通过。 |
| 帮助与政策 | `npx playwright test e2e/site-info.e2e.ts e2e/feedback.e2e.ts` | 2 项通过，包含手机页面跳转、练习暂停保留及反馈流程；反馈测试文件后重命名为 `e2e/z-feedback.e2e.ts`。 |
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
| 账号注销 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；49 个测试文件、342 项通过。 |
| 账号注销 | `npx playwright test e2e/z-account-delete.e2e.ts e2e/z-feedback.e2e.ts e2e/local-cleanup.e2e.ts` | 6 项通过；包含注销前下载、最后管理员限制、响应丢失后清理重试及相关反馈回归。 |
| 账号注销 | 隔离测试服务 390 px 日间实际页面 | 已查看[注销确认界面](screenshots/account-delete-mobile.png)；未在该预览中执行注销。 |
| 阶段回归 | `npm run test:e2e` | 35 项通过，包含现有逐行练习、模拟输入法、恢复上榜、背景、后台、反馈及新增账号／数据流程；未替代真实系统输入法和真实 SMTP 送达。 |
| 账号注销 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker` | 容器启动、练习恢复、反馈附件、卷替换和备份恢复通过；该脚本未单独执行账号注销。 |
| 工作区整理 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；56 个测试文件、360 项通过。测试包括迁移重入、2,000 项配额释放、过期代次拒写、批次原子性及上传期间再次编辑。 |
| 工作区整理 | `npm run test:e2e` | 36 项通过；双浏览器验证离线删除、整理后本机导出、显式重同步与防复活。真实系统输入法及真实 SMTP 投递仍未验证。 |
| 工作区整理 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker` | 通过；容器卷替换与备份恢复可用。迁移重入由单元测试覆盖，容器脚本未单独验证整理后的回退。 |
| 工作区整理 | 隔离测试服务实际页面 | 已查看[手机日间容量整理](screenshots/workspace-capacity-mobile-confirm.png)及[桌面夜间恢复](screenshots/workspace-recovery-desktop-dark.png)。 |
| 私人文章防丢失 | `npx vitest run tests/private-editor.test.tsx tests/feature-views.test.tsx`；`npm run typecheck`、`npm run build`、`npm run test:sites` | 均通过；覆盖未保存修改、TXT 覆盖、保存失败、焦点及删除提示。 |
| 私人文章防丢失 | `npx playwright test e2e/private-editor.e2e.ts` | 1 项通过：实际创建、编辑和删除私人文章，验证既有草稿继续使用原文快照。 |
| 私人文章防丢失 | 隔离测试服务 390 px 日间实际页面 | 已查看[未保存修改确认](screenshots/private-editor-confirm-mobile.png)。 |
| 前台站点开关 | `npm run typecheck`、`npx vitest run tests/site-features-ui.test.tsx tests/site-settings.test.ts tests/recovery-practice.test.tsx`、`npm run build`、`npm run test:sites` | 均通过；定向测试 31 项通过，覆盖公开字段、配置失败重试、注册切换和游客本机练习。 |
| 前台站点开关 | `npx playwright test e2e/site-features.e2e.ts` | 2 项通过：后台关停后前台提示、既有游客在线练习继续、限制上榜及获取配置失败后重试。 |
| 前台站点开关 | 隔离测试服务 390 px 日间实际页面 | 已查看[练习状态提示](screenshots/site-flags-mobile-updated.png)及[注册关闭提示](screenshots/site-flags-auth-mobile.png)，测试后已恢复预览开关。 |
| 反馈回归问题 | 一次 `npm test` 全量运行 | 发现后台表单选中状态可能被加载效果覆盖；`66f1778` 已移除该时序依赖，定向反馈 UI／接口测试 8 项通过，仍需完整重跑。 |
| 游客导入 | `npx playwright test e2e/guest-import.e2e.ts` | 2 项通过：取消、重复导入、云端确认、选择清理、断网失败后重试及游客隔离。 |
| 游客导入 | 隔离测试服务实际页面 | 已查看[手机导入预览](screenshots/guest-import-mobile.png)和[桌面清理确认](screenshots/guest-import-clear-desktop.png)。 |
| 游客导入与反馈修复 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；60 个测试文件、377 项通过，包含超出旧界面展示上限的历史、损坏草稿和设置覆盖冲突。 |
| 游客导入与反馈修复 | `npx playwright test e2e/guest-import.e2e.ts e2e/z-feedback.e2e.ts` | 3 项通过；此前完整浏览器套件 41 项通过，之后仅对旧游客资料边界及反馈状态同步作了局部调整。 |
| 个人最佳 | `npx vitest run tests/personal-best.test.ts tests/personal-best-ui.test.tsx tests/history-pages.test.ts tests/personal-export-fetch.test.ts tests/full-app.test.tsx` | 定向测试通过；覆盖当前记录排除、分组、重复 ID 的服务端成绩优先、分页及失败范围。 |
| 个人最佳 | `npx playwright test e2e/personal-best.e2e.ts e2e/personal-export.e2e.ts` | 3 项通过：游客连续成绩比较、账号分页与失败范围提示、个人数据导出回归。 |
| 个人最佳 | 隔离测试服务实际页面 | 已查看[手机日间成绩](screenshots/personal-best-mobile-light.png)及[桌面夜间成绩](screenshots/personal-best-desktop-dark.png)。 |
| 个人最佳 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；63 个测试文件、388 项通过。 |
| 错字训练 | `npm run typecheck`、`npm test` | 通过；65 个测试文件、395 项通过，覆盖截断恢复及旧客户端不抹除状态。 |
| 错字训练 | `npx playwright test e2e/mistake-training.e2e.ts` | 2 项通过：纠正过的错字生成个人专项，以及两设备掌握／恢复状态同步。 |
| 错字训练 | 隔离测试服务实际页面 | 已查看[手机结果复练入口](screenshots/mistake-round-mobile.png)及[桌面夜间错字本](screenshots/mistake-notebook-desktop-dark.png)。 |
| 错字训练 | `npm run build`、`npm run test:sites`；`npx playwright test e2e/mistake-training.e2e.ts e2e/recovery.e2e.ts e2e/guest-import.e2e.ts e2e/personal-best.e2e.ts` | 均通过；12 项浏览器流程覆盖相关恢复、游客导入和成绩比较回归。 |
| 实时指标 | `npx vitest run tests/live-indicators.test.tsx tests/workspace-reclamation.test.ts tests/guest-import.test.ts` | 定向测试通过；覆盖旧客户端保留字段、失败回退及连续切换的先后顺序。 |
| 实时指标 | `npx playwright test e2e/live-indicators.e2e.ts` | 1 项通过：独立开关、专注模式、完整英文结果及第二设备同步。 |
| 实时指标 | 隔离测试服务 390 px 日间实际页面 | 已查看[实时指标设置](screenshots/live-indicators-settings-mobile.png)。 |
| 实时指标 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites`；相关 Playwright 流程 | 均通过；66 个测试文件、399 项通过，指标、游客导入和错字训练共 5 项浏览器流程通过。 |
| 预设与设置导入 | `npx playwright test e2e/presets-settings.e2e.ts` | 3 项通过：进行中切换并恢复草稿、设置文件校验预览、两设备同步及旧草稿存储失效时的工作区回退。 |
| 预设与设置导入 | 隔离测试服务实际页面 | 已查看[手机预设](screenshots/presets-mobile-light.png)及[桌面夜间设置预览](screenshots/settings-import-desktop-dark.png)。 |
| 预设与设置导入 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；69 个测试文件、415 项通过。 |
| 阶段回归 | `npm run test:e2e`；`npx playwright test e2e/personal-best.e2e.ts e2e/presets-settings.e2e.ts` | 完整套件 49 项通过；随后收紧个人最佳不完整范围提示，相关 5 项定向浏览器流程通过。 |
| 目标配速 | `npx vitest run tests/pace.test.ts tests/pace-practice.test.tsx tests/pace-settings-ui.test.tsx tests/practice-settings-transfer.test.ts tests/workspace-reclamation.test.ts tests/guest-import.test.ts` | 定向测试通过：中英文换算、来源分组、暂停／恢复及旧客户端兼容。 |
| 目标配速 | `npx playwright test e2e/pace.e2e.ts e2e/presets-settings.e2e.ts` | 6 项通过：暂停冻结、下轮应用、账号同步、上次成绩、无目标继续练习及预设／草稿回归。 |
| 目标配速 | 隔离测试服务实际页面 | 已查看[手机配速提示](screenshots/pace-mobile-light.png)及[桌面夜间配速设置](screenshots/pace-settings-desktop-dark.png)。 |
| 目标配速 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；72 个测试文件、423 项通过。 |
| 目标配速 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker` | 容器启动、练习恢复、反馈附件、卷替换及备份恢复通过；脚本未单独验证配速字段。 |
| 快捷操作 | `npx vitest run tests/shortcuts.test.tsx tests/command-palette-ui.test.tsx tests/practice-settings-transfer.test.ts tests/workspace-reclamation.test.ts` | 定向测试通过：模拟组合输入、表单和弹窗保护、关闭开关及旧客户端字段兼容。 |
| 快捷操作 | `npx playwright test e2e/shortcuts.e2e.ts e2e/presets-settings.e2e.ts` | 6 项通过：搜索、暂停／继续、重启确认、页面导航、双设备开关和专注模式；输入法为模拟事件。 |
| 快捷操作 | 隔离测试服务实际页面 | 已查看[手机功能面板](screenshots/command-palette-mobile.png)及[桌面夜间搜索](screenshots/command-palette-desktop-dark.png)。 |
| 管理员预览回归 | `npx vitest run tests/admin-entry.test.tsx -t 'explicit site preview\|same-account session' --repeats=9` | 通过；修复同一账号延迟恢复时错误清除前台预览状态。 |
| 快捷操作 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；74 个测试文件、429 项通过。 |
| 快捷操作 | `npx playwright test e2e/shortcuts.e2e.ts e2e/presets-settings.e2e.ts e2e/practice.e2e.ts` | 17 项通过；随后补充卸载保护，快捷操作 3 项定向浏览器流程再次通过。 |
| 成绩分享卡 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；76 个测试文件、433 项通过；构建继续提示客户端包大于 500 kB。 |
| 成绩分享卡 | `npx playwright test e2e/share-card.e2e.ts e2e/personal-best.e2e.ts` | 4 项通过，包含真实 PNG 下载与剪贴板图片复制，以及个人最佳比较回归。 |
| 成绩分享卡 | 隔离测试服务实际页面 | 已查看[手机日间预览](screenshots/share-dialog-mobile-light.png)、[桌面夜间预览](screenshots/share-dialog-desktop-dark.png)及[浅色成品](screenshots/share-card-light.png)、[夜间成品](screenshots/share-card-dark.png)。 |
| 历史筛选 | `npx vitest run tests/history-filter.test.ts tests/history-filter-ui.test.tsx tests/feature-views.test.tsx`；`npm run typecheck`、`npm run build` | 均通过；定向测试 11 项通过。 |
| 历史筛选 | `npx playwright test e2e/history-filter.e2e.ts` | 1 项通过；此前一次定向运行因测试定位器未匹配嵌套选项文本超时，改用可访问角色后通过。 |
| 历史筛选 | 隔离测试服务实际页面 | 已查看[桌面夜间](screenshots/history-filters-desktop-dark.png)及[手机日间](screenshots/history-filters-mobile-light.png)。 |
| 历史删除 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；81 个测试文件、443 项通过。构建继续提示客户端包大于 500 kB。 |
| 历史删除 | `npx playwright test e2e/history-delete.e2e.ts e2e/personal-best.e2e.ts e2e/guest-import.e2e.ts` | 7 项通过；随后新增统计与个人最佳重算场景，单独 1 项通过。 |
| 历史删除 | 隔离测试服务实际页面 | 已查看[手机日间确认](screenshots/history-delete-mobile-light.png)及[桌面夜间批量选择](screenshots/history-delete-desktop-dark.png)。 |
| 阶段回归 | `npm run test:e2e` | 62 项通过；本次仍以模拟事件覆盖中文输入法，未代表真实系统输入法或 SMTP 投递验收。帮助／隐私文案随后单独重新构建和验证。 |
| 历史删除补充 | `npx vitest run tests/history-delete-api.test.ts` | 5 项通过，包括并发重复请求、游客身份丢失、注销后恢复阻断及容量不足时事务回滚。 |
| 最终文案重验 | `npm run build`、`npm run test:sites`；`npx vitest run tests/site-info.test.tsx`；`npx playwright test e2e/site-info.e2e.ts e2e/history-delete.e2e.ts` | 均通过；Sites 4 项、相关浏览器流程 5 项通过。 |
| 旧历史兼容 | `npx vitest run tests/legacy-history.test.ts tests/personal-best-ui.test.tsx tests/personal-export-fetch.test.ts tests/guest-import.test.ts tests/history-delete-client.test.ts` | 21 项通过，覆盖有效旧记录、损坏提示、导出及游客导入兼容。 |
| 旧历史兼容 | `npx playwright test e2e/legacy-history.e2e.ts` | 1 项通过：65 条旧记录、新成绩、缺字段无 ID 记录及损坏条目的读取、保留和删除。 |
| 跨标签页结算问题 | 一次 `npm test` | 发现 1 项失败：第二标签页在第一标签页仍结算时打开同一草稿的离线结果；已用延迟 `/finish` 响应稳定复现并增加租约检查。 |
| 跨标签页结算修复 | `npx vitest run tests/auto-start.test.tsx -t 'keeps one result across tabs\|does not reopen a completed draft' --repeats=15` | 两个场景重复通过；真实浏览器及整体回归结果另记。 |
| 旧历史与结算回归 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；82 个测试文件、448 项通过；构建仍提示客户端包大于 500 kB。 |
| 旧历史与结算回归 | `npx playwright test e2e/completed-draft-tabs.e2e.ts e2e/legacy-history.e2e.ts e2e/recovery.e2e.ts` | 8 项通过；实际双标签页结算不重复显示，既有离线恢复和上榜流程回归通过。 |
| 主要页面地址 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；84 个测试文件、450 项通过；构建仍提示客户端包大于 500 kB。 |
| 主要页面地址 | 隔离测试服务实际页面 | 已查看[桌面夜间文章库](screenshots/navigation-library-desktop-dark.png)及[手机夜间未找到页面](screenshots/navigation-notfound-mobile-dark.png)。 |
| 主要页面地址 | `npx playwright test e2e/navigation.e2e.ts e2e/private-editor.e2e.ts e2e/site-info.e2e.ts e2e/practice.e2e.ts` | 21 项通过，含直接访问、刷新、前进／后退、保存失败、未保存文章、账号和管理员预览。 |
| 公共文章地址 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；84 个测试文件、451 项通过，构建仍提示客户端包大于 500 kB。 |
| 公共文章地址 | `npx playwright test e2e/article-route.e2e.ts`；相关导航及私人文章流程 | 3 项通过；此前相关组合 11 项通过，覆盖实际复制、重试、隐私边界及草稿保留。 |
| 记录详情地址 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；84 个测试文件、452 项通过；构建继续提示客户端包大于 500 kB。 |
| 记录详情地址 | `npx playwright test e2e/record-route.e2e.ts e2e/legacy-history.e2e.ts` | 3 项通过；此前相关导航、删除及详情组合 14 项通过。 |
| 反馈详情地址 | 一次并行 `npm test` | 发现提交响应晚于用户进入另一详情时会跳回旧提交；已用受控延迟复现并保护当前地址。 |
| 反馈详情地址 | `npx vitest run tests/feedback-route-ui.test.tsx tests/feedback-ui.test.tsx tests/routes.test.ts` | 11 项通过，覆盖详情迟到响应、提交迟到响应及损坏列表重试。 |
| 反馈详情地址 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；85 个测试文件、456 项通过；构建仍提示客户端包大于 500 kB。 |
| 反馈详情地址 | `npx playwright test e2e/feedback-route.e2e.ts e2e/z-feedback.e2e.ts` | 4 项通过，含详情刷新、登录、权限、重试和游客截图／管理员回复。 |
| 账号中心地址 | 中间单元检查 | 发现确认关闭时已显示的密码未重新隐藏；已增加显隐重置及焦点恢复测试。登录设备测试调整为等待刷新完成后再操作。 |
| 账号中心地址 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；86 个测试文件、458 项通过；构建仍提示客户端包大于 500 kB。 |
| 账号中心地址 | `npx playwright test e2e/account-route.e2e.ts e2e/account.e2e.ts` | 7 项通过；涉及账号修改、设备、邮箱验证码、路由保护和管理员预览。测试邮件使用内存服务。 |
| 成绩状态 | 一次 `npm test` | 旧数据库测试需先移除新榜单索引后模拟旧结构；历史 UI 测试已改用服务端明确状态，相关 32 项定向测试通过。 |
| 成绩状态 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；89 个测试文件、466 项通过；构建仍提示客户端包大于 500 kB。 |
| 成绩状态 | `npx playwright test e2e/score-status.e2e.ts e2e/recovery.e2e.ts` | 8 项通过，含管理员用户可见说明、结果／历史更新、回包丢失和游客恢复。 |
| 成绩状态 | 隔离测试服务实际页面 | 已查看[手机夜间](screenshots/score-status-mobile-dark.png)和[桌面日间](screenshots/score-status-desktop-light.png)待复核结果。 |
| 历史成绩恢复 | 中间浏览器回归 | 发现失败恢复请求的标记差异会掩盖同一份完成草稿；按内容、进度和认领版本核对后修复，并保留草稿箱个人成绩查看。 |
| 历史成绩恢复 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；91 个测试文件、471 项通过；构建仍提示客户端包大于 500 kB。 |
| 历史成绩恢复 | `npx playwright test e2e/history-recovery.e2e.ts e2e/recovery.e2e.ts e2e/score-status.e2e.ts e2e/record-route.e2e.ts` | 14 项通过，含本机与另一账号设备恢复、租约冲突及服务端审核回归。 |
| 历史成绩恢复补充 | `npx vitest run tests/result-recovery-ui.test.tsx tests/feature-views.test.tsx`；`npx playwright test e2e/history-recovery.e2e.ts` | 9 项单元／组件测试及 4 项浏览器流程通过；合并了个人练习重复状态文案。 |
| 长期统计 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；93 个测试文件、477 项通过；构建仍提示客户端包大于 500 kB。 |
| 长期统计 | `npx playwright test e2e/long-term-stats.e2e.ts e2e/history-delete.e2e.ts` | 6 项通过，含完整分页去重、条件分组、图表跳转、缺失用时和删除后重算。 |
| 活动日历 | 初次浏览器检查 | 两项因“日历设置”测试定位器匹配到保存按钮而失败；改用精确标签后两项通过。 |
| 活动日历 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；95 个测试文件、488 项通过；构建仍提示客户端包大于 500 kB。 |
| 活动日历 | `npx playwright test e2e/activity-calendar.e2e.ts e2e/long-term-stats.e2e.ts e2e/guest-import.e2e.ts` | 6 项通过，包含两设备时区与目标同步、日期边界和导出；单元测试另覆盖夏令时和跨午夜。 |
| 活动日历 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker` | 容器替换和 SQLite 备份恢复后统计时区、目标及既有附件保留。 |
| 过程采样 | 一次 `npm test` | 发现图中微小的坐标数字与已有成绩数字重复，导致一个恢复测试定位失败；已移除难辨的坐标文字，改在图例中显示可读的最高值。 |
| 过程采样 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；98 个测试文件、500 项通过；构建仍提示客户端包大于 500 kB。 |
| 过程采样 | `npx playwright test e2e/process-trace.e2e.ts e2e/recovery.e2e.ts e2e/mistake-training.e2e.ts` | 9 项通过；图例调整后过程采样流程单独重跑通过。包含两设备同步、成绩恢复及个人专项回归。 |
| 过程采样 | 隔离测试服务实际页面 | 已查看[桌面日间结果](screenshots/process-trace-desktop-light.png)与[手机夜间详情](screenshots/process-trace-mobile-dark.png)。 |
| 数字／标点／词组专项 | `npm run typecheck`、`npm run build`、`npm run test:sites`；相关单元测试 | 均通过；定向单元与组件测试 40 项通过。 |
| 数字／标点／词组专项 | 首次扩展浏览器检查 | 第二设备详情的测试预期与现有“无法恢复：个人练习不参与排行”文案不符；核对实际状态并修正测试。 |
| 数字／标点／词组专项 | `npx playwright test e2e/special-training.e2e.ts` | 3 项通过，覆盖原草稿保留、个人记录和上榜隔离、账号两设备同步与手机布局。 |
| 容量分类管理 | `npm run typecheck`、`npm run build`、`npm run test:sites`；相关单元测试 | 均通过；19 项定向测试通过。小容量按实际字节或 KiB 显示。 |
| 容量分类管理 | `npx playwright test e2e/workspace-capacity-management.e2e.ts e2e/workspace-reclamation.e2e.ts` | 2 项通过，涵盖设置／收藏的跨设备删除、离线重连与整理后防复活。 |
| 本机清理保护 | 导出缺失项定向测试 | 发现合法 JSON 但字段不完整的旧草稿未列入导出缺失项；补充检测后定向测试通过。 |
| 本机清理保护 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；101 个测试文件、507 项通过；构建仍提示客户端包大于 500 kB。 |
| 本机清理保护 | `npx playwright test e2e/local-cleanup.e2e.ts e2e/guest-import.e2e.ts` | 10 项通过；另有背景、游客导入及清理组合 13 项通过。覆盖本机导出、已同步副本、清理前及退出期间的旧页面写入。 |
| 本机清理保护 | 隔离测试服务实际页面 | 已查看[桌面](screenshots/local-cleanup-legacy-desktop.png)和[手机](screenshots/local-cleanup-legacy-mobile.png)未确认同步提示。 |
| 旧工作区记录 | `npx vitest run tests/history-delete-api.test.ts tests/history-delete-client.test.ts tests/workspace-migration.test.ts tests/workspace-reclamation.test.ts tests/workspace-capacity-ui.test.tsx tests/legacy-workspace-records.test.ts tests/personal-export.test.ts tests/local-practice-unsynced.test.ts` | 35 项定向测试通过；补充测试单独验证注销后的关联标记级联删除。 |
| 旧工作区记录 | `npm test`、`npm run typecheck`、`npm run build`、`npm run test:sites` | 均通过；102 个测试文件、519 项通过；构建仍提示客户端包大于 500 kB。 |
| 旧工作区记录 | `npx playwright test e2e/legacy-workspace-records.e2e.ts e2e/workspace-capacity-management.e2e.ts e2e/workspace-reclamation.e2e.ts` | 3 项通过；随后单独复验容量页面关联标记提示，1 项通过。 |
| 旧工作区记录 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker` | 容器替换与 SQLite 备份恢复后，旧记录删除关联标记、统计设置及反馈附件保留。 |
| 全站浏览器回归 | `npm run test:e2e` | 105 项通过、1 项失败：过程图计算说明包含“有效用时”，旧测试的非精确文本定位匹配到两处；已改为精确匹配并单独复测通过。 |
| 密码显隐与指标 | `npx playwright test e2e/auth-visibility.e2e.ts e2e/live-indicators.e2e.ts` | 4 项通过，实际覆盖注册、找回、修改密码的显隐及 Enter 提交，指标测试在精确定位后通过。邮件使用隔离内存服务。 |
| 真实系统输入法 | `TYPING_XVFB_BINARY=<临时解包的 Xvfb> scripts/verify-system-ime.sh` | Linux Fcitx5 拼音与 Chrome X11 的可信组合事件、首次计时、过程采样、快捷键保护、跨行退格和暂停／刷新／继续通过；其他系统及手机输入法未验证，见[记录](2026-11-15-system-ime.md)。 |
| SMTP 与日志 | `npx vitest run tests/dev-mail-logging.test.ts tests/smtp-wire.test.ts tests/auth-code-enumeration.test.ts tests/account-email.test.ts tests/admin-smtp.test.ts` | 验证开发入口不再记录验证码、本机真实 SMTP 握手和测试接收端收信；外部服务商连接与真实收件箱送达未验证，见[记录](2026-11-15-smtp-validation.md)。 |
| 导出冲突副本 | `npx vitest run tests/personal-export.test.ts tests/personal-export-fetch.test.ts tests/legacy-history.test.ts tests/local-practice-unsynced.test.ts tests/logout-dialog.test.tsx` | 覆盖本机与云端不同版本、已删除旧副本、损坏项及认证材料排除。 |
| 导出冲突副本 | `npx playwright test e2e/personal-export.e2e.ts e2e/local-cleanup.e2e.ts e2e/z-account-delete.e2e.ts` | 13 项通过；两设备模拟冲突并核对 JSON 中两个版本，CSV 提示未合并副本仅在 JSON 中。 |
| 外部历史条目 | `npx playwright test e2e/navigation.e2e.ts e2e/account-route.e2e.ts e2e/record-route.e2e.ts`；外部条目定向复测 | 15 项及额外 2 项通过；Chrome 中保存失败时，未标记的同源前进／后退条目保留。 |
| 旧记录关联补充 | `npm run typecheck`；相关单元、浏览器与 Docker 检查 | 32 项定向单元测试、13 项浏览器流程及容器备份恢复通过；常见旧状态和同步代次差异可核验，一条原记录最多对应一个关联标识。 |
| 最终自动化回归 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；104 个测试文件、528 项单元测试，Sites 4 项通过。构建保留客户端包大于 500 kB 的提示。 |
| 最终浏览器回归 | `npm run test:e2e` | 111 项通过；覆盖游客、普通账号、管理员、桌面与手机视口、日夜模式、资料与反馈、同步、历史、练习和分享。SMTP 邮箱为测试服务；真实 Linux 拼音另见[记录](2026-11-15-system-ime.md)。 |
| 最终容器回归 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker` | 容器启动、所有权、暂停恢复、反馈附件、统计设置、旧记录标记、卷替换和 SQLite 备份恢复通过。 |
| 最新预览 | 隔离本机服务与浏览器 | [桌面日间](screenshots/preview-current-desktop.png)与[手机夜间](screenshots/preview-current-mobile-dark.png)已检查；预览使用临时数据库且未配置真实 SMTP。 |
| 旧记录冲突与客户端能力 | `npx vitest run tests/history-delete-api.test.ts tests/history-delete-client.test.ts tests/personal-export.test.ts tests/legacy-workspace-records.test.ts` | 36 项通过，覆盖满额、跨账号、伪造标记、普通同前缀 ID、游客和旧版同步拒绝。 |
| 旧记录冲突与客户端能力 | `npx playwright test e2e/legacy-workspace-records.e2e.ts e2e/history-delete.e2e.ts e2e/workspace-reclamation.e2e.ts e2e/personal-export.e2e.ts` | 9 项通过，包括多设备删除、离线、整理后防复活及本机导出。 |
| 上一版前端 | `TYPING_LEGACY_TEST_URL=http://127.0.0.1:4210 node scripts/verify-legacy-client.mjs` | 使用 `809de62` 的实际浏览器构建及隔离测试服务，收到 426、显示更新提示且保留本机记录，见[方法](2026-11-15-legacy-workspace-records.md)和[截图](screenshots/legacy-client-sync-warning.png)。 |
| 冲突修复后全量回归 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 均通过；104 个测试文件、538 项单元测试，Sites 4 项通过。构建保留客户端包大于 500 kB 的提示。 |
| 冲突修复后浏览器回归 | `npm run test:e2e` | 112 项通过；真实 Linux Fcitx5 拼音另行实测通过，其他系统输入法未实测。 |
| 冲突修复后容器回归 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker` | 最新镜像构建和容器、持久卷、SQLite 备份恢复通过。此前一次构建期间因 `/var` 临时空间不足导致 SQLite `SQLITE_FULL`；隔离卷探针与后续重试通过，未清理其他项目容器或数据。 |
| 满额旧状态 | `npx vitest run tests/history-delete-api.test.ts tests/history-delete-client.test.ts tests/legacy-workspace-records.test.ts tests/personal-export.test.ts` | 39 项通过，覆盖旧状态、事务修订、并发占用和幂等重试。 |
| 满额旧状态 | `npx playwright test e2e/legacy-workspace-records.e2e.ts e2e/history-delete.e2e.ts` | 7 项通过，包含 2,000 项满额、未读取时拒绝删除、两设备传播和整理后恢复新增。首次针对新用例运行时发现云端未读取完即删除导致容量错误；已修复并复测。另一次测试因启动前未重新构建而主动中断。 |
| 最新自动化回归 | `npm run typecheck`、`npm test`、`npm run build`、`npm run test:sites` | 通过；104 个测试文件、541 项单元测试及 Sites 4 项通过。构建仍提示客户端包大于 500 kB。 |
| 最新浏览器回归 | `npm run test:e2e -- --output /tmp/typing-full-e2e-final-1c1fa` | 113 项通过。此前一次全量运行时并行的定向测试清理了共用的 Playwright 临时目录，导致 1 项在关闭浏览器时出现跟踪文件 `ENOENT`；已中断该轮并隔离输出后全量重跑。 |
| 最新容器与系统输入法 | `docker build -t typing-upgrade-ci:local .`；`DAZI_TEST_IMAGE=typing-upgrade-ci:local npm run test:docker`；`TYPING_XVFB_BINARY=<临时解包的 Xvfb> scripts/verify-system-ime.sh` | 容器持久卷和备份恢复通过；Linux Fcitx5 真实拼音组合、计时、采样、跨行退格及暂停恢复通过。Windows、macOS 和手机系统输入法未实测。 |
