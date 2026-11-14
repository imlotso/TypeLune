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
  onBackground?: () => void;
  hasBackground?: boolean;
  onPresets?: () => void;
  onSettingsTransfer?: () => void;
  onCommands?: () => void;
  language?: Language;
};

const syncNames: Record<SyncState, string> = {
  guest: '仅本机', loading: '正在读取', syncing: '同步中', synced: '已同步', error: '同步失败',
};

export function SettingsDialog({ settings, onChange, locked, onClose, onFocus, focused, syncState, syncError, pendingCount, cloudCount, lastSyncedAt, recoveryReason, onRecovery, onSync, isSignedIn, onBackground, hasBackground, onPresets, onSettingsTransfer, onCommands, language = 'zh' }: Props) {
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
    try { void Promise.resolve(onChange(patch)).catch(() => setSaveError('设置保存失败')); }
    catch { setSaveError('设置保存失败'); }
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
      if (failed) setSaveError('设置保存失败');
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
      if (failed) setSaveError('设置保存失败');
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

  return <Dialog title="练习设置" onClose={onClose}>
    <div className="feature-form settings">
      {saveError && <p className="form-error" role="alert">{saveError}</p>}
      <fieldset className="settings-group">
        <legend>规则</legend>
        <div className="feature-form-pair">
          <label>练习模式<select value={settings.mode} disabled={locked} onChange={(event) => change({ mode: event.target.value as ReaderSettings['mode'] })}><option value="timed">限时</option><option value="article">整篇</option></select></label>
          <label>限时（分钟）<input type="number" min={1} max={60} step={1} value={canSetMinutes ? invalidMinutes ?? settings.minutes : settings.minutes} disabled={!canSetMinutes} aria-invalid={canSetMinutes && invalidMinutes !== undefined} onChange={changeMinutes} /></label>
        </div>
        {canSetMinutes && invalidMinutes !== undefined && <p className="form-error" role="alert">请输入 1–60 的整数</p>}
        <label className="settings-check"><input type="checkbox" checked={settings.strict} disabled={locked} onChange={(event) => change({ strict: event.target.checked })} />严格纠错</label>
        <label className="settings-check"><input type="checkbox" checked={settings.autoPause} onChange={(event) => change({ autoPause: event.target.checked })} />离开页面自动暂停</label>
        {(onPresets || onSettingsTransfer) && <div className="feature-actions">{onPresets && <button type="button" className="outline-button feature-action-button" onClick={onPresets}>练习预设</button>}{onSettingsTransfer && <button type="button" className="outline-button feature-action-button" onClick={onSettingsTransfer}>设置导入／导出</button>}</div>}
      </fieldset>
      <fieldset className="settings-group">
        <legend>实时指标</legend>
        <label className="settings-check"><input type="checkbox" checked={pendingIndicators.showTimer?.value ?? (settings.showTimer !== false)} onChange={(event) => changeIndicator('showTimer', event.target.checked)} />显示计时</label>
        <label className="settings-check"><input type="checkbox" checked={pendingIndicators.showSpeed?.value ?? (settings.showSpeed !== false)} onChange={(event) => changeIndicator('showSpeed', event.target.checked)} />显示速度</label>
        <label className="settings-check"><input type="checkbox" checked={pendingIndicators.showAccuracy?.value ?? (settings.showAccuracy !== false)} onChange={(event) => changeIndicator('showAccuracy', event.target.checked)} />显示准确率</label>
      </fieldset>
      <fieldset className="settings-group">
        <legend>目标配速</legend>
        <label className="settings-check"><input type="checkbox" checked={pace.enabled} onChange={(event) => changePace({ enabled: event.target.checked })} />启用目标配速</label>
        {pace.enabled && <>
          <label>配速来源<select value={pace.source} onChange={(event) => changePace({ source: event.target.value as PaceSettings['source'] })}><option value="custom">自定义</option><option value="last">上次成绩</option><option value="best">个人最佳</option></select></label>
          {pace.source === 'custom' && <label>目标速度（{language === 'zh' ? '字/分' : 'WPM'}）<input type="number" min={1} max={1000} step="any" value={invalidPace ?? pace.customSpeed} aria-invalid={invalidPace !== undefined} onChange={changePaceSpeed} /></label>}
          {invalidPace !== undefined && pace.source === 'custom' && <p className="form-error" role="alert">请输入 1–1000 的速度</p>}
        </>}
        {locked && <p className="feature-muted">本轮目标保持不变，设置用于下一轮。</p>}
      </fieldset>
      <fieldset className="settings-group">
        <legend>快捷操作</legend>
        <label className="settings-check"><input type="checkbox" checked={pendingIndicators.shortcutsEnabled?.value ?? (settings.shortcutsEnabled !== false)} onChange={(event) => changeIndicator('shortcutsEnabled', event.target.checked)} />启用快捷键</label>
        {onCommands && <button type="button" className="outline-button feature-action-button" onClick={onCommands}>快捷键与功能</button>}
      </fieldset>
      <fieldset className="settings-group">
        <legend>阅读</legend>
        <label className="settings-range"><span>字号</span><input aria-label="字号" type="range" min={16} max={24} step={1} value={settings.fontSize} onChange={(event) => change({ fontSize: event.target.valueAsNumber })} /><span aria-hidden="true">{settings.fontSize} px</span></label>
        <label className="settings-range"><span>行距</span><input aria-label="行距" type="range" min={1.4} max={2.2} step={.1} value={settings.lineHeight} onChange={(event) => change({ lineHeight: event.target.valueAsNumber })} /><span aria-hidden="true">{settings.lineHeight.toFixed(1)}</span></label>
        <label className="settings-range"><span>可见行数</span><input aria-label="可见行数" type="range" min={3} max={8} step={1} value={settings.visibleLines} onChange={(event) => change({ visibleLines: event.target.valueAsNumber })} /><span aria-hidden="true">{settings.visibleLines} 行</span></label>
        <div className="feature-actions">
          <button className="outline-button feature-action-button" onClick={onFocus}>{focused ? '退出专注' : '进入专注'}</button>
        </div>
      </fieldset>
      <fieldset className="settings-group">
        <legend>外观</legend>
        <div className="settings-sync"><span className="feature-muted">{hasBackground ? '自定义背景' : '默认背景'}</span><button className="outline-button feature-action-button" onClick={onBackground}>背景图</button></div>
      </fieldset>
      <fieldset className="settings-group">
        <legend>同步</legend>
        <div className="settings-sync">
          <span role="status">{syncNames[syncState]}</span>
          {isSignedIn && (recoveryReason ? <button className="outline-button feature-action-button" onClick={onRecovery}>处理同步冲突</button> :
            <button className="outline-button feature-action-button" disabled={syncState === 'loading' || syncState === 'syncing'} onClick={onSync}>立即同步</button>)}
        </div>
        {syncState === 'error' && syncError && <p className="form-error" role="alert">{syncError}</p>}
        {pendingCount != null && pendingCount > 0 && <p className="feature-muted">未同步：{pendingCount} 项</p>}
        {cloudCount != null && <p className="feature-muted">上次读取云端：{cloudCount} 项</p>}
        {lastSyncedAt != null && <p className="feature-muted">最近成功同步：{new Date(lastSyncedAt).toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' })}</p>}
      </fieldset>
    </div>
  </Dialog>;
}
