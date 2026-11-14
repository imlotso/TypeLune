import { useState } from 'react';
import { Database } from '@phosphor-icons/react/Database';
import type { User } from '../lib/api';
import { collectPersonalExport } from '../lib/personal-export-fetch';
import { recordsCsv } from '../lib/personal-export';

function download(content: string, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function PersonalDataView({ user }: { user: User }) {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState('');
  async function exportData(format: 'json' | 'csv') {
    setBusy(true); setNotice(''); setMissing([]); setError('');
    try {
      const data = await collectPersonalExport(user, { includeFeedback: format === 'json' });
      const date = data.exportedAt.slice(0, 10);
      if (format === 'json') download(JSON.stringify(data, null, 2), 'application/json;charset=utf-8', `typing-personal-data-${date}.json`);
      else download(recordsCsv(data.data.records), 'text/csv;charset=utf-8', `typing-records-${date}.csv`);
      setMissing(data.missing);
      setNotice(data.missing.length ? '已导出可读取的部分资料' : '导出完成');
    } catch (problem) { setError(problem instanceof Error ? problem.message : '导出失败'); }
    finally { setBusy(false); }
  }
  return <section className="content-panel feature-panel personal-data">
    <div className="content-heading"><h1><Database size={25} aria-hidden="true" />个人数据</h1></div>
    <div className="feature-actions"><button className="primary-button" disabled={busy} onClick={() => void exportData('json')}>导出个人数据 JSON</button>
      <button className="outline-button" disabled={busy} onClick={() => void exportData('csv')}>导出记录 CSV</button></div>
    {busy && <p role="status">正在整理数据…</p>}
    {notice && <p className="form-notice" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!!missing.length && <ul className="personal-data-missing">{missing.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul>}
  </section>;
}
