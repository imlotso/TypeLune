const adminPreviewKey = 'typelune.adminPreviewOwner';
const dismissedResultsKey = 'typelune.dismissedResults';
const maxDismissedResults = 50;

export function readAdminPreviewOwner(): string | undefined {
  try {
    const value = sessionStorage.getItem(adminPreviewKey)?.trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

export function writeAdminPreviewOwner(ownerId?: string): void {
  try {
    if (ownerId) sessionStorage.setItem(adminPreviewKey, ownerId);
    else sessionStorage.removeItem(adminPreviewKey);
  } catch {
    // Ignore storage unavailability in restricted browser contexts.
  }
}

function resultKey(ownerId: string | null, recordId: string): string {
  return `${ownerId ?? 'guest'}:${recordId}`;
}

function readDismissedList(): string[] {
  try {
    const raw = localStorage.getItem(dismissedResultsKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

export function isResultDismissed(ownerId: string | null, recordId?: string): boolean {
  if (!recordId) return false;
  return readDismissedList().includes(resultKey(ownerId, recordId));
}

export function markResultDismissed(ownerId: string | null, recordId?: string): void {
  if (!recordId) return;
  try {
    const key = resultKey(ownerId, recordId);
    const list = readDismissedList().filter((item) => item !== key);
    list.push(key);
    localStorage.setItem(dismissedResultsKey, JSON.stringify(list.slice(-maxDismissedResults)));
  } catch {
    // Ignore storage unavailability in restricted browser contexts.
  }
}

export function clearResultDismissed(ownerId: string | null, recordId?: string): void {
  if (!recordId) return;
  try {
    const key = resultKey(ownerId, recordId);
    const list = readDismissedList();
    if (!list.includes(key)) return;
    localStorage.setItem(dismissedResultsKey, JSON.stringify(list.filter((item) => item !== key)));
  } catch {
    // Ignore storage unavailability in restricted browser contexts.
  }
}
