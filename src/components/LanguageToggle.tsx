import { Translate } from '@phosphor-icons/react/Translate';
import { useI18n } from '../lib/i18n';
export function LanguageToggle() {
  const { locale, setLocale, t, canChange, saving, saveFailed } = useI18n();
  return <><button type="button" className="ui-language-button" disabled={!canChange || saving}
    aria-label={t('界面语言：中文，切换为 English', 'Interface language: English. Switch to 中文')}
    title={canChange ? t('切换界面语言', 'Switch interface language') : t('请先同步账号设置', 'Sync account settings first')}
    onClick={() => setLocale(locale === 'zh' ? 'en' : 'zh')}><Translate size={18} aria-hidden="true" /><span>{locale === 'zh' ? 'EN' : '中文'}</span></button>
    {saveFailed && <span className="form-error" role="alert">{t('语言未保存', 'Language not saved')}</span>}</>;
}
