import { clearLocalPractice } from '../hooks/usePractice';
import { clearSyncTime } from '../hooks/useWorkspace';
import { allowLocalAccount, blockLocalAccount, clearLocalWorkspace } from './workspace';

const pendingPrefix = 'cloudtyping.cleanup-pending.v1.';
export function prepareLocalCleanup(ownerId: string) {
  localStorage.setItem(pendingPrefix + ownerId, '1');
  try { blockLocalAccount(ownerId); }
  catch (error) { localStorage.removeItem(pendingPrefix + ownerId); throw error; }
}
export function cancelLocalCleanup(ownerId: string) {
  localStorage.removeItem(pendingPrefix + ownerId);
  allowLocalAccount(ownerId);
}
export function pendingLocalCleanups() {
  try {
    return Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
      .filter((key): key is string => !!key && key.startsWith(pendingPrefix) && localStorage.getItem(key) === '1')
      .map((key) => key.slice(pendingPrefix.length)).filter(Boolean);
  } catch { return []; }
}
export async function finishLocalCleanup(ownerId: string) {
  await clearLocalWorkspace(ownerId);
  clearLocalPractice(ownerId);
  clearSyncTime(ownerId);
  localStorage.removeItem(pendingPrefix + ownerId);
}
