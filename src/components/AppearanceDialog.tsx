import {SurfaceControls} from './SurfaceControls';
import type {SurfaceAppearance} from '../lib/surface-appearance';
import { Sun } from '@phosphor-icons/react/Sun';
import { MoonStars } from '@phosphor-icons/react/MoonStars';
import { useI18n } from '../lib/i18n';
import type { Theme } from '../lib/theme';
import { Dialog } from './Dialog';

type Props = { disabled?:boolean;surface:Required<SurfaceAppearance>;onSurface:(value:SurfaceAppearance)=>void;onResetSurface:()=>void; theme: Theme; onTheme: (theme: Theme) => void; onBackground: (theme: Theme) => void; onClose: () => void };

export function AppearanceDialog({ theme, onTheme, onBackground, onClose,surface,onSurface,onResetSurface,disabled }: Props) {
  const { t } = useI18n();
  return <Dialog title={t('外观', 'Appearance')} onClose={onClose} className="appearance-dialog">
    <div className="feature-form">
      <fieldset className="settings-group">
        <legend>{t('主题', 'Theme')}</legend>
        <div className="appearance-themes" role="group" aria-label={t('主题', 'Theme')}>
          <button type="button" className="outline-button" aria-pressed={theme === 'light'} onClick={() => onTheme('light')}><Sun size={22} aria-hidden="true" />{t('日间', 'Light')}</button>
          <button type="button" className="outline-button" aria-pressed={theme === 'dark'} onClick={() => onTheme('dark')}><MoonStars size={22} aria-hidden="true" />{t('夜间', 'Dark')}</button>
        </div>
      </fieldset>
      <fieldset className="settings-group" disabled={disabled}><legend>{t('页面透明度与效果','Page transparency and effects')}</legend><SurfaceControls value={surface} onChange={onSurface} onReset={onResetSurface}/></fieldset>
      <fieldset className="settings-group">
        <legend>{t('背景图片', 'Background images')}</legend>
        <div className="appearance-themes">
          <button type="button" className="outline-button" onClick={() => onBackground('light')}>{t('日间背景图', 'Light background')}</button>
          <button type="button" className="outline-button" onClick={() => onBackground('dark')}>{t('夜间背景图', 'Dark background')}</button>
        </div>
      </fieldset>
    </div>
  </Dialog>;
}
