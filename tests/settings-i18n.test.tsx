// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { I18nProvider, localeStorageKey, useI18n } from '../src/lib/i18n';
import { AuthDialog } from '../src/components/AuthDialog';
import { SettingsDialog } from '../src/components/SettingsDialog';
import { BackgroundDialog } from '../src/components/BackgroundDialog';
import { defaultSettings } from '../src/lib/models';
function Toggle(){const {setLocale}=useI18n();return <button onClick={()=>setLocale('zh')}>Switch test locale</button>}
afterEach(()=>{cleanup();localStorage.clear();vi.restoreAllMocks()});
it('switches auth labels without discarding entered identity',()=>{
 localStorage.setItem(localeStorageKey,'en');
 render(<I18nProvider><Toggle/><AuthDialog onClose={()=>{}} onLogin={()=>{}}/></I18nProvider>);
 fireEvent.change(screen.getByLabelText('Username or email'),{target:{value:'reader@example.test'}});
 fireEvent.click(screen.getByText('Switch test locale'));
 expect((screen.getByLabelText('用户名或邮箱') as HTMLInputElement).value).toBe('reader@example.test');
});
it('renders English settings without changing the practice language',()=>{
 localStorage.setItem(localeStorageKey,'en');const onChange=vi.fn();
 render(<I18nProvider><SettingsDialog settings={defaultSettings} language="zh" onChange={onChange} locked={false} onClose={()=>{}} onFocus={()=>{}} focused={false} syncState="guest" onSync={()=>{}} isSignedIn={false}/></I18nProvider>);
 expect(screen.getByRole('dialog').textContent).toContain('Practice settings');
 expect(screen.getByLabelText('Practice mode')).toBeTruthy();expect(onChange).not.toHaveBeenCalled();
});
it('renders accessible English image controls without saving on cancel',()=>{
 localStorage.setItem(localeStorageKey,'en');const onSave=vi.fn(),onClose=vi.fn();
 render(<I18nProvider><BackgroundDialog theme="dark" onSave={onSave} onClose={onClose}/></I18nProvider>);
 expect(screen.getByLabelText('Background image')).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Cancel'}));expect(onClose).toHaveBeenCalledOnce();expect(onSave).not.toHaveBeenCalled();
});
