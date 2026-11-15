import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import type { Language } from '../data/articles';
import { defaultPace, type PaceSettings, type ReaderSettings, type SyncState } from '../lib/models';
import { Dialog } from './Dialog';

type Props = {
  settings: ReaderSettings;
  onChange: (patch: Partial<ReaderSettings>) => void | Promise<void>;
  locked: boolean;
  onClose: () => void;
  onFocus: () => void;
  focused: boolean;
  syncState: SyncState;
  syncError?: string;
  pendingCount?: number | null;
  cloudCount?: number | null;
  lastSyncedAt?: number | null;
  recoveryReason?: 'generation' | 'conflict' | null;
  onRecovery?: () => void;
  onSync: () => void;
  isSignedIn: boolean;
  onBackground?: (theme?: 'light' | 'dark') => void;
  hasBackground?: boolean;
  onPresets?: () => void;
  onSettingsTransfer?: () => void;
  onCommands?: () => void;
  language?: Language;
};


export function SettingsDialog({ settings, onChange, locked, onClose, onFocus, focused, syncState, syncError, pendingCount, cloudCount, lastSyncedAt, recoveryReason, onRecovery, onSync, isSignedIn, onBackground, hasBackground, onPresets, onSettingsTransfer, onCommands, language = 'zh' }: Props) {
  const { t, locale } = useI18n();
const syncNames: Record<SyncState, string> = {
  guest: t("仅本机", "Local only"), loading: t("正在读取", "Loading"), syncing: t("同步中", "Syncing"), synced: t("已同步", "Synced"), error: t("同步失败", "Sync failed"),
};

  const [invalidMinutes, setInvalidMinutes] = useState<string>();
  const [saveError, setSaveError] = useState('');
  type Indicator = 'showTimer' | 'showSpeed' | 'showAccuracy' | 'shortcutsEnabled';
  const [pendingIndicators, setPendingIndicators] = useState<Partial<Record<Indicator, { value: boolean; version: number; settled: boolean }>>>({});
  const sequence = useRef(0);
  const indicatorVersions = useRef<Partial<Record<Indicator, number>>>({});
  const [pendingPace, setPendingPace] = useState<{ value: PaceSettings; version: number; settled: boolean }>();
  const [invalidPace, setInvalidPace] = useState<string>();
  const paceVersion = useRef(0);
  const pace = pendingPace?.value ?? settings.pace ?? defaultPace;
  const canSetMinutes = !locked && settings.mode === 'timed';

  useEffect(() => {
    setPendingIndicators((previous) => {
      let next = previous;
      for (const key of ['showTimer', 'showSpeed', 'showAccuracy', 'shortcutsEnabled'] as const) {
        const pending = previous[key];
        if (pending?.settled && (settings[key] !== false) === pending.value) {
          if (next === previous) next = { ...previous };
          delete next[key];
        }
      }
      return next;
    });
  }, [settings.showTimer, settings.showSpeed, settings.showAccuracy, settings.shortcutsEnabled, pendingIndicators]);
  useEffect(() => {
    if (pendingPace?.settled && JSON.stringify(settings.pace ?? defaultPace) === JSON.stringify(pendingPace.value)) setPendingPace(undefined);
  }, [settings.pace, pendingPace]);

  function change(patch: Partial<ReaderSettings>) {
    setSaveError('');
    try { void Promise.resolve(onChange(patch)).catch(() => setSaveError(t("设置保存失败", "Could not save settings"))); }
    catch { setSaveError(t("设置保存失败", "Could not save settings")); }
  }
  function changeIndicator(key: Indicator, value: boolean) {
    const version = ++sequence.current;
    indicatorVersions.current[key] = version;
    setSaveError('');
    setPendingIndicators((previous) => ({ ...previous, [key]: { value, version, settled: false } }));
    const finish = (failed: boolean) => {
      if (indicatorVersions.current[key] !== version) return;
      setPendingIndicators((previous) => {
        if (previous[key]?.version !== version) return previous;
        const next = { ...previous };
        if (failed) delete next[key]; else next[key] = { value, version, settled: true };
        return next;
      });
      if (failed) setSaveError(t("设置保存失败", "Could not save settings"));
    };
    try { void Promise.resolve(onChange({ [key]: value })).then(() => finish(false), () => finish(true)); }
    catch { finish(true); }
  }
  function changePace(patch: Partial<PaceSettings>) {
    const value = { ...pace, ...patch }; const version = ++paceVersion.current;
    setSaveError(''); setPendingPace({ value, version, settled: false });
    const finish = (failed: boolean) => {
      if (paceVersion.current !== version) return;
      setPendingPace(failed ? undefined : { value, version, settled: true });
      if (failed) setSaveError(t("设置保存失败", "Could not save settings"));
    };
    try { void Promise.resolve(onChange({ pace: value })).then(() => finish(false), () => finish(true)); }
    catch { finish(true); }
  }
  function changePaceSpeed(event: ChangeEvent<HTMLInputElement>) {
    const { value, valueAsNumber } = event.currentTarget;
    if (Number.isFinite(valueAsNumber) && valueAsNumber >= 1 && valueAsNumber <= 1000) { setInvalidPace(undefined); changePace({ customSpeed: valueAsNumber }); }
    else setInvalidPace(value);
  }

  function changeMinutes(event: ChangeEvent<HTMLInputElement>) {
    const { value, valueAsNumber } = event.currentTarget;
    if (Number.isInteger(valueAsNumber) && valueAsNumber >= 1 && valueAsNumber <= 60) {
      setInvalidMinutes(undefined);
      change({ minutes: valueAsNumber });
    } else {
      setInvalidMinutes(value);
    }
  }

  return <Dialog title={t("练习设置", "Practice settings")} onClose={onClose}>
    <div className="feature-form settings">
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <fieldset className="settings-group">
        <legend>{t("规则", "Rules")}</legend>
        <div className="feature-form-pair">
          <label>{t("练习模式", "Practice mode")}<select value={settings.mode} disabled={locked} onChange={(event) => change({ mode: event.target.value as ReaderSettings['mode'] })}><option value="timed">{t("限时", "Timed")}</option><option value="article">{t("整篇", "Full article")}</option></select></label>
          <label>{t("限时（分钟）", "Time limit (minutes)")}<input type="number" min={1} max={60} step={1} value={canSetMinutes ? invalidMinutes ?? settings.minutes : settings.minutes} disabled={!canSetMinutes} aria-invalid={canSetMinutes && invalidMinutes !== undefined} onChange={changeMinutes} /></label>
        </div>
        {canSetMinutes && invalidMinutes !== undefined && <p className="form-error" role="alert">{t("请输入 1–60 的整数", "Enter a whole number from 1 to 60")}</p>}
        <label className="settings-check"><input type="checkbox" checked={settings.strict} disabled={locked} onChange={(event) => change({ strict: event.target.checked })} />{t("严格纠错", "Strict correction")}</label>
        <label className="settings-check"><input type="checkbox" checked={settings.autoPause} onChange={(event) => change({ autoPause: event.target.checked })} />{t("离开页面自动暂停", "Pause when leaving the page")}</label>
        {(onPresets || onSettingsTransfer) && <div className="feature-actions">{onPresets && <button type="button" className="outline-button feature-action-button" onClick={onPresets}>{t("练习预设", "Practice presets")}</button>}{onSettingsTransfer && <button type="button" className="outline-button feature-action-button" onClick={onSettingsTransfer}>{t("设置导入／导出", "Import / export settings")}</button>}</div>}
      </fieldset>
      <fieldset className="settings-group">
        <legend>{t("实时指标", "Live metrics")}</legend>
        <label className="settings-check"><input type="checkbox" checked={pendingIndicators.showTimer?.value ?? (settings.showTimer !== false)} onChange={(event) => changeIndicator('showTimer', event.target.checked)} />{t("显示计时", "Show timer")}</label>
        <label className="settings-check"><input type="checkbox" checked={pendingIndicators.showSpeed?.value ?? (settings.showSpeed !== false)} onChange={(event) => changeIndicator('showSpeed', event.target.checked)} />{t("显示速度", "Show speed")}</label>
        <label className="settings-check"><input type="checkbox" checked={pendingIndicators.showAccuracy?.value ?? (settings.showAccuracy !== false)} onChange={(event) => changeIndicator('showAccuracy', event.target.checked)} />{t("显示准确率", "Show accuracy")}</label>
      </fieldset>
      <fieldset className="settings-group">
        <legend>{t("目标配速", "Target pace")}</legend>
        <label className="settings-check"><input type="checkbox" checked={pace.enabled} onChange={(event) => changePace({ enabled: event.target.checked })} />{t("启用目标配速", "Enable target pace")}</label>
        {pace.enabled && <>
          <label>{t("配速来源", "Pace source")}<select value={pace.source} onChange={(event) => changePace({ source: event.target.value as PaceSettings['source'] })}><option value="custom">{t("自定义", "Custom")}</option><option value="last">{t("上次成绩", "Last result")}</option><option value="best">{t("个人最佳", "Personal best")}</option></select></label>
          {pace.source === 'custom' && <label>{t(`目标速度（${language === 'zh' ? '字/分' : 'WPM'}）`, `Target speed (${language === 'zh' ? 'chars/min' : 'WPM'})`)}<input type="number" min={1} max={1000} step="any" value={invalidPace ?? pace.customSpeed} aria-invalid={invalidPace !== undefined} onChange={changePaceSpeed} /></label>}
          {invalidPace !== undefined && pace.source === 'custom' && <p className="form-error" role="alert">{t("请输入 1–1000 的速度", "Enter a speed from 1 to 1000")}</p>}
        </>}
        {locked && <p className="feature-muted">{t("本轮目标保持不变，设置用于下一轮。", "Changes apply to the next round.")}</p>}
      </fieldset>
      <fieldset className="settings-group">
        <legend>{t("快捷操作", "Shortcuts")}</legend>
        <label className="settings-check"><input type="checkbox" checked={pendingIndicators.shortcutsEnabled?.value ?? (settings.shortcutsEnabled !== false)} onChange={(event) => changeIndicator('shortcutsEnabled', event.target.checked)} />{t("启用快捷键", "Enable keyboard shortcuts")}</label>
        {onCommands && <button type="button" className="outline-button feature-action-button" onClick={onCommands}>{t("快捷键与功能", "Shortcuts and commands")}</button>}
      </fieldset>
      <fieldset className="settings-group">
        <legend>{t("阅读", "Reading")}</legend>
        <label className="settings-range"><span>{t("字号", "Font size")}</span><input aria-label={t("字号", "Font size")} type="range" min={16} max={24} step={1} value={settings.fontSize} onChange={(event) => change({ fontSize: event.target.valueAsNumber })} /><span aria-hidden="true">{settings.fontSize} px</span></label>
        <label className="settings-range"><span>{t("行距", "Line spacing")}</span><input aria-label={t("行距", "Line spacing")} type="range" min={1.4} max={2.2} step={.1} value={settings.lineHeight} onChange={(event) => change({ lineHeight: event.target.valueAsNumber })} /><span aria-hidden="true">{settings.lineHeight.toFixed(1)}</span></label>
        <label className="settings-range"><span>{t("可见行数", "Visible lines")}</span><input aria-label={t("可见行数", "Visible lines")} type="range" min={3} max={8} step={1} value={settings.visibleLines} onChange={(event) => change({ visibleLines: event.target.valueAsNumber })} /><span aria-hidden="true">{settings.visibleLines} {t("行", " lines")}</span></label>
        <div className="feature-actions">
          <button className="outline-button feature-action-button" onClick={onFocus}>{focused ? t("退出专注", "Exit focus") : t("进入专注", "Enter focus")}</button>
        </div>
      </fieldset>
      <fieldset className="settings-group">
        <legend>{t("外观", "Appearance")}</legend>
        <div className="settings-sync"><span className="feature-muted">{hasBackground ? t("自定义背景", "Custom background") : t("默认背景", "Default background")}</span><button className="outline-button feature-action-button" onClick={() => onBackground?.('light')}>{t("日间背景图", "Light background")}</button><button className="outline-button feature-action-button" onClick={() => onBackground?.('dark')}>{t("夜间背景图", "Dark background")}</button></div>
      </fieldset>
      <fieldset className="settings-group">
        <legend>{t("同步", "Sync")}</legend>
        <div className="settings-sync">
          <span role="status">{syncNames[syncState]}</span>
          {isSignedIn && (recoveryReason ? <button className="outline-button feature-action-button" onClick={onRecovery}>{t("处理同步冲突", "Resolve sync conflict")}</button> :
            <button className="outline-button feature-action-button" disabled={syncState === 'loading' || syncState === 'syncing'} onClick={onSync}>{t("立即同步", "Sync now")}</button>)}
        </div>
        {syncState === 'error' && syncError && <p className="form-error" role="alert">{<SystemMessage text={syncError} />}</p>}
        {pendingCount != null && pendingCount > 0 && <p className="feature-muted">{t("未同步：", "Pending: ")}{pendingCount} {t("项", " items")}</p>}
        {cloudCount != null && <p className="feature-muted">{t("上次读取云端：", "Last cloud count: ")}{cloudCount} {t("项", " items")}</p>}
        {lastSyncedAt != null && <p className="feature-muted">{t("最近成功同步：", "Last synced: ")}{new Date(lastSyncedAt).toLocaleString(locale === 'zh' ? 'zh-CN' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      </fieldset>
    </div>
  </Dialog>;
}
