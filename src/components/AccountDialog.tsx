import { useState, type FormEvent } from 'react';
import { api, type User } from '../lib/api';
import { isValidDisplayName, isValidPassword, isValidUsername, passwordRule, usernameRule } from '../lib/account-validation';
import { Dialog } from './Dialog';
import { PasswordField } from './PasswordField';
import { AccountAvatar } from './AccountAvatar';

type Props = { user: User; onClose: () => void; onUpdate: (user: User) => void; onSignedOut: () => void };

export function AccountDialog({ user, onClose, onUpdate, onSignedOut }: Props) {
  const [username, setUsername] = useState(user.username);
  const [displayName, setDisplayName] = useState(user.displayName || user.username);
  const [avatar, setAvatar] = useState<User['avatar']>(user.avatar ?? null);
  const [usernamePassword, setUsernamePassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
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
      onSignedOut();
    } catch (problem) { setMessage({ area: 'password', text: (problem as Error).message, error: true }); }
    finally { setBusy(false); }
  }

  return <Dialog title="账号设置" onClose={onClose} dismissible={!busy}>
    <p className="account-email"><AccountAvatar avatar={user.avatar} size={32} /> <span>邮箱：{user.email}</span></p>
    <form className="auth-form" onSubmit={saveProfile}>
      <label>公开昵称<input value={displayName} required onChange={(event) => setDisplayName(event.target.value)} /></label>
      <label>头像<select value={avatar ?? ''} onChange={(event) => setAvatar((event.target.value || null) as User['avatar'])}>
        <option value="">默认</option><option value="cloud">云朵</option><option value="star">星星</option><option value="moon">月亮</option>
      </select></label>
      <button className="outline-button" disabled={busy}>保存资料</button>
      {feedback('profile')}
    </form>
    <form className="auth-form" onSubmit={saveUsername}>
      <label>用户名<input value={username} autoComplete="username" required onChange={(event) => setUsername(event.target.value)} /></label>
      <PasswordField label="当前密码（用户名）" toggleLabel="当前密码（用户名）" value={usernamePassword} autoComplete="current-password" required onChange={(event) => setUsernamePassword(event.target.value)} />
      <button className="outline-button" disabled={busy}>保存用户名</button>
      {feedback('username')}
    </form>
    <form className="auth-form" onSubmit={changePassword}>
      <PasswordField label="当前密码" toggleLabel="当前密码" value={currentPassword} autoComplete="current-password" required onChange={(event) => setCurrentPassword(event.target.value)} />
      <PasswordField label="新密码" toggleLabel="新密码" value={newPassword} autoComplete="new-password" required onChange={(event) => setNewPassword(event.target.value)} />
      <PasswordField label="确认新密码" toggleLabel="确认新密码" value={confirmPassword} autoComplete="new-password" required onChange={(event) => setConfirmPassword(event.target.value)} />
      <button className="primary-button" disabled={busy}>修改密码</button>
      {feedback('password')}
    </form>
  </Dialog>;
}
