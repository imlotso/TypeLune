// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AdminConsole } from '../src/components/AdminConsole';
import { I18nProvider, localeStorageKey, useI18n } from '../src/lib/i18n';
import { api } from '../src/lib/api';
vi.mock('../src/lib/api', () => ({ api: vi.fn() }));
// Locale switches also update the URL; each case starts with a fresh visit.
beforeEach(() => { window.history.replaceState(null, '', '/'); });
afterEach(() => { cleanup(); localStorage.clear(); vi.resetAllMocks(); });
const overview = { metrics: { users: 3, disabledUsers: 1, admins: 2, activeUsers7d: 1, finishedPractices7d: 10, pendingScores: 2, publishedScores: 0, publishedArticles: 42 }, recentActions: [] };
function Switch(){ const {setLocale}=useI18n(); return <button onClick={()=>setLocale('zh')}>Set Chinese</button>; }
it('translates admin navigation, metrics and filters without changing user data', async()=>{
 localStorage.setItem(localeStorageKey,'en');
 vi.mocked(api).mockImplementation(async url=>{
  if(url==='/api/admin/overview') return overview;
  if(url.startsWith('/api/admin/users?')) return {entries:[{id:'user1',username:'用户原名',role:'user',status:'active',createdAt:1000}],page:1,pageSize:20,total:1};
  throw new Error('Unexpected request');
 });
 render(<I18nProvider><Switch/><AdminConsole ownerId="admin" onCatalogChange={vi.fn()}/></I18nProvider>);
 expect(await screen.findByText('Registered accounts')).toBeTruthy();
 expect(screen.getByRole('heading',{name:'Administration'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Users'}));
 expect(await screen.findByText('用户原名')).toBeTruthy();
 expect(screen.getByRole('searchbox',{name:'Username or email'})).toBeTruthy();
 expect(screen.getByRole('combobox',{name:'Account status'})).toBeTruthy();
 expect(screen.getByRole('button',{name:'用户原名 details'})).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Set Chinese'}));
 expect(screen.getByRole('heading',{name:'管理后台'})).toBeTruthy();
 expect(screen.getByRole('searchbox',{name:'用户名或邮箱'})).toBeTruthy();
 expect(screen.getByText('用户原名')).toBeTruthy();
});
it('renders SMTP labels and configuration source in English',async()=>{
 localStorage.setItem(localeStorageKey,'en');
 vi.mocked(api).mockImplementation(async url=>{
  if(url==='/api/admin/overview')return overview;
  if(url==='/api/admin/smtp')return {config:null,revision:0,source:'unconfigured',fallback:'unconfigured',editable:true,passwordState:'empty'};
  throw new Error('Unexpected request');
 });
 render(<I18nProvider><AdminConsole ownerId="admin" onCatalogChange={vi.fn()}/></I18nProvider>);
 fireEvent.click(screen.getByRole('button',{name:'Email'}));
 expect(await screen.findByText('SMTP · Not configured')).toBeTruthy();
 expect(screen.getByLabelText('Sender address')).toBeTruthy();
 expect(screen.getByLabelText('SMTP host')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Test connection'})).toBeTruthy();
});
