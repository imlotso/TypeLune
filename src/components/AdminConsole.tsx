import {NicknamePolicyPanel} from './admin/NicknamePolicyPanel';
import { SeoSettingsPanel } from './admin/SeoSettingsPanel';
import { SupportSettingsPanel } from './admin/SupportSettingsPanel';
import { useAdminText } from './admin/i18n';
import { useAdminRoute } from '../hooks/useAdminRoute';
import { useState } from 'react';
import { ShieldCheck } from '@phosphor-icons/react/ShieldCheck';
import { ArticlesPanel } from './admin/ArticlesPanel';
import { ScoresPanel } from './admin/ScoresPanel';
import { UsersPanel } from './admin/UsersPanel';
import { SmtpPanel } from './admin/SmtpPanel';
import { SiteSettingsPanel } from './admin/SiteSettingsPanel';
import { AppearanceSettingsPanel } from './admin/AppearanceSettingsPanel';
import { FooterSettingsPanel } from './admin/FooterSettingsPanel';
import { FeedbackPanel } from './admin/FeedbackPanel';
import { OverviewPanel } from './admin/OverviewPanel';
import {
  AuditRows, LoadState, Pagination, QueryField, SelectField, targets, useAdminList,
  type AdminProps, type Audit,
} from './admin/common';
import '../admin.css';

const tabs = [
  ['overview', '概览'], ['users', '用户'], ['articles', '文章'], ['scores', '成绩'], ['feedback', '反馈'], ['settings', '站点设置'], ['appearance', '外观主题'], ['footer', '页脚与页面'], ['nicknames','昵称过滤'], ['seo', 'SEO'], ['support', '捐赠设置'], ['mail', '邮件'], ['audit', '操作日志'],
] as const;
function AuditPanel({ ownerId }: AdminProps) {
  const { at } = useAdminText();
  const list = useAdminList<Audit>(ownerId, '/audit');
  return <>
    <div className="admin-filters feature-filters">
      <QueryField label={at("管理员、对象或原因")} onSearch={(value) => list.filter('q', value)} />
      <SelectField label={at("对象类型")} options={Object.entries(targets)} all value={list.filters.targetType ?? ''} onChange={(value) => list.filter('targetType', value)} />
    </div>
    {!list.data ? <LoadState error={list.error} retry={list.retry} /> : <>
      <AuditRows entries={list.data.entries} label={at("操作日志列表")} />
      <Pagination data={list.data} setPage={list.setPage} />
    </>}
  </>;
}

export function AdminConsole({ ownerId, onCatalogChange }: AdminProps & { onCatalogChange: () => void }) {
  const { at } = useAdminText();
  const [tab, setTab] = useAdminRoute();
  const [articleFromFeedback, setArticleFromFeedback] = useState<string>();
  return <section className="content-panel feature-panel admin-console">
    <div className="content-heading"><h1><ShieldCheck size={25} aria-hidden="true" />{at("管理后台")}</h1></div>
    <nav className="admin-navigation" aria-label={at("后台栏目")}>
      {tabs.map(([value, label]) => <button key={value} aria-current={tab === value ? 'page' : undefined} onClick={() => setTab(value)}>{at(label)}</button>)}
    </nav>
    <div className="admin-panel" key={ownerId}>
      {tab === 'overview' && <OverviewPanel ownerId={ownerId} />}
      {tab === 'users' && <UsersPanel ownerId={ownerId} />}
      {tab === 'articles' && <ArticlesPanel ownerId={ownerId} onCatalogChange={onCatalogChange} initialArticleId={articleFromFeedback} onInitialClose={() => setArticleFromFeedback(undefined)} />}
      {tab === 'scores' && <ScoresPanel ownerId={ownerId} />}
      {tab === 'feedback' && <FeedbackPanel ownerId={ownerId} onArticle={(id) => { setArticleFromFeedback(id); setTab('articles'); }} />}
      {tab === 'nicknames' && <NicknamePolicyPanel ownerId={ownerId}/>}
      {tab === 'seo' && <SeoSettingsPanel ownerId={ownerId} />}
      {tab === 'settings' && <SiteSettingsPanel ownerId={ownerId} />}
      {tab === 'appearance' && <AppearanceSettingsPanel ownerId={ownerId} />}
      {tab === 'footer' && <FooterSettingsPanel ownerId={ownerId} />}
      {tab === 'support' && <SupportSettingsPanel ownerId={ownerId} />}
      {tab === 'mail' && <SmtpPanel ownerId={ownerId} />}
      {tab === 'audit' && <AuditPanel ownerId={ownerId} />}
    </div>
  </section>;
}
