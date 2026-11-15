import { readFileSync, existsSync } from 'node:fs';
import { expect, it } from 'vitest';
import { getTransformedRoutes } from '@vercel/routing-utils';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createVercelHandler } from '../server/vercel';

it('maps every nested API path to an existing Vercel Function using Vercel routing rules', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const result = getTransformedRoutes(config);
  expect(result.error).toBeNull();
  const routes = result.routes ?? [];
  for (const path of ['/api', '/api/health', '/api/auth/login', '/api/workspace/sync', '/api/tests/example/pause', '/api/not-found']) {
    const matched = routes.find((route) => 'src' in route && route.src && new RegExp(route.src).test(path));
    expect(matched).toBeDefined();
    expect(matched && 'dest' in matched && matched.dest).toMatch(/^\/api\/handler/);
  }
  for (const path of ['/library', '/articles/example', '/records/example', '/account/data', '/feedback/example', '/admin', '/not-found']) {
    const matched = routes.find((route) => 'src' in route && route.src && new RegExp(route.src).test(path));
    expect(matched && 'dest' in matched && matched.dest).toBe('/index.html');
  }
  expect(existsSync('api/handler.ts')).toBe(true);
});

it('blocks API traffic without touching the database during an explicit maintenance deployment', async () => {
  const handler = createVercelHandler({ DAZI_MAINTENANCE: 'true' });
  const server = createServer(handler); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const endpoint = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  try {
    for (const method of ['GET', 'POST']) {
      const response = await fetch(endpoint + '/api/workspace/sync', { method, ...(method === 'POST' && { body: JSON.stringify({ items: ['local change'] }), headers: { 'content-type': 'application/json' } }) });
      expect(response.status).toBe(503);
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toMatchObject({ code: 'MAINTENANCE_MODE' });
    }
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); await handler.close(); }
});
