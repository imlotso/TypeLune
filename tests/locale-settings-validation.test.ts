import { expect, it } from 'vitest';
import { defaultSettings, type WorkspaceItem } from '../src/lib/models';
import { isWorkspaceItem } from '../src/lib/workspace';
import { validateWorkspaceItems } from '../server/workspace';

const settings = (uiLocale?: unknown): WorkspaceItem => ({ kind: 'settings', id: 'preferences', updatedAt: 1, value: { ...defaultSettings, ...(uiLocale === undefined ? {} : { uiLocale }) } });
it('preserves optional account language through the server sync whitelist without changing old settings', () => {
  expect(validateWorkspaceItems([settings()], 'alice', 2)?.[0].value).not.toHaveProperty('uiLocale');
  for (const value of ['zh', 'en', 'auto']) {
    expect(validateWorkspaceItems([settings(value)], 'alice', 2)?.[0].value).toHaveProperty('uiLocale', value);
    expect(isWorkspaceItem(settings(value))).toBe(true);
  }
});
it('rejects invalid account locale in both validators instead of silently dropping it', () => {
  for (const value of ['fr', '', null, {}, 1]) {
    expect(isWorkspaceItem(settings(value))).toBe(false);
    expect(validateWorkspaceItems([settings(value)], 'alice', 2)).toBeNull();
  }
});
