import { describe, expect, it } from 'vitest';
import { filterSpeedInsight, shouldCollectSpeedInsights } from '../src/lib/speed-insights';

describe('free Vercel Speed Insights privacy boundary', () => {
  it('only enables on Vercel production builds', () => {
    expect(shouldCollectSpeedInsights('1', 'production')).toBe(true);
    for (const [host, env] of [[undefined, 'production'], ['1', 'preview'], ['1', 'development'], [undefined, undefined]]) {
      expect(shouldCollectSpeedInsights(host, env)).toBe(false);
    }
  });
  it('removes query, fragment, credentials, and private paths', () => {
    expect(filterSpeedInsight({ url: 'https://typing.imlotso.com/?email=private#secret' })).toEqual({ url: 'https://typing.imlotso.com/' });
    for (const url of ['https://typing.imlotso.com/admin', 'https://typing.imlotso.com/api/me', 'https://typing.imlotso.com/articles/private-id', 'https://user:secret@typing.imlotso.com/', 'not a url']) {
      expect(filterSpeedInsight({ url })).toBeNull();
    }
  });
  it('keeps the original event unchanged', () => {
    const event = { url: 'https://typing.imlotso.com/?secret=1' };
    filterSpeedInsight(event);
    expect(event.url).toContain('?secret');
  });
});
