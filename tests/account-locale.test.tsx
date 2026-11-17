// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { I18nProvider, localeStorageKey, useI18n } from '../src/lib/i18n';
import { LanguageToggle } from '../src/components/LanguageToggle';
import { SettingsDialog } from '../src/components/SettingsDialog';
import { AccountDialog } from '../src/components/AccountDialog';
import { defaultSettings } from '../src/lib/models';

function Probe() {
  const { t } = useI18n();
  return <><span>{t('当前中文', 'Current English')}</span><input aria-label="practice" defaultValue="keep input"/><LanguageToggle /></>;
}
const account = (ownerId: string, preference: 'zh' | 'en' | 'auto' | undefined, save = vi.fn(async () => {}), canChange = true) => ({ ownerId, preference, save, canChange });
beforeEach(() => { window.history.replaceState(null, '', '/'); localStorage.clear(); vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['zh-CN']); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('reads account preference without overwriting it with the guest value or writing on mount', () => {
  localStorage.setItem(localeStorageKey, 'zh');
  const saved = account('alice', 'en');
  render(<I18nProvider account={saved}><Probe /></I18nProvider>);
  expect(screen.getByText('Current English')).toBeTruthy();
  expect(saved.save).not.toHaveBeenCalled();
  expect(localStorage.getItem(localeStorageKey)).toBe('zh');
});

it('follows the browser when account preference is absent, not the saved guest choice', () => {
  localStorage.setItem(localeStorageKey, 'en');
  const saved = account('new-account', undefined);
  render(<I18nProvider account={saved}><Probe /></I18nProvider>);
  expect(screen.getByText('当前中文')).toBeTruthy();
  expect(saved.save).not.toHaveBeenCalled();
});

it('does not respond to guest storage events while signed in', () => {
  render(<I18nProvider account={account('alice', 'en')}><Probe /></I18nProvider>);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: localeStorageKey, newValue: 'zh' })));
  expect(screen.getByText('Current English')).toBeTruthy();
});

it('blocks changes while unknown account settings load and never creates default settings', () => {
  const saved = account('loading', undefined, undefined, false);
  render(<I18nProvider account={saved}><Probe /></I18nProvider>);
  const toggle = screen.getByRole('button');
  expect((toggle as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(toggle);
  expect(saved.save).not.toHaveBeenCalled();
});

it('toggles only the account preference in place and preserves practice input', async () => {
  const saved = account('alice', 'zh');
  const { rerender } = render(<I18nProvider account={saved}><Probe /></I18nProvider>);
  fireEvent.click(screen.getByRole('button'));
  // The durable workspace writer publishes the committed preference before resolving.
  rerender(<I18nProvider account={{ ...saved, preference: 'en' }}><Probe /></I18nProvider>);
  await waitFor(() => expect(screen.getByText('Current English')).toBeTruthy());
  expect(saved.save).toHaveBeenCalledExactlyOnceWith('en');
  expect(localStorage.getItem(localeStorageKey)).toBeNull();
  expect((screen.getByLabelText('practice') as HTMLInputElement).value).toBe('keep input');
});

it('does not claim a failed durable account save and restores the actual preference', async () => {
  render(<I18nProvider account={account('alice', 'zh', vi.fn(async () => { throw Error('quota'); }))}><Probe /></I18nProvider>);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('语言未保存'));
  expect(screen.getByText('当前中文')).toBeTruthy();
});

it('ignores a prior account save failure after identity changes', async () => {
  let reject!: (error: Error) => void;
  const save = vi.fn(() => new Promise<void>((_resolve, fail) => { reject = fail; }));
  const { rerender } = render(<I18nProvider account={account('alice', 'zh', save)}><Probe /></I18nProvider>);
  fireEvent.click(screen.getByRole('button'));
  rerender(<I18nProvider account={account('bob', 'en')}><Probe /></I18nProvider>);
  await act(async () => reject(Error('old account')));
  expect(screen.getByText('Current English')).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('releases an acknowledged optimistic choice when a newer same-account value already arrived', async () => {
  let resolve!: () => void;
  const save = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  const { rerender } = render(<I18nProvider account={account('alice', 'zh', save)}><Probe /></I18nProvider>);
  fireEvent.click(screen.getByRole('button'));
  rerender(<I18nProvider account={account('alice', 'en', save)}><Probe /></I18nProvider>);
  rerender(<I18nProvider account={account('alice', 'zh', save)}><Probe /></I18nProvider>);
  await act(async () => resolve());
  expect(screen.getByText('当前中文')).toBeTruthy();
});

it('restores the independent guest preference after leaving an account', () => {
  localStorage.setItem(localeStorageKey, 'zh');
  const { rerender } = render(<I18nProvider account={account('alice', 'en')}><Probe /></I18nProvider>);
  expect(screen.getByText('Current English')).toBeTruthy();
  rerender(<I18nProvider><Probe /></I18nProvider>);
  expect(screen.getByText('当前中文')).toBeTruthy();
});

it('settings selector and header share the preference, including automatic browser language', async () => {
  render(<I18nProvider><Probe /><SettingsDialog settings={defaultSettings} onChange={vi.fn()} locked={false} onClose={vi.fn()} onFocus={vi.fn()} focused={false} syncState="guest" onSync={vi.fn()} isSignedIn={false} /></I18nProvider>);
  const select = screen.getByLabelText('界面语言') as HTMLSelectElement;
  expect(select.value).toBe('auto');
  fireEvent.change(select, { target: { value: 'en' } });
  expect(screen.getByText('Current English')).toBeTruthy();
  expect((screen.getByLabelText('Interface language') as HTMLSelectElement).value).toBe('en');
  fireEvent.change(screen.getByLabelText('Interface language'), { target: { value: 'auto' } });
  expect(screen.getByText('当前中文')).toBeTruthy();
  expect((screen.getByLabelText('界面语言') as HTMLSelectElement).value).toBe('auto');
});

it('also exposes the same preference in account settings without saving profile fields', () => {
  const onUpdate = vi.fn();
  render(<I18nProvider account={account('alice', 'en')}><AccountDialog user={{ id: 'alice', username: 'alice', email: 'alice@example.test', isAdmin: false }} onUpdate={onUpdate} onClose={vi.fn()} onSignedOut={vi.fn()} onDelete={vi.fn()} /></I18nProvider>);
  expect((screen.getByLabelText('Interface language') as HTMLSelectElement).value).toBe('en');
  expect(onUpdate).not.toHaveBeenCalled();
});

it('keeps the document language owned by the account when the outer guest provider receives storage changes', () => {
  render(<I18nProvider><I18nProvider account={account('alice', 'en')}><Probe /></I18nProvider></I18nProvider>);
  act(() => window.dispatchEvent(new StorageEvent('storage', { key: localeStorageKey, newValue: 'zh' })));
  expect(screen.getByText('Current English')).toBeTruthy();
  expect(document.documentElement.lang).toBe('en');
});

it('shows account sync failures separately from local saving and offers a retry', () => {
  const retry = vi.fn(async () => {});
  const saved = { ...account('alice', 'en'), sync: { state: 'error' as const, retry, needsRecovery: false } };
  const content = <AccountDialog user={{ id: 'alice', username: 'alice', email: 'alice@example.test', isAdmin: false }} onUpdate={vi.fn()} onClose={vi.fn()} onSignedOut={vi.fn()} onDelete={vi.fn()} />;
  const { rerender } = render(<I18nProvider account={saved}>{content}</I18nProvider>);
  expect(screen.getByText('Sync failed')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Retry sync' }));
  expect(retry).toHaveBeenCalledOnce();
  rerender(<I18nProvider account={{ ...saved, sync: { ...saved.sync, needsRecovery: true } }}>{content}</I18nProvider>);
  expect(screen.queryByRole('button', { name: 'Retry sync' })).toBeNull();
  expect(screen.getByText('Resolve the conflict in practice settings')).toBeTruthy();
});

it('honors an explicit crawler locale without overwriting unread account preferences', () => {
  window.history.replaceState(null, '', '/library?tl=en');
  const save = vi.fn(async () => {});
  const { rerender } = render(<I18nProvider account={account('alice', undefined, save, false)}><Probe /></I18nProvider>);
  expect(screen.getByText('Current English')).toBeTruthy();
  rerender(<I18nProvider account={account('alice', 'zh', save)}><Probe /></I18nProvider>);
  expect(screen.getByText('Current English')).toBeTruthy();
  expect(save).not.toHaveBeenCalled();
  expect(window.location.search).toBe('?tl=en');
});

it('restores the previous explicit language URL when a manual account save fails', async () => {
  window.history.replaceState(null, '', '/library?tl=en&filter=keep');
  const save = vi.fn(async () => { throw new Error('storage failed'); });
  render(<I18nProvider account={account('alice', 'zh', save)}><Probe /></I18nProvider>);
  fireEvent.click(screen.getByRole('button'));
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Language not saved'));
  expect(screen.getByText('Current English')).toBeTruthy();
  expect(window.location.search).toBe('?tl=en&filter=keep');
  expect((screen.getByLabelText('practice') as HTMLInputElement).value).toBe('keep input');
});

it('lets later synced account preferences update a language URL created by a manual switch', async () => {
  const save = vi.fn(async () => {});
  const { rerender } = render(<I18nProvider account={account('alice', 'zh', save)}><Probe /></I18nProvider>);
  fireEvent.click(screen.getByRole('button'));
  rerender(<I18nProvider account={account('alice', 'en', save)}><Probe /></I18nProvider>);
  await act(async () => {});
  expect(window.location.search).toBe('?tl=en');
  rerender(<I18nProvider account={account('alice', 'zh', save)}><Probe /></I18nProvider>);
  expect(screen.getByText('当前中文')).toBeTruthy();
  expect(window.location.search).toBe('?tl=zh-CN');
  expect(save).toHaveBeenCalledTimes(1);
});

it('does not undo navigation when an account language save fails later', async () => {
  window.history.replaceState(null, '', '/library?tl=en');
  let rejectSave!: (error: Error) => void;
  const save = vi.fn(() => new Promise<void>((_resolve, reject) => { rejectSave = reject; }));
  render(<I18nProvider account={account('alice', 'zh', save)}><Probe /></I18nProvider>);
  fireEvent.click(screen.getByRole('button'));
  window.history.pushState(null, '', '/help?tl=zh-CN&filter=keep#section');
  await act(async () => { rejectSave(new Error('storage failed')); });
  await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Language not saved'));
  expect(window.location.pathname).toBe('/help');
  expect(window.location.search).toBe('?tl=en&filter=keep');
  expect(window.location.hash).toBe('#section');
});
