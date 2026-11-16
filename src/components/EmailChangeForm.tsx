import { useI18n } from '../lib/i18n';
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from 'react';
import { isValidEmail } from '../lib/account-validation';
import { api, ApiError } from '../lib/api';
import { PasswordField } from './PasswordField';

type Props = { ownerId: string; busy: boolean; setBusy: (busy: boolean) => void; onSignedOut: (message: string) => void; visibilityVersion: number; onDirtyChange?: (dirty: boolean) => void };

export function EmailChangeForm({ ownerId, busy, setBusy, onSignedOut, visibilityVersion, onDirtyChange }: Props) {
  const { t, locale } = useI18n();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<{ text: string; error: boolean }>();
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
  const [clock, setClock] = useState(Date.now);
  const target = email.trim().toLowerCase();
  const activeTarget = useRef(target);
  activeTarget.current = target;
  useLayoutEffect(() => { onDirtyChange?.(!!(email || password || code)); }, [email, password, code, onDirtyChange]);
  const remaining = Math.max(0, Math.ceil(((cooldowns[target] ?? 0) - clock) / 1000));
  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function requestCode() {
    setMessage(undefined);
    if (!isValidEmail(target) || !password) { setMessage({ text: t("请输入有效邮箱和当前密码", "Enter a valid email and your current password"), error: true }); return; }
    setBusy(true);
    try {
      await api('/api/account/email/code', { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, body: { email: target, currentPassword: password } });
      const time = Date.now(); setClock(time); setCooldowns((current) => ({ ...current, [target]: time + 60_000 }));
      if (activeTarget.current === target) setMessage({ text: t("验证码请求已提交", "Verification code requested"), error: false });
    } catch (problem) {
      if (problem instanceof ApiError && problem.status === 429) {
        const time = Date.now(); setClock(time); setCooldowns((current) => ({ ...current, [target]: time + 60_000 }));
      }
      if (activeTarget.current === target) setMessage({ text: (problem as Error).message, error: true });
    } finally { setBusy(false); }
  }

  async function confirm(event: FormEvent) {
    event.preventDefault(); setMessage(undefined);
    setBusy(true);
    try {
      await api('/api/account/email/confirm', { method: 'POST', headers: { 'X-Workspace-Owner': ownerId }, body: { email: target, code } });
      onSignedOut(t("邮箱已更新，请重新登录", "Email updated. Please sign in again"));
    } catch (problem) { setMessage({ text: (problem as Error).message, error: true }); }
    finally { setBusy(false); }
  }

  return <form className="auth-form" onSubmit={confirm}>
    <label>{t("新邮箱", "New email")}<input type="email" autoComplete="email" value={email} disabled={busy} required onChange={(event) => { setEmail(event.target.value); setCode(''); setMessage(undefined); }} /></label>
    <PasswordField key={visibilityVersion} label={t("当前密码（邮箱）", "Current password (email)")} toggleLabel={t("当前密码（邮箱）", "Current password (email)")} autoComplete="current-password" value={password} disabled={busy} required onChange={(event) => setPassword(event.target.value)} />
    <label>{t("新邮箱验证码", "New email code")}<span className="code-field"><input aria-label={t("新邮箱验证码", "New email code")} inputMode="numeric" maxLength={6} value={code} disabled={busy} required onChange={(event) => setCode(event.target.value)} />
      <button type="button" className="text-button" disabled={busy || remaining > 0} onClick={() => void requestCode()}>{remaining ? t(`${remaining} 秒后重发`, `Resend in ${remaining}s`) : t("获取邮箱验证码", "Get email code")}</button>
    </span></label>
    <button className="outline-button" disabled={busy}>{t("验证并更换邮箱", "Verify and change email")}</button>
    {message && <p className={message.error ? 'form-error' : 'form-notice'} role={message.error ? 'alert' : 'status'}>{message.text}</p>}
  </form>;
}
