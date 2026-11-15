import { useAdminText } from './i18n';
import { useState } from 'react';
import { Dialog } from '../Dialog';
import {
  adminWrite, ConfirmationForm, DateTime, LoadState, Metrics, Pagination, QueryField, ScrollList, SelectField,
  useAdminList, useAdminResource, type AdminProps, type Confirmation,
} from './common';

type UserRow = { id: string; username: string; email: string; role: 'admin' | 'user'; status: 'active' | 'disabled'; createdAt: number };
type UserDetail = UserRow & { activeSessions: number; finishedPractices: number; publishedScores: number; lastPracticeAt: number | null };
const statuses = { active: '正常', disabled: '已停用' };
const roles = { admin: '管理员', user: '普通用户' };

function UserDialog({ ownerId, id, onClose, onChange }: AdminProps & { id: string; onClose: () => void; onChange: () => void }) {
  const { at, locale } = useAdminText();
  const path = `/users/${encodeURIComponent(id)}`;
  const [revision, setRevision] = useState(0);
  const { data, error, retry } = useAdminResource<{ user: UserDetail }>(ownerId, path, revision);
  const [confirmation, setConfirmation] = useState<Confirmation>();
  const [busy, setBusy] = useState(false);
  const user = data?.user;
  const finish = () => { onClose(); onChange(); };
  const returnToDetail = () => {
    setConfirmation(undefined);
    setRevision((current) => current + 1);
  };

  function changeStatus() {
    if (!user) return;
    const status = user.status === 'active' ? 'disabled' : 'active';
    const action = status === 'active' ? at('启用') : at('停用');
    setConfirmation({
      title: locale === 'en' ? `${at(action)} account` : `${action}账号`, action, target: user.username,
      note: status === 'disabled' ? at('停用会结束该账号的所有登录会话。') : undefined,
      submit: (reason) => adminWrite(ownerId, `${path}/status`, { status, reason }),
    });
  }

  function changeRole() {
    if (!user) return;
    const role = user.role === 'admin' ? 'user' : 'admin';
    const action = role === 'admin' ? at('设为管理员') : at('撤销管理员');
    setConfirmation({
      title: at(action), action, target: user.username, note: at('更改权限后，该账号需要重新登录。'),
      submit: (reason) => adminWrite(ownerId, `${path}/role`, { role, reason }),
    });
  }

  function revokeSessions() {
    if (!user?.activeSessions || user.id === ownerId) return;
    setConfirmation({
      title: at('退出所有会话'), action: '退出', target: user.username, note: at('该账号需要重新登录。'),
      submit: (reason) => adminWrite(ownerId, `${path}/sessions/revoke`, { reason }),
    });
  }

  return <Dialog key={confirmation?.title ?? 'detail'} title={confirmation?.title ?? at('用户详情')} dismissible={!busy}
    onClose={confirmation ? () => setConfirmation(undefined) : onClose}>
    {confirmation
      ? <ConfirmationForm confirmation={confirmation} busy={busy} setBusy={setBusy} onCancel={() => setConfirmation(undefined)} onSuccess={confirmation.action === '退出' ? returnToDetail : finish} />
      : user
        ? <div className="feature-form">
          <div className="admin-user-identity">
            <strong>{user.username}</strong><span className="feature-muted">{user.email}</span>
          </div>
          <Metrics entries={[
            [at('角色'), at(roles[user.role])], [at('账号状态'), at(statuses[user.status])],
            [at('注册时间'), <DateTime value={user.createdAt} compact />],
            [at('最近练习'), user.lastPracticeAt != null ? <DateTime value={user.lastPracticeAt} compact /> : '—'],
            [at('完成练习'), user.finishedPractices], [at('已发布成绩'), user.publishedScores], [at('活跃会话'), user.activeSessions],
          ]} />
          {user.id !== ownerId && <div className="feature-actions">
            {user.status === 'active' && user.activeSessions > 0 && <button className="outline-button" onClick={revokeSessions}>{at("退出所有会话")}</button>}
            <button className="outline-button" disabled={user.role === 'user' && user.status === 'disabled'} onClick={changeRole}>{user.role === 'admin' ? at('撤销管理员') : at('设为管理员')}</button>
            <button className="outline-button" onClick={changeStatus}>{user.status === 'active' ? at('停用') : at('启用')}</button>
          </div>}
        </div>
        : <LoadState error={error} retry={retry} />}
  </Dialog>;
}

export function UsersPanel({ ownerId }: AdminProps) {
  const { at, locale } = useAdminText();
  const list = useAdminList<UserRow>(ownerId, '/users');
  const [selected, setSelected] = useState<string>();
  return <>
    <div className="admin-filters feature-filters">
      <QueryField label={at("用户名或邮箱")} maxLength={254} onSearch={(value) => list.filter('q', value)} />
      <SelectField label={at("账号状态")} options={Object.entries(statuses)} all value={list.filters.status ?? ''} onChange={(value) => list.filter('status', value)} />
      <SelectField label={at("角色")} options={Object.entries(roles)} all value={list.filters.role ?? ''} onChange={(value) => list.filter('role', value)} />
    </div>
    {!list.data ? <LoadState error={list.error} retry={list.retry} /> : <>
      {list.data.entries.length ? <ScrollList label={at("用户列表")}>{list.data.entries.map((user) => <li className="feature-row" key={user.id}>
        <div className="feature-row-main">
          <h3>{user.username}</h3>
          <div className="feature-meta"><span>{user.email}</span><span>{at(roles[user.role])}</span><span>{at(statuses[user.status])}</span></div>
        </div>
        <button className="outline-button feature-action-button" aria-label={`${user.username} ${locale === 'en' ? 'details' : '详情'}`} onClick={() => setSelected(user.id)}>{at("详情")}</button>
      </li>)}</ScrollList> : <p className="admin-load-state feature-muted">{at("暂无匹配用户")}</p>}
      <Pagination data={list.data} setPage={list.setPage} />
    </>}
    {selected && <UserDialog ownerId={ownerId} id={selected} onClose={() => setSelected(undefined)} onChange={list.refresh} />}
  </>;
}
