import { localHistory, readDrafts, savedPracticeFromLegacy } from '../hooks/usePractice';
import type { PracticeRecord, SavedPractice } from './models';
import { mergePracticeRecords, stableRecordId } from './records';

type Risk = { pending: number; unknown: boolean; fingerprint: string; rawFingerprint: string };
const ignored = new Set(['savedAt', 'claimId', 'recoveryRequestId', 'localSyncGeneration', 'scoreStatus', 'legacyLocalIds', 'legacyWorkspaceId', 'legacyIdConflict']);
function covered(local: unknown, cloud: unknown): boolean {
  if (local === undefined) return true;
  if (Array.isArray(local)) return Array.isArray(cloud) && local.length === cloud.length && local.every((value, index) => covered(value, cloud[index]));
  if (local && typeof local === 'object') {
    if (!cloud || typeof cloud !== 'object' || Array.isArray(cloud)) return false;
    const target = cloud as Record<string, unknown>;
    return Object.entries(local).every(([key, value]) => ignored.has(key) || covered(value, target[key]));
  }
  return local === cloud;
}
function draftCovered(local: SavedPractice, cloud: SavedPractice) {
  const { elapsedMs: elapsed, ...other } = local;
  return cloud.elapsedMs >= elapsed && covered(other, cloud);
}
function completeArticle(value: unknown) {
  if (value === undefined) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const article = value as Record<string, unknown>;
  return typeof article.id === 'string' && typeof article.title === 'string' && typeof article.text === 'string' &&
    ['zh', 'en'].includes(article.language as string) && ['beginner', 'intermediate', 'advanced'].includes(article.difficulty as string) && typeof article.custom === 'boolean';
}

// Older versions saved practice data outside the synced workspace. Compare the
// owned copies explicitly before allowing the device cache to be cleared.
function readOwnedLocalCopies(ownerId: string) {
  let unknown = false; let draftCount = 0; let recordCount = 0;
  const owned: Array<[string, unknown]> = [];
  try {
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key || (key !== 'cloudtyping.practice.v1' && key !== 'cloudtyping.history.v1' && !key.startsWith('cloudtyping.practice.v2.'))) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      let parsed: unknown;
      try { parsed = JSON.parse(raw); }
      catch { unknown = true; owned.push([key, raw]); continue; }
      if (key === 'cloudtyping.history.v1') {
        if (!Array.isArray(parsed)) { unknown = true; owned.push([key, raw]); continue; }
        const values = parsed.filter((value) => !!value && typeof value === 'object' && !Array.isArray(value) && (value as { ownerId?: unknown }).ownerId === ownerId);
        recordCount += values.length;
        if (values.some((value) => !completeArticle((value as { article?: unknown }).article))) unknown = true;
        if (values.length) owned.push([key, values]);
      } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && (parsed as { ownerId?: unknown }).ownerId === ownerId) {
        draftCount++; owned.push([key, parsed]);
      } else if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { unknown = true; owned.push([key, raw]); }
    }
  } catch { unknown = true; }
  return { unknown, draftCount, recordCount, owned };
}
export function localPracticeRawFingerprint(ownerId: string) {
  const { owned, unknown } = readOwnedLocalCopies(ownerId);
  return JSON.stringify([owned, unknown]);
}

export function inspectLocalPracticeCopies(ownerId: string, cloudDrafts: readonly SavedPractice[], cloudRecords: readonly PracticeRecord[]): Risk {
  const raw = readOwnedLocalCopies(ownerId);
  let { unknown } = raw;
  const drafts = readDrafts(ownerId);
  const records = localHistory().filter((record) => record.ownerId === ownerId);
  if (drafts.length !== raw.draftCount || records.length !== raw.recordCount) unknown = true;
  const draftMap = new Map(cloudDrafts.map((draft) => [draft.id, draft]));
  const recordMap = new Map(cloudRecords.map((record) => [stableRecordId(record), record]));
  const aliases = new Map<string, PracticeRecord>();
  for (const merged of mergePracticeRecords(records, [], [...cloudRecords])) {
    const remote = recordMap.get(stableRecordId(merged));
    if (remote?.legacyWorkspaceId && !merged.legacyIdConflict) for (const alias of merged.legacyLocalIds ?? []) aliases.set(alias, remote);
  }
  const pendingDrafts = drafts.filter((draft) => {
    const saved = savedPracticeFromLegacy(draft);
    const remote = draftMap.get(saved.id);
    return !remote || remote.recordId !== saved.recordId || !draftCovered(saved, remote);
  }).map((draft) => draft.recordId);
  const pendingRecords = records.filter((record) => {
    const id = stableRecordId(record);
    const remote = recordMap.get(id) ?? aliases.get(id);
    return !remote || !covered(record, { ...remote, recordId: id });
  }).map(stableRecordId);
  const rawFingerprint = JSON.stringify([raw.owned, raw.unknown]);
  return { pending: pendingDrafts.length + pendingRecords.length, unknown, rawFingerprint, fingerprint: JSON.stringify([rawFingerprint, pendingDrafts, pendingRecords, unknown]) };
}
