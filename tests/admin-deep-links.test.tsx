// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminWorkspace } from '../src/components/AdminWorkspace';
import { api } from '../src/lib/api';
vi.mock('../src/lib/api', async (original) => ({ ...await original<typeof import('../src/lib/api')>(), api: vi.fn() }));
vi.mock('../src/hooks/useWorkspace', () => ({ useWorkspace: () => ({ settings: {theme:'light'}, settingsReady:true, updateSettings:vi.fn() }) }));
const admin = {id:'admin',username:'admin',email:'admin@example.test',isAdmin:true};
beforeEach(() => {
 localStorage.clear(); window.history.replaceState(null, '', '/admin?tab=mail');
 vi.mocked(api).mockImplementation(async (url) => url.endsWith('/smtp') ? { source:'unconfigured', fallback:'unconfigured', revision:0, editable:true, config:null, passwordState:'empty' } : { metrics:{}, recentActions:[] });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.history.replaceState(null, '', '/'); });
it('opens a bookmarked column and preserves it after remount', async () => {
 const view = render(<AdminWorkspace user={admin} onLogout={vi.fn()} onPreview={vi.fn()} />);
 await screen.findByLabelText('SMTP 主机');
 fireEvent.click(screen.getByRole('button', {name:'概览'}));
 expect(window.location.pathname + window.location.search).toBe('/admin?tab=overview');
 view.unmount();
 render(<AdminWorkspace user={admin} onLogout={vi.fn()} onPreview={vi.fn()} />);
 expect(screen.getByRole('button', {name:'概览'}).getAttribute('aria-current')).toBe('page');
});
it('handles history column changes and cancels unsaved navigation without losing input', async () => {
 render(<AdminWorkspace user={admin} onLogout={vi.fn()} onPreview={vi.fn()} />);
 const host = await screen.findByLabelText('SMTP 主机');
 fireEvent.change(host, {target:{value:'smtp.unsaved.test'}});
 vi.spyOn(window, 'confirm').mockReturnValue(false);
 window.history.pushState(null, '', '/admin?tab=overview');
 fireEvent.popState(window);
 expect(window.location.search).toBe('?tab=mail');
 expect((screen.getByLabelText('SMTP 主机') as HTMLInputElement).value).toBe('smtp.unsaved.test');
 vi.mocked(window.confirm).mockReturnValue(true);
 window.history.pushState(null, '', '/admin?tab=overview');
 fireEvent.popState(window);
 expect(screen.queryByLabelText('SMTP 主机')).toBeNull();
 expect(screen.getByRole('button', {name:'概览'}).getAttribute('aria-current')).toBe('page');
});
it('falls back safely for an unknown column', () => {
 window.history.replaceState(null, '', '/admin?tab=not-a-column');
 render(<AdminWorkspace user={admin} onLogout={vi.fn()} onPreview={vi.fn()} />);
 expect(screen.getByRole('button', {name:'概览'}).getAttribute('aria-current')).toBe('page');
 expect(window.location.search).toBe('?tab=overview');
});

it('restores a canceled known back navigation and supports forward after acceptance', async () => {
 window.history.replaceState(null, '', '/admin?tab=overview');
 render(<AdminWorkspace user={admin} onLogout={vi.fn()} onPreview={vi.fn()} />);
 fireEvent.click(screen.getByRole('button', {name:'邮件'}));
 fireEvent.change(await screen.findByLabelText('SMTP 主机'), {target:{value:'smtp.keep.test'}});
 vi.spyOn(window, 'confirm').mockReturnValue(false);
 await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 60)); });
 expect(window.location.search).toBe('?tab=mail');
 expect((screen.getByLabelText('SMTP 主机') as HTMLInputElement).value).toBe('smtp.keep.test');
 vi.mocked(window.confirm).mockReturnValue(true);
 await act(async () => { window.history.back(); await new Promise(resolve => setTimeout(resolve, 60)); });
 expect(window.location.search).toBe('?tab=overview');
 expect(screen.queryByLabelText('SMTP 主机')).toBeNull();
 await act(async () => { window.history.forward(); await new Promise(resolve => setTimeout(resolve, 60)); });
 await screen.findByLabelText('SMTP 主机');
 expect(window.location.search).toBe('?tab=mail');
});
