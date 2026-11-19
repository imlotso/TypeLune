import { randomUUID } from 'node:crypto';

export function reportUnexpectedError(error: unknown, scope: 'api' | 'function') {
  const id = randomUUID();
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  const database = typeof code === 'string' && (/^[0-9A-Z]{5}$/.test(code) || code.startsWith('SQLITE_'));
  console.error(JSON.stringify({ event: 'unexpected_request_error', scope, category: database ? 'database' : 'application', id }));
  return id;
}
