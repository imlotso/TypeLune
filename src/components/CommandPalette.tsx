import { useEffect, useRef, useState } from 'react';
import { Dialog } from './Dialog';

export type Command = { id: string; label: string; shortcut: string; disabled?: boolean; run: () => void };
export function CommandPalette({ commands, shortcutsEnabled, onClose }: { commands: Command[]; shortcutsEnabled: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => { queueMicrotask(() => search.current?.focus()); }, []);
  const term = query.trim().toLocaleLowerCase();
  const shown = commands.filter((command) => !term || `${command.label} ${command.shortcut}`.toLocaleLowerCase().includes(term));
  return <Dialog title="功能面板" onClose={onClose}>
    <div className="feature-form command-palette">
      <label>搜索功能<input ref={search} type="search" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      {!shortcutsEnabled && <p className="feature-muted">快捷键已关闭</p>}
      <p className="feature-muted">打开面板：<kbd>Alt+K</kbd></p>
      {shown.length ? <ul>{shown.map((command) => <li key={command.id}><button type="button" className="command-option" disabled={command.disabled} onClick={() => { onClose(); queueMicrotask(command.run); }}>
        <span>{command.label}</span><kbd>{command.shortcut}</kbd>
      </button></li>)}</ul> : <p className="feature-muted">暂无匹配功能</p>}
    </div>
  </Dialog>;
}
