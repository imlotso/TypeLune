import {preserveLanguageAddress} from '../lib/seo';
import { useI18n } from '../lib/i18n';
import { LanguageToggle } from './LanguageToggle';
import { WorkspaceI18nProvider } from './WorkspaceI18nProvider';
import { SystemMessage } from './SystemMessage';
import { useEffect, useRef, useState } from 'react';
import { ArrowSquareOut } from '@phosphor-icons/react/ArrowSquareOut';
import { MoonStars } from '@phosphor-icons/react/MoonStars';
import { SignOut } from '@phosphor-icons/react/SignOut';
import { Sun } from '@phosphor-icons/react/Sun';
import { UserCircle } from '@phosphor-icons/react/UserCircle';
import { useWorkspace } from '../hooks/useWorkspace';
import { api, type User } from '../lib/api';
import { type Theme } from '../lib/theme';
import { AdminNavigationGuard, useAdminNavigation } from './AdminNavigationGuard';
import { AdminConsole } from './AdminConsole';
import { BrandLogo } from './BrandLogo';

// Returning to the site mounts a fresh practice view, which fetches the current catalog.
const catalogChanged = () => {};

type Props = { user: User; onLogout: () => void; onPreview: () => void };
export function AdminWorkspace(props: Props) {
  const workspace = useWorkspace(props.user.id);
  return <WorkspaceI18nProvider ownerId={props.user.id} workspace={workspace}><AdminNavigationGuard><AdminWorkspaceContent {...props} workspace={workspace} /></AdminNavigationGuard></WorkspaceI18nProvider>;
}
function AdminWorkspaceContent({ user, onLogout, onPreview, workspace }: Props & { workspace: ReturnType<typeof useWorkspace> }) {
  const leave = useAdminNavigation();
  const { t } = useI18n();
  const [pendingTheme, setPendingTheme] = useState<Theme>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const logoutPending = useRef(false);
  const theme = pendingTheme ?? workspace.settings.theme;

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { document.documentElement.dataset.theme = theme; }, [theme]);
  useEffect(() => { if (pendingTheme === workspace.settings.theme) setPendingTheme(undefined); }, [pendingTheme, workspace.settings.theme]);

  function toggleTheme() {
    if (!workspace.settingsReady) return;
    const next = theme === 'light' ? 'dark' : 'light';
    setPendingTheme(next); setError('');
    void workspace.updateSettings({ theme: next }).catch(() => {
      if (mounted.current) { setPendingTheme(undefined); setError('外观设置保存失败'); }
    });
  }
  async function logout() {
    if (logoutPending.current) return;
    logoutPending.current = true; setBusy(true); setError('');
    try {
      await api('/api/auth/logout', { method: 'POST', body: {}, headers: { 'X-Workspace-Owner': user.id } });
      if (mounted.current) onLogout();
    } catch (problem) {
      if (mounted.current) setError(problem instanceof Error ? problem.message : t('退出失败', 'Sign out failed'));
    } finally {
      logoutPending.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  return <div className="administration-app">
    <header className="administration-header">
      <div className="administration-brand"><a href={preserveLanguageAddress('/')} aria-label={t('TypeLune 首页','TypeLune home')} onClick={event=>{if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;event.preventDefault();leave(onPreview);}}><BrandLogo /></a><span className="administration-badge">{t('管理端', 'Administration')}</span></div>
      <div className="administration-actions">
        <LanguageToggle />
        <button className="outline-button" disabled={busy} onClick={() => leave(onPreview)}><ArrowSquareOut size={18} aria-hidden="true" />{t('预览网站', 'Preview site')}</button>
        <button className="administration-theme" disabled={!workspace.settingsReady} aria-label={theme === 'dark' ? t('切换至日间模式', 'Switch to light mode') : t('切换至夜间模式', 'Switch to dark mode')} aria-pressed={theme === 'dark'} onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <MoonStars size={20} aria-hidden="true" />}
        </button>
        <button className="outline-button administration-account" title={t('退出登录', 'Sign out')} disabled={busy} onClick={() => leave(() => void logout())}><UserCircle size={20} aria-hidden="true" /><span>{user.username}</span><SignOut size={17} aria-hidden="true" /><span>{t('退出登录', 'Sign out')}</span></button>
      </div>
    </header>
    <main className="administration-content" aria-label={t('管理工作区', 'Administration workspace')}>
      {error && <p className="form-error" role="alert"><SystemMessage text={error} /></p>}
      <AdminConsole ownerId={user.id} onCatalogChange={catalogChanged} />
    </main>
  </div>;
}
