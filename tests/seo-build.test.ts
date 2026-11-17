import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { expect, it } from 'vitest';

it('builds crawler-readable public pages, canonical URLs and sitemap without publishing private routes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'typelune-seo-'));
  try {
    mkdirSync(join(directory, 'src/data'), { recursive: true });
    mkdirSync(join(directory, 'dist/client'), { recursive: true });
    writeFileSync(join(directory, 'src/data/seo.json'), readFileSync('src/data/seo.json'));
    const template = readFileSync('index.html', 'utf8');
    writeFileSync(join(directory, 'dist/client/index.html'), template);
    const run = (extra: Record<string, string>) => execFileSync(process.execPath, [resolve('scripts/build-seo.mjs')], {
      cwd: directory, env: { ...process.env, VITE_SITE_URL: 'https://typing.example', VERCEL_ENV: 'production', ...extra }, encoding: 'utf8',
    });
    run({});
    const lessons = readFileSync(join(directory, 'dist/client/seo/lessons.html'), 'utf8');
    expect(lessons).toContain('<title>指法课程 · TypeLune</title>');
    expect(lessons).toContain('<h1>指法课程 · TypeLune</h1>');
    expect(lessons).toContain('rel="canonical" href="https://typing.example/lessons?tl=zh-CN"');
    const sitemap = readFileSync(join(directory, 'dist/client/sitemap.xml'), 'utf8');
    expect(sitemap).toContain('<loc>https://typing.example/lessons?tl=zh-CN</loc>');
    expect(sitemap).not.toMatch(/account|users|records|api\//);
    expect(readFileSync(join(directory, 'dist/client/app.html'), 'utf8')).toContain('content="noindex, follow"');
    expect(existsSync(join(directory, 'dist/client/seo/account.html'))).toBe(false);
    writeFileSync(join(directory, 'dist/client/index.html'), template);
    run({ VERCEL_ENV: 'preview' });
    expect(readFileSync(join(directory, 'dist/client/index.html'), 'utf8')).toContain('content="noindex, nofollow"');
    expect(readFileSync(join(directory, 'dist/client/robots.txt'), 'utf8')).toBe('User-agent: *\nDisallow: /\n');
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
