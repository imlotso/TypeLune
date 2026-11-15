import { Translate } from '@phosphor-icons/react/Translate';
import { useI18n } from '../lib/i18n';
export function LanguageToggle(){const {locale,setLocale,t}=useI18n();return <button type="button" className="ui-language-button" aria-label={t('界面语言：中文，切换为 English','Interface language: English. Switch to 中文')} title={t('切换界面语言','Switch interface language')} onClick={()=>setLocale(locale==='zh'?'en':'zh')}><Translate size={18} aria-hidden="true" /><span>{locale==='zh'?'EN':'中文'}</span></button>;}
