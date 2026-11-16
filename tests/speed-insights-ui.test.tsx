// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { PerformanceInsights } from '../src/PerformanceInsights';

afterEach(() => { cleanup(); vi.unstubAllEnvs(); document.querySelectorAll('script').forEach((node) => node.remove()); });

it('does not inject the vendor script in local, Docker, or Preview builds', () => {
  for (const [host, target] of [['', ''], ['1', 'preview'], ['1', 'development']]) {
    vi.stubEnv('VITE_VERCEL_HOST', host); vi.stubEnv('VITE_VERCEL_ENV', target);
    const view = render(<PerformanceInsights />);
    expect(document.querySelector('script')).toBeNull(); view.unmount();
  }
});
it('injects one official SDK script on Vercel production with conservative sampling', () => {
  vi.stubEnv('VITE_VERCEL_HOST', '1'); vi.stubEnv('VITE_VERCEL_ENV', 'production');
  const view = render(<PerformanceInsights />); view.rerender(<PerformanceInsights />);
  const scripts = [...document.querySelectorAll('script')];
  expect(scripts).toHaveLength(1);
  expect(scripts[0].dataset.sampleRate).toBe('0.1');
});
