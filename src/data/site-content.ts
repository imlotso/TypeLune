export type InfoPage = 'help' | 'about' | 'privacy' | 'terms';
export const infoLabels: Record<InfoPage, string> = { help: '使用帮助', about: '关于与联系', privacy: '隐私政策', terms: '服务条款' };

// These public build-time values contain no secrets. Policy text is maintained below.
const configured = (value: string | undefined) => value?.trim() || '';
const date = (value: string | undefined) => {
  const input = configured(value);
  const parsed = new Date(`${input}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(input) && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === input ? input : '';
};
const email = configured(import.meta.env.VITE_SITE_CONTACT_EMAIL);
export const siteInfo = {
  operator: configured(import.meta.env.VITE_SITE_OPERATOR),
  contactEmail: /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(email) ? email : '',
  privacyVersion: configured(import.meta.env.VITE_PRIVACY_VERSION) || '草案',
  privacyEffectiveDate: date(import.meta.env.VITE_PRIVACY_EFFECTIVE_DATE),
  termsVersion: configured(import.meta.env.VITE_TERMS_VERSION) || '草案',
  termsEffectiveDate: date(import.meta.env.VITE_TERMS_EFFECTIVE_DATE),
};

export const helpSections = [
  ['账号', '通过登录入口注册、登录或找回密码。账号设置可更改用户名、邮箱、密码及公开资料，并管理登录设备；邮箱验证需要可用的邮件服务。'],
  ['练习', '首次输入或开始输入法组合时计时，单独聚焦不计时。暂停不计入有效时间；设置中可开启严格纠错，未完成的长文可从草稿箱继续。'],
  ['速度', '中文速度按正确字符数除以有效分钟数计算。英文字符/分钟采用相同口径，WPM 为字符/分钟除以 5；正确的空格和标点也计入。'],
  ['草稿与同步', '游客资料保存在本机；账号资料按账号隔离并可同步。同步失败时仍可使用本机资料，在练习设置中重试；空间不足时需清理资料。'],
  ['成绩', '公共文章成绩由服务端校验；结果可能已上榜、待复核或未通过。中断的合格在线练习可从草稿箱尝试恢复成绩。'],
  ['个人数据', '完整数据导出、按账号清理本机缓存和账号注销尚未开放。清除浏览器站点数据会影响该浏览器中的游客和账号本机资料。'],
] as const;

export const privacySections = [
  ['账号与验证', '注册账号保存用户名、邮箱、密码散列和必要的认证数据；验证码与会话使用摘要校验。会话记录粗略浏览器、系统及最近请求时间，邮件服务用于发送账号验证码。'],
  ['练习资料', '浏览器保存草稿、记录、设置、收藏、私人文章和背景。登录后这些资料可同步到账号工作区；游客资料保存在本机。在线练习还会向服务端提交练习进度和结果以校验成绩。'],
  ['公开成绩', '公开榜单展示昵称、成绩和练习条件，不展示邮箱。游客上榜使用提交时的昵称。'],
  ['反馈截图', '提交的反馈、截图及补充内容保存在服务端，仅提交者和有权限的管理员可查看；内部备注仅管理员可查看。'],
  ['数据处理', '服务端使用必要的 Cookie 维持会话和游客练习，并处理请求信息以执行访问控制与频率限制。管理操作会记录审计事件。'],
  ['删除与联系', '本机数据可通过浏览器站点数据设置清除，但会同时影响该浏览器中的其他账号和游客资料。账号注销和完整数据导出尚未开放；联系信息未配置时可使用站内反馈。'],
] as const;

export const termsSections = [
  ['使用范围', '本服务提供中英文打字练习、个人资料同步及公开成绩功能。使用时请遵守适用法律，并尊重文章作者和来源的权利。'],
  ['用户内容', '私人文章及反馈由提交者提供。请仅提交有权使用的内容，不要上传违法内容或他人的敏感信息。'],
  ['成绩与服务', '公开成绩以服务端校验和审核结果为准。网络、邮件服务或设备存储异常可能影响同步及部分功能。'],
  ['联系', '运营主体、联系信息及正式生效日期由运营方配置；未配置时可通过站内反馈联系。'],
] as const;
