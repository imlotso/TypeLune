export const serverScoreStates = ['not_submitted', 'pending', 'ranked', 'published', 'rejected', 'removed', 'ineligible', 'unavailable'] as const;
export type ServerScoreState = typeof serverScoreStates[number];
export type ServerScoreStatus = { state: ServerScoreState; eligible: boolean; expired?: boolean; message?: string };
export function isServerScoreStatus(value: unknown): value is ServerScoreStatus {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const status = value as Record<string, unknown>;
  return serverScoreStates.includes(status.state as ServerScoreState) && typeof status.eligible === 'boolean' &&
    (status.expired === undefined || typeof status.expired === 'boolean') && (status.message === undefined || typeof status.message === 'string');
}
