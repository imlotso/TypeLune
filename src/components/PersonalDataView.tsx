import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useState } from 'react';
import { Database } from '@phosphor-icons/react/Database';
import type { User } from '../lib/api';
import { collectPersonalExport } from '../lib/personal-export-fetch';
import { recordsCsv } from '../lib/personal-export';
import { WorkspaceCapacity, type CapacityDestination } from './WorkspaceCapacity';

function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadPersonalData(user: User, format: 'json' | 'csv', options?: { localOnly?: boolean }) {
  const data = await collectPersonalExport(user, { includeFeedback: format === 'json', localOnly: options?.localOnly });
  const date = data.exportedAt.slice(0, 10);
  if (format === 'json') download(JSON.stringify(data, null, 2), 'application/json;charset=utf-8', `typing-${options?.localOnly ? 'local-recovery' : 'personal-data'}-${date}.json`);
  else download(recordsCsv(data.data.records), 'text/csv;charset=utf-8', `typing-records-${date}.csv`);
  const recovery = data.data.localRecoveryCopies;
  return { missing: data.missing, hasLocalRecovery: !!recovery && (recovery.workspace.length + recovery.drafts.length + recovery.records.length > 0),
    hasCloudRecovery: !!data.data.cloudRecoveryCopies?.workspace.length };
}
export function recoveryCopyLabel(local: boolean, cloud: boolean, t: (zh: string, en: string) => string = (zh) => zh) { return local && cloud ? t('本机及云端', 'local and cloud') : local ? t('本机', 'local') : cloud ? t('云端', 'cloud') : ''; }

export function PersonalDataView({ user, onClear, onCompacted, onGuestImport, onManageCapacity, onResetSettings }: { user: User; onClear: () => void; onCompacted: () => void; onGuestImport: () => void; onManageCapacity: (destination: CapacityDestination) => void; onResetSettings: () => Promise<void> }) {
  const { t, locale } = useI18n();

  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState('');
  async function exportData(format: 'json' | 'csv') {
    setBusy(true); setNotice(''); setMissing([]); setError('');
    try {
      const { missing: unavailable, hasLocalRecovery, hasCloudRecovery } = await downloadPersonalData(user, format);
      setMissing(unavailable);
      const copies = recoveryCopyLabel(hasLocalRecovery, hasCloudRecovery, t);
      setNotice(`${unavailable.length ? t("已导出可读取的部分资料", "Readable data exported") : t("导出完成", "Export complete")}${copies ? (format === 'csv' ? t(`；未合并的${copies}副本仅在 JSON 中`, `; unmerged ${copies} copies are in JSON only`) : t(`，含未合并的${copies}副本`, `, including unmerged ${copies} copies`)) : ''}`);
    } catch (problem) { setError(problem instanceof Error ? problem.message : t("导出失败", "Export failed")); }
    finally { setBusy(false); }
  }
  return <section className="content-panel feature-panel personal-data">
    <div className="content-heading"><h1><Database size={25} aria-hidden="true" />{t("个人数据", "Personal data")}</h1></div>
    <div className="feature-actions"><button className="primary-button" disabled={busy} onClick={() => void exportData('json')}>{t("导出个人数据 JSON", "Export personal data JSON")}</button>
      <button className="outline-button" disabled={busy} onClick={() => void exportData('csv')}>{t("导出记录 CSV", "Export history CSV")}</button>
      <button className="outline-button" disabled={busy} onClick={onGuestImport}>{t("导入游客资料", "Import guest data")}</button>
      <button className="outline-button" disabled={busy} onClick={onClear}>{t("清除此设备数据", "Clear data on this device")}</button></div>
    {busy && <p role="status">{t("正在整理数据…", "Preparing data…")}</p>}
    {notice && <p className="form-notice" role="status">{<SystemMessage text={notice} />}</p>}
    {error && <p className="form-error" role="alert">{<SystemMessage text={error} />}</p>}
    {!!missing.length && <ul className="personal-data-missing">{missing.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
    <WorkspaceCapacity ownerId={user.id} onCompacted={onCompacted} onManage={onManageCapacity} onResetSettings={onResetSettings} />
  </section>;
}
