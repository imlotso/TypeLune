import { SystemMessage } from './SystemMessage';
import { useI18n } from '../lib/i18n';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiError, type User } from '../lib/api';
import { Dialog } from './Dialog';
import { PasswordField } from './PasswordField';

type Mode = 'password' | 'code' | 'register' | 'reset';

export function AuthDialog({ onClose, onLogin, registrationEnabled }: { onClose: () => void; onLogin: (user: User) => void; registrationEnabled?: boolean }) {
  const { t, locale } = useI18n();

  const [mode, setMode] = useState<Mode>('password');
  const [username, setUsername] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(Date.now);
  const purpose = mode === 'register' ? 'register' : mode === 'reset' ? 'reset' : 'login';
  const cooldownKey = `${purpose}:${email.trim().toLowerCase()}`;
  const activeKey = useRef(cooldownKey);
  activeKey.current = cooldownKey;
  const remaining = Math.max(0, Math.ceil(((cooldowns[cooldownKey] ?? 0) - clock) / 1000));
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const switchMode = (next: Mode) => { setMode(next); setError(''); setNotice(''); setCode(''); };

  async function sendCode() {
    if (mode === 'register' && registrationEnabled === false) { setError(t("当前已关闭注册", "Registration is closed")); return; }
    if (!email.trim()) { setError(t("请先填写邮箱", "Enter your email first")); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      await api('/api/auth/code', { method: 'POST', body: { email, purpose } });
      const time = Date.now();
      setClock(time); setCooldowns((current) => ({ ...current, [cooldownKey]: time + 60_000 }));
      if (activeKey.current === cooldownKey) setNotice(t("验证码请求已提交。", "Verification code requested."));
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 429) {
        const time = Date.now();
        setClock(time); setCooldowns((current) => ({ ...current, [cooldownKey]: time + 60_000 }));
      }
      if (activeKey.current === cooldownKey) setError((problem as Error).message);
    }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (mode === 'register' && registrationEnabled === false) { setError(t("当前已关闭注册", "Registration is closed")); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (mode === 'reset') {
        await api('/api/auth/reset', { method: 'POST', body: { email, code, password } });
        switchMode('password'); setIdentifier(email); setPassword(''); setNotice(t("密码已更新。", "Password updated."));
      } else {
        const path = mode === 'register' ? '/api/auth/register' : mode === 'code' ? '/api/auth/login-code' : '/api/auth/login';
        const body = mode === 'register' ? { username, email, password, code } : mode === 'code' ? { email, code } : { identifier, password };
        const data = await api<{ user: User }>(path, { method: 'POST', body });
        onLogin(data.user); onClose();
      }
    } catch (problem) { setError((problem as Error).message); }
    finally { setBusy(false); }
  }

  const heading = mode === 'register' ? t("创建账号", "Create account") : mode === 'reset' ? t("找回密码", "Reset password") : t("登录", "Sign in");
  return <Dialog title={heading} onClose={onClose}>
    {(mode === 'password' || mode === 'code') && <div className="auth-tabs" role="tablist" aria-label={t("登录方式", "Sign-in method")}>
      <button role="tab" aria-selected={mode === 'password'} onClick={() => switchMode('password')}>{t("密码登录", "Password")}</button>
      <button role="tab" aria-selected={mode === 'code'} onClick={() => switchMode('code')}>{t("邮箱验证码", "Email code")}</button>
    </div>}
    <form onSubmit={submit} className="auth-form">
      {mode === 'register' && <label>{t("用户名", "Username")}<input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required /></label>}
      {mode === 'password' ? <label>{t("用户名或邮箱", "Username or email")}<input value={identifier} onChange={(event) => setIdentifier(event.target.value)} autoComplete="username" required /></label> :
        <label>{t("邮箱", "Email")}<input type="email" value={email} onChange={(event) => { setEmail(event.target.value); setNotice(''); setError(''); }} autoComplete="email" required /></label>}
      {mode !== 'password' && <label>{t("邮箱验证码", "Email code")}<span className="code-field"><input aria-label={t("邮箱验证码", "Email code")} inputMode="numeric" value={code} onChange={(event) => setCode(event.target.value)} maxLength={6} required /><button type="button" className="text-button" disabled={busy || remaining > 0 || (mode === 'register' && registrationEnabled === false)} onClick={sendCode}>{remaining ? t(`${remaining} 秒后重发`, `Resend in ${remaining}s`) : t("获取验证码", "Get code")}</button></span></label>}
      {mode !== 'code' && <PasswordField key={mode} label={mode === 'reset' ? t("新密码", "New password") : t("密码", "Password")} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'password' ? 'current-password' : 'new-password'} minLength={mode === 'password' ? undefined : 10} required />}
      {error && <p className="form-error" role="alert">{<SystemMessage text={error} />}</p>}
      {notice && <p className="form-notice" role="status">{<SystemMessage text={notice} />}</p>}
      <button className="primary-button auth-submit" disabled={busy || (mode === 'register' && registrationEnabled === false)}>{busy ? t("处理中…", "Working…") : mode === 'register' ? t("注册并登录", "Create account and sign in") : mode === 'reset' ? t("更新密码", "Update password") : t("登录", "Sign in")}</button>
    </form>
    <div className="auth-links">
      {mode !== 'register' ? <button className="text-button" disabled={registrationEnabled === false} onClick={() => switchMode('register')}>{t("创建账号", "Create account")}</button> : <button className="text-button" onClick={() => switchMode('password')}>{t("返回登录", "Back to sign in")}</button>}
      {mode !== 'reset' && <button className="text-button" onClick={() => switchMode('reset')}>{t("忘记密码？", "Forgot password?")}</button>}
      {mode === 'reset' && <button className="text-button" onClick={() => switchMode('password')}>{t("返回登录", "Back to sign in")}</button>}
    </div>
    {registrationEnabled === false && <p className="form-error" role="status">{t("当前已关闭注册", "Registration is closed")}</p>}
  </Dialog>;
}
