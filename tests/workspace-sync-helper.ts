import type { createApp } from '../server/app';

export async function syncWorkspace(app: Awaited<ReturnType<typeof createApp>>, headers: Record<string, string> | undefined, items: unknown[]) {
  const v2 = { ...headers, 'x-workspace-protocol': '2', 'x-workspace-appearance':'2', 'x-workspace-background-references':'1' };
  const snapshot = await app.inject({ method: 'GET', url: '/api/workspace', headers: { ...v2, 'x-workspace-backgrounds': 'initial' } });
  const data = snapshot.statusCode === 200 ? snapshot.json() as { generation: number; items: Array<{ kind: string; id: string; serverRevision: number }> } : { generation: 1, items: [] };
  const revisions = new Map(data.items.map((entry) => [`${entry.kind}:${entry.id}`, entry.serverRevision]));
  const batch = items.map((value) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
    const entry = value as { kind?: string; id?: string };
    return { ...entry, baseRevision: revisions.get(`${entry.kind}:${entry.id}`) ?? 0 };
  });
  return app.inject({ method: 'POST', url: '/api/workspace/sync', headers: v2, payload: { generation: data.generation, items: batch } });
}
