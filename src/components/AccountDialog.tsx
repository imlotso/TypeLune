import { useState, type FormEvent } from 'react';
import { api, type User } from '../lib/api';
import { isValidDisplayName, isValidPassword, isValidUsername, passwordRule, usernameRule } from '../lib/account-validation';
import { Dialog } from './Dialog';
import { PasswordField } from './PasswordField';
import { AccountAvatar } from './AccountAvatar';
import { EmailChangeForm } from './EmailChangeForm';
import { SessionManager } from './SessionManager';
import { AccountDeletion } from './AccountDeletion';

type Props = { user: User; onClose: () => void; onUpdate: (user: User) => void; onSignedOut: (message: string) => void; onDelete: (password: string) => Promise<void> };

export function AccountDialog({ user, onClose, onUpdate, onSignedOut, onDelete }: Props) {
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
  const closeSection = (area: keyof typeof visibility, open: boolean) => {
    if (!open) setVisibility((current) => ({ ...current, [area]: current[area] + 1 }));
  };
  const [message, setMessage] = useState<{ area: 'profile' | 'username' | 'password'; text: string; error: boolean }>();
  const feedback = (area: 'profile' | 'username' | 'password') => message?.area === area &&
    <p className={message.error ? 'form-error' : 'form-notice'} role={message.error ? 'alert' : 'status'}>{message.text}</p>;

  async function saveProfile(event: FormEvent) {
    event.preventDefault(); setMessage(undefined);
    const value = displayName.trim();
    if (!isValidDisplayName(value)) { setMessage({ area: 'profile', text: '昵称须为 1–24 个字符', error: true }); return; }
    setBusy(true);
    try {
      const data = await api<{ user: User }>('/api/account/profile', { method: 'POST', headers: { 'X-Workspace-Owner': user.id }, body: { displayName: value, avatar: avatar ?? null } });
      onUpdate(data.user); setDisplayName(data.user.displayName || data.user.username); setAvatar(data.user.avatar ?? null); setMessage({ area: 'profile', text: '资料已保存', error: false });
    } catch (problem) { setMessage({ area: 'profile', text: (problem as Error).message, error: true }); }
    finally { setBusy(false); }
  }

  async function saveUsername(event: FormEvent) {
    event.preventDefault(); setMessage(undefined);
    const value = username.trim();
    if (!isValidUsername(value)) { setMessage({ area: 'username', text: usernameRule, error: true }); return; }
    setBusy(true);
    try {
      const data = await api<{ user: User }>('/api/account/username', { method: 'POST', headers: { 'X-Workspace-Owner': user.id }, body: { username: value, currentPassword: usernamePassword } });
      onUpdate(data.user); setUsername(data.user.username); setUsernamePassword(''); setMessage({ area: 'username', text: '用户名已保存', error: false });
    } catch (problem) { setMessage({ area: 'username', text: (problem as Error).message, error: true }); }
    finally { setBusy(false); }
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault(); setMessage(undefined);
    if (!isValidPassword(newPassword) || newPassword !== confirmPassword) { setMessage({ area: 'password', text: `${passwordRule}，两次输入须一致`, error: true }); return; }
    setBusy(true);
    try {
      await api('/api/account/password', { method: 'POST', headers: { 'X-Workspace-Owner': user.id }, body: { currentPassword, newPassword, confirmPassword } });
      onSignedOut('密码已更新，请重新登录');
    } catch (problem) { setMessage({ area: 'password', text: (problem as Error).message, error: true }); }
    finally { setBusy(false); }
  }

  return <Dialog title="账号设置" onClose={onClose} dismissible={!busy}>
    <p className="account-email"><AccountAvatar avatar={user.avatar} size={32} /> <span>用户名：{user.username}<br />邮箱：{user.email}</span></p>
    <form className="auth-form" onSubmit={saveProfile}>
      <label>公开昵称<input value={displayName} required onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label>头像<select value={avatar ?? ''} onChange={(event) => setAvatar((event.target.value || null) as User['avatar'])}>
        <option value="">默认</option><option value="cloud">云朵</option><option value="star">星星</option><option value="moon">月亮</option>
      </select></label>
      <button className="outline-button" disabled={busy}>保存资料</button>
      {feedback('profile')}
    </form>
    <details className="account-section" onToggle={(event) => closeSection('username', event.currentTarget.open)}><summary>更改用户名</summary><form className="auth-form" onSubmit={saveUsername}>
      <label>用户名<input value={username} autoComplete="username" required onChange={(event) => setUsername(event.target.value)} /></label>
      <PasswordField key={visibility.username} label="当前密码（用户名）" toggleLabel="当前密码（用户名）" value={usernamePassword} autoComplete="current-password" required onChange={(event) => setUsernamePassword(event.target.value)} />
      <button className="outline-button" disabled={busy}>保存用户名</button>
      {feedback('username')}
    </form></details>
    <details className="account-section" onToggle={(event) => closeSection('email', event.currentTarget.open)}><summary>更换邮箱</summary><EmailChangeForm ownerId={user.id} busy={busy} setBusy={setBusy} onSignedOut={onSignedOut} visibilityVersion={visibility.email} /></details>
    <details className="account-section" onToggle={(event) => closeSection('password', event.currentTarget.open)}><summary>修改密码</summary><form className="auth-form" onSubmit={changePassword}>
      <PasswordField key={`current-${visibility.password}`} label="当前密码" toggleLabel="当前密码" value={currentPassword} autoComplete="current-password" required onChange={(event) => setCurrentPassword(event.target.value)} />
      <PasswordField key={`new-${visibility.password}`} label="新密码" toggleLabel="新密码" value={newPassword} autoComplete="new-password" required onChange={(event) => setNewPassword(event.target.value)} />
      <PasswordField key={`confirm-${visibility.password}`} label="确认新密码" toggleLabel="确认新密码" value={confirmPassword} autoComplete="new-password" required onChange={(event) => setConfirmPassword(event.target.value)} />
      <button className="primary-button" disabled={busy}>修改密码</button>
      {feedback('password')}
    </form></details>
    <details className="account-section" onToggle={(event) => setSessionsOpen(event.currentTarget.open)}><summary>登录设备</summary>
      {sessionsOpen && <SessionManager ownerId={user.id} busy={busy} setBusy={setBusy} onSignedOut={onSignedOut} />}
    </details>
    <details className="account-section" onToggle={(event) => closeSection('deletion', event.currentTarget.open)}><summary>注销账号</summary>
      <AccountDeletion user={user} busy={busy} setBusy={setBusy} visibilityVersion={visibility.deletion} onDelete={onDelete} />
    </details>
  </Dialog>;
}
