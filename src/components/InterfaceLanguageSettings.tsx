import { useI18n, type UiLocalePreference } from '../lib/i18n';

export function InterfaceLanguageSettings({ disabled = false, showSync = false }: { disabled?: boolean; showSync?: boolean }) {
  const { t, preference, setPreference, canChange, saving, saveFailed, accountSync } = useI18n();
  const syncNames = { guest: t('仅本机', 'Local only'), loading: t('正在读取', 'Loading'), syncing: t('同步中', 'Syncing'), synced: t('已同步', 'Synced'), error: t('同步失败', 'Sync failed') };
  return <fieldset className="settings-group">
    <legend>{t('界面', 'Interface')}</legend>
    <label>{t('界面语言', 'Interface language')}<select value={preference} disabled={disabled || !canChange || saving} onChange={(event) => setPreference(event.target.value as UiLocalePreference)}>
      <option value="auto">{t('自动（浏览器语言）', 'Automatic (browser language)')}</option><option value="zh">中文</option><option value="en">English</option>
    </select></label>
    {!canChange && <p className="feature-muted">{t('请先同步账号设置', 'Sync account settings first')}</p>}
    {saveFailed && <p className="form-error" role="alert">{t('语言未保存', 'Language not saved')}</p>}
    {showSync && accountSync && <div className="feature-actions">
      <span className="feature-muted" role="status">{syncNames[accountSync.state]}</span>
      {accountSync.state === 'error' && (accountSync.needsRecovery
        ? <span className="feature-muted">{t('请在练习设置中处理同步冲突', 'Resolve the conflict in practice settings')}</span>
        : <button type="button" className="outline-button" disabled={disabled || saving} onClick={() => { void accountSync.retry(); }}>{t('重试同步', 'Retry sync')}</button>)}
    </div>}
  </fieldset>;
}
