import { useI18n } from '../lib/i18n';
import { InterfaceLanguageSettings } from './InterfaceLanguageSettings';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { api, type User } from '../lib/api';
import { isValidDisplayName, isValidPassword, isValidUsername, passwordRule, usernameRule } from '../lib/account-validation';
import { Dialog } from './Dialog';
import { PasswordField } from './PasswordField';
import { AccountAvatar } from './AccountAvatar';
import { EmailChangeForm } from './EmailChangeForm';
import { SessionManager } from './SessionManager';
import { AccountDeletion } from './AccountDeletion';

type Props = { user: User; onClose: () => void; onUpdate: (user: User) => void; onSignedOut: (message: string) => void; onDelete: (password: string) => Promise<void>; onGuardChange?: (guard: { busy: boolean; dirty: boolean }) => void };

export function AccountDialog({ user, onClose, onUpdate, onSignedOut, onDelete, onGuardChange }: Props) {
  const { t, locale } = useI18n();

  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName || user.username);
  const [avatar, setAvatar] = useState<User['avatar']>(user.avatar ?? null);
  const [usernamePassword, setUsernamePassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [visibility, setVisibility] = useState({ username: 0, email: 0, password: 0, deletion: 0 });
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [emailDirty, setEmailDirty] = useState(false);
  const [deletionDirty, setDeletionDirty] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const safeAction = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const wasConfirming = useRef(false);
  const dirty = username !== user.username || displayName !== (user.displayName || user.username) || (avatar ?? null) !== (user.avatar ?? null) ||
    !!(usernamePassword || currentPassword || newPassword || confirmPassword) || emailDirty || deletionDirty;
  useLayoutEffect(() => { onGuardChange?.({ busy, dirty }); }, [busy, dirty, onGuardChange]);
  useEffect(() => () => onGuardChange?.({ busy: false, dirty: false }), [onGuardChange]);
  useEffect(() => {
    if (confirmClose) { wasConfirming.current = true; safeAction.current?.focus(); }
    else if (wasConfirming.current) {
      const target = previousFocus.current?.isConnected ? previousFocus.current : content.current?.querySelector<HTMLElement>('input:not(:disabled), select:not(:disabled), button:not(:disabled)');
      target?.focus(); wasConfirming.current = false;
    }
  }, [confirmClose]);
  function requestClose() {
    if (busy) return;
    if (confirmClose) { setConfirmClose(false); return; }
    if (dirty) {
      previousFocus.current = document.activeElement as HTMLElement | null;
      setVisibility((current) => ({ username: current.username + 1, email: current.email + 1, password: current.password + 1, deletion: current.deletion + 1 }));
      setConfirmClose(true);
    }
    else onClose();
  }
  const closeSection = (area: keyof typeof visibility, open: boolean) => {
    if (!open) setVisibility((current) => ({ ...current, [area]: current[area] + 1 }));
  };
  const [message, setMessage] = useState<{ area: 'profile' | 'username' | 'password'; text: string; error: boolean }>();
  const feedback = (area: 'profile' | 'username' | 'password') => message?.area === area &&
    <p className={message.error ? 'form-error' : 'form-notice'} role={message.error ? 'alert' : 'status'}>{message.text}</p>;

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setMessage(undefined);
    const value = displayName.trim();
    if (!isValidDisplayName(value)) { setMessage({ area: 'profile', text: t("昵称须为 1–24 个字符", "Display name must be 1–24 characters"), error: true }); return; }
    setBusy(true);
    try {
      const data = await api<{ user: User }>('/api/account/profile', { method: 'POST', headers: { 'X-Workspace-Owner': user.id }, body: { displayName: value, avatar: avatar ?? null } });
      onUpdate(data.user); setDisplayName(data.user.displayName || data.user.username); setAvatar(data.user.avatar ?? null); setMessage({ area: 'profile', text: t("资料已保存", "Profile saved"), error: false });
    } catch (problem) { setMessage({ area: 'profile', text: (problem as Error).message, error: true }); }
    finally { setBusy(false); }
  }

  async function saveUsername(event: FormEvent) {
    event.preventDefault(); setMessage(undefined);
    const value = username.trim();
    if (!isValidUsername(value)) { setMessage({ area: 'username', text: t(usernameRule, "Username must be 3–24 letters, numbers, underscores or hyphens"), error: true }); return; }
    setBusy(true);
    try {
      const data = await api<{ user: User }>('/api/account/username', { method: 'POST', headers: { 'X-Workspace-Owner': user.id }, body: { username: value, currentPassword: usernamePassword } });
      onUpdate(data.user); setUsername(data.user.username); setUsernamePassword(''); setMessage({ area: 'username', text: t("用户名已保存", "Username saved"), error: false });
    } catch (problem) { setMessage({ area: 'username', text: (problem as Error).message, error: true }); }
    finally { setBusy(false); }
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault(); setMessage(undefined);
    if (!isValidPassword(newPassword) || newPassword !== confirmPassword) { setMessage({ area: 'password', text: t(`${passwordRule}，两次输入须一致`, "Password must be 10–128 characters and both entries must match"), error: true }); return; }
    setBusy(true);
    try {
      await api('/api/account/password', { method: 'POST', headers: { 'X-Workspace-Owner': user.id }, body: { currentPassword, newPassword, confirmPassword } });
      onSignedOut(t("密码已更新，请重新登录", "Password updated. Please sign in again"));
    } catch (problem) { setMessage({ area: 'password', text: (problem as Error).message, error: true }); }
    finally { setBusy(false); }
  }

  return <Dialog title={confirmClose ? t("放弃未保存的修改？", "Discard unsaved changes?") : t("账号设置", "Account settings")} onClose={requestClose} dismissible={!busy}>
    {confirmClose && <div className="feature-form"><p>{t("未保存的账号资料将丢失。", "Unsaved account changes will be lost.")}</p><div className="feature-actions"><button ref={safeAction} type="button" className="outline-button" onClick={() => setConfirmClose(false)}>{t("继续编辑", "Keep editing")}</button><button type="button" className="primary-button" onClick={onClose}>{t("放弃修改", "Discard changes")}</button></div></div>}
    <div ref={content} hidden={confirmClose}>
    <div className="feature-form"><InterfaceLanguageSettings disabled={busy} showSync /></div>
    <p className="account-email"><AccountAvatar avatar={user.avatar} size={32} /> <span>{t("用户名：", "Username: ")}{user.username}<br />{t("邮箱：", "Email: ")}{user.email}</span></p>
    <form className="auth-form" onSubmit={saveProfile}>
      <label>{t("公开昵称", "Public display name")}<input value={displayName} disabled={busy} required onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label>{t("头像", "Avatar")}<select disabled={busy} value={avatar ?? ''} onChange={(event) => setAvatar((event.target.value || null) as User['avatar'])}>
        <option value="">{t("默认", "Default")}</option><option value="cloud">{t("云朵", "Cloud")}</option><option value="star">{t("星星", "Star")}</option><option value="moon">{t("月亮", "Moon")}</option>
      </select></label>
      <button className="outline-button" disabled={busy}>{t("保存资料", "Save profile")}</button>
      {feedback('profile')}
    </form>
    <details className="account-section" onToggle={(event) => closeSection('username', event.currentTarget.open)}><summary>{t("更改用户名", "Change username")}</summary><form className="auth-form" onSubmit={saveUsername}>
      <label>{t("用户名", "Username")}<input value={username} autoComplete="username" disabled={busy} required onChange={(event) => setUsername(event.target.value)} /></label>
      <PasswordField key={visibility.username} label={t("当前密码（用户名）", "Current password (username)")} toggleLabel={t("当前密码（用户名）", "Current password (username)")} value={usernamePassword} autoComplete="current-password" disabled={busy} required onChange={(event) => setUsernamePassword(event.target.value)} />
      <button className="outline-button" disabled={busy}>{t("保存用户名", "Save username")}</button>
      {feedback('username')}
    </form></details>
    <details className="account-section" onToggle={(event) => closeSection('email', event.currentTarget.open)}><summary>{t("更换邮箱", "Change email")}</summary><EmailChangeForm ownerId={user.id} busy={busy} setBusy={setBusy} onSignedOut={onSignedOut} visibilityVersion={visibility.email} onDirtyChange={setEmailDirty} /></details>
    <details className="account-section" onToggle={(event) => closeSection('password', event.currentTarget.open)}><summary>{t("修改密码", "Change password")}</summary><form className="auth-form" onSubmit={changePassword}>
      <PasswordField key={`current-${visibility.password}`} label={t("当前密码", "Current password")} toggleLabel={t("当前密码", "Current password")} value={currentPassword} autoComplete="current-password" disabled={busy} required onChange={(event) => setCurrentPassword(event.target.value)} />
      <PasswordField key={`new-${visibility.password}`} label={t("新密码", "New password")} toggleLabel={t("新密码", "New password")} value={newPassword} autoComplete="new-password" disabled={busy} required onChange={(event) => setNewPassword(event.target.value)} />
      <PasswordField key={`confirm-${visibility.password}`} label={t("确认新密码", "Confirm new password")} toggleLabel={t("确认新密码", "Confirm new password")} value={confirmPassword} autoComplete="new-password" disabled={busy} required onChange={(event) => setConfirmPassword(event.target.value)} />
      <button className="primary-button" disabled={busy}>{t("修改密码", "Change password")}</button>
      {feedback('password')}
    </form></details>
    <details className="account-section" onToggle={(event) => setSessionsOpen(event.currentTarget.open)}><summary>{t("登录设备", "Signed-in devices")}</summary>
      {sessionsOpen && <SessionManager ownerId={user.id} busy={busy} setBusy={setBusy} onSignedOut={onSignedOut} />}
    </details>
    <details className="account-section" onToggle={(event) => closeSection('deletion', event.currentTarget.open)}><summary>{t("注销账号", "Delete account")}</summary>
      <AccountDeletion user={user} busy={busy} setBusy={setBusy} visibilityVersion={visibility.deletion} onDelete={onDelete} onDirtyChange={setDeletionDirty} />
    </details>
    </div>
  </Dialog>;
}
