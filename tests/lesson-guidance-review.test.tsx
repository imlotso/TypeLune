// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import { FingerGuide } from '../src/components/FingerGuide';
import { LessonsView } from '../src/components/LessonsView';
import { I18nProvider } from '../src/lib/i18n';
import { keyHint } from '../src/lib/lessons';
beforeEach(() => { localStorage.clear(); localStorage.setItem('typelune.ui-locale.v1', 'en'); });
afterEach(cleanup);
it('describes backtick and tilde instead of reporting a finished lesson', () => {
  expect(keyHint('`', 'en')).toMatchObject({ key: '`', finger: 'Left little', shift: false });
  expect(keyHint('~', 'en')).toMatchObject({ key: '`', finger: 'Left little', shift: true });
});
it('retains reduced motion when the guide is unmounted and reopened', () => {
  const first = render(<I18nProvider><FingerGuide character="F" /></I18nProvider>);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Reduce motion' }));
  first.unmount();
  const second = render(<I18nProvider><FingerGuide character="J" /></I18nProvider>);
  expect((screen.getByRole('checkbox', { name: 'Reduce motion' }) as HTMLInputElement).checked).toBe(true);
  expect(second.container.querySelector('.finger-guide-static')).not.toBeNull();
});
it('clearly labels the legacy eight-round progress as basics', () => {
  render(<I18nProvider><LessonsView records={[]} drafts={[]} ownerId={null} onSelect={() => {}} onResume={() => {}} /></I18nProvider>);
  expect(screen.getByText('Basic lessons completed')).toBeTruthy();
  expect(screen.getByRole('progressbar', { name: 'Basic lessons completed' })).toBeTruthy();
});
