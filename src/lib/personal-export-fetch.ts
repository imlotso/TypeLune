import { localHistory, readDrafts, savedPracticeFromLegacy } from '../hooks/usePractice';
import type { FeedbackDetail } from '../components/FeedbackView';
import { api, type User } from './api';
import type { PracticeRecord, WorkspaceItem } from './models';
import { isWorkspaceItem, readWorkspace } from './workspace';
import { buildPersonalExport, type FeedbackExport } from './personal-export';
import { localPracticeNeedsRecovery } from './local-practice-generation';

const errorText = (problem: unknown) => problem instanceof Error ? problem.message : '读取失败';
const dataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('附件无法读取'));
  reader.onerror = () => reject(new Error('附件无法读取'));
  reader.readAsDataURL(blob);
});

async function readAttachment(ownerId: string, feedbackId: string, attachmentId: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  try {
    const path = `/api/feedback/${encodeURIComponent(feedbackId)}/attachments/${encodeURIComponent(attachmentId)}`;
    const response = await fetch(path, { credentials: 'same-origin', headers: { 'X-Workspace-Owner': ownerId }, signal: controller.signal });
    if (!response.ok) throw new Error(`附件读取失败（${response.status}）`);
    const blob = await response.blob();
    if (blob.size > 5 * 1024 * 1024 || !blob.type.startsWith('image/webp')) throw new Error('附件数据无效');
    return await dataUrl(blob);
  } finally { clearTimeout(timer); }
}

function legacyData(ownerId: string, missing: string[]) {
  let legacyDrafts = [] as ReturnType<typeof savedPracticeFromLegacy>[];
  let history: PracticeRecord[] = [];
  try { localPracticeNeedsRecovery(ownerId, 1, 1); }
  catch (problem) { missing.push(`本机旧版资料：${errorText(problem)}`); }
  try {
    localStorage.getItem('cloudtyping.history.v1');
    legacyDrafts = readDrafts(ownerId).map(savedPracticeFromLegacy);
    history = localHistory().filter((item) => (item.ownerId ?? null) === ownerId);
  } catch (problem) { missing.push(`本机旧版资料：${errorText(problem)}`); }
  return { legacyDrafts, history };
}

export async function collectPersonalExport(initialUser: User, options?: { includeFeedback?: boolean; localOnly?: boolean }) {
  const ownerId = initialUser.id;
  const headers = { 'X-Workspace-Owner': ownerId };
  const missing: string[] = [];
  let user = initialUser;
  let local: WorkspaceItem[] = [];
  let localAvailable = false;
  let remote: WorkspaceItem[] | undefined;
  const remoteHistory: PracticeRecord[] = [];
  const feedback: FeedbackExport[] = [];
  if (options?.localOnly) {
    try { local = await readWorkspace(ownerId); localAvailable = true; }
    catch (problem) { missing.push(`本机工作区：${errorText(problem)}`); }
    const legacy = legacyData(ownerId, missing);
    missing.push('云端工作区、服务端历史和反馈未读取');
    return buildPersonalExport({ user, local, localAvailable, legacyDrafts: legacy.legacyDrafts, localHistory: legacy.history, remoteHistory, feedback, missing, exportedAt: new Date().toISOString(), preserveLocalCopies: true });
  }
  try {
    const current = await api<{ user: User | null }>('/api/me', { headers });
    if (!current.user || current.user.id !== ownerId) throw new Error('登录账号已变更');
    user = current.user;
  } catch (problem) { missing.push(`账号最新资料：${errorText(problem)}`); }
  try { local = await readWorkspace(ownerId); localAvailable = true; }
  catch (problem) { missing.push(`本机工作区：${errorText(problem)}`); }
  try {
    const cloud = await api<{ items: WorkspaceItem[] }>('/api/workspace', { headers, timeoutMs: 60_000 });
    if (!Array.isArray(cloud.items) || !cloud.items.every(isWorkspaceItem)) throw new Error('同步数据无法读取');
    remote = cloud.items;
  } catch (problem) { missing.push(`云工作区：${errorText(problem)}`); }
  try {
    let cursor: string | undefined;
    const seen = new Set<string>();
    do {
      const query = new URLSearchParams({ limit: '100', ...(cursor && { cursor }) });
      const result = await api<{ entries: PracticeRecord[]; nextCursor?: string | null }>(`/api/history?${query}`, { headers, timeoutMs: 60_000 });
      if (!Array.isArray(result.entries)) throw new Error('历史数据无法读取');
      remoteHistory.push(...result.entries);
      if (!('nextCursor' in result)) { missing.push('服务端历史未提供完整分页'); break; }
      const next = result.nextCursor ?? undefined;
      if (next && (typeof next !== 'string' || seen.has(next))) throw new Error('历史分页无法继续');
      if (next) seen.add(next);
      cursor = next;
    } while (cursor);
  } catch (problem) { missing.push(`服务端历史：${errorText(problem)}`); }
  if (options?.includeFeedback !== false) {
    try {
      const seen = new Set<string>();
      let total = Infinity;
      for (let page = 1; (page - 1) * 20 < total; page++) {
        const list = await api<{ entries: Array<{ id: string }>; total: number }>(`/api/feedback?page=${page}&pageSize=20`, { headers, timeoutMs: 60_000 });
        if (!Array.isArray(list.entries) || !Number.isSafeInteger(list.total) || list.total < 0) throw new Error('反馈列表无法读取');
        if (page === 1) total = list.total;
        if (!list.entries.length && (page - 1) * 20 < total) throw new Error('反馈分页不完整');
        for (const item of list.entries) {
          if (typeof item.id !== 'string' || seen.has(item.id)) continue;
          seen.add(item.id);
          try {
            const response = await api<{ feedback: FeedbackDetail }>(`/api/feedback/${encodeURIComponent(item.id)}`, { headers, timeoutMs: 60_000 });
            const value = response.feedback;
            if (!value || !Array.isArray(value.messages) || !Array.isArray(value.attachments)) throw new Error('反馈详情无法读取');
            const attachments: FeedbackExport['attachments'] = [];
            for (const attachment of value.attachments) {
              try { attachments.push({ name: attachment.name, data: await readAttachment(ownerId, value.id, attachment.id) }); }
              catch (problem) { attachments.push({ name: attachment.name, data: null }); missing.push(`反馈 ${value.id} 附件：${errorText(problem)}`); }
            }
            feedback.push({ id: value.id, category: value.category, title: value.title, description: value.description, status: value.status,
              createdAt: value.createdAt, updatedAt: value.updatedAt, article: value.article,
              messages: value.messages.map(({ authorKind, text, createdAt }) => ({ authorKind, text, createdAt })), attachments });
          } catch (problem) { missing.push(`反馈 ${item.id}：${errorText(problem)}`); }
        }
      }
      if (seen.size < total) missing.push('反馈列表可能因导出期间发生变化而不完整');
    } catch (problem) { missing.push(`反馈：${errorText(problem)}`); }
  }
  const legacy = legacyData(ownerId, missing);
  return buildPersonalExport({ user, local, localAvailable, remote, legacyDrafts: legacy.legacyDrafts, localHistory: legacy.history, remoteHistory, feedback, missing, exportedAt: new Date().toISOString() });
}
