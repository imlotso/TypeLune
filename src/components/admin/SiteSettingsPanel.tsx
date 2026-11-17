import { SystemMessage } from '../SystemMessage';
import { useAdminText } from './i18n';
import { useAdminEdits } from '../AdminNavigationGuard';
import { useState, type FormEvent } from 'react';
import type { SiteSettings, SiteSettingsSnapshot } from '../../../server/site-settings';
import { ApiError } from '../../lib/api';
import { adminWrite, LoadState, SelectField, useAdminResource, type AdminProps } from './common';
import { WallpaperSettingsPanel } from './WallpaperSettingsPanel';

const settingsPath = '/settings/site';
const availabilityFields = [
  ['registrationEnabled', '开放注册'],
  ['guestPracticeEnabled', '游客新开在线练习'],
  ['guestLeaderboardEnabled', '游客提交排行榜'],
] as const;
const availabilityOptions = [['on', '开启'], ['off', '关闭']] as const;
const reviewFields = [
  ['guestReviewRequired', '游客成绩默认审核'],
  ['userReviewRequired', '注册用户成绩默认审核'],
] as const;
const thresholdFields = [
  ['reviewThresholdZh', '中文（字/分钟）'],
  ['reviewThresholdEn', '英文（WPM）'],
] as const;

function SiteSettingsForm({ ownerId, initial, reload }: AdminProps & { initial: SiteSettingsSnapshot; reload: () => void }) {
  const { at } = useAdminText();
  const [saved, setSaved] = useState(initial);
  const [availability, setAvailability] = useState(initial.settings);
  const [thresholds, setThresholds] = useState({
    reviewThresholdZh: String(initial.settings.reviewThresholdZh),
    reviewThresholdEn: String(initial.settings.reviewThresholdEn),
    leaderboardDisplayDays: String(initial.settings.leaderboardDisplayDays),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');
  const dirty = availabilityFields.some(([field]) => availability[field] !== saved.settings[field]) ||
    reviewFields.some(([field]) => availability[field] !== saved.settings[field]) ||
    thresholdFields.some(([field]) => Number(thresholds[field]) !== saved.settings[field]) ||
    Number(thresholds.leaderboardDisplayDays) !== saved.settings.leaderboardDisplayDays;

  useAdminEdits(dirty, busy);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !dirty || conflict) return;
    const settings: SiteSettings = {
      ...availability, reviewThresholdZh: Number(thresholds.reviewThresholdZh), reviewThresholdEn: Number(thresholds.reviewThresholdEn),
      leaderboardDisplayDays: Number(thresholds.leaderboardDisplayDays),
    };
    setBusy(true);
    setError('');
    try {
      const updated = await adminWrite<SiteSettingsSnapshot>(ownerId, settingsPath, { settings, revision: saved.revision });
      setSaved(updated);
      setSavedMessage(at('已保存'));
    } catch (problem) {
      setConflict(problem instanceof ApiError && problem.status === 409);
      setError(problem instanceof Error ? problem.message : at('保存失败'));
    } finally {
      setBusy(false);
    }
  }

  return <form className="feature-form" onSubmit={save}>
    <fieldset className="settings-group" disabled={busy || conflict}>
      <legend>{at("访问权限")}</legend>
      <div className="feature-form-pair">
        {availabilityFields.map(([field, label]) => <SelectField key={field} label={label} options={availabilityOptions}
          value={availability[field] ? 'on' : 'off'} onChange={(value) => {
            setSavedMessage('');
            setAvailability((previous) => ({ ...previous, [field]: value === 'on' }));
          }} />)}
      </div>
    </fieldset>
    <fieldset className="settings-group" disabled={busy || conflict}>
      <legend>{at("排行榜")}</legend>
      <div className="feature-form-pair">
        {reviewFields.map(([field, label]) => <SelectField key={field} label={label} options={availabilityOptions}
          value={availability[field] ? 'on' : 'off'} onChange={(value) => {
            setSavedMessage(''); setAvailability((previous) => ({ ...previous, [field]: value === 'on' }));
          }} />)}
        <label>{at("展示天数（0 为全部）")}<input type="number" min={0} max={3650} step={1} required value={thresholds.leaderboardDisplayDays}
          onChange={(event) => { const { value } = event.target; setSavedMessage(''); setThresholds((previous) => ({ ...previous, leaderboardDisplayDays: value })); }} /></label>
      </div>
    </fieldset>
    <fieldset className="settings-group" disabled={busy || conflict}>
      <legend>{at("速度复核阈值")}</legend>
      <div className="feature-form-pair">
        {thresholdFields.map(([field, label]) => <label key={field}>{at(label)}<input type="number" min={1} max={1000}
          step={1} required value={thresholds[field]} onChange={(event) => {
            const { value } = event.target;
            setSavedMessage('');
            setThresholds((previous) => ({ ...previous, [field]: value }));
          }} /></label>)}
      </div>
    </fieldset>
    {error && <p className="form-error" role="alert">{<SystemMessage text={error} />}</p>}
    {savedMessage && <p className="feature-muted" role="status">{savedMessage}</p>}
    <div className="feature-actions">
      {conflict && <button type="button" className="outline-button" onClick={reload}>{at("重新加载")}</button>}
      <button className="primary-button" disabled={busy || !dirty || conflict}>{busy ? at('保存中…') : at('保存')}</button>
    </div>
  </form>;
}

export function SiteSettingsPanel({ ownerId }: AdminProps) {

  const { data, error, retry } = useAdminResource<SiteSettingsSnapshot>(ownerId, settingsPath);
  return <>{data ? <SiteSettingsForm ownerId={ownerId} initial={data} reload={retry} /> : <LoadState error={error} retry={retry} />}<WallpaperSettingsPanel ownerId={ownerId}/></>;
}
