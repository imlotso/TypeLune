export type InfoPage = 'help' | 'about' | 'privacy' | 'terms';
export const infoLabels: Record<InfoPage, string> = { help: '使用帮助', about: '关于与联系', privacy: '隐私政策', terms: '服务条款' };

// These public build-time values contain no secrets. Policy text is maintained below.
const configured = (value: string | undefined) => value?.trim() || '';
const date = (value: string | undefined) => {
  const input = configured(value);
  const parsed = new Date(`${input}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(input) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === input ? input : '';
};
// Public operation details provided by the site owner on 2026-11-15.
// Deployments may override these values through the documented build variables.
const publicDefaults = {
  operator: 'www.sitetalk.net', contactEmail: 'admin@imlotso.com',
  privacyVersion: '1.0', privacyEffectiveDate: '2026-11-15', termsVersion: '1.0', termsEffectiveDate: '2026-11-15',
};
const publicEnv = import.meta.env ?? (typeof process !== 'undefined' ? process.env : {});
const email = configured(publicEnv.VITE_SITE_CONTACT_EMAIL) || publicDefaults.contactEmail;
export const siteInfo = {
  operator: configured(publicEnv.VITE_SITE_OPERATOR) || publicDefaults.operator,
  contactEmail: /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email) ? email : '',
  privacyVersion: configured(publicEnv.VITE_PRIVACY_VERSION) || publicDefaults.privacyVersion,
  privacyEffectiveDate: date(publicEnv.VITE_PRIVACY_EFFECTIVE_DATE || publicDefaults.privacyEffectiveDate),
  termsVersion: configured(publicEnv.VITE_TERMS_VERSION) || publicDefaults.termsVersion,
  termsEffectiveDate: date(publicEnv.VITE_TERMS_EFFECTIVE_DATE || publicDefaults.termsEffectiveDate),
};

export const helpSections = [
  ['账号', '通过登录入口注册、登录或找回密码。账号设置可更改用户名、邮箱、密码及公开资料，并管理登录设备；邮箱验证需要可用的邮件服务。'],
  ['练习', '首次输入或开始输入法组合时计时，单独聚焦不计时。暂停不计入有效时间；设置中可开启严格纠错，未完成的长文可从草稿箱继续。'],
  ['速度', '中文速度按正确字符数除以有效分钟数计算。英文字符/分钟采用相同口径，WPM 为字符/分钟除以 5；正确的空格和标点也计入。'],
  ['草稿与同步', '游客资料保存在本机；账号资料按账号隔离并可同步。同步失败时仍可使用本机资料，在练习设置中重试；空间不足时需清理资料。'],
  ['成绩', '公共文章成绩由服务端校验，游客昵称以 visitor 开头；游客榜与用户榜分开显示，成绩可能待复核或未通过。中断的合格在线练习可从草稿箱尝试恢复成绩。'],
  ['个人数据', '记录可单条或批量删除，并撤回关联的公开成绩；统计和个人最佳随之更新。账号菜单中的个人数据可导出 JSON 或记录 CSV，也可清除此设备的当前账号数据并退出；未同步内容需先同步、导出或确认放弃。账号设置可注销账号，注销前可导出数据。'],
] as const;

export const privacySections = [
  ['账号与验证', '注册账号保存用户名、邮箱、密码散列和必要的认证数据；验证码与会话使用摘要校验。会话记录粗略浏览器、系统及最近请求时间，邮件服务用于发送账号验证码。'],
  ['练习资料', '浏览器保存草稿、记录、设置、收藏、私人文章和背景。登录后这些资料可同步到账号工作区；游客资料保存在本机。在线练习还会向服务端提交练习进度和结果以校验成绩。'],
  ['公开成绩', '公开榜单展示昵称、头像和成绩，不展示邮箱。游客上榜使用提交时的昵称。个人主页默认公开日夜壁纸及在线练习统计，可在账号设置关闭；私人文章、输入正文和草稿不进入公开主页。开启每日壁纸后，服务端会请求 Wallhaven 图片，图片权利归原作者。'],
  ['反馈截图', '提交的反馈、截图及补充内容保存在服务端，仅提交者和有权限的管理员可查看；内部备注仅管理员可查看。'],
  ['数据处理', '服务端使用必要的 Cookie 维持会话和游客练习，并处理请求信息以执行访问控制与频率限制。管理操作会记录审计事件。'],
  ['删除与联系', '删除记录会撤回关联的公开成绩。服务端保留必要的随机记录标识和删除登记，防止旧设备重新上传或恢复成绩；账号注销会删除账号及其云资料，并清除账号关联的删除登记。离线设备和已有备份副本不会即时清除。可通过站内反馈或关于页面的联系邮箱联系。'],
] as const;

export const termsSections = [
  ['使用范围', '本服务提供中英文打字练习、个人资料同步及公开成绩功能。使用时请遵守适用法律，并尊重文章作者和来源的权利。'],
  ['用户内容', '私人文章及反馈由提交者提供。请仅提交有权使用的内容，不要上传违法内容或他人的敏感信息。'],
  ['成绩与服务', '公开成绩以服务端校验和审核结果为准。网络、邮件服务或设备存储异常可能影响同步及部分功能。'],
  ['联系', '可通过站内反馈或关于页面的联系邮箱与运营方联系。'],
] as const;

export const infoLabelsEn: Record<InfoPage, string> = { help: 'Help', about: 'About & contact', privacy: 'Privacy', terms: 'Terms' };
export const helpSectionsEn = [
 ['Account', 'Use the sign-in entry to register, sign in or reset your password. Account settings let you change your username, email, password and public profile, and manage signed-in devices. Email verification requires an available mail service.'],
 ['Practice', 'Timing begins with your first input or IME composition, not focus alone. Pauses do not count as active time. Enable strict correction in settings and resume unfinished long articles from Drafts.'],
 ['Speed', 'Chinese speed is correct characters divided by active minutes. English CPM uses the same calculation; WPM is CPM divided by 5. Correct spaces and punctuation count.'],
 ['Drafts & sync', 'Guest data is stored on this device. Account data is isolated per account and can sync. Local data remains available when sync fails; retry in practice settings. Clear data if storage is full.'],
 ['Results', 'Public article results are verified by the server. Guest nicknames start with visitor, and guest and user leaderboards are separate. Results may await review or be rejected. Eligible interrupted online practice can try to recover submission from Drafts.'],
 ['Personal data', 'Delete individual or multiple records to withdraw their linked public results; statistics and personal bests update accordingly. Personal data in the account menu can export JSON or records as CSV, or clear this account from the device and sign out. Sync, export or explicitly discard unsynced content first. Account settings also allow account deletion; export your data beforehand.'],
] as const;
export const privacySectionsEn = [
 ['Account & verification', 'Registration stores a username, email, password hash and necessary authentication data. Verification codes and sessions are checked using digests. Sessions record approximate browser and operating-system information and the latest request time. The mail service sends account verification codes.'],
 ['Practice data', 'Your browser stores drafts, records, settings, favorites, private articles and backgrounds. Signed-in data can sync to your account workspace; guest data stays local. Online practice also submits progress and results to the server for verification.'],
 ['Public results', 'Public leaderboards show nicknames, avatars and results, not email addresses. Guest entries use the nickname provided on submission. Profiles share day/night wallpapers and online practice statistics by default; disable public viewing in account settings. Private articles, typed text and drafts are not included. Enabling daily wallpapers makes the server request images from Wallhaven; image rights remain with their original owners.'],
 ['Feedback screenshots', 'Submitted feedback, screenshots and updates are stored on the server and are visible only to the submitter and authorized administrators. Internal notes are visible only to administrators.'],
 ['Data processing', 'The server uses necessary cookies for sessions and guest practice, and processes request information for access control and rate limiting. Management operations are recorded in audit events.'],
 ['Deletion & contact', 'Deleting records withdraws their linked public results. The server retains necessary random record identifiers and deletion registrations to prevent old devices from uploading them again or restoring results. Account deletion removes the account, its cloud data and related deletion registrations. Offline devices and existing backup copies are not cleared immediately. Contact the operator through site feedback or the email on the About page.'],
] as const;
export const termsSectionsEn = [
 ['Scope', 'This service provides Chinese and English typing practice, personal data sync and public results. Follow applicable laws and respect the rights of article authors and sources.'],
 ['User content', 'Private articles and feedback are provided by their submitters. Submit only content you have the right to use. Do not upload unlawful content or other people’s sensitive information.'],
 ['Results & service', 'Public results are subject to server verification and review. Network, mail-service or device-storage failures may affect sync and some features.'],
 ['Contact', 'Contact the operator through site feedback or the email on the About page.'],
] as const;
