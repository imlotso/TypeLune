import { useState, type FormEvent } from 'react';
import { CheckCircle } from '@phosphor-icons/react/CheckCircle';
import { EnvelopeSimple } from '@phosphor-icons/react/EnvelopeSimple';
import { Prohibit } from '@phosphor-icons/react/Prohibit';
import { ApiError } from '../../lib/api';
import { useI18n } from '../../lib/i18n';
import type { RegistrationPolicy, RegistrationPolicySnapshot } from '../../lib/registration-policy';
import { useAdminEdits } from '../AdminNavigationGuard';
import { SystemMessage } from '../SystemMessage';
import { adminWrite, LoadState, useAdminResource, type AdminProps } from './common';

const path = '/users/registration-policy';
const fields = [
  { key: 'allowedDomains', zh: '邮箱后缀白名单', en: 'Allowed email domains', example: 'example.com', Icon: CheckCircle },
  { key: 'deniedDomains', zh: '邮箱后缀黑名单', en: 'Blocked email domains', example: 'mail.example.com', Icon: Prohibit },
  { key: 'deniedEmails', zh: '邮箱黑名单', en: 'Blocked email addresses', example: 'sender@example.com', Icon: EnvelopeSimple },
] as const;
type Draft = Record<keyof RegistrationPolicy, string>;

function toDraft(settings: RegistrationPolicy): Draft {
  return {
    allowedDomains: settings.allowedDomains.join('\n'),
    deniedDomains: settings.deniedDomains.join('\n'),
    deniedEmails: settings.deniedEmails.join('\n'),
  };
}

const lines = (text: string) => text.split('\n').map((line) => line.trim()).filter(Boolean);

function PolicyForm({ ownerId, initial, reload }: AdminProps & { initial: RegistrationPolicySnapshot; reload: () => void }) {
  const { t } = useI18n();
  const [snapshot, setSnapshot] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial.settings));
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const settings = {
    allowedDomains: lines(draft.allowedDomains),
    deniedDomains: lines(draft.deniedDomains),
    deniedEmails: lines(draft.deniedEmails),
  };
  const dirty = fields.some(({ key }) => settings[key].join('\n') !== snapshot.settings[key].join('\n'));
  useAdminEdits(dirty, busy);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || conflict || !dirty) return;
    setError('');
    setSaved(false);
    setBusy(true);
    try {
      const result = await adminWrite<RegistrationPolicySnapshot>(ownerId, path, { settings, revision: snapshot.revision });
      setSnapshot(result);
      setDraft(toDraft(result.settings));
      setSaved(true);
    } catch (problem) {
      setError(problem instanceof Error ? problem.message : t('保存失败', 'Could not save'));
      setConflict(problem instanceof ApiError && problem.status === 409);
    } finally {
      setBusy(false);
    }
  }

  return <form className="feature-form admin-registration-policy" onSubmit={save}>
    <p className="feature-muted admin-registration-policy-help">
      {t('每行一项。域名规则包含子域，黑名单优先。白名单留空时允许其他域名。', 'Enter one item per line. Domain rules include subdomains. Block rules take precedence. Leave the allowlist empty to allow other domains.')}
    </p>
    <fieldset className="admin-registration-fields" disabled={busy || conflict}>
      <legend className="admin-users-visually-hidden">{t('注册邮箱规则', 'Registration email rules')}</legend>
      {fields.map(({ key, zh, en, example, Icon }) => <label className="admin-registration-field" key={key}>
        <span><Icon size={19} aria-hidden="true" />{t(zh, en)}</span>
        <textarea value={draft[key]} placeholder={example} rows={7} maxLength={51_000} spellCheck={false} autoCapitalize="off"
          onChange={(event) => {
            const value = event.target.value;
            setDraft((previous) => ({ ...previous, [key]: value }));
            setSaved(false);
            setError('');
          }} />
      </label>)}
    </fieldset>
    <div className="admin-registration-footer">
      {error && <p className="form-error" role="alert"><SystemMessage text={error} /></p>}
      {saved && <p className="form-notice" role="status">{t('注册规则已保存', 'Registration rules saved')}</p>}
      <div className="feature-actions">
        {conflict && <button type="button" className="outline-button" onClick={reload}>{t('重新加载', 'Reload')}</button>}
        <button className="primary-button" disabled={busy || !dirty || conflict}>{busy ? t('保存中…', 'Saving…') : t('保存规则', 'Save rules')}</button>
      </div>
    </div>
  </form>;
}

export function RegistrationPolicyPanel({ ownerId }: AdminProps) {
  const { data, error, retry } = useAdminResource<RegistrationPolicySnapshot>(ownerId, path);
  return data ? <PolicyForm ownerId={ownerId} initial={data} reload={retry} /> : <LoadState error={error} retry={retry} />;
}
