// Legacy practice saves live outside the workspace database.  Older tabs can
// still write them, so do not infer that an empty workspace means a clean device.
export function localPracticeNeedsRecovery(ownerId: string, knownGeneration: number | null, serverGeneration: number): 'generation' | 'conflict' | null {
  const candidates: unknown[] = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || (key !== 'cloudtyping.practice.v1' && key !== 'cloudtyping.history.v1' && !key.startsWith('cloudtyping.practice.v2.'))) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const value: unknown = JSON.parse(raw);
      if (key === 'cloudtyping.history.v1') {
        if (!Array.isArray(value)) throw new Error();
        candidates.push(...value);
      } else candidates.push(value);
    }
  } catch { throw new Error('本机练习资料无法读取'); }
  const owned = candidates.filter((value): value is { ownerId: string; localSyncGeneration?: number } =>
    !!value && typeof value === 'object' && !Array.isArray(value) && (value as { ownerId?: unknown }).ownerId === ownerId);
  if (!owned.length) return null;
  if ((knownGeneration !== null && knownGeneration !== serverGeneration) || (knownGeneration === null && serverGeneration > 1)) return 'generation';
  if (serverGeneration > 1 && owned.some((value) => value.localSyncGeneration !== serverGeneration)) return 'conflict';
  return null;
}
