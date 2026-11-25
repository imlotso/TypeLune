import { useState, type FormEvent } from 'react';
import { ApiError } from '../../lib/api';
import {
  defaultSiteAppearance,
  hexColorPattern,
  hexToRgbTriplet,
  isDefaultSiteAppearance,
  type SiteAppearanceSettings,
  type SiteAppearanceSnapshot,
  type ThemePalette,
  type ThemeSurfaceDefaults,
} from '../../lib/site-appearance';
import { applySiteAppearance } from '../../hooks/useSiteAppearance';
import { useAdminEdits } from '../AdminNavigationGuard';
import { SystemMessage } from '../SystemMessage';
import { adminWrite, LoadState, useAdminResource, type AdminProps } from './common';
import { useAdminText } from './i18n';

const appearancePath = '/appearance';

const paletteFields: Array<{ key: keyof ThemePalette; label: string }> = [
  { key: 'bgFrom', label: '背景渐变主色' },
  { key: 'bgVia', label: '背景渐变次色' },
  { key: 'bgTo', label: '背景渐变尾色' },
  { key: 'workspaceBg', label: '工作区与顶栏底色' },
  { key: 'panelBg', label: '卡片面板底色' },
  { key: 'accent', label: '功能强调色' },
  { key: 'text', label: '主要文字颜色' },
  { key: 'muted', label: '次要文字颜色' },
];

const surfaceFields: Array<{ key: keyof ThemeSurfaceDefaults; label: string; min: number; max: number; unit: string }> = [
  { key: 'headerOpacity', label: '顶部导航透明度', min: 0, max: 100, unit: '%' },
  { key: 'workspaceOpacity', label: '工作区外框透明度', min: 0, max: 100, unit: '%' },
  { key: 'panelOpacity', label: '输入卡片透明度', min: 0, max: 100, unit: '%' },
  { key: 'panelBlur', label: '毛玻璃模糊度', min: 0, max: 24, unit: 'px' },
  { key: 'borderOpacity', label: '边框不透明度', min: 0, max: 100, unit: '%' },
];

function AppearanceSettingsForm({ ownerId, initial, reload }: AdminProps & { initial: SiteAppearanceSnapshot; reload: () => void }) {
  const { at } = useAdminText();
  const [saved, setSaved] = useState<SiteAppearanceSnapshot>(initial);
  const [draft, setDraft] = useState<SiteAppearanceSettings>(initial.settings);
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved.settings);
  const alreadyDefault = isDefaultSiteAppearance(draft);
  useAdminEdits(dirty, busy);

  const current = draft[mode];
  const wsRgb = hexColorPattern.test(current.palette.workspaceBg) ? hexToRgbTriplet(current.palette.workspaceBg) : '214,217,223';
  const panelRgb = hexColorPattern.test(current.palette.panelBg) ? hexToRgbTriplet(current.palette.panelBg) : '234,237,241';

  function updatePalette(key: keyof ThemePalette, value: string) {
    setDraft((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], palette: { ...prev[mode].palette, [key]: value } },
    }));
    setSavedMessage('');
    setError('');
  }

  function updateSurface(key: keyof ThemeSurfaceDefaults, value: number) {
    setDraft((prev) => ({
      ...prev,
      [mode]: { ...prev[mode], surface: { ...prev[mode].surface, [key]: value } },
    }));
    setSavedMessage('');
    setError('');
  }

  function resetToMatteSilver() {
    setDraft(defaultSiteAppearance());
    setSavedMessage('');
    setError('');
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty || conflict) return;
    setBusy(true);
    setError('');
    setSavedMessage('');
    try {
      const updated = await adminWrite<SiteAppearanceSnapshot>(ownerId, appearancePath, {
        settings: draft,
        revision: saved.revision,
      });
      setSaved(updated);
      setDraft(updated.settings);
      applySiteAppearance(updated.settings);
      setSavedMessage(at('全站默认外观已保存并应用'));
    } catch (problem) {
      setConflict(problem instanceof ApiError && problem.status === 409);
      setError(problem instanceof Error ? problem.message : at('保存外观设置失败'));
    } finally {
      setBusy(false);
    }
  }

  return <form className="admin-appearance-form" onSubmit={save}>
    <div className="admin-section-head">
      <div>
        <h2>{at('全站默认外观与配色')}</h2>
        <p className="feature-muted">{at('控制全站访客的默认日间/夜间配色与毛玻璃透明度；访客个人微调仍优先保留，点重置时回到此处默认值。')}</p>
      </div>
      <div className="segmented admin-lang-switch" role="group" aria-label={at('预览与编辑模式')}>
        <button type="button" aria-pressed={mode === 'light'} onClick={() => setMode('light')}>{at('日间模式')}</button>
        <button type="button" aria-pressed={mode === 'dark'} onClick={() => setMode('dark')}>{at('夜间模式')}</button>
      </div>
    </div>

    <div className="admin-appearance-grid">
      <div className="admin-appearance-controls">
        <section className="admin-card-section">
          <h3>{at('全局默认配色')}</h3>
          <div className="admin-color-grid">
            {paletteFields.map(({ key, label }) => {
              const value = current.palette[key];
              const pickerValue = hexColorPattern.test(value) ? value : '#888888';
              return (
                <label key={key} className="admin-color-field">
                  <span>{at(label)}</span>
                  <div className="admin-color-input-wrap">
                    <input
                      type="color"
                      aria-label={at(label)}
                      value={pickerValue}
                      disabled={busy}
                      onChange={(e) => updatePalette(key, e.target.value)}
                    />
                    <input
                      type="text"
                      value={value}
                      maxLength={7}
                      disabled={busy}
                      onChange={(e) => updatePalette(key, e.target.value)}
                    />
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        <section className="admin-card-section">
          <h3>{at('默认透明度与毛玻璃质感')}</h3>
          <div className="admin-sliders-list">
            {surfaceFields.map(({ key, label, min, max, unit }) => (
              <label key={key} className="admin-slider-row">
                <span className="admin-slider-label">{at(label)}</span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={1}
                  value={current.surface[key]}
                  disabled={busy}
                  onChange={(e) => updateSurface(key, Number(e.target.value))}
                />
                <span className="admin-slider-val">{current.surface[key]}{unit}</span>
              </label>
            ))}
          </div>
        </section>
      </div>

      <aside className="admin-card-section admin-appearance-preview-card">
        <h3>{at('实时效果预览')}</h3>
        <div
          className="admin-live-stage"
          style={{
            background: `linear-gradient(155deg, ${current.palette.bgFrom} 0%, ${current.palette.bgVia} 50%, ${current.palette.bgTo} 100%)`,
            color: current.palette.text,
          }}
        >
          <div
            className="admin-live-header"
            style={{
              background: `rgba(${wsRgb}, ${current.surface.headerOpacity / 100})`,
              backdropFilter: `blur(${current.surface.panelBlur}px)`,
              borderBottomColor: mode === 'dark' ? `rgba(255,255,255,${0.1 * current.surface.borderOpacity / 100})` : `rgba(0,0,0,${0.09 * current.surface.borderOpacity / 100})`,
            }}
          >
            <strong>TypeLune</strong>
            <div className="admin-live-nav">
              <span>{at('练习')}</span>
              <span>{at('文章库')}</span>
              <span>{at('外观')}</span>
            </div>
          </div>

          <div
            className="admin-live-workspace"
            style={{
              background: `rgba(${wsRgb}, ${current.surface.workspaceOpacity / 100})`,
              backdropFilter: `blur(${current.surface.panelBlur}px)`,
              borderColor: mode === 'dark' ? `rgba(255,255,255,${0.12 * current.surface.borderOpacity / 100})` : `rgba(0,0,0,${0.1 * current.surface.borderOpacity / 100})`,
            }}
          >
            <div className="admin-live-top-row">
              <span className="admin-live-pill" style={{ background: mode === 'dark' ? '#f5f5f7' : '#464952', color: mode === 'dark' ? '#1d1d1f' : '#f5f6f8' }}>{at('中文')}</span>
              <span className="admin-live-cta" style={{ background: current.palette.accent }}>{at('继续练习')}</span>
            </div>
            <div
              className="admin-live-panel"
              style={{
                background: `rgba(${panelRgb}, ${current.surface.panelOpacity / 100})`,
                borderColor: current.palette.accent,
              }}
            >
              <div style={{ color: current.palette.text }}>我与父亲不相见已二年余了，我最不能忘记的是他的背影。</div>
              <div className="admin-live-muted" style={{ color: current.palette.muted }}>准确率 100% · 48 字/分钟</div>
            </div>
          </div>

          <div
            className="admin-live-footer-pill"
            style={{
              background: `rgba(${panelRgb}, ${mode === 'dark' ? 0.62 : 0.56})`,
              color: current.palette.text,
            }}
          >
            <div>{at('使用帮助 · 功能反馈 · 隐私政策 · 服务条款 · 关于与联系')}</div>
            <div style={{ color: current.palette.muted }}>Powered by SiteTalk</div>
          </div>
        </div>
      </aside>
    </div>

    {error && <p className="form-error" role="alert"><SystemMessage text={error} /></p>}
    {savedMessage && <p className="admin-saved-hint" role="status">{savedMessage}</p>}

    <div className="admin-sticky-actions">
      <button
        type="button"
        className="outline-button"
        disabled={busy || alreadyDefault}
        onClick={resetToMatteSilver}
      >
        {at('恢复当前默认（太空银灰版）')}
      </button>
      <div className="admin-sticky-right">
        {conflict && <button type="button" className="outline-button" onClick={reload}>{at('重新加载')}</button>}
        <button type="submit" className="primary-button" disabled={busy || !dirty || conflict}>
          {busy ? at('正在保存…') : at('保存并应用到全站')}
        </button>
      </div>
    </div>
  </form>;
}

export function AppearanceSettingsPanel({ ownerId }: AdminProps) {
  const resource = useAdminResource<SiteAppearanceSnapshot>(ownerId, appearancePath);
  if (!resource.data) return <LoadState error={resource.error} retry={resource.retry} />;
  return <AppearanceSettingsForm key={resource.data.revision} ownerId={ownerId} initial={resource.data} reload={resource.retry} />;
}
