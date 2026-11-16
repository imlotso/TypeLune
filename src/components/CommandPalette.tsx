import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';

export type Command = { id: string; label: string; shortcut: string; disabled?: boolean; run: () => void };
export function CommandPalette({ commands, shortcutsEnabled, onClose }: { commands: Command[]; shortcutsEnabled: boolean; onClose: () => void }) {
  const { t, locale } = useI18n();
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { queueMicrotask(() => search.current?.focus()); }, []);
  const term = query.trim().toLocaleLowerCase();
  const shown = commands.filter((command) => !term || `${command.label} ${command.shortcut}`.toLocaleLowerCase().includes(term));
  return <Dialog title={t("功能面板", "Commands")} onClose={onClose}>
    <div className="feature-form command-palette">
      <label>{t("搜索功能", "Search commands")}<input ref={search} type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {!shortcutsEnabled && <p className="feature-muted">{t("快捷键已关闭", "Shortcuts disabled")}</p>}
      <p className="feature-muted">{t("打开面板：", "Open commands:")}<kbd>Alt+K</kbd></p>
      {shown.length ? <ul>{shown.map((command) => <li key={command.id}><button type="button" className="command-option" disabled={command.disabled} onClick={() => { onClose(); queueMicrotask(command.run); }}>
        <span>{command.label}</span><kbd>{command.shortcut}</kbd>
      </button></li>)}</ul> : <p className="feature-muted">{t("暂无匹配功能", "No matching commands")}</p>}
    </div>
  </Dialog>;
}
