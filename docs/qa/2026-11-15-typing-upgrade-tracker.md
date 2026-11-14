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
| A09 | 待完善 | `a926668` | 已有导出入口、密码确认、事务删除、审计匿名化和最后管理员保护；待最终全量回归与旧客户端兼容检查。 |
| B01 | 待完善 | `d26f532` | 已有页脚、帮助、联系及可维护的政策草案；运营主体、联系邮箱和正式生效日期待提供，稳定路由及后续功能说明待完善。 |
| B02 | 待完善 | `0705057` | 已有反馈、截图、游客登录交接、去重及访问控制；待最终回归。 |
| B03 | 待完善 | `0705057`、`66f1778` | 已有筛选、回复、内部备注、状态及版本冲突处理；修复初次加载时状态选择被异步覆盖，待最终回归。 |
| B04 | 待完善 | `0705057` | 已有个人列表、详情、状态变化和补充；待完整路由及最终回归。 |
| B05 | 待完善 | `0705057` | 练习页关联公开文章快照，后台可进入对应文章；待最终回归。 |
| C01 | 待完善 | `bfdaa46` | 已显示错误、待同步数量、上次云端项目数和最近成功时间；待最终跨设备及容量场景回归。 |
| C02 | 待完善 | `7cb5379` | 已增加容量视图、代次／修订检查、删除标记整理和本机导出后重同步；按类型清理活动项目及完整旧客户端交替回归仍待完成。协议和回退见 [说明](2026-11-15-workspace-protocol.md)。 |
| C03 | 待完善 | `e6dac69` | 已有版本化 JSON、记录 CSV、完整历史分页及缺失项报告；待最终跨设备和失败场景回归。 |
| C04 | 待完善 | `a0eeb01` | 已有退出清理选项、未同步保护、按账号本机清理及新版标签页迟到写入阻断；旧版独立资料检查及旧客户端兼容待完善。 |
| C05 | 待完善 | `9e0e5a8` | 已有显式导入、冲突保护、个人成绩隔离、云端核对及可选清理；待与历史删除和后续数据模型整体回归，见 [说明](2026-11-15-guest-import.md)。 |
| D01 | 待完善 | — | `/admin` 有入口，主要前台视图由组件状态切换，缺稳定路由。 |
| D02 | 待完善 | `6cb2ae2` | 公开接口只返回三个功能开关；前台提示并限制注册／游客上榜，游客新练习关闭时直接本机开始。已有在线练习可恢复，待最终整体回归。 |
| D03 | 待完善 | — | 已有历史详情及部分去重，缺全面筛选、删除和成绩撤回。 |
| D04 | 待完善 | — | 有部分成绩和复核状态，缺统一状态与公开处理说明。 |
| D05 | 待完善 | — | 草稿有恢复成绩入口；历史详情尚无对应入口。 |
| D06 | 待完善 | `a77e3e9` | 关闭／取消、TXT 覆盖已有确认，保存失败保留输入；删除说明并经浏览器验证草稿快照保留，待最终回归。 |
| E01 | 待完善 | `3608105` | 已有条件分组、个人最佳、最近 10 次比较、服务端历史分页及不完整范围提示；记录删除后的重算待 D03 完成，见 [口径](2026-11-15-personal-best.md)。 |
| E02 | 待完善 | `7b9bd92` | 已有本轮复练、重复次数、状态和筛选、跨设备同步及截断提示；待最终整体回归，见 [说明](2026-11-15-mistake-training.md)。 |
| E03 | 待完善 | `d130c2e` | 已有创建、应用、更新、重命名、删除和账号同步；进行中切换保留草稿，待最终整体回归，见 [说明](2026-11-15-presets-settings-transfer.md)。 |
| E04 | 待完善 | `cb2a9b3` | 已有自定义／上次／最佳目标、有效时间比较和草稿持久化；待最终整体回归，见 [口径](2026-11-15-target-pace.md)。 |
| E05 | 待完善 | 本阶段 | 已有可搜索功能面板、可关闭快捷键、输入法／表单保护和重启确认；待真实系统输入法及最终回归，见 [说明](2026-11-15-command-palette.md)。 |
| E06 | 待完善 | `1026bb0` | 计时、速度和准确率已可独立隐藏并同步；结果及专注模式回归通过，待最终整体验收，见 [说明](2026-11-15-live-indicators.md)。 |
| E07 | 待完善 | — | 已有错字专项，缺独立数字、标点与词组素材。 |
| E08 | 待完善 | `d130c2e` | 已有独立版本化设置文件、严格校验、预览及确认导入；待与后续新增设置整体回归，见 [说明](2026-11-15-presets-settings-transfer.md)。 |
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
