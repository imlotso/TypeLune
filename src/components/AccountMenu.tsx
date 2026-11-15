import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState } from 'react';
import { CaretDown } from '@phosphor-icons/react/CaretDown';
import type { User } from '../lib/api';
import { AccountAvatar } from './AccountAvatar';

type Props = {
  user: User; disabled: boolean; onAccount: () => void; onRecords: () => void; onData: () => void; onFeedback: () => void;
  onLogout: () => void; onAdministration?: () => void;
};

export function AccountMenu({ user, disabled, onAccount, onRecords, onData, onFeedback, onLogout, onAdministration }: Props) {
  const { t, locale } = useI18n();

  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    menu.current?.querySelector<HTMLButtonElement>('[role=menuitem]')?.focus();
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  const choose = (action: () => void) => { setOpen(false); button.current?.focus(); action(); };
  return <div className="more-nav account-nav" ref={root}>
    <button ref={button} className="account-button" disabled={disabled} aria-haspopup="menu" aria-expanded={open}
      onClick={() => setOpen((current) => !current)}><AccountAvatar avatar={user.avatar} /> {user.displayName || user.username} <CaretDown size={14} aria-hidden="true" /></button>
    {open && <div className="more-popover account-popover" role="menu" ref={menu} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus(); return; }
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const items = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role=menuitem]')];
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 :
        (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    }}>
      <button role="menuitem" tabIndex={-1} onClick={() => choose(onAccount)}>{t("账号设置", "Account settings")}</button>
      <button role="menuitem" tabIndex={-1} onClick={() => choose(onRecords)}>{t("我的记录", "My history")}</button>
      <button role="menuitem" tabIndex={-1} onClick={() => choose(onData)}>{t("个人数据", "Personal data")}</button>
      <button role="menuitem" tabIndex={-1} onClick={() => choose(onFeedback)}>{t("我的反馈", "My feedback")}</button>
      {onAdministration && <button role="menuitem" tabIndex={-1} onClick={() => choose(onAdministration)}>{t("返回后台", "Back to admin")}</button>}
      <button role="menuitem" tabIndex={-1} onClick={() => choose(onLogout)}>{t("退出登录", "Sign out")}</button>
    </div>}
  </div>;
}
