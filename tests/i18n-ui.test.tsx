// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { I18nProvider, useI18n, resolveLocale, localeStorageKey } from '../src/lib/i18n';
function Probe() { const {locale,setLocale,t}=useI18n(); return <><span>{t('练习','Practice')}</span><input aria-label="draft" defaultValue="keep me"/><button onClick={()=>setLocale(locale==='en'?'zh':'en')}>switch</button></>; }
afterEach(()=>{window.history.replaceState(null, '', '/');cleanup();localStorage.clear();vi.restoreAllMocks();});
it('detects browser language without changing exercise language',()=>{expect(resolveLocale(null,['zh-TW','en'])).toBe('zh');expect(resolveLocale(null,['fr-FR'])).toBe('en');expect(resolveLocale('en',['zh-CN'])).toBe('en');expect(resolveLocale('invalid',['zh-CN'])).toBe('zh');});
it('switches UI in place and persists manual preference',()=>{localStorage.setItem(localeStorageKey,'en');render(<I18nProvider><Probe/></I18nProvider>);expect(screen.getByText('Practice')).toBeTruthy();fireEvent.click(screen.getByText('switch'));expect(screen.getByText('练习')).toBeTruthy();expect(localStorage.getItem(localeStorageKey)).toBe('zh');expect(document.documentElement.lang).toBe('zh-CN');expect((screen.getByLabelText('draft') as HTMLInputElement).value).toBe('keep me');});
it('still switches if storage is unavailable',()=>{vi.spyOn(Storage.prototype,'getItem').mockImplementation(()=>{throw Error('blocked')});vi.spyOn(Storage.prototype,'setItem').mockImplementation(()=>{throw Error('blocked')});render(<I18nProvider><Probe/></I18nProvider>);fireEvent.click(screen.getByText('switch'));expect(screen.getByLabelText('draft')).toBeTruthy();});

it('honors an explicit guest language URL over a different stored preference across provider remounts', () => {
 window.history.replaceState(null, '', '/library?tl=en');
 localStorage.setItem(localeStorageKey, 'zh');
 const view = render(<I18nProvider><Probe /></I18nProvider>);
 expect(screen.getByText('Practice')).toBeTruthy();
 expect(localStorage.getItem(localeStorageKey)).toBe('zh');
 view.unmount();
 render(<I18nProvider><Probe /></I18nProvider>);
 expect(screen.getByText('Practice')).toBeTruthy();
 expect(window.location.search).toBe('?tl=en');
 fireEvent.click(screen.getByText('switch'));
 expect(screen.getByText('练习')).toBeTruthy();
 expect(window.location.search).toBe('?tl=zh-CN');
});
